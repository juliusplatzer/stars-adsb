import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { URL, fileURLToPath } from "node:url";
import { startAdsbClient } from "./adsb_client.js";
import { startTfrNotamsWorker, type TfrsIngestPayload } from "./tfrs_notams.js";

const HOST = process.env.HOST?.trim() || "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const MAX_JSON_BYTES = parsePositiveIntEnv("WX_POST_MAX_BYTES", 40_000_000);
const QNH_MAX_JSON_BYTES = parsePositiveIntEnv("QNH_POST_MAX_BYTES", 2_000_000);
const AIRCRAFT_MAX_JSON_BYTES = parsePositiveIntEnv("AIRCRAFT_POST_MAX_BYTES", 8_000_000);
const TFRS_MAX_JSON_BYTES = parsePositiveIntEnv("TFRS_POST_MAX_BYTES", 8_000_000);
const TAIS_MAX_JSON_BYTES = parsePositiveIntEnv("TAIS_POST_MAX_BYTES", 8_000_000);
const INGEST_TOKEN = (process.env.ITWS_INGEST_TOKEN ?? "").trim();
const QNH_INGEST_TOKEN = (process.env.QNH_INGEST_TOKEN ?? "").trim();
const AIRCRAFT_INGEST_TOKEN = (process.env.AIRCRAFT_INGEST_TOKEN ?? "").trim();
const TFRS_INGEST_TOKEN = (process.env.TFRS_INGEST_TOKEN ?? "").trim();
const TAIS_INGEST_TOKEN = (process.env.TAIS_INGEST_TOKEN ?? "").trim();

const MAIN_ICAO = normalizeIcao(process.env.MAIN_ICAO) ?? "KJFK";
const POS = normalizeControllerPosition(process.env.POS) ?? "2A";
const QNH_REFRESH_MS = parsePositiveIntEnv("QNH_REFRESH_MS", 60_000);
const QNH_SOURCE_TIMEOUT_MS = parsePositiveIntEnv("QNH_SOURCE_TIMEOUT_MS", 8_000);
const QNH_SOURCE_BASE_URL =
  (process.env.QNH_SOURCE_BASE_URL ?? "https://aviationweather.gov/api/data/metar").trim();
const QNH_POST_URL =
  (process.env.QNH_POST_URL ?? `http://${HOST}:${PORT}/api/wx/qnh`).trim();
const TRACON_CONFIG_PATH = (process.env.TRACON_CONFIG_PATH ?? "").trim();
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const RECAT_CWT_PATH = resolve(MODULE_DIR, "../../data/recat_cwt.json");
const TAIS_CACHE_STALE_MS = parsePositiveIntEnv("TAIS_CACHE_STALE_MS", 5 * 60 * 1000);
const AIRCRAFT_DESTINATION_DEFAULT = "XXX";

let latestRadarPayload: unknown = null;
let latestRadarUpdatedAtMs = 0;

let latestQnhPayload: QnhIngestPayload | null = null;
let latestQnhUpdatedAtMs = 0;
const qnhByIcao = new Map<string, QnhStationRecord>();
let qnhRefreshInFlight = false;
let qnhTargetsPromise: Promise<string[]> | null = null;

let latestAircraftPosPayload: AircraftPositionIngestPayload | null = null;
let latestAircraftPosUpdatedAtMs = 0;

let latestAircraftTaisPayload: unknown = null;
let latestAircraftTaisUpdatedAtMs = 0;
const taisByCallsign = new Map<string, TaisCacheEntry>();
let recatCwtByTypePromise: Promise<Map<string, string>> | null = null;
let recatCwtLoadWarned = false;

let latestTfrsPayload: TfrsIngestPayload | null = null;
let latestTfrsUpdatedAtMs = 0;

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
  positionId: string;
  requestedIcaos: string[];
  stations: QnhStationRecord[];
}

interface AircraftPositionRecord {
  callsign: string | null;
  aircraftType: string | null;
  groundspeedKts: number | null;
  position: { lat: number; lon: number };
  trackDeg: number | null;
  altitudeAmslFt: number | null;
  wakeCategory: string | null;
  squawk: string | null;
  seenPosSeconds: number | null;
  destinationIcao: string | null;
  destinationIata: string | null;
  history: Array<{ lat: number; lon: number }>;
}

interface AircraftPositionIngestPayload {
  updatedAtMs: number;
  source: string;
  upstreamUrl?: string;
  aircraft: AircraftPositionRecord[];
}

