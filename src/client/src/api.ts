import { inflate } from "https://esm.sh/pako@2.1.0";
import type { AircraftFeedResponse, QnhResponse, WxReflectivityResponse } from "@vstars/shared";

export interface FetchAircraftFeedOptions {
  baseUrl?: string;
  signal?: AbortSignal;
}

export async function fetchAircraftFeed(
  options: FetchAircraftFeedOptions = {}
): Promise<AircraftFeedResponse> {
  const url = new URL("/api/aircraft", options.baseUrl ?? window.location.origin);
  const response = await fetch(url, {
    signal: options.signal,
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch aircraft feed: ${response.status}`);
  }

  return (await response.json()) as AircraftFeedResponse;
}

export interface AircraftCpsItem {
  callsign: string;
  cps: string;
  updatedAtMs: number;
  reportedAt: string | null;
  trackNum: number | null;
  lat: number | null;
  lon: number | null;
  altFt: number | null;
}

export interface AircraftCpsResponse {
  updatedAtMs: number;
  observedAircraftCount: number;
  trackedAircraftCount: number;
  totalCacheSize: number;
  aircraft: AircraftCpsItem[];
}

export interface FetchAircraftCpsOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  all?: boolean;
}

export async function fetchAircraftCps(
  options: FetchAircraftCpsOptions = {}
): Promise<AircraftCpsResponse> {
  const url = new URL("/api/aircraft/cps", options.baseUrl ?? window.location.origin);
  if (options.all) {
    url.searchParams.set("all", "1");
  }

  const response = await fetch(url, {
    signal: options.signal,
    headers: {
      accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch aircraft CPS cache: ${response.status}`);
  }
  return (await response.json()) as AircraftCpsResponse;
}

export interface FetchQnhOptions {
  baseUrl?: string;
  signal?: AbortSignal;
}

