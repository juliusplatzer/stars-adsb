import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { URL } from "node:url";

const HOST = process.env.HOST?.trim() || "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const MAX_JSON_BYTES = parsePositiveIntEnv("WX_POST_MAX_BYTES", 40_000_000);
const QNH_MAX_JSON_BYTES = parsePositiveIntEnv("QNH_POST_MAX_BYTES", 2_000_000);
const INGEST_TOKEN = (process.env.ITWS_INGEST_TOKEN ?? "").trim();
const QNH_INGEST_TOKEN = (process.env.QNH_INGEST_TOKEN ?? "").trim();

const MAIN_ICAO = normalizeIcao(process.env.MAIN_ICAO) ?? "KJFK";
const QNH_REFRESH_MS = parsePositiveIntEnv("QNH_REFRESH_MS", 60_000);
const QNH_SOURCE_TIMEOUT_MS = parsePositiveIntEnv("QNH_SOURCE_TIMEOUT_MS", 8_000);
const QNH_SOURCE_BASE_URL =
  (process.env.QNH_SOURCE_BASE_URL ?? "https://aviationweather.gov/api/data/metar").trim();
const QNH_POST_URL =
  (process.env.QNH_POST_URL ?? `http://${HOST}:${PORT}/api/wx/qnh`).trim();
const TRACON_CONFIG_PATH = (process.env.TRACON_CONFIG_PATH ?? "").trim();

let latestRadarPayload: unknown = null;
let latestRadarUpdatedAtMs = 0;

let latestQnhPayload: QnhIngestPayload | null = null;
let latestQnhUpdatedAtMs = 0;
const qnhByIcao = new Map<string, QnhStationRecord>();
let qnhRefreshInFlight = false;
let qnhTargetsPromise: Promise<string[]> | null = null;

interface RadarCenter {
  lat: number;
  lon: number;
}

interface QnhStationRecord {
  icao: string;
  qnhMmHg: number | null;
  qnhInHg: number | null;
  observedAt?: string;
  rawMetar?: string;
}

interface QnhIngestPayload {
  updatedAtMs: number;
  source: string;
  mainIcao: string;
  requestedIcaos: string[];
  stations: QnhStationRecord[];
}

interface TraconAirportConfig {
  ssa_qnh?: string[];
}