interface TaisCacheEntry {
  callsign: string;
  cps: string | null;
  destinationIcao: string | null;
  destinationIata: string | null;
  updatedAtMs: number;
}

interface AircraftAllRecord {
  id: string;
  callsign: string | null;
  position: { lat: number; lon: number };
  history: Array<{ lat: number; lon: number }>;
  previousPositions: Array<{ lat: number; lon: number }>;
  aircraftType: string | null;
  aircraftTypeIcao: string | null;
  cwt: string | null;
  wakeCategory: string | null;
  controllerPosition: string | null;
  cps: string | null;
  altitudeAmslFt: number | null;
  groundspeedKts: number | null;
  destinationIata: string;
  destinationIcao: string | null;
  trackDeg: number | null;
  squawk: string | null;
  seenPosSeconds: number | null;
}

interface AircraftAllPayload {
  updatedAtMs: number;
  source: string;
  aircraft: AircraftAllRecord[];
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

function normalizeIata(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  const upper = raw.toUpperCase();
  return /^[A-Z0-9]{3,4}$/.test(upper) ? upper : null;
}

function normalizeCallsign(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  return raw.toUpperCase();
}

function normalizeAircraftType(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  return raw.toUpperCase();
}

function normalizeWakeCategory(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  return raw.toUpperCase();
}

function normalizeControllerPosition(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  return raw.toUpperCase();
}

function normalizeSquawk(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  const normalized = raw.toUpperCase().replace(/\s+/g, "");
  return normalized.length > 0 ? normalized : null;
}

function deriveIataFromIcao(icao: string | null): string | null {
  if (!icao) {
    return null;
  }
  if (icao.startsWith("K")) {
    return icao.slice(1);
  }
  return null;
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
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,X-WX-Token,X-QNH-Token,X-Aircraft-Token,X-TFRS-Token,X-TAIS-Token"
  );
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

function inferUpdatedAtMs(payload: unknown): number {
  const root = asObject(payload);
  if (!root) {
    return Date.now();
  }
  const updatedAtRaw = asFiniteNumber(root.updatedAtMs);
  if (updatedAtRaw !== null && updatedAtRaw > 0) {
    return Math.floor(updatedAtRaw);
  }
  return Date.now();
}

function parseTimestampMs(value: unknown): number | null {
  const numeric = asFiniteNumber(value);
  if (numeric !== null && numeric > 0) {
    return Math.floor(numeric);
  }
  const text = asString(value);
  if (!text) {
    return null;
  }
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

function extractTaisRecordObjects(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => asObject(item))
      .filter((item): item is Record<string, unknown> => item !== null);
  }

  const root = asObject(payload);
  if (!root) {
    return [];
  }

  const recordsRaw = Array.isArray(root.records) ? root.records : [];
  const records = recordsRaw
    .map((item) => asObject(item))
    .filter((item): item is Record<string, unknown> => item !== null);
  if (records.length > 0) {
    return records;
  }

  return [root];
}

function normalizeTaisRecord(
  record: Record<string, unknown>,
  fallbackUpdatedAtMs: number
): TaisCacheEntry | null {
  const callsign = normalizeCallsign(record.callsign);
  if (!callsign) {
    return null;
  }

  const destinationIcao = normalizeIcao(record.destinationIcao);
  const destinationIata =
    normalizeIata(record.destinationIata) ?? deriveIataFromIcao(destinationIcao);

  const updatedAtMs =
    parseTimestampMs(record.updatedAtMs) ??
    parseTimestampMs(record.receivedAt) ??
    fallbackUpdatedAtMs;

  return {
    callsign,
    cps: normalizeControllerPosition(record.cps),
    destinationIcao,
    destinationIata,
    updatedAtMs
  };
}

function pruneStaleTaisCache(nowMs: number): void {
  for (const [callsign, entry] of taisByCallsign.entries()) {
    if (nowMs - entry.updatedAtMs > TAIS_CACHE_STALE_MS) {
      taisByCallsign.delete(callsign);
    }
  }
}

