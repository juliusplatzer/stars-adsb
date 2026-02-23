import { createElement, useEffect, useRef, useState } from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import { StarsUiRenderer } from "./stars/ui.js";
import { StarsListsRenderer } from "./stars/lists.js";
import { DCB_MAPS_CATEGORY_WIDTH_PX, StarsDcbRenderer } from "./stars/dcb.js";
import { StarsWxRenderer } from "./stars/wx.js";
import { RadarBlipRenderer } from "./stars/blip.js";
import { WebGLVideoMapRenderer } from "./stars/webgl-video-map.js";
import {
  StarsDatablockRenderer,
  type DatablockHitRegion,
  type DatablockLeaderDirection
} from "./stars/datablock.js";
import type {
  DcbAuxControlsInput,
  DcbAuxControlHit,
  DcbBriteControlHit,
  DcbBriteInput,
  DcbLeaderControlHit,
  DcbLeaderControlsInput,
  DcbMapCategoryInput,
  DcbMapsControlHit,
  DcbMapsMenuButton,
  DcbMapsMenuInput,
  DcbRangeRingControlHit,
  DcbSiteControlHit,
  DcbSiteMenuButton,
  DcbSiteMenuInput,
  DcbSsaFilterControlHit,
  DcbSsaFilterInput,
  DcbWxLevelsInput
} from "./stars/dcb.js";
import {
  decodeWxFrameLevels,
  fetchAircraftFeed,
  fetchTfrs,
  fetchWxQnh,
  fetchWxReflectivity,
  type TfrsResponse
} from "./api.js";
import type { AircraftFeedItem, WxReflectivityResponse } from "@vstars/shared";
import starsColors from "./stars/colors.js";
import { getRestrictionAreaStipplePattern } from "./stars/tfrs.js";

const SCOPE_MARGIN_X_PX = 0;
const SCOPE_MARGIN_BOTTOM_PX = 18;
const SSA_MARGIN_LEFT_PX = 75;
const SSA_MARGIN_TOP_PX = 9;
const DCB_MAPS_X_PX = 0;
const DCB_MAPS_Y_PX = 6;
const DCB_MAPS_HEIGHT_PX = 60;
const DCB_MAPS_TOTAL_WIDTH_PX = DCB_MAPS_CATEGORY_WIDTH_PX;
const DCB_WX_GAP_PX = 0;
const DCB_WX_X_PX = DCB_MAPS_X_PX + DCB_MAPS_TOTAL_WIDTH_PX + DCB_WX_GAP_PX;
const DCB_WX_Y_PX = DCB_MAPS_Y_PX;
const DCB_WX_BUTTON_COUNT = 6;
const DCB_WX_TOTAL_WIDTH_PX = DCB_WX_BUTTON_COUNT * 30 + (DCB_WX_BUTTON_COUNT - 1) * DCB_WX_GAP_PX;
const DCB_BRITE_GAP_PX = 0;
const DCB_BRITE_BUTTON_WIDTH_PX = 60;
const DCB_BRITE_X_PX = DCB_WX_X_PX + DCB_WX_TOTAL_WIDTH_PX + DCB_BRITE_GAP_PX;
const DCB_BRITE_Y_PX = DCB_MAPS_Y_PX;
const DCB_LDR_GAP_PX = 0;
const DCB_LDR_X_PX = DCB_BRITE_X_PX + DCB_BRITE_BUTTON_WIDTH_PX + DCB_LDR_GAP_PX;
const DCB_LDR_Y_PX = DCB_MAPS_Y_PX;
const DCB_AUX_GAP_PX = 0;
const DCB_AUX_BUTTON_WIDTH_PX = 60;
const DCB_AUX_X_PX = DCB_LDR_X_PX + DCB_AUX_BUTTON_WIDTH_PX + DCB_AUX_GAP_PX;
const DCB_AUX_Y_PX = DCB_MAPS_Y_PX;
const DCB_SCOPE_TOP_MARGIN_PX = 1.5;
const DCB_RESERVED_HEIGHT_PX = DCB_MAPS_Y_PX + DCB_MAPS_HEIGHT_PX + DCB_SCOPE_TOP_MARGIN_PX;
const DCB_BUTTON_WIDTH_PX = 60;
const DCB_BUTTON_HALF_HEIGHT_PX = 30;
const DCB_BUTTON_GAP_PX = 0;
const DCB_MAPS_BUTTON_X_PX = 4 * (DCB_BUTTON_WIDTH_PX + DCB_BUTTON_GAP_PX);
const DCB_MAPS_MENU_TOP_ROW: ReadonlyArray<number | null> = [
  200,
  201,
  203,
  243,
  221,
  211,
  841,
  240,
  849,
  870,
  null,
  null,
  300,
  400,
  null
];
const DCB_MAPS_MENU_BOTTOM_ROW: ReadonlyArray<number | null> = [
  204,
  202,
  205,
  242,
  220,
  null,
  846,
  241,
  851,
  803,
  null,
  501,
  102,
  500,
  null
];
const DCB_SSA_FILTER_MENU_TOP_ROW: ReadonlyArray<{ top: string; bottom: string }> = [
  { top: "ALL", bottom: "" },
  { top: "TIME", bottom: "" },
  { top: "STATUS", bottom: "" },
  { top: "RADAR", bottom: "" },
  { top: "SPC", bottom: "" },
  { top: "RANGE", bottom: "" },
  { top: "ALT FIL", bottom: "" },
  { top: "INTRAIL", bottom: "" },
  { top: "AIRPORT", bottom: "" },
  { top: "TT", bottom: "" },
  { top: "QL", bottom: "" },
  { top: "CON/CPL", bottom: "" },
  { top: "CRDA", bottom: "" },
  { top: "AMZ", bottom: "" }
];
const DCB_SSA_FILTER_MENU_BOTTOM_ROW: ReadonlyArray<{ top: string; bottom: string }> = [
  { top: "WX", bottom: "" },
  { top: "ALTSTG", bottom: "" },
  { top: "PLAN", bottom: "" },
  { top: "CODES", bottom: "" },
  { top: "SYS OFF", bottom: "" },
  { top: "PTL", bottom: "" },
  { top: "NAS I/F", bottom: "" },
  { top: "2.5", bottom: "" },
  { top: "OP MODE", bottom: "" },
  { top: "WX HIST", bottom: "" },
  { top: "TW OFF", bottom: "" },
  { top: "OFF IND", bottom: "" },
  { top: "FLOW", bottom: "" },
  { top: "TBFM", bottom: "" }
];
const DCB_MAP_LABEL_OVERRIDES: Readonly<Record<number, string>> = {
  102: "R5001_1",
  200: "JFK",
  201: "4L_R",
  202: "13L_R",
  203: "22L_R",
  204: "31L_R",
  205: "R22_FNLS",
  211: "LGA_31",
  220: "F_RNAV",
  221: "J_RNAV",
  240: "HELI13R",
  241: "JFKPINS",
  242: "SIM_31",
  243: "RNP22L",
  300: "ISP",
  400: "EWR",
  500: "LIB",
  501: "SWF",
  803: "3NM_MVA",
  841: "HELRNAV",
  846: "TFR",
  849: "CLASS_B",
  851: "COAST",
  870: "EOVM"
};
const TOWER_LIST_AIRPORT_ICAO = "KJFK";
const TOWER_LIST_TRACON = "N90";
const VIDEO_MAP_CENTER_AIRPORT_ICAO = "KJFK";
const TOWER_LIST_TOP_RATIO = 0.62;
const VFR_LIST_GAP_LINES = 1;
const FLIGHT_PLAN_LIST_GAP_LINES = 2;
const CONTROL_POSITION_ID = "2A";
const CONTROL_POSITION_MARGIN_RIGHT_PX = SSA_MARGIN_LEFT_PX;
const SSA_SYMBOL_SIZE_PX = 11;
const SSA_FIRST_TEXT_ROW_OFFSET_PX = SSA_SYMBOL_SIZE_PX + 3;
const RIGHT_LISTS_LEFT_FROM_RIGHT_PX = 195;
const LA_CA_MCI_MARGIN_BOTTOM_PX = 120;
const RIGHT_LISTS_VERTICAL_NUDGE_UP_PX = 12;
const CURRENT_MAPS_LIST_MARGIN_BOTTOM_PX = 80;
const CURRENT_MAPS_LIST_HORIZONTAL_MARGIN_PX = 12;
const CURRENT_MAPS_LIST_BLOCK_WIDTH_PX = 340;
const CURRENT_MAPS_LIST_ID_COLUMN_OFFSET_PX = 0;
const CURRENT_MAPS_LIST_LABEL_COLUMN_OFFSET_PX = 60;
const CURRENT_MAPS_LIST_NAME_COLUMN_OFFSET_PX = 160;
const GEO_RESTRICTIONS_LIST_MARGIN_BOTTOM_PX = 80;
const GEO_RESTRICTIONS_LIST_HORIZONTAL_MARGIN_PX = 12;
const GEO_RESTRICTIONS_LIST_BLOCK_WIDTH_PX = 440;
const FONT_BASE_PATH = "/public/font/sddCharFontSetASize1";
const SSA_AIRPORT_ICAO = "KJFK";
const SSA_QNH_REFRESH_MS = 60_000;
const AIRCRAFT_REFRESH_MS = 5_000;
const COAST_SUSPEND_MAX_CALLSIGNS = 5;
const LA_CA_MCI_MAX_CONFLICTS = 5;
const CA_LATERAL_THRESHOLD_NM = 3;
const CA_VERTICAL_THRESHOLD_FT = 1000;
const API_BASE_URL = "http://localhost:8080";
const TOWER_LIST_AIRPORT_ICAO_NORMALIZED = TOWER_LIST_AIRPORT_ICAO.trim().toUpperCase();
const TOWER_LIST_TRACON_NORMALIZED = TOWER_LIST_TRACON.trim().toUpperCase();
const VIDEO_MAP_CENTER_AIRPORT_ICAO_NORMALIZED = VIDEO_MAP_CENTER_AIRPORT_ICAO.trim().toUpperCase();
const VIDEO_MAP_STROKE_WIDTH_PX = 1.25;
const VIDEO_MAP_RANGE_NM = 50;
const VIDEO_MAP_MIN_RANGE_NM = 5;
const VIDEO_MAP_MAX_RANGE_NM = 250;
const VIDEO_MAP_OFF_CENTER_PAN_THRESHOLD_PX = 0.5;
const VIDEO_MAP_OFF_CENTER_DISTANCE_THRESHOLD_NM = 0.05;
const VIDEO_MAP_WHEEL_ZOOM_STEP = 0.001;
const WHEEL_STEP_THRESHOLD_PX = 90;
const MAX_CANVAS_PIXELS = 12_000_000;
const MAX_CANVAS_DIMENSION = 8192;
const RANGE_RING_SPACING_OPTIONS_NM = [2, 5, 10, 20] as const;
const RANGE_RING_DEFAULT_SPACING_NM = 10;
const RANGE_RING_MAX_DRAW_NM = 200;
const RANGE_RING_STROKE_WIDTH_PX = 0.8;
const RANGE_RING_DEFAULT_BRIGHTNESS_PERCENT = 20;
const RANGE_RING_BRIGHTNESS_STEP_PERCENT = 5;
const DCB_BRIGHTNESS_DEFAULT_PERCENT = 80;
const DCB_BRIGHTNESS_STEP_PERCENT = 5;
const VIDEO_MAP_DEFAULT_BRIGHTNESS_PERCENT = 50;
const VIDEO_MAP_BRIGHTNESS_STEP_PERCENT = 5;
const TFR_DEFAULT_BRIGHTNESS_PERCENT = 40;
const TFR_BRIGHTNESS_STEP_PERCENT = 5;
const COMPASS_DEFAULT_BRIGHTNESS_PERCENT = 80;
const COMPASS_BRIGHTNESS_STEP_PERCENT = 5;
const COMPASS_REFERENCE_INTENSITY = 140;
const DCB_DONE_FLASH_MS = 100;
const COMPASS_MINOR_TICK_LENGTH_PX = 18;
const COMPASS_MAJOR_TICK_LENGTH_PX = 18;
const LIST_DEFAULT_BRIGHTNESS_PERCENT = 80;
const LIST_MIN_BRIGHTNESS_PERCENT = 25;
const LIST_BRIGHTNESS_STEP_PERCENT = 5;
const LIST_REFERENCE_INTENSITY = 255;
const BLIP_DEFAULT_BRIGHTNESS_PERCENT = 70;
const BLIP_BRIGHTNESS_STEP_PERCENT = 5;
const HISTORY_DEFAULT_BRIGHTNESS_PERCENT = 80;
const HISTORY_BRIGHTNESS_STEP_PERCENT = 5;
const WX_COLOR_DEFAULT_BRIGHTNESS_PERCENT = 30;
const WX_COLOR_BRIGHTNESS_STEP_PERCENT = 5;
const WX_STIPPLE_DEFAULT_BRIGHTNESS_PERCENT = 30;
const WX_STIPPLE_BRIGHTNESS_STEP_PERCENT = 5;
const TOOLS_DEFAULT_BRIGHTNESS_PERCENT = 40;
const TOOLS_BRIGHTNESS_STEP_PERCENT = 5;
const VOL_DEFAULT_LEVEL = 0;
const VOL_MIN_LEVEL = 0;
const VOL_MAX_LEVEL = 10;
const VOL_STEP_LEVEL = 1;
const HISTORY_DOTS_DEFAULT_COUNT = 5;
const HISTORY_DOTS_MIN_COUNT = 1;
const HISTORY_DOTS_MAX_COUNT = 9;
const HISTORY_DOTS_STEP_COUNT = 1;
const HISTORY_RATE_DISPLAY = "4.5";
const PTL_LENGTH_DEFAULT_MINUTES = 1.0;
const PTL_LENGTH_MIN_MINUTES = 0.5;
const PTL_LENGTH_MAX_MINUTES = 3.0;
const PTL_LENGTH_STEP_MINUTES = 0.5;
const CA_ALERT_AUDIO_PATH = "/public/audio/CA.mp3";
const ERROR_ALERT_AUDIO_PATH = "/public/audio/ERROR.mp3";
const RENDER_COMPASS_AND_DCB_ONLY = false;
const DATABLOCK_LEADER_DIRECTIONS: readonly DatablockLeaderDirection[] = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW"
];
const DATABLOCK_LEADER_LEVEL_MIN = 0;
const DATABLOCK_LEADER_LEVEL_MAX = 7;
const DATABLOCK_LEADER_DEFAULT_LEVEL = 1;
const DATABLOCK_LEADER_LEVEL_1_PX = 15;
const DATABLOCK_LEADER_LEVEL_STEP_PX = 10;
const DATABLOCK_LEADER_ZERO_MARGIN_PX = 5;
const WX_REFRESH_MS = 10_000;
const TFR_REFRESH_MS = 60_000;
const WX_HISTORY_FRAME_DURATION_MS = 5_000;
const WX_STIPPLE_ZOOM_INTERACTION_GRACE_MS = 180;
const WX_FETCH_MIN_RADIUS_NM = 50;
const WX_FETCH_PADDING_NM = 20;
const WX_FETCH_MAX_RADIUS_NM = 150;
const VFR_TL_INDEX_MIN = 0;
const VFR_TL_INDEX_MAX = 99;
const LOW_ALT_AIRPORT_EXEMPT_RADIUS_NM = 5;
const LOW_ALT_LOCALIZER_EXEMPT_LENGTH_NM = 12;
const LOW_ALT_LOCALIZER_EXEMPT_HALF_WIDTH_NM = 1.5;
const RBL_LABEL_FONT = "12px monospace";
const RBL_LABEL_MIDPOINT_OFFSET_X_PX = 4;
const RBL_LABEL_MIDPOINT_OFFSET_Y_PX = -4;
const RBL_LABEL_AIRCRAFT_OFFSET_X_PX = 8;
const RBL_LABEL_AIRCRAFT_OFFSET_Y_PX = 12;
const MIN_SEPARATION_PARALLEL_TRACK_THRESHOLD_DEG = 12;
const MIN_SEPARATION_RELATIVE_SPEED_EPS_NM_PER_MIN = 0.02;
const MIN_SEPARATION_MAX_PREDICTION_MIN = 120;
const MIN_SEPARATION_TRIANGLE_SIZE_PX = 6;
const MIN_SEPARATION_TRIANGLE_NORTH_RAD = -Math.PI / 2;
const MIN_SEPARATION_LABEL_GAP_PADDING_PX = 1;
const UI_RENDER_TICK_MS = 250;
const TFR_FIRST_DISPLAY_ID = 101;
const TFR_BOUNDARY_LINE_WIDTH_PX = 1;
const TFR_STIPPLE_ALPHA = 168;
const TFR_LABEL_LINE_GAP_PX = 2;
const TFR_LABEL_BLINK_HALF_CYCLE_MS = 500;
const RADAR_SCOPE_CURSOR_FALLBACK = "crosshair";
const NON_SCOPE_CURSOR = "default";
const STARS_SPECIAL_CURSOR_WIDTH_PX = 17;
const STARS_SPECIAL_CURSOR_HEIGHT_PX = 17;
const STARS_SPECIAL_CURSOR_OUTPUT_WIDTH_PX = 10;
const STARS_SPECIAL_CURSOR_OUTPUT_HEIGHT_PX = 10;
const STARS_SPECIAL_CURSOR_HOTSPOT_X = 8;
const STARS_SPECIAL_CURSOR_HOTSPOT_Y = 8;
const STARS_SPECIAL_CURSOR_COLOR = starsColors.DIM_GRAY;
const STARS_SPECIAL_CURSOR_ROWS: readonly string[] = [
  "00000000100000000000000000000000",
  "00000000000000000000000000000000",
  "00000000000000000000000000000000",
  "00000000100000000000000000000000",
  "00000000000000000000000000000000",
  "00000000000000000000000000000000",
  "00000000100000000000000000000000",
  "00000000000000000000000000000000",
  "10010010001001001000000000000000",
  "00000000000000000000000000000000",
  "00000000100000000000000000000000",
  "00000000000000000000000000000000",
  "00000000000000000000000000000000",
  "00000000100000000000000000000000",
  "00000000000000000000000000000000",
  "00000000000000000000000000000000",
  "00000000100000000000000000000000"
];

interface LatLon {
  lat: number;
  lon: number;
}

interface ScopeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TraconRunwayConfig {
  threshold?: string;
  heading_true?: number;
  heading_mag?: number;
}

interface TraconAirportConfig {
  ref?: string;
  runways?: Record<string, TraconRunwayConfig>;
}

interface TraconSiteConfig {
  label?: string;
  name?: string;
}

interface TraconConfigPayload {
  videomaps?: string;
  mva?: string;
  sites?: TraconSiteConfig[];
  airports?: Record<string, TraconAirportConfig>;
}

interface DcbSiteOption {
  siteId: string;
  top: string;
  bottom: string;
}

type VideoMapLines = LatLon[][];

interface TouchPinchState {
  startDistancePx: number;
  startRangeNm: number;
}

interface FlightRulesSsePayload {
  callsign?: string;
  rulesLabel?: string;
  flightRules?: string;
  beaconCode?: string;
}

interface MvaPoint {
  lon: number;
  lat: number;
}

interface MvaBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

interface MvaSector {
  name: string;
  minimumLimitFt: number;
  exterior: MvaPoint[];
  holes: MvaPoint[][];
  bounds: MvaBounds;
}

interface ApproachExemptionCorridor {
  runwayId: string;
  threshold: LatLon;
  outboundCourseTrueDeg: number;
  lengthNm: number;
  halfWidthNm: number;
}

interface FlightRuleState {
  rulesLabel: string;
  flightRules: string;
}

interface TowerListDisplayState {
  airportIcao: string;
  offsetPxX: number;
  offsetPxY: number;
  pinned: boolean;
  visible: boolean;
  maxAircraftRows: number;
}

interface AircraftHitTarget {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type RblEndpoint =
  | {
      kind: "aircraft";
      aircraftId: string;
    }
  | {
      kind: "point";
      lat: number;
      lon: number;
    };

interface RangeBearingLine {
  start: RblEndpoint;
  end: RblEndpoint;
}

interface PredictedMinSeparationPair {
  firstAircraftId: string;
  secondAircraftId: string;
}

interface WxHistoryPlaybackFrame {
  frameNo: number;
  rows: number;
  cols: number;
  levels: number[];
}

interface TfrDisplayArea {
  areaId: string | null;
  points: LatLon[];
}

interface TfrDisplayRecord {
  sourceId: string;
  displayId: number;
  localName: string;
  areas: TfrDisplayArea[];
}

interface TfrTextState {
  visible: boolean;
  blink: boolean;
  customText: string | null;
}

type F12TfrTextCommandState =
  | {
      stage: "collect-id";
      idBuffer: string;
    }
  | {
      stage: "await-action";
      displayId: number;
    }
  | {
      stage: "await-blink-enter";
      displayId: number;
    }
  | {
      stage: "collect-custom-text";
      displayId: number;
      textBuffer: string;
    };

interface AltitudeFilterRangeFt {
  minFt: number;
  maxFt: number;
}

interface AltitudeFilterConfig {
  unassociated: AltitudeFilterRangeFt;
  associated: AltitudeFilterRangeFt;
}

const DEFAULT_ALTITUDE_FILTER: AltitudeFilterConfig = {
  unassociated: {
    minFt: 100,
    maxFt: 19_000
  },
  associated: {
    minFt: 100,
    maxFt: 19_000
  }
};

const DEFAULT_DCB_SITE_OPTIONS: ReadonlyArray<DcbSiteOption> = [
  { siteId: "MULTI", top: "MULTI", bottom: "" },
  { siteId: "FUSED", top: "FUSED", bottom: "" }
];

function buildDcbMapsCategory(
  activeMapIds: Set<number>,
  rangeNm: number,
  rangeRingSpacingNm: number,
  rangeRingAdjustMode: boolean,
  placeMapCenterMode: boolean,
  offCenterActive: boolean,
  placeRangeRingCenterMode: boolean,
  rrCntrActive: boolean,
  mapsExpanded: boolean
): DcbMapCategoryInput {
  const roundedRange = Math.max(0, Math.round(rangeNm));
  const roundedRrSpacing = Math.max(1, Math.round(rangeRingSpacingNm));
  return {
    x: DCB_MAPS_X_PX,
    y: DCB_MAPS_Y_PX,
    rangeLabel: "RANGE",
    rangeValue: String(roundedRange),
    rangeActive: false,
    rangeTone: "normal",
    placeCntrTop: "PLACE",
    placeCntrBottom: "CNTR",
    placeCntrActive: placeMapCenterMode,
    placeCntrTone: "normal",
    offCntrTop: "OFF",
    offCntrBottom: "CNTR",
    offCntrActive: offCenterActive,
    offCntrTone: "normal",
    rrLabel: "RR",
    rrValue: String(roundedRrSpacing),
    rrActive: rangeRingAdjustMode,
    rrTone: "normal",
    placeRrTop: "PLACE",
    placeRrBottom: "RR",
    placeRrActive: placeRangeRingCenterMode,
    placeRrTone: "normal",
    rrCntrTop: "RR",
    rrCntrBottom: "CNTR",
    rrCntrActive,
    rrCntrTone: "normal",
    mapsLabel: "MAPS",
    mapsActive: mapsExpanded,
    topRow: [
      { top: "221", bottom: "J_RNAV", mapId: 221, active: activeMapIds.has(221) },
      { top: "851", bottom: "COAST", mapId: 851, active: activeMapIds.has(851) },
      { top: "849", bottom: "CLASS_B", mapId: 849, active: activeMapIds.has(849) }
    ],
    bottomRow: [
      { top: "220", bottom: "F_RNAV", mapId: 220, active: activeMapIds.has(220) },
      { top: "", bottom: "", active: false },
      { top: "803", bottom: "3NM_MVA", mapId: 803, active: activeMapIds.has(803) }
    ]
  };
}

function formatVideoMapMenuLabel(id: number, rawLabel: string): string {
  const override = DCB_MAP_LABEL_OVERRIDES[id];
  if (override) {
    return override;
  }

  const normalized = rawLabel
    .trim()
    .toUpperCase()
    .replace(/ARR\/DEP/g, "")
    .replace(/RWY/g, "")
    .replace(/RNAV\/RNP/g, "RNP")
    .replace(/APPROACHES/g, "APP")
    .replace(/BOUNDARIES/g, "BDRYS")
    .replace(/FINAL/g, "FNLS")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) {
    return "";
  }
  return normalized.slice(0, 8);
}

function parseVideoMapMenuLabelsById(payload: unknown): Map<number, string> {
  const out = new Map<number, string>();
  if (!Array.isArray(payload)) {
    return out;
  }

  for (const rawEntry of payload) {
    if (!rawEntry || typeof rawEntry !== "object") {
      continue;
    }
    const entry = rawEntry as Record<string, unknown>;
    const id = Number(entry.Id ?? entry.id);
    if (!Number.isFinite(id)) {
      continue;
    }
    const roundedId = Math.floor(id);
    const rawLabel =
      (typeof entry.Name === "string" && entry.Name) ||
      (typeof entry.name === "string" && entry.name) ||
      (typeof entry.Label === "string" && entry.Label) ||
      (typeof entry.label === "string" && entry.label) ||
      "";
    out.set(roundedId, formatVideoMapMenuLabel(roundedId, rawLabel));
  }

  return out;
}

function parseVideoMapCurrentLabelsById(payload: unknown): Map<number, string> {
  const out = new Map<number, string>();
  if (!Array.isArray(payload)) {
    return out;
  }

  for (const rawEntry of payload) {
    if (!rawEntry || typeof rawEntry !== "object") {
      continue;
    }
    const entry = rawEntry as Record<string, unknown>;
    const id = Number(entry.Id ?? entry.id);
    if (!Number.isFinite(id)) {
      continue;
    }
    const roundedId = Math.floor(id);
    const rawLabel =
      (typeof entry.Label === "string" && entry.Label) ||
      (typeof entry.label === "string" && entry.label) ||
      "";
    out.set(roundedId, rawLabel.trim().toUpperCase());
  }

  return out;
}

function parseVideoMapNamesById(payload: unknown): Map<number, string> {
  const out = new Map<number, string>();
  if (!Array.isArray(payload)) {
    return out;
  }

  for (const rawEntry of payload) {
    if (!rawEntry || typeof rawEntry !== "object") {
      continue;
    }
    const entry = rawEntry as Record<string, unknown>;
    const id = Number(entry.Id ?? entry.id);
    if (!Number.isFinite(id)) {
      continue;
    }
    const roundedId = Math.floor(id);
    const rawName =
      (typeof entry.Name === "string" && entry.Name) ||
      (typeof entry.name === "string" && entry.name) ||
      "";
    out.set(roundedId, rawName.trim().toUpperCase());
  }

  return out;
}

function buildMapMenuMapButton(
  mapId: number | null,
  activeMapIds: Set<number>,
  labelsById: Map<number, string>
): DcbMapsMenuButton {
  if (mapId === null) {
    return { top: "", bottom: "", active: false };
  }
  const label = labelsById.get(mapId);
  if (label === undefined) {
    return { top: "", bottom: "", active: false };
  }
  return {
    top: String(mapId),
    bottom: label,
    mapId,
    active: activeMapIds.has(mapId),
    tone: "normal"
  };
}

function buildDcbMapsMenu(
  activeMapIds: Set<number>,
  labelsById: Map<number, string>,
  expanded: boolean,
  doneFlashActive: boolean,
  clearAllFlashActive: boolean,
  currentActive: boolean
): DcbMapsMenuInput {
  const columns = Math.max(DCB_MAPS_MENU_TOP_ROW.length, DCB_MAPS_MENU_BOTTOM_ROW.length);
  const topRow: DcbMapsMenuButton[] = [];
  const bottomRow: DcbMapsMenuButton[] = [];

  topRow.push({ top: "DONE", bottom: "", active: doneFlashActive, tone: "normal" });
  bottomRow.push({ top: "CLR", bottom: "ALL", active: clearAllFlashActive, tone: "normal" });

  for (let i = 0; i < columns; i += 1) {
    topRow.push(
      buildMapMenuMapButton(
        DCB_MAPS_MENU_TOP_ROW[i] ?? null,
        activeMapIds,
        labelsById
      )
    );
    bottomRow.push(
      buildMapMenuMapButton(
        DCB_MAPS_MENU_BOTTOM_ROW[i] ?? null,
        activeMapIds,
        labelsById
      )
    );
  }

  // Keep GEO/SYS entries as non-action placeholders for future implementation.
  topRow.push({ top: "GEO", bottom: "MAPS", tone: "normal" });
  bottomRow.push({ top: "SYS", bottom: "PROC", tone: "normal" });
  topRow.push({ top: "", bottom: "", tone: "normal" });
  bottomRow.push({ top: "CURRENT", bottom: "", tone: "normal", active: currentActive });

  return {
    x: DCB_MAPS_X_PX,
    y: DCB_MAPS_Y_PX,
    expanded,
    topRow,
    bottomRow
  };
}

function normalizeDcbSiteToken(raw: unknown, maxLength = 8): string {
  if (typeof raw !== "string") {
    return "";
  }
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[^A-Z0-9/ ]/g, "")
    .slice(0, maxLength);
}

function normalizeSelectableSiteId(raw: unknown): "MULTI" | "FUSED" | null {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim().toUpperCase();
  if (normalized === "MULTI" || normalized === "FUSED") {
    return normalized;
  }
  return null;
}

function buildDcbSiteOptionsFromTraconConfig(payload: TraconConfigPayload): DcbSiteOption[] {
  const out: DcbSiteOption[] = [];
  const seenIds = new Set<string>();
  const configuredSites = Array.isArray(payload.sites) ? payload.sites : [];

  for (const rawSite of configuredSites) {
    if (!rawSite || typeof rawSite !== "object") {
      continue;
    }
    const topRaw = normalizeDcbSiteToken(rawSite.label);
    const bottomRaw = normalizeDcbSiteToken(rawSite.name);
    const top = topRaw || bottomRaw;
    const bottom = topRaw ? bottomRaw : "";
    if (!top) {
      continue;
    }
    const siteId = bottom ? `${top}_${bottom}` : top;
    if (seenIds.has(siteId)) {
      continue;
    }
    seenIds.add(siteId);
    out.push({ siteId, top, bottom });
  }

  for (const defaultOption of DEFAULT_DCB_SITE_OPTIONS) {
    const alreadyPresent = out.some((option) => option.top === defaultOption.top);
    if (alreadyPresent) {
      continue;
    }
    out.push({ ...defaultOption });
  }

  return out;
}

function buildDcbSiteMenuInput(
  expanded: boolean,
  doneFlashActive: boolean,
  siteOptions: ReadonlyArray<DcbSiteOption>,
  activeSiteId: string | null
): DcbSiteMenuInput {
  const buttons: DcbSiteMenuButton[] = siteOptions.map((site) => ({
    siteId: site.siteId,
    top: site.top,
    bottom: site.bottom,
    active: activeSiteId !== null && site.siteId === activeSiteId,
    tone: "normal"
  }));

  return {
    x: DCB_AUX_X_PX,
    y: DCB_AUX_Y_PX,
    expanded,
    buttons,
    doneActive: doneFlashActive,
    doneTone: "normal"
  };
}

function resolveMapsMenuFallbackControl(
  button: DcbMapsMenuButton | undefined
): { control: DcbMapsControlHit; mapId: number | null } {
  if (!button) {
    return { control: "maps-menu", mapId: null };
  }

  if (Number.isFinite(button.mapId)) {
    return { control: "maps-map", mapId: Math.floor(button.mapId as number) };
  }

  const normalized = `${button.top} ${button.bottom}`
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (normalized === "DONE") {
    return { control: "maps-done", mapId: null };
  }
  if (normalized === "CLR ALL") {
    return { control: "maps-clear-all", mapId: null };
  }
  if (normalized === "CURRENT") {
    return { control: "maps-current", mapId: null };
  }

  return { control: "maps-menu", mapId: null };
}

function hitTestMapsMenuFallback(
  input: DcbMapsMenuInput,
  x: number,
  y: number
): { control: DcbMapsControlHit; mapId: number | null } | null {
  const originX = Math.round(input.x);
  const originY = Math.round(input.y);
  const mapsButtonRect = {
    x: originX + DCB_MAPS_BUTTON_X_PX,
    y: originY,
    width: DCB_BUTTON_WIDTH_PX,
    height: DCB_BUTTON_WIDTH_PX
  };
  if (pointInRect(x, y, mapsButtonRect)) {
    return { control: "maps-toggle", mapId: null };
  }

  if (!input.expanded) {
    return null;
  }

  const topRow = input.topRow ?? [];
  const bottomRow = input.bottomRow ?? [];
  const columns = Math.max(topRow.length, bottomRow.length);
  if (columns <= 0) {
    return null;
  }

  const menuOriginX = mapsButtonRect.x + DCB_BUTTON_WIDTH_PX + DCB_BUTTON_GAP_PX;
  const menuRect = {
    x: menuOriginX,
    y: originY,
    width: columns * DCB_BUTTON_WIDTH_PX + (columns - 1) * DCB_BUTTON_GAP_PX,
    height: DCB_BUTTON_HALF_HEIGHT_PX * 2 + DCB_BUTTON_GAP_PX
  };
  if (!pointInRect(x, y, menuRect)) {
    return null;
  }

  for (let i = 0; i < columns; i += 1) {
    const columnX = menuOriginX + i * (DCB_BUTTON_WIDTH_PX + DCB_BUTTON_GAP_PX);
    const topRect = {
      x: columnX,
      y: originY,
      width: DCB_BUTTON_WIDTH_PX,
      height: DCB_BUTTON_HALF_HEIGHT_PX
    };
    if (pointInRect(x, y, topRect)) {
      return resolveMapsMenuFallbackControl(topRow[i]);
    }
    const bottomRect = {
      x: columnX,
      y: originY + DCB_BUTTON_HALF_HEIGHT_PX + DCB_BUTTON_GAP_PX,
      width: DCB_BUTTON_WIDTH_PX,
      height: DCB_BUTTON_HALF_HEIGHT_PX
    };
    if (pointInRect(x, y, bottomRect)) {
      return resolveMapsMenuFallbackControl(bottomRow[i]);
    }
  }

  return { control: "maps-menu", mapId: null };
}

function resolveBriteFallbackControl(
  button: { top: string; bottom: string } | undefined,
  rowIndex: 0 | 1
): DcbBriteControlHit {
  if (!button) {
    return "brite-menu";
  }

  const top = button.top.trim().toUpperCase();
  const bottom = button.bottom.trim().toUpperCase();
  if (rowIndex === 0) {
    if (top === "DCB") {
      return "brite-dcb";
    }
    if (top === "MPA") {
      return "brite-mpa";
    }
    if (top === "RR") {
      return "brite-rr";
    }
    if (top === "HST") {
      return "brite-hst";
    }
    if (top === "WXC") {
      return "brite-wxc";
    }
    return "brite-menu";
  }

  if (bottom === "DONE") {
    return "brite-done";
  }
  if (top === "CMP") {
    return "brite-cmp";
  }
  if (top === "PRI") {
    return "brite-pri";
  }
  if (top === "MPB") {
    return "brite-mpb";
  }
  if (top === "LST") {
    return "brite-lst";
  }
  if (top === "TLS") {
    return "brite-tls";
  }
  if (top === "WX") {
    return "brite-wx";
  }

  return "brite-menu";
}

function hitTestBriteFallback(
  input: DcbBriteInput,
  x: number,
  y: number
): DcbBriteControlHit | null {
  const originX = Math.round(input.x);
  const originY = Math.round(input.y);
  const toggleRect = {
    x: originX,
    y: originY,
    width: DCB_BUTTON_WIDTH_PX,
    height: DCB_BUTTON_WIDTH_PX
  };
  if (pointInRect(x, y, toggleRect)) {
    return "brite-toggle";
  }

  if (!input.expanded) {
    return null;
  }

  const topRow = input.topRow ?? [];
  const bottomRow = input.bottomRow ?? [];
  const columns = Math.max(topRow.length, bottomRow.length);
  if (columns <= 0) {
    return null;
  }

  const menuOriginX = originX + DCB_BUTTON_WIDTH_PX + DCB_BUTTON_GAP_PX;
  const menuRect = {
    x: menuOriginX,
    y: originY,
    width: columns * DCB_BUTTON_WIDTH_PX + (columns - 1) * DCB_BUTTON_GAP_PX,
    height: DCB_BUTTON_HALF_HEIGHT_PX * 2 + DCB_BUTTON_GAP_PX
  };
  if (!pointInRect(x, y, menuRect)) {
    return null;
  }

  for (let i = 0; i < columns; i += 1) {
    const columnX = menuOriginX + i * (DCB_BUTTON_WIDTH_PX + DCB_BUTTON_GAP_PX);
    const topRect = {
      x: columnX,
      y: originY,
      width: DCB_BUTTON_WIDTH_PX,
      height: DCB_BUTTON_HALF_HEIGHT_PX
    };
    if (pointInRect(x, y, topRect)) {
      return resolveBriteFallbackControl(topRow[i], 0);
    }
    const bottomRect = {
      x: columnX,
      y: originY + DCB_BUTTON_HALF_HEIGHT_PX + DCB_BUTTON_GAP_PX,
      width: DCB_BUTTON_WIDTH_PX,
      height: DCB_BUTTON_HALF_HEIGHT_PX
    };
    if (pointInRect(x, y, bottomRect)) {
      return resolveBriteFallbackControl(bottomRow[i], 1);
    }
  }

  return "brite-menu";
}