interface TraconConfigPayload {
  airports?: Record<string, TraconAirportConfig>;
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeIcao(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  const upper = raw.toUpperCase();
  return /^[A-Z0-9]{4}$/.test(upper) ? upper : null;
}

function normalizeIcaoList(values: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < values.length; i += 1) {
    const icao = normalizeIcao(values[i]);
    if (!icao || seen.has(icao)) {
      continue;
    }
    seen.add(icao);
    out.push(icao);
  }
  return out;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function inHgToMmHg(inHg: number): number {
  return inHg * 25.4;
}

function mmHgToInHg(mmHg: number): number {
  return mmHg / 25.4;
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-WX-Token,X-QNH-Token");
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        reject(new Error(`Payload too large (>${maxBytes} bytes)`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("error", (error) => reject(error));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw.length === 0 ? {} : JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function parseFiniteNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildFallbackRadarPayload(center: RadarCenter, radiusNm: number): Record<string, unknown> {
  return {
    updatedAtMs: Date.now(),
    center,
    radiusNm,
    cellSizeNm: 1,
    width: 1,
    height: 1,
    levels: [0],
    rows: 1,
    cols: 1,
    layout: "row-major",
    cells: [0],
    trp: {
      latDeg: center.lat,
      lonDeg: center.lon
    },
    gridGeom: {
      xOffsetM: 0,
      yOffsetM: 0,
      dxM: 1852,
      dyM: 1852,
      rotationDeg: 0
    }
  };
}

function getHeader(req: IncomingMessage, key: string): string {
  const raw = req.headers[key.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0] ?? "";
  }
  return raw ?? "";
}

function resolveConfigPathCandidates(): string[] {
  const out: string[] = [];
  const add = (candidate: string): void => {
    const resolved = resolve(process.cwd(), candidate);
    if (!out.includes(resolved)) {
      out.push(resolved);
    }
  };

  if (TRACON_CONFIG_PATH.length > 0) {
    add(TRACON_CONFIG_PATH);
  }

  add("../client/data/configs/N90.json");
  add("src/client/data/configs/N90.json");
  add("client/data/configs/N90.json");

  return out;
}

async function readTraconConfig(): Promise<TraconConfigPayload | null> {
  const candidates = resolveConfigPathCandidates();
  for (let i = 0; i < candidates.length; i += 1) {
    const path = candidates[i];
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const object = asObject(parsed);
      if (!object) {
        continue;
      }
      return object as TraconConfigPayload;
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

async function resolveQnhTargetIcaos(): Promise<string[]> {
  if (qnhTargetsPromise) {
    return qnhTargetsPromise;
  }

  qnhTargetsPromise = (async () => {
    const config = await readTraconConfig();
    const airports = asObject(config?.airports) ?? {};
    const mainAirport = asObject(airports[MAIN_ICAO]);
    const ssaQnhRaw = Array.isArray(mainAirport?.ssa_qnh) ? mainAirport.ssa_qnh : [];
    const fromConfig = normalizeIcaoList(ssaQnhRaw);
    const merged = normalizeIcaoList([MAIN_ICAO, ...fromConfig]);
    if (merged.length === 0) {
      return [MAIN_ICAO];
    }
    return merged;
  })();

  return qnhTargetsPromise;
}

function parseAltimeterFromRawMetar(rawMetar: string): number | null {
  const inHgMatch = rawMetar.match(/\bA(\d{4})\b/i);
  if (inHgMatch) {
    const encoded = Number.parseInt(inHgMatch[1], 10);
    if (Number.isFinite(encoded) && encoded > 0) {
      return encoded / 100;
    }
  }

  const hpaMatch = rawMetar.match(/\bQ(\d{4})\b/i);
  if (hpaMatch) {
    const hpa = Number.parseInt(hpaMatch[1], 10);
    if (Number.isFinite(hpa) && hpa >= 850 && hpa <= 1100) {
      return hpa / 33.8638866667;
    }
  }

  return null;
}

function parseAltimeterInHg(record: Record<string, unknown>): number | null {
  const inHgFields = [
    "altim",
    "altimeter",
    "altim_in_hg",
    "altimeter_in_hg",
    "qnh_in_hg",
    "qnhInHg"
  ];
  for (let i = 0; i < inHgFields.length; i += 1) {
    const value = asFiniteNumber(record[inHgFields[i]]);
    if (value !== null && value >= 20 && value <= 40) {
      return value;
    }
  }

  const hPaFields = ["altim_hpa", "altimeter_hpa", "qnh_hpa", "qnh"];
  for (let i = 0; i < hPaFields.length; i += 1) {
    const value = asFiniteNumber(record[hPaFields[i]]);
    if (value !== null && value >= 850 && value <= 1100) {
      return value / 33.8638866667;
    }
  }

  const rawMetarFields = ["rawOb", "raw_text", "raw", "metar"];
  for (let i = 0; i < rawMetarFields.length; i += 1) {
    const text = asString(record[rawMetarFields[i]]);
    if (!text) {
      continue;
    }
    const parsed = parseAltimeterFromRawMetar(text);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function parseObservedTime(record: Record<string, unknown>): string | undefined {
  const fields = ["obsTime", "obsTimeUtc", "observed", "observationTime", "receiptTime", "reportTime"];
  for (let i = 0; i < fields.length; i += 1) {
    const text = asString(record[fields[i]]);
    if (text) {
      return text;
    }
  }
  return undefined;
}

function parseRawMetarText(record: Record<string, unknown>): string | undefined {
  const fields = ["rawOb", "raw_text", "raw", "metar"];
  for (let i = 0; i < fields.length; i += 1) {
    const text = asString(record[fields[i]]);
    if (text) {
      return text;
    }
  }
  return undefined;
}

function parseMetarIcao(record: Record<string, unknown>): string | null {
  const fields = ["icaoId", "stationId", "icao", "id"];
  for (let i = 0; i < fields.length; i += 1) {
    const icao = normalizeIcao(record[fields[i]]);
    if (icao) {
      return icao;
    }
  }
  return null;
}

async function fetchQnhStationsFromSource(requestedIcaos: string[]): Promise<QnhStationRecord[]> {
  if (requestedIcaos.length === 0) {
    return [];
  }

  const sourceUrl = new URL(QNH_SOURCE_BASE_URL);
  sourceUrl.searchParams.set("format", "json");
  sourceUrl.searchParams.set("ids", requestedIcaos.join(","));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), QNH_SOURCE_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`QNH source returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const payloadObject = asObject(payload);
    const rawItems = Array.isArray(payload)
      ? payload
      : Array.isArray(payloadObject?.data)
      ? payloadObject.data
      : [];

    const parsedByIcao = new Map<string, QnhStationRecord>();
    for (let i = 0; i < rawItems.length; i += 1) {
      const record = asObject(rawItems[i]);
      if (!record) {
        continue;
      }

      const icao = parseMetarIcao(record);
      if (!icao || !requestedIcaos.includes(icao)) {
        continue;
      }

      const altimeterInHg = parseAltimeterInHg(record);
      const qnhInHg = altimeterInHg !== null ? roundTo(altimeterInHg, 2) : null;
      const qnhMmHg = qnhInHg !== null ? roundTo(inHgToMmHg(qnhInHg), 1) : null;
      parsedByIcao.set(icao, {
        icao,
        qnhInHg,
        qnhMmHg,
        observedAt: parseObservedTime(record),
        rawMetar: parseRawMetarText(record)
      });
    }

    const stations: QnhStationRecord[] = [];
    for (let i = 0; i < requestedIcaos.length; i += 1) {
      const icao = requestedIcaos[i];
      stations.push(parsedByIcao.get(icao) ?? { icao, qnhMmHg: null, qnhInHg: null });
    }

    return stations;
  } finally {
    clearTimeout(timeout);
  }
}

function buildQnhIngestPayload(requestedIcaos: string[], stations: QnhStationRecord[]): QnhIngestPayload {
  return {
    updatedAtMs: Date.now(),
    source: "aviationweather.gov/api/data/metar",
    mainIcao: MAIN_ICAO,
    requestedIcaos,
    stations
  };
}

function normalizeQnhIngestPayload(input: unknown): QnhIngestPayload | null {
  const root = asObject(input);
  if (!root) {
    return null;
  }

  const stationsRaw = Array.isArray(root.stations) ? root.stations : null;
  if (!stationsRaw) {
    return null;
  }

  const stations: QnhStationRecord[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < stationsRaw.length; i += 1) {
    const station = asObject(stationsRaw[i]);
    if (!station) {
      continue;
    }

    const icao = normalizeIcao(station.icao);
    if (!icao || seen.has(icao)) {
      continue;
    }

    const rawMmHg = asFiniteNumber(station.qnhMmHg);
    const rawInHg = asFiniteNumber(station.qnhInHg);

    let qnhMmHg = rawMmHg !== null && rawMmHg > 0 ? roundTo(rawMmHg, 1) : null;
    let qnhInHg = rawInHg !== null && rawInHg > 0 ? roundTo(rawInHg, 2) : null;

    if (qnhMmHg === null && qnhInHg !== null) {
      qnhMmHg = roundTo(inHgToMmHg(qnhInHg), 1);
    }
    if (qnhInHg === null && qnhMmHg !== null) {
      qnhInHg = roundTo(mmHgToInHg(qnhMmHg), 2);
    }

    stations.push({
      icao,
      qnhMmHg,
      qnhInHg,
      observedAt: asString(station.observedAt) ?? undefined,
      rawMetar: asString(station.rawMetar) ?? undefined
    });
    seen.add(icao);
  }

  const requestedIcaosRaw = Array.isArray(root.requestedIcaos) ? root.requestedIcaos : [];
  const requestedIcaos = normalizeIcaoList(requestedIcaosRaw);
  const finalRequested = requestedIcaos.length > 0 ? requestedIcaos : stations.map((station) => station.icao);

  const updatedAtRaw = asFiniteNumber(root.updatedAtMs);
  const updatedAtMs =
    updatedAtRaw !== null && updatedAtRaw > 0 ? Math.floor(updatedAtRaw) : Date.now();

  return {
    updatedAtMs,
    source: asString(root.source) ?? "unknown",
    mainIcao: normalizeIcao(root.mainIcao) ?? MAIN_ICAO,
    requestedIcaos: finalRequested,
    stations
  };
}

function storeQnhPayload(payload: QnhIngestPayload): void {
  qnhByIcao.clear();
  for (let i = 0; i < payload.stations.length; i += 1) {
    const station = payload.stations[i];
    qnhByIcao.set(station.icao, station);
  }
  latestQnhPayload = payload;
  latestQnhUpdatedAtMs = payload.updatedAtMs;
}

function buildQnhQueryResponse(requestedIcaos: string[]): {
  requestedIcaos: string[];
  results: Array<{ icao: string; qnhInHg: number | null }>;
} {
  const results = requestedIcaos.map((icao) => {
    const station = qnhByIcao.get(icao) ?? null;
    const qnhInHg = station?.qnhInHg ?? (station?.qnhMmHg !== null && station?.qnhMmHg !== undefined
      ? roundTo(mmHgToInHg(station.qnhMmHg), 2)
      : null);
    return {
      icao,
      qnhInHg: qnhInHg ?? null
    };
  });

  return {
    requestedIcaos,
    results
  };
}

async function postQnhPayloadToServer(payload: QnhIngestPayload): Promise<void> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (QNH_INGEST_TOKEN.length > 0) {
    headers["x-qnh-token"] = QNH_INGEST_TOKEN;
  }

  const response = await fetch(QNH_POST_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`QNH POST failed HTTP ${response.status}: ${responseBody}`);
  }
}

async function refreshAndPostQnh(): Promise<void> {
  if (qnhRefreshInFlight) {
    return;
  }
  qnhRefreshInFlight = true;

  try {
    const requestedIcaos = await resolveQnhTargetIcaos();
    const stations = await fetchQnhStationsFromSource(requestedIcaos);
    const payload = buildQnhIngestPayload(requestedIcaos, stations);

    // Keep local cache updated even if the self-POST fails.
    storeQnhPayload(payload);

    await postQnhPayloadToServer(payload);
    console.info(
      `QNH refreshed for ${requestedIcaos.join(", ")} (updatedAtMs=${payload.updatedAtMs})`
    );
  } catch (error) {
    console.error("Failed to refresh/post QNH:", error);
  } finally {
    qnhRefreshInFlight = false;
  }
}

const server = createServer(async (req, res) => {
  setCorsHeaders(res);

  if (!req.url) {
    writeJson(res, 400, { error: "Missing request URL." });
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const { pathname } = url;
  const method = req.method ?? "GET";

  if (method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (pathname === "/health" && method === "GET") {
    writeJson(res, 200, {
      ok: true,
      service: "vstars-server",
      radarUpdatedAtMs: latestRadarUpdatedAtMs || null,
      qnhUpdatedAtMs: latestQnhUpdatedAtMs || null,
      mainIcao: MAIN_ICAO
    });
    return;
  }

  if (pathname === "/api/wx/radar") {
    if (method === "POST") {
      if (INGEST_TOKEN.length > 0) {
        const token = getHeader(req, "x-wx-token").trim();
        if (token !== INGEST_TOKEN) {
          writeJson(res, 401, { error: "Invalid ingest token." });
          return;
        }
      }

      try {
        const payload = await readJsonBody(req, MAX_JSON_BYTES);
        latestRadarPayload = payload;
        latestRadarUpdatedAtMs = Date.now();
        writeJson(res, 202, {
          ok: true,
          storedAtMs: latestRadarUpdatedAtMs
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid JSON payload.";
        writeJson(res, 400, { error: message });
      }
      return;
    }

    if (method === "GET") {
      const center = {
        lat: parseFiniteNumber(url.searchParams.get("lat"), 0),
        lon: parseFiniteNumber(url.searchParams.get("lon"), 0)
      };
      const radiusNm = parseFiniteNumber(url.searchParams.get("radiusNm"), 80);

      if (latestRadarPayload !== null) {
        writeJson(res, 200, latestRadarPayload);
        return;
      }

      writeJson(res, 200, buildFallbackRadarPayload(center, radiusNm));
      return;
    }

    writeJson(res, 405, { error: "Method not allowed." });
    return;
  }

  if (pathname === "/api/wx/qnh") {
    if (method === "POST") {
      if (QNH_INGEST_TOKEN.length > 0) {
        const token = getHeader(req, "x-qnh-token").trim();
        if (token !== QNH_INGEST_TOKEN) {
          writeJson(res, 401, { error: "Invalid QNH ingest token." });
          return;
        }
      }

      try {
        const payload = await readJsonBody(req, QNH_MAX_JSON_BYTES);
        const normalized = normalizeQnhIngestPayload(payload);
        if (!normalized) {
          writeJson(res, 400, { error: "Invalid QNH payload." });
          return;
        }

        storeQnhPayload(normalized);
        writeJson(res, 202, {
          ok: true,
          storedAtMs: normalized.updatedAtMs,
          stations: normalized.stations.length
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid JSON payload.";
        writeJson(res, 400, { error: message });
      }
      return;
    }

    if (method === "GET") {
      if (latestQnhPayload) {
        writeJson(res, 200, latestQnhPayload);
        return;
      }

      writeJson(res, 200, {
        updatedAtMs: Date.now(),
        source: "none",
        mainIcao: MAIN_ICAO,
        requestedIcaos: [MAIN_ICAO],
        stations: []
      } satisfies QnhIngestPayload);
      return;
    }

    writeJson(res, 405, { error: "Method not allowed." });
    return;
  }

  if (pathname === "/api/qnh") {
    if (method !== "GET") {
      writeJson(res, 405, { error: "Method not allowed." });
      return;
    }

    const requestedIcaos = normalizeIcaoList(url.searchParams.getAll("icao"));
    const finalIcaos = requestedIcaos.length > 0 ? requestedIcaos : [MAIN_ICAO];

    writeJson(res, 200, buildQnhQueryResponse(finalIcaos));
    return;
  }

  writeJson(res, 404, { error: "Not found." });
});

server.listen(PORT, HOST, () => {
  console.log(`WX radar server listening on http://${HOST}:${PORT}`);
  console.log(`POST target: http://${HOST}:${PORT}/api/wx/radar`);
  console.log(`QNH source ICAO main: ${MAIN_ICAO}`);
  console.log(`QNH worker POST target: ${QNH_POST_URL}`);

  void refreshAndPostQnh();
  setInterval(() => {
    void refreshAndPostQnh();
  }, QNH_REFRESH_MS);
});
