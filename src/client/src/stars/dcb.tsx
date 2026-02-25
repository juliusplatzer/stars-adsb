import { getTintedGlyphCanvas, loadBitmapFont, type LoadedBitmapFont } from "../lib/bitmapFont.js";
import colors from "./colors.js";

type DcbTileTone = "normal" | "wx" | "gray";

export interface DcbMapSmallButton {
  top: string;
  bottom: string;
  active?: boolean;
  tone?: DcbTileTone;
  mapId?: number;
}

export interface DcbMapsMenuButton {
  top: string;
  bottom: string;
  active?: boolean;
  tone?: DcbTileTone;
  textColor?: string;
  mapId?: number;
}

export interface DcbMapsMenuInput {
  x: number;
  y: number;
  expanded?: boolean;
  topRow?: DcbMapsMenuButton[];
  bottomRow?: DcbMapsMenuButton[];
}

export interface DcbMapCategoryInput {
  x: number;
  y: number;
  rangeLabel?: string;
  rangeValue?: string;
  rangeActive?: boolean;
  rangeTone?: DcbTileTone;
  placeCntrTop?: string;
  placeCntrBottom?: string;
  placeCntrActive?: boolean;
  placeCntrTone?: DcbTileTone;
  offCntrTop?: string;
  offCntrBottom?: string;
  offCntrActive?: boolean;
  offCntrTone?: DcbTileTone;
  rrLabel?: string;
  rrValue?: string;
  rrActive?: boolean;
  rrTone?: DcbTileTone;
  placeRrTop?: string;
  placeRrBottom?: string;
  placeRrActive?: boolean;
  placeRrTone?: DcbTileTone;
  rrCntrTop?: string;
  rrCntrBottom?: string;
  rrCntrActive?: boolean;
  rrCntrTone?: DcbTileTone;
  mapsLabel?: string;
  mapsActive?: boolean;
  mapsTone?: DcbTileTone;
  topRow: DcbMapSmallButton[];
  bottomRow: DcbMapSmallButton[];
}

export interface DcbWxLevelButton {
  label: string;
  active?: boolean;
  tone?: DcbTileTone;
}

export interface DcbWxLevelsInput {
  x: number;
  y: number;
  buttons: DcbWxLevelButton[];
}

export interface DcbLeaderControlsInput {
  x: number;
  y: number;
  directionLabel?: string;
  directionValue?: string;
  directionActive?: boolean;
  directionTone?: DcbTileTone;
  lengthLabel?: string;
  lengthValue?: string;
  lengthActive?: boolean;
  lengthTone?: DcbTileTone;
}

export interface DcbAuxControlsInput {
  x: number;
  y: number;
  secondPage?: boolean;
  charSizeTop?: string;
  charSizeBottom?: string;
  charSizeActive?: boolean;
  charSizeTone?: DcbTileTone;
  modeTop?: string;
  modeBottom?: string;
  modeActive?: boolean;
  modeTone?: DcbTileTone;
  siteMultiTop?: string;
  siteMultiBottom?: string;
  siteMultiActive?: boolean;
  siteMultiTone?: DcbTileTone;
  prefLabel?: string;
  prefActive?: boolean;
  prefTone?: DcbTileTone;
  ssaFilterTop?: string;
  ssaFilterBottom?: string;
  ssaFilterActive?: boolean;
  ssaFilterTone?: DcbTileTone;
  giTextFilterTop?: string;
  giTextFilterBottom?: string;
  giTextFilterActive?: boolean;
  giTextFilterTone?: DcbTileTone;
  shiftLabel?: string;
  shiftActive?: boolean;
  shiftTone?: DcbTileTone;
  volLabel?: string;
  volValue?: string;
  volActive?: boolean;
  volTone?: DcbTileTone;
  historyLabel?: string;
  historyValue?: string;
  historyActive?: boolean;
  historyTone?: DcbTileTone;
  historyRateLabel?: string;
  historyRateValue?: string;
  historyRateActive?: boolean;
  historyRateTone?: DcbTileTone;
  ptlLabel?: string;
  ptlSubLabel?: string;
  ptlValue?: string;
  ptlActive?: boolean;
  ptlTone?: DcbTileTone;
  ptlOwnLabel?: string;
  ptlOwnSubLabel?: string;
  ptlOwnActive?: boolean;
  ptlOwnTone?: DcbTileTone;
  ptlAllLabel?: string;
  ptlAllSubLabel?: string;
  ptlAllActive?: boolean;
  ptlAllTone?: DcbTileTone;
  atpaLabel?: string;
  atpaSubLabel?: string;
  atpaActive?: boolean;
  atpaTone?: DcbTileTone;
}

export interface DcbBriteMenuButton {
  top: string;
  bottom: string;
  active?: boolean;
  tone?: DcbTileTone;
  textColor?: string;
}

export interface DcbBriteInput {
  x: number;
  y: number;
  label?: string;
  active?: boolean;
  tone?: DcbTileTone;
  expanded?: boolean;
  topRow?: DcbBriteMenuButton[];
  bottomRow?: DcbBriteMenuButton[];
}

export interface DcbSsaFilterMenuButton {
  top: string;
  bottom: string;
  active?: boolean;
  tone?: DcbTileTone;
  textColor?: string;
}

export interface DcbSsaFilterInput {
  x: number;
  y: number;
  expanded?: boolean;
  topRow?: DcbSsaFilterMenuButton[];
  bottomRow?: DcbSsaFilterMenuButton[];
  doneActive?: boolean;
  doneTone?: DcbTileTone;
  doneTextColor?: string;
}

export interface DcbSiteMenuButton {
  siteId?: string;
  top: string;
  bottom: string;
  active?: boolean;
  tone?: DcbTileTone;
  textColor?: string;
}

export interface DcbSiteMenuInput {
  x: number;
  y: number;
  expanded?: boolean;
  buttons?: DcbSiteMenuButton[];
  doneActive?: boolean;
  doneTone?: DcbTileTone;
  doneTextColor?: string;
}

export interface DcbAtpaMenuButton {
  control?: Extract<
    DcbAtpaControlHit,
    "atpa-mileage" | "atpa-intrail" | "atpa-alert-cones" | "atpa-monitor-cones"
  >;
  lines: string[];
  active?: boolean;
  tone?: DcbTileTone;
  textColor?: string;
}

export interface DcbAtpaMenuInput {
  x: number;
  y: number;
  expanded?: boolean;
  buttons?: DcbAtpaMenuButton[];
  doneActive?: boolean;
  doneTone?: DcbTileTone;
  doneTextColor?: string;
}

export interface DcbColors {
  text: string;
  inactive: string;
  active: string;
  wxInactive: string;
  wxActive: string;
  gray: string;
  borderDark: string;
  borderLight: string;
}

export interface DcbCreateOptions {
  fontBasePath?: string;
  colors?: Partial<DcbColors>;
}

const MAPS_BIG_BUTTON_WIDTH = 60;
const MAPS_BIG_BUTTON_HEIGHT = 60;
const MAPS_SMALL_BUTTON_WIDTH = 60;
const MAPS_SMALL_BUTTON_HEIGHT = 30;
const MAPS_BUTTON_GAP_PX = 0;
const DCB_BEVEL_WIDTH_PX = 3;
const RANGE_COLUMN_X = 0;
const PLACE_CNTR_COLUMN_X = RANGE_COLUMN_X + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
const RR_COLUMN_X = PLACE_CNTR_COLUMN_X + MAPS_SMALL_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
const PLACE_RR_COLUMN_X = RR_COLUMN_X + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
const MAPS_COLUMN_X = PLACE_RR_COLUMN_X + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
const MAPS_SMALL_COLUMNS_X =
  MAPS_COLUMN_X + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
export const DCB_MAPS_CATEGORY_WIDTH_PX =
  MAPS_SMALL_COLUMNS_X + 3 * MAPS_SMALL_BUTTON_WIDTH + 2 * MAPS_BUTTON_GAP_PX;