function buildDcbWxLevels(
  activeLevels: Set<number>,
  levelsWithWxCells: ReadonlySet<number>
): DcbWxLevelsInput {
  return {
    x: DCB_WX_X_PX,
    y: DCB_WX_Y_PX,
    buttons: Array.from({ length: 6 }, (_, index) => {
      const level = index + 1;
      const hasWxCells = levelsWithWxCells.has(level);
      return {
        label: `WX${level}`,
        active: activeLevels.has(level),
        tone: hasWxCells ? "wx" : "normal"
      };
    })
  };
}

function buildDcbBriteInput(
  expanded: boolean,
  doneFlashActive: boolean,
  rrBrightnessPercent: number,
  rrBrightnessAdjustMode: boolean,
  dcbBrightnessPercent: number,
  dcbBrightnessAdjustMode: boolean,
  mapBrightnessPercent: number,
  mapBrightnessAdjustMode: boolean,
  tfrBrightnessPercent: number,
  tfrBrightnessAdjustMode: boolean,
  compassBrightnessPercent: number,
  compassBrightnessAdjustMode: boolean,
  listBrightnessPercent: number,
  listBrightnessAdjustMode: boolean,
  toolsBrightnessPercent: number,
  toolsBrightnessAdjustMode: boolean,
  blipBrightnessPercent: number,
  blipBrightnessAdjustMode: boolean,
  historyBrightnessPercent: number,
  historyBrightnessAdjustMode: boolean,
  wxBrightnessPercent: number,
  wxBrightnessAdjustMode: boolean,
  wxStippleBrightnessPercent: number,
  wxStippleBrightnessAdjustMode: boolean
): DcbBriteInput {
  const rrBrightnessValue = Math.max(0, Math.min(100, Math.round(rrBrightnessPercent)));
  const rrBrightnessLabel = rrBrightnessValue === 0 ? "OFF" : String(rrBrightnessValue);
  const dcbBrightnessValue = Math.max(0, Math.min(100, Math.round(dcbBrightnessPercent)));
  const dcbBrightnessLabel = dcbBrightnessValue === 0 ? "OFF" : String(dcbBrightnessValue);
  const mapBrightnessValue = Math.max(0, Math.min(100, Math.round(mapBrightnessPercent)));
  const mapBrightnessLabel = mapBrightnessValue === 0 ? "OFF" : String(mapBrightnessValue);
  const tfrBrightnessValue = Math.max(0, Math.min(100, Math.round(tfrBrightnessPercent)));
  const tfrBrightnessLabel = tfrBrightnessValue === 0 ? "OFF" : String(tfrBrightnessValue);
  const compassBrightnessValue = Math.max(0, Math.min(100, Math.round(compassBrightnessPercent)));
  const compassBrightnessLabel = compassBrightnessValue === 0 ? "OFF" : String(compassBrightnessValue);
  const listBrightnessValue = Math.max(LIST_MIN_BRIGHTNESS_PERCENT, Math.min(100, Math.round(listBrightnessPercent)));
  const listBrightnessLabel = String(listBrightnessValue);
  const toolsBrightnessValue = Math.max(0, Math.min(100, Math.round(toolsBrightnessPercent)));
  const toolsBrightnessLabel = toolsBrightnessValue === 0 ? "OFF" : String(toolsBrightnessValue);
  const blipBrightnessValue = Math.max(0, Math.min(100, Math.round(blipBrightnessPercent)));
  const blipBrightnessLabel = blipBrightnessValue === 0 ? "OFF" : String(blipBrightnessValue);
  const historyBrightnessValue = Math.max(0, Math.min(100, Math.round(historyBrightnessPercent)));
  const historyBrightnessLabel = historyBrightnessValue === 0 ? "OFF" : String(historyBrightnessValue);
  const wxBrightnessValue = Math.max(0, Math.min(100, Math.round(wxBrightnessPercent)));
  const wxBrightnessLabel = wxBrightnessValue === 0 ? "OFF" : String(wxBrightnessValue);
  const wxStippleBrightnessValue = Math.max(0, Math.min(100, Math.round(wxStippleBrightnessPercent)));
  const wxStippleBrightnessLabel = wxStippleBrightnessValue === 0 ? "OFF" : String(wxStippleBrightnessValue);
  return {
    x: DCB_BRITE_X_PX,
    y: DCB_BRITE_Y_PX,
    label: "BRITE",
    active: expanded,
    tone: "normal",
    expanded,
    topRow: [
      { top: "DCB", bottom: dcbBrightnessLabel, active: dcbBrightnessAdjustMode },
      { top: "MPA", bottom: mapBrightnessLabel, active: mapBrightnessAdjustMode },
      { top: "FDB", bottom: "80" },
      { top: "POS", bottom: "80" },
      { top: "OTH", bottom: "60" },
      { top: "RR", bottom: rrBrightnessLabel, active: rrBrightnessAdjustMode },
      { top: "BCN", bottom: "55" },
      { top: "HST", bottom: historyBrightnessLabel, active: historyBrightnessAdjustMode },
      { top: "WXC", bottom: wxStippleBrightnessLabel, active: wxStippleBrightnessAdjustMode }
    ],
    bottomRow: [
      { top: "BKC", bottom: "OFF" },
      { top: "MPB", bottom: tfrBrightnessLabel, active: tfrBrightnessAdjustMode },
      { top: "LST", bottom: listBrightnessLabel, active: listBrightnessAdjustMode },
      { top: "LDB", bottom: "80" },
      { top: "TLS", bottom: toolsBrightnessLabel, active: toolsBrightnessAdjustMode },
      { top: "CMP", bottom: compassBrightnessLabel, active: compassBrightnessAdjustMode },
      { top: "PRI", bottom: blipBrightnessLabel, active: blipBrightnessAdjustMode },
      { top: "WX", bottom: wxBrightnessLabel, active: wxBrightnessAdjustMode },
      { top: "", bottom: "DONE", active: doneFlashActive }
    ]
  };
}

function compassBrightnessPercentToColor(compassBrightnessPercent: number): string {
  const clampedPercent = Math.max(0, Math.min(100, Math.round(compassBrightnessPercent)));
  if (clampedPercent <= 0) {
    return "rgb(0, 0, 0)";
  }
  const intensity = Math.min(255, Math.round((COMPASS_REFERENCE_INTENSITY * clampedPercent) / 100));
  return `rgb(${intensity}, ${intensity}, ${intensity})`;
}

function listBrightnessPercentToColor(listBrightnessPercent: number): string {
  const clampedPercent = Math.max(LIST_MIN_BRIGHTNESS_PERCENT, Math.min(100, Math.round(listBrightnessPercent)));
  const intensity = Math.min(255, Math.round((LIST_REFERENCE_INTENSITY * clampedPercent) / 100));
  return `rgb(0, ${intensity}, 0)`;
}

function listBrightnessPercentToRedColor(listBrightnessPercent: number): string {
  return scaleRgbCssColor(starsColors.RED, listBrightnessPercent, { r: 255, g: 0, b: 0 });
}

function listBrightnessPercentToSsaWxColor(listBrightnessPercent: number): string {
  const clampedPercent = Math.max(LIST_MIN_BRIGHTNESS_PERCENT, Math.min(100, Math.round(listBrightnessPercent)));
  return scaleRgbCssColor(starsColors.CYAN, clampedPercent, {
    r: 0,
    g: 255,
    b: 255
  });
}

function toolsBrightnessPercentToColor(toolsBrightnessPercent: number): string {
  return scaleRgbCssColor(starsColors.WHITE, toolsBrightnessPercent, {
    r: 255,
    g: 255,
    b: 255
  });
}

function ptlBrightnessPercentToColor(toolsBrightnessPercent: number): string {
  return scaleRgbCssColor(starsColors.WHITE, toolsBrightnessPercent, {
    r: 255,
    g: 255,
    b: 255
  });
}

function clampPtlLengthMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return PTL_LENGTH_DEFAULT_MINUTES;
  }
  const rounded = Math.round(value * 2) / 2;
  return Math.min(PTL_LENGTH_MAX_MINUTES, Math.max(PTL_LENGTH_MIN_MINUTES, rounded));
}

function formatPtlLengthMinutes(value: number): string {
  return clampPtlLengthMinutes(value).toFixed(1);
}

function parseRgbCssColor(color: string): { r: number; g: number; b: number } | null {
  const match = color.match(
    /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i
  );
  if (!match) {
    return null;
  }
  const r = Math.min(255, Math.max(0, Number.parseInt(match[1], 10)));
  const g = Math.min(255, Math.max(0, Number.parseInt(match[2], 10)));
  const b = Math.min(255, Math.max(0, Number.parseInt(match[3], 10)));
  return { r, g, b };
}

function scaleRgbCssColor(
  color: string,
  brightnessPercent: number,
  fallback: { r: number; g: number; b: number }
): string {
  const clampedPercent = Math.max(0, Math.min(100, Math.round(brightnessPercent)));
  const base = parseRgbCssColor(color) ?? fallback;
  const scale = clampedPercent / 100;
  const r = Math.round(base.r * scale);
  const g = Math.round(base.g * scale);
  const b = Math.round(base.b * scale);
  return `rgb(${r}, ${g}, ${b})`;
}

function dcbBrightnessPercentToButtonToneColors(dcbBrightnessPercent: number): {
  text: string;
  inactive: string;
  active: string;
  wxInactive: string;
  wxActive: string;
} {
  return {
    text: scaleRgbCssColor(starsColors.WHITE, dcbBrightnessPercent, { r: 255, g: 255, b: 255 }),
    inactive: scaleRgbCssColor(starsColors.DCB_INACTIVE, dcbBrightnessPercent, { r: 0, g: 44, b: 0 }),
    active: scaleRgbCssColor(starsColors.DCB_ACTIVE, dcbBrightnessPercent, { r: 0, g: 78, b: 0 }),
    wxInactive: scaleRgbCssColor(starsColors.DCB_WX_INACTIVE, dcbBrightnessPercent, {
      r: 83,
      g: 83,
      b: 162
    }),
    wxActive: scaleRgbCssColor(starsColors.DCB_WX_ACTIVE, dcbBrightnessPercent, {
      r: 116,
      g: 116,
      b: 162
    })
  };
}

function blipBrightnessPercentToColor(blipBrightnessPercent: number): string {
  return scaleRgbCssColor(starsColors.SEARCH_TARGET_BLUE, blipBrightnessPercent, {
    r: 30,
    g: 120,
    b: 255
  });
}

function historyBrightnessPercentToColors(historyBrightnessPercent: number): [string, string, string, string, string] {
  return [
    scaleRgbCssColor(starsColors.HIST_BLUE_1, historyBrightnessPercent, { r: 30, g: 80, b: 200 }),
    scaleRgbCssColor(starsColors.HIST_BLUE_2, historyBrightnessPercent, { r: 70, g: 70, b: 170 }),
    scaleRgbCssColor(starsColors.HIST_BLUE_3, historyBrightnessPercent, { r: 50, g: 50, b: 130 }),
    scaleRgbCssColor(starsColors.HIST_BLUE_4, historyBrightnessPercent, { r: 40, g: 40, b: 110 }),
    scaleRgbCssColor(starsColors.HIST_BLUE_5, historyBrightnessPercent, { r: 30, g: 30, b: 90 })
  ];
}

function wxBrightnessPercentToFillColors(wxBrightnessPercent: number): { low: string; high: string } {
  return {
    low: scaleRgbCssColor(starsColors.DARK_GRAY_BLUE, wxBrightnessPercent, { r: 57, g: 115, b: 115 }),
    high: scaleRgbCssColor(starsColors.DARK_MUSTARD, wxBrightnessPercent, { r: 124, g: 124, b: 64 })
  };
}

function buildDcbLeaderControls(
  direction: DatablockLeaderDirection,
  lengthLevel: number,
  directionActive: boolean,
  lengthActive: boolean
): DcbLeaderControlsInput {
  const safeLevel = Math.min(DATABLOCK_LEADER_LEVEL_MAX, Math.max(DATABLOCK_LEADER_LEVEL_MIN, Math.round(lengthLevel)));
  return {
    x: DCB_LDR_X_PX,
    y: DCB_LDR_Y_PX,
    directionLabel: "LDR DIR",
    directionValue: direction,
    directionActive,
    directionTone: "normal",
    lengthLabel: "LDR",
    lengthValue: String(safeLevel),
    lengthActive,
    lengthTone: "normal"
  };
}

function buildDcbAuxControlsInput(
  secondPage: boolean,
  volumeLevel: number,
  volumeAdjustMode: boolean,
  historyDotCount: number,
  historyDotCountAdjustMode: boolean,
  ptlLengthMinutes: number,
  ptlLengthAdjustMode: boolean,
  shiftFlashActive: boolean,
  ssaFilterExpanded: boolean,
  siteMenuExpanded: boolean,
  selectedSiteId: "MULTI" | "FUSED"
): DcbAuxControlsInput {
  const safeVolumeLevel = Math.min(VOL_MAX_LEVEL, Math.max(VOL_MIN_LEVEL, Math.round(volumeLevel)));
  const safeHistoryDotCount = Math.min(
    HISTORY_DOTS_MAX_COUNT,
    Math.max(HISTORY_DOTS_MIN_COUNT, Math.round(historyDotCount))
  );
  const safePtlLengthMinutes = clampPtlLengthMinutes(ptlLengthMinutes);
  if (secondPage) {
    return {
      x: DCB_MAPS_X_PX,
      y: DCB_AUX_Y_PX,
      secondPage: true,
      volLabel: "VOL",
      volValue: String(safeVolumeLevel),
      volActive: volumeAdjustMode,
      historyLabel: "HISTORY",
      historyValue: String(safeHistoryDotCount),
      historyActive: historyDotCountAdjustMode,
      historyRateLabel: "H_RATE",
      historyRateValue: HISTORY_RATE_DISPLAY,
      ptlLabel: "PTL",
      ptlSubLabel: "LNTH",
      ptlValue: formatPtlLengthMinutes(safePtlLengthMinutes),
      ptlActive: ptlLengthAdjustMode,
      shiftLabel: "SHIFT",
      shiftActive: shiftFlashActive
    };
  }

  return {
    x: DCB_AUX_X_PX,
    y: DCB_AUX_Y_PX,
    secondPage: false,
    charSizeTop: "CHAR",
    charSizeBottom: "SIZE",
    modeTop: "MODE",
    modeBottom: "FSL",
    siteMultiTop: "SITE",
    siteMultiBottom: selectedSiteId,
    siteMultiActive: siteMenuExpanded,
    siteMultiTone: "normal",
    prefLabel: "PREF",
    ssaFilterTop: "SSA",
    ssaFilterBottom: "FILTER",
    ssaFilterActive: ssaFilterExpanded,
    giTextFilterTop: "GI TEXT",
    giTextFilterBottom: "FILTER",
    shiftLabel: "SHIFT",
    shiftActive: shiftFlashActive
  };
}

function buildDcbSsaFilterInput(
  expanded: boolean,
  doneFlashActive: boolean,
  wxLineVisible: boolean,
  statusLineVisible: boolean,
  radarModeVisible: boolean,
  timeVisible: boolean,
  altimeterVisible: boolean,
  altitudeFilterLineVisible: boolean
): DcbSsaFilterInput {
  return {
    x: DCB_AUX_X_PX,
    y: DCB_AUX_Y_PX,
    expanded,
    topRow: DCB_SSA_FILTER_MENU_TOP_ROW.map((button) => ({
      top: button.top,
      bottom: button.bottom,
      active:
        button.top.trim().toUpperCase() === "TIME"
          ? timeVisible
          : button.top.trim().toUpperCase() === "STATUS"
            ? statusLineVisible
            : button.top.trim().toUpperCase() === "RADAR"
              ? radarModeVisible
          : button.top.trim().toUpperCase() === "ALT FIL"
            ? altitudeFilterLineVisible
            : false,
      tone: "normal"
    })),
    bottomRow: DCB_SSA_FILTER_MENU_BOTTOM_ROW.map((button) => ({
      top: button.top,
      bottom: button.bottom,
      active:
        button.top.trim().toUpperCase() === "WX"
          ? wxLineVisible
          : button.top.trim().toUpperCase() === "ALTSTG"
            ? altimeterVisible
            : false,
      tone: "normal"
    })),
    doneActive: doneFlashActive,
    doneTone: "normal"
  };
}

function leaderLengthLevelToLinePx(level: number): number {
  const safeLevel = Math.min(DATABLOCK_LEADER_LEVEL_MAX, Math.max(DATABLOCK_LEADER_LEVEL_MIN, Math.round(level)));
  if (safeLevel <= 0) {
    return 0;
  }
  return DATABLOCK_LEADER_LEVEL_1_PX + (safeLevel - 1) * DATABLOCK_LEADER_LEVEL_STEP_PX;
}

function leaderLengthLevelToLayoutPx(level: number): number {
  const linePx = leaderLengthLevelToLinePx(level);
  return linePx > 0 ? linePx : DATABLOCK_LEADER_ZERO_MARGIN_PX;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function distanceNmBetween(a: LatLon, b: LatLon): number {
  const lat1 = toRadians(a.lat);
  const lon1 = toRadians(a.lon);
  const lat2 = toRadians(b.lat);
  const lon2 = toRadians(b.lon);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const haversine =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  const earthRadiusNm = 3440.065;
  return earthRadiusNm * centralAngle;
}

function lateralDistanceNm(a: AircraftFeedItem, b: AircraftFeedItem): number {
  return distanceNmBetween(
    { lat: a.position.lat, lon: a.position.lon },
    { lat: b.position.lat, lon: b.position.lon }
  );
}

function parseDmsToken(token: string, positiveHemisphere: string, negativeHemisphere: string): number | null {
  const trimmed = token.trim();
  if (trimmed.length < 2) {
    return null;
  }

  const hemisphere = trimmed[0].toUpperCase();
  if (hemisphere !== positiveHemisphere && hemisphere !== negativeHemisphere) {
    return null;
  }

  const body = trimmed.slice(1);
  const parts = body.split(".");
  if (parts.length < 3) {
    return null;
  }

  const degrees = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = Number(parts.slice(2).join("."));
  if (!Number.isFinite(degrees) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }

  const decimal = degrees + minutes / 60 + seconds / 3600;
  return hemisphere === negativeHemisphere ? -decimal : decimal;
}

function parseAirportRefCoordinates(ref: string): LatLon | null {
  const [latToken, lonToken] = ref.split(",").map((part) => part.trim());
  if (!latToken || !lonToken) {
    return null;
  }

  const lat = parseDmsToken(latToken, "N", "S");
  const lon = parseDmsToken(lonToken, "E", "W");
  if (lat === null || lon === null) {
    return null;
  }

  return { lat, lon };
}

function extractTowerAirportRef(
  payload: TraconConfigPayload,
  airportIcao: string
): LatLon | null {
  const airport = payload.airports?.[airportIcao];
  if (!airport?.ref) {
    return null;
  }
  return parseAirportRefCoordinates(airport.ref);
}

function normalizeHeadingDeg(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function headingToUnitVector(headingDeg: number): { x: number; y: number } {
  const radians = toRadians(headingDeg);
  return {
    x: Math.sin(radians),
    y: Math.cos(radians)
  };
}

function projectOffsetNm(point: LatLon, origin: LatLon): { x: number; y: number } {
  const nmPerLonDeg = 60 * Math.cos(toRadians(origin.lat));
  return {
    x: (point.lon - origin.lon) * nmPerLonDeg,
    y: (point.lat - origin.lat) * 60
  };
}

function findDescendantsByLocalName(root: Document | Element, localName: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter((element) => element.localName === localName);
}

function readFirstDescendantText(root: Document | Element, localName: string): string | null {
  const first = findDescendantsByLocalName(root, localName)[0];
  if (!first) {
    return null;
  }
  const text = first.textContent?.trim();
  return text && text.length > 0 ? text : null;
}

function parseCrs84PosList(posListText: string): MvaPoint[] {
  const numbers = posListText
    .trim()
    .split(/\s+/)
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value));
  const points: MvaPoint[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    points.push({ lon: numbers[i], lat: numbers[i + 1] });
  }
  return points;
}

function computeMvaBounds(points: MvaPoint[]): MvaBounds {
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    if (point.lon < minLon) minLon = point.lon;
    if (point.lon > maxLon) maxLon = point.lon;
    if (point.lat < minLat) minLat = point.lat;
    if (point.lat > maxLat) maxLat = point.lat;
  }

  return { minLon, maxLon, minLat, maxLat };
}

function pointInRing(point: MvaPoint, ring: MvaPoint[]): boolean {
  if (ring.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i].lon;
    const yi = ring[i].lat;
    const xj = ring[j].lon;
    const yj = ring[j].lat;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function containsPointInMvaSector(point: MvaPoint, sector: MvaSector): boolean {
  if (
    point.lon < sector.bounds.minLon ||
    point.lon > sector.bounds.maxLon ||
    point.lat < sector.bounds.minLat ||
    point.lat > sector.bounds.maxLat
  ) {
    return false;
  }
  if (!pointInRing(point, sector.exterior)) {
    return false;
  }
  for (const hole of sector.holes) {
    if (pointInRing(point, hole)) {
      return false;
    }
  }
  return true;
}

function findMvaForPosition(position: LatLon, sectors: MvaSector[]): number | null {
  const point: MvaPoint = {
    lon: position.lon,
    lat: position.lat
  };

  let matchedMvaFt: number | null = null;
  for (const sector of sectors) {
    if (!containsPointInMvaSector(point, sector)) {
      continue;
    }
    if (matchedMvaFt === null || sector.minimumLimitFt > matchedMvaFt) {
      matchedMvaFt = sector.minimumLimitFt;
    }
  }
  return matchedMvaFt;
}

function parseMvaSectorsFromXml(xmlText: string): MvaSector[] {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Failed to parse MVA XML document");
  }

  const sectors: MvaSector[] = [];
  for (const airspace of findDescendantsByLocalName(doc, "Airspace")) {
    const timeSlice = findDescendantsByLocalName(airspace, "AirspaceTimeSlice")[0];
    if (!timeSlice) {
      continue;
    }

    const sectorName = (readFirstDescendantText(timeSlice, "name") ?? "").trim().toUpperCase();
    const minimumLimitText = readFirstDescendantText(timeSlice, "minimumLimit");
    const minimumLimitFt = minimumLimitText ? Number(minimumLimitText) : NaN;
    if (!Number.isFinite(minimumLimitFt)) {
      continue;
    }

    const polygonPatches = findDescendantsByLocalName(timeSlice, "PolygonPatch");
    for (const patch of polygonPatches) {
      const exteriorElement = findDescendantsByLocalName(patch, "exterior")[0];
      if (!exteriorElement) {
        continue;
      }
      const exteriorPosList = readFirstDescendantText(exteriorElement, "posList");
      if (!exteriorPosList) {
        continue;
      }
      const exterior = parseCrs84PosList(exteriorPosList);
      if (exterior.length < 3) {
        continue;
      }

      const holes: MvaPoint[][] = [];
      for (const interiorElement of findDescendantsByLocalName(patch, "interior")) {
        const interiorPosList = readFirstDescendantText(interiorElement, "posList");
        if (!interiorPosList) {
          continue;
        }
        const interiorRing = parseCrs84PosList(interiorPosList);
        if (interiorRing.length >= 3) {
          holes.push(interiorRing);
        }
      }

      sectors.push({
        name: sectorName || "UNKNOWN",
        minimumLimitFt,
        exterior,
        holes,
        bounds: computeMvaBounds(exterior)
      });
    }
  }

  return sectors;
}

function extractApproachExemptionCorridors(
  payload: TraconConfigPayload,
  airportIcao: string
): ApproachExemptionCorridor[] {
  const airport = payload.airports?.[airportIcao];
  const runways = airport?.runways;
  if (!runways) {
    return [];
  }

  const corridors: ApproachExemptionCorridor[] = [];
  for (const [runwayId, runway] of Object.entries(runways)) {
    if (!runway) {
      continue;
    }
    const threshold = runway.threshold ? parseAirportRefCoordinates(runway.threshold) : null;
    const headingTrueDeg = Number(runway.heading_true ?? runway.heading_mag);
    if (!threshold || !Number.isFinite(headingTrueDeg)) {
      continue;
    }

    corridors.push({
      runwayId,
      threshold,
      outboundCourseTrueDeg: normalizeHeadingDeg(headingTrueDeg + 180),
      lengthNm: LOW_ALT_LOCALIZER_EXEMPT_LENGTH_NM,
      halfWidthNm: LOW_ALT_LOCALIZER_EXEMPT_HALF_WIDTH_NM
    });
  }
  return corridors;
}

function isInsideApproachExemptionCorridor(
  position: LatLon,
  corridor: ApproachExemptionCorridor
): boolean {
  const relative = projectOffsetNm(position, corridor.threshold);
  const axis = headingToUnitVector(corridor.outboundCourseTrueDeg);
  const alongNm = relative.x * axis.x + relative.y * axis.y;
  const crossNm = Math.abs(-relative.x * axis.y + relative.y * axis.x);
  return alongNm >= 0 && alongNm <= corridor.lengthNm && crossNm <= corridor.halfWidthNm;
}

function formatAltitudeHundreds(altitudeFt: number): string {
  const hundreds = Math.max(0, Math.round(altitudeFt / 100));
  return String(hundreds).padStart(3, "0");
}

function shouldCheckLowAltitude(
  aircraft: AircraftFeedItem,
  flightRulesByCallsign: Map<string, FlightRuleState>
): boolean {
  const squawk = (aircraft.squawk ?? "").trim();
  if (squawk === "1200") {
    return false;
  }

  const callsign = normalizeCallsign(aircraft.callsign);
  if (!callsign) {
    return squawk !== "1200";
  }

  const rules = flightRulesByCallsign.get(callsign);
  const rulesLabel = rules?.rulesLabel ?? "";
  const flightRules = rules?.flightRules ?? "";
  const hasExplicitRuleInfo = rulesLabel.length > 0 || flightRules.length > 0;
  if (!hasExplicitRuleInfo) {
    return squawk !== "1200";
  }

  return rulesLabel === "IFR" || flightRules === "IFR" || flightRules === "I";
}

function isLowAltitudeExempt(
  position: LatLon,
  mainAirportRef: LatLon | null,
  approachCorridors: ApproachExemptionCorridor[]
): boolean {
  if (mainAirportRef && distanceNmBetween(position, mainAirportRef) <= LOW_ALT_AIRPORT_EXEMPT_RADIUS_NM) {
    return true;
  }
  for (const corridor of approachCorridors) {
    if (isInsideApproachExemptionCorridor(position, corridor)) {
      return true;
    }
  }
  return false;
}

function collectLowAltitudeAlerts(
  aircraft: AircraftFeedItem[],
  sectors: MvaSector[],
  mainAirportRef: LatLon | null,
  approachCorridors: ApproachExemptionCorridor[],
  flightRulesByCallsign: Map<string, FlightRuleState>
): string[] {
  if (sectors.length === 0) {
    return [];
  }

  const alerts: string[] = [];
  const seenCallsigns = new Set<string>();
  for (const entry of aircraft) {
    const callsign = normalizeCallsign(entry.callsign);
    if (!callsign || seenCallsigns.has(callsign)) {
      continue;
    }
    if (entry.altitudeAmslFt === null || !Number.isFinite(entry.altitudeAmslFt)) {
      continue;
    }
    if (!shouldCheckLowAltitude(entry, flightRulesByCallsign)) {
      continue;
    }

    const position = { lat: entry.position.lat, lon: entry.position.lon };
    if (isLowAltitudeExempt(position, mainAirportRef, approachCorridors)) {
      continue;
    }

    const mvaFt = findMvaForPosition(position, sectors);
    if (mvaFt === null) {
      continue;
    }
    if (entry.altitudeAmslFt >= mvaFt) {
      continue;
    }

    seenCallsigns.add(callsign);
    alerts.push(`${callsign} ${formatAltitudeHundreds(entry.altitudeAmslFt)} LA`);
  }
  return alerts;
}

