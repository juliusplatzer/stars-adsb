export interface PositionSample {
  lat: number;
  lon: number;
  timeMs?: number;
}

export interface AircraftFeedItem {
  id: string;
  position: { lat: number; lon: number };
  trackDeg: number | null;
  altitudeAmslFt: number | null;
  groundspeedKts: number | null;
  wakeCategory: string | null;
  destinationIata: string | null;
  aircraftTypeIcao: string | null;
  squawk: string | null;
  callsign: string | null;
  coast?: boolean;
  previousPositions: PositionSample[];
}

export interface AircraftFeedResponse {
  updatedAtMs?: number;
  aircraft: AircraftFeedItem[];
}

export interface QnhResult {
  icao: string;
  qnhInHg: number | null;
}

export interface QnhResponse {
  requestedIcaos: string[];
  results: QnhResult[];
}

export type WxRegion = "CONUS" | "ALASKA" | "CARIB" | "GUAM" | "HAWAII";
export type WxLayout = "row-major" | "column-major";

export interface WxReflectivityResponse {
  updatedAtMs?: number;
  region: WxRegion;
  center: { lat: number; lon: number };
  radiusNm: number;
  cellSizeNm: number;
  width: number;
  height: number;
  levels: number[];
  receivedAt?: string;
  productId?: number;
  productName?: string;
  site?: string;
  airport?: string;
  rows?: number;
  cols?: number;
  compression?: string;
  maxPrecipLevel?: number;
  filledCells?: number;
  layout?: WxLayout;
  cells?: number[];
  cellsTruncated?: boolean;
  trp?: { latDeg: number; lonDeg: number };
  gridGeom?: { xOffsetM: number; yOffsetM: number; dxM: number; dyM: number; rotationDeg: number };
  schema?: string;
  levelsEncoding?: string;
  dataEncoding?: string;
  maxLevelAll?: number;
  observedLevels?: number[];
  grid?: {
    rows: number;
    cols: number;
    dxM: number;
    dyM: number;
    rotationDeg: number;
    trp: { latDeg: number; lonDeg: number };
    origin: { xOffsetM: number; yOffsetM: number; mode?: string };
  };
  frames?: Array<{
    t?: string;
    tEpochMs?: number;
    maxLevel?: number;
    rawBytes?: number;
    zlibBytes?: number;
    data: string;
  }>;
}