const WX_BUTTON_WIDTH = MAPS_SMALL_BUTTON_WIDTH / 2;
const WX_BUTTON_HEIGHT = MAPS_BIG_BUTTON_HEIGHT;
const WX_BUTTON_GAP_PX = MAPS_BUTTON_GAP_PX;
const BRITE_MENU_COLUMNS = 9;
const BRITE_DCB_COLUMN_INDEX = 0;
const BRITE_MPA_COLUMN_INDEX = 1;
const BRITE_FDB_COLUMN_INDEX = 2;
const BRITE_POS_COLUMN_INDEX = 3;
const BRITE_LST_COLUMN_INDEX = 2;
const BRITE_TLS_COLUMN_INDEX = 4;
const BRITE_RR_COLUMN_INDEX = 5;
const BRITE_HST_COLUMN_INDEX = 7;
const BRITE_WXC_COLUMN_INDEX = 8;
const BRITE_CMP_COLUMN_INDEX = 5;
const BRITE_PRI_COLUMN_INDEX = 6;
const BRITE_WX_COLUMN_INDEX = 7;

export type DcbRangeRingControlHit =
  | "rr"
  | "place-cntr"
  | "off-cntr"
  | "place-rr"
  | "rr-cntr";
export type DcbLeaderControlHit = "ldr-dir" | "ldr-length";
export type DcbAuxControlHit =
  | "shift"
  | "vol"
  | "history"
  | "ptl"
  | "ptl-own"
  | "atpa-toggle";
export type DcbBriteControlHit =
  | "brite-toggle"
  | "brite-menu"
  | "brite-done"
  | "brite-dcb"
  | "brite-rr"
  | "brite-mpa"
  | "brite-fdb"
  | "brite-pos"
  | "brite-mpb"
  | "brite-cmp"
  | "brite-lst"
  | "brite-tls"
  | "brite-pri"
  | "brite-hst"
  | "brite-wxc"
  | "brite-wx";

export type DcbMapsControlHit =
  | "maps-toggle"
  | "maps-menu"
  | "maps-done"
  | "maps-clear-all"
  | "maps-current"
  | "maps-map";

export type DcbSsaFilterControlHit =
  | "ssa-filter-toggle"
  | "ssa-filter-menu"
  | "ssa-filter-done"
  | "ssa-filter-status"
  | "ssa-filter-radar"
  | "ssa-filter-altstg"
  | "ssa-filter-alt-fil"
  | "ssa-filter-time"
  | "ssa-filter-wx";

export type DcbSiteControlHit =
  | "site-toggle"
  | "site-menu"
  | "site-done"
  | "site-select";

export type DcbAtpaControlHit =
  | "atpa-toggle"
  | "atpa-menu"
  | "atpa-done"
  | "atpa-mileage"
  | "atpa-intrail"
  | "atpa-alert-cones"
  | "atpa-monitor-cones";

interface DcbMapTileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DcbMapTile extends DcbMapTileRect {
  mapId: number | null;
}

interface DcbRangeRingControlTile extends DcbMapTileRect {
  control: DcbRangeRingControlHit;
}

interface DcbWxTile extends DcbMapTileRect {
  level: number;
}

interface DcbLeaderControlTile extends DcbMapTileRect {
  control: DcbLeaderControlHit;
}

interface DcbAuxControlTile extends DcbMapTileRect {
  control: DcbAuxControlHit;
}

interface DcbBriteMenuTile extends DcbMapTileRect {
  control: DcbBriteControlHit;
}

interface DcbMapsMenuTile extends DcbMapTileRect {
  control: DcbMapsControlHit;
  mapId: number | null;
}

interface DcbSsaFilterMenuTile extends DcbMapTileRect {
  control: DcbSsaFilterControlHit;
}

interface DcbSiteMenuTile extends DcbMapTileRect {
  control: DcbSiteControlHit;
  siteId: string | null;
}

interface DcbAtpaMenuTile extends DcbMapTileRect {
  control: DcbAtpaControlHit;
}

const DEFAULT_DCB_COLORS: DcbColors = {
  text: colors.WHITE,
  inactive: colors.DCB_INACTIVE,
  active: colors.DCB_ACTIVE,
  wxInactive: colors.DCB_WX_INACTIVE,
  wxActive: colors.DCB_WX_ACTIVE,
  gray: colors.DCB_GRAY,
  borderDark: colors.BLACK,
  borderLight: colors.DCB_GRAY
};

function measureBitmapTextWidth(font: LoadedBitmapFont, text: string): number {
  let width = 0;
  const fallbackIndex = "?".charCodeAt(0);
  const fallback = font.metrics[fallbackIndex] ?? font.metrics[0];

  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const metric = font.metrics[code] ?? fallback;
    if (!metric) {
      continue;
    }
    width += metric.stepX;
  }

  return width;
}

function drawTintedBitmapText(
  ctx: CanvasRenderingContext2D,
  font: LoadedBitmapFont,
  x0: number,
  y0: number,
  text: string,
  tintColor: string
): void {
  let x = x0;
  let y = y0;
  const fontHeight = font.height;
  const fallbackIndex = "?".charCodeAt(0);
  const fallback = font.metrics[fallbackIndex] ?? font.metrics[0];

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\n") {
      x = x0;
      y += fontHeight;
      continue;
    }

    const code = text.charCodeAt(i);
    const metric = font.metrics[code] ?? fallback;
    if (!metric) {
      continue;
    }

    if (metric.w > 0 && metric.h > 0) {
      const glyphCanvas = getTintedGlyphCanvas(font, metric, tintColor);
      if (!glyphCanvas) {
        continue;
      }

      const dx = Math.round(x + metric.offX);
      const dy = Math.round(y + (fontHeight - metric.offY - metric.h));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(glyphCanvas, dx, dy);
    }

    x += metric.stepX;
  }
}

function resolveButtonFillColor(
  palette: DcbColors,
  active: boolean | undefined,
  tone: DcbTileTone | undefined
): string {
  if (tone === "wx") {
    return active ? palette.wxActive : palette.wxInactive;
  }
  if (tone === "gray") {
    return palette.gray;
  }
  return active ? palette.active : palette.inactive;
}

function pointInsideRect(px: number, py: number, rect: DcbMapTileRect): boolean {
  return px >= rect.x && py >= rect.y && px <= rect.x + rect.width && py <= rect.y + rect.height;
}

function drawButtonFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: string,
  palette: DcbColors,
  pressed = false
): void {
  const pxX = Math.round(x);
  const pxY = Math.round(y);
  const pxW = Math.max(1, Math.round(width));
  const pxH = Math.max(1, Math.round(height));
  const bevelWidth = Math.max(
    1,
    Math.min(DCB_BEVEL_WIDTH_PX, Math.floor(Math.min(pxW, pxH) / 2))
  );
  const lightEdgeColor = pressed ? palette.borderDark : palette.borderLight;
  const darkEdgeColor = pressed ? palette.borderLight : palette.borderDark;

  ctx.fillStyle = fillColor;
  ctx.fillRect(pxX, pxY, pxW, pxH);

  // STARS-style bevel: top/left are light while bottom/right are dark.
  // Use 45-degree corner transitions at the two tone boundaries and ensure
  // the full bevel band is covered by bevel colors (no fill color bleed-through).
  ctx.fillStyle = lightEdgeColor;
  ctx.fillRect(pxX, pxY, pxW, bevelWidth);
  ctx.fillRect(pxX, pxY, bevelWidth, pxH);

  ctx.fillStyle = darkEdgeColor;
  ctx.fillRect(pxX, pxY + pxH - bevelWidth, pxW, bevelWidth);
  ctx.fillRect(pxX + pxW - bevelWidth, pxY, bevelWidth, pxH);

  // Top-right 45-degree transition (light -> dark).
  const topRightX = pxX + pxW - bevelWidth;
  const topRightY = pxY;
  ctx.fillStyle = lightEdgeColor;
  ctx.fillRect(topRightX, topRightY, bevelWidth, bevelWidth);
  ctx.fillStyle = darkEdgeColor;
  for (let row = 0; row < bevelWidth; row += 1) {
    const darkCount = row + 1;
    const darkStartX = topRightX + bevelWidth - darkCount;
    ctx.fillRect(darkStartX, topRightY + row, darkCount, 1);
  }

  // Bottom-left 45-degree transition (light -> dark).
  const bottomLeftX = pxX;
  const bottomLeftY = pxY + pxH - bevelWidth;
  ctx.fillStyle = lightEdgeColor;
  ctx.fillRect(bottomLeftX, bottomLeftY, bevelWidth, bevelWidth);
  ctx.fillStyle = darkEdgeColor;
  for (let row = 0; row < bevelWidth; row += 1) {
    const darkCount = row + 1;
    const darkStartX = bottomLeftX + bevelWidth - darkCount;
    ctx.fillRect(darkStartX, bottomLeftY + row, darkCount, 1);
  }
}