function updateTaisCacheFromPayload(payload: unknown): void {
  const nowMs = Date.now();
  pruneStaleTaisCache(nowMs);
  const fallbackUpdatedAtMs = inferUpdatedAtMs(payload);
  const records = extractTaisRecordObjects(payload);

  for (let i = 0; i < records.length; i += 1) {
    const normalized = normalizeTaisRecord(records[i], fallbackUpdatedAtMs);
    if (!normalized) {
      continue;
    }

    const previous = taisByCallsign.get(normalized.callsign) ?? null;
    taisByCallsign.set(normalized.callsign, {
      callsign: normalized.callsign,
      cps: normalized.cps ?? previous?.cps ?? null,
      destinationIcao: normalized.destinationIcao ?? previous?.destinationIcao ?? null,
      destinationIata: normalized.destinationIata ?? previous?.destinationIata ?? null,
      updatedAtMs: Math.max(normalized.updatedAtMs, previous?.updatedAtMs ?? 0)
    });
  }
}

async function loadRecatCwtByType(): Promise<Map<string, string>> {
  try {
    const raw = await readFile(RECAT_CWT_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const root = asObject(parsed);
    const aircraft = asObject(root?.aircraft);
    const out = new Map<string, string>();

    if (!aircraft) {
      return out;
    }

    for (const [designatorRaw, value] of Object.entries(aircraft)) {
      const designator = normalizeAircraftType(designatorRaw);
      const entry = asObject(value);
      const cwt = asString(entry?.cwt);
      if (!designator || !cwt) {
        continue;
      }
      out.set(designator, cwt.toUpperCase());
    }

    return out;
  } catch (error) {
    if (!recatCwtLoadWarned) {
      recatCwtLoadWarned = true;
      console.warn(`Failed to load RECAT CWT lookup at ${RECAT_CWT_PATH}:`, error);
    }
    return new Map<string, string>();
  }
}

async function getRecatCwtByType(): Promise<Map<string, string>> {
  if (!recatCwtByTypePromise) {
    recatCwtByTypePromise = loadRecatCwtByType();
  }
  return recatCwtByTypePromise;
}

function resolveMergedDestinationIata(
  adsbDestinationIata: string | null,
  taisEntry: TaisCacheEntry | null
): string {
  const taisDestination =
    taisEntry?.destinationIata ?? deriveIataFromIcao(taisEntry?.destinationIcao ?? null);
  if (taisDestination) {
    return taisDestination;
  }
  if (adsbDestinationIata) {
    return adsbDestinationIata;
  }
  return AIRCRAFT_DESTINATION_DEFAULT;
}

function resolveAircraftCwt(
  aircraftType: string | null,
  wakeCategory: string | null,
  recatCwtByType: Map<string, string>
): string | null {
  if (aircraftType) {
    const matched = recatCwtByType.get(aircraftType);
    if (matched) {
      return matched;
    }
  }
  return wakeCategory;
}

async function buildAircraftAllPayload(): Promise<AircraftAllPayload> {
  const adsbPayload = latestAircraftPosPayload;
  if (!adsbPayload) {
    return {
      updatedAtMs: Date.now(),
      source: "none",
      aircraft: []
    };
  }

  const nowMs = Date.now();
  pruneStaleTaisCache(nowMs);
  const recatCwtByType = await getRecatCwtByType();
  const idCounts = new Map<string, number>();
  const aircraft: AircraftAllRecord[] = [];

  for (let i = 0; i < adsbPayload.aircraft.length; i += 1) {
    const item = adsbPayload.aircraft[i];
    const callsign = normalizeCallsign(item.callsign);
    const aircraftType = normalizeAircraftType(item.aircraftType);
    const wakeCategory = normalizeWakeCategory(item.wakeCategory);
    const taisEntry = callsign ? taisByCallsign.get(callsign) ?? null : null;
    const cwt = resolveAircraftCwt(aircraftType, wakeCategory, recatCwtByType);
    const idBase = callsign ?? `AC-${i + 1}`;
    const duplicateCount = idCounts.get(idBase) ?? 0;
    idCounts.set(idBase, duplicateCount + 1);
    const id = duplicateCount === 0 ? idBase : `${idBase}#${duplicateCount + 1}`;

    aircraft.push({
      id,
      callsign,
      position: item.position,
      history: item.history,
      previousPositions: item.history,
      aircraftType,
      aircraftTypeIcao: aircraftType,
      cwt,
      wakeCategory: cwt,
      controllerPosition: taisEntry?.cps ?? null,
      cps: taisEntry?.cps ?? null,
      altitudeAmslFt: item.altitudeAmslFt,
      groundspeedKts: item.groundspeedKts,
      destinationIata: resolveMergedDestinationIata(normalizeIata(item.destinationIata), taisEntry),
      destinationIcao: item.destinationIcao,
      trackDeg: item.trackDeg,
      squawk: item.squawk,
      seenPosSeconds: item.seenPosSeconds
    });
  }

  return {
    updatedAtMs: adsbPayload.updatedAtMs,
    source: adsbPayload.source,
    aircraft
  };
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

function normalizeAircraftPositionIngestPayload(input: unknown): AircraftPositionIngestPayload | null {
  const root = asObject(input);
  if (!root) {
    return null;
  }

  const aircraftRaw = Array.isArray(root.aircraft) ? root.aircraft : null;
  if (!aircraftRaw) {
    return null;
  }

  const aircraft: AircraftPositionRecord[] = [];
  for (let i = 0; i < aircraftRaw.length; i += 1) {
    const item = asObject(aircraftRaw[i]);
    if (!item) {
      continue;
    }

    const position = asObject(item.position);
    const lat = asFiniteNumber(position?.lat ?? item.lat);
    const lon = asFiniteNumber(position?.lon ?? item.lon);
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      continue;
    }

    const groundspeedRaw = asFiniteNumber(item.groundspeedKts ?? item.groundspeed ?? item.gs);
    const trackRaw = asFiniteNumber(item.trackDeg ?? item.track);
    const altitudeRaw = asFiniteNumber(item.altitudeAmslFt ?? item.altitudeFt ?? item.alt_baro);
    const seenPosRaw = asFiniteNumber(item.seenPosSeconds ?? item.seenPos ?? item.seen_pos);
    const wakeCategory = normalizeWakeCategory(
      item.wakeCategory ?? item.wake_category ?? item.wtc ?? item.wake ?? item.category
    );
    const squawk = normalizeSquawk(item.squawk ?? item.beaconCode ?? item.beacon_code);
    const destinationIcao = normalizeIcao(item.destinationIcao ?? item.destination_icao ?? item.destination);
    const destinationIata = normalizeIata(item.destinationIata ?? item.destination_iata);
    const rawHistory = Array.isArray(item.history) ? item.history : [];
    const history: Array<{ lat: number; lon: number }> = [];
    const historyStart = Math.max(0, rawHistory.length - 9);
    for (let historyIndex = historyStart; historyIndex < rawHistory.length; historyIndex += 1) {
      const historyPoint = asObject(rawHistory[historyIndex]);
      if (!historyPoint) {
        continue;
      }
      const historyLat = asFiniteNumber(historyPoint.lat);
      const historyLon = asFiniteNumber(historyPoint.lon);
      if (
        historyLat === null ||
        historyLon === null ||
        Math.abs(historyLat) > 90 ||
        Math.abs(historyLon) > 180
      ) {
        continue;
      }
      history.push({
        lat: historyLat,
        lon: historyLon
      });
    }

    aircraft.push({
      callsign: normalizeCallsign(item.callsign),
      aircraftType: normalizeAircraftType(
        item.aircraftType ?? item.aircraftTypeIcao ?? item.type ?? item.aircraft_type ?? item.t
      ),
      groundspeedKts: groundspeedRaw !== null && groundspeedRaw >= 0 ? roundTo(groundspeedRaw, 1) : null,
      position: {
        lat,
        lon
      },
      trackDeg:
        trackRaw !== null
          ? roundTo((((trackRaw % 360) + 360) % 360), 1)
          : null,
      altitudeAmslFt: altitudeRaw !== null && altitudeRaw >= 0 ? roundTo(altitudeRaw, 0) : null,
      wakeCategory,
      squawk,
      seenPosSeconds: seenPosRaw !== null && seenPosRaw >= 0 ? roundTo(seenPosRaw, 1) : null,
      destinationIcao,
      destinationIata,
      history
    });
  }

  const updatedAtRaw = asFiniteNumber(root.updatedAtMs);
  const updatedAtMs = updatedAtRaw !== null && updatedAtRaw > 0 ? Math.floor(updatedAtRaw) : Date.now();

  return {
    updatedAtMs,
    source: asString(root.source) ?? "unknown",
    upstreamUrl: asString(root.upstreamUrl) ?? undefined,
    aircraft
  };
}

function normalizeTfrsIngestPayload(input: unknown): TfrsIngestPayload | null {
  const root = asObject(input);
  if (!root) {
    return null;
  }

  const tfrsRaw = Array.isArray(root.tfrs) ? root.tfrs : null;
  if (!tfrsRaw) {
    return null;
  }

  const tfrs: TfrsIngestPayload["tfrs"] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < tfrsRaw.length; i += 1) {
    const tfr = asObject(tfrsRaw[i]);
    if (!tfr) {
      continue;
    }

    const id = asString(tfr.id);
    if (!id || seenIds.has(id)) {
      continue;
    }

    const areasRaw = Array.isArray(tfr.areas) ? tfr.areas : [];
    const areas: TfrsIngestPayload["tfrs"][number]["areas"] = [];
    for (let areaIndex = 0; areaIndex < areasRaw.length; areaIndex += 1) {
      const area = asObject(areasRaw[areaIndex]);
      if (!area) {
        continue;
      }
      const pointsRaw = Array.isArray(area.points) ? area.points : [];
      const points: Array<{ lat: number; lon: number }> = [];
      for (let pointIndex = 0; pointIndex < pointsRaw.length; pointIndex += 1) {
        const point = asObject(pointsRaw[pointIndex]);
        if (!point) {
          continue;
        }
        const lat = asFiniteNumber(point.lat);
        const lon = asFiniteNumber(point.lon);
        if (
          lat === null ||
          lon === null ||
          Math.abs(lat) > 90 ||
          Math.abs(lon) > 180
        ) {
          continue;
        }
        points.push({ lat, lon });
      }
      if (points.length < 3) {
        continue;
      }
      areas.push({
        areaId: asString(area.areaId) ?? null,
        points
      });
    }

    if (areas.length === 0) {
      continue;
    }

    const upperRaw = asFiniteNumber(tfr.upperFt);
    const lowerRaw = asFiniteNumber(tfr.lowerFt);
    tfrs.push({
      id,
      localName: asString(tfr.localName) ?? null,
      facility: asString(tfr.facility)?.toUpperCase() ?? null,
      codeType: asString(tfr.codeType) ?? null,
      effective: asString(tfr.effective) ?? null,
      expire: asString(tfr.expire) ?? null,
      lowerFt: lowerRaw !== null ? Math.round(lowerRaw) : null,
      upperFt: upperRaw !== null ? Math.round(upperRaw) : null,
      sourceXmlUrl: asString(tfr.sourceXmlUrl) ?? "",
      areas
    });
    seenIds.add(id);
  }

  const idsRaw = Array.isArray(root.ids) ? root.ids : [];
  const ids: string[] = [];
  const seenPayloadIds = new Set<string>();
  for (let i = 0; i < idsRaw.length; i += 1) {
    const id = asString(idsRaw[i]);
    if (!id || seenPayloadIds.has(id)) {
      continue;
    }
    ids.push(id);
    seenPayloadIds.add(id);
  }

  const updatedAtRaw = asFiniteNumber(root.updatedAtMs);
  const updatedAtMs = updatedAtRaw !== null && updatedAtRaw > 0 ? Math.floor(updatedAtRaw) : Date.now();

  return {
    updatedAtMs,
    source: asString(root.source) ?? "unknown",
    artcc: asString(root.artcc)?.toUpperCase() ?? "",
    tracon: asString(root.tracon)?.toUpperCase() ?? "",
    mainIcao: normalizeIcao(root.mainIcao) ?? MAIN_ICAO,
    ids: ids.length > 0 ? ids : tfrs.map((tfr) => tfr.id),
    tfrs
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
    positionId: POS,
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
    positionId: normalizeControllerPosition(root.positionId) ?? POS,
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
      aircraftUpdatedAtMs: latestAircraftPosUpdatedAtMs || null,
      taisUpdatedAtMs: latestAircraftTaisUpdatedAtMs || null,
      tfrsUpdatedAtMs: latestTfrsUpdatedAtMs || null,
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
        positionId: POS,
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

  if (pathname === "/api/aircraft/all") {
    if (method !== "GET") {
      writeJson(res, 405, { error: "Method not allowed." });
      return;
    }

    try {
      const payload = await buildAircraftAllPayload();
      writeJson(res, 200, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to build aircraft feed.";
      writeJson(res, 500, { error: message });
    }
    return;
  }

  if (pathname === "/api/aircraft/pos") {
    if (method === "POST") {
      if (AIRCRAFT_INGEST_TOKEN.length > 0) {
        const token = getHeader(req, "x-aircraft-token").trim();
        if (token !== AIRCRAFT_INGEST_TOKEN) {
          writeJson(res, 401, { error: "Invalid aircraft ingest token." });
          return;
        }
      }

      try {
        const payload = await readJsonBody(req, AIRCRAFT_MAX_JSON_BYTES);
        const normalized = normalizeAircraftPositionIngestPayload(payload);
        if (!normalized) {
          writeJson(res, 400, { error: "Invalid aircraft payload." });
          return;
        }

        latestAircraftPosPayload = normalized;
        latestAircraftPosUpdatedAtMs = normalized.updatedAtMs;
        writeJson(res, 202, {
          ok: true,
          storedAtMs: normalized.updatedAtMs,
          aircraft: normalized.aircraft.length
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid JSON payload.";
        writeJson(res, 400, { error: message });
      }
      return;
    }

    if (method === "GET") {
      if (latestAircraftPosPayload) {
        writeJson(res, 200, latestAircraftPosPayload);
        return;
      }

      writeJson(res, 200, {
        updatedAtMs: Date.now(),
        source: "none",
        aircraft: []
      } satisfies AircraftPositionIngestPayload);
      return;
    }

    writeJson(res, 405, { error: "Method not allowed." });
    return;
  }

  if (pathname === "/api/aircraft/tais") {
    if (method === "POST") {
      if (TAIS_INGEST_TOKEN.length > 0) {
        const token = getHeader(req, "x-tais-token").trim();
        if (token !== TAIS_INGEST_TOKEN) {
          writeJson(res, 401, { error: "Invalid TAIS ingest token." });
          return;
        }
      }

      try {
        const payload = await readJsonBody(req, TAIS_MAX_JSON_BYTES);
        latestAircraftTaisPayload = payload;
        latestAircraftTaisUpdatedAtMs = inferUpdatedAtMs(payload);
        updateTaisCacheFromPayload(payload);
        writeJson(res, 202, {
          ok: true,
          storedAtMs: latestAircraftTaisUpdatedAtMs
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid JSON payload.";
        writeJson(res, 400, { error: message });
      }
      return;
    }

    if (method === "GET") {
      if (latestAircraftTaisPayload !== null) {
        writeJson(res, 200, latestAircraftTaisPayload);
        return;
      }

      writeJson(res, 200, {
        updatedAtMs: Date.now(),
        source: "none",
        records: []
      });
      return;
    }

    writeJson(res, 405, { error: "Method not allowed." });
    return;
  }

  if (pathname === "/api/tfrs") {
    if (method === "POST") {
      if (TFRS_INGEST_TOKEN.length > 0) {
        const token = getHeader(req, "x-tfrs-token").trim();
        if (token !== TFRS_INGEST_TOKEN) {
          writeJson(res, 401, { error: "Invalid TFR ingest token." });
          return;
        }
      }

      try {
        const payload = await readJsonBody(req, TFRS_MAX_JSON_BYTES);
        const normalized = normalizeTfrsIngestPayload(payload);
        if (!normalized) {
          writeJson(res, 400, { error: "Invalid TFR payload." });
          return;
        }

        latestTfrsPayload = normalized;
        latestTfrsUpdatedAtMs = normalized.updatedAtMs;
        writeJson(res, 202, {
          ok: true,
          storedAtMs: normalized.updatedAtMs,
          tfrs: normalized.tfrs.length
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid JSON payload.";
        writeJson(res, 400, { error: message });
      }
      return;
    }

    if (method === "GET") {
      if (latestTfrsPayload) {
        writeJson(res, 200, latestTfrsPayload);
        return;
      }

      writeJson(res, 200, {
        updatedAtMs: Date.now(),
        source: "none",
        artcc: "",
        tracon: "",
        mainIcao: MAIN_ICAO,
        ids: [],
        tfrs: []
      } satisfies TfrsIngestPayload);
      return;
    }

    writeJson(res, 405, { error: "Method not allowed." });
    return;
  }

  writeJson(res, 404, { error: "Not found." });
});

server.listen(PORT, HOST, () => {
  console.log(`WX radar server listening on http://${HOST}:${PORT}`);
  console.log(`POST target: http://${HOST}:${PORT}/api/wx/radar`);
  console.log(`QNH source ICAO main: ${MAIN_ICAO}`);
  console.log(`QNH worker POST target: ${QNH_POST_URL}`);
  console.log(`Aircraft position ingest endpoint: http://${HOST}:${PORT}/api/aircraft/pos`);
  console.log(`Aircraft TAIS ingest endpoint: http://${HOST}:${PORT}/api/aircraft/tais`);
  console.log(`TFR ingest endpoint: http://${HOST}:${PORT}/api/tfrs`);

  void refreshAndPostQnh();
  setInterval(() => {
    void refreshAndPostQnh();
  }, QNH_REFRESH_MS);

  startAdsbClient();
  startTfrNotamsWorker();
});