function resolveStaticAssetPath(path: string | undefined): string | null {
  if (!path) {
    return null;
  }
  const trimmed = path.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("src/client/")) {
    return `/${trimmed.slice("src/client/".length)}`;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function parseVideoMapLines(raw: unknown): VideoMapLines {
  if (!Array.isArray(raw)) {
    return [];
  }
  const lines: VideoMapLines = [];
  for (const rawPolyline of raw) {
    if (!Array.isArray(rawPolyline)) {
      continue;
    }
    const polyline: LatLon[] = [];
    const flush = (): void => {
      if (polyline.length >= 2) {
        lines.push(polyline.slice());
      }
      polyline.length = 0;
    };
    for (const rawPoint of rawPolyline) {
      if (!Array.isArray(rawPoint) || rawPoint.length < 2) {
        flush();
        continue;
      }
      const lon = Number(rawPoint[0]);
      const lat = Number(rawPoint[1]);
      const isFinitePoint = Number.isFinite(lat) && Number.isFinite(lon);
      const isZeroSentinel = Math.abs(lat) < 1e-6 && Math.abs(lon) < 1e-6;
      if (!isFinitePoint || isZeroSentinel) {
        flush();
        continue;
      }
      polyline.push({ lat, lon });
    }
    flush();
  }
  return lines;
}

function parseVideoMapsById(payload: unknown): Map<number, VideoMapLines> {
  const out = new Map<number, VideoMapLines>();
  if (!Array.isArray(payload)) {
    return out;
  }

  for (const rawEntry of payload) {
    if (!rawEntry || typeof rawEntry !== "object") {
      continue;
    }
    const entry = rawEntry as Record<string, unknown>;
    const id = Number(entry.Id ?? entry.id);
    if (!Number.isFinite(id)) {
      continue;
    }
    const lines = parseVideoMapLines(entry.Lines ?? entry.lines);
    out.set(Math.floor(id), lines);
  }

  return out;
}

async function fetchTraconConfig(tracon: string): Promise<TraconConfigPayload> {
  const candidateUrls = [
    `/data/configs/${tracon}.json`,
    `/.tauri-dist/data/configs/${tracon}.json`
  ];
  const loaded: TraconConfigPayload[] = [];
  const errors: string[] = [];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json"
        }
      });
      if (!response.ok) {
        errors.push(`${url} -> HTTP ${response.status}`);
        continue;
      }
      loaded.push((await response.json()) as TraconConfigPayload);
    } catch (error) {
      errors.push(`${url} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (loaded.length === 0) {
    throw new Error(
      `Failed to load TRACON config ${tracon}. Tried: ${errors.join("; ")}`
    );
  }

  const primary = loaded[0];
  const primaryHasSites = Array.isArray(primary.sites) && primary.sites.length > 0;
  if (primaryHasSites) {
    return primary;
  }

  const alternateWithSites = loaded.find(
    (candidate) => Array.isArray(candidate.sites) && candidate.sites.length > 0
  );
  if (!alternateWithSites) {
    return primary;
  }

  return {
    ...primary,
    sites: alternateWithSites.sites
  };
}

function projectLatLonToScope(
  point: LatLon,
  center: LatLon,
  radiusNm: number,
  scopeRect: ScopeRect
): { x: number; y: number } {
  const nmPerLonDeg = 60 * Math.cos(toRadians(center.lat));
  const dxNm = (point.lon - center.lon) * nmPerLonDeg;
  const dyNm = (point.lat - center.lat) * 60;
  const pixelsPerNm = Math.min(scopeRect.width, scopeRect.height) / (2 * radiusNm);
  return {
    x: scopeRect.x + scopeRect.width * 0.5 + dxNm * pixelsPerNm,
    y: scopeRect.y + scopeRect.height * 0.5 - dyNm * pixelsPerNm
  };
}

function unprojectScopeToLatLon(
  pointPx: { x: number; y: number },
  center: LatLon,
  radiusNm: number,
  scopeRect: ScopeRect,
  panOffsetPxX: number,
  panOffsetPxY: number
): LatLon | null {
  if (!Number.isFinite(radiusNm) || radiusNm <= 0) {
    return null;
  }

  const pixelsPerNm = Math.min(scopeRect.width, scopeRect.height) / (2 * radiusNm);
  if (!Number.isFinite(pixelsPerNm) || pixelsPerNm <= 0) {
    return null;
  }

  const scopeCenterX = scopeRect.x + scopeRect.width * 0.5;
  const scopeCenterY = scopeRect.y + scopeRect.height * 0.5;
  const dxNm = (pointPx.x - scopeCenterX - panOffsetPxX) / pixelsPerNm;
  const dyNm = -(pointPx.y - scopeCenterY - panOffsetPxY) / pixelsPerNm;

  const lat = center.lat + dyNm / 60;
  const nmPerLonDeg = 60 * Math.cos(toRadians(center.lat));
  if (!Number.isFinite(nmPerLonDeg) || Math.abs(nmPerLonDeg) < 1e-9) {
    return null;
  }
  const lon = center.lon + dxNm / nmPerLonDeg;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return { lat, lon };
}

function stepRangeRingSpacingNm(
  currentSpacingNm: number,
  deltaDirection: number
): number {
  const normalizedDirection = deltaDirection === 0 ? 0 : deltaDirection > 0 ? 1 : -1;
  if (normalizedDirection === 0) {
    return currentSpacingNm;
  }

  let currentIndex = RANGE_RING_SPACING_OPTIONS_NM.findIndex((value) => value === currentSpacingNm);
  if (currentIndex === -1) {
    const fallback = [...RANGE_RING_SPACING_OPTIONS_NM].sort((a, b) => Math.abs(a - currentSpacingNm) - Math.abs(b - currentSpacingNm))[0];
    currentIndex = RANGE_RING_SPACING_OPTIONS_NM.findIndex((value) => value === fallback);
  }

  const nextIndex = Math.min(
    RANGE_RING_SPACING_OPTIONS_NM.length - 1,
    Math.max(0, currentIndex + normalizedDirection)
  );
  return RANGE_RING_SPACING_OPTIONS_NM[nextIndex] ?? currentSpacingNm;
}

function drawRangeRings(
  ctx: CanvasRenderingContext2D,
  scopeRect: ScopeRect,
  mapCenter: LatLon | null,
  mapRangeNm: number | null,
  panOffsetPxX: number,
  panOffsetPxY: number,
  ringCenter: LatLon | null,
  ringSpacingNm: number,
  ringBrightnessPercent: number
): void {
  if (!mapCenter || mapRangeNm === null || mapRangeNm <= 0 || !ringCenter || ringSpacingNm <= 0) {
    return;
  }

  const projectedCenter = projectLatLonToScope(ringCenter, mapCenter, mapRangeNm, scopeRect);
  const centerX = projectedCenter.x + panOffsetPxX;
  const centerY = projectedCenter.y + panOffsetPxY;
  const pixelsPerNm = Math.min(scopeRect.width, scopeRect.height) / (2 * mapRangeNm);
  if (!Number.isFinite(pixelsPerNm) || pixelsPerNm <= 0) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(scopeRect.x, scopeRect.y, scopeRect.width, scopeRect.height);
  ctx.clip();
  const alpha = Math.max(0, Math.min(1, ringBrightnessPercent / 100));
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = RANGE_RING_STROKE_WIDTH_PX;

  for (let radiusNm = ringSpacingNm; radiusNm <= RANGE_RING_MAX_DRAW_NM; radiusNm += ringSpacingNm) {
    const radiusPx = radiusNm * pixelsPerNm;
    if (!Number.isFinite(radiusPx) || radiusPx <= 0) {
      continue;
    }
    ctx.beginPath();
    ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSelectedVideoMaps(
  ctx: CanvasRenderingContext2D,
  scopeRect: ScopeRect,
  center: LatLon | null,
  radiusNm: number | null,
  panOffsetPxX: number,
  panOffsetPxY: number,
  mapBrightnessPercent: number,
  activeMapIds: Set<number>,
  videoMapsById: Map<number, VideoMapLines>
): void {
  if (!center || radiusNm === null || radiusNm <= 0 || activeMapIds.size === 0) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(scopeRect.x, scopeRect.y, scopeRect.width, scopeRect.height);
  ctx.clip();
  const alpha = Math.max(0, Math.min(1, mapBrightnessPercent / 100));
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = VIDEO_MAP_STROKE_WIDTH_PX;

  const sortedIds = Array.from(activeMapIds).sort((a, b) => a - b);
  for (const mapId of sortedIds) {
    const lines = videoMapsById.get(mapId);
    if (!lines || lines.length === 0) {
      continue;
    }
    for (const polyline of lines) {
      if (polyline.length < 2) {
        continue;
      }
      const first = projectLatLonToScope(polyline[0], center, radiusNm, scopeRect);
      ctx.beginPath();
      ctx.moveTo(first.x + panOffsetPxX, first.y + panOffsetPxY);
      for (let i = 1; i < polyline.length; i += 1) {
        const projected = projectLatLonToScope(polyline[i], center, radiusNm, scopeRect);
        ctx.lineTo(projected.x + panOffsetPxX, projected.y + panOffsetPxY);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function normalizeTfrLocalName(localName: string | null, fallbackId: string): string {
  const normalized = (localName ?? "").trim().toUpperCase();
  return normalized.length > 0 ? normalized : `TFR ${fallbackId}`;
}

function buildTfrDisplayRecords(payload: TfrsResponse): TfrDisplayRecord[] {
  const sorted = [...payload.tfrs].sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" })
  );
  const out: TfrDisplayRecord[] = [];
  let nextDisplayId = TFR_FIRST_DISPLAY_ID;
  for (let i = 0; i < sorted.length; i += 1) {
    const item = sorted[i];
    const areas: TfrDisplayArea[] = [];
    for (let areaIndex = 0; areaIndex < item.areas.length; areaIndex += 1) {
      const area = item.areas[areaIndex];
      if (!Array.isArray(area.points) || area.points.length < 3) {
        continue;
      }
      const points: LatLon[] = [];
      for (let pointIndex = 0; pointIndex < area.points.length; pointIndex += 1) {
        const point = area.points[pointIndex];
        if (
          !Number.isFinite(point.lat) ||
          !Number.isFinite(point.lon) ||
          Math.abs(point.lat) > 90 ||
          Math.abs(point.lon) > 180
        ) {
          continue;
        }
        points.push({
          lat: point.lat,
          lon: point.lon
        });
      }
      if (points.length < 3) {
        continue;
      }
      areas.push({
        areaId: area.areaId ?? null,
        points
      });
    }
    if (areas.length === 0) {
      continue;
    }
    out.push({
      sourceId: item.id,
      displayId: nextDisplayId,
      localName: normalizeTfrLocalName(item.localName, item.id),
      areas
    });
    nextDisplayId += 1;
  }
  return out;
}

function findTfrByDisplayId(
  tfrDisplayRecords: readonly TfrDisplayRecord[],
  displayId: number
): TfrDisplayRecord | null {
  for (let i = 0; i < tfrDisplayRecords.length; i += 1) {
    if (tfrDisplayRecords[i].displayId === displayId) {
      return tfrDisplayRecords[i];
    }
  }
  return null;
}

function computeTfrLabelAnchor(tfr: TfrDisplayRecord): LatLon | null {
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;

  for (let areaIndex = 0; areaIndex < tfr.areas.length; areaIndex += 1) {
    const area = tfr.areas[areaIndex];
    for (let pointIndex = 0; pointIndex < area.points.length; pointIndex += 1) {
      const point = area.points[pointIndex];
      if (point.lat < minLat) minLat = point.lat;
      if (point.lat > maxLat) maxLat = point.lat;
      if (point.lon < minLon) minLon = point.lon;
      if (point.lon > maxLon) maxLon = point.lon;
    }
  }

  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(minLon) ||
    !Number.isFinite(maxLon)
  ) {
    return null;
  }

  return {
    lat: (minLat + maxLat) * 0.5,
    lon: (minLon + maxLon) * 0.5
  };
}

function getOrCreateTfrTextState(
  tfrTextStateBySourceId: Map<string, TfrTextState>,
  sourceId: string
): TfrTextState {
  let textState = tfrTextStateBySourceId.get(sourceId);
  if (!textState) {
    textState = {
      visible: true,
      blink: false,
      customText: null
    };
    tfrTextStateBySourceId.set(sourceId, textState);
  }
  return textState;
}

function buildTfrOverlayLabelText(displayId: number, localName: string): string {
  const prefix = `[${displayId}]`;
  const nameWords = localName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (nameWords.length === 0) {
    return prefix;
  }

  const splitIndex = Math.max(1, Math.ceil(nameWords.length / 2));
  const firstLineName = nameWords.slice(0, splitIndex).join(" ");
  const secondLineName = nameWords.slice(splitIndex).join(" ");
  if (secondLineName.length === 0) {
    return `${prefix} ${firstLineName}`;
  }
  return `${prefix} ${firstLineName}\n${secondLineName}`;
}

function drawActiveTfrOverlays(
  ctx: CanvasRenderingContext2D,
  scopeRect: ScopeRect,
  viewCenter: LatLon | null,
  viewRadiusNm: number | null,
  panOffsetPxX: number,
  panOffsetPxY: number,
  tfrDisplayRecords: readonly TfrDisplayRecord[],
  activeTfrSourceIds: ReadonlySet<string>,
  tfrTextStateBySourceId: ReadonlyMap<string, TfrTextState>,
  tfrBlinkDimmed: boolean,
  boundaryColor: string,
  stipplePattern: CanvasPattern | null,
  labelColor: string,
  blinkLabelColor: string,
  labelDrawer?: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    color: string
  ) => void
): void {
  if (!viewCenter || viewRadiusNm === null || viewRadiusNm <= 0) {
    return;
  }

  const activeTfrs = tfrDisplayRecords.filter((tfr) => activeTfrSourceIds.has(tfr.sourceId));
  if (activeTfrs.length === 0) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(scopeRect.x, scopeRect.y, scopeRect.width, scopeRect.height);
  ctx.clip();
  ctx.strokeStyle = boundaryColor;
  ctx.lineWidth = TFR_BOUNDARY_LINE_WIDTH_PX;

  for (let i = 0; i < activeTfrs.length; i += 1) {
    const tfr = activeTfrs[i];
    const path = new Path2D();
    let hasAnyPolygon = false;

    for (let areaIndex = 0; areaIndex < tfr.areas.length; areaIndex += 1) {
      const area = tfr.areas[areaIndex];
      if (area.points.length < 3) {
        continue;
      }
      const firstProjected = projectLatLonToScope(area.points[0], viewCenter, viewRadiusNm, scopeRect);
      path.moveTo(firstProjected.x + panOffsetPxX, firstProjected.y + panOffsetPxY);
      for (let pointIndex = 1; pointIndex < area.points.length; pointIndex += 1) {
        const projected = projectLatLonToScope(area.points[pointIndex], viewCenter, viewRadiusNm, scopeRect);
        path.lineTo(projected.x + panOffsetPxX, projected.y + panOffsetPxY);
      }
      path.closePath();
      hasAnyPolygon = true;
    }

    if (!hasAnyPolygon) {
      continue;
    }

    if (stipplePattern) {
      ctx.fillStyle = stipplePattern;
      ctx.fill(path);
    }
    ctx.stroke(path);

    const labelAnchor = computeTfrLabelAnchor(tfr);
    if (!labelAnchor) {
      continue;
    }
    const projectedAnchor = projectLatLonToScope(labelAnchor, viewCenter, viewRadiusNm, scopeRect);
    const labelX = Math.round(projectedAnchor.x + panOffsetPxX);
    const labelY = Math.round(projectedAnchor.y + panOffsetPxY);
    const textState = tfrTextStateBySourceId.get(tfr.sourceId);
    const textVisible = textState?.visible ?? true;
    const textBlinking = textState?.blink ?? false;
    if (!textVisible) {
      continue;
    }
    const resolvedLabelColor = textBlinking && tfrBlinkDimmed ? blinkLabelColor : labelColor;
    const textSource =
      textState?.customText && textState.customText.trim().length > 0
        ? textState.customText
        : tfr.localName;
    const labelText = buildTfrOverlayLabelText(tfr.displayId, textSource);

    if (labelDrawer) {
      labelDrawer(ctx, labelX, labelY, labelText, resolvedLabelColor);
    } else {
      ctx.fillStyle = resolvedLabelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = "12px monospace";
      const lines = labelText.split("\n");
      const startY = labelY - ((lines.length - 1) * (12 + TFR_LABEL_LINE_GAP_PX)) / 2;
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        ctx.fillText(lines[lineIndex], labelX, Math.round(startY + lineIndex * (12 + TFR_LABEL_LINE_GAP_PX)));
      }
    }
  }
  ctx.restore();
}

function clampVideoMapRange(rangeNm: number): number {
  return Math.min(VIDEO_MAP_MAX_RANGE_NM, Math.max(VIDEO_MAP_MIN_RANGE_NM, rangeNm));
}

function resolveWxFetchRadiusNm(viewRangeNm: number): number {
  const padded = Math.ceil(viewRangeNm + WX_FETCH_PADDING_NM);
  return Math.min(WX_FETCH_MAX_RADIUS_NM, Math.max(WX_FETCH_MIN_RADIUS_NM, padded));
}

function touchDistancePx(touchA: Touch, touchB: Touch): number {
  const dx = touchB.clientX - touchA.clientX;
  const dy = touchB.clientY - touchA.clientY;
  return Math.hypot(dx, dy);
}

function normalizeWheelDeltaPx(event: WheelEvent): number {
  if (event.deltaMode === 1) {
    return event.deltaY * 16;
  }
  if (event.deltaMode === 2) {
    return event.deltaY * window.innerHeight;
  }
  return event.deltaY;
}

function consumeWheelStepAccumulator(
  accumulatorPx: number,
  deltaPx: number
): { steps: number; accumulatorPx: number } {
  const combined = accumulatorPx + deltaPx;
  let steps = 0;
  if (combined >= WHEEL_STEP_THRESHOLD_PX) {
    steps = Math.floor(combined / WHEEL_STEP_THRESHOLD_PX);
  } else if (combined <= -WHEEL_STEP_THRESHOLD_PX) {
    steps = Math.ceil(combined / WHEEL_STEP_THRESHOLD_PX);
  }
  return {
    steps,
    accumulatorPx: combined - steps * WHEEL_STEP_THRESHOLD_PX
  };
}

function pointInScopeRect(
  x: number,
  y: number,
  scopeRect: ScopeRect
): boolean {
  return (
    x >= scopeRect.x &&
    y >= scopeRect.y &&
    x <= scopeRect.x + scopeRect.width &&
    y <= scopeRect.y + scopeRect.height
  );
}

function toDmsNoHemisphere(value: number, degreeWidth = 3): string {
  const absolute = Math.abs(value);
  let degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  let minutes = Math.floor(minutesFloat);
  let seconds = Math.round((minutesFloat - minutes) * 60);

  if (seconds >= 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes = 0;
    degrees += 1;
  }

  return `${String(degrees).padStart(degreeWidth, "0")} ${String(minutes).padStart(2, "0")} ${String(seconds).padStart(2, "0")}`;
}

function formatPreviewCoordinate(lat: number, lon: number): string {
  return `${toDmsNoHemisphere(lat, 3)} / ${toDmsNoHemisphere(lon, 3)}`;
}

function isModifierOnlyKey(event: KeyboardEvent): boolean {
  return (
    event.key === "Shift" ||
    event.key === "Control" ||
    event.key === "Alt" ||
    event.key === "Meta" ||
    event.key === "AltGraph"
  );
}

function isAsteriskCommandKey(event: KeyboardEvent): boolean {
  if (event.key === "*" || event.key === "×") {
    return true;
  }
  if (event.code === "NumpadMultiply") {
    return true;
  }
  // Some layouts emit "+" while Shift is held for the same physical key used to type "*".
  if (event.shiftKey && event.key === "+") {
    return true;
  }
  return false;
}

function isBackslashCommandKey(event: KeyboardEvent): boolean {
  if (event.key === "\\") {
    return true;
  }
  // Layout fallback: some keyboards emit "\" using modifier combinations.
  return event.code === "Backslash" || event.code === "IntlBackslash";
}

function isPrintableCommandKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return event.key.length === 1;
}

function buildBitmapCursorCss(options: {
  rows: readonly string[];
  widthPx: number;
  heightPx: number;
  outputWidthPx: number;
  outputHeightPx: number;
  hotspotX: number;
  hotspotY: number;
  color: string;
  fallbackCursor: string;
}): string {
  if (typeof document === "undefined") {
    return options.fallbackCursor;
  }

  const cursorCanvas = document.createElement("canvas");
  cursorCanvas.width = options.outputWidthPx;
  cursorCanvas.height = options.outputHeightPx;
  const cursorCtx = cursorCanvas.getContext("2d");
  if (!cursorCtx) {
    return options.fallbackCursor;
  }
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  cursorCtx.fillStyle = options.color;

  // Downsample with max pooling so sparse source pixels remain visible at small output sizes.
  for (let y = 0; y < options.outputHeightPx; y += 1) {
    const srcY0 = Math.floor((y * options.heightPx) / options.outputHeightPx);
    const srcY1 = Math.max(
      srcY0,
      Math.ceil(((y + 1) * options.heightPx) / options.outputHeightPx) - 1
    );
    for (let x = 0; x < options.outputWidthPx; x += 1) {
      const srcX0 = Math.floor((x * options.widthPx) / options.outputWidthPx);
      const srcX1 = Math.max(
        srcX0,
        Math.ceil(((x + 1) * options.widthPx) / options.outputWidthPx) - 1
      );
      let lit = false;
      for (let srcY = srcY0; srcY <= srcY1 && !lit; srcY += 1) {
        const row = options.rows[srcY] ?? "";
        for (let srcX = srcX0; srcX <= srcX1; srcX += 1) {
          if (row.charAt(srcX) === "1") {
            lit = true;
            break;
          }
        }
      }
      if (lit) {
        cursorCtx.fillRect(x, y, 1, 1);
      }
    }
  }

  const hotspotX = Math.round((options.hotspotX * options.outputWidthPx) / options.widthPx);
  const hotspotY = Math.round((options.hotspotY * options.outputHeightPx) / options.heightPx);
  const cursorDataUrl = cursorCanvas.toDataURL("image/png");
  return `url("${cursorDataUrl}") ${hotspotX} ${hotspotY}, ${options.fallbackCursor}`;
}

function pointInRect(x: number, y: number, rect: { x: number; y: number; width: number; height: number }): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height;
}

function pickAircraftAtPoint(
  aircraftHits: readonly AircraftHitTarget[],
  x: number,
  y: number
): string | null {
  for (let i = aircraftHits.length - 1; i >= 0; i -= 1) {
    const hit = aircraftHits[i];
    if (pointInRect(x, y, hit)) {
      return hit.id;
    }
  }
  return null;
}

function bearingDegBetween(a: LatLon, b: LatLon): number {
  const lat1 = toRadians(a.lat);
  const lon1 = toRadians(a.lon);
  const lat2 = toRadians(b.lat);
  const lon2 = toRadians(b.lon);
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeHeadingDeg((Math.atan2(y, x) * 180) / Math.PI);
}

function formatBearingLabel(headingDeg: number): string {
  const rounded = Math.round(normalizeHeadingDeg(headingDeg));
  const heading = rounded === 0 ? 360 : rounded;
  return String(heading).padStart(3, "0");
}

function headingDifferenceDeg(aDeg: number, bDeg: number): number {
  const a = normalizeHeadingDeg(aDeg);
  const b = normalizeHeadingDeg(bDeg);
  const diff = Math.abs(a - b);
  return diff > 180 ? 360 - diff : diff;
}

function resolveVelocityNmPerMin(trackDeg: number, groundspeedKts: number): { x: number; y: number } {
  const unit = headingToUnitVector(normalizeHeadingDeg(trackDeg));
  const speedNmPerMin = groundspeedKts / 60;
  return {
    x: unit.x * speedNmPerMin,
    y: unit.y * speedNmPerMin
  };
}

interface PredictedMinSeparationOverlay {
  mode: "cpa" | "no-crossing";
  currentPointA: { x: number; y: number };
  currentPointB: { x: number; y: number };
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  labelLines: string[];
}

function resolvePredictedMinSeparationOverlay(
  pair: PredictedMinSeparationPair,
  aircraftById: ReadonlyMap<string, AircraftFeedItem>,
  scopeRect: ScopeRect,
  center: LatLon,
  radiusNm: number,
  panOffsetPxX: number,
  panOffsetPxY: number
): PredictedMinSeparationOverlay | null {
  const first = aircraftById.get(pair.firstAircraftId);
  const second = aircraftById.get(pair.secondAircraftId);
  if (!first || !second) {
    return null;
  }

  const projectedFirst = projectLatLonToScope(
    { lat: first.position.lat, lon: first.position.lon },
    center,
    radiusNm,
    scopeRect
  );
  const projectedSecond = projectLatLonToScope(
    { lat: second.position.lat, lon: second.position.lon },
    center,
    radiusNm,
    scopeRect
  );
  const firstCurrentPx = {
    x: projectedFirst.x + panOffsetPxX,
    y: projectedFirst.y + panOffsetPxY
  };
  const secondCurrentPx = {
    x: projectedSecond.x + panOffsetPxX,
    y: projectedSecond.y + panOffsetPxY
  };

  const currentDistanceNm = distanceNmBetween(
    { lat: first.position.lat, lon: first.position.lon },
    { lat: second.position.lat, lon: second.position.lon }
  );

  const trackA = first.trackDeg;
  const trackB = second.trackDeg;
  const speedA = first.groundspeedKts;
  const speedB = second.groundspeedKts;
  const hasValidMotion =
    trackA !== null &&
    Number.isFinite(trackA) &&
    trackB !== null &&
    Number.isFinite(trackB) &&
    speedA !== null &&
    Number.isFinite(speedA) &&
    speedA > 0 &&
    speedB !== null &&
    Number.isFinite(speedB) &&
    speedB > 0;

  if (!hasValidMotion) {
    return {
      mode: "no-crossing",
      currentPointA: firstCurrentPx,
      currentPointB: secondCurrentPx,
      pointA: firstCurrentPx,
      pointB: secondCurrentPx,
      labelLines: ["NO X-ING", `${currentDistanceNm.toFixed(2)}NM`]
    };
  }

  if (headingDifferenceDeg(trackA, trackB) <= MIN_SEPARATION_PARALLEL_TRACK_THRESHOLD_DEG) {
    return {
      mode: "no-crossing",
      currentPointA: firstCurrentPx,
      currentPointB: secondCurrentPx,
      pointA: firstCurrentPx,
      pointB: secondCurrentPx,
      labelLines: ["NO X-ING", `${currentDistanceNm.toFixed(2)}NM`]
    };
  }

  const secondRelativeNm = projectOffsetNm(
    { lat: second.position.lat, lon: second.position.lon },
    { lat: first.position.lat, lon: first.position.lon }
  );
  const velocityFirstNmPerMin = resolveVelocityNmPerMin(trackA, speedA);
  const velocitySecondNmPerMin = resolveVelocityNmPerMin(trackB, speedB);
  const relativeVelocityNmPerMin = {
    x: velocitySecondNmPerMin.x - velocityFirstNmPerMin.x,
    y: velocitySecondNmPerMin.y - velocityFirstNmPerMin.y
  };
  const relativeVelocitySq =
    relativeVelocityNmPerMin.x * relativeVelocityNmPerMin.x +
    relativeVelocityNmPerMin.y * relativeVelocityNmPerMin.y;

  if (relativeVelocitySq < MIN_SEPARATION_RELATIVE_SPEED_EPS_NM_PER_MIN ** 2) {
    return {
      mode: "no-crossing",
      currentPointA: firstCurrentPx,
      currentPointB: secondCurrentPx,
      pointA: firstCurrentPx,
      pointB: secondCurrentPx,
      labelLines: ["NO X-ING", `${currentDistanceNm.toFixed(2)}NM`]
    };
  }

  const closestTimeMinRaw =
    -(
      secondRelativeNm.x * relativeVelocityNmPerMin.x +
      secondRelativeNm.y * relativeVelocityNmPerMin.y
    ) / relativeVelocitySq;
  if (!Number.isFinite(closestTimeMinRaw) || closestTimeMinRaw <= 0) {
    return {
      mode: "no-crossing",
      currentPointA: firstCurrentPx,
      currentPointB: secondCurrentPx,
      pointA: firstCurrentPx,
      pointB: secondCurrentPx,
      labelLines: ["NO X-ING", `${currentDistanceNm.toFixed(2)}NM`]
    };
  }
  const closestTimeMin = Math.min(MIN_SEPARATION_MAX_PREDICTION_MIN, closestTimeMinRaw);

  const pixelsPerNm = Math.min(scopeRect.width, scopeRect.height) / (2 * radiusNm);
  const firstCpaPx = {
    x: firstCurrentPx.x + velocityFirstNmPerMin.x * closestTimeMin * pixelsPerNm,
    y: firstCurrentPx.y - velocityFirstNmPerMin.y * closestTimeMin * pixelsPerNm
  };
  const secondCpaPx = {
    x: secondCurrentPx.x + velocitySecondNmPerMin.x * closestTimeMin * pixelsPerNm,
    y: secondCurrentPx.y - velocitySecondNmPerMin.y * closestTimeMin * pixelsPerNm
  };

  const relativeAtClosestNm = {
    x: secondRelativeNm.x + relativeVelocityNmPerMin.x * closestTimeMin,
    y: secondRelativeNm.y + relativeVelocityNmPerMin.y * closestTimeMin
  };
  const minDistanceNm = Math.hypot(relativeAtClosestNm.x, relativeAtClosestNm.y);

  return {
    mode: "cpa",
    currentPointA: firstCurrentPx,
    currentPointB: secondCurrentPx,
    pointA: firstCpaPx,
    pointB: secondCpaPx,
    labelLines: [`${minDistanceNm.toFixed(2)}NM`]
  };
}

function drawOrientedTriangleMarker(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  directionRad: number,
  color: string
): void {
  // Build an equilateral triangle around the marker center.
  const radius = MIN_SEPARATION_TRIANGLE_SIZE_PX;
  const angleA = directionRad;
  const angleB = directionRad + (2 * Math.PI) / 3;
  const angleC = directionRad - (2 * Math.PI) / 3;
  const ax = centerX + Math.cos(angleA) * radius;
  const ay = centerY + Math.sin(angleA) * radius;
  const bx = centerX + Math.cos(angleB) * radius;
  const by = centerY + Math.sin(angleB) * radius;
  const cx = centerX + Math.cos(angleC) * radius;
  const cy = centerY + Math.sin(angleC) * radius;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
}

function drawPredictedMinSeparationOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: PredictedMinSeparationOverlay,
  toolsColor: string,
  lineHeightPx: number,
  labelDrawer?: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    color: string
  ) => void,
  labelTextMeasurer?: (text: string) => number
): void {
  const measuredLineWidths = overlay.labelLines.map((lineText) => {
    if (labelTextMeasurer) {
      return Math.max(0, labelTextMeasurer(lineText));
    }
    ctx.font = RBL_LABEL_FONT;
    return Math.max(0, ctx.measureText(lineText).width);
  });
  const maxLineWidthPx =
    measuredLineWidths.length > 0
      ? measuredLineWidths.reduce((maxWidth, width) => Math.max(maxWidth, width), 0)
      : 0;

  const midpointX = (overlay.pointA.x + overlay.pointB.x) * 0.5;
  const midpointY = (overlay.pointA.y + overlay.pointB.y) * 0.5;
  const labelStartY = Math.round(
    midpointY - ((overlay.labelLines.length - 1) * lineHeightPx) / 2
  );
  const labelRect = {
    left: midpointX - maxLineWidthPx * 0.5,
    right: midpointX + maxLineWidthPx * 0.5,
    top: labelStartY,
    bottom: labelStartY + overlay.labelLines.length * lineHeightPx
  };

  ctx.strokeStyle = toolsColor;
  ctx.lineWidth = 1;

  const drawSegmentWithLabelGap = (
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): void => {
    const dx = endX - startX;
    const dy = endY - startY;
    const segmentLengthPx = Math.hypot(dx, dy);
    if (segmentLengthPx <= 0) {
      return;
    }

    // Clip the center segment exactly around the label box so the line does not cross text.
    const p = [-dx, dx, -dy, dy];
    const q = [
      startX - labelRect.left,
      labelRect.right - startX,
      startY - labelRect.top,
      labelRect.bottom - startY
    ];
    let tEnter = 0;
    let tExit = 1;
    for (let i = 0; i < p.length; i += 1) {
      const pi = p[i];
      const qi = q[i];
      if (Math.abs(pi) < 1e-9) {
        if (qi < 0) {
          tEnter = 2;
          tExit = -1;
          break;
        }
        continue;
      }
      const ratio = qi / pi;
      if (pi < 0) {
        tEnter = Math.max(tEnter, ratio);
      } else {
        tExit = Math.min(tExit, ratio);
      }
      if (tEnter > tExit) {
        break;
      }
    }

    if (tEnter > tExit || tExit < 0 || tEnter > 1) {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      return;
    }

    const paddingT = MIN_SEPARATION_LABEL_GAP_PADDING_PX / segmentLengthPx;
    const firstEndT = Math.max(0, Math.min(1, tEnter - paddingT));
    const secondStartT = Math.max(0, Math.min(1, tExit + paddingT));
    const firstEndX = startX + dx * firstEndT;
    const firstEndY = startY + dy * firstEndT;
    const secondStartX = startX + dx * secondStartT;
    const secondStartY = startY + dy * secondStartT;

    ctx.beginPath();
    if (firstEndT > 0) {
      ctx.moveTo(startX, startY);
      ctx.lineTo(firstEndX, firstEndY);
    }
    if (secondStartT < 1) {
      ctx.moveTo(secondStartX, secondStartY);
      ctx.lineTo(endX, endY);
    }
    ctx.stroke();
  };

  if (overlay.mode === "cpa") {
    drawSegmentWithLabelGap(
      overlay.pointA.x,
      overlay.pointA.y,
      overlay.pointB.x,
      overlay.pointB.y
    );

    ctx.beginPath();
    ctx.moveTo(overlay.currentPointA.x, overlay.currentPointA.y);
    ctx.lineTo(overlay.pointA.x, overlay.pointA.y);
    ctx.moveTo(overlay.currentPointB.x, overlay.currentPointB.y);
    ctx.lineTo(overlay.pointB.x, overlay.pointB.y);
    ctx.stroke();

    drawOrientedTriangleMarker(
      ctx,
      overlay.pointA.x,
      overlay.pointA.y,
      MIN_SEPARATION_TRIANGLE_NORTH_RAD,
      toolsColor
    );
    drawOrientedTriangleMarker(
      ctx,
      overlay.pointB.x,
      overlay.pointB.y,
      MIN_SEPARATION_TRIANGLE_NORTH_RAD,
      toolsColor
    );
  } else {
    drawSegmentWithLabelGap(
      overlay.pointA.x,
      overlay.pointA.y,
      overlay.pointB.x,
      overlay.pointB.y
    );
  }

  for (let i = 0; i < overlay.labelLines.length; i += 1) {
    const lineText = overlay.labelLines[i];
    const lineY = labelStartY + i * lineHeightPx;
    const lineWidthPx = measuredLineWidths[i] ?? 0;
    const lineX = Math.round(midpointX - lineWidthPx * 0.5);
    if (labelDrawer) {
      labelDrawer(ctx, lineX, lineY, lineText, toolsColor);
    } else {
      ctx.fillStyle = toolsColor;
      ctx.font = RBL_LABEL_FONT;
      ctx.fillText(lineText, lineX, lineY);
    }
  }
}

function resolveRblEndpointLatLon(
  endpoint: RblEndpoint,
  aircraftById: ReadonlyMap<string, AircraftFeedItem>
): LatLon | null {
  if (endpoint.kind === "point") {
    return { lat: endpoint.lat, lon: endpoint.lon };
  }
  const aircraft = aircraftById.get(endpoint.aircraftId);
  if (!aircraft) {
    return null;
  }
  return {
    lat: aircraft.position.lat,
    lon: aircraft.position.lon
  };
}

function rblInvolvesAircraft(line: RangeBearingLine, aircraftId: string): boolean {
  return (
    (line.start.kind === "aircraft" && line.start.aircraftId === aircraftId) ||
    (line.end.kind === "aircraft" && line.end.aircraftId === aircraftId)
  );
}

function drawRangeBearingLines(
  ctx: CanvasRenderingContext2D,
  scopeRect: ScopeRect,
  center: LatLon | null,
  radiusNm: number | null,
  panOffsetPxX: number,
  panOffsetPxY: number,
  lines: readonly RangeBearingLine[],
  aircraftById: ReadonlyMap<string, AircraftFeedItem>,
  toolsColor: string,
  lineNumberStart = 1,
  labelDrawer?: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    color: string
  ) => void
): void {
  if (!center || radiusNm === null || radiusNm <= 0 || lines.length === 0) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(scopeRect.x, scopeRect.y, scopeRect.width, scopeRect.height);
  ctx.clip();
  ctx.strokeStyle = toolsColor;
  ctx.fillStyle = toolsColor;
  ctx.lineWidth = 1;
  if (!labelDrawer) {
    ctx.font = RBL_LABEL_FONT;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const start = resolveRblEndpointLatLon(line.start, aircraftById);
    const end = resolveRblEndpointLatLon(line.end, aircraftById);
    if (!start || !end) {
      continue;
    }

    const projectedStart = projectLatLonToScope(start, center, radiusNm, scopeRect);
    const projectedEnd = projectLatLonToScope(end, center, radiusNm, scopeRect);
    const startX = projectedStart.x + panOffsetPxX;
    const startY = projectedStart.y + panOffsetPxY;
    const endX = projectedEnd.x + panOffsetPxX;
    const endY = projectedEnd.y + panOffsetPxY;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const distanceNm = distanceNmBetween(start, end);
    const headingDeg = bearingDegBetween(start, end);
    const label = `${formatBearingLabel(headingDeg)}/${distanceNm.toFixed(2)}-${lineNumberStart + i}`;
    const startIsAircraft = line.start.kind === "aircraft";
    const endIsAircraft = line.end.kind === "aircraft";

    let anchorX = (startX + endX) * 0.5;
    let anchorY = (startY + endY) * 0.5;
    let offsetX = RBL_LABEL_MIDPOINT_OFFSET_X_PX;
    let offsetY = RBL_LABEL_MIDPOINT_OFFSET_Y_PX;

    if (startIsAircraft || endIsAircraft) {
      offsetX = RBL_LABEL_AIRCRAFT_OFFSET_X_PX;
      offsetY = RBL_LABEL_AIRCRAFT_OFFSET_Y_PX;
      if (startIsAircraft && endIsAircraft) {
        const chooseStart = startY > endY || (Math.abs(startY - endY) < 0.5 && startX >= endX);
        anchorX = chooseStart ? startX : endX;
        anchorY = chooseStart ? startY : endY;
      } else if (startIsAircraft) {
        anchorX = startX;
        anchorY = startY;
      } else {
        anchorX = endX;
        anchorY = endY;
      }
    }

    const labelX = Math.round(anchorX + offsetX);
    const labelY = Math.round(anchorY + offsetY);
    if (labelDrawer) {
      labelDrawer(ctx, labelX, labelY, label, toolsColor);
    } else {
      ctx.fillText(label, labelX, labelY);
    }
  }

  ctx.restore();
}

function isConflictAlertPair(a: AircraftFeedItem, b: AircraftFeedItem): boolean {
  if (a.altitudeAmslFt === null || b.altitudeAmslFt === null) {
    return false;
  }
  if (!a.callsign || !b.callsign) {
    return false;
  }
  const squawkA = (a.squawk ?? "").trim();
  const squawkB = (b.squawk ?? "").trim();
  if (squawkA === "1200" && squawkB === "1200") {
    return false;
  }

  const verticalFt = Math.abs(a.altitudeAmslFt - b.altitudeAmslFt);
  if (verticalFt > CA_VERTICAL_THRESHOLD_FT) {
    return false;
  }

  const lateralNm = lateralDistanceNm(a, b);
  return lateralNm < CA_LATERAL_THRESHOLD_NM;
}

function conflictAlertLabel(a: AircraftFeedItem, b: AircraftFeedItem): string {
  const callsignA = (a.callsign ?? "").trim().toUpperCase();
  const callsignB = (b.callsign ?? "").trim().toUpperCase();
  const pair = callsignA < callsignB ? `${callsignA}*${callsignB}` : `${callsignB}*${callsignA}`;
  return `${pair} CA`;
}

function collectConflictAlertPairs(aircraft: AircraftFeedItem[]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < aircraft.length; i += 1) {
    for (let j = i + 1; j < aircraft.length; j += 1) {
      const a = aircraft[i];
      const b = aircraft[j];
      if (!isConflictAlertPair(a, b)) {
        continue;
      }

      const label = conflictAlertLabel(a, b);
      if (seen.has(label)) {
        continue;
      }
      seen.add(label);
      labels.push(label);
      if (labels.length >= LA_CA_MCI_MAX_CONFLICTS) {
        return labels;
      }
    }
  }

  return labels;
}

function normalizeCallsign(raw: unknown): string | null {
  const callsign = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return callsign || null;
}

function normalizeRulesLabel(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

function normalizeBeaconCode(raw: unknown): string | null {
  const beaconCode = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return beaconCode || null;
}

function normalizeIcaoCode(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const icao = raw.trim().toUpperCase();
  if (!icao) {
    return null;
  }
  return /^[A-Z0-9]{4}$/.test(icao) ? icao : null;
}

function normalizeControllerPositionCode(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function parseAltitudeFilterTokenToFt(token: string): number | null {
  const normalized = token.trim().toUpperCase();
  if (normalized === "N99") {
    return 0;
  }
  if (!/^[0-9]{3}$/.test(normalized)) {
    return null;
  }
  const parsedHundreds = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsedHundreds) || parsedHundreds < 0) {
    return null;
  }
  return parsedHundreds * 100;
}

function parseAltitudeFilterConfigFromBuffer(buffer: string): AltitudeFilterConfig | null {
  const compact = buffer.toUpperCase().replace(/\s+/g, "");
  if (compact.length !== 12) {
    return null;
  }
  const tokens = [
    compact.slice(0, 3),
    compact.slice(3, 6),
    compact.slice(6, 9),
    compact.slice(9, 12)
  ];
  const parsedFt = tokens.map(parseAltitudeFilterTokenToFt);
  if (parsedFt.some((value) => value === null)) {
    return null;
  }
  const [unassociatedMinRaw, unassociatedMaxRaw, associatedMinRaw, associatedMaxRaw] = parsedFt as number[];
  return {
    unassociated: {
      minFt: Math.min(unassociatedMinRaw, unassociatedMaxRaw),
      maxFt: Math.max(unassociatedMinRaw, unassociatedMaxRaw)
    },
    associated: {
      minFt: Math.min(associatedMinRaw, associatedMaxRaw),
      maxFt: Math.max(associatedMinRaw, associatedMaxRaw)
    }
  };
}

function formatAltitudeFilterTokenFromFt(altitudeFt: number): string {
  if (!Number.isFinite(altitudeFt) || altitudeFt <= 0) {
    return "N99";
  }
  const hundreds = Math.max(0, Math.round(altitudeFt / 100));
  return String(hundreds).padStart(3, "0");
}

function formatAltitudeFilterLine(config: AltitudeFilterConfig | null): string {
  const resolved = config ?? DEFAULT_ALTITUDE_FILTER;
  return [
    formatAltitudeFilterTokenFromFt(resolved.unassociated.minFt),
    formatAltitudeFilterTokenFromFt(resolved.unassociated.maxFt),
    "U",
    formatAltitudeFilterTokenFromFt(resolved.associated.minFt),
    formatAltitudeFilterTokenFromFt(resolved.associated.maxFt),
    "A"
  ].join(" ");
}

function formatTowerAirportIata(airportIcao: string): string {
  const normalized = normalizeIcaoCode(airportIcao);
  if (!normalized) {
    return "";
  }
  return normalized.startsWith("K") ? normalized.slice(1) : normalized;
}

function destinationMatchesTowerAirport(
  destination: string | null,
  towerAirportIcao: string
): boolean {
  if (!destination) {
    return false;
  }
  const normalizedAirportIcao = normalizeIcaoCode(towerAirportIcao);
  if (!normalizedAirportIcao) {
    return false;
  }
  const towerAirportIata = formatTowerAirportIata(normalizedAirportIcao);
  return destination === towerAirportIata || destination === normalizedAirportIcao;
}

function chooseRandomUniqueTlIndex(used: Set<string>): string | null {
  const available: string[] = [];
  for (let i = VFR_TL_INDEX_MIN; i <= VFR_TL_INDEX_MAX; i += 1) {
    const candidate = String(i).padStart(2, "0");
    if (!used.has(candidate)) {
      available.push(candidate);
    }
  }
  if (available.length === 0) {
    return null;
  }
  return available[Math.floor(Math.random() * available.length)] ?? null;
}

function StarsApp(): ReturnType<typeof createElement> {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapCanvasRef = useRef<HTMLCanvasElement>(null);
  const webglMapRendererRef = useRef<WebGLVideoMapRenderer | null>(null);
  const rendererRef = useRef<StarsUiRenderer>(null);
  const listsRendererRef = useRef<StarsListsRenderer>(null);
  const dcbRendererRef = useRef<StarsDcbRenderer>(null);
  const wxRendererRef = useRef<StarsWxRenderer>(null);
  const blipRendererRef = useRef<RadarBlipRenderer>(null);
  const datablockRendererRef = useRef<StarsDatablockRenderer>(null);
  const headingOffsetRef = useRef<number>(0);
  const signedOnUtcRef = useRef<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.background = "black";
    document.body.style.overflow = "hidden";
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    const initialize = async (): Promise<void> => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error("Canvas mount failed.");
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Unable to initialize 2D canvas context.");
        }

        const mapCanvas = mapCanvasRef.current;
        const onMapWebGlContextLost = (event: Event): void => {
          event.preventDefault();
          webglMapRendererRef.current = null;
        };
        const onMapWebGlContextRestored = (): void => {
          if (RENDER_COMPASS_AND_DCB_ONLY || !mapCanvas) {
            return;
          }
          const recoveredRenderer = WebGLVideoMapRenderer.create(mapCanvas);
          if (!recoveredRenderer) {
            return;
          }
          webglMapRendererRef.current = recoveredRenderer;
          render();
        };
        if (!RENDER_COMPASS_AND_DCB_ONLY) {
          if (!mapCanvas) {
            console.warn("WebGL map canvas mount failed; videomap will render in 2D.");
          } else {
            const webglRenderer = WebGLVideoMapRenderer.create(mapCanvas);
            if (!webglRenderer) {
              console.warn("WebGL unavailable; videomap will render in 2D.");
            } else {
              webglMapRendererRef.current = webglRenderer;
            }
            mapCanvas.addEventListener("webglcontextlost", onMapWebGlContextLost);
            mapCanvas.addEventListener("webglcontextrestored", onMapWebGlContextRestored);
          }
        }

        const [renderer, listsRenderer, dcbRenderer, blipRenderer, datablockRenderer] = await Promise.all([
          StarsUiRenderer.create({ fontBasePath: FONT_BASE_PATH }),
          StarsListsRenderer.create({ fontBasePath: FONT_BASE_PATH }),
          StarsDcbRenderer.create({ fontBasePath: FONT_BASE_PATH }),
          RadarBlipRenderer.create(),
          StarsDatablockRenderer.create()
        ]);
        if (disposed) {
          return;
        }
        rendererRef.current = renderer;
        listsRendererRef.current = listsRenderer;
        dcbRendererRef.current = dcbRenderer;
        wxRendererRef.current = new StarsWxRenderer();
        blipRendererRef.current = blipRenderer;
        datablockRendererRef.current = datablockRenderer;

        let cssWidth = 0;
        let cssHeight = 0;
        let canvasDpr = window.devicePixelRatio || 1;
        const visualViewport = window.visualViewport ?? null;
        let resizeObserver: ResizeObserver | null = null;
        let ssaQnhInHg: number | null = null;
        let ssaMainAirportIcao = SSA_AIRPORT_ICAO;
        let controlPositionId =
          normalizeControllerPositionCode(CONTROL_POSITION_ID) ?? CONTROL_POSITION_ID;
        let ssaQnhStations: Array<{ airportIcao: string; qnhInHg: number | null }> = [];
        let towerInboundAircraftByIcao = new Map<
          string,
          Array<{
            callsign: string | null;
            aircraftTypeIcao: string | null;
          }>
        >();
        let towerAirportOrderIcaos: string[] = [TOWER_LIST_AIRPORT_ICAO_NORMALIZED];
        let selectedTowerAirportIcao = TOWER_LIST_AIRPORT_ICAO_NORMALIZED;
        let towerListAircraftRows = 5;
        const towerListDisplaysByAirport = new Map<string, TowerListDisplayState>([
          [
            selectedTowerAirportIcao,
            {
              airportIcao: selectedTowerAirportIcao,
              offsetPxX: SSA_MARGIN_LEFT_PX,
              offsetPxY: 0,
              pinned: false,
              visible: true,
              maxAircraftRows: towerListAircraftRows
            }
          ]
        ]);
        let towerAirportRef: LatLon | null = null;
        let towerAirportRefsByIcao = new Map<string, LatLon>();
        let videoMapCenterRef: LatLon | null = null;
        let videoMapHomeCenterRef: LatLon | null = null;
        let videoMapsById = new Map<number, VideoMapLines>();
        let videoMapMenuLabelsById = new Map<number, string>();
        let videoMapCurrentLabelsById = new Map<number, string>();
        let videoMapNamesById = new Map<number, string>();
        let videoMapRangeNm = VIDEO_MAP_RANGE_NM;
        let videoMapPanOffsetPxX = 0;
        let videoMapPanOffsetPxY = 0;
        let rangeRingSpacingNm = RANGE_RING_DEFAULT_SPACING_NM;
        let rangeRingCenterRef: LatLon | null = null;
        let rangeRingAdjustMode = false;
        let placeMapCenterMode = false;
        let placeRangeRingCenterMode = false;
        let leaderDirectionIndex = 0;
        let leaderLengthLevel = DATABLOCK_LEADER_DEFAULT_LEVEL;
        let leaderDirectionAdjustMode = false;
        let leaderLengthAdjustMode = false;
        let rrCntrFlashActive = false;
        let rrCntrFlashTimer: number | null = null;
        let mapsDoneFlashActive = false;
        let mapsDoneFlashTimer: number | null = null;
        let mapsClearAllFlashActive = false;
        let mapsClearAllFlashTimer: number | null = null;
        let briteDoneFlashActive = false;
        let briteDoneFlashTimer: number | null = null;
        let ssaFilterDoneFlashActive = false;
        let ssaFilterDoneFlashTimer: number | null = null;
        let siteMenuDoneFlashActive = false;
        let siteMenuDoneFlashTimer: number | null = null;
        let shiftFlashActive = false;
        let shiftFlashTimer: number | null = null;
        let dcbAuxSecondPage = false;
        let volLevel = VOL_DEFAULT_LEVEL;
        let volAdjustMode = false;
        let historyDotCount = HISTORY_DOTS_DEFAULT_COUNT;
        let historyDotCountAdjustMode = false;
        let ptlLengthMinutes = PTL_LENGTH_DEFAULT_MINUTES;
        let ptlLengthAdjustMode = false;
        let ssaFilterExpanded = false;
        let siteMenuExpanded = false;
        let ssaFilterWxLineVisible = true;
        let ssaFilterStatusLineVisible = true;
        let ssaFilterRadarModeVisible = true;
        let ssaFilterTimeVisible = true;
        let ssaFilterAltimeterVisible = true;
        let ssaFilterAltitudeFilterLineVisible = true;
        let dcbSiteOptions: DcbSiteOption[] = DEFAULT_DCB_SITE_OPTIONS.map((site) => ({ ...site }));
        let activeDcbSiteId: string = DEFAULT_DCB_SITE_OPTIONS[0]?.siteId ?? "MULTI";
        let mapsExpanded = false;
        let currentMapsListVisible = false;
        let briteExpanded = false;
        let rrBrightnessPercent = RANGE_RING_DEFAULT_BRIGHTNESS_PERCENT;
        let rrBrightnessAdjustMode = false;
        let dcbBrightnessPercent = DCB_BRIGHTNESS_DEFAULT_PERCENT;
        let dcbBrightnessAdjustMode = false;
        let mapBrightnessPercent = VIDEO_MAP_DEFAULT_BRIGHTNESS_PERCENT;
        let mapBrightnessAdjustMode = false;
        let tfrBrightnessPercent = TFR_DEFAULT_BRIGHTNESS_PERCENT;
        let tfrBrightnessAdjustMode = false;
        let compassBrightnessPercent = COMPASS_DEFAULT_BRIGHTNESS_PERCENT;
        let compassBrightnessAdjustMode = false;
        let listBrightnessPercent = LIST_DEFAULT_BRIGHTNESS_PERCENT;
        let listBrightnessAdjustMode = false;
        let toolsBrightnessPercent = TOOLS_DEFAULT_BRIGHTNESS_PERCENT;
        let toolsBrightnessAdjustMode = false;
        let blipBrightnessPercent = BLIP_DEFAULT_BRIGHTNESS_PERCENT;
        let blipBrightnessAdjustMode = false;
        let historyBrightnessPercent = HISTORY_DEFAULT_BRIGHTNESS_PERCENT;
        let historyBrightnessAdjustMode = false;
        let wxBrightnessPercent = WX_COLOR_DEFAULT_BRIGHTNESS_PERCENT;
        let wxBrightnessAdjustMode = false;
        let wxStippleBrightnessPercent = WX_STIPPLE_DEFAULT_BRIGHTNESS_PERCENT;
        let wxStippleBrightnessAdjustMode = false;
        let rrSpacingWheelAccumulatorPx = 0;
        let leaderDirectionWheelAccumulatorPx = 0;
        let leaderLengthWheelAccumulatorPx = 0;
        let rrBrightnessWheelAccumulatorPx = 0;
        let dcbBrightnessWheelAccumulatorPx = 0;
        let mapBrightnessWheelAccumulatorPx = 0;
        let tfrBrightnessWheelAccumulatorPx = 0;
        let compassBrightnessWheelAccumulatorPx = 0;
        let listBrightnessWheelAccumulatorPx = 0;
        let toolsBrightnessWheelAccumulatorPx = 0;
        let blipBrightnessWheelAccumulatorPx = 0;
        let historyBrightnessWheelAccumulatorPx = 0;
        let historyDotCountWheelAccumulatorPx = 0;
        let ptlLengthWheelAccumulatorPx = 0;
        let wxBrightnessWheelAccumulatorPx = 0;
        let wxStippleBrightnessWheelAccumulatorPx = 0;
        let volWheelAccumulatorPx = 0;
        let videoMapPanDragLast: { x: number; y: number } | null = null;
        let videoMapPanDragActive = false;
        let warnedMissingWxDcbApi = false;
        const activeMapIds = new Set<number>();
        const activeWxLevels = new Set<number>();
        const wxLevelsAvailable = new Set<number>();
        const activeTfrSourceIds = new Set<string>();
        const tfrTextStateBySourceId = new Map<string, TfrTextState>();
        let wxRadar: WxReflectivityResponse | null = null;
        let wxHistoryPlaybackRadar: WxReflectivityResponse | null = null;
        let wxHistoryPlaybackFrames: WxHistoryPlaybackFrame[] = [];
        let wxHistoryPlaybackIndex = -1;
        let wxHistoryPlaybackFrameNo: number | null = null;
        let wxHistoryPlaybackTimer: number | null = null;
        let wxZoomInteractionActive = false;
        let wxZoomInteractionTimer: number | null = null;
        let wxRefreshInFlight = false;
        let tfrDisplayRecords: TfrDisplayRecord[] = [];
        let coastSuspendCallsigns: string[] = [];
        let laCaMciConflictAlerts: string[] = [];
        let activeCaAlertLabels = new Set<string>();
        let displayedAircraft: AircraftFeedItem[] = [];
        let tcpByCallsign = new Map<string, string>();
        const ptlEnabledAircraftIds = new Set<string>();
        const expandedDatablockAircraftIds = new Set<string>();
        const cyanHighlightedAircraftIds = new Set<string>();
        let activeAltitudeFilter: AltitudeFilterConfig | null = {
          unassociated: {
            minFt: DEFAULT_ALTITUDE_FILTER.unassociated.minFt,
            maxFt: DEFAULT_ALTITUDE_FILTER.unassociated.maxFt
          },
          associated: {
            minFt: DEFAULT_ALTITUDE_FILTER.associated.minFt,
            maxFt: DEFAULT_ALTITUDE_FILTER.associated.maxFt
          }
        };
        const altitudeFilteredAircraftIds = new Set<string>();
        const altitudeFilterManualRevealAircraftIds = new Set<string>();
        let datablockHitRegions: DatablockHitRegion[] = [];
        let mvaSectors: MvaSector[] = [];
        let approachExemptionCorridors: ApproachExemptionCorridor[] = [];
        const flightRulesByCallsign = new Map<string, FlightRuleState>();
        const vfrEntriesByCallsign = new Map<string, { index: string; beaconCode: string | null }>();
        const vfrUsedTlIndices = new Set<string>();
        let vfrListEntries: Array<{ index: string; callsign: string; squawk: string | null }> = [];
        let aircraftHitTargets: AircraftHitTarget[] = [];
        let rblLines: RangeBearingLine[] = [];
        let rblTriggerArmed = false;
        let rblCommandActive = false;
        let rblFirstSelection: RblEndpoint | null = null;
        let rblSecondSelection: RblEndpoint | null = null;
        let rblDeleteIndexBuffer = "";
        let rblPreviewCursorPx: { x: number; y: number } | null = null;
        let predictedMinSepCommandActive = false;
        let predictedMinSepFirstAircraftId: string | null = null;
        let predictedMinSepPair: PredictedMinSeparationPair | null = null;
        let ssaListOffsetPxX = SSA_MARGIN_LEFT_PX;
        let ssaListOffsetPxY = SSA_MARGIN_TOP_PX;
        let signOnListVisible = true;
        let signOnListOffsetPxX = 0;
        let signOnListOffsetPxY = 0;
        let signOnListPinned = false;
        let coastSuspendListVisible = true;
        let coastSuspendListOffsetPxX = 0;
        let coastSuspendListOffsetPxY = 0;
        let coastSuspendListPinned = false;
        let laCaMciListVisible = true;
        let laCaMciListOffsetPxX = 0;
        let laCaMciListOffsetPxY = 0;
        let laCaMciListPinned = false;
        let flightPlanListVisible = true;
        let flightPlanListOffsetPxX = SSA_MARGIN_LEFT_PX;
        let flightPlanListOffsetPxY = 0;
        let flightPlanListPinned = false;
        let vfrListVisible = true;
        let vfrListOffsetPxX = SSA_MARGIN_LEFT_PX;
        let vfrListOffsetPxY = 0;
        let vfrListPinned = false;
        let geoRestrictionsListVisible = false;
        let geoRestrictionsListOffsetPxX = 0;
        let geoRestrictionsListOffsetPxY = 0;
        let geoRestrictionsListPinned = false;
        let f7CommandArmed = false;
        let f7CoordCommandPending = false;
        let f7GeoRestrictionsCommandPending = false;
        let f7WxCommandPending = false;
        let f7WxHistoryConfirmPending = false;
        let f7AltitudeFilterCommandPending = false;
        let f7AltitudeFilterBuffer = "";
        let f7PtlToggleClickPending = false;
        let coordPreviewClickPending = false;
        let coordPreviewVisible = false;
        let coordPreviewText = "";
        let ssaMoveClickPending = false;
        let signOnMoveClickPending = false;
        let coastSuspendMoveClickPending = false;
        let laCaMciMoveClickPending = false;
        let flightPlanMoveClickPending = false;
        let towerMoveClickPending = false;
        let towerCommandAirportIdBuffer = "";
        let towerCommandLineCountBuffer = "";
        let towerCommandCollectingLineCount = false;
        let vfrMoveClickPending = false;
        let geoRestrictionsMoveClickPending = false;
        let geoRestrictionsTogglePending = false;
        let ctrlF3CommandArmed = false;
        let ctrlF3ClearMapsPending = false;
        let ctrlF3MapTogglePending = false;
        let ctrlF3MapIdBuffer = "";
        let ctrlF4CommandArmed = false;
        let ctrlF4WxLevelBuffer = "";
        let f12CommandArmed = false;
        let f12RestrictionCommandPending = false;
        let f12RestrictionIdBuffer = "";
        let f12RestrictionCommandMode: "enable" | "disable" | null = null;
        let f12TfrTextCommandState: F12TfrTextCommandState | null = null;
        let invalidCommandErrorPending = false;
        let touchPinchState: TouchPinchState | null = null;
        let flightRulesEventSource: EventSource | null = null;
        const caAlertAudio =
          typeof Audio === "function" ? new Audio(CA_ALERT_AUDIO_PATH) : null;
        const errorAlertAudio =
          typeof Audio === "function" ? new Audio(ERROR_ALERT_AUDIO_PATH) : null;
        if (caAlertAudio) {
          caAlertAudio.preload = "auto";
          caAlertAudio.volume = volLevel / VOL_MAX_LEVEL;
          caAlertAudio.addEventListener("error", () => {
            console.warn("CA alert audio failed to load:", CA_ALERT_AUDIO_PATH, caAlertAudio.error);
          });
        }
        if (errorAlertAudio) {
          errorAlertAudio.preload = "auto";
          errorAlertAudio.volume = volLevel / VOL_MAX_LEVEL;
          errorAlertAudio.addEventListener("error", () => {
            console.warn("Error alert audio failed to load:", ERROR_ALERT_AUDIO_PATH, errorAlertAudio.error);
          });
        }
        const radarScopeCursorCss = buildBitmapCursorCss({
          rows: STARS_SPECIAL_CURSOR_ROWS,
          widthPx: STARS_SPECIAL_CURSOR_WIDTH_PX,
          heightPx: STARS_SPECIAL_CURSOR_HEIGHT_PX,
          outputWidthPx: STARS_SPECIAL_CURSOR_OUTPUT_WIDTH_PX,
          outputHeightPx: STARS_SPECIAL_CURSOR_OUTPUT_HEIGHT_PX,
          hotspotX: STARS_SPECIAL_CURSOR_HOTSPOT_X,
          hotspotY: STARS_SPECIAL_CURSOR_HOTSPOT_Y,
          color: STARS_SPECIAL_CURSOR_COLOR,
          fallbackCursor: RADAR_SCOPE_CURSOR_FALLBACK
        });

        const getScopeRect = (): ScopeRect => ({
          x: SCOPE_MARGIN_X_PX,
          y: DCB_RESERVED_HEIGHT_PX,
          width: Math.max(1, cssWidth - SCOPE_MARGIN_X_PX * 2),
          height: Math.max(1, cssHeight - DCB_RESERVED_HEIGHT_PX - SCOPE_MARGIN_BOTTOM_PX)
        });

        const updateCanvasCursorAtPoint = (pointerX: number, pointerY: number): void => {
          const nextCursor = pointInScopeRect(pointerX, pointerY, getScopeRect())
            ? radarScopeCursorCss
            : NON_SCOPE_CURSOR;
          if (canvas.style.cursor !== nextCursor) {
            canvas.style.cursor = nextCursor;
          }
        };

        const syncCanvasSize = (): boolean => {
          const rect = canvas.getBoundingClientRect();
          const viewportScale = visualViewport?.scale ?? 1;
          const viewportWidth = visualViewport
            ? visualViewport.width * viewportScale
            : rect.width;
          const viewportHeight = visualViewport
            ? visualViewport.height * viewportScale
            : rect.height;
          const rawCssWidth = Math.max(viewportWidth, window.innerWidth || 0);
          const rawCssHeight = Math.max(viewportHeight, window.innerHeight || 0);
          const nextCssWidth = Math.max(1, Math.round(rawCssWidth));
          const nextCssHeight = Math.max(1, Math.round(rawCssHeight));
          const baseDpr = Math.max(1, (window.devicePixelRatio || 1) / viewportScale);
          let nextDpr = baseDpr;
          let nextWidth = Math.max(1, Math.floor(nextCssWidth * nextDpr));
          let nextHeight = Math.max(1, Math.floor(nextCssHeight * nextDpr));

          const totalPixels = nextWidth * nextHeight;
          if (totalPixels > MAX_CANVAS_PIXELS) {
            const scale = Math.sqrt(MAX_CANVAS_PIXELS / totalPixels);
            nextDpr = Math.max(0.5, baseDpr * scale);
            nextWidth = Math.max(1, Math.floor(nextCssWidth * nextDpr));
            nextHeight = Math.max(1, Math.floor(nextCssHeight * nextDpr));
          }

          const maxDim = Math.max(nextWidth, nextHeight);
          if (maxDim > MAX_CANVAS_DIMENSION) {
            const scale = MAX_CANVAS_DIMENSION / maxDim;
            nextDpr = Math.max(0.5, nextDpr * scale);
            nextWidth = Math.max(1, Math.floor(nextCssWidth * nextDpr));
            nextHeight = Math.max(1, Math.floor(nextCssHeight * nextDpr));
          }

          const changed =
            nextCssWidth !== cssWidth ||
            nextCssHeight !== cssHeight ||
            nextDpr !== canvasDpr ||
            nextWidth !== canvas.width ||
            nextHeight !== canvas.height;

          if (!changed) {
            return false;
          }

          cssWidth = nextCssWidth;
          cssHeight = nextCssHeight;
          canvasDpr = nextDpr;
          canvas.width = nextWidth;
          canvas.height = nextHeight;
          if (mapCanvas) {
            mapCanvas.width = nextWidth;
            mapCanvas.height = nextHeight;
          }
          ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
          return true;
        };

        const getDefaultRangeRingCenter = (): LatLon | null =>
          videoMapCenterRef ?? towerAirportRef;

        const getDefaultVideoMapCenter = (): LatLon | null =>
          videoMapHomeCenterRef ?? towerAirportRef ?? videoMapCenterRef;

        const isVideoMapOffCenter = (): boolean => {
          if (
            Math.abs(videoMapPanOffsetPxX) > VIDEO_MAP_OFF_CENTER_PAN_THRESHOLD_PX ||
            Math.abs(videoMapPanOffsetPxY) > VIDEO_MAP_OFF_CENTER_PAN_THRESHOLD_PX
          ) {
            return true;
          }
          const defaultCenter = getDefaultVideoMapCenter();
          if (!defaultCenter || !videoMapCenterRef) {
            return false;
          }
          return (
            distanceNmBetween(videoMapCenterRef, defaultCenter) >
            VIDEO_MAP_OFF_CENTER_DISTANCE_THRESHOLD_NM
          );
        };

        const getDcbMapsInput = (): DcbMapCategoryInput =>
          buildDcbMapsCategory(
            activeMapIds,
            videoMapRangeNm,
            rangeRingSpacingNm,
            rangeRingAdjustMode,
            placeMapCenterMode,
            isVideoMapOffCenter(),
            placeRangeRingCenterMode,
            rrCntrFlashActive,
            mapsExpanded
          );

        const getDcbMapsMenuInput = (): DcbMapsMenuInput =>
          buildDcbMapsMenu(
            activeMapIds,
            videoMapMenuLabelsById,
            mapsExpanded,
            mapsDoneFlashActive,
            mapsClearAllFlashActive,
            currentMapsListVisible
          );

        const getLeaderDirection = (): DatablockLeaderDirection =>
          DATABLOCK_LEADER_DIRECTIONS[leaderDirectionIndex] ?? "N";

        const getDcbBriteInput = (): DcbBriteInput =>
          buildDcbBriteInput(
            briteExpanded,
            briteDoneFlashActive,
            rrBrightnessPercent,
            rrBrightnessAdjustMode,
            dcbBrightnessPercent,
            dcbBrightnessAdjustMode,
            mapBrightnessPercent,
            mapBrightnessAdjustMode,
            tfrBrightnessPercent,
            tfrBrightnessAdjustMode,
            compassBrightnessPercent,
            compassBrightnessAdjustMode,
            listBrightnessPercent,
            listBrightnessAdjustMode,
            toolsBrightnessPercent,
            toolsBrightnessAdjustMode,
            blipBrightnessPercent,
            blipBrightnessAdjustMode,
            historyBrightnessPercent,
            historyBrightnessAdjustMode,
            wxBrightnessPercent,
            wxBrightnessAdjustMode,
            wxStippleBrightnessPercent,
            wxStippleBrightnessAdjustMode
          );

        const getDcbLeaderControlsInput = (): DcbLeaderControlsInput =>
          buildDcbLeaderControls(
            getLeaderDirection(),
            leaderLengthLevel,
            leaderDirectionAdjustMode,
            leaderLengthAdjustMode
          );
        const getDcbAuxControlsInput = (): DcbAuxControlsInput =>
          buildDcbAuxControlsInput(
            dcbAuxSecondPage,
            volLevel,
            volAdjustMode,
            historyDotCount,
            historyDotCountAdjustMode,
            ptlLengthMinutes,
            ptlLengthAdjustMode,
            shiftFlashActive,
            ssaFilterExpanded,
            siteMenuExpanded,
            normalizeSelectableSiteId(activeDcbSiteId) ?? "MULTI"
          );
        const getDcbSiteMenuInput = (): DcbSiteMenuInput =>
          buildDcbSiteMenuInput(
            siteMenuExpanded,
            siteMenuDoneFlashActive,
            dcbSiteOptions,
            activeDcbSiteId
          );
        const getDcbSsaFilterInput = (): DcbSsaFilterInput =>
          buildDcbSsaFilterInput(
            ssaFilterExpanded,
            ssaFilterDoneFlashActive,
            ssaFilterWxLineVisible,
            ssaFilterStatusLineVisible,
            ssaFilterRadarModeVisible,
            ssaFilterTimeVisible,
            ssaFilterAltimeterVisible,
            ssaFilterAltitudeFilterLineVisible
          );

        const getLeaderLineLengthPx = (): number => leaderLengthLevelToLinePx(leaderLengthLevel);
        const getLeaderLayoutLengthPx = (): number => leaderLengthLevelToLayoutPx(leaderLengthLevel);

        const resetRblCommand = (): void => {
          rblTriggerArmed = false;
          rblCommandActive = false;
          rblFirstSelection = null;
          rblSecondSelection = null;
          rblDeleteIndexBuffer = "";
          rblPreviewCursorPx = null;
        };

        const resolveRblSelectionFromClick = (clickX: number, clickY: number): RblEndpoint | null => {
          const hitAircraftId = pickAircraftAtPoint(aircraftHitTargets, clickX, clickY);
          if (hitAircraftId) {
            return {
              kind: "aircraft",
              aircraftId: hitAircraftId
            };
          }

          const center = resolveWxCenter();
          if (!center) {
            return null;
          }
          const scopeRect = getScopeRect();
          const unprojected = unprojectScopeToLatLon(
            { x: clickX, y: clickY },
            center,
            videoMapRangeNm,
            scopeRect,
            videoMapPanOffsetPxX,
            videoMapPanOffsetPxY
          );
          if (!unprojected) {
            return null;
          }
          return {
            kind: "point",
            lat: unprojected.lat,
            lon: unprojected.lon
          };
        };

        const rebuildVfrListEntries = (): void => {
          const entries: Array<{ index: string; callsign: string; squawk: string | null }> = [];
          for (const [callsign, value] of vfrEntriesByCallsign.entries()) {
            entries.push({
              index: value.index,
              callsign,
              squawk: value.beaconCode
            });
          }
          entries.sort((a, b) => a.index.localeCompare(b.index));
          vfrListEntries = entries;
        };

        const resolveWxCenter = (): LatLon | null => videoMapCenterRef ?? towerAirportRef;

        const updateWxAvailability = (response: WxReflectivityResponse): void => {
          wxLevelsAvailable.clear();

          if (Array.isArray(response.observedLevels)) {
            for (let i = 0; i < response.observedLevels.length; i += 1) {
              const level = response.observedLevels[i];
              if (level >= 1 && level <= 6) {
                wxLevelsAvailable.add(level);
              }
            }
            return;
          }

          const normalizedMaxLevel = Math.max(
            0,
            Math.min(
              6,
              Math.floor(
                response.maxLevelAll ??
                  response.maxPrecipLevel ??
                  0
              )
            )
          );
          if (normalizedMaxLevel > 0) {
            for (let level = 1; level <= normalizedMaxLevel; level += 1) {
              wxLevelsAvailable.add(level);
            }
            return;
          }

          for (let i = 0; i < response.levels.length; i += 1) {
            const level = response.levels[i];
            if (level >= 1 && level <= 6) {
              wxLevelsAvailable.add(level);
              if (wxLevelsAvailable.size === 6) {
                break;
              }
            }
          }
        };

        const refreshWxRadar = async (force = false): Promise<void> => {
          const center = resolveWxCenter();
          if (!center || wxRefreshInFlight) {
            return;
          }

          const requestedRadiusNm = resolveWxFetchRadiusNm(videoMapRangeNm);
          if (
            !force &&
            wxRadar &&
            Math.abs(wxRadar.center.lat - center.lat) < 1e-6 &&
            Math.abs(wxRadar.center.lon - center.lon) < 1e-6 &&
            wxRadar.radiusNm >= requestedRadiusNm
          ) {
            return;
          }

          wxRefreshInFlight = true;
          try {
            const response = await fetchWxReflectivity(center, {
              baseUrl: API_BASE_URL,
              radiusNm: requestedRadiusNm
            });
            if (disposed) {
              return;
            }
            wxRadar = response;
            updateWxAvailability(response);
            render();
          } catch (wxError) {
            console.error("Failed to refresh WX radar:", wxError);
          } finally {
            wxRefreshInFlight = false;
          }
        };

        const ensureWxCoverageForCurrentRange = (): void => {
          const neededRadiusNm = resolveWxFetchRadiusNm(videoMapRangeNm);
          if (!wxRadar || wxRadar.radiusNm < neededRadiusNm) {
            void refreshWxRadar(true);
          }
        };

        let renderScheduled = false;

        const renderNow = (): void => {
          if (!rendererRef.current) {
            return;
          }
          syncCanvasSize();

          const scopeRect = getScopeRect();
          const rightListsLeftX = scopeRect.x + scopeRect.width - RIGHT_LISTS_LEFT_FROM_RIGHT_PX;
          const ssaListX = scopeRect.x + ssaListOffsetPxX;
          const ssaListY = scopeRect.y + ssaListOffsetPxY;
          const defaultCoastSuspendListX = rightListsLeftX;
          const defaultCoastSuspendListY =
            scopeRect.y + Math.round(scopeRect.height * 0.5) - RIGHT_LISTS_VERTICAL_NUDGE_UP_PX;
          if (!coastSuspendListPinned) {
            coastSuspendListOffsetPxX = Math.round(defaultCoastSuspendListX - scopeRect.x);
            coastSuspendListOffsetPxY = Math.round(defaultCoastSuspendListY - scopeRect.y);
          }
          const coastSuspendListX = scopeRect.x + coastSuspendListOffsetPxX;
          const coastSuspendListY = scopeRect.y + coastSuspendListOffsetPxY;
          const defaultLaCaMciListX = rightListsLeftX;
          const defaultLaCaMciListY =
            scopeRect.y +
            scopeRect.height -
            LA_CA_MCI_MARGIN_BOTTOM_PX -
            RIGHT_LISTS_VERTICAL_NUDGE_UP_PX;
          if (!laCaMciListPinned) {
            laCaMciListOffsetPxX = Math.round(defaultLaCaMciListX - scopeRect.x);
            laCaMciListOffsetPxY = Math.round(defaultLaCaMciListY - scopeRect.y);
          }
          const laCaMciListX = scopeRect.x + laCaMciListOffsetPxX;
          const laCaMciListY = scopeRect.y + laCaMciListOffsetPxY;
          const defaultSignOnListX = scopeRect.x + scopeRect.width - CONTROL_POSITION_MARGIN_RIGHT_PX;
          const defaultSignOnListY = scopeRect.y + SSA_MARGIN_TOP_PX + SSA_FIRST_TEXT_ROW_OFFSET_PX;
          if (!signOnListPinned) {
            signOnListOffsetPxX = Math.round(defaultSignOnListX - scopeRect.x);
            signOnListOffsetPxY = Math.round(defaultSignOnListY - scopeRect.y);
          }
          const signOnListX = scopeRect.x + signOnListOffsetPxX;
          const signOnListY = scopeRect.y + signOnListOffsetPxY;
          const defaultTowerListY = scopeRect.y + Math.round(scopeRect.height * TOWER_LIST_TOP_RATIO);
          const listsLineHeightPx = listsRendererRef.current?.getLineHeight() ?? 14;
          const primaryTowerDisplay =
            towerListDisplaysByAirport.get(selectedTowerAirportIcao) ??
            Array.from(towerListDisplaysByAirport.values()).find((towerDisplay) => towerDisplay.visible) ??
            towerListDisplaysByAirport.values().next().value ??
            null;
          const primaryTowerRows = primaryTowerDisplay?.maxAircraftRows ?? towerListAircraftRows;
          const towerLineCount = 1 + Math.max(0, primaryTowerRows);
          const flightPlanLineCount = 1;
          const defaultFlightPlanListY =
            defaultTowerListY - (flightPlanLineCount + FLIGHT_PLAN_LIST_GAP_LINES) * listsLineHeightPx;
          if (!flightPlanListPinned) {
            flightPlanListOffsetPxY = Math.round(defaultFlightPlanListY - scopeRect.y);
          }
          const flightPlanListX = scopeRect.x + flightPlanListOffsetPxX;
          const flightPlanListY = scopeRect.y + flightPlanListOffsetPxY;
          const defaultVfrListY =
            defaultTowerListY + (towerLineCount + VFR_LIST_GAP_LINES) * listsLineHeightPx;
          if (!vfrListPinned) {
            vfrListOffsetPxY = Math.round(defaultVfrListY - scopeRect.y);
          }
          const vfrListX = scopeRect.x + vfrListOffsetPxX;
          const vfrListY = scopeRect.y + vfrListOffsetPxY;
          const compassColor = compassBrightnessPercentToColor(compassBrightnessPercent);
          const listColor = listBrightnessPercentToColor(listBrightnessPercent);
          const listRedColor = listBrightnessPercentToRedColor(listBrightnessPercent);
          const listSsaWxColor = listBrightnessPercentToSsaWxColor(listBrightnessPercent);
          const toolsColor = toolsBrightnessPercentToColor(toolsBrightnessPercent);
          const ptlColor = ptlBrightnessPercentToColor(toolsBrightnessPercent);
          const blipColor = blipBrightnessPercentToColor(blipBrightnessPercent);
          const historyColors = historyBrightnessPercentToColors(historyBrightnessPercent);
          const wxFillColors = wxBrightnessPercentToFillColors(wxBrightnessPercent);
          const dcbButtonToneColors = dcbBrightnessPercentToButtonToneColors(dcbBrightnessPercent);
          const listsRuntime = listsRendererRef.current as unknown as {
            setGreenColor?: (color: string) => void;
            setRedColor?: (color: string) => void;
            setSsaWxColor?: (color: string) => void;
          } | null;
          listsRuntime?.setGreenColor?.(listColor);
          listsRuntime?.setRedColor?.(listRedColor);
          listsRuntime?.setSsaWxColor?.(listSsaWxColor);
          blipRendererRef.current?.setSearchTargetBlueColor(blipColor);
          blipRendererRef.current?.setHistoryDotColors(historyColors);

          const drawDcb = (): void => {
            dcbRendererRef.current?.setButtonToneColors(dcbButtonToneColors);
            const auxControlsDrawer = dcbRendererRef.current as unknown as {
              drawAuxControls?: (ctxArg: CanvasRenderingContext2D, input: DcbAuxControlsInput) => void;
            } | null;
            if (dcbAuxSecondPage) {
              if (auxControlsDrawer && typeof auxControlsDrawer.drawAuxControls === "function") {
                auxControlsDrawer.drawAuxControls(ctx, getDcbAuxControlsInput());
              }
              return;
            }

            dcbRendererRef.current?.drawMapsCategory(ctx, getDcbMapsInput());
            const wxDrawer = dcbRendererRef.current as unknown as {
              drawWxLevels?: (ctxArg: CanvasRenderingContext2D, input: DcbWxLevelsInput) => void;
            } | null;
            if (wxDrawer && typeof wxDrawer.drawWxLevels === "function") {
              wxDrawer.drawWxLevels(ctx, buildDcbWxLevels(activeWxLevels, wxLevelsAvailable));
            } else if (!warnedMissingWxDcbApi) {
              warnedMissingWxDcbApi = true;
              console.warn("DCB WX API is missing in runtime module. Hard-refresh to load latest dcb.js.");
            }
            const ldrDrawer = dcbRendererRef.current as unknown as {
              drawLeaderControls?: (ctxArg: CanvasRenderingContext2D, input: DcbLeaderControlsInput) => void;
            } | null;
            if (ldrDrawer && typeof ldrDrawer.drawLeaderControls === "function") {
              ldrDrawer.drawLeaderControls(ctx, getDcbLeaderControlsInput());
            }
            if (auxControlsDrawer && typeof auxControlsDrawer.drawAuxControls === "function") {
              auxControlsDrawer.drawAuxControls(ctx, getDcbAuxControlsInput());
            }
            const briteDrawer = dcbRendererRef.current as unknown as {
              drawBrite?: (ctxArg: CanvasRenderingContext2D, input: DcbBriteInput) => void;
            } | null;
            if (briteDrawer && typeof briteDrawer.drawBrite === "function") {
              briteDrawer.drawBrite(ctx, getDcbBriteInput());
            }
            const mapsMenuDrawer = dcbRendererRef.current as unknown as {
              drawMapsMenu?: (ctxArg: CanvasRenderingContext2D, input: DcbMapsMenuInput) => void;
            } | null;
            if (mapsMenuDrawer && typeof mapsMenuDrawer.drawMapsMenu === "function") {
              mapsMenuDrawer.drawMapsMenu(ctx, getDcbMapsMenuInput());
            }
            const ssaFilterDrawer = dcbRendererRef.current as unknown as {
              drawSsaFilterMenu?: (ctxArg: CanvasRenderingContext2D, input: DcbSsaFilterInput) => void;
            } | null;
            if (ssaFilterDrawer && typeof ssaFilterDrawer.drawSsaFilterMenu === "function") {
              ssaFilterDrawer.drawSsaFilterMenu(ctx, getDcbSsaFilterInput());
            }
            const siteMenuDrawer = dcbRendererRef.current as unknown as {
              drawSiteMenu?: (ctxArg: CanvasRenderingContext2D, input: DcbSiteMenuInput) => void;
            } | null;
            if (siteMenuDrawer && typeof siteMenuDrawer.drawSiteMenu === "function") {
              siteMenuDrawer.drawSiteMenu(ctx, getDcbSiteMenuInput());
            }
          };

          if (RENDER_COMPASS_AND_DCB_ONLY) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            rendererRef.current.drawRadarScope(ctx, scopeRect, { fillBackground: true, drawBorder: false });
            rendererRef.current.drawCompassRose(ctx, scopeRect, {
              headingOffsetDeg: headingOffsetRef.current ?? 0,
              magneticVariation: "13W",
              edgeInsetPx: 0,
              minorTickStepDeg: 5,
              majorTickStepDeg: 10,
              labelStepDeg: 10,
              minorTickLengthPx: COMPASS_MINOR_TICK_LENGTH_PX,
              majorTickLengthPx: COMPASS_MAJOR_TICK_LENGTH_PX,
              labelInsetPx: 6,
              labelVerticalNudgePx: 2,
              tickColor: compassColor,
              textColor: compassColor
            });
            rendererRef.current.drawRadarScope(ctx, scopeRect, { fillBackground: false, drawBorder: true });
            drawDcb();
            return;
          }

          const mapRenderer = webglMapRendererRef.current;
          if (mapRenderer) {
            mapRenderer.draw({
              scopeRect,
              center: videoMapCenterRef,
              radiusNm: videoMapRangeNm,
              panOffsetPxX: videoMapPanOffsetPxX,
              panOffsetPxY: videoMapPanOffsetPxY,
              brightnessPercent: mapBrightnessPercent,
              activeMapIds,
              videoMapsById,
              canvasCssHeight: cssHeight,
              canvasPixelWidth: canvas.width,
              canvasPixelHeight: canvas.height,
              canvasDpr
            });
          }

          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          rendererRef.current.drawRadarScope(ctx, scopeRect, { fillBackground: true, drawBorder: false });

          wxRendererRef.current?.draw(ctx, {
            scopeRect,
            viewCenter: resolveWxCenter(),
            viewRadiusNm: videoMapRangeNm,
            panOffsetPxX: videoMapPanOffsetPxX,
            panOffsetPxY: videoMapPanOffsetPxY,
            activeLevels: activeWxLevels,
            radar: getWxRadarForDraw(),
            lowLevelFillColor: wxFillColors.low,
            highLevelFillColor: wxFillColors.high,
            stippleBrightnessPercent: wxStippleBrightnessPercent,
            zoomInteractionActive: wxZoomInteractionActive
          });

          rendererRef.current.drawCompassRose(ctx, scopeRect, {
            headingOffsetDeg: headingOffsetRef.current ?? 0,
            magneticVariation: "13W",
            edgeInsetPx: 0,
            minorTickStepDeg: 5,
            majorTickStepDeg: 10,
            labelStepDeg: 10,
            minorTickLengthPx: COMPASS_MINOR_TICK_LENGTH_PX,
            majorTickLengthPx: COMPASS_MAJOR_TICK_LENGTH_PX,
            labelInsetPx: 6,
            labelVerticalNudgePx: 2,
            tickColor: compassColor,
            textColor: compassColor
          });

          drawRangeRings(
            ctx,
            scopeRect,
            videoMapCenterRef,
            videoMapRangeNm,
            videoMapPanOffsetPxX,
            videoMapPanOffsetPxY,
            rangeRingCenterRef,
            rangeRingSpacingNm,
            rrBrightnessPercent
          );

          if (mapRenderer && mapCanvas) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(scopeRect.x, scopeRect.y, scopeRect.width, scopeRect.height);
            ctx.clip();
            ctx.drawImage(mapCanvas, 0, 0, cssWidth, cssHeight);
            ctx.restore();
          } else {
            drawSelectedVideoMaps(
              ctx,
              scopeRect,
              videoMapCenterRef,
              videoMapRangeNm,
              videoMapPanOffsetPxX,
              videoMapPanOffsetPxY,
              mapBrightnessPercent,
              activeMapIds,
              videoMapsById
            );
          }

          const tfrOverlayColor = scaleRgbCssColor(starsColors.YELLOW, tfrBrightnessPercent, {
            r: 255,
            g: 255,
            b: 0
          });
          const tfrOverlayBlinkColor = scaleRgbCssColor(starsColors.YELLOW, 10, {
            r: 255,
            g: 255,
            b: 0
          });
          const tfrBlinkDimmed =
            Math.floor(Date.now() / TFR_LABEL_BLINK_HALF_CYCLE_MS) % 2 === 0;
          drawActiveTfrOverlays(
            ctx,
            scopeRect,
            resolveWxCenter(),
            videoMapRangeNm,
            videoMapPanOffsetPxX,
            videoMapPanOffsetPxY,
            tfrDisplayRecords,
            activeTfrSourceIds,
            tfrTextStateBySourceId,
            tfrBlinkDimmed,
            tfrOverlayColor,
            getRestrictionAreaStipplePattern(ctx, tfrOverlayColor, TFR_STIPPLE_ALPHA),
            tfrOverlayColor,
            tfrOverlayBlinkColor,
            (ctxArg, x, y, text, color) => {
              const renderer = listsRendererRef.current;
              if (!renderer) {
                return;
              }
              const lines = text.split("\n");
              const lineHeight = renderer.getLineHeight();
              const startY = Math.round(
                y - ((lines.length - 1) * (lineHeight + TFR_LABEL_LINE_GAP_PX)) / 2
              );
              for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
                const line = lines[lineIndex];
                const lineWidth = renderer.measureTextWidth(line);
                const lineX = Math.round(x - lineWidth / 2);
                const lineY = Math.round(startY + lineIndex * (lineHeight + TFR_LABEL_LINE_GAP_PX));
                renderer.drawText(ctxArg, lineX, lineY, line, color);
              }
            }
          );

          const blipRenderer = blipRendererRef.current;
          const datablockRenderer = datablockRendererRef.current;
          const radarCenter = resolveWxCenter();
          aircraftHitTargets = [];
          if (blipRenderer && datablockRenderer && radarCenter && videoMapRangeNm > 0) {
            const aircraftToDraw = displayedAircraft;
            datablockHitRegions = [];
            const leaderDirection = getLeaderDirection();
            const leaderLineLengthPx = getLeaderLineLengthPx();
            const leaderLayoutLengthPx = getLeaderLayoutLengthPx();
            const pixelsPerNm = Math.min(scopeRect.width, scopeRect.height) / (2 * videoMapRangeNm);
            const primaryTargetBodyShape: "circle" | "track-perpendicular-rectangle" =
              normalizeSelectableSiteId(activeDcbSiteId) === "MULTI"
                ? "track-perpendicular-rectangle"
                : "circle";

            ctx.save();
            ctx.beginPath();
            ctx.rect(scopeRect.x, scopeRect.y, scopeRect.width, scopeRect.height);
            ctx.clip();

            const aircraftById = new Map(displayedAircraft.map((aircraft) => [aircraft.id, aircraft]));
            const drawRblLabel = (
              ctxArg: CanvasRenderingContext2D,
              x: number,
              y: number,
              text: string,
              color: string
            ): void => {
              const listsRuntime = listsRendererRef.current as unknown as {
                drawText?: (
                  ctx: CanvasRenderingContext2D,
                  x: number,
                  y: number,
                  text: string,
                  color: string
                ) => void;
              } | null;
              if (typeof listsRuntime?.drawText === "function") {
                listsRuntime.drawText(ctxArg, x, y, text, color);
                return;
              }
              ctxArg.fillStyle = color;
              ctxArg.font = RBL_LABEL_FONT;
              ctxArg.fillText(text, Math.round(x), Math.round(y));
            };
            const measureRblLabelWidth = (text: string): number => {
              const listsRuntime = listsRendererRef.current as unknown as {
                measureTextWidth?: (text: string) => number;
              } | null;
              if (typeof listsRuntime?.measureTextWidth === "function") {
                return Math.max(0, listsRuntime.measureTextWidth(text));
              }
              ctx.font = RBL_LABEL_FONT;
              return Math.max(0, ctx.measureText(text).width);
            };

            drawRangeBearingLines(
              ctx,
              scopeRect,
              resolveWxCenter(),
              videoMapRangeNm,
              videoMapPanOffsetPxX,
              videoMapPanOffsetPxY,
              rblLines,
              aircraftById,
              toolsColor,
              1,
              drawRblLabel
            );

            if (
              rblCommandActive &&
              rblFirstSelection &&
              !rblSecondSelection &&
              rblPreviewCursorPx
            ) {
              const previewLatLon = unprojectScopeToLatLon(
                rblPreviewCursorPx,
                radarCenter,
                videoMapRangeNm,
                scopeRect,
                videoMapPanOffsetPxX,
                videoMapPanOffsetPxY
              );
              if (previewLatLon) {
                drawRangeBearingLines(
                  ctx,
                  scopeRect,
                  resolveWxCenter(),
                  videoMapRangeNm,
                  videoMapPanOffsetPxX,
                  videoMapPanOffsetPxY,
                  [
                    {
                      start: rblFirstSelection,
                      end: {
                        kind: "point",
                        lat: previewLatLon.lat,
                        lon: previewLatLon.lon
                      }
                    }
                  ],
                  aircraftById,
                  toolsColor,
                  rblLines.length + 1,
                  drawRblLabel
                );
              }
            }

            const predictedMinSepOverlay =
              predictedMinSepPair !== null
                ? resolvePredictedMinSeparationOverlay(
                    predictedMinSepPair,
                    aircraftById,
                    scopeRect,
                    radarCenter,
                    videoMapRangeNm,
                    videoMapPanOffsetPxX,
                    videoMapPanOffsetPxY
                  )
                : null;

            for (const aircraft of aircraftToDraw) {
              const projectedCurrent = projectLatLonToScope(
                { lat: aircraft.position.lat, lon: aircraft.position.lon },
                radarCenter,
                videoMapRangeNm,
                scopeRect
              );
              const drawX = projectedCurrent.x + videoMapPanOffsetPxX;
              const drawY = projectedCurrent.y + videoMapPanOffsetPxY;
              const callsign = normalizeCallsign(aircraft.callsign);
              const tcpCode = callsign ? tcpByCallsign.get(callsign) ?? null : null;

              blipRenderer.drawHistoryDots(ctx, aircraft.previousPositions, {
                dotRadiusPx: 3.5,
                maxDots: historyDotCount,
                projectPosition: (sample) => {
                  const projected = projectLatLonToScope(
                    { lat: sample.lat, lon: sample.lon },
                    radarCenter,
                    videoMapRangeNm,
                    scopeRect
                  );
                  return {
                    x: projected.x + videoMapPanOffsetPxX,
                    y: projected.y + videoMapPanOffsetPxY
                  };
                }
              });

              if (
                ptlEnabledAircraftIds.has(aircraft.id) &&
                aircraft.trackDeg !== null &&
                Number.isFinite(aircraft.trackDeg) &&
                aircraft.groundspeedKts !== null &&
                Number.isFinite(aircraft.groundspeedKts) &&
                aircraft.groundspeedKts > 0
              ) {
                const predictedDistanceNm =
                  aircraft.groundspeedKts * (clampPtlLengthMinutes(ptlLengthMinutes) / 60);
                if (predictedDistanceNm > 0) {
                  const headingVector = headingToUnitVector(normalizeHeadingDeg(aircraft.trackDeg));
                  const predictedLengthPx = predictedDistanceNm * pixelsPerNm;
                  ctx.beginPath();
                  ctx.moveTo(drawX, drawY);
                  ctx.lineTo(
                    drawX + headingVector.x * predictedLengthPx,
                    drawY - headingVector.y * predictedLengthPx
                  );
                  ctx.strokeStyle = ptlColor;
                  ctx.lineWidth = 1;
                  ctx.lineCap = "round";
                  ctx.stroke();
                }
              }

              const hideDatablockForAltitude = altitudeFilteredAircraftIds.has(aircraft.id);
              const showFilteredDatablock =
                hideDatablockForAltitude &&
                altitudeFilterManualRevealAircraftIds.has(aircraft.id);
              const drawDatablock = !hideDatablockForAltitude || showFilteredDatablock;
              const isExpanded = drawDatablock && expandedDatablockAircraftIds.has(aircraft.id);
              const isCyanHighlighted = cyanHighlightedAircraftIds.has(aircraft.id);
              const aircraftAccentColor = isCyanHighlighted ? starsColors.CYAN : null;

              const datablockInput = {
                id: aircraft.id,
                blipX: drawX,
                blipY: drawY,
                altitudeAmslFt: aircraft.altitudeAmslFt,
                groundspeedKts: aircraft.groundspeedKts,
                wakeCategory: aircraft.wakeCategory,
                destinationIata: aircraft.destinationIata,
                aircraftTypeIcao: aircraft.aircraftTypeIcao,
                squawk: aircraft.squawk,
                callsign: aircraft.callsign,
                expanded: isExpanded,
                leaderLengthPx: leaderLayoutLengthPx,
                leaderDirection,
                timeMs: Date.now(),
                color: aircraftAccentColor
              };

              const blipHit = blipRenderer.getPrimaryTargetHitRegion({
                x: drawX,
                y: drawY,
                trackDeg: aircraft.trackDeg,
                squawk: aircraft.squawk,
                bodyShape: primaryTargetBodyShape
              });
              aircraftHitTargets.push({
                id: aircraft.id,
                x: blipHit.x,
                y: blipHit.y,
                width: blipHit.width,
                height: blipHit.height
              });

              // Draw leader first so the blip/symbol sits on top of it.
              if (drawDatablock) {
                datablockRenderer.drawWithOptions(ctx, datablockInput, {
                  drawLeader: leaderLineLengthPx > 0,
                  drawText: false
                });
              }

              blipRenderer.drawPrimaryTarget(ctx, {
                x: drawX,
                y: drawY,
                trackDeg: aircraft.trackDeg,
                tcpCode,
                squawk: aircraft.squawk,
                bodyShape: primaryTargetBodyShape,
                symbolColor: aircraftAccentColor ?? undefined
              });

              if (drawDatablock) {
                const hit = datablockRenderer.drawWithOptions(ctx, datablockInput, {
                  drawLeader: false,
                  drawText: true
                });
                datablockHitRegions.push(hit);
              }
            }

            if (predictedMinSepOverlay) {
              const lineHeightPx = listsRendererRef.current?.getLineHeight() ?? 12;
              drawPredictedMinSeparationOverlay(
                ctx,
                predictedMinSepOverlay,
                toolsColor,
                lineHeightPx,
                drawRblLabel,
                measureRblLabelWidth
              );
            }
            ctx.restore();
          }

          rendererRef.current.drawRadarScope(ctx, scopeRect, { fillBackground: false, drawBorder: true });
          drawDcb();

          listsRendererRef.current?.drawSsa(ctx, {
            x: ssaListX,
            y: ssaListY,
            airportIcao: ssaMainAirportIcao,
            qnhInHg: ssaQnhInHg,
            siteMode: normalizeSelectableSiteId(activeDcbSiteId) ?? "MULTI",
            showStatusPart: ssaFilterStatusLineVisible,
            showRadarPart: ssaFilterRadarModeVisible,
            showUtcTime: ssaFilterTimeVisible,
            showAltimeter: ssaFilterAltimeterVisible,
            showWxLine: ssaFilterWxLineVisible,
            wxActiveLevels: activeWxLevels,
            wxAvailableLevels: wxLevelsAvailable,
            qnhStations: ssaQnhStations,
            rangeNm: videoMapRangeNm,
            ptlLengthMinutes,
            altitudeFilterLine: ssaFilterAltitudeFilterLineVisible
              ? formatAltitudeFilterLine(activeAltitudeFilter)
              : null,
            wxHistoryFrameNo: wxHistoryPlaybackFrameNo
          });

          let towerAutoStackIndex = 0;
          for (const towerDisplay of towerListDisplaysByAirport.values()) {
            if (!towerDisplay.visible) {
              continue;
            }
            const towerRows = Math.max(0, towerDisplay.maxAircraftRows);
            let towerListX = scopeRect.x + towerDisplay.offsetPxX;
            let towerListY = scopeRect.y + towerDisplay.offsetPxY;
            if (!towerDisplay.pinned) {
              const stackedYOffset =
                towerAutoStackIndex * listsLineHeightPx * (towerRows + VFR_LIST_GAP_LINES + 1);
              towerListX = scopeRect.x + SSA_MARGIN_LEFT_PX;
              towerListY = defaultTowerListY + stackedYOffset;
              towerDisplay.offsetPxX = Math.round(towerListX - scopeRect.x);
              towerDisplay.offsetPxY = Math.round(towerListY - scopeRect.y);
            }
            towerAutoStackIndex += 1;

            const towerListAirportIata =
              formatTowerAirportIata(towerDisplay.airportIcao) || towerDisplay.airportIcao;
            const towerInboundAircraft =
              towerInboundAircraftByIcao.get(towerDisplay.airportIcao) ?? [];
            listsRendererRef.current?.drawTowerList(ctx, {
              x: towerListX,
              y: towerListY,
              align: "left",
              airportIata: towerListAirportIata,
              maxAircraftRows: towerRows,
              aircraft: towerInboundAircraft
            });
          }

          if (vfrListVisible) {
            listsRendererRef.current?.drawVfrList(ctx, {
              x: vfrListX,
              y: vfrListY,
              align: "left",
              entries: vfrListEntries
            });
          }

          if (flightPlanListVisible) {
            if (typeof listsRendererRef.current?.drawFlightPlanList === "function") {
              listsRendererRef.current.drawFlightPlanList(ctx, {
                x: flightPlanListX,
                y: flightPlanListY,
                align: "left",
                entries: []
              });
            } else {
              listsRendererRef.current?.drawText(
                ctx,
                flightPlanListX,
                flightPlanListY,
                "FLIGHT PLAN",
                listColor
              );
            }
          }

          if (signOnListVisible) {
            listsRendererRef.current?.drawControlPosition(ctx, {
              x: signOnListX,
              y: signOnListY,
              align: "right",
              positionId: controlPositionId,
              signedOnUtc: signedOnUtcRef.current ?? new Date()
            });
          }

          if (coastSuspendListVisible) {
            listsRendererRef.current?.drawCoastSuspend(ctx, {
              x: coastSuspendListX,
              y: coastSuspendListY,
              align: "left",
              callsigns: coastSuspendCallsigns
            });
          }

          if (laCaMciListVisible) {
            listsRendererRef.current?.drawLaCaMci(ctx, {
              x: laCaMciListX,
              y: laCaMciListY,
              align: "left",
              conflictAlerts: laCaMciConflictAlerts
            });
          }

          let currentMapsListTopY: number | null = null;
          if (currentMapsListVisible) {
            const sortedCurrentMapIds = Array.from(activeMapIds).sort((a, b) => a - b);
            const rowCount = 1 + sortedCurrentMapIds.length;
            const centeredX = scopeRect.x + (scopeRect.width - CURRENT_MAPS_LIST_BLOCK_WIDTH_PX) * 0.5;
            const minX = scopeRect.x + CURRENT_MAPS_LIST_HORIZONTAL_MARGIN_PX;
            const maxX =
              scopeRect.x +
              Math.max(
                CURRENT_MAPS_LIST_HORIZONTAL_MARGIN_PX,
                scopeRect.width - CURRENT_MAPS_LIST_BLOCK_WIDTH_PX - CURRENT_MAPS_LIST_HORIZONTAL_MARGIN_PX
              );
            const listX = Math.round(Math.min(Math.max(centeredX, minX), maxX));
            const listY = Math.max(
              scopeRect.y + 8,
              scopeRect.y +
                scopeRect.height -
                CURRENT_MAPS_LIST_MARGIN_BOTTOM_PX -
                rowCount * listsLineHeightPx
            );
            currentMapsListTopY = listY;
            const idX = listX + CURRENT_MAPS_LIST_ID_COLUMN_OFFSET_PX;
            const labelX = listX + CURRENT_MAPS_LIST_LABEL_COLUMN_OFFSET_PX;
            const nameX = listX + CURRENT_MAPS_LIST_NAME_COLUMN_OFFSET_PX;

            listsRendererRef.current?.drawText(ctx, idX, listY, "MAPS", listColor);
            for (let i = 0; i < sortedCurrentMapIds.length; i += 1) {
              const mapId = sortedCurrentMapIds[i];
              const rowY = listY + (i + 1) * listsLineHeightPx;
              const label =
                videoMapCurrentLabelsById.get(mapId) ??
                videoMapMenuLabelsById.get(mapId) ??
                "";
              const name = videoMapNamesById.get(mapId) ?? "";
              listsRendererRef.current?.drawText(ctx, idX, rowY, `>${mapId}`, listColor);
              listsRendererRef.current?.drawText(ctx, labelX, rowY, label, listColor);
              listsRendererRef.current?.drawText(ctx, nameX, rowY, name, listColor);
            }
          }

          let geoRestrictionsListTopY: number | null = null;
          if (geoRestrictionsListVisible) {
            const sortedRestrictions = [...tfrDisplayRecords].sort((a, b) => a.displayId - b.displayId);
            const rowCount = 1 + sortedRestrictions.length;
            const centeredX = scopeRect.x + (scopeRect.width - GEO_RESTRICTIONS_LIST_BLOCK_WIDTH_PX) * 0.5;
            const minX = scopeRect.x + GEO_RESTRICTIONS_LIST_HORIZONTAL_MARGIN_PX;
            const maxX =
              scopeRect.x +
              Math.max(
                GEO_RESTRICTIONS_LIST_HORIZONTAL_MARGIN_PX,
                scopeRect.width -
                  GEO_RESTRICTIONS_LIST_BLOCK_WIDTH_PX -
                  GEO_RESTRICTIONS_LIST_HORIZONTAL_MARGIN_PX
              );
            const defaultX = Math.round(Math.min(Math.max(centeredX, minX), maxX));
            const defaultYBase =
              currentMapsListTopY !== null
                ? currentMapsListTopY - (rowCount + 1) * listsLineHeightPx
                : scopeRect.y +
                  scopeRect.height -
                  GEO_RESTRICTIONS_LIST_MARGIN_BOTTOM_PX -
                  rowCount * listsLineHeightPx;
            const defaultY = Math.max(scopeRect.y + 8, Math.round(defaultYBase));

            let listX = defaultX;
            let listY = defaultY;
            if (geoRestrictionsListPinned) {
              listX = scopeRect.x + geoRestrictionsListOffsetPxX;
              listY = scopeRect.y + geoRestrictionsListOffsetPxY;
            } else {
              geoRestrictionsListOffsetPxX = Math.round(defaultX - scopeRect.x);
              geoRestrictionsListOffsetPxY = Math.round(defaultY - scopeRect.y);
            }

            geoRestrictionsListTopY = listY;
            const listRuntime = listsRendererRef.current as unknown as {
              drawGeoRestrictionsList?: (
                ctxArg: CanvasRenderingContext2D,
                input: {
                  x: number;
                  y: number;
                  align?: "left" | "right";
                  entries?: Array<{
                    id: number | string;
                    localName: string | null;
                  }>;
                }
              ) => void;
            } | null;
            if (typeof listRuntime?.drawGeoRestrictionsList === "function") {
              listRuntime.drawGeoRestrictionsList(ctx, {
                x: listX,
                y: listY,
                align: "left",
                entries: sortedRestrictions.map((restriction) => ({
                  id: restriction.displayId,
                  localName: restriction.localName
                }))
              });
            } else {
              listsRendererRef.current?.drawText(ctx, listX, listY, "GEO RESTRICTIONS", listColor);
              for (let i = 0; i < sortedRestrictions.length; i += 1) {
                const rowY = listY + (i + 1) * listsLineHeightPx;
                const row = sortedRestrictions[i];
                listsRendererRef.current?.drawText(
                  ctx,
                  listX,
                  rowY,
                  `${row.displayId} ${row.localName}`,
                  listColor
                );
              }
            }
          }

          if (coordPreviewVisible && coordPreviewText.length > 0) {
            const estimatedPreviewWidthPx = Math.max(48, coordPreviewText.length * 8);
            const centeredX = scopeRect.x + (scopeRect.width - estimatedPreviewWidthPx) * 0.5;
            const minX = scopeRect.x + CURRENT_MAPS_LIST_HORIZONTAL_MARGIN_PX;
            const maxX =
              scopeRect.x +
              Math.max(
                CURRENT_MAPS_LIST_HORIZONTAL_MARGIN_PX,
                scopeRect.width - estimatedPreviewWidthPx - CURRENT_MAPS_LIST_HORIZONTAL_MARGIN_PX
              );
            const previewX = Math.round(Math.min(Math.max(centeredX, minX), maxX));
            const previewAnchorTopY =
              currentMapsListTopY === null
                ? geoRestrictionsListTopY
                : geoRestrictionsListTopY === null
                  ? currentMapsListTopY
                  : Math.min(currentMapsListTopY, geoRestrictionsListTopY);
            const previewYBase =
              previewAnchorTopY !== null
                ? previewAnchorTopY - listsLineHeightPx
                : scopeRect.y + scopeRect.height - CURRENT_MAPS_LIST_MARGIN_BOTTOM_PX;
            const previewY = Math.max(
              scopeRect.y + 8,
              Math.min(
                scopeRect.y + scopeRect.height - listsLineHeightPx,
                Math.round(previewYBase)
              )
            );
            listsRendererRef.current?.drawText(ctx, previewX, previewY, coordPreviewText, listColor);
          }
        };

        const render = (): void => {
          if (disposed || renderScheduled) {
            return;
          }
          renderScheduled = true;
          window.requestAnimationFrame(() => {
            renderScheduled = false;
            if (disposed) {
              return;
            }
            renderNow();
          });
        };

        const refreshSsaQnh = async (): Promise<void> => {
          try {
            const response = await fetchWxQnh({ baseUrl: API_BASE_URL });
            if (disposed) {
              return;
            }
            ssaMainAirportIcao = normalizeIcaoCode(response.mainIcao) ?? SSA_AIRPORT_ICAO;
            controlPositionId =
              normalizeControllerPositionCode(response.positionId) ?? CONTROL_POSITION_ID;
            const stationByIcao = new Map(
              response.stations.map((station) => [station.icao, station] as const)
            );
            const orderedIcaos =
              response.requestedIcaos.length > 0
                ? response.requestedIcaos
                : response.stations.map((station) => station.icao);
            const normalizedStations: Array<{ airportIcao: string; qnhInHg: number | null }> = [];
            const seenIcaos = new Set<string>();

            for (let i = 0; i < orderedIcaos.length; i += 1) {
              const icao = orderedIcaos[i].trim().toUpperCase();
              if (!/^[A-Z0-9]{4}$/.test(icao) || seenIcaos.has(icao)) {
                continue;
              }
              seenIcaos.add(icao);
              const station = stationByIcao.get(icao);
              normalizedStations.push({
                airportIcao: icao,
                qnhInHg: station?.qnhInHg ?? null
              });
            }

            if (normalizedStations.length === 0) {
              normalizedStations.push({
                airportIcao: ssaMainAirportIcao,
                qnhInHg: null
              });
            }

            ssaQnhStations = normalizedStations;
            syncTowerAirportOrderFromStations(normalizedStations);
            const mainStation = normalizedStations.find(
              (station) => station.airportIcao === ssaMainAirportIcao
            );
            ssaQnhInHg = mainStation?.qnhInHg ?? null;
            rebuildTowerInboundAircraft(displayedAircraft);
            rebuildAltitudeFilteredAircraft(displayedAircraft);
            render();
          } catch (qnhError) {
            console.error("Failed to refresh SSA QNH:", qnhError);
          }
        };

        const refreshTraconMetadata = async (): Promise<void> => {
          try {
            const traconConfig = await fetchTraconConfig(TOWER_LIST_TRACON_NORMALIZED);
            if (disposed) {
              return;
            }

            dcbSiteOptions = buildDcbSiteOptionsFromTraconConfig(traconConfig);
            const normalizedActiveSiteId = normalizeSelectableSiteId(activeDcbSiteId);
            if (normalizedActiveSiteId && dcbSiteOptions.some((site) => site.siteId === normalizedActiveSiteId)) {
              activeDcbSiteId = normalizedActiveSiteId;
            } else if (dcbSiteOptions.some((site) => site.siteId === "MULTI")) {
              activeDcbSiteId = "MULTI";
            } else if (dcbSiteOptions.some((site) => site.siteId === "FUSED")) {
              activeDcbSiteId = "FUSED";
            } else {
              activeDcbSiteId = dcbSiteOptions[0]?.siteId ?? "MULTI";
            }

            const nextTowerAirportRefsByIcao = new Map<string, LatLon>();
            for (const airportIcao of Object.keys(traconConfig.airports ?? {})) {
              const normalizedIcao = normalizeIcaoCode(airportIcao);
              if (!normalizedIcao) {
                continue;
              }
              const airportRef = extractTowerAirportRef(traconConfig, normalizedIcao);
              if (airportRef) {
                nextTowerAirportRefsByIcao.set(normalizedIcao, airportRef);
              }
            }
            towerAirportRefsByIcao = nextTowerAirportRefsByIcao;
            towerAirportRef = extractTowerAirportRef(traconConfig, TOWER_LIST_AIRPORT_ICAO_NORMALIZED);
            videoMapCenterRef = extractTowerAirportRef(
              traconConfig,
              VIDEO_MAP_CENTER_AIRPORT_ICAO_NORMALIZED
            );
            if (videoMapCenterRef === null) {
              videoMapCenterRef = towerAirportRef;
            }
            if (videoMapHomeCenterRef === null) {
              videoMapHomeCenterRef = videoMapCenterRef ? { ...videoMapCenterRef } : null;
            }
            if (rangeRingCenterRef === null) {
              rangeRingCenterRef = videoMapCenterRef ?? towerAirportRef;
            }
            rebuildTowerInboundAircraft(displayedAircraft);
            approachExemptionCorridors = extractApproachExemptionCorridors(
              traconConfig,
              VIDEO_MAP_CENTER_AIRPORT_ICAO_NORMALIZED
            );
            void refreshWxRadar(true);

            const configuredMvaPath = resolveStaticAssetPath(traconConfig.mva);
            const fallbackMvaPath = `/data/mva/${TOWER_LIST_TRACON_NORMALIZED}_MVA_FUS3.xml`;
            const mvaPath = configuredMvaPath ?? fallbackMvaPath;
            try {
              const mvaResponse = await fetch(mvaPath, {
                headers: {
                  accept: "application/xml,text/xml,*/*"
                }
              });
              if (!mvaResponse.ok) {
                throw new Error(`HTTP ${mvaResponse.status}`);
              }
              const mvaXmlText = await mvaResponse.text();
              if (disposed) {
                return;
              }
              mvaSectors = parseMvaSectorsFromXml(mvaXmlText);
            } catch (mvaError) {
              console.error("Failed to load MVA sectors:", mvaError);
              mvaSectors = [];
            }

            const videomapsPath = resolveStaticAssetPath(traconConfig.videomaps);
            if (!videomapsPath) {
              videoMapsById = new Map();
              videoMapMenuLabelsById = new Map();
              videoMapCurrentLabelsById = new Map();
              videoMapNamesById = new Map();
              render();
              return;
            }

            const mapsResponse = await fetch(videomapsPath, {
              headers: {
                accept: "application/json"
              }
            });
            if (!mapsResponse.ok) {
              throw new Error(`Failed to load videomap payload ${videomapsPath}: HTTP ${mapsResponse.status}`);
            }
            const mapsPayload = (await mapsResponse.json()) as unknown;
            if (disposed) {
              return;
            }
            videoMapsById = parseVideoMapsById(mapsPayload);
            videoMapMenuLabelsById = parseVideoMapMenuLabelsById(mapsPayload);
            videoMapCurrentLabelsById = parseVideoMapCurrentLabelsById(mapsPayload);
            videoMapNamesById = parseVideoMapNamesById(mapsPayload);
            for (const mapId of [...activeMapIds]) {
              if (!videoMapsById.has(mapId)) {
                activeMapIds.delete(mapId);
              }
            }
            if (disposed) {
              return;
            }
            render();
          } catch (traconLoadError) {
            console.error("Failed to load TRACON metadata:", traconLoadError);
          }
        };

        const toggleWxLevel = (level: number): void => {
          if (activeWxLevels.has(level)) {
            activeWxLevels.delete(level);
          } else {
            activeWxLevels.add(level);
          }
          if (activeWxLevels.size > 0) {
            void refreshWxRadar();
          }
          render();
        };

        const toggleVideoMapById = (mapId: number): boolean => {
          const normalizedMapId = Math.floor(mapId);
          if (!Number.isFinite(normalizedMapId) || !videoMapsById.has(normalizedMapId)) {
            return false;
          }
          if (activeMapIds.has(normalizedMapId)) {
            activeMapIds.delete(normalizedMapId);
          } else {
            activeMapIds.add(normalizedMapId);
          }
          render();
          return true;
        };

        const refreshTfrs = async (): Promise<void> => {
          try {
            const payload = await fetchTfrs({ baseUrl: API_BASE_URL });
            if (disposed) {
              return;
            }
            tfrDisplayRecords = buildTfrDisplayRecords(payload);
            const validSourceIds = new Set(tfrDisplayRecords.map((tfr) => tfr.sourceId));
            for (const activeSourceId of [...activeTfrSourceIds]) {
              if (!validSourceIds.has(activeSourceId)) {
                activeTfrSourceIds.delete(activeSourceId);
              }
            }
            for (const sourceId of [...tfrTextStateBySourceId.keys()]) {
              if (!validSourceIds.has(sourceId)) {
                tfrTextStateBySourceId.delete(sourceId);
              }
            }
            render();
          } catch (error) {
            console.error("Failed to refresh TFR list:", error);
          }
        };

        const setTfrByDisplayId = (
          displayId: number,
          shouldEnable: boolean
        ): boolean => {
          const normalizedDisplayId = Math.floor(displayId);
          const tfr = findTfrByDisplayId(tfrDisplayRecords, normalizedDisplayId);
          if (!tfr) {
            return false;
          }

          const isActive = activeTfrSourceIds.has(tfr.sourceId);
          if (shouldEnable && !isActive) {
            activeTfrSourceIds.add(tfr.sourceId);
            render();
          } else if (!shouldEnable && isActive) {
            activeTfrSourceIds.delete(tfr.sourceId);
            render();
          }
          return true;
        };

        const setTfrTextVisibilityByDisplayId = (
          displayId: number,
          visible: boolean
        ): boolean => {
          const normalizedDisplayId = Math.floor(displayId);
          const tfr = findTfrByDisplayId(tfrDisplayRecords, normalizedDisplayId);
          if (!tfr) {
            return false;
          }
          const textState = getOrCreateTfrTextState(tfrTextStateBySourceId, tfr.sourceId);
          textState.visible = visible;
          if (!visible) {
            textState.blink = false;
          }
          render();
          return true;
        };

        const toggleTfrTextVisibilityByDisplayId = (displayId: number): boolean => {
          const normalizedDisplayId = Math.floor(displayId);
          const tfr = findTfrByDisplayId(tfrDisplayRecords, normalizedDisplayId);
          if (!tfr) {
            return false;
          }
          const textState = getOrCreateTfrTextState(tfrTextStateBySourceId, tfr.sourceId);
          return setTfrTextVisibilityByDisplayId(displayId, !textState.visible);
        };

        const toggleTfrTextBlinkByDisplayId = (displayId: number): boolean => {
          const normalizedDisplayId = Math.floor(displayId);
          const tfr = findTfrByDisplayId(tfrDisplayRecords, normalizedDisplayId);
          if (!tfr) {
            return false;
          }
          const textState = getOrCreateTfrTextState(tfrTextStateBySourceId, tfr.sourceId);
          if (!textState.visible) {
            textState.visible = true;
            textState.blink = true;
          } else if (!textState.blink) {
            textState.blink = true;
          } else {
            textState.blink = false;
            textState.visible = false;
          }
          render();
          return true;
        };

        const setTfrCustomTextByDisplayId = (
          displayId: number,
          text: string
        ): boolean => {
          const normalizedDisplayId = Math.floor(displayId);
          const tfr = findTfrByDisplayId(tfrDisplayRecords, normalizedDisplayId);
          if (!tfr) {
            return false;
          }
          const textState = getOrCreateTfrTextState(tfrTextStateBySourceId, tfr.sourceId);
          const trimmedText = text.trim();
          textState.customText = trimmedText.length > 0 ? trimmedText : null;
          render();
          return true;
        };

        const parseSingleDigitKey = (event: KeyboardEvent): number | null => {
          const codeMatch = event.code.match(/^(?:Digit|Numpad)([0-9])$/);
          if (codeMatch) {
            const parsed = Number(codeMatch[1]);
            return Number.isInteger(parsed) ? parsed : null;
          }
          if (/^[0-9]$/.test(event.key)) {
            const parsed = Number(event.key);
            return Number.isInteger(parsed) ? parsed : null;
          }
          return null;
        };

        const clearWxHistoryPlaybackTimer = (): void => {
          if (wxHistoryPlaybackTimer !== null) {
            window.clearTimeout(wxHistoryPlaybackTimer);
            wxHistoryPlaybackTimer = null;
          }
        };

        const armWxZoomInteraction = (): void => {
          wxZoomInteractionActive = true;
          if (wxZoomInteractionTimer !== null) {
            window.clearTimeout(wxZoomInteractionTimer);
          }
          wxZoomInteractionTimer = window.setTimeout(() => {
            wxZoomInteractionTimer = null;
            if (!wxZoomInteractionActive) {
              return;
            }
            wxZoomInteractionActive = false;
            if (!disposed) {
              render();
            }
          }, WX_STIPPLE_ZOOM_INTERACTION_GRACE_MS);
        };

        const stopWxHistoryPlayback = (): void => {
          clearWxHistoryPlaybackTimer();
          wxHistoryPlaybackRadar = null;
          wxHistoryPlaybackFrames = [];
          wxHistoryPlaybackIndex = -1;
          wxHistoryPlaybackFrameNo = null;
        };

        const getWxRadarForDraw = (): WxReflectivityResponse | null => {
          if (
            wxHistoryPlaybackRadar &&
            wxHistoryPlaybackIndex >= 0 &&
            wxHistoryPlaybackIndex < wxHistoryPlaybackFrames.length
          ) {
            const frame = wxHistoryPlaybackFrames[wxHistoryPlaybackIndex];
            const expected = Math.max(0, frame.rows * frame.cols);
            return {
              ...wxHistoryPlaybackRadar,
              width: frame.cols,
              height: frame.rows,
              rows: frame.rows,
              cols: frame.cols,
              levels: frame.levels,
              cells: frame.levels.slice(0, expected)
            };
          }
          return wxRadar;
        };

        const advanceWxHistoryPlayback = (): void => {
          clearWxHistoryPlaybackTimer();
          const nextIndex = wxHistoryPlaybackIndex + 1;
          if (nextIndex >= wxHistoryPlaybackFrames.length) {
            stopWxHistoryPlayback();
            render();
            return;
          }
          wxHistoryPlaybackIndex = nextIndex;
          wxHistoryPlaybackFrameNo = wxHistoryPlaybackFrames[nextIndex].frameNo;
          render();
          wxHistoryPlaybackTimer = window.setTimeout(
            advanceWxHistoryPlayback,
            WX_HISTORY_FRAME_DURATION_MS
          );
        };

        const beginWxHistoryPlayback = (): boolean => {
          if (!wxRadar) {
            return false;
          }
          const rows = wxRadar.rows ?? wxRadar.height;
          const cols = wxRadar.cols ?? wxRadar.width;
          if (rows <= 0 || cols <= 0) {
            return false;
          }

          const rawFrames = Array.isArray(wxRadar.frames) ? wxRadar.frames : [];
          const sortedFrames = rawFrames
            .map((frame, index) => ({
              frame,
              index,
              epochMs:
                frame.tEpochMs ??
                frame.receiverMs ??
                frame.itwsGenTimeMs ??
                0
            }))
            .sort((a, b) => (a.epochMs === b.epochMs ? a.index - b.index : a.epochMs - b.epochMs));
          if (sortedFrames.length < 2) {
            return false;
          }

          const historicalFrames = sortedFrames
            .slice(Math.max(0, sortedFrames.length - 4), sortedFrames.length - 1)
            .slice(-3);
          if (historicalFrames.length === 0) {
            return false;
          }

          const decodedFrames: WxHistoryPlaybackFrame[] = [];
          for (let i = 0; i < historicalFrames.length; i += 1) {
            try {
              const decoded = decodeWxFrameLevels(historicalFrames[i].frame, rows, cols);
              decodedFrames.push({
                frameNo: historicalFrames.length - i,
                rows: decoded.rows,
                cols: decoded.cols,
                levels: decoded.levels
              });
            } catch (error) {
              console.warn("Skipping invalid WX history frame during playback:", error);
            }
          }
          if (decodedFrames.length === 0) {
            return false;
          }

          stopWxHistoryPlayback();
          wxHistoryPlaybackRadar = wxRadar;
          wxHistoryPlaybackFrames = decodedFrames;
          wxHistoryPlaybackIndex = 0;
          wxHistoryPlaybackFrameNo = decodedFrames[0].frameNo;
          render();
          wxHistoryPlaybackTimer = window.setTimeout(
            advanceWxHistoryPlayback,
            WX_HISTORY_FRAME_DURATION_MS
          );
          return true;
        };

        const playCaAlertTone = (): void => {
          if (!caAlertAudio) {
            return;
          }
          const normalizedVolume = Math.min(1, Math.max(0, volLevel / VOL_MAX_LEVEL));
          if (normalizedVolume <= 0) {
            return;
          }
          caAlertAudio.volume = normalizedVolume;
          try {
            caAlertAudio.currentTime = 0;
          } catch {
            // Ignore seek failures for partially buffered audio.
          }
          void caAlertAudio.play().catch((error) => {
            console.warn("CA alert audio playback failed:", error);
          });
        };

        const playErrorAlertTone = (): void => {
          if (!errorAlertAudio) {
            return;
          }
          const normalizedVolume = Math.min(1, Math.max(0, volLevel / VOL_MAX_LEVEL));
          if (normalizedVolume <= 0) {
            return;
          }
          errorAlertAudio.volume = normalizedVolume;
          try {
            errorAlertAudio.currentTime = 0;
          } catch {
            // Ignore seek failures for partially buffered audio.
          }
          void errorAlertAudio.play().catch((error) => {
            console.warn("Error alert audio playback failed:", error);
          });
        };

        const clearTowerCommandInputState = (): void => {
          towerCommandAirportIdBuffer = "";
          towerCommandLineCountBuffer = "";
          towerCommandCollectingLineCount = false;
        };

        const getOrCreateTowerListDisplay = (airportIcao: string): TowerListDisplayState => {
          const existing = towerListDisplaysByAirport.get(airportIcao);
          if (existing) {
            return existing;
          }
          const created: TowerListDisplayState = {
            airportIcao,
            offsetPxX: SSA_MARGIN_LEFT_PX,
            offsetPxY: 0,
            pinned: false,
            visible: true,
            maxAircraftRows: towerListAircraftRows
          };
          towerListDisplaysByAirport.set(airportIcao, created);
          return created;
        };

        const resolveTowerAirportIcaoById = (airportId: number): string | null => {
          const index = Math.floor(airportId) - 1;
          if (index < 0 || index >= towerAirportOrderIcaos.length) {
            return null;
          }
          return towerAirportOrderIcaos[index] ?? null;
        };

        const resolveTowerCommandSelection = (): {
          airportIcao: string;
          aircraftRows: number | null;
          explicitAirport: boolean;
          explicitRows: boolean;
        } | null => {
          const explicitAirport = towerCommandAirportIdBuffer.length > 0;
          const explicitRows = towerCommandLineCountBuffer.length > 0;

          let airportIcao = selectedTowerAirportIcao;
          if (explicitAirport) {
            const parsedAirportId = Number.parseInt(towerCommandAirportIdBuffer, 10);
            if (!Number.isInteger(parsedAirportId) || parsedAirportId <= 0) {
              return null;
            }
            const resolvedAirport = resolveTowerAirportIcaoById(parsedAirportId);
            if (!resolvedAirport) {
              return null;
            }
            airportIcao = resolvedAirport;
          }

          let aircraftRows: number | null = null;
          if (explicitRows) {
            const parsedLineCount = Number.parseInt(towerCommandLineCountBuffer, 10);
            if (!Number.isInteger(parsedLineCount) || parsedLineCount < 1) {
              return null;
            }
            aircraftRows = Math.min(99, Math.max(0, parsedLineCount - 1));
          }

          return {
            airportIcao,
            aircraftRows,
            explicitAirport,
            explicitRows
          };
        };

        const applyTowerCommandSelection = (
          selection: {
            airportIcao: string;
            aircraftRows: number | null;
            explicitAirport: boolean;
            explicitRows: boolean;
          },
          toggleWhenNoArguments: boolean
        ): void => {
          selectedTowerAirportIcao = selection.airportIcao;
          if (selection.aircraftRows !== null) {
            towerListAircraftRows = selection.aircraftRows;
          }
          const display = getOrCreateTowerListDisplay(selection.airportIcao);
          if (selection.aircraftRows !== null) {
            display.maxAircraftRows = selection.aircraftRows;
          }
          if (!selection.explicitAirport && !selection.explicitRows && toggleWhenNoArguments) {
            display.visible = !display.visible;
          } else {
            display.visible = true;
          }
        };

        const syncTowerAirportOrderFromStations = (
          stations: Array<{ airportIcao: string; qnhInHg: number | null }>
        ): void => {
          const ordered: string[] = [];
          const seen = new Set<string>();
          for (const station of stations) {
            const icao = normalizeIcaoCode(station.airportIcao);
            if (!icao || seen.has(icao)) {
              continue;
            }
            seen.add(icao);
            ordered.push(icao);
          }

          if (ordered.length === 0) {
            ordered.push(TOWER_LIST_AIRPORT_ICAO_NORMALIZED);
          }

          towerAirportOrderIcaos = ordered;
          if (!towerAirportOrderIcaos.includes(selectedTowerAirportIcao)) {
            selectedTowerAirportIcao = towerAirportOrderIcaos[0] ?? TOWER_LIST_AIRPORT_ICAO_NORMALIZED;
            getOrCreateTowerListDisplay(selectedTowerAirportIcao);
          }
        };

        const resolveTowerAirportRef = (airportIcao: string): LatLon | null =>
          towerAirportRefsByIcao.get(airportIcao) ??
          (airportIcao === TOWER_LIST_AIRPORT_ICAO_NORMALIZED ? towerAirportRef : null);

        const rebuildTowerInboundAircraft = (aircraftFeed: AircraftFeedItem[]): void => {
          const airports =
            towerAirportOrderIcaos.length > 0
              ? towerAirportOrderIcaos
              : [TOWER_LIST_AIRPORT_ICAO_NORMALIZED];
          const stagedByAirport = new Map<
            string,
            Array<{
              callsign: string | null;
              aircraftTypeIcao: string | null;
              distanceNm: number | null;
            }>
          >();
          const seenByAirport = new Map<string, Set<string>>();
          for (const airport of airports) {
            stagedByAirport.set(airport, []);
            seenByAirport.set(airport, new Set<string>());
          }

          for (const aircraft of aircraftFeed) {
            const destinationRaw =
              typeof aircraft.destinationIata === "string"
                ? aircraft.destinationIata.trim().toUpperCase()
                : "";
            const effectiveDestination = destinationRaw.length > 0 ? destinationRaw : null;
            if (!effectiveDestination) {
              continue;
            }

            const callsign = normalizeCallsign(aircraft.callsign);
            if (!callsign) {
              continue;
            }

            const aircraftTypeIcao = (aircraft.aircraftTypeIcao ?? "").trim().toUpperCase() || null;
            for (const airportIcao of airports) {
              if (!destinationMatchesTowerAirport(effectiveDestination, airportIcao)) {
                continue;
              }
              const seenForAirport = seenByAirport.get(airportIcao);
              const rowsForAirport = stagedByAirport.get(airportIcao);
              if (!seenForAirport || !rowsForAirport || seenForAirport.has(callsign)) {
                continue;
              }
              seenForAirport.add(callsign);
              const airportRef = resolveTowerAirportRef(airportIcao);
              const distanceNm =
                airportRef === null
                  ? null
                  : distanceNmBetween(
                      { lat: aircraft.position.lat, lon: aircraft.position.lon },
                      airportRef
                    );
              rowsForAirport.push({ callsign, aircraftTypeIcao, distanceNm });
            }
          }

          const nextByAirport = new Map<
            string,
            Array<{
              callsign: string | null;
              aircraftTypeIcao: string | null;
            }>
          >();
          for (const airportIcao of airports) {
            const rows = stagedByAirport.get(airportIcao) ?? [];
            rows.sort((a, b) => {
              if (a.distanceNm === null && b.distanceNm === null) {
                return (a.callsign ?? "").localeCompare(b.callsign ?? "");
              }
              if (a.distanceNm === null) {
                return 1;
              }
              if (b.distanceNm === null) {
                return -1;
              }
              if (a.distanceNm !== b.distanceNm) {
                return a.distanceNm - b.distanceNm;
              }
              return (a.callsign ?? "").localeCompare(b.callsign ?? "");
            });
            nextByAirport.set(
              airportIcao,
              rows.map((row) => ({
                callsign: row.callsign,
                aircraftTypeIcao: row.aircraftTypeIcao
              }))
            );
          }
          towerInboundAircraftByIcao = nextByAirport;
        };

        const isAircraftAssociatedWithScope = (aircraft: AircraftFeedItem): boolean => {
          const aircraftPositionId = normalizeControllerPositionCode(aircraft.controllerPosition);
          const onControllerPosition =
            aircraftPositionId !== null && aircraftPositionId === controlPositionId;
          const destinationRaw =
            typeof aircraft.destinationIata === "string"
              ? aircraft.destinationIata.trim().toUpperCase()
              : "";
          const destination = destinationRaw.length > 0 ? destinationRaw : null;
          const inboundMainAirport = destinationMatchesTowerAirport(destination, ssaMainAirportIcao);
          return onControllerPosition || inboundMainAirport;
        };

        const rebuildAltitudeFilteredAircraft = (aircraftFeed: AircraftFeedItem[]): void => {
          altitudeFilteredAircraftIds.clear();
          const visibleAircraftIds = new Set<string>();
          for (const aircraft of aircraftFeed) {
            visibleAircraftIds.add(aircraft.id);
          }

          if (activeAltitudeFilter) {
            for (const aircraft of aircraftFeed) {
              const range = isAircraftAssociatedWithScope(aircraft)
                ? activeAltitudeFilter.associated
                : activeAltitudeFilter.unassociated;
              const altitudeFt = aircraft.altitudeAmslFt;
              if (altitudeFt === null || !Number.isFinite(altitudeFt)) {
                altitudeFilteredAircraftIds.add(aircraft.id);
                continue;
              }
              if (altitudeFt < range.minFt || altitudeFt > range.maxFt) {
                altitudeFilteredAircraftIds.add(aircraft.id);
              }
            }
          }

          for (const id of [...altitudeFilterManualRevealAircraftIds]) {
            if (!visibleAircraftIds.has(id) || !altitudeFilteredAircraftIds.has(id)) {
              altitudeFilterManualRevealAircraftIds.delete(id);
            }
          }
        };

        const refreshCoastSuspend = async (): Promise<void> => {
          try {
            const response = await fetchAircraftFeed({ baseUrl: API_BASE_URL });
            if (disposed) {
              return;
            }
            displayedAircraft = response.aircraft;
            const nextTcpByCallsign = new Map<string, string>();
            for (const aircraft of response.aircraft) {
              const callsign = normalizeCallsign(aircraft.callsign);
              const tcp =
                typeof aircraft.controllerPosition === "string"
                  ? aircraft.controllerPosition.trim().toUpperCase()
                  : "";
              if (!callsign || tcp.length === 0) {
                continue;
              }
              nextTcpByCallsign.set(callsign, tcp);
            }
            tcpByCallsign = nextTcpByCallsign;

            const visibleAircraftIds = new Set(response.aircraft.map((aircraft) => aircraft.id));
            for (const id of [...expandedDatablockAircraftIds]) {
              if (!visibleAircraftIds.has(id)) {
                expandedDatablockAircraftIds.delete(id);
              }
            }
            for (const id of [...cyanHighlightedAircraftIds]) {
              if (!visibleAircraftIds.has(id)) {
                cyanHighlightedAircraftIds.delete(id);
              }
            }
            for (const id of [...ptlEnabledAircraftIds]) {
              if (!visibleAircraftIds.has(id)) {
                ptlEnabledAircraftIds.delete(id);
              }
            }
            if (
              predictedMinSepPair &&
              (!visibleAircraftIds.has(predictedMinSepPair.firstAircraftId) ||
                !visibleAircraftIds.has(predictedMinSepPair.secondAircraftId))
            ) {
              predictedMinSepPair = null;
            }
            if (
              predictedMinSepFirstAircraftId !== null &&
              !visibleAircraftIds.has(predictedMinSepFirstAircraftId)
            ) {
              predictedMinSepFirstAircraftId = null;
              predictedMinSepCommandActive = false;
            }

            const callsigns: string[] = [];
            const seen = new Set<string>();
            for (const aircraft of response.aircraft) {
              if (!aircraft.coast) {
                continue;
              }
              const callsign = (aircraft.callsign ?? "").trim().toUpperCase();
              if (!callsign || seen.has(callsign)) {
                continue;
              }
              seen.add(callsign);
              callsigns.push(callsign);
              if (callsigns.length >= COAST_SUSPEND_MAX_CALLSIGNS) {
                break;
              }
            }

            coastSuspendCallsigns = callsigns;
            rebuildTowerInboundAircraft(response.aircraft);
            rebuildAltitudeFilteredAircraft(response.aircraft);
            const lowAltitudeAlerts = collectLowAltitudeAlerts(
              response.aircraft,
              mvaSectors,
              videoMapCenterRef,
              approachExemptionCorridors,
              flightRulesByCallsign
            );
            const conflictAlerts = collectConflictAlertPairs(response.aircraft);
            const nextCaAlertLabels = new Set(conflictAlerts);
            let hasNewCaAlert = false;
            for (const alert of nextCaAlertLabels) {
              if (!activeCaAlertLabels.has(alert)) {
                hasNewCaAlert = true;
                break;
              }
            }
            activeCaAlertLabels = nextCaAlertLabels;
            if (hasNewCaAlert) {
              playCaAlertTone();
            }
            const mergedAlerts: string[] = [];
            const seenAlerts = new Set<string>();
            for (const alert of [...lowAltitudeAlerts, ...conflictAlerts]) {
              if (seenAlerts.has(alert)) {
                continue;
              }
              seenAlerts.add(alert);
              mergedAlerts.push(alert);
              if (mergedAlerts.length >= LA_CA_MCI_MAX_CONFLICTS) {
                break;
              }
            }
            laCaMciConflictAlerts = mergedAlerts;
            render();
          } catch (aircraftError) {
            console.error("Failed to refresh COAST/SUSPEND list:", aircraftError);
          }
        };

        const handleFlightRulesMessage = (event: MessageEvent<string>): void => {
          let payload: FlightRulesSsePayload;
          try {
            payload = JSON.parse(event.data) as FlightRulesSsePayload;
          } catch {
            return;
          }

          const callsign = normalizeCallsign(payload.callsign);
          if (!callsign) {
            return;
          }

          const rulesLabel = normalizeRulesLabel(payload.rulesLabel);
          const flightRules = normalizeRulesLabel(payload.flightRules);
          flightRulesByCallsign.set(callsign, {
            rulesLabel,
            flightRules
          });

          const isVfr = rulesLabel === "VFR" || flightRules === "VFR" || flightRules === "V";
          if (!isVfr) {
            const existing = vfrEntriesByCallsign.get(callsign);
            if (!existing) {
              return;
            }
            vfrEntriesByCallsign.delete(callsign);
            vfrUsedTlIndices.delete(existing.index);
            rebuildVfrListEntries();
            render();
            return;
          }

          const beaconCode = normalizeBeaconCode(payload.beaconCode);
          const existing = vfrEntriesByCallsign.get(callsign);
          if (existing) {
            existing.beaconCode = beaconCode;
            rebuildVfrListEntries();
            render();
            return;
          }

          const index = chooseRandomUniqueTlIndex(vfrUsedTlIndices);
          if (index === null) {
            return;
          }
          vfrUsedTlIndices.add(index);
          vfrEntriesByCallsign.set(callsign, { index, beaconCode });
          rebuildVfrListEntries();
          render();
        };

        const connectFlightRulesStream = (): void => {
          try {
            const streamUrl = new URL("/api/flightRules", API_BASE_URL).toString();
            flightRulesEventSource = new EventSource(streamUrl);
            flightRulesEventSource.addEventListener(
              "flightRules",
              handleFlightRulesMessage as EventListener
            );
            flightRulesEventSource.onerror = (streamError) => {
              console.error("FlightRules stream error:", streamError);
            };
          } catch (streamError) {
            console.error("Failed to initialize FlightRules stream:", streamError);
          }
        };

        const resize = (): void => {
          syncCanvasSize();
          render();
        };

        const onKeyDown = (event: KeyboardEvent): void => {
          if (rblCommandActive) {
            if (event.key === "Enter") {
              if (rblFirstSelection && rblDeleteIndexBuffer.length > 0) {
                const parsedIndex = Number.parseInt(rblDeleteIndexBuffer, 10);
                const targetIndex = parsedIndex - 1;
                if (
                  Number.isInteger(parsedIndex) &&
                  rblFirstSelection.kind === "aircraft" &&
                  targetIndex >= 0 &&
                  targetIndex < rblLines.length &&
                  rblInvolvesAircraft(rblLines[targetIndex], rblFirstSelection.aircraftId)
                ) {
                  rblLines.splice(targetIndex, 1);
                }
              } else if (!rblFirstSelection && !rblSecondSelection && rblDeleteIndexBuffer.length === 0) {
                rblLines = [];
              }

              resetRblCommand();
              render();
              event.preventDefault();
              return;
            }

            if (event.key === "Escape") {
              resetRblCommand();
              render();
              event.preventDefault();
              return;
            }

            if (!rblSecondSelection && /^[0-9]$/.test(event.key)) {
              rblDeleteIndexBuffer += event.key;
              event.preventDefault();
              return;
            }

            if (!rblSecondSelection && event.key === "Backspace") {
              rblDeleteIndexBuffer = rblDeleteIndexBuffer.slice(0, -1);
              event.preventDefault();
              return;
            }

            return;
          }

          if (predictedMinSepCommandActive) {
            if (event.key === "Enter") {
              predictedMinSepPair = null;
              predictedMinSepFirstAircraftId = null;
              predictedMinSepCommandActive = false;
              render();
              event.preventDefault();
              return;
            }
          }

          if (
            event.key === "Escape" &&
            (
              f7CommandArmed ||
              f7CoordCommandPending ||
              f7GeoRestrictionsCommandPending ||
              f7WxCommandPending ||
              f7WxHistoryConfirmPending ||
              f7AltitudeFilterCommandPending ||
              f7PtlToggleClickPending ||
              ctrlF3CommandArmed ||
              ctrlF3ClearMapsPending ||
              ctrlF3MapTogglePending ||
              ctrlF4CommandArmed ||
              f12CommandArmed ||
              f12RestrictionCommandPending ||
              f12TfrTextCommandState !== null ||
              predictedMinSepCommandActive ||
              predictedMinSepFirstAircraftId !== null ||
              predictedMinSepPair !== null ||
              invalidCommandErrorPending ||
              coordPreviewClickPending ||
              coordPreviewVisible ||
              ssaMoveClickPending ||
              signOnMoveClickPending ||
              coastSuspendMoveClickPending ||
              laCaMciMoveClickPending ||
              flightPlanMoveClickPending ||
              towerMoveClickPending ||
              vfrMoveClickPending ||
              geoRestrictionsMoveClickPending
            )
          ) {
            f7CommandArmed = false;
            f7CoordCommandPending = false;
            f7GeoRestrictionsCommandPending = false;
            f7WxCommandPending = false;
            f7WxHistoryConfirmPending = false;
            f7AltitudeFilterCommandPending = false;
            f7AltitudeFilterBuffer = "";
            f7PtlToggleClickPending = false;
            ctrlF3CommandArmed = false;
            ctrlF3ClearMapsPending = false;
            ctrlF3MapTogglePending = false;
            ctrlF3MapIdBuffer = "";
            ctrlF4CommandArmed = false;
            ctrlF4WxLevelBuffer = "";
            f12CommandArmed = false;
            f12RestrictionCommandPending = false;
            f12RestrictionIdBuffer = "";
            f12RestrictionCommandMode = null;
            f12TfrTextCommandState = null;
            predictedMinSepCommandActive = false;
            predictedMinSepFirstAircraftId = null;
            predictedMinSepPair = null;
            invalidCommandErrorPending = false;
            coordPreviewClickPending = false;
            coordPreviewVisible = false;
            coordPreviewText = "";
            ssaMoveClickPending = false;
            signOnMoveClickPending = false;
            coastSuspendMoveClickPending = false;
            laCaMciMoveClickPending = false;
            flightPlanMoveClickPending = false;
            towerMoveClickPending = false;
            clearTowerCommandInputState();
            vfrMoveClickPending = false;
            geoRestrictionsMoveClickPending = false;
            geoRestrictionsTogglePending = false;
            event.preventDefault();
            return;
          }

          if (invalidCommandErrorPending && event.key === "Enter") {
            invalidCommandErrorPending = false;
            playErrorAlertTone();
            event.preventDefault();
            return;
          }

          if (f7CoordCommandPending) {
            if (isModifierOnlyKey(event)) {
              return;
            }
            if (isAsteriskCommandKey(event)) {
              f7CoordCommandPending = false;
              coordPreviewClickPending = true;
              event.preventDefault();
              return;
            }
            f7CoordCommandPending = false;
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (f7WxHistoryConfirmPending) {
            if (event.key === "Enter") {
              f7WxHistoryConfirmPending = false;
              if (!beginWxHistoryPlayback()) {
                playErrorAlertTone();
              }
              event.preventDefault();
              return;
            }
            f7WxHistoryConfirmPending = false;
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (f7WxCommandPending) {
            if (event.key.toUpperCase() === "H") {
              f7WxCommandPending = false;
              f7WxHistoryConfirmPending = true;
              event.preventDefault();
              return;
            }
            f7WxCommandPending = false;
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (f7GeoRestrictionsCommandPending) {
            if (isModifierOnlyKey(event)) {
              return;
            }
            if (event.key.toUpperCase() === "A") {
              f7GeoRestrictionsCommandPending = false;
              geoRestrictionsMoveClickPending = true;
              geoRestrictionsTogglePending = true;
              event.preventDefault();
              return;
            }
            f7GeoRestrictionsCommandPending = false;
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (f7AltitudeFilterCommandPending) {
            if (event.key === "Enter") {
              const parsedFilter = parseAltitudeFilterConfigFromBuffer(f7AltitudeFilterBuffer);
              f7AltitudeFilterCommandPending = false;
              f7AltitudeFilterBuffer = "";
              if (!parsedFilter) {
                playErrorAlertTone();
                event.preventDefault();
                return;
              }
              activeAltitudeFilter = parsedFilter;
              altitudeFilterManualRevealAircraftIds.clear();
              rebuildAltitudeFilteredAircraft(displayedAircraft);
              render();
              event.preventDefault();
              return;
            }
            if (event.key === "Backspace") {
              f7AltitudeFilterBuffer = f7AltitudeFilterBuffer.slice(0, -1);
              event.preventDefault();
              return;
            }
            if (isModifierOnlyKey(event)) {
              return;
            }
            if (event.key === " " || event.code === "Space") {
              event.preventDefault();
              return;
            }
            if (/^[0-9Nn]$/.test(event.key) && f7AltitudeFilterBuffer.length < 12) {
              f7AltitudeFilterBuffer += event.key.toUpperCase();
              event.preventDefault();
              return;
            }
            f7AltitudeFilterCommandPending = false;
            f7AltitudeFilterBuffer = "";
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (ctrlF3MapTogglePending) {
            if (event.key === "Enter") {
              const mapIdBuffer = ctrlF3MapIdBuffer;
              const parsedMapId = Number.parseInt(mapIdBuffer, 10);
              ctrlF3MapTogglePending = false;
              ctrlF3MapIdBuffer = "";
              if (Number.isInteger(parsedMapId) && /^\d{3}$/.test(mapIdBuffer)) {
                if (!toggleVideoMapById(parsedMapId)) {
                  playErrorAlertTone();
                }
              } else {
                playErrorAlertTone();
              }
              event.preventDefault();
              return;
            }
            if (event.key === "Backspace") {
              ctrlF3MapIdBuffer = ctrlF3MapIdBuffer.slice(0, -1);
              event.preventDefault();
              return;
            }
            const parsedDigit = parseSingleDigitKey(event);
            if (parsedDigit !== null && ctrlF3MapIdBuffer.length < 3) {
              ctrlF3MapIdBuffer += String(parsedDigit);
            }
            event.preventDefault();
            return;
          }

          if (ctrlF3ClearMapsPending) {
            if (event.key === "Enter") {
              ctrlF3ClearMapsPending = false;
              triggerMapsClearAll();
              event.preventDefault();
              return;
            }
            ctrlF3ClearMapsPending = false;
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (ctrlF3CommandArmed) {
            if (event.key.toUpperCase() === "A") {
              ctrlF3CommandArmed = false;
              ctrlF3ClearMapsPending = true;
              event.preventDefault();
              return;
            }
            const parsedDigit = parseSingleDigitKey(event);
            if (parsedDigit !== null) {
              ctrlF3CommandArmed = false;
              ctrlF3MapTogglePending = true;
              ctrlF3MapIdBuffer = String(parsedDigit);
              event.preventDefault();
              return;
            }
            ctrlF3CommandArmed = false;
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (ctrlF4CommandArmed) {
            if (event.key === "Enter") {
              const parsedLevel = Number.parseInt(ctrlF4WxLevelBuffer, 10);
              ctrlF4CommandArmed = false;
              ctrlF4WxLevelBuffer = "";
              if (Number.isInteger(parsedLevel) && parsedLevel >= 1 && parsedLevel <= 6) {
                toggleWxLevel(parsedLevel);
              } else {
                playErrorAlertTone();
              }
              event.preventDefault();
              return;
            }
            if (event.key === "Backspace") {
              ctrlF4WxLevelBuffer = ctrlF4WxLevelBuffer.slice(0, -1);
              event.preventDefault();
              return;
            }
            const parsedDigit = parseSingleDigitKey(event);
            if (parsedDigit !== null) {
              ctrlF4WxLevelBuffer += String(parsedDigit);
            }
            event.preventDefault();
            return;
          }

          if (f12TfrTextCommandState !== null) {
            if (f12TfrTextCommandState.stage === "collect-id") {
              if (event.key === "Backspace") {
                f12TfrTextCommandState = {
                  stage: "collect-id",
                  idBuffer: f12TfrTextCommandState.idBuffer.slice(0, -1)
                };
                event.preventDefault();
                return;
              }
              const parsedDigit = parseSingleDigitKey(event);
              if (parsedDigit !== null && f12TfrTextCommandState.idBuffer.length < 4) {
                f12TfrTextCommandState = {
                  stage: "collect-id",
                  idBuffer: f12TfrTextCommandState.idBuffer + String(parsedDigit)
                };
                event.preventDefault();
                return;
              }
              if (isModifierOnlyKey(event)) {
                return;
              }
              if (event.key.toUpperCase() === "T") {
                const parsedId = Number.parseInt(f12TfrTextCommandState.idBuffer, 10);
                if (Number.isInteger(parsedId)) {
                  f12TfrTextCommandState = {
                    stage: "await-action",
                    displayId: parsedId
                  };
                } else {
                  f12TfrTextCommandState = null;
                  invalidCommandErrorPending = true;
                }
                event.preventDefault();
                return;
              }
              f12TfrTextCommandState = null;
              invalidCommandErrorPending = true;
              event.preventDefault();
              return;
            }

            if (f12TfrTextCommandState.stage === "await-action") {
              if (event.key === "Enter") {
                const handled = toggleTfrTextVisibilityByDisplayId(f12TfrTextCommandState.displayId);
                f12TfrTextCommandState = null;
                if (!handled) {
                  playErrorAlertTone();
                }
                event.preventDefault();
                return;
              }
              if (event.key === "Backspace") {
                f12TfrTextCommandState = {
                  stage: "collect-id",
                  idBuffer: String(f12TfrTextCommandState.displayId)
                };
                event.preventDefault();
                return;
              }
              if (isModifierOnlyKey(event)) {
                return;
              }
              if (isBackslashCommandKey(event)) {
                f12TfrTextCommandState = {
                  stage: "await-blink-enter",
                  displayId: f12TfrTextCommandState.displayId
                };
                event.preventDefault();
                return;
              }
              if (isPrintableCommandKey(event)) {
                f12TfrTextCommandState = {
                  stage: "collect-custom-text",
                  displayId: f12TfrTextCommandState.displayId,
                  textBuffer: event.key
                };
                event.preventDefault();
                return;
              }
              f12TfrTextCommandState = null;
              invalidCommandErrorPending = true;
              event.preventDefault();
              return;
            }

            if (f12TfrTextCommandState.stage === "await-blink-enter") {
              if (event.key === "Enter") {
                const handled = toggleTfrTextBlinkByDisplayId(f12TfrTextCommandState.displayId);
                f12TfrTextCommandState = null;
                if (!handled) {
                  playErrorAlertTone();
                }
                event.preventDefault();
                return;
              }
              if (event.key === "Backspace") {
                f12TfrTextCommandState = {
                  stage: "await-action",
                  displayId: f12TfrTextCommandState.displayId
                };
                event.preventDefault();
                return;
              }
              if (isModifierOnlyKey(event)) {
                return;
              }
              f12TfrTextCommandState = null;
              invalidCommandErrorPending = true;
              event.preventDefault();
              return;
            }

            if (event.key === "Enter") {
              const handled = setTfrCustomTextByDisplayId(
                f12TfrTextCommandState.displayId,
                f12TfrTextCommandState.textBuffer
              );
              f12TfrTextCommandState = null;
              if (!handled) {
                playErrorAlertTone();
              }
              event.preventDefault();
              return;
            }
            if (event.key === "Backspace") {
              f12TfrTextCommandState = {
                stage: "collect-custom-text",
                displayId: f12TfrTextCommandState.displayId,
                textBuffer: f12TfrTextCommandState.textBuffer.slice(0, -1)
              };
              event.preventDefault();
              return;
            }
            if (isModifierOnlyKey(event)) {
              return;
            }
            if (isPrintableCommandKey(event)) {
              f12TfrTextCommandState = {
                stage: "collect-custom-text",
                displayId: f12TfrTextCommandState.displayId,
                textBuffer: f12TfrTextCommandState.textBuffer + event.key
              };
              event.preventDefault();
              return;
            }
            f12TfrTextCommandState = null;
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (f12RestrictionCommandPending) {
            if (event.key === "Enter") {
              const parsedId = Number.parseInt(f12RestrictionIdBuffer, 10);
              const commandMode = f12RestrictionCommandMode;
              f12RestrictionCommandPending = false;
              f12RestrictionIdBuffer = "";
              f12RestrictionCommandMode = null;
              if (
                Number.isInteger(parsedId) &&
                (commandMode === "enable" || commandMode === "disable") &&
                setTfrByDisplayId(parsedId, commandMode === "enable")
              ) {
                // handled
              } else {
                playErrorAlertTone();
              }
              event.preventDefault();
              return;
            }
            if (event.key === "Backspace") {
              f12RestrictionIdBuffer = f12RestrictionIdBuffer.slice(0, -1);
              event.preventDefault();
              return;
            }
            const parsedDigit = parseSingleDigitKey(event);
            if (parsedDigit !== null && f12RestrictionIdBuffer.length < 4) {
              f12RestrictionIdBuffer += String(parsedDigit);
              event.preventDefault();
              return;
            }
            if (isModifierOnlyKey(event)) {
              return;
            }
            f12RestrictionCommandPending = false;
            f12RestrictionIdBuffer = "";
            f12RestrictionCommandMode = null;
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (f12CommandArmed) {
            if (event.key.toUpperCase() === "E") {
              f12CommandArmed = false;
              f12RestrictionCommandPending = true;
              f12RestrictionIdBuffer = "";
              f12RestrictionCommandMode = "enable";
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "I") {
              f12CommandArmed = false;
              f12RestrictionCommandPending = true;
              f12RestrictionIdBuffer = "";
              f12RestrictionCommandMode = "disable";
              event.preventDefault();
              return;
            }
            const parsedDigit = parseSingleDigitKey(event);
            if (parsedDigit !== null) {
              f12CommandArmed = false;
              f12RestrictionCommandPending = false;
              f12RestrictionIdBuffer = "";
              f12RestrictionCommandMode = null;
              f12TfrTextCommandState = {
                stage: "collect-id",
                idBuffer: String(parsedDigit)
              };
              event.preventDefault();
              return;
            }
            f12CommandArmed = false;
            f12RestrictionCommandMode = null;
            f12TfrTextCommandState = null;
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (laCaMciMoveClickPending && event.key === "Enter") {
            laCaMciListVisible = !laCaMciListVisible;
            laCaMciMoveClickPending = false;
            render();
            event.preventDefault();
            return;
          }

          if (coastSuspendMoveClickPending && event.key === "Enter") {
            coastSuspendListVisible = !coastSuspendListVisible;
            coastSuspendMoveClickPending = false;
            render();
            event.preventDefault();
            return;
          }

          if (signOnMoveClickPending && event.key === "Enter") {
            signOnListVisible = !signOnListVisible;
            signOnMoveClickPending = false;
            render();
            event.preventDefault();
            return;
          }

          if (flightPlanMoveClickPending) {
            if (event.key === "Enter") {
              flightPlanListVisible = !flightPlanListVisible;
              flightPlanMoveClickPending = false;
              render();
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "V") {
              flightPlanMoveClickPending = false;
              vfrMoveClickPending = true;
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "M") {
              flightPlanMoveClickPending = false;
              laCaMciMoveClickPending = true;
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "N") {
              flightPlanMoveClickPending = false;
              signOnMoveClickPending = true;
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "C") {
              flightPlanMoveClickPending = false;
              coastSuspendMoveClickPending = true;
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "R") {
              flightPlanMoveClickPending = false;
              f7GeoRestrictionsCommandPending = true;
              event.preventDefault();
              return;
            }
            flightPlanMoveClickPending = false;
          }

          if (towerMoveClickPending) {
            if (event.key === "Enter") {
              const selection = resolveTowerCommandSelection();
              towerMoveClickPending = false;
              if (!selection) {
                clearTowerCommandInputState();
                playErrorAlertTone();
                event.preventDefault();
                return;
              }
              applyTowerCommandSelection(selection, true);
              clearTowerCommandInputState();
              rebuildTowerInboundAircraft(displayedAircraft);
              render();
              event.preventDefault();
              return;
            }
            if (event.key === "Backspace") {
              if (towerCommandCollectingLineCount) {
                if (towerCommandLineCountBuffer.length > 0) {
                  towerCommandLineCountBuffer = towerCommandLineCountBuffer.slice(0, -1);
                } else {
                  towerCommandCollectingLineCount = false;
                }
              } else {
                towerCommandAirportIdBuffer = towerCommandAirportIdBuffer.slice(0, -1);
              }
              event.preventDefault();
              return;
            }
            if ((event.code === "Space" || event.key === " ") && !towerCommandCollectingLineCount) {
              if (towerCommandAirportIdBuffer.length === 0) {
                towerMoveClickPending = false;
                clearTowerCommandInputState();
                invalidCommandErrorPending = true;
                event.preventDefault();
                return;
              }
              towerCommandCollectingLineCount = true;
              event.preventDefault();
              return;
            }
            const parsedDigit = parseSingleDigitKey(event);
            if (parsedDigit !== null) {
              if (towerCommandCollectingLineCount) {
                if (towerCommandLineCountBuffer.length < 2) {
                  towerCommandLineCountBuffer += String(parsedDigit);
                }
              } else if (towerCommandAirportIdBuffer.length < 2) {
                towerCommandAirportIdBuffer += String(parsedDigit);
              }
              event.preventDefault();
              return;
            }
            if (isModifierOnlyKey(event)) {
              return;
            }
            towerMoveClickPending = false;
            clearTowerCommandInputState();
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (vfrMoveClickPending && event.key === "Enter") {
            vfrListVisible = !vfrListVisible;
            vfrMoveClickPending = false;
            render();
            event.preventDefault();
            return;
          }

          if (geoRestrictionsMoveClickPending && event.key === "Enter") {
            geoRestrictionsMoveClickPending = false;
            if (geoRestrictionsTogglePending) {
              geoRestrictionsListVisible = !geoRestrictionsListVisible;
            }
            geoRestrictionsTogglePending = false;
            render();
            event.preventDefault();
            return;
          }

          if (f7CommandArmed) {
            if (event.key.toUpperCase() === "S") {
              f7CommandArmed = false;
              ssaMoveClickPending = true;
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "W") {
              f7CommandArmed = false;
              f7WxCommandPending = true;
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "P") {
              f7CommandArmed = false;
              towerMoveClickPending = true;
              clearTowerCommandInputState();
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "D") {
              f7CommandArmed = false;
              f7CoordCommandPending = true;
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "T") {
              f7CommandArmed = false;
              flightPlanMoveClickPending = true;
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "F") {
              f7CommandArmed = false;
              f7AltitudeFilterCommandPending = true;
              f7AltitudeFilterBuffer = "";
              event.preventDefault();
              return;
            }
            if (event.key.toUpperCase() === "R") {
              f7CommandArmed = false;
              f7PtlToggleClickPending = true;
              event.preventDefault();
              return;
            }
            f7CommandArmed = false;
            invalidCommandErrorPending = true;
            event.preventDefault();
            return;
          }

          if (event.key === "F7") {
            f7CommandArmed = true;
            f7CoordCommandPending = false;
            f7GeoRestrictionsCommandPending = false;
            f7WxCommandPending = false;
            f7WxHistoryConfirmPending = false;
            f7AltitudeFilterCommandPending = false;
            f7AltitudeFilterBuffer = "";
            f7PtlToggleClickPending = false;
            ctrlF3MapTogglePending = false;
            ctrlF3MapIdBuffer = "";
            ctrlF4CommandArmed = false;
            ctrlF4WxLevelBuffer = "";
            f12CommandArmed = false;
            f12RestrictionCommandPending = false;
            f12RestrictionIdBuffer = "";
            f12RestrictionCommandMode = null;
            f12TfrTextCommandState = null;
            invalidCommandErrorPending = false;
            coordPreviewClickPending = false;
            ssaMoveClickPending = false;
            signOnMoveClickPending = false;
            coastSuspendMoveClickPending = false;
            laCaMciMoveClickPending = false;
            flightPlanMoveClickPending = false;
            towerMoveClickPending = false;
            clearTowerCommandInputState();
            vfrMoveClickPending = false;
            geoRestrictionsMoveClickPending = false;
            geoRestrictionsTogglePending = false;
            event.preventDefault();
            return;
          }

          if (event.ctrlKey && event.key === "F3") {
            ctrlF3CommandArmed = true;
            ctrlF3ClearMapsPending = false;
            ctrlF3MapTogglePending = false;
            ctrlF3MapIdBuffer = "";
            ctrlF4CommandArmed = false;
            ctrlF4WxLevelBuffer = "";
            f12CommandArmed = false;
            f12RestrictionCommandPending = false;
            f12RestrictionIdBuffer = "";
            f12RestrictionCommandMode = null;
            f12TfrTextCommandState = null;
            f7AltitudeFilterCommandPending = false;
            f7AltitudeFilterBuffer = "";
            f7PtlToggleClickPending = false;
            towerMoveClickPending = false;
            clearTowerCommandInputState();
            geoRestrictionsMoveClickPending = false;
            geoRestrictionsTogglePending = false;
            invalidCommandErrorPending = false;
            event.preventDefault();
            return;
          }

          if (event.ctrlKey && event.key === "F4") {
            ctrlF4CommandArmed = true;
            ctrlF4WxLevelBuffer = "";
            f12CommandArmed = false;
            f12RestrictionCommandPending = false;
            f12RestrictionIdBuffer = "";
            f12RestrictionCommandMode = null;
            f12TfrTextCommandState = null;
            f7AltitudeFilterCommandPending = false;
            f7AltitudeFilterBuffer = "";
            f7PtlToggleClickPending = false;
            towerMoveClickPending = false;
            clearTowerCommandInputState();
            geoRestrictionsMoveClickPending = false;
            geoRestrictionsTogglePending = false;
            invalidCommandErrorPending = false;
            event.preventDefault();
            return;
          }

          if (event.key === "F12") {
            f12CommandArmed = true;
            f12RestrictionCommandPending = false;
            f12RestrictionIdBuffer = "";
            f12RestrictionCommandMode = null;
            f12TfrTextCommandState = null;
            f7CommandArmed = false;
            f7CoordCommandPending = false;
            f7GeoRestrictionsCommandPending = false;
            f7WxCommandPending = false;
            f7WxHistoryConfirmPending = false;
            f7AltitudeFilterCommandPending = false;
            f7AltitudeFilterBuffer = "";
            f7PtlToggleClickPending = false;
            ctrlF3CommandArmed = false;
            ctrlF3ClearMapsPending = false;
            ctrlF3MapTogglePending = false;
            ctrlF3MapIdBuffer = "";
            ctrlF4CommandArmed = false;
            ctrlF4WxLevelBuffer = "";
            towerMoveClickPending = false;
            clearTowerCommandInputState();
            geoRestrictionsMoveClickPending = false;
            geoRestrictionsTogglePending = false;
            invalidCommandErrorPending = false;
            event.preventDefault();
            return;
          }

          if (rblTriggerArmed) {
            if (event.key.toUpperCase() === "T") {
              rblCommandActive = true;
              rblTriggerArmed = false;
              rblFirstSelection = null;
              rblSecondSelection = null;
              rblDeleteIndexBuffer = "";
              rblPreviewCursorPx = null;
              event.preventDefault();
              return;
            }
            rblTriggerArmed = false;
          }

          if (isAsteriskCommandKey(event)) {
            rblTriggerArmed = true;
            event.preventDefault();
            return;
          }

          if (isBackslashCommandKey(event)) {
            predictedMinSepCommandActive = true;
            predictedMinSepFirstAircraftId = null;
            event.preventDefault();
            return;
          }

          if (event.key === "ArrowLeft") {
            headingOffsetRef.current = (headingOffsetRef.current ?? 0) - 5;
            render();
          } else if (event.key === "ArrowRight") {
            headingOffsetRef.current = (headingOffsetRef.current ?? 0) + 5;
            render();
          } else if (event.key.toLowerCase() === "r") {
            headingOffsetRef.current = 0;
            render();
          }
        };

        const resetWheelTuneAccumulators = (): void => {
          rrSpacingWheelAccumulatorPx = 0;
          leaderDirectionWheelAccumulatorPx = 0;
          leaderLengthWheelAccumulatorPx = 0;
          rrBrightnessWheelAccumulatorPx = 0;
          dcbBrightnessWheelAccumulatorPx = 0;
          mapBrightnessWheelAccumulatorPx = 0;
          tfrBrightnessWheelAccumulatorPx = 0;
          compassBrightnessWheelAccumulatorPx = 0;
          listBrightnessWheelAccumulatorPx = 0;
          toolsBrightnessWheelAccumulatorPx = 0;
          blipBrightnessWheelAccumulatorPx = 0;
          historyBrightnessWheelAccumulatorPx = 0;
          historyDotCountWheelAccumulatorPx = 0;
          ptlLengthWheelAccumulatorPx = 0;
          wxBrightnessWheelAccumulatorPx = 0;
          wxStippleBrightnessWheelAccumulatorPx = 0;
          volWheelAccumulatorPx = 0;
        };

        const disableWheelTuneModes = (): void => {
          rangeRingAdjustMode = false;
          leaderDirectionAdjustMode = false;
          leaderLengthAdjustMode = false;
          rrBrightnessAdjustMode = false;
          dcbBrightnessAdjustMode = false;
          volAdjustMode = false;
          historyDotCountAdjustMode = false;
          ptlLengthAdjustMode = false;
          mapBrightnessAdjustMode = false;
          tfrBrightnessAdjustMode = false;
          compassBrightnessAdjustMode = false;
          listBrightnessAdjustMode = false;
          toolsBrightnessAdjustMode = false;
          blipBrightnessAdjustMode = false;
          historyBrightnessAdjustMode = false;
          wxBrightnessAdjustMode = false;
          wxStippleBrightnessAdjustMode = false;
          resetWheelTuneAccumulators();
        };

        const clearMapsDoneFlash = (): void => {
          mapsDoneFlashActive = false;
          if (mapsDoneFlashTimer !== null) {
            window.clearTimeout(mapsDoneFlashTimer);
            mapsDoneFlashTimer = null;
          }
        };

        const clearMapsClearAllFlash = (): void => {
          mapsClearAllFlashActive = false;
          if (mapsClearAllFlashTimer !== null) {
            window.clearTimeout(mapsClearAllFlashTimer);
            mapsClearAllFlashTimer = null;
          }
        };

        const triggerMapsClearAll = (): void => {
          clearMapsClearAllFlash();
          activeMapIds.clear();
          mapsClearAllFlashActive = true;
          mapsClearAllFlashTimer = window.setTimeout(() => {
            mapsClearAllFlashActive = false;
            mapsClearAllFlashTimer = null;
            if (!disposed) {
              render();
            }
          }, DCB_DONE_FLASH_MS);
          render();
        };

        const clearBriteDoneFlash = (): void => {
          briteDoneFlashActive = false;
          if (briteDoneFlashTimer !== null) {
            window.clearTimeout(briteDoneFlashTimer);
            briteDoneFlashTimer = null;
          }
        };

        const clearSsaFilterDoneFlash = (): void => {
          ssaFilterDoneFlashActive = false;
          if (ssaFilterDoneFlashTimer !== null) {
            window.clearTimeout(ssaFilterDoneFlashTimer);
            ssaFilterDoneFlashTimer = null;
          }
        };

        const clearSiteMenuDoneFlash = (): void => {
          siteMenuDoneFlashActive = false;
          if (siteMenuDoneFlashTimer !== null) {
            window.clearTimeout(siteMenuDoneFlashTimer);
            siteMenuDoneFlashTimer = null;
          }
        };

        const clearShiftFlash = (): void => {
          shiftFlashActive = false;
          if (shiftFlashTimer !== null) {
            window.clearTimeout(shiftFlashTimer);
            shiftFlashTimer = null;
          }
        };

        const armShiftFlash = (onFlashComplete?: () => void): void => {
          clearShiftFlash();
          shiftFlashActive = true;
          shiftFlashTimer = window.setTimeout(() => {
            shiftFlashActive = false;
            shiftFlashTimer = null;
            onFlashComplete?.();
            if (!disposed) {
              render();
            }
          }, DCB_DONE_FLASH_MS);
        };

        const applyZoomAtScopePoint = (
          anchorX: number,
          anchorY: number,
          scale: number
        ): boolean => {
          if (!Number.isFinite(scale) || scale <= 0) {
            return false;
          }

          const scopeRect = getScopeRect();
          const oldRangeNm = videoMapRangeNm;
          const nextRangeNm = clampVideoMapRange(oldRangeNm * scale);
          if (nextRangeNm === oldRangeNm) {
            return false;
          }

          const scopeCenterX = scopeRect.x + scopeRect.width * 0.5;
          const scopeCenterY = scopeRect.y + scopeRect.height * 0.5;
          const zoomRatio = oldRangeNm / nextRangeNm;
          const anchorFromCenterX = anchorX - scopeCenterX;
          const anchorFromCenterY = anchorY - scopeCenterY;

          // Keep the world point under the anchor fixed while scaling.
          videoMapPanOffsetPxX =
            anchorFromCenterX - (anchorFromCenterX - videoMapPanOffsetPxX) * zoomRatio;
          videoMapPanOffsetPxY =
            anchorFromCenterY - (anchorFromCenterY - videoMapPanOffsetPxY) * zoomRatio;
          videoMapRangeNm = nextRangeNm;
          return true;
        };

        const onCanvasClick = (event: MouseEvent): void => {
          const dcbRenderer = dcbRendererRef.current;
          const rect = canvas.getBoundingClientRect();
          const clickX = event.clientX - rect.left;
          const clickY = event.clientY - rect.top;
          const scopeRect = getScopeRect();
          const dcbMapsInput = getDcbMapsInput();

          if (coordPreviewClickPending) {
            coordPreviewClickPending = false;
            let resolvedLatLon: LatLon | null = null;

            const clickedAircraftId = pickAircraftAtPoint(aircraftHitTargets, clickX, clickY);
            if (clickedAircraftId) {
              const clickedAircraft = displayedAircraft.find((aircraft) => aircraft.id === clickedAircraftId) ?? null;
              if (clickedAircraft) {
                resolvedLatLon = {
                  lat: clickedAircraft.position.lat,
                  lon: clickedAircraft.position.lon
                };
              }
            }

            if (!resolvedLatLon && pointInScopeRect(clickX, clickY, scopeRect)) {
              const center = resolveWxCenter();
              if (center) {
                resolvedLatLon = unprojectScopeToLatLon(
                  { x: clickX, y: clickY },
                  center,
                  videoMapRangeNm,
                  scopeRect,
                  videoMapPanOffsetPxX,
                  videoMapPanOffsetPxY
                );
              }
            }

            if (!resolvedLatLon) {
              playErrorAlertTone();
              render();
              return;
            }

            coordPreviewText = formatPreviewCoordinate(resolvedLatLon.lat, resolvedLatLon.lon);
            coordPreviewVisible = true;
            render();
            return;
          }

          if (geoRestrictionsMoveClickPending) {
            if (pointInScopeRect(clickX, clickY, scopeRect)) {
              geoRestrictionsListOffsetPxX = Math.round(clickX - scopeRect.x);
              geoRestrictionsListOffsetPxY = Math.round(clickY - scopeRect.y);
              geoRestrictionsListPinned = true;
              geoRestrictionsListVisible = true;
              geoRestrictionsMoveClickPending = false;
              geoRestrictionsTogglePending = false;
              render();
              return;
            }
            geoRestrictionsMoveClickPending = false;
            geoRestrictionsTogglePending = false;
          }

          if (laCaMciMoveClickPending) {
            if (pointInScopeRect(clickX, clickY, scopeRect)) {
              laCaMciListOffsetPxX = Math.round(clickX - scopeRect.x);
              laCaMciListOffsetPxY = Math.round(clickY - scopeRect.y);
              laCaMciListPinned = true;
              laCaMciListVisible = true;
              laCaMciMoveClickPending = false;
              render();
              return;
            }
            laCaMciMoveClickPending = false;
          }

          if (coastSuspendMoveClickPending) {
            if (pointInScopeRect(clickX, clickY, scopeRect)) {
              coastSuspendListOffsetPxX = Math.round(clickX - scopeRect.x);
              coastSuspendListOffsetPxY = Math.round(clickY - scopeRect.y);
              coastSuspendListPinned = true;
              coastSuspendListVisible = true;
              coastSuspendMoveClickPending = false;
              render();
              return;
            }
            coastSuspendMoveClickPending = false;
          }

          if (signOnMoveClickPending) {
            if (pointInScopeRect(clickX, clickY, scopeRect)) {
              signOnListOffsetPxX = Math.round(clickX - scopeRect.x);
              signOnListOffsetPxY = Math.round(clickY - scopeRect.y);
              signOnListPinned = true;
              signOnListVisible = true;
              signOnMoveClickPending = false;
              render();
              return;
            }
            signOnMoveClickPending = false;
          }

          if (flightPlanMoveClickPending) {
            if (pointInScopeRect(clickX, clickY, scopeRect)) {
              flightPlanListOffsetPxX = Math.round(clickX - scopeRect.x);
              flightPlanListOffsetPxY = Math.round(clickY - scopeRect.y);
              flightPlanListPinned = true;
              flightPlanListVisible = true;
              flightPlanMoveClickPending = false;
              render();
              return;
            }
            flightPlanMoveClickPending = false;
          }

          if (towerMoveClickPending) {
            const selection = resolveTowerCommandSelection();
            towerMoveClickPending = false;
            if (!selection) {
              clearTowerCommandInputState();
              playErrorAlertTone();
              render();
              return;
            }
            applyTowerCommandSelection(selection, false);
            clearTowerCommandInputState();
            const towerDisplay = getOrCreateTowerListDisplay(selection.airportIcao);
            towerDisplay.offsetPxX = Math.round(clickX - scopeRect.x);
            towerDisplay.offsetPxY = Math.round(clickY - scopeRect.y);
            towerDisplay.pinned = true;
            towerDisplay.visible = true;
            if (selection.aircraftRows !== null) {
              towerDisplay.maxAircraftRows = selection.aircraftRows;
            }
            rebuildTowerInboundAircraft(displayedAircraft);
            render();
            return;
          }

          if (vfrMoveClickPending) {
            if (pointInScopeRect(clickX, clickY, scopeRect)) {
              vfrListOffsetPxX = Math.round(clickX - scopeRect.x);
              vfrListOffsetPxY = Math.round(clickY - scopeRect.y);
              vfrListPinned = true;
              vfrListVisible = true;
              vfrMoveClickPending = false;
              render();
              return;
            }
            vfrMoveClickPending = false;
          }

          if (ssaMoveClickPending) {
            if (pointInScopeRect(clickX, clickY, scopeRect)) {
              ssaListOffsetPxX = Math.round(clickX - scopeRect.x);
              ssaListOffsetPxY = Math.round(clickY - scopeRect.y);
              ssaMoveClickPending = false;
              render();
            }
            return;
          }

          if (f7PtlToggleClickPending) {
            f7PtlToggleClickPending = false;
            const clickedAircraftId = pickAircraftAtPoint(aircraftHitTargets, clickX, clickY);
            if (!clickedAircraftId) {
              playErrorAlertTone();
              render();
              return;
            }
            if (ptlEnabledAircraftIds.has(clickedAircraftId)) {
              ptlEnabledAircraftIds.delete(clickedAircraftId);
            } else {
              ptlEnabledAircraftIds.add(clickedAircraftId);
            }
            render();
            return;
          }

          if (rblCommandActive) {
            if (!pointInScopeRect(clickX, clickY, scopeRect)) {
              return;
            }
            const selection = resolveRblSelectionFromClick(clickX, clickY);
            if (!selection) {
              return;
            }
            if (!rblFirstSelection) {
              rblFirstSelection = selection;
              rblSecondSelection = null;
              rblDeleteIndexBuffer = "";
              rblPreviewCursorPx = { x: clickX, y: clickY };
              render();
              return;
            }
            const hasAircraft =
              rblFirstSelection.kind === "aircraft" || selection.kind === "aircraft";
            if (hasAircraft) {
              rblLines.push({
                start: rblFirstSelection,
                end: selection
              });
            }
            resetRblCommand();
            render();
            return;
          }

          if (predictedMinSepCommandActive) {
            if (!pointInScopeRect(clickX, clickY, scopeRect)) {
              return;
            }
            const clickedAircraftId = pickAircraftAtPoint(aircraftHitTargets, clickX, clickY);
            if (!clickedAircraftId) {
              playErrorAlertTone();
              render();
              return;
            }
            if (!predictedMinSepFirstAircraftId) {
              predictedMinSepFirstAircraftId = clickedAircraftId;
              render();
              return;
            }
            if (clickedAircraftId === predictedMinSepFirstAircraftId) {
              playErrorAlertTone();
              render();
              return;
            }
            predictedMinSepPair = {
              firstAircraftId: predictedMinSepFirstAircraftId,
              secondAircraftId: clickedAircraftId
            };
            predictedMinSepCommandActive = false;
            predictedMinSepFirstAircraftId = null;
            render();
            return;
          }

          if (dcbRenderer) {
            if (dcbAuxSecondPage) {
              const auxControlHitTester = dcbRenderer as unknown as {
                hitTestAuxControls?: (
                  input: DcbAuxControlsInput,
                  x: number,
                  y: number
                ) => DcbAuxControlHit | null;
              };
              const clickedAuxControl =
                typeof auxControlHitTester.hitTestAuxControls === "function"
                  ? auxControlHitTester.hitTestAuxControls(getDcbAuxControlsInput(), clickX, clickY)
                  : null;
              if (clickedAuxControl === "shift") {
                armShiftFlash(() => {
                  dcbAuxSecondPage = false;
                  volAdjustMode = false;
                  historyDotCountAdjustMode = false;
                  ptlLengthAdjustMode = false;
                  volWheelAccumulatorPx = 0;
                  historyDotCountWheelAccumulatorPx = 0;
                  ptlLengthWheelAccumulatorPx = 0;
                });
                render();
                return;
              }
              if (clickedAuxControl === "vol") {
                volAdjustMode = !volAdjustMode;
                if (volAdjustMode) {
                  resetWheelTuneAccumulators();
                  disableWheelTuneModes();
                  volAdjustMode = true;
                } else {
                  volWheelAccumulatorPx = 0;
                }
                render();
                return;
              }
              if (clickedAuxControl === "history") {
                historyDotCountAdjustMode = !historyDotCountAdjustMode;
                if (historyDotCountAdjustMode) {
                  resetWheelTuneAccumulators();
                  disableWheelTuneModes();
                  historyDotCountAdjustMode = true;
                } else {
                  historyDotCountWheelAccumulatorPx = 0;
                }
                render();
                return;
              }
              if (clickedAuxControl === "ptl") {
                ptlLengthAdjustMode = !ptlLengthAdjustMode;
                if (ptlLengthAdjustMode) {
                  resetWheelTuneAccumulators();
                  disableWheelTuneModes();
                  ptlLengthAdjustMode = true;
                } else {
                  ptlLengthWheelAccumulatorPx = 0;
                }
                render();
                return;
              }
              if (clickY >= DCB_MAPS_Y_PX && clickY <= DCB_MAPS_Y_PX + DCB_MAPS_HEIGHT_PX) {
                return;
              }
            }

            const briteHitTester = dcbRenderer as unknown as {
              hitTestBrite?: (
                input: DcbBriteInput,
                x: number,
                y: number
              ) => DcbBriteControlHit | null;
            };
            const briteInput = getDcbBriteInput();
            const clickedBriteRaw =
              typeof briteHitTester.hitTestBrite === "function"
                ? briteHitTester.hitTestBrite(briteInput, clickX, clickY)
                : null;
            const clickedBriteFallback = hitTestBriteFallback(briteInput, clickX, clickY);
            let clickedBrite =
              clickedBriteRaw === "brite-menu"
                ? clickedBriteFallback ?? clickedBriteRaw
                : clickedBriteRaw ?? clickedBriteFallback;
            // Ensure MPB remains clickable even if a renderer/fallback hit-test misses due overlap.
            if (briteExpanded) {
              const bottomRow = briteInput.bottomRow ?? [];
              const mpbColumnIndex = bottomRow.findIndex(
                (button) => button.top.trim().toUpperCase() === "MPB"
              );
              if (mpbColumnIndex >= 0) {
                const menuOriginX = Math.round(briteInput.x) + DCB_BUTTON_WIDTH_PX + DCB_BUTTON_GAP_PX;
                const mpbRect = {
                  x: menuOriginX + mpbColumnIndex * (DCB_BUTTON_WIDTH_PX + DCB_BUTTON_GAP_PX),
                  y: Math.round(briteInput.y) + DCB_BUTTON_HALF_HEIGHT_PX + DCB_BUTTON_GAP_PX,
                  width: DCB_BUTTON_WIDTH_PX,
                  height: DCB_BUTTON_HALF_HEIGHT_PX
                };
                if (pointInRect(clickX, clickY, mpbRect)) {
                  clickedBrite = "brite-mpb";
                }
              }
            }
            const shouldPrioritizeBrite =
              briteExpanded &&
              !ssaFilterExpanded &&
              !siteMenuExpanded &&
              clickedBrite !== null;

            const siteMenuHitTester = dcbRenderer as unknown as {
              hitTestSiteMenu?: (
                input: DcbSiteMenuInput,
                x: number,
                y: number
              ) => { control: DcbSiteControlHit; siteId: string | null } | null;
            };
            const clickedSiteMenu =
              !dcbAuxSecondPage &&
              !shouldPrioritizeBrite &&
              typeof siteMenuHitTester.hitTestSiteMenu === "function"
                ? siteMenuHitTester.hitTestSiteMenu(getDcbSiteMenuInput(), clickX, clickY)
                : null;
            if (clickedSiteMenu?.control === "site-toggle") {
              clearSiteMenuDoneFlash();
              siteMenuExpanded = !siteMenuExpanded;
              if (siteMenuExpanded) {
                mapsExpanded = false;
                ssaFilterExpanded = false;
                briteExpanded = false;
                clearMapsDoneFlash();
                clearMapsClearAllFlash();
                clearSsaFilterDoneFlash();
                clearBriteDoneFlash();
                disableWheelTuneModes();
              }
              render();
              return;
            }
            if (clickedSiteMenu?.control === "site-done") {
              clearSiteMenuDoneFlash();
              siteMenuDoneFlashActive = true;
              siteMenuDoneFlashTimer = window.setTimeout(() => {
                siteMenuDoneFlashActive = false;
                siteMenuDoneFlashTimer = null;
                siteMenuExpanded = false;
                if (!disposed) {
                  render();
                }
              }, DCB_DONE_FLASH_MS);
              render();
              return;
            }
            if (clickedSiteMenu?.control === "site-select" && clickedSiteMenu.siteId) {
              const nextSelectableSiteId = normalizeSelectableSiteId(clickedSiteMenu.siteId);
              if (nextSelectableSiteId) {
                activeDcbSiteId = nextSelectableSiteId;
                render();
              }
              return;
            }
            if (clickedSiteMenu?.control === "site-menu") {
              return;
            }

            const ssaFilterHitTester = dcbRenderer as unknown as {
              hitTestSsaFilterMenu?: (
                input: DcbSsaFilterInput,
                x: number,
                y: number
              ) => DcbSsaFilterControlHit | null;
            };
            const clickedSsaFilter =
              !dcbAuxSecondPage &&
              !shouldPrioritizeBrite &&
              typeof ssaFilterHitTester.hitTestSsaFilterMenu === "function"
                ? ssaFilterHitTester.hitTestSsaFilterMenu(getDcbSsaFilterInput(), clickX, clickY)
                : null;
            if (clickedSsaFilter === "ssa-filter-toggle") {
              clearSsaFilterDoneFlash();
              ssaFilterExpanded = !ssaFilterExpanded;
              if (ssaFilterExpanded) {
                mapsExpanded = false;
                briteExpanded = false;
                siteMenuExpanded = false;
                clearMapsDoneFlash();
                clearMapsClearAllFlash();
                clearBriteDoneFlash();
                clearSiteMenuDoneFlash();
                disableWheelTuneModes();
              }
              render();
              return;
            }
            if (clickedSsaFilter === "ssa-filter-done") {
              clearSsaFilterDoneFlash();
              ssaFilterDoneFlashActive = true;
              ssaFilterDoneFlashTimer = window.setTimeout(() => {
                ssaFilterDoneFlashActive = false;
                ssaFilterDoneFlashTimer = null;
                ssaFilterExpanded = false;
                if (!disposed) {
                  render();
                }
              }, DCB_DONE_FLASH_MS);
              render();
              return;
            }
            if (clickedSsaFilter === "ssa-filter-wx") {
              ssaFilterWxLineVisible = !ssaFilterWxLineVisible;
              render();
              return;
            }
            if (clickedSsaFilter === "ssa-filter-status") {
              ssaFilterStatusLineVisible = !ssaFilterStatusLineVisible;
              render();
              return;
            }
            if (clickedSsaFilter === "ssa-filter-radar") {
              ssaFilterRadarModeVisible = !ssaFilterRadarModeVisible;
              render();
              return;
            }
            if (clickedSsaFilter === "ssa-filter-time") {
              ssaFilterTimeVisible = !ssaFilterTimeVisible;
              render();
              return;
            }
            if (clickedSsaFilter === "ssa-filter-altstg") {
              ssaFilterAltimeterVisible = !ssaFilterAltimeterVisible;
              render();
              return;
            }
            if (clickedSsaFilter === "ssa-filter-alt-fil") {
              ssaFilterAltitudeFilterLineVisible = !ssaFilterAltitudeFilterLineVisible;
              render();
              return;
            }
            if (clickedSsaFilter === "ssa-filter-menu") {
              return;
            }

            const mapsHitTester = dcbRenderer as unknown as {
              hitTestMapsMenu?: (
                input: DcbMapsMenuInput,
                x: number,
                y: number
              ) => { control: DcbMapsControlHit; mapId: number | null } | null;
            };
            const mapsMenuInput = getDcbMapsMenuInput();
            const hasMapsMenuHitTester = typeof mapsHitTester.hitTestMapsMenu === "function";
            const clickedMaps = hasMapsMenuHitTester
              ? mapsHitTester.hitTestMapsMenu(mapsMenuInput, clickX, clickY)
              : null;
            const resolvedClickedMaps = hasMapsMenuHitTester
              ? clickedMaps
              : hitTestMapsMenuFallback(mapsMenuInput, clickX, clickY);
            if (resolvedClickedMaps?.control === "maps-toggle") {
              clearMapsDoneFlash();
              clearMapsClearAllFlash();
              clearBriteDoneFlash();
              clearSsaFilterDoneFlash();
              clearSiteMenuDoneFlash();
              mapsExpanded = !mapsExpanded;
              if (mapsExpanded) {
                briteExpanded = false;
                ssaFilterExpanded = false;
                siteMenuExpanded = false;
                disableWheelTuneModes();
              }
              render();
              return;
            }
            if (resolvedClickedMaps?.control === "maps-done") {
              clearMapsDoneFlash();
              clearMapsClearAllFlash();
              mapsDoneFlashActive = true;
              mapsDoneFlashTimer = window.setTimeout(() => {
                mapsDoneFlashActive = false;
                mapsDoneFlashTimer = null;
                mapsExpanded = false;
                if (!disposed) {
                  render();
                }
              }, DCB_DONE_FLASH_MS);
              render();
              return;
            }
            if (resolvedClickedMaps?.control === "maps-clear-all") {
              triggerMapsClearAll();
              return;
            }
            if (resolvedClickedMaps?.control === "maps-current") {
              currentMapsListVisible = !currentMapsListVisible;
              render();
              return;
            }
            if (resolvedClickedMaps?.control === "maps-map" && resolvedClickedMaps.mapId !== null) {
              if (!toggleVideoMapById(resolvedClickedMaps.mapId)) {
                playErrorAlertTone();
              }
              return;
            }
            if (resolvedClickedMaps?.control === "maps-menu") {
              return;
            }

            const rrControlHitTester = dcbRenderer as unknown as {
              hitTestRangeRingControls?: (
                input: DcbMapCategoryInput,
                x: number,
                y: number
              ) => DcbRangeRingControlHit | null;
            };
            const clickedRrControl =
              typeof rrControlHitTester.hitTestRangeRingControls === "function"
                ? rrControlHitTester.hitTestRangeRingControls(dcbMapsInput, clickX, clickY)
                : null;
            if (clickedRrControl === "rr") {
              rangeRingAdjustMode = !rangeRingAdjustMode;
              if (rangeRingAdjustMode) {
                resetWheelTuneAccumulators();
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedRrControl === "place-cntr") {
              placeMapCenterMode = !placeMapCenterMode;
              if (placeMapCenterMode) {
                placeRangeRingCenterMode = false;
                disableWheelTuneModes();
              }
              render();
              return;
            }
            if (clickedRrControl === "off-cntr") {
              const defaultCenter = getDefaultVideoMapCenter();
              if (defaultCenter) {
                videoMapCenterRef = { ...defaultCenter };
              }
              videoMapPanOffsetPxX = 0;
              videoMapPanOffsetPxY = 0;
              placeRangeRingCenterMode = false;
              placeMapCenterMode = false;
              render();
              return;
            }
            if (clickedRrControl === "place-rr") {
              placeRangeRingCenterMode = !placeRangeRingCenterMode;
              if (placeRangeRingCenterMode) {
                placeMapCenterMode = false;
                disableWheelTuneModes();
              }
              render();
              return;
            }
            if (clickedRrControl === "rr-cntr") {
              rangeRingCenterRef = getDefaultRangeRingCenter();
              placeRangeRingCenterMode = false;
              placeMapCenterMode = false;
              rrCntrFlashActive = true;
              if (rrCntrFlashTimer !== null) {
                window.clearTimeout(rrCntrFlashTimer);
              }
              rrCntrFlashTimer = window.setTimeout(() => {
                rrCntrFlashActive = false;
                rrCntrFlashTimer = null;
                if (!disposed) {
                  render();
                }
              }, DCB_DONE_FLASH_MS);
              render();
              return;
            }

            if (clickedBrite === "brite-toggle") {
              clearBriteDoneFlash();
              clearMapsClearAllFlash();
              clearMapsDoneFlash();
              clearSsaFilterDoneFlash();
              clearSiteMenuDoneFlash();
              briteExpanded = !briteExpanded;
              if (briteExpanded) {
                mapsExpanded = false;
                ssaFilterExpanded = false;
                siteMenuExpanded = false;
              }
              if (!briteExpanded) {
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
                resetWheelTuneAccumulators();
              }
              render();
              return;
            }
            if (clickedBrite === "brite-dcb") {
              dcbBrightnessAdjustMode = !dcbBrightnessAdjustMode;
              if (dcbBrightnessAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedBrite === "brite-mpa") {
              mapBrightnessAdjustMode = !mapBrightnessAdjustMode;
              if (mapBrightnessAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedBrite === "brite-mpb") {
              tfrBrightnessAdjustMode = !tfrBrightnessAdjustMode;
              if (tfrBrightnessAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedBrite === "brite-lst") {
              listBrightnessAdjustMode = !listBrightnessAdjustMode;
              if (listBrightnessAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedBrite === "brite-hst") {
              historyBrightnessAdjustMode = !historyBrightnessAdjustMode;
              if (historyBrightnessAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedBrite === "brite-tls") {
              toolsBrightnessAdjustMode = !toolsBrightnessAdjustMode;
              if (toolsBrightnessAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedBrite === "brite-pri") {
              blipBrightnessAdjustMode = !blipBrightnessAdjustMode;
              if (blipBrightnessAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedBrite === "brite-cmp") {
              compassBrightnessAdjustMode = !compassBrightnessAdjustMode;
              if (compassBrightnessAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedBrite === "brite-rr") {
              rrBrightnessAdjustMode = !rrBrightnessAdjustMode;
              if (rrBrightnessAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedBrite === "brite-wx") {
              wxBrightnessAdjustMode = !wxBrightnessAdjustMode;
              if (wxBrightnessAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedBrite === "brite-wxc") {
              wxStippleBrightnessAdjustMode = !wxStippleBrightnessAdjustMode;
              if (wxStippleBrightnessAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedBrite === "brite-done") {
              clearBriteDoneFlash();
              rrBrightnessAdjustMode = false;
              dcbBrightnessAdjustMode = false;
              volAdjustMode = false;
              mapBrightnessAdjustMode = false;
              tfrBrightnessAdjustMode = false;
              compassBrightnessAdjustMode = false;
              listBrightnessAdjustMode = false;
              toolsBrightnessAdjustMode = false;
              blipBrightnessAdjustMode = false;
              historyBrightnessAdjustMode = false;
              wxBrightnessAdjustMode = false;
              wxStippleBrightnessAdjustMode = false;
              resetWheelTuneAccumulators();
              briteDoneFlashActive = true;
              briteDoneFlashTimer = window.setTimeout(() => {
                briteDoneFlashActive = false;
                briteDoneFlashTimer = null;
                briteExpanded = false;
                if (!disposed) {
                  render();
                }
              }, DCB_DONE_FLASH_MS);
              render();
              return;
            }
            if (clickedBrite === "brite-menu") {
              return;
            }

            const ldrControlHitTester = dcbRenderer as unknown as {
              hitTestLeaderControls?: (
                input: DcbLeaderControlsInput,
                x: number,
                y: number
              ) => DcbLeaderControlHit | null;
            };
            const clickedLdrControl =
              typeof ldrControlHitTester.hitTestLeaderControls === "function"
                ? ldrControlHitTester.hitTestLeaderControls(getDcbLeaderControlsInput(), clickX, clickY)
                : null;
            if (clickedLdrControl === "ldr-dir") {
              leaderDirectionAdjustMode = !leaderDirectionAdjustMode;
              if (leaderDirectionAdjustMode) {
                resetWheelTuneAccumulators();
                leaderLengthAdjustMode = false;
                rangeRingAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }
            if (clickedLdrControl === "ldr-length") {
              leaderLengthAdjustMode = !leaderLengthAdjustMode;
              if (leaderLengthAdjustMode) {
                resetWheelTuneAccumulators();
                leaderDirectionAdjustMode = false;
                rangeRingAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              }
              render();
              return;
            }

            const auxControlHitTester = dcbRenderer as unknown as {
              hitTestAuxControls?: (
                input: DcbAuxControlsInput,
                x: number,
                y: number
              ) => DcbAuxControlHit | null;
            };
            const clickedAuxControl =
              typeof auxControlHitTester.hitTestAuxControls === "function"
                ? auxControlHitTester.hitTestAuxControls(getDcbAuxControlsInput(), clickX, clickY)
                : null;
            if (clickedAuxControl === "shift") {
              const nextDcbAuxSecondPage = !dcbAuxSecondPage;
              armShiftFlash(() => {
                dcbAuxSecondPage = nextDcbAuxSecondPage;
                if (dcbAuxSecondPage) {
                  mapsExpanded = false;
                  briteExpanded = false;
                  ssaFilterExpanded = false;
                  clearMapsDoneFlash();
                  clearMapsClearAllFlash();
                  clearBriteDoneFlash();
                  clearSsaFilterDoneFlash();
                  placeRangeRingCenterMode = false;
                  placeMapCenterMode = false;
                  if (rrCntrFlashTimer !== null) {
                    window.clearTimeout(rrCntrFlashTimer);
                    rrCntrFlashTimer = null;
                  }
                  rrCntrFlashActive = false;
                  disableWheelTuneModes();
                } else {
                  volAdjustMode = false;
                  historyDotCountAdjustMode = false;
                  ptlLengthAdjustMode = false;
                  volWheelAccumulatorPx = 0;
                  historyDotCountWheelAccumulatorPx = 0;
                  ptlLengthWheelAccumulatorPx = 0;
                }
              });
              render();
              return;
            }
            if (clickedAuxControl === "vol") {
              volAdjustMode = !volAdjustMode;
              if (volAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                historyDotCountAdjustMode = false;
                ptlLengthAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              } else {
                volWheelAccumulatorPx = 0;
              }
              render();
              return;
            }
            if (clickedAuxControl === "history") {
              historyDotCountAdjustMode = !historyDotCountAdjustMode;
              if (historyDotCountAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                ptlLengthAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              } else {
                historyDotCountWheelAccumulatorPx = 0;
              }
              render();
              return;
            }
            if (clickedAuxControl === "ptl") {
              ptlLengthAdjustMode = !ptlLengthAdjustMode;
              if (ptlLengthAdjustMode) {
                resetWheelTuneAccumulators();
                rangeRingAdjustMode = false;
                leaderDirectionAdjustMode = false;
                leaderLengthAdjustMode = false;
                placeRangeRingCenterMode = false;
                placeMapCenterMode = false;
                rrBrightnessAdjustMode = false;
                dcbBrightnessAdjustMode = false;
                volAdjustMode = false;
                mapBrightnessAdjustMode = false;
                tfrBrightnessAdjustMode = false;
                compassBrightnessAdjustMode = false;
                listBrightnessAdjustMode = false;
                toolsBrightnessAdjustMode = false;
                blipBrightnessAdjustMode = false;
                historyBrightnessAdjustMode = false;
                historyDotCountAdjustMode = false;
                wxBrightnessAdjustMode = false;
                wxStippleBrightnessAdjustMode = false;
              } else {
                ptlLengthWheelAccumulatorPx = 0;
              }
              render();
              return;
            }

            const wxHitTester = dcbRenderer as unknown as {
              hitTestWxLevels?: (input: DcbWxLevelsInput, x: number, y: number) => number | null;
            };
            const clickedWxLevel =
              typeof wxHitTester.hitTestWxLevels === "function"
                ? wxHitTester.hitTestWxLevels(
                    buildDcbWxLevels(activeWxLevels, wxLevelsAvailable),
                    clickX,
                    clickY
                  )
                : null;
            if (clickedWxLevel !== null) {
              toggleWxLevel(clickedWxLevel);
              return;
            }

            const clickedMapId = dcbRenderer.hitTestMapsCategory(
              dcbMapsInput,
              clickX,
              clickY
            );
            if (clickedMapId !== null) {
              if (!toggleVideoMapById(clickedMapId)) {
                playErrorAlertTone();
              }
              return;
            }
          }

          if (placeMapCenterMode && pointInScopeRect(clickX, clickY, getScopeRect())) {
            const mapCenter = resolveWxCenter();
            if (mapCenter) {
              const candidateCenter = unprojectScopeToLatLon(
                { x: clickX, y: clickY },
                mapCenter,
                videoMapRangeNm,
                getScopeRect(),
                videoMapPanOffsetPxX,
                videoMapPanOffsetPxY
              );
              if (candidateCenter) {
                videoMapCenterRef = candidateCenter;
                videoMapHomeCenterRef = { ...candidateCenter };
                videoMapPanOffsetPxX = 0;
                videoMapPanOffsetPxY = 0;
              }
            }
            placeMapCenterMode = false;
            render();
            return;
          }

          if (placeRangeRingCenterMode && pointInScopeRect(clickX, clickY, getScopeRect())) {
            const mapCenter = resolveWxCenter();
            if (mapCenter) {
              const candidateCenter = unprojectScopeToLatLon(
                { x: clickX, y: clickY },
                mapCenter,
                videoMapRangeNm,
                getScopeRect(),
                videoMapPanOffsetPxX,
                videoMapPanOffsetPxY
              );
              if (candidateCenter) {
                rangeRingCenterRef = candidateCenter;
              }
            }
            placeRangeRingCenterMode = false;
            placeMapCenterMode = false;
            render();
            return;
          }

          const clickedAircraftId = pickAircraftAtPoint(aircraftHitTargets, clickX, clickY);
          if (event.altKey && clickedAircraftId) {
            if (cyanHighlightedAircraftIds.has(clickedAircraftId)) {
              cyanHighlightedAircraftIds.delete(clickedAircraftId);
            } else {
              cyanHighlightedAircraftIds.add(clickedAircraftId);
            }
            render();
            return;
          }
          if (clickedAircraftId && altitudeFilteredAircraftIds.has(clickedAircraftId)) {
            if (altitudeFilterManualRevealAircraftIds.has(clickedAircraftId)) {
              altitudeFilterManualRevealAircraftIds.delete(clickedAircraftId);
            } else {
              altitudeFilterManualRevealAircraftIds.add(clickedAircraftId);
            }
            render();
            return;
          }

          const clickedDatablockId = datablockRendererRef.current?.hitTest(datablockHitRegions, clickX, clickY);
          if (!clickedDatablockId) {
            return;
          }
          if (expandedDatablockAircraftIds.has(clickedDatablockId)) {
            expandedDatablockAircraftIds.delete(clickedDatablockId);
          } else {
            expandedDatablockAircraftIds.add(clickedDatablockId);
          }
          render();
        };

        const stopVideoMapPanDrag = (): void => {
          videoMapPanDragActive = false;
          videoMapPanDragLast = null;
        };

        const onCanvasMouseDown = (event: MouseEvent): void => {
          if (event.button !== 0 || event.detail < 2) {
            return;
          }
          const rect = canvas.getBoundingClientRect();
          const pointerX = event.clientX - rect.left;
          const pointerY = event.clientY - rect.top;
          if (!pointInScopeRect(pointerX, pointerY, getScopeRect())) {
            return;
          }
          videoMapPanDragActive = true;
          videoMapPanDragLast = { x: pointerX, y: pointerY };
          event.preventDefault();
        };

        const onCanvasMouseMove = (event: MouseEvent): void => {
          const rect = canvas.getBoundingClientRect();
          const pointerX = event.clientX - rect.left;
          const pointerY = event.clientY - rect.top;
          updateCanvasCursorAtPoint(pointerX, pointerY);

          const pointerInScope = pointInScopeRect(pointerX, pointerY, getScopeRect());
          if (rblCommandActive && rblFirstSelection && !rblSecondSelection) {
            const nextPreviewCursor = pointerInScope ? { x: pointerX, y: pointerY } : null;
            const previewChanged =
              (rblPreviewCursorPx === null) !== (nextPreviewCursor === null) ||
              (rblPreviewCursorPx !== null &&
                nextPreviewCursor !== null &&
                (rblPreviewCursorPx.x !== nextPreviewCursor.x ||
                  rblPreviewCursorPx.y !== nextPreviewCursor.y));
            if (previewChanged) {
              rblPreviewCursorPx = nextPreviewCursor;
              render();
            }
          } else if (rblPreviewCursorPx !== null) {
            rblPreviewCursorPx = null;
          }

          if (!videoMapPanDragActive || !videoMapPanDragLast) {
            return;
          }
          if ((event.buttons & 1) === 0) {
            stopVideoMapPanDrag();
            return;
          }
          const dx = pointerX - videoMapPanDragLast.x;
          const dy = pointerY - videoMapPanDragLast.y;
          if (dx === 0 && dy === 0) {
            return;
          }
          videoMapPanOffsetPxX += dx;
          videoMapPanOffsetPxY += dy;
          videoMapPanDragLast = { x: pointerX, y: pointerY };
          render();
          event.preventDefault();
        };

        const onCanvasWheel = (event: WheelEvent): void => {
          // Always suppress browser default wheel behavior over the canvas.
          // Otherwise ctrl/trackpad pinch can zoom the page and shrink the CSS viewport.
          event.preventDefault();

          const rect = canvas.getBoundingClientRect();
          const pointerX = event.clientX - rect.left;
          const pointerY = event.clientY - rect.top;
          if (!pointInScopeRect(pointerX, pointerY, getScopeRect())) {
            return;
          }
          const deltaPx = normalizeWheelDeltaPx(event);
          if (deltaPx === 0) {
            return;
          }

          if (rangeRingAdjustMode) {
            const consumed = consumeWheelStepAccumulator(rrSpacingWheelAccumulatorPx, deltaPx);
            rrSpacingWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            let nextSpacing = rangeRingSpacingNm;
            const direction = consumed.steps > 0 ? 1 : -1;
            for (let i = 0; i < Math.abs(consumed.steps); i += 1) {
              nextSpacing = stepRangeRingSpacingNm(nextSpacing, direction);
            }
            if (nextSpacing !== rangeRingSpacingNm) {
              rangeRingSpacingNm = nextSpacing;
              render();
            }
            return;
          }
          if (leaderDirectionAdjustMode) {
            const consumed = consumeWheelStepAccumulator(leaderDirectionWheelAccumulatorPx, deltaPx);
            leaderDirectionWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const count = DATABLOCK_LEADER_DIRECTIONS.length;
            const rawIndex = (leaderDirectionIndex + consumed.steps) % count;
            const nextIndex = rawIndex < 0 ? rawIndex + count : rawIndex;
            if (nextIndex !== leaderDirectionIndex) {
              leaderDirectionIndex = nextIndex;
              render();
            }
            return;
          }
          if (leaderLengthAdjustMode) {
            const consumed = consumeWheelStepAccumulator(leaderLengthWheelAccumulatorPx, deltaPx);
            leaderLengthWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextLevel = Math.min(
              DATABLOCK_LEADER_LEVEL_MAX,
              Math.max(DATABLOCK_LEADER_LEVEL_MIN, leaderLengthLevel + consumed.steps)
            );
            if (nextLevel !== leaderLengthLevel) {
              leaderLengthLevel = nextLevel;
              render();
            }
            return;
          }
          if (rrBrightnessAdjustMode) {
            const consumed = consumeWheelStepAccumulator(rrBrightnessWheelAccumulatorPx, deltaPx);
            rrBrightnessWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextBrightness = Math.min(
              100,
              Math.max(0, rrBrightnessPercent + consumed.steps * RANGE_RING_BRIGHTNESS_STEP_PERCENT)
            );
            if (nextBrightness !== rrBrightnessPercent) {
              rrBrightnessPercent = nextBrightness;
              render();
            }
            return;
          }
          if (dcbBrightnessAdjustMode) {
            const consumed = consumeWheelStepAccumulator(dcbBrightnessWheelAccumulatorPx, deltaPx);
            dcbBrightnessWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextBrightness = Math.min(
              100,
              Math.max(0, dcbBrightnessPercent + consumed.steps * DCB_BRIGHTNESS_STEP_PERCENT)
            );
            if (nextBrightness !== dcbBrightnessPercent) {
              dcbBrightnessPercent = nextBrightness;
              render();
            }
            return;
          }
          if (volAdjustMode) {
            const consumed = consumeWheelStepAccumulator(volWheelAccumulatorPx, deltaPx);
            volWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextLevel = Math.min(
              VOL_MAX_LEVEL,
              Math.max(VOL_MIN_LEVEL, volLevel + consumed.steps * VOL_STEP_LEVEL)
            );
            if (nextLevel !== volLevel) {
              volLevel = nextLevel;
              if (caAlertAudio) {
                caAlertAudio.volume = volLevel / VOL_MAX_LEVEL;
              }
              if (errorAlertAudio) {
                errorAlertAudio.volume = volLevel / VOL_MAX_LEVEL;
              }
              render();
            }
            return;
          }
          if (historyDotCountAdjustMode) {
            const consumed = consumeWheelStepAccumulator(historyDotCountWheelAccumulatorPx, deltaPx);
            historyDotCountWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextHistoryDotCount = Math.min(
              HISTORY_DOTS_MAX_COUNT,
              Math.max(
                HISTORY_DOTS_MIN_COUNT,
                historyDotCount + consumed.steps * HISTORY_DOTS_STEP_COUNT
              )
            );
            if (nextHistoryDotCount !== historyDotCount) {
              historyDotCount = nextHistoryDotCount;
              render();
            }
            return;
          }
          if (ptlLengthAdjustMode) {
            const consumed = consumeWheelStepAccumulator(ptlLengthWheelAccumulatorPx, deltaPx);
            ptlLengthWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextPtlLengthMinutes = clampPtlLengthMinutes(
              ptlLengthMinutes + consumed.steps * PTL_LENGTH_STEP_MINUTES
            );
            if (nextPtlLengthMinutes !== ptlLengthMinutes) {
              ptlLengthMinutes = nextPtlLengthMinutes;
              render();
            }
            return;
          }
          if (mapBrightnessAdjustMode) {
            const consumed = consumeWheelStepAccumulator(mapBrightnessWheelAccumulatorPx, deltaPx);
            mapBrightnessWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextBrightness = Math.min(
              100,
              Math.max(0, mapBrightnessPercent + consumed.steps * VIDEO_MAP_BRIGHTNESS_STEP_PERCENT)
            );
            if (nextBrightness !== mapBrightnessPercent) {
              mapBrightnessPercent = nextBrightness;
              render();
            }
            return;
          }
          if (tfrBrightnessAdjustMode) {
            const consumed = consumeWheelStepAccumulator(tfrBrightnessWheelAccumulatorPx, deltaPx);
            tfrBrightnessWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextBrightness = Math.min(
              100,
              Math.max(0, tfrBrightnessPercent + consumed.steps * TFR_BRIGHTNESS_STEP_PERCENT)
            );
            if (nextBrightness !== tfrBrightnessPercent) {
              tfrBrightnessPercent = nextBrightness;
              render();
            }
            return;
          }
          if (compassBrightnessAdjustMode) {
            const consumed = consumeWheelStepAccumulator(compassBrightnessWheelAccumulatorPx, deltaPx);
            compassBrightnessWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextBrightness = Math.min(
              100,
              Math.max(0, compassBrightnessPercent + consumed.steps * COMPASS_BRIGHTNESS_STEP_PERCENT)
            );
            if (nextBrightness !== compassBrightnessPercent) {
              compassBrightnessPercent = nextBrightness;
              render();
            }
            return;
          }
          if (listBrightnessAdjustMode) {
            const consumed = consumeWheelStepAccumulator(listBrightnessWheelAccumulatorPx, deltaPx);
            listBrightnessWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextBrightness = Math.min(
              100,
              Math.max(
                LIST_MIN_BRIGHTNESS_PERCENT,
                listBrightnessPercent + consumed.steps * LIST_BRIGHTNESS_STEP_PERCENT
              )
            );
            if (nextBrightness !== listBrightnessPercent) {
              listBrightnessPercent = nextBrightness;
              render();
            }
            return;
          }
          if (toolsBrightnessAdjustMode) {
            const consumed = consumeWheelStepAccumulator(toolsBrightnessWheelAccumulatorPx, deltaPx);
            toolsBrightnessWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextBrightness = Math.min(
              100,
              Math.max(0, toolsBrightnessPercent + consumed.steps * TOOLS_BRIGHTNESS_STEP_PERCENT)
            );
            if (nextBrightness !== toolsBrightnessPercent) {
              toolsBrightnessPercent = nextBrightness;
              render();
            }
            return;
          }
          if (historyBrightnessAdjustMode) {
            const consumed = consumeWheelStepAccumulator(historyBrightnessWheelAccumulatorPx, deltaPx);
            historyBrightnessWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextBrightness = Math.min(
              100,
              Math.max(0, historyBrightnessPercent + consumed.steps * HISTORY_BRIGHTNESS_STEP_PERCENT)
            );
            if (nextBrightness !== historyBrightnessPercent) {
              historyBrightnessPercent = nextBrightness;
              render();
            }
            return;
          }
          if (wxBrightnessAdjustMode) {
            const consumed = consumeWheelStepAccumulator(wxBrightnessWheelAccumulatorPx, deltaPx);
            wxBrightnessWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextBrightness = Math.min(
              100,
              Math.max(0, wxBrightnessPercent + consumed.steps * WX_COLOR_BRIGHTNESS_STEP_PERCENT)
            );
            if (nextBrightness !== wxBrightnessPercent) {
              wxBrightnessPercent = nextBrightness;
              render();
            }
            return;
          }
          if (wxStippleBrightnessAdjustMode) {
            const consumed = consumeWheelStepAccumulator(wxStippleBrightnessWheelAccumulatorPx, deltaPx);
            wxStippleBrightnessWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextBrightness = Math.min(
              100,
              Math.max(0, wxStippleBrightnessPercent + consumed.steps * WX_STIPPLE_BRIGHTNESS_STEP_PERCENT)
            );
            if (nextBrightness !== wxStippleBrightnessPercent) {
              wxStippleBrightnessPercent = nextBrightness;
              render();
            }
            return;
          }
          if (blipBrightnessAdjustMode) {
            const consumed = consumeWheelStepAccumulator(blipBrightnessWheelAccumulatorPx, deltaPx);
            blipBrightnessWheelAccumulatorPx = consumed.accumulatorPx;
            if (consumed.steps === 0) {
              return;
            }
            const nextBrightness = Math.min(
              100,
              Math.max(0, blipBrightnessPercent + consumed.steps * BLIP_BRIGHTNESS_STEP_PERCENT)
            );
            if (nextBrightness !== blipBrightnessPercent) {
              blipBrightnessPercent = nextBrightness;
              render();
            }
            return;
          }

          const scale = Math.exp(deltaPx * VIDEO_MAP_WHEEL_ZOOM_STEP);
          if (!applyZoomAtScopePoint(pointerX, pointerY, scale)) {
            return;
          }
          armWxZoomInteraction();
          ensureWxCoverageForCurrentRange();
          render();
        };

        const onGlobalWheelZoom = (event: WheelEvent): void => {
          // Prevent browser zoom gestures (e.g. ctrl/cmd + wheel/pinch-to-zoom)
          // from shrinking the viewport and making the scope appear "compressed".
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
          }
        };

        const onGlobalZoomKeyDown = (event: KeyboardEvent): void => {
          if (!(event.ctrlKey || event.metaKey)) {
            return;
          }
          const key = event.key;
          if (key === "+" || key === "=" || key === "-" || key === "_" || key === "0") {
            event.preventDefault();
          }
        };

        const onGestureEvent = (event: Event): void => {
          // Safari trackpad pinch emits gesture events instead of wheel.
          event.preventDefault();
        };

        const onTouchStart = (event: TouchEvent): void => {
          if (event.touches.length !== 2) {
            touchPinchState = null;
            return;
          }

          const rect = canvas.getBoundingClientRect();
          const touchA = event.touches[0];
          const touchB = event.touches[1];
          const midX = ((touchA.clientX + touchB.clientX) * 0.5) - rect.left;
          const midY = ((touchA.clientY + touchB.clientY) * 0.5) - rect.top;
          if (!pointInScopeRect(midX, midY, getScopeRect())) {
            touchPinchState = null;
            return;
          }

          touchPinchState = {
            startDistancePx: Math.max(1, touchDistancePx(touchA, touchB)),
            startRangeNm: videoMapRangeNm
          };
          event.preventDefault();
        };

        const onTouchMove = (event: TouchEvent): void => {
          if (!touchPinchState || event.touches.length !== 2) {
            return;
          }

          const currentDistancePx = Math.max(1, touchDistancePx(event.touches[0], event.touches[1]));
          const ratio = touchPinchState.startDistancePx / currentDistancePx;
          const nextRangeNm = clampVideoMapRange(touchPinchState.startRangeNm * ratio);
          if (nextRangeNm !== videoMapRangeNm) {
            videoMapRangeNm = nextRangeNm;
            armWxZoomInteraction();
            ensureWxCoverageForCurrentRange();
            render();
          }
          event.preventDefault();
        };

        const onTouchEnd = (_event: TouchEvent): void => {
          if (touchPinchState && _event.touches.length < 2) {
            touchPinchState = null;
          }
        };

        canvas.style.cursor = NON_SCOPE_CURSOR;

        window.addEventListener("resize", resize);
        window.addEventListener("wheel", onGlobalWheelZoom, { passive: false, capture: true });
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keydown", onGlobalZoomKeyDown, { capture: true });
        window.addEventListener("mouseup", stopVideoMapPanDrag);
        if (visualViewport) {
          visualViewport.addEventListener("resize", resize);
          visualViewport.addEventListener("scroll", resize);
        }
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            resize();
          });
          resizeObserver.observe(canvas);
        }
        document.addEventListener("gesturestart", onGestureEvent, { passive: false });
        document.addEventListener("gesturechange", onGestureEvent, { passive: false });
        document.addEventListener("gestureend", onGestureEvent, { passive: false });
        canvas.addEventListener("click", onCanvasClick);
        canvas.addEventListener("mousedown", onCanvasMouseDown);
        canvas.addEventListener("mousemove", onCanvasMouseMove);
        canvas.addEventListener("wheel", onCanvasWheel, { passive: false });
        canvas.addEventListener("touchstart", onTouchStart, { passive: false });
        canvas.addEventListener("touchmove", onTouchMove, { passive: false });
        canvas.addEventListener("touchend", onTouchEnd);
        canvas.addEventListener("touchcancel", onTouchEnd);
        const clockTimer = window.setInterval(render, UI_RENDER_TICK_MS);
        const qnhTimer = window.setInterval(() => void refreshSsaQnh(), SSA_QNH_REFRESH_MS);
        const aircraftTimer = window.setInterval(() => void refreshCoastSuspend(), AIRCRAFT_REFRESH_MS);
        const wxTimer = window.setInterval(() => void refreshWxRadar(true), WX_REFRESH_MS);
        const tfrTimer = window.setInterval(() => void refreshTfrs(), TFR_REFRESH_MS);
        resize();
        void refreshSsaQnh();
        void refreshTraconMetadata();
        void refreshCoastSuspend();
        void refreshWxRadar();
        void refreshTfrs();
        connectFlightRulesStream();
        console.info(
          "STARS React demo running. Use Left/Right arrows to rotate compass, R to reset, F7 then S then click in scope to move SSA, F7 then D then * then click in scope/blip to preview coordinates (clears with Esc), F7 then F then {###}{###}{###}{###} then Enter to set datablock altitude filters (N99 means 000), F7 then R then click a radar blip to toggle PTL for that track, F7 then P then Enter to toggle the current Tower list, F7 then P then {id} then Enter to show Tower list for airport id, F7 then P then {id} then click anywhere on screen to place that Tower list, F7 then P then {id} then {x} then Enter to show x total Tower lines (x-1 aircraft rows), F7 then T then Enter to toggle Flight Plan list, F7 then T then click in scope to place Flight Plan list, F7 then T then M then Enter to toggle LA/CA/MCI list, F7 then T then M then click in scope to place LA/CA/MCI list, F7 then T then N then Enter to toggle sign-on list, F7 then T then N then click in scope to place sign-on list, F7 then T then C then Enter to toggle COAST/SUSPEND list, F7 then T then C then click in scope to place COAST/SUSPEND list, F7 then T then V then Enter to toggle VFR, F7 then T then V then click in scope to place VFR, F7 then T then R then A then Enter to toggle GEO RESTRICTIONS, or F7 then T then R then A then click in scope to place it, F12 then E then {id} then Enter to enable a TFR, F12 then I then {id} then Enter to disable a TFR, F12 then {id} then T then Enter to toggle TFR text visibility, F12 then {id} then T then \\ then Enter to toggle blinking TFR text visibility, F12 then {id} then T then {text} then Enter to set TFR text, and click MAP tiles to toggle videomaps."
        );

        cleanup = () => {
          window.removeEventListener("resize", resize);
          window.removeEventListener("wheel", onGlobalWheelZoom, true);
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("keydown", onGlobalZoomKeyDown, true);
          window.removeEventListener("mouseup", stopVideoMapPanDrag);
          if (visualViewport) {
            visualViewport.removeEventListener("resize", resize);
            visualViewport.removeEventListener("scroll", resize);
          }
          if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
          }
          document.removeEventListener("gesturestart", onGestureEvent);
          document.removeEventListener("gesturechange", onGestureEvent);
          document.removeEventListener("gestureend", onGestureEvent);
          canvas.removeEventListener("click", onCanvasClick);
          canvas.removeEventListener("mousedown", onCanvasMouseDown);
          canvas.removeEventListener("mousemove", onCanvasMouseMove);
          canvas.removeEventListener("wheel", onCanvasWheel);
          canvas.removeEventListener("touchstart", onTouchStart);
          canvas.removeEventListener("touchmove", onTouchMove);
          canvas.removeEventListener("touchend", onTouchEnd);
          canvas.removeEventListener("touchcancel", onTouchEnd);
          if (flightRulesEventSource) {
            flightRulesEventSource.removeEventListener(
              "flightRules",
              handleFlightRulesMessage as EventListener
            );
            flightRulesEventSource.close();
            flightRulesEventSource = null;
          }
          window.clearInterval(clockTimer);
          window.clearInterval(qnhTimer);
          window.clearInterval(aircraftTimer);
          window.clearInterval(wxTimer);
          window.clearInterval(tfrTimer);
          if (wxZoomInteractionTimer !== null) {
            window.clearTimeout(wxZoomInteractionTimer);
            wxZoomInteractionTimer = null;
          }
          if (wxHistoryPlaybackTimer !== null) {
            window.clearTimeout(wxHistoryPlaybackTimer);
            wxHistoryPlaybackTimer = null;
          }
          if (rrCntrFlashTimer !== null) {
            window.clearTimeout(rrCntrFlashTimer);
            rrCntrFlashTimer = null;
          }
          if (mapsDoneFlashTimer !== null) {
            window.clearTimeout(mapsDoneFlashTimer);
            mapsDoneFlashTimer = null;
          }
          if (mapsClearAllFlashTimer !== null) {
            window.clearTimeout(mapsClearAllFlashTimer);
            mapsClearAllFlashTimer = null;
          }
          if (briteDoneFlashTimer !== null) {
            window.clearTimeout(briteDoneFlashTimer);
            briteDoneFlashTimer = null;
          }
          if (ssaFilterDoneFlashTimer !== null) {
            window.clearTimeout(ssaFilterDoneFlashTimer);
            ssaFilterDoneFlashTimer = null;
          }
          if (siteMenuDoneFlashTimer !== null) {
            window.clearTimeout(siteMenuDoneFlashTimer);
            siteMenuDoneFlashTimer = null;
          }
          if (shiftFlashTimer !== null) {
            window.clearTimeout(shiftFlashTimer);
            shiftFlashTimer = null;
          }
          if (caAlertAudio) {
            caAlertAudio.pause();
            caAlertAudio.currentTime = 0;
          }
          if (errorAlertAudio) {
            errorAlertAudio.pause();
            errorAlertAudio.currentTime = 0;
          }
          if (webglMapRendererRef.current) {
            webglMapRendererRef.current.dispose();
            webglMapRendererRef.current = null;
          }
          if (mapCanvas && !RENDER_COMPASS_AND_DCB_ONLY) {
            mapCanvas.removeEventListener("webglcontextlost", onMapWebGlContextLost);
            mapCanvas.removeEventListener("webglcontextrestored", onMapWebGlContextRestored);
          }
        };
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        setError(message);
        console.error("STARS React demo bootstrap failed:", caught);
      }
    };

    void initialize();

    return () => {
      disposed = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  if (error) {
    return createElement(
      "pre",
      {
        style: {
          margin: "0",
          padding: "16px",
          whiteSpace: "pre-wrap",
          color: "#ff4444",
          background: "black",
          fontFamily: "monospace"
        }
      },
      `STARS React demo failed.\n\n${error}\n\nOpen devtools console for stack trace.`
    );
  }

  return createElement(
    "div",
    {
      id: "stars-demo-root",
      style: {
        position: "fixed",
        inset: "0",
        width: "100%",
        height: "100%",
        background: "black",
        overflow: "hidden"
      }
    },
    createElement("canvas", {
      id: "stars-demo-map",
      ref: mapCanvasRef,
      style: {
        display: RENDER_COMPASS_AND_DCB_ONLY ? "none" : "block",
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none"
      }
    }),
    createElement("canvas", {
      id: "stars-demo-canvas",
      ref: canvasRef,
      style: {
        display: "block",
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        touchAction: "none"
      }
    })
  );
}

const rootElement = document.getElementById("app") ?? (() => {
  const div = document.createElement("div");
  div.id = "app";
  document.body.appendChild(div);
  return div;
})();

rootElement.style.position = "fixed";
rootElement.style.inset = "0";
rootElement.style.width = "100%";
rootElement.style.height = "100%";
rootElement.style.overflow = "hidden";

createRoot(rootElement).render(createElement(StarsApp));