function drawCenteredLines(
  ctx: CanvasRenderingContext2D,
  font: LoadedBitmapFont,
  x: number,
  y: number,
  width: number,
  height: number,
  lines: string[],
  textColor: string
): void {
  const validLines = lines
    .map((line) => line.trim().toUpperCase())
    .filter((line) => line.length > 0);
  if (validLines.length === 0) {
    return;
  }

  const totalTextHeight = validLines.length * font.height;
  const startY = Math.round(y + (height - totalTextHeight) * 0.5);

  for (let i = 0; i < validLines.length; i += 1) {
    const line = validLines[i];
    const lineWidth = measureBitmapTextWidth(font, line);
    const lineX = Math.round(x + (width - lineWidth) * 0.5);
    const lineY = startY + i * font.height;
    drawTintedBitmapText(ctx, font, lineX, lineY, line, textColor);
  }
}

export class StarsDcbRenderer {
  private constructor(
    private readonly font: LoadedBitmapFont,
    private palette: DcbColors
  ) {}

  static async create(options: DcbCreateOptions = {}): Promise<StarsDcbRenderer> {
    const fontBasePath = options.fontBasePath ?? "/font/sddCharFontSetASize1";
    const font = await loadBitmapFont(fontBasePath);
    return new StarsDcbRenderer(font, { ...DEFAULT_DCB_COLORS, ...(options.colors ?? {}) });
  }

  setButtonToneColors(colors: {
    text: string;
    inactive: string;
    active: string;
    wxInactive: string;
    wxActive: string;
  }): void {
    this.palette.text = colors.text;
    this.palette.inactive = colors.inactive;
    this.palette.active = colors.active;
    this.palette.wxInactive = colors.wxInactive;
    this.palette.wxActive = colors.wxActive;
  }