export async function fetchQnhByIcao(
  icaoCodes: string[],
  options: FetchQnhOptions = {}
): Promise<QnhResponse> {
  const uniqueCodes = [...new Set(icaoCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))];
  if (uniqueCodes.length === 0) {
    return { requestedIcaos: [], results: [] };
  }

  const url = new URL("/api/qnh", options.baseUrl ?? window.location.origin);
  for (const icao of uniqueCodes) {
    url.searchParams.append("icao", icao);
  }

  const response = await fetch(url, {
    signal: options.signal,
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch QNH: ${response.status}`);
  }

  return (await response.json()) as QnhResponse;
}

export interface WxQnhStation {
  icao: string;
  qnhInHg: number | null;
  qnhMmHg: number | null;
}

export interface WxQnhResponse {
  updatedAtMs?: number;
  source?: string;
  mainIcao?: string;
  requestedIcaos: string[];
  stations: WxQnhStation[];
}

export interface FetchWxQnhOptions {
  baseUrl?: string;
  signal?: AbortSignal;
}

export interface FetchWxReflectivityOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  radiusNm?: number;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asPositiveInt(value: unknown): number | null {
  const numeric = asFiniteNumber(value);
  if (numeric === null || numeric <= 0) {
    return null;
  }
  return Math.floor(numeric);
}

function asNonNegativeInt(value: unknown): number | null {
  const numeric = asFiniteNumber(value);
  if (numeric === null || numeric < 0) {
    return null;
  }
  return Math.floor(numeric);
}

function normalizeIcao(value: unknown): string | null {
  const text = asString(value);
  if (!text) {
    return null;
  }
  const upper = text.toUpperCase();
  return /^[A-Z0-9]{4}$/.test(upper) ? upper : null;
}

function normalizeObservedLevels(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const seen = new Set<number>();
  for (let i = 0; i < value.length; i += 1) {
    const level = asNonNegativeInt(value[i]);
    if (level !== null && level >= 1 && level <= 6) {
      seen.add(level);
    }
  }
  return Array.from(seen).sort((a, b) => a - b);
}

function normalizeWxQnhPayload(payload: unknown): WxQnhResponse {
  const root = asObject(payload);
  const requestedIcaosRaw = Array.isArray(root?.requestedIcaos) ? root.requestedIcaos : [];
  const requestedIcaos = [...new Set(requestedIcaosRaw.map((value) => normalizeIcao(value)).filter(Boolean))] as string[];
  const stationsRaw = Array.isArray(root?.stations) ? root.stations : [];
  const stations: WxQnhStation[] = [];
  const seenStations = new Set<string>();

  for (let i = 0; i < stationsRaw.length; i += 1) {
    const station = asObject(stationsRaw[i]);
    if (!station) {
      continue;
    }
    const icao = normalizeIcao(station.icao);
    if (!icao || seenStations.has(icao)) {
      continue;
    }
    const qnhInHgRaw = asFiniteNumber(station.qnhInHg);
    const qnhMmHgRaw = asFiniteNumber(station.qnhMmHg);
    stations.push({
      icao,
      qnhInHg: qnhInHgRaw !== null ? qnhInHgRaw : null,
      qnhMmHg: qnhMmHgRaw !== null ? qnhMmHgRaw : null
    });
    seenStations.add(icao);
  }

  return {
    updatedAtMs: asNonNegativeInt(root?.updatedAtMs) ?? undefined,
    source: asString(root?.source) ?? undefined,
    mainIcao: normalizeIcao(root?.mainIcao) ?? undefined,
    requestedIcaos,
    stations
  };
}

function normalizeCoordinateDegrees(value: unknown, axis: "lat" | "lon"): number | null {
  const numeric = asFiniteNumber(value);
  if (numeric === null) {
    return null;
  }

  const limit = axis === "lat" ? 90 : 180;
  if (Math.abs(numeric) <= limit) {
    return numeric;
  }

  // Accept scaled lat/lon from upstream feeds (micro/milli/centi-degrees).
  const scales = [1_000_000, 1_000, 10_000, 100_000];
  for (const scale of scales) {
    const candidate = numeric / scale;
    if (Math.abs(candidate) <= limit) {
      return candidate;
    }
  }

  return null;
}

function clampWxLevel(value: unknown): number {
  const numeric = asFiniteNumber(value);
  if (numeric === null) {
    return 0;
  }
  const rounded = Math.round(numeric);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 6) {
    return 6;
  }
  return rounded;
}

function normalizeWxRegion(value: unknown): WxReflectivityResponse["region"] {
  const region = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (region === "CONUS" || region === "ALASKA" || region === "CARIB" || region === "GUAM" || region === "HAWAII") {
    return region;
  }
  return "CONUS";
}

function deduceGridSize(levelCount: number): { width: number; height: number } {
  if (levelCount <= 0) {
    return { width: 1, height: 1 };
  }
  const side = Math.sqrt(levelCount);
  if (Number.isInteger(side)) {
    return { width: side, height: side };
  }
  return { width: levelCount, height: 1 };
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i) & 0xff;
  }
  return out;
}

export function decodeWxZlibFrameLevels(base64: string, rows: number, cols: number): number[] {
  const compressed = decodeBase64ToBytes(base64);
  const raw = inflate(compressed);
  const expected = rows * cols;
  if (raw.length !== expected) {
    throw new Error(`bad length ${raw.length}, expected ${expected}`);
  }
  const levels = new Array<number>(expected);
  for (let i = 0; i < expected; i += 1) {
    levels[i] = clampWxLevel(raw[i]);
  }
  return levels;
}

function parseIsoTimeMs(value: unknown): number | null {
  const text = asString(value);
  if (!text) {
    return null;
  }
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.floor(parsed);
}

function parseRleTotalCellCount(rle: string): number {
  let i = 0;
  const len = rle.length;
  let total = 0;

  while (i < len) {
    while (i < len && rle.charCodeAt(i) <= 32) {
      i += 1;
    }
    if (i >= len) {
      break;
    }

    let sawLevelDigit = false;
    while (i < len) {
      const code = rle.charCodeAt(i);
      if (code === 44) {
        i += 1;
        break;
      }
      if (code < 48 || code > 57) {
        throw new Error(`invalid RLE level token at index ${i}`);
      }
      sawLevelDigit = true;
      i += 1;
    }
    if (!sawLevelDigit) {
      throw new Error("invalid RLE level token");
    }

    let count = 0;
    let sawCountDigit = false;
    while (i < len) {
      const code = rle.charCodeAt(i);
      if (code <= 32) {
        break;
      }
      if (code < 48 || code > 57) {
        throw new Error(`invalid RLE count token at index ${i}`);
      }
      sawCountDigit = true;
      count = count * 10 + (code - 48);
      i += 1;
    }
    if (!sawCountDigit) {
      throw new Error("invalid RLE count token");
    }
    total += count;
  }

  return total;
}

export function decodeWxRleFrameLevels(rle: string, rows: number, cols: number): number[] {
  const expected = rows * cols;
  const out = new Array<number>(expected).fill(0);
  let pos = 0;
  let i = 0;
  const len = rle.length;

  while (i < len) {
    while (i < len && rle.charCodeAt(i) <= 32) {
      i += 1;
    }
    if (i >= len) {
      break;
    }

    let level = 0;
    let sawLevelDigit = false;
    while (i < len) {
      const code = rle.charCodeAt(i);
      if (code === 44) {
        i += 1;
        break;
      }
      if (code < 48 || code > 57) {
        throw new Error(`invalid RLE level token at index ${i}`);
      }
      sawLevelDigit = true;
      level = level * 10 + (code - 48);
      i += 1;
    }
    if (!sawLevelDigit) {
      throw new Error("invalid RLE level token");
    }

    let count = 0;
    let sawCountDigit = false;
    while (i < len) {
      const code = rle.charCodeAt(i);
      if (code <= 32) {
        break;
      }
      if (code < 48 || code > 57) {
        throw new Error(`invalid RLE count token at index ${i}`);
      }
      sawCountDigit = true;
      count = count * 10 + (code - 48);
      i += 1;
    }
    if (!sawCountDigit) {
      throw new Error("invalid RLE count token");
    }

    const end = pos + count;
    if (end > expected) {
      throw new Error(`RLE overruns grid: pos=${pos} count=${count} end=${end} expected=${expected}`);
    }
    if (level !== 0 && count > 0) {
      out.fill(clampWxLevel(level), pos, end);
    }
    pos = end;
  }

  if (pos !== expected) {
    throw new Error(`RLE length mismatch: decoded=${pos} expected=${expected}`);
  }

  return out;
}

export interface DecodedWxFrameLevels {
  rows: number;
  cols: number;
  levels: number[];
}

export function decodeWxFrameLevels(
  frame: NonNullable<WxReflectivityResponse["frames"]>[number],
  fallbackRows: number,
  fallbackCols: number
): DecodedWxFrameLevels {
  const safeFallbackRows = Math.max(1, Math.floor(fallbackRows));
  const safeFallbackCols = Math.max(1, Math.floor(fallbackCols));

  const zlibData = asString(frame.data);
  if (zlibData) {
    return {
      rows: safeFallbackRows,
      cols: safeFallbackCols,
      levels: decodeWxZlibFrameLevels(zlibData, safeFallbackRows, safeFallbackCols)
    };
  }

  const cellsRle = asString(frame.grid?.cellsRle);
  if (!cellsRle) {
    throw new Error("frame is missing both zlib data and RLE cells");
  }

  const declaredRows = asPositiveInt(frame.grid?.rows);
  const declaredCols = asPositiveInt(frame.grid?.cols);
  const gridMaxRows = asPositiveInt(frame.grid?.rawDims?.gridMaxY);
  const gridMaxCols = asPositiveInt(frame.grid?.rawDims?.gridMaxX);
  const decodedCellsTotal = parseRleTotalCellCount(cellsRle);

  let rows = declaredRows ?? safeFallbackRows;
  let cols = declaredCols ?? safeFallbackCols;
  if (rows * cols !== decodedCellsTotal) {
    if (
      gridMaxRows !== null &&
      gridMaxCols !== null &&
      gridMaxRows * gridMaxCols === decodedCellsTotal
    ) {
      rows = gridMaxRows;
      cols = gridMaxCols;
    } else {
      throw new Error(
        `RLE dimensions mismatch: decoded=${decodedCellsTotal} rows=${rows} cols=${cols}`
      );
    }
  }

  return {
    rows,
    cols,
    levels: decodeWxRleFrameLevels(cellsRle, rows, cols)
  };
}

function normalizeWxPayload(
  payload: unknown,
  requestedCenter: { lat: number; lon: number },
  requestedRadiusNm: number | undefined
): WxReflectivityResponse {
  const root = asObject(payload);
  const rootCenter = asObject(root?.center);
  const trp = asObject(root?.trp);
  const gridGeom = asObject(root?.gridGeom);
  const historyFramesRaw = Array.isArray(root?.frames) ? root?.frames : null;

  // STARS-style ITWS history payload:
  // { updatedAtMs, levels:[...], frames:[{ receiverMs, grid:{..., cellsEncoding:"rle", cellsRle:"..." }}, ...] }
  const firstHistoryFrame = historyFramesRaw && historyFramesRaw.length > 0 ? asObject(historyFramesRaw[0]) : null;
  const firstHistoryFrameGrid = asObject(firstHistoryFrame?.grid);
  if (historyFramesRaw && historyFramesRaw.length > 0 && firstHistoryFrameGrid) {
    const observedLevels = normalizeObservedLevels(root?.levels);

    const frames = historyFramesRaw
      .map((rawFrame) => {
        const frame = asObject(rawFrame);
        if (!frame) {
          return null;
        }
        const frameGrid = asObject(frame.grid);
        const frameRawDims = asObject(frameGrid?.rawDims);
        const frameTrp = asObject(frameGrid?.trp);
        const frameGeom = asObject(frameGrid?.geom);
        const data = asString(frame.data) ?? undefined;
        const cellsRle = asString(frameGrid?.cellsRle) ?? undefined;
        if (!data && !cellsRle) {
          return null;
        }

        const epochMs =
          asNonNegativeInt(frame.receiverMs) ??
          asNonNegativeInt(frame.tEpochMs) ??
          asNonNegativeInt(frame.itwsGenTimeMs) ??
          parseIsoTimeMs(frame.receivedAt) ??
          parseIsoTimeMs(frame.t) ??
          undefined;
        const frameLayoutText = asString(frameGrid?.layout);
        const frameLayout =
          frameLayoutText === "row-major" || frameLayoutText === "column-major"
            ? (frameLayoutText as WxReflectivityResponse["layout"])
            : undefined;

        return {
          t: asString(frame.t) ?? asString(frame.receivedAt) ?? undefined,
          tEpochMs: epochMs,
          maxLevel:
            asNonNegativeInt(frame.maxLevel) ??
            asNonNegativeInt(frameGrid?.maxLevel) ??
            asNonNegativeInt(frameGrid?.itwsMaxPrecipLevel) ??
            undefined,
          rawBytes: asNonNegativeInt(frame.rawBytes) ?? undefined,
          zlibBytes: asNonNegativeInt(frame.zlibBytes) ?? undefined,
          data,
          receiverMs: asNonNegativeInt(frame.receiverMs) ?? undefined,
          receivedAt: asString(frame.receivedAt) ?? undefined,
          itwsGenTimeMs: asNonNegativeInt(frame.itwsGenTimeMs) ?? undefined,
          itwsExpTimeMs: asNonNegativeInt(frame.itwsExpTimeMs) ?? undefined,
          productId: asNonNegativeInt(frame.productId) ?? undefined,
          productName: asString(frame.productName) ?? undefined,
          site: asString(frame.site) ?? undefined,
          airport: asString(frame.airport) ?? undefined,
          grid: frameGrid
            ? {
                rows: asPositiveInt(frameGrid.rows) ?? undefined,
                cols: asPositiveInt(frameGrid.cols) ?? undefined,
                dimsSource: asString(frameGrid.dimsSource) ?? undefined,
                rawDims: frameRawDims
                  ? {
                      nrows: asPositiveInt(frameRawDims.nrows) ?? undefined,
                      ncols: asPositiveInt(frameRawDims.ncols) ?? undefined,
                      gridMaxY: asPositiveInt(frameRawDims.gridMaxY) ?? undefined,
                      gridMaxX: asPositiveInt(frameRawDims.gridMaxX) ?? undefined
                    }
                  : undefined,
                layout: frameLayout,
                trp:
                  normalizeCoordinateDegrees(frameTrp?.latDeg, "lat") !== null &&
                  normalizeCoordinateDegrees(frameTrp?.lonDeg, "lon") !== null
                    ? {
                        latDeg: normalizeCoordinateDegrees(frameTrp?.latDeg, "lat") as number,
                        lonDeg: normalizeCoordinateDegrees(frameTrp?.lonDeg, "lon") as number
                      }
                    : undefined,
                geom:
                  asFiniteNumber(frameGeom?.xOffsetM) !== null &&
                  asFiniteNumber(frameGeom?.yOffsetM) !== null &&
                  asFiniteNumber(frameGeom?.dxM) !== null &&
                  asFiniteNumber(frameGeom?.dyM) !== null &&
                  asFiniteNumber(frameGeom?.rotationDeg) !== null
                    ? {
                        xOffsetM: asFiniteNumber(frameGeom?.xOffsetM) as number,
                        yOffsetM: asFiniteNumber(frameGeom?.yOffsetM) as number,
                        dxM: asFiniteNumber(frameGeom?.dxM) as number,
                        dyM: asFiniteNumber(frameGeom?.dyM) as number,
                        rotationDeg: asFiniteNumber(frameGeom?.rotationDeg) as number
                      }
                    : undefined,
                cellsEncoding: asString(frameGrid.cellsEncoding) ?? undefined,
                cellsRle,
                cellsTotal: asPositiveInt(frameGrid.cellsTotal) ?? undefined,
                nonZeroCells: asNonNegativeInt(frameGrid.nonZeroCells) ?? undefined,
                itwsMaxPrecipLevel: asNonNegativeInt(frameGrid.itwsMaxPrecipLevel) ?? undefined
              }
            : undefined
        };
      })
      .filter((frame) => frame !== null) as Array<NonNullable<WxReflectivityResponse["frames"]>[number]>;

    if (frames.length > 0) {
      const fallbackRows =
        asPositiveInt(root?.rows) ??
        asPositiveInt(firstHistoryFrameGrid.rows) ??
        asPositiveInt(asObject(firstHistoryFrameGrid.rawDims)?.gridMaxY) ??
        1;
      const fallbackCols =
        asPositiveInt(root?.cols) ??
        asPositiveInt(firstHistoryFrameGrid.cols) ??
        asPositiveInt(asObject(firstHistoryFrameGrid.rawDims)?.gridMaxX) ??
        1;

      const sortedIndices = frames
        .map((frame, index) => ({
          index,
          epochMs: frame.tEpochMs ?? frame.receiverMs ?? frame.itwsGenTimeMs ?? 0
        }))
        .sort((a, b) => (a.epochMs === b.epochMs ? b.index - a.index : b.epochMs - a.epochMs));

      let latestFrame: NonNullable<WxReflectivityResponse["frames"]>[number] | null = null;
      let latestDecoded: DecodedWxFrameLevels | null = null;
      for (let i = 0; i < sortedIndices.length; i += 1) {
        const candidate = frames[sortedIndices[i].index];
        try {
          latestDecoded = decodeWxFrameLevels(candidate, fallbackRows, fallbackCols);
          latestFrame = candidate;
          break;
        } catch (error) {
          console.warn("Skipping invalid STARS WX frame:", error);
        }
      }

      if (!latestFrame || !latestDecoded) {
        const rows = Math.max(1, fallbackRows);
        const cols = Math.max(1, fallbackCols);
        latestFrame = frames[0];
        latestDecoded = {
          rows,
          cols,
          levels: new Array<number>(rows * cols).fill(0)
        };
      }

      const latestGrid = latestFrame.grid;
      const latestTrp = latestGrid?.trp;
      const latestGeom = latestGrid?.geom;
      const trpLatDeg =
        normalizeCoordinateDegrees(latestTrp?.latDeg, "lat") ??
        normalizeCoordinateDegrees(trp?.latDeg, "lat") ??
        normalizeCoordinateDegrees(rootCenter?.lat, "lat") ??
        requestedCenter.lat;
      const trpLonDeg =
        normalizeCoordinateDegrees(latestTrp?.lonDeg, "lon") ??
        normalizeCoordinateDegrees(trp?.lonDeg, "lon") ??
        normalizeCoordinateDegrees(rootCenter?.lon, "lon") ??
        requestedCenter.lon;
      const centerLat = normalizeCoordinateDegrees(rootCenter?.lat, "lat") ?? trpLatDeg;
      const centerLon = normalizeCoordinateDegrees(rootCenter?.lon, "lon") ?? trpLonDeg;
      const xOffsetM = asFiniteNumber(latestGeom?.xOffsetM) ?? asFiniteNumber(gridGeom?.xOffsetM) ?? 0;
      const yOffsetM = asFiniteNumber(latestGeom?.yOffsetM) ?? asFiniteNumber(gridGeom?.yOffsetM) ?? 0;
      const dxM = asFiniteNumber(latestGeom?.dxM) ?? asFiniteNumber(gridGeom?.dxM) ?? 1852 * 0.5;
      const dyM = asFiniteNumber(latestGeom?.dyM) ?? asFiniteNumber(gridGeom?.dyM) ?? 1852 * 0.5;
      const rotationDeg = asFiniteNumber(latestGeom?.rotationDeg) ?? asFiniteNumber(gridGeom?.rotationDeg) ?? 0;
      const cellSizeNmFromMeters = Math.max(dxM, dyM) / 1852;
      const derivedRadiusNm = Math.max(latestDecoded.cols * dxM, latestDecoded.rows * dyM) / (2 * 1852);
      const radiusNm =
        asFiniteNumber(root?.radiusNm) ??
        (Number.isFinite(derivedRadiusNm) && derivedRadiusNm > 0
          ? derivedRadiusNm
          : (requestedRadiusNm ?? 80));

      let filledCells = asNonNegativeInt(latestGrid?.nonZeroCells) ?? 0;
      if (filledCells === 0) {
        for (let i = 0; i < latestDecoded.levels.length; i += 1) {
          if (latestDecoded.levels[i] > 0) {
            filledCells += 1;
          }
        }
      }

      let maxLevelAll = asNonNegativeInt(root?.maxLevelAll) ?? 0;
      if (maxLevelAll === 0) {
        for (let i = 0; i < frames.length; i += 1) {
          maxLevelAll = Math.max(maxLevelAll, frames[i].maxLevel ?? 0);
        }
      }
      if (maxLevelAll === 0 && observedLevels && observedLevels.length > 0) {
        maxLevelAll = observedLevels[observedLevels.length - 1];
      }

      const layout = latestGrid?.layout ?? "row-major";
      const updatedAtMs =
        asNonNegativeInt(root?.updatedAtMs) ??
        latestFrame.receiverMs ??
        latestFrame.tEpochMs ??
        latestFrame.itwsGenTimeMs ??
        Date.now();

      return {
        updatedAtMs,
        region: normalizeWxRegion(root?.region),
        center: {
          lat: centerLat,
          lon: centerLon
        },
        radiusNm,
        cellSizeNm: cellSizeNmFromMeters > 0 ? cellSizeNmFromMeters : 0.5,
        width: latestDecoded.cols,
        height: latestDecoded.rows,
        levels: latestDecoded.levels,
        receivedAt:
          latestFrame.receivedAt ??
          latestFrame.t ??
          asString(root?.receivedAt) ??
          undefined,
        productId: latestFrame.productId ?? asNonNegativeInt(root?.productId) ?? undefined,
        productName: latestFrame.productName ?? asString(root?.productName) ?? undefined,
        site: latestFrame.site ?? asString(root?.site) ?? undefined,
        airport: latestFrame.airport ?? asString(root?.airport) ?? undefined,
        rows: latestDecoded.rows,
        cols: latestDecoded.cols,
        compression:
          latestGrid?.cellsEncoding ??
          asString(root?.compression) ??
          asString(root?.dataEncoding) ??
          "rle",
        maxPrecipLevel:
          asNonNegativeInt(root?.maxPrecipLevel) ??
          latestFrame.maxLevel ??
          (maxLevelAll || undefined),
        filledCells,
        layout,
        cells: latestDecoded.levels.slice(0, latestDecoded.rows * latestDecoded.cols),
        trp: {
          latDeg: trpLatDeg,
          lonDeg: trpLonDeg
        },
        gridGeom: {
          xOffsetM,
          yOffsetM,
          dxM,
          dyM,
          rotationDeg
        },
        schema: asString(root?.schema) ?? undefined,
        levelsEncoding: asString(root?.levelsEncoding) ?? undefined,
        dataEncoding: asString(root?.dataEncoding) ?? undefined,
        maxLevelAll: maxLevelAll || undefined,
        observedLevels,
        grid: {
          rows: latestDecoded.rows,
          cols: latestDecoded.cols,
          dxM,
          dyM,
          rotationDeg,
          trp: {
            latDeg: trpLatDeg,
            lonDeg: trpLonDeg
          },
          origin: {
            xOffsetM,
            yOffsetM,
            mode: latestGrid?.dimsSource
          }
        },
        frames
      };
    }
  }

  // ITWS Forecast history payload:
  // { schema, grid:{...}, frames:[{data: "zlib+base64"}] }
  const historyGrid = asObject(root?.grid);
  if (historyGrid && historyFramesRaw && historyFramesRaw.length > 0) {
    const observedLevels = normalizeObservedLevels(root?.levels);
    const historyTrp = asObject(historyGrid.trp);
    const historyOrigin = asObject(historyGrid.origin);
    const rows =
      asPositiveInt(historyGrid.rows) ??
      asPositiveInt(root?.rows) ??
      asPositiveInt(root?.height) ??
      1;
    const cols =
      asPositiveInt(historyGrid.cols) ??
      asPositiveInt(root?.cols) ??
      asPositiveInt(root?.width) ??
      1;
    const dxM =
      asFiniteNumber(historyGrid.dxM) ??
      asFiniteNumber(gridGeom?.dxM) ??
      asFiniteNumber(root?.dxM) ??
      1852 * 0.5;
    const dyM =
      asFiniteNumber(historyGrid.dyM) ??
      asFiniteNumber(gridGeom?.dyM) ??
      asFiniteNumber(root?.dyM) ??
      1852 * 0.5;
    const rotationDeg =
      asFiniteNumber(historyGrid.rotationDeg) ??
      asFiniteNumber(gridGeom?.rotationDeg) ??
      asFiniteNumber(root?.rotationDeg) ??
      0;
    const trpLatDeg =
      normalizeCoordinateDegrees(historyTrp?.latDeg, "lat") ??
      normalizeCoordinateDegrees(trp?.latDeg, "lat") ??
      normalizeCoordinateDegrees(rootCenter?.lat, "lat") ??
      requestedCenter.lat;
    const trpLonDeg =
      normalizeCoordinateDegrees(historyTrp?.lonDeg, "lon") ??
      normalizeCoordinateDegrees(trp?.lonDeg, "lon") ??
      normalizeCoordinateDegrees(rootCenter?.lon, "lon") ??
      requestedCenter.lon;
    const centerLat = normalizeCoordinateDegrees(rootCenter?.lat, "lat") ?? trpLatDeg;
    const centerLon = normalizeCoordinateDegrees(rootCenter?.lon, "lon") ?? trpLonDeg;
    const xOffsetM =
      asFiniteNumber(historyOrigin?.xOffsetM) ??
      asFiniteNumber(gridGeom?.xOffsetM) ??
      asFiniteNumber(root?.xOffsetM) ??
      0;
    const yOffsetM =
      asFiniteNumber(historyOrigin?.yOffsetM) ??
      asFiniteNumber(gridGeom?.yOffsetM) ??
      asFiniteNumber(root?.yOffsetM) ??
      0;

    const frames = historyFramesRaw
      .map((rawFrame) => {
        const frame = asObject(rawFrame);
        if (!frame) {
          return null;
        }
        const data = asString(frame.data);
        if (!data) {
          return null;
        }
        const tEpochMs = asNonNegativeInt(frame.tEpochMs) ?? 0;
        return {
          t: asString(frame.t) ?? undefined,
          tEpochMs: tEpochMs > 0 ? tEpochMs : undefined,
          maxLevel: asNonNegativeInt(frame.maxLevel) ?? undefined,
          rawBytes: asNonNegativeInt(frame.rawBytes) ?? undefined,
          zlibBytes: asNonNegativeInt(frame.zlibBytes) ?? undefined,
          data
        };
      })
      .filter((frame): frame is NonNullable<typeof frame> => frame !== null);

    let latestFrameIndex = -1;
    let latestFrameEpochMs = -1;
    for (let i = 0; i < frames.length; i += 1) {
      const epochMs = frames[i].tEpochMs ?? 0;
      if (epochMs >= latestFrameEpochMs) {
        latestFrameEpochMs = epochMs;
        latestFrameIndex = i;
      }
    }
    if (latestFrameIndex < 0 && frames.length > 0) {
      latestFrameIndex = frames.length - 1;
    }
    const latestFrame = latestFrameIndex >= 0 ? frames[latestFrameIndex] : null;

    const expected = rows * cols;
    let levels: number[] = new Array<number>(expected).fill(0);
    if (latestFrame?.data) {
      try {
        levels = decodeWxZlibFrameLevels(latestFrame.data, rows, cols);
      } catch (error) {
        console.warn("Failed to decode ITWS zlib frame, falling back to empty levels.", error);
      }
    }

    const cellSizeNmFromMeters = Math.max(dxM, dyM) / 1852;
    const derivedRadiusNm = Math.max(cols * dxM, rows * dyM) / (2 * 1852);
    const radiusNm =
      asFiniteNumber(root?.radiusNm) ??
      (Number.isFinite(derivedRadiusNm) && derivedRadiusNm > 0
        ? derivedRadiusNm
        : (requestedRadiusNm ?? 80));

    let maxLevelAll = asNonNegativeInt(root?.maxLevelAll) ?? 0;
    if (maxLevelAll === 0) {
      for (let i = 0; i < frames.length; i += 1) {
        maxLevelAll = Math.max(maxLevelAll, frames[i].maxLevel ?? 0);
      }
    }

    const updatedAtMs =
      asNonNegativeInt(root?.updatedAtMs) ??
      (latestFrame?.tEpochMs ?? Date.now());

    return {
      updatedAtMs,
      region: normalizeWxRegion(root?.region),
      center: {
        lat: centerLat,
        lon: centerLon
      },
      radiusNm,
      cellSizeNm: cellSizeNmFromMeters > 0 ? cellSizeNmFromMeters : 0.5,
      width: cols,
      height: rows,
      levels,
      receivedAt:
        asString(root?.receivedAt) ??
        latestFrame?.t ??
        undefined,
      productId: asNonNegativeInt(root?.productId) ?? undefined,
      productName: asString(root?.productName) ?? undefined,
      site: asString(root?.site) ?? undefined,
      airport: asString(root?.airport) ?? undefined,
      rows,
      cols,
      compression:
        asString(root?.compression) ??
        asString(root?.dataEncoding) ??
        "zlib+base64",
      maxPrecipLevel: asNonNegativeInt(root?.maxPrecipLevel) ?? (maxLevelAll || undefined),
      filledCells: asNonNegativeInt(root?.filledCells) ?? (rows * cols),
      layout: (asString(root?.layout) ?? "row-major") as WxReflectivityResponse["layout"],
      cells: levels.slice(0, rows * cols),
      cellsTruncated: root?.cellsTruncated === true ? true : undefined,
      trp: {
        latDeg: trpLatDeg,
        lonDeg: trpLonDeg
      },
      gridGeom: {
        xOffsetM,
        yOffsetM,
        dxM,
        dyM,
        rotationDeg
      },
      schema: asString(root?.schema) ?? undefined,
      levelsEncoding: asString(root?.levelsEncoding) ?? undefined,
      dataEncoding: asString(root?.dataEncoding) ?? undefined,
      maxLevelAll: maxLevelAll || undefined,
      observedLevels,
      grid: {
        rows,
        cols,
        dxM,
        dyM,
        rotationDeg,
        trp: {
          latDeg: trpLatDeg,
          lonDeg: trpLonDeg
        },
        origin: {
          xOffsetM,
          yOffsetM,
          mode: asString(historyOrigin?.mode) ?? undefined
        }
      },
      frames
    };
  }

  const centerLat =
    normalizeCoordinateDegrees(rootCenter?.lat, "lat") ??
    normalizeCoordinateDegrees(trp?.latDeg, "lat") ??
    normalizeCoordinateDegrees(root?.centerLat, "lat") ??
    normalizeCoordinateDegrees(root?.lat, "lat") ??
    requestedCenter.lat;
  const centerLon =
    normalizeCoordinateDegrees(rootCenter?.lon, "lon") ??
    normalizeCoordinateDegrees(trp?.lonDeg, "lon") ??
    normalizeCoordinateDegrees(root?.centerLon, "lon") ??
    normalizeCoordinateDegrees(root?.lon, "lon") ??
    requestedCenter.lon;
  const radiusNm =
    asFiniteNumber(root?.radiusNm) ??
    asFiniteNumber(root?.radius) ??
    requestedRadiusNm ??
    80;
  const cellSizeNm =
    asFiniteNumber(root?.cellSizeNm) ??
    asFiniteNumber(root?.cellSize) ??
    0.5;

  let width = asPositiveInt(root?.width) ?? asPositiveInt(root?.cols);
  let height = asPositiveInt(root?.height) ?? asPositiveInt(root?.rows);
  const rawLevels = Array.isArray(root?.levels) ? root?.levels : null;

  if ((width === null || height === null) && rawLevels) {
    const deduced = deduceGridSize(rawLevels.length);
    width = deduced.width;
    height = deduced.height;
  }

  let levels: number[] | null = null;
  if (rawLevels) {
    levels = rawLevels.map((value) => clampWxLevel(value));
  } else {
    const rawCells = Array.isArray(root?.cells) ? root?.cells : Array.isArray(root?.data) ? root?.data : null;
    if (rawCells && width !== null && height !== null) {
      const expected = width * height;
      // ITWS payloads use flat row-major numeric cells.
      if (rawCells.length > 0 && (typeof rawCells[0] === "number" || typeof rawCells[0] === "string")) {
        const out = new Array<number>(expected).fill(0);
        const limit = Math.min(expected, rawCells.length);
        for (let index = 0; index < limit; index += 1) {
          out[index] = clampWxLevel(rawCells[index]);
        }
        levels = out;
      } else {
        const out = new Array<number>(expected).fill(0);
        let wroteAny = false;
        for (const rawCell of rawCells) {
          const cell = asObject(rawCell);
          if (!cell) {
            continue;
          }
          const x = asNonNegativeInt(cell.x ?? cell.col ?? cell.column);
          const y = asNonNegativeInt(cell.y ?? cell.row);
          if (x === null || y === null || x >= width || y >= height) {
            continue;
          }
          out[y * width + x] = clampWxLevel(cell.level ?? cell.intensity ?? cell.value);
          wroteAny = true;
        }
        levels = wroteAny ? out : null;
      }
    }
  }

  if (width === null || height === null) {
    const deduced = deduceGridSize(levels?.length ?? 0);
    width = deduced.width;
    height = deduced.height;
  }

  const expected = width * height;
  if (!levels) {
    levels = new Array<number>(expected).fill(0);
  } else if (levels.length < expected) {
    levels = levels.concat(new Array<number>(expected - levels.length).fill(0));
  } else if (levels.length > expected) {
    levels = levels.slice(0, expected);
  }

  const rows = asPositiveInt(root?.rows) ?? height;
  const cols = asPositiveInt(root?.cols) ?? width;
  const rawCells = Array.isArray(root?.cells) ? root.cells : null;
  let cells: number[] = levels.slice(0, rows * cols);
  if (rawCells && rawCells.length > 0 && (typeof rawCells[0] === "number" || typeof rawCells[0] === "string")) {
    const expectedCells = rows * cols;
    const flat = new Array<number>(expectedCells).fill(0);
    const limit = Math.min(expectedCells, rawCells.length);
    for (let i = 0; i < limit; i += 1) {
      flat[i] = clampWxLevel(rawCells[i]);
    }
    cells = flat;
  }

  const trpLatDeg = normalizeCoordinateDegrees(trp?.latDeg, "lat") ?? centerLat;
  const trpLonDeg = normalizeCoordinateDegrees(trp?.lonDeg, "lon") ?? centerLon;
  const dxM = asFiniteNumber(gridGeom?.dxM) ?? cellSizeNm * 1852;
  const dyM = asFiniteNumber(gridGeom?.dyM) ?? cellSizeNm * 1852;

  return {
    updatedAtMs: Math.floor(asFiniteNumber(root?.updatedAtMs) ?? Date.now()),
    region: normalizeWxRegion(root?.region),
    center: {
      lat: centerLat,
      lon: centerLon
    },
    radiusNm,
    cellSizeNm: cellSizeNm > 0 ? cellSizeNm : 0.5,
    width,
    height,
    levels,
    receivedAt: asString(root?.receivedAt) ?? undefined,
    productId: asNonNegativeInt(root?.productId) ?? undefined,
    productName: asString(root?.productName) ?? undefined,
    site: asString(root?.site) ?? undefined,
    airport: asString(root?.airport) ?? undefined,
    rows,
    cols,
    compression: asString(root?.compression) ?? undefined,
    maxPrecipLevel: asNonNegativeInt(root?.maxPrecipLevel) ?? undefined,
    filledCells: asNonNegativeInt(root?.filledCells) ?? undefined,
    layout: (asString(root?.layout) ?? "row-major") as WxReflectivityResponse["layout"],
    cells,
    cellsTruncated: root?.cellsTruncated === true ? true : undefined,
    trp: {
      latDeg: trpLatDeg,
      lonDeg: trpLonDeg
    },
    gridGeom: {
      xOffsetM: asFiniteNumber(gridGeom?.xOffsetM) ?? 0,
      yOffsetM: asFiniteNumber(gridGeom?.yOffsetM) ?? 0,
      dxM: Number.isFinite(dxM) && dxM > 0 ? dxM : cellSizeNm * 1852,
      dyM: Number.isFinite(dyM) && dyM > 0 ? dyM : cellSizeNm * 1852,
      rotationDeg: asFiniteNumber(gridGeom?.rotationDeg) ?? 0
    }
  };
}

export async function fetchWxReflectivity(
  center: { lat: number; lon: number },
  options: FetchWxReflectivityOptions = {}
): Promise<WxReflectivityResponse> {
  const url = new URL("/api/wx/radar", options.baseUrl ?? window.location.origin);
  url.searchParams.set("lat", String(center.lat));
  url.searchParams.set("lon", String(center.lon));
  if (options.radiusNm !== undefined) {
    url.searchParams.set("radiusNm", String(options.radiusNm));
  }

  const response = await fetch(url, {
    signal: options.signal,
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch radar data: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return normalizeWxPayload(payload, center, options.radiusNm);
}

export async function fetchWxQnh(
  options: FetchWxQnhOptions = {}
): Promise<WxQnhResponse> {
  const url = new URL("/api/wx/qnh", options.baseUrl ?? window.location.origin);
  const response = await fetch(url, {
    signal: options.signal,
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch WX QNH data: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return normalizeWxQnhPayload(payload);
}