  private getMapsTiles(input: DcbMapCategoryInput): DcbMapTile[] {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const topRow = input.topRow.slice(0, 3);
    const bottomRow = input.bottomRow.slice(0, 3);
    const tiles: DcbMapTile[] = [];
    const mapsX = originX + MAPS_SMALL_COLUMNS_X;

    for (let i = 0; i < 3; i += 1) {
      const columnX =
        mapsX + i * (MAPS_SMALL_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      const top = topRow[i] ?? null;
      const bottom = bottomRow[i] ?? null;
      tiles.push({
        x: columnX,
        y: originY,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        mapId: top?.mapId ?? null
      });
      tiles.push({
        x: columnX,
        y: originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        mapId: bottom?.mapId ?? null
      });
    }

    return tiles;
  }

  private getRangeRingControlTiles(input: DcbMapCategoryInput): DcbRangeRingControlTile[] {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const placeCntrX = originX + PLACE_CNTR_COLUMN_X;
    const rrX = originX + RR_COLUMN_X;
    const placeRrX = originX + PLACE_RR_COLUMN_X;
    return [
      {
        x: rrX,
        y: originY,
        width: MAPS_BIG_BUTTON_WIDTH,
        height: MAPS_BIG_BUTTON_HEIGHT,
        control: "rr"
      },
      {
        x: placeCntrX,
        y: originY,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: "place-cntr"
      },
      {
        x: placeCntrX,
        y: originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: "off-cntr"
      },
      {
        x: placeRrX,
        y: originY,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: "place-rr"
      },
      {
        x: placeRrX,
        y: originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: "rr-cntr"
      }
    ];
  }

  private getWxTiles(input: DcbWxLevelsInput): DcbWxTile[] {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const buttons = input.buttons.slice(0, 6);
    const tiles: DcbWxTile[] = [];

    for (let i = 0; i < buttons.length; i += 1) {
      tiles.push({
        x: originX + i * (WX_BUTTON_WIDTH + WX_BUTTON_GAP_PX),
        y: originY,
        width: WX_BUTTON_WIDTH,
        height: WX_BUTTON_HEIGHT,
        level: i + 1
      });
    }

    return tiles;
  }

  private getLeaderControlTiles(input: DcbLeaderControlsInput): DcbLeaderControlTile[] {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    return [
      {
        x: originX,
        y: originY,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: "ldr-dir"
      },
      {
        x: originX,
        y: originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: "ldr-length"
      }
    ];
  }

  private getAuxControlTiles(input: DcbAuxControlsInput): DcbAuxControlTile[] {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const secondPage = Boolean(input.secondPage);
    if (secondPage) {
      return [
        {
          x: originX,
          y: originY,
          width: MAPS_BIG_BUTTON_WIDTH,
          height: MAPS_BIG_BUTTON_HEIGHT,
          control: "vol"
        },
        {
          x: originX + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX,
          y: originY,
          width: MAPS_BIG_BUTTON_WIDTH,
          height: MAPS_SMALL_BUTTON_HEIGHT,
          control: "history"
        },
        {
          x: originX + (MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX) * 2,
          y: originY,
          width: MAPS_BIG_BUTTON_WIDTH,
          height: MAPS_BIG_BUTTON_HEIGHT,
          control: "ptl"
        },
        {
          x: originX + (MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX) * 3,
          y: originY,
          width: MAPS_BIG_BUTTON_WIDTH,
          height: MAPS_SMALL_BUTTON_HEIGHT,
          control: "ptl-own"
        },
        {
          x: originX + (MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX) * 4,
          y: originY,
          width: MAPS_BIG_BUTTON_WIDTH,
          height: MAPS_BIG_BUTTON_HEIGHT,
          control: "atpa-toggle"
        },
        {
          x: originX + (MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX) * 5,
          y: originY,
          width: MAPS_BIG_BUTTON_WIDTH,
          height: MAPS_BIG_BUTTON_HEIGHT,
          control: "shift"
        }
      ];
    }

    const modeX = originX + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
    const siteMultiX = modeX + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
    const prefX = siteMultiX + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
    const filterX = prefX + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
    const shiftX = filterX + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;

    return [
      {
        x: shiftX,
        y: originY,
        width: MAPS_BIG_BUTTON_WIDTH,
        height: MAPS_BIG_BUTTON_HEIGHT,
        control: "shift"
      }
    ];
  }

  private getBriteMenuTiles(input: DcbBriteInput): DcbBriteMenuTile[] {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const tiles: DcbBriteMenuTile[] = [
      {
        x: originX,
        y: originY,
        width: MAPS_BIG_BUTTON_WIDTH,
        height: MAPS_BIG_BUTTON_HEIGHT,
        control: "brite-toggle"
      }
    ];

    if (!input.expanded) {
      return tiles;
    }

    const menuOriginX = originX + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
    for (let i = 0; i < BRITE_MENU_COLUMNS; i += 1) {
      const columnX = menuOriginX + i * (MAPS_SMALL_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      tiles.push({
        x: columnX,
        y: originY,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control:
          i === BRITE_DCB_COLUMN_INDEX
            ? "brite-dcb"
            : i === BRITE_RR_COLUMN_INDEX
            ? "brite-rr"
            : i === BRITE_MPA_COLUMN_INDEX
              ? "brite-mpa"
            : i === BRITE_FDB_COLUMN_INDEX
              ? "brite-fdb"
            : i === BRITE_POS_COLUMN_INDEX
              ? "brite-pos"
              : i === BRITE_HST_COLUMN_INDEX
                ? "brite-hst"
                : i === BRITE_WXC_COLUMN_INDEX
                  ? "brite-wxc"
              : "brite-menu"
      });
      tiles.push({
        x: columnX,
        y: originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control:
          i === BRITE_MENU_COLUMNS - 1
            ? "brite-done"
            : i === BRITE_MPA_COLUMN_INDEX
              ? "brite-mpb"
            : i === BRITE_CMP_COLUMN_INDEX
              ? "brite-cmp"
            : i === BRITE_PRI_COLUMN_INDEX
              ? "brite-pri"
            : i === BRITE_TLS_COLUMN_INDEX
              ? "brite-tls"
            : i === BRITE_LST_COLUMN_INDEX
              ? "brite-lst"
            : i === BRITE_WX_COLUMN_INDEX
              ? "brite-wx"
              : "brite-menu"
      });
    }

    return tiles;
  }

  private resolveMapsMenuButtonControl(button: DcbMapsMenuButton | null): {
    control: DcbMapsControlHit;
    mapId: number | null;
  } {
    if (!button) {
      return { control: "maps-menu", mapId: null };
    }

    const mapId = Number(button.mapId);
    if (Number.isFinite(mapId)) {
      return { control: "maps-map", mapId: Math.floor(mapId) };
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

  private getMapsMenuMetrics(input: DcbMapsMenuInput): {
    originX: number;
    originY: number;
    columns: number;
    menuOriginX: number;
    menuWidth: number;
    menuHeight: number;
  } {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const topCount = (input.topRow ?? []).length;
    const bottomCount = (input.bottomRow ?? []).length;
    const columns = Math.max(0, Math.max(topCount, bottomCount));
    const menuOriginX = originX + MAPS_COLUMN_X + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
    const menuWidth =
      columns <= 0
        ? 0
        : columns * MAPS_SMALL_BUTTON_WIDTH + (columns - 1) * MAPS_BUTTON_GAP_PX;
    const menuHeight = MAPS_SMALL_BUTTON_HEIGHT * 2 + MAPS_BUTTON_GAP_PX;
    return { originX, originY, columns, menuOriginX, menuWidth, menuHeight };
  }

  private getMapsMenuTiles(input: DcbMapsMenuInput): DcbMapsMenuTile[] {
    const { originX, originY, columns, menuOriginX } = this.getMapsMenuMetrics(input);
    const tiles: DcbMapsMenuTile[] = [
      {
        x: originX + MAPS_COLUMN_X,
        y: originY,
        width: MAPS_BIG_BUTTON_WIDTH,
        height: MAPS_BIG_BUTTON_HEIGHT,
        control: "maps-toggle",
        mapId: null
      }
    ];

    if (!input.expanded || columns <= 0) {
      return tiles;
    }

    const topRow = input.topRow ?? [];
    const bottomRow = input.bottomRow ?? [];

    for (let i = 0; i < columns; i += 1) {
      const columnX = menuOriginX + i * (MAPS_SMALL_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      const top = this.resolveMapsMenuButtonControl(topRow[i] ?? null);
      const bottom = this.resolveMapsMenuButtonControl(bottomRow[i] ?? null);
      tiles.push({
        x: columnX,
        y: originY,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: top.control,
        mapId: top.mapId
      });
      tiles.push({
        x: columnX,
        y: originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: bottom.control,
        mapId: bottom.mapId
      });
    }

    return tiles;
  }

  private resolveSsaFilterMenuButtonControl(button: DcbSsaFilterMenuButton | null): DcbSsaFilterControlHit {
    if (!button) {
      return "ssa-filter-menu";
    }

    const normalized = `${button.top} ${button.bottom}`
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
    if (normalized === "DONE") {
      return "ssa-filter-done";
    }
    if (normalized === "TIME") {
      return "ssa-filter-time";
    }
    if (normalized === "STATUS") {
      return "ssa-filter-status";
    }
    if (normalized === "RADAR") {
      return "ssa-filter-radar";
    }
    if (normalized === "ALTSTG") {
      return "ssa-filter-altstg";
    }
    if (normalized === "ALT FIL") {
      return "ssa-filter-alt-fil";
    }
    if (normalized === "WX") {
      return "ssa-filter-wx";
    }

    return "ssa-filter-menu";
  }

  private getSsaFilterMenuMetrics(input: DcbSsaFilterInput): {
    originX: number;
    originY: number;
    columns: number;
    menuOriginX: number;
    menuWidth: number;
    menuHeight: number;
    toggleX: number;
    toggleY: number;
  } {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const topCount = (input.topRow ?? []).length;
    const bottomCount = (input.bottomRow ?? []).length;
    const columns = Math.max(0, Math.max(topCount, bottomCount));
    const toggleX =
      originX + MAPS_BIG_BUTTON_WIDTH * 4 + MAPS_BUTTON_GAP_PX * 4;
    const toggleY = originY;
    const stackedColumnsWidth =
      columns <= 0
        ? 0
        : columns * MAPS_SMALL_BUTTON_WIDTH + (columns - 1) * MAPS_BUTTON_GAP_PX;
    const menuWidth =
      stackedColumnsWidth > 0
        ? stackedColumnsWidth + MAPS_BUTTON_GAP_PX + MAPS_BIG_BUTTON_WIDTH
        : MAPS_BIG_BUTTON_WIDTH;
    const menuOriginX = toggleX - MAPS_BUTTON_GAP_PX - menuWidth;
    const menuHeight = MAPS_SMALL_BUTTON_HEIGHT * 2 + MAPS_BUTTON_GAP_PX;

    return {
      originX,
      originY,
      columns,
      menuOriginX,
      menuWidth,
      menuHeight,
      toggleX,
      toggleY
    };
  }

  private getSsaFilterMenuTiles(input: DcbSsaFilterInput): DcbSsaFilterMenuTile[] {
    const { originY, columns, menuOriginX, toggleX, toggleY } = this.getSsaFilterMenuMetrics(input);
    const tiles: DcbSsaFilterMenuTile[] = [
      {
        x: toggleX,
        y: toggleY,
        width: MAPS_BIG_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: "ssa-filter-toggle"
      },
      {
        x: toggleX,
        y: toggleY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        width: MAPS_BIG_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: "ssa-filter-menu"
      }
    ];

    if (!input.expanded) {
      return tiles;
    }

    const topRow = input.topRow ?? [];
    const bottomRow = input.bottomRow ?? [];
    const doneX =
      menuOriginX +
      (columns <= 0
        ? 0
        : columns * MAPS_SMALL_BUTTON_WIDTH + (columns - 1) * MAPS_BUTTON_GAP_PX + MAPS_BUTTON_GAP_PX);

    tiles.push({
      x: doneX,
      y: originY,
      width: MAPS_BIG_BUTTON_WIDTH,
      height: MAPS_BIG_BUTTON_HEIGHT,
      control: "ssa-filter-done"
    });

    if (columns <= 0) {
      return tiles;
    }

    for (let i = 0; i < columns; i += 1) {
      const columnX = menuOriginX + i * (MAPS_SMALL_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      const top = this.resolveSsaFilterMenuButtonControl(topRow[i] ?? null);
      const bottom = this.resolveSsaFilterMenuButtonControl(bottomRow[i] ?? null);
      tiles.push({
        x: columnX,
        y: originY,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: top
      });
      tiles.push({
        x: columnX,
        y: originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        width: MAPS_SMALL_BUTTON_WIDTH,
        height: MAPS_SMALL_BUTTON_HEIGHT,
        control: bottom
      });
    }

    return tiles;
  }

  private getSiteMenuMetrics(input: DcbSiteMenuInput): {
    originX: number;
    originY: number;
    toggleX: number;
    toggleY: number;
    buttonsCount: number;
    menuOriginX: number;
    menuWidth: number;
    menuHeight: number;
    doneX: number;
  } {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const toggleX =
      originX + MAPS_BIG_BUTTON_WIDTH * 2 + MAPS_BUTTON_GAP_PX * 2;
    const toggleY = originY;
    const buttonsCount = Math.max(0, (input.buttons ?? []).length);
    const menuColumns = buttonsCount + 1; // include DONE
    const menuWidth =
      menuColumns <= 0
        ? 0
        : menuColumns * MAPS_BIG_BUTTON_WIDTH + (menuColumns - 1) * MAPS_BUTTON_GAP_PX;
    const menuHeight = MAPS_BIG_BUTTON_HEIGHT;
    const menuOriginX = toggleX - MAPS_BUTTON_GAP_PX - menuWidth;
    const doneX =
      menuOriginX +
      (buttonsCount <= 0
        ? 0
        : buttonsCount * MAPS_BIG_BUTTON_WIDTH + buttonsCount * MAPS_BUTTON_GAP_PX);

    return {
      originX,
      originY,
      toggleX,
      toggleY,
      buttonsCount,
      menuOriginX,
      menuWidth,
      menuHeight,
      doneX
    };
  }

  private getSiteMenuTiles(input: DcbSiteMenuInput): DcbSiteMenuTile[] {
    const { originY, toggleX, toggleY, buttonsCount, menuOriginX } = this.getSiteMenuMetrics(input);
    const tiles: DcbSiteMenuTile[] = [
      {
        x: toggleX,
        y: toggleY,
        width: MAPS_BIG_BUTTON_WIDTH,
        height: MAPS_BIG_BUTTON_HEIGHT,
        control: "site-toggle",
        siteId: null
      }
    ];

    if (!input.expanded) {
      return tiles;
    }

    const buttons = input.buttons ?? [];
    for (let i = 0; i < buttonsCount; i += 1) {
      const buttonX = menuOriginX + i * (MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      const button = buttons[i] ?? null;
      tiles.push({
        x: buttonX,
        y: originY,
        width: MAPS_BIG_BUTTON_WIDTH,
        height: MAPS_BIG_BUTTON_HEIGHT,
        control: "site-select",
        siteId: typeof button?.siteId === "string" ? button.siteId : null
      });
    }

    const doneX =
      menuOriginX +
      (buttonsCount <= 0
        ? 0
        : buttonsCount * MAPS_BIG_BUTTON_WIDTH + buttonsCount * MAPS_BUTTON_GAP_PX);
    tiles.push({
      x: doneX,
      y: originY,
      width: MAPS_BIG_BUTTON_WIDTH,
      height: MAPS_BIG_BUTTON_HEIGHT,
      control: "site-done",
      siteId: null
    });

    return tiles;
  }

  private getAtpaMenuMetrics(input: DcbAtpaMenuInput): {
    originX: number;
    originY: number;
    toggleX: number;
    toggleY: number;
    buttonsCount: number;
    menuOriginX: number;
    menuWidth: number;
    menuHeight: number;
    doneX: number;
  } {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const toggleX = originX + MAPS_BIG_BUTTON_WIDTH * 4 + MAPS_BUTTON_GAP_PX * 4;
    const toggleY = originY;
    const buttonsCount = Math.max(0, (input.buttons ?? []).length);
    const menuColumns = buttonsCount + 1; // include DONE
    const menuWidth =
      menuColumns <= 0
        ? 0
        : menuColumns * MAPS_BIG_BUTTON_WIDTH + (menuColumns - 1) * MAPS_BUTTON_GAP_PX;
    const menuHeight = MAPS_BIG_BUTTON_HEIGHT;
    const menuOriginX = toggleX + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
    const doneX =
      menuOriginX +
      (buttonsCount <= 0
        ? 0
        : buttonsCount * MAPS_BIG_BUTTON_WIDTH + buttonsCount * MAPS_BUTTON_GAP_PX);

    return {
      originX,
      originY,
      toggleX,
      toggleY,
      buttonsCount,
      menuOriginX,
      menuWidth,
      menuHeight,
      doneX
    };
  }

  private getAtpaMenuTiles(input: DcbAtpaMenuInput): DcbAtpaMenuTile[] {
    const { originY, toggleX, toggleY, buttonsCount, menuOriginX } = this.getAtpaMenuMetrics(input);
    const tiles: DcbAtpaMenuTile[] = [
      {
        x: toggleX,
        y: toggleY,
        width: MAPS_BIG_BUTTON_WIDTH,
        height: MAPS_BIG_BUTTON_HEIGHT,
        control: "atpa-toggle"
      }
    ];

    if (!input.expanded) {
      return tiles;
    }

    const buttons = input.buttons ?? [];
    for (let i = 0; i < buttonsCount; i += 1) {
      const buttonX = menuOriginX + i * (MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      const button = buttons[i];
      tiles.push({
        x: buttonX,
        y: originY,
        width: MAPS_BIG_BUTTON_WIDTH,
        height: MAPS_BIG_BUTTON_HEIGHT,
        control: button?.control ?? "atpa-menu"
      });
    }

    const doneX =
      menuOriginX +
      (buttonsCount <= 0
        ? 0
        : buttonsCount * MAPS_BIG_BUTTON_WIDTH + buttonsCount * MAPS_BUTTON_GAP_PX);
    tiles.push({
      x: doneX,
      y: originY,
      width: MAPS_BIG_BUTTON_WIDTH,
      height: MAPS_BIG_BUTTON_HEIGHT,
      control: "atpa-done"
    });

    return tiles;
  }

  hitTestMapsCategory(input: DcbMapCategoryInput, x: number, y: number): number | null {
    const tiles = this.getMapsTiles(input);
    for (const tile of tiles) {
      if (!pointInsideRect(x, y, tile)) {
        continue;
      }
      return tile.mapId;
    }
    return null;
  }

  hitTestRangeRingControls(
    input: DcbMapCategoryInput,
    x: number,
    y: number
  ): DcbRangeRingControlHit | null {
    const tiles = this.getRangeRingControlTiles(input);
    for (const tile of tiles) {
      if (!pointInsideRect(x, y, tile)) {
        continue;
      }
      return tile.control;
    }
    return null;
  }

  hitTestWxLevels(input: DcbWxLevelsInput, x: number, y: number): number | null {
    const tiles = this.getWxTiles(input);
    for (const tile of tiles) {
      if (!pointInsideRect(x, y, tile)) {
        continue;
      }
      return tile.level;
    }
    return null;
  }

  hitTestLeaderControls(
    input: DcbLeaderControlsInput,
    x: number,
    y: number
  ): DcbLeaderControlHit | null {
    const tiles = this.getLeaderControlTiles(input);
    for (const tile of tiles) {
      if (!pointInsideRect(x, y, tile)) {
        continue;
      }
      return tile.control;
    }
    return null;
  }

  hitTestAuxControls(
    input: DcbAuxControlsInput,
    x: number,
    y: number
  ): DcbAuxControlHit | null {
    const tiles = this.getAuxControlTiles(input);
    for (const tile of tiles) {
      if (!pointInsideRect(x, y, tile)) {
        continue;
      }
      return tile.control;
    }
    return null;
  }

  hitTestBrite(input: DcbBriteInput, x: number, y: number): DcbBriteControlHit | null {
    const tiles = this.getBriteMenuTiles(input);
    for (const tile of tiles) {
      if (!pointInsideRect(x, y, tile)) {
        continue;
      }
      return tile.control;
    }
    return null;
  }

  hitTestMapsMenu(
    input: DcbMapsMenuInput,
    x: number,
    y: number
  ): { control: DcbMapsControlHit; mapId: number | null } | null {
    const tiles = this.getMapsMenuTiles(input);
    for (const tile of tiles) {
      if (!pointInsideRect(x, y, tile)) {
        continue;
      }
      return { control: tile.control, mapId: tile.mapId };
    }

    if (!input.expanded) {
      return null;
    }

    const metrics = this.getMapsMenuMetrics(input);
    if (metrics.columns <= 0 || metrics.menuWidth <= 0) {
      return null;
    }
    const menuRect: DcbMapTileRect = {
      x: metrics.menuOriginX,
      y: metrics.originY,
      width: metrics.menuWidth,
      height: metrics.menuHeight
    };
    if (pointInsideRect(x, y, menuRect)) {
      return { control: "maps-menu", mapId: null };
    }

    return null;
  }

  hitTestSsaFilterMenu(
    input: DcbSsaFilterInput,
    x: number,
    y: number
  ): DcbSsaFilterControlHit | null {
    const tiles = this.getSsaFilterMenuTiles(input);
    for (const tile of tiles) {
      if (!pointInsideRect(x, y, tile)) {
        continue;
      }
      return tile.control;
    }

    if (!input.expanded) {
      return null;
    }

    const metrics = this.getSsaFilterMenuMetrics(input);
    if (metrics.columns <= 0 || metrics.menuWidth <= 0) {
      return null;
    }
    const menuRect: DcbMapTileRect = {
      x: metrics.menuOriginX,
      y: metrics.originY,
      width: metrics.menuWidth,
      height: metrics.menuHeight
    };
    if (pointInsideRect(x, y, menuRect)) {
      return "ssa-filter-menu";
    }

    return null;
  }

  hitTestSiteMenu(
    input: DcbSiteMenuInput,
    x: number,
    y: number
  ): { control: DcbSiteControlHit; siteId: string | null } | null {
    const tiles = this.getSiteMenuTiles(input);
    for (const tile of tiles) {
      if (!pointInsideRect(x, y, tile)) {
        continue;
      }
      return { control: tile.control, siteId: tile.siteId };
    }

    if (!input.expanded) {
      return null;
    }

    const metrics = this.getSiteMenuMetrics(input);
    if (metrics.menuWidth <= 0) {
      return null;
    }
    const menuRect: DcbMapTileRect = {
      x: metrics.menuOriginX,
      y: metrics.originY,
      width: metrics.menuWidth,
      height: metrics.menuHeight
    };
    if (pointInsideRect(x, y, menuRect)) {
      return { control: "site-menu", siteId: null };
    }

    return null;
  }

  hitTestAtpaMenu(
    input: DcbAtpaMenuInput,
    x: number,
    y: number
  ): DcbAtpaControlHit | null {
    const tiles = this.getAtpaMenuTiles(input);
    for (const tile of tiles) {
      if (!pointInsideRect(x, y, tile)) {
        continue;
      }
      return tile.control;
    }

    if (!input.expanded) {
      return null;
    }

    const metrics = this.getAtpaMenuMetrics(input);
    if (metrics.menuWidth <= 0) {
      return null;
    }
    const menuRect: DcbMapTileRect = {
      x: metrics.menuOriginX,
      y: metrics.originY,
      width: metrics.menuWidth,
      height: metrics.menuHeight
    };
    if (pointInsideRect(x, y, menuRect)) {
      return "atpa-menu";
    }

    return null;
  }

  drawMapsCategory(ctx: CanvasRenderingContext2D, input: DcbMapCategoryInput): void {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const rangeX = originX + RANGE_COLUMN_X;
    const placeCntrX = originX + PLACE_CNTR_COLUMN_X;
    const rrX = originX + RR_COLUMN_X;
    const placeRrX = originX + PLACE_RR_COLUMN_X;
    const mapsX = originX + MAPS_COLUMN_X;
    const mapsSmallX = originX + MAPS_SMALL_COLUMNS_X;

    // Left-most RANGE tile (same 60x60 footprint as MAPS).
    drawButtonFrame(
      ctx,
      rangeX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.rangeActive, input.rangeTone),
      this.palette,
      Boolean(input.rangeActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      rangeX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      [input.rangeLabel ?? "RANGE", input.rangeValue ?? ""],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      placeCntrX,
      originY,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.placeCntrActive, input.placeCntrTone ?? "normal"),
      this.palette,
      Boolean(input.placeCntrActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      placeCntrX,
      originY,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      [input.placeCntrTop ?? "PLACE", input.placeCntrBottom ?? "CNTR"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      placeCntrX,
      originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.offCntrActive, input.offCntrTone ?? "normal"),
      this.palette,
      Boolean(input.offCntrActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      placeCntrX,
      originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      [input.offCntrTop ?? "OFF", input.offCntrBottom ?? "CNTR"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      rrX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.rrActive, input.rrTone),
      this.palette,
      Boolean(input.rrActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      rrX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      [input.rrLabel ?? "RR", input.rrValue ?? "10"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      placeRrX,
      originY,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.placeRrActive, input.placeRrTone),
      this.palette,
      Boolean(input.placeRrActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      placeRrX,
      originY,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      [input.placeRrTop ?? "PLACE", input.placeRrBottom ?? "RR"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      placeRrX,
      originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.rrCntrActive, input.rrCntrTone ?? "normal"),
      this.palette,
      Boolean(input.rrCntrActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      placeRrX,
      originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      [input.rrCntrTop ?? "RR", input.rrCntrBottom ?? "CNTR"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      mapsX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.mapsActive, input.mapsTone),
      this.palette,
      Boolean(input.mapsActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      mapsX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      [input.mapsLabel ?? "MAPS"],
      this.palette.text
    );

    const topRow = input.topRow.slice(0, 3);
    const bottomRow = input.bottomRow.slice(0, 3);
    for (let i = 0; i < 3; i += 1) {
      const columnX =
        mapsSmallX + i * (MAPS_SMALL_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      const top = topRow[i] ?? { top: "", bottom: "", active: false, tone: "normal" };
      const bottom = bottomRow[i] ?? { top: "", bottom: "", active: false, tone: "normal" };

      drawButtonFrame(
        ctx,
        columnX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, top.active, top.tone),
        this.palette,
        Boolean(top.active)
      );
      drawCenteredLines(
        ctx,
        this.font,
        columnX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [top.top, top.bottom],
        this.palette.text
      );

      drawButtonFrame(
        ctx,
        columnX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, bottom.active, bottom.tone),
        this.palette,
        Boolean(bottom.active)
      );
      drawCenteredLines(
        ctx,
        this.font,
        columnX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [bottom.top, bottom.bottom],
        this.palette.text
      );
    }
  }

  drawWxLevels(ctx: CanvasRenderingContext2D, input: DcbWxLevelsInput): void {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const buttons = input.buttons.slice(0, 6);

    for (let i = 0; i < buttons.length; i += 1) {
      const button = buttons[i];
      const x = originX + i * (WX_BUTTON_WIDTH + WX_BUTTON_GAP_PX);
      const label = button.label.trim().toUpperCase() || `WX${i + 1}`;
      const tone = button.tone ?? "wx";
      const lines = tone === "wx" ? [label, "AVL"] : [label];

      drawButtonFrame(
        ctx,
        x,
        originY,
        WX_BUTTON_WIDTH,
        WX_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, button.active, tone),
        this.palette,
        Boolean(button.active)
      );
      drawCenteredLines(
        ctx,
        this.font,
        x,
        originY,
        WX_BUTTON_WIDTH,
        WX_BUTTON_HEIGHT,
        lines,
        this.palette.text
      );
    }
  }

  drawLeaderControls(ctx: CanvasRenderingContext2D, input: DcbLeaderControlsInput): void {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);

    drawButtonFrame(
      ctx,
      originX,
      originY,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.directionActive, input.directionTone),
      this.palette,
      Boolean(input.directionActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      originX,
      originY,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      [input.directionLabel ?? "LDR DIR", input.directionValue ?? "N"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      originX,
      originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.lengthActive, input.lengthTone),
      this.palette,
      Boolean(input.lengthActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      originX,
      originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      [input.lengthLabel ?? "LDR", input.lengthValue ?? "1"],
      this.palette.text
    );
  }

  drawAuxControls(ctx: CanvasRenderingContext2D, input: DcbAuxControlsInput): void {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);
    const secondPage = Boolean(input.secondPage);
    const buttonGap = MAPS_BUTTON_GAP_PX;

    if (secondPage) {
      const volX = originX;
      const historyX = originX + MAPS_BIG_BUTTON_WIDTH + buttonGap;
      const ptlX = historyX + MAPS_BIG_BUTTON_WIDTH + buttonGap;
      const ptlModeX = ptlX + MAPS_BIG_BUTTON_WIDTH + buttonGap;
      const atpaX = ptlModeX + MAPS_BIG_BUTTON_WIDTH + buttonGap;
      const shiftPageX = atpaX + MAPS_BIG_BUTTON_WIDTH + buttonGap;

      drawButtonFrame(
        ctx,
        volX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, input.volActive, input.volTone),
        this.palette,
        Boolean(input.volActive)
      );
      drawCenteredLines(
        ctx,
        this.font,
        volX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        [input.volLabel ?? "VOL", input.volValue ?? ""],
        this.palette.text
      );

      drawButtonFrame(
        ctx,
        historyX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, input.historyActive, input.historyTone),
        this.palette,
        Boolean(input.historyActive)
      );
      drawCenteredLines(
        ctx,
        this.font,
        historyX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [input.historyLabel ?? "HISTORY", input.historyValue ?? "5"],
        this.palette.text
      );

      drawButtonFrame(
        ctx,
        historyX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, input.historyRateActive, input.historyRateTone),
        this.palette,
        Boolean(input.historyRateActive)
      );
      drawCenteredLines(
        ctx,
        this.font,
        historyX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [input.historyRateLabel ?? "H_RATE", input.historyRateValue ?? "4.5"],
        this.palette.text
      );

      drawButtonFrame(
        ctx,
        ptlX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, input.ptlActive, input.ptlTone),
        this.palette,
        Boolean(input.ptlActive)
      );
      drawCenteredLines(
        ctx,
        this.font,
        ptlX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        [input.ptlLabel ?? "PTL", input.ptlSubLabel ?? "LNTH", input.ptlValue ?? "1.0"],
        this.palette.text
      );

      drawButtonFrame(
        ctx,
        ptlModeX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, input.ptlOwnActive, input.ptlOwnTone),
        this.palette,
        Boolean(input.ptlOwnActive)
      );
      drawCenteredLines(
        ctx,
        this.font,
        ptlModeX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [`${input.ptlOwnLabel ?? "PTL"} ${input.ptlOwnSubLabel ?? "OWN"}`],
        this.palette.text
      );

      drawButtonFrame(
        ctx,
        ptlModeX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, input.ptlAllActive, input.ptlAllTone),
        this.palette,
        Boolean(input.ptlAllActive)
      );
      drawCenteredLines(
        ctx,
        this.font,
        ptlModeX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [`${input.ptlAllLabel ?? "PTL"} ${input.ptlAllSubLabel ?? "ALL"}`],
        this.palette.text
      );

      drawButtonFrame(
        ctx,
        atpaX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, input.atpaActive, input.atpaTone),
        this.palette,
        Boolean(input.atpaActive)
      );
      drawCenteredLines(
        ctx,
        this.font,
        atpaX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        [input.atpaLabel ?? "TPA/", input.atpaSubLabel ?? "ATPA"],
        this.palette.text
      );

      drawButtonFrame(
        ctx,
        shiftPageX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, input.shiftActive, input.shiftTone),
        this.palette,
        Boolean(input.shiftActive)
      );
      drawCenteredLines(
        ctx,
        this.font,
        shiftPageX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        [input.shiftLabel ?? "SHIFT"],
        this.palette.text
      );
      return;
    }

    const modeX = originX + MAPS_BIG_BUTTON_WIDTH + buttonGap;
    const siteMultiX = modeX + MAPS_BIG_BUTTON_WIDTH + buttonGap;
    const prefX = siteMultiX + MAPS_BIG_BUTTON_WIDTH + buttonGap;
    const filterX = prefX + MAPS_BIG_BUTTON_WIDTH + buttonGap;
    const shiftX = filterX + MAPS_BIG_BUTTON_WIDTH + buttonGap;

    drawButtonFrame(
      ctx,
      originX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.charSizeActive, input.charSizeTone),
      this.palette,
      Boolean(input.charSizeActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      originX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      [input.charSizeTop ?? "CHAR", input.charSizeBottom ?? "SIZE"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      modeX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.modeActive, input.modeTone),
      this.palette,
      Boolean(input.modeActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      modeX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      [input.modeTop ?? "MODE", input.modeBottom ?? "FSL"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      siteMultiX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.siteMultiActive, input.siteMultiTone),
      this.palette,
      Boolean(input.siteMultiActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      siteMultiX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      [input.siteMultiTop ?? "SITE", input.siteMultiBottom ?? "MULTI"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      prefX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.prefActive, input.prefTone),
      this.palette,
      Boolean(input.prefActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      prefX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      [input.prefLabel ?? "PREF"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      filterX,
      originY,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.ssaFilterActive, input.ssaFilterTone),
      this.palette,
      Boolean(input.ssaFilterActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      filterX,
      originY,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      [input.ssaFilterTop ?? "SSA", input.ssaFilterBottom ?? "FILTER"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      filterX,
      originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.giTextFilterActive, input.giTextFilterTone),
      this.palette,
      Boolean(input.giTextFilterActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      filterX,
      originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
      MAPS_SMALL_BUTTON_WIDTH,
      MAPS_SMALL_BUTTON_HEIGHT,
      [input.giTextFilterTop ?? "GI TEXT", input.giTextFilterBottom ?? "FILTER"],
      this.palette.text
    );

    drawButtonFrame(
      ctx,
      shiftX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.shiftActive, input.shiftTone),
      this.palette,
      Boolean(input.shiftActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      shiftX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      [input.shiftLabel ?? "SHIFT"],
      this.palette.text
    );
  }

  drawBrite(ctx: CanvasRenderingContext2D, input: DcbBriteInput): void {
    const originX = Math.round(input.x);
    const originY = Math.round(input.y);

    drawButtonFrame(
      ctx,
      originX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.active, input.tone),
      this.palette,
      Boolean(input.active)
    );
    drawCenteredLines(
      ctx,
      this.font,
      originX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      [input.label ?? "BRITE"],
      this.palette.text
    );

    if (!input.expanded) {
      return;
    }

    const topRow = (input.topRow ?? []).slice(0, BRITE_MENU_COLUMNS);
    const bottomRow = (input.bottomRow ?? []).slice(0, BRITE_MENU_COLUMNS);
    const menuOriginX = originX + MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX;
    const menuWidth =
      BRITE_MENU_COLUMNS * MAPS_SMALL_BUTTON_WIDTH +
      (BRITE_MENU_COLUMNS - 1) * MAPS_BUTTON_GAP_PX;
    const menuHeight = MAPS_SMALL_BUTTON_HEIGHT * 2 + MAPS_BUTTON_GAP_PX;

    // Keep the expanded submenu readable by masking underlying controls.
    ctx.save();
    ctx.fillStyle = colors.BLACK;
    ctx.fillRect(menuOriginX, originY, menuWidth, menuHeight);
    ctx.restore();

    for (let i = 0; i < BRITE_MENU_COLUMNS; i += 1) {
      const columnX = menuOriginX + i * (MAPS_SMALL_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      const top = topRow[i] ?? { top: "", bottom: "", active: false, tone: "normal" };
      const bottom = bottomRow[i] ?? { top: "", bottom: "", active: false, tone: "normal" };

      drawButtonFrame(
        ctx,
        columnX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, top.active, top.tone),
        this.palette,
        Boolean(top.active)
      );
      drawCenteredLines(
        ctx,
        this.font,
        columnX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [top.top, top.bottom],
        top.textColor ?? this.palette.text
      );

      drawButtonFrame(
        ctx,
        columnX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, bottom.active, bottom.tone),
        this.palette,
        Boolean(bottom.active)
      );
      drawCenteredLines(
        ctx,
        this.font,
        columnX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [bottom.top, bottom.bottom],
        bottom.textColor ?? this.palette.text
      );
    }
  }

  drawMapsMenu(ctx: CanvasRenderingContext2D, input: DcbMapsMenuInput): void {
    if (!input.expanded) {
      return;
    }

    const { originY, columns, menuOriginX, menuWidth, menuHeight } = this.getMapsMenuMetrics(input);
    if (columns <= 0 || menuWidth <= 0) {
      return;
    }

    const topRow = (input.topRow ?? []).slice(0, columns);
    const bottomRow = (input.bottomRow ?? []).slice(0, columns);

    // Keep the expanded submenu readable by masking underlying controls.
    ctx.save();
    ctx.fillStyle = colors.BLACK;
    ctx.fillRect(menuOriginX, originY, menuWidth, menuHeight);
    ctx.restore();

    for (let i = 0; i < columns; i += 1) {
      const columnX = menuOriginX + i * (MAPS_SMALL_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      const top = topRow[i] ?? { top: "", bottom: "", active: false, tone: "normal" };
      const bottom = bottomRow[i] ?? { top: "", bottom: "", active: false, tone: "normal" };

      drawButtonFrame(
        ctx,
        columnX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, top.active, top.tone),
        this.palette,
        Boolean(top.active)
      );
      drawCenteredLines(
        ctx,
        this.font,
        columnX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [top.top, top.bottom],
        top.textColor ?? this.palette.text
      );

      drawButtonFrame(
        ctx,
        columnX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, bottom.active, bottom.tone),
        this.palette,
        Boolean(bottom.active)
      );
      drawCenteredLines(
        ctx,
        this.font,
        columnX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [bottom.top, bottom.bottom],
        bottom.textColor ?? this.palette.text
      );
    }
  }

  drawSsaFilterMenu(ctx: CanvasRenderingContext2D, input: DcbSsaFilterInput): void {
    if (!input.expanded) {
      return;
    }

    const { originY, columns, menuOriginX, menuWidth, menuHeight } = this.getSsaFilterMenuMetrics(input);
    if (menuWidth <= 0) {
      return;
    }

    const topRow = (input.topRow ?? []).slice(0, columns);
    const bottomRow = (input.bottomRow ?? []).slice(0, columns);

    // Keep the expanded submenu readable by masking underlying controls.
    ctx.save();
    ctx.fillStyle = colors.BLACK;
    ctx.fillRect(menuOriginX, originY, menuWidth, menuHeight);
    ctx.restore();

    const doneX =
      menuOriginX +
      (columns <= 0
        ? 0
        : columns * MAPS_SMALL_BUTTON_WIDTH + (columns - 1) * MAPS_BUTTON_GAP_PX + MAPS_BUTTON_GAP_PX);
    drawButtonFrame(
      ctx,
      doneX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.doneActive, input.doneTone),
      this.palette,
      Boolean(input.doneActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      doneX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      ["DONE"],
      input.doneTextColor ?? this.palette.text
    );

    for (let i = 0; i < columns; i += 1) {
      const columnX = menuOriginX + i * (MAPS_SMALL_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      const top = topRow[i] ?? { top: "", bottom: "", active: false, tone: "normal" };
      const bottom = bottomRow[i] ?? { top: "", bottom: "", active: false, tone: "normal" };

      drawButtonFrame(
        ctx,
        columnX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, top.active, top.tone),
        this.palette,
        Boolean(top.active)
      );
      drawCenteredLines(
        ctx,
        this.font,
        columnX,
        originY,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [top.top, top.bottom],
        top.textColor ?? this.palette.text
      );

      drawButtonFrame(
        ctx,
        columnX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, bottom.active, bottom.tone),
        this.palette,
        Boolean(bottom.active)
      );
      drawCenteredLines(
        ctx,
        this.font,
        columnX,
        originY + MAPS_SMALL_BUTTON_HEIGHT + MAPS_BUTTON_GAP_PX,
        MAPS_SMALL_BUTTON_WIDTH,
        MAPS_SMALL_BUTTON_HEIGHT,
        [bottom.top, bottom.bottom],
        bottom.textColor ?? this.palette.text
      );
    }
  }

  drawSiteMenu(ctx: CanvasRenderingContext2D, input: DcbSiteMenuInput): void {
    if (!input.expanded) {
      return;
    }

    const { originY, buttonsCount, menuOriginX, menuWidth, menuHeight, doneX } =
      this.getSiteMenuMetrics(input);
    if (menuWidth <= 0) {
      return;
    }

    const buttons = (input.buttons ?? []).slice(0, buttonsCount);

    // Keep the expanded submenu readable by masking underlying controls.
    ctx.save();
    ctx.fillStyle = colors.BLACK;
    ctx.fillRect(menuOriginX, originY, menuWidth, menuHeight);
    ctx.restore();

    for (let i = 0; i < buttonsCount; i += 1) {
      const buttonX = menuOriginX + i * (MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      const button = buttons[i] ?? { top: "", bottom: "", active: false, tone: "normal" };

      drawButtonFrame(
        ctx,
        buttonX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, button.active, button.tone),
        this.palette,
        Boolean(button.active)
      );
      drawCenteredLines(
        ctx,
        this.font,
        buttonX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        [button.top, button.bottom],
        button.textColor ?? this.palette.text
      );
    }

    drawButtonFrame(
      ctx,
      doneX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.doneActive, input.doneTone),
      this.palette,
      Boolean(input.doneActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      doneX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      ["DONE"],
      input.doneTextColor ?? this.palette.text
    );
  }

  drawAtpaMenu(ctx: CanvasRenderingContext2D, input: DcbAtpaMenuInput): void {
    if (!input.expanded) {
      return;
    }

    const { originY, buttonsCount, menuOriginX, menuWidth, menuHeight, doneX } =
      this.getAtpaMenuMetrics(input);
    if (menuWidth <= 0) {
      return;
    }

    const buttons = (input.buttons ?? []).slice(0, buttonsCount);

    // Keep the expanded submenu readable by masking underlying controls.
    ctx.save();
    ctx.fillStyle = colors.BLACK;
    ctx.fillRect(menuOriginX, originY, menuWidth, menuHeight);
    ctx.restore();

    for (let i = 0; i < buttonsCount; i += 1) {
      const buttonX = menuOriginX + i * (MAPS_BIG_BUTTON_WIDTH + MAPS_BUTTON_GAP_PX);
      const button = buttons[i] ?? { lines: [], active: false, tone: "normal" };

      drawButtonFrame(
        ctx,
        buttonX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        resolveButtonFillColor(this.palette, button.active, button.tone),
        this.palette,
        Boolean(button.active)
      );
      drawCenteredLines(
        ctx,
        this.font,
        buttonX,
        originY,
        MAPS_BIG_BUTTON_WIDTH,
        MAPS_BIG_BUTTON_HEIGHT,
        button.lines,
        button.textColor ?? this.palette.text
      );
    }

    drawButtonFrame(
      ctx,
      doneX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      resolveButtonFillColor(this.palette, input.doneActive, input.doneTone),
      this.palette,
      Boolean(input.doneActive)
    );
    drawCenteredLines(
      ctx,
      this.font,
      doneX,
      originY,
      MAPS_BIG_BUTTON_WIDTH,
      MAPS_BIG_BUTTON_HEIGHT,
      ["DONE"],
      input.doneTextColor ?? this.palette.text
    );
  }
}
