import { getTintedGlyphCanvas, loadBitmapFont, type LoadedBitmapFont } from "../lib/bitmapFont.js";
import type { PositionSample } from "@vstars/shared";
import colors from "./colors.js";

export type BlipGlyphColor = "GREEN" | "WHITE";

export type BlipCenterGlyphKind = "triangle" | "square" | "star" | "letter";

export interface BlipRuleInput {
  squawk: string | null;
  hasAltitudeReport: boolean;
  trackedByTcp: boolean;
  tcpLetter: string | null;
}

export interface BlipDrawInput extends BlipRuleInput {
  x: number;
  y: number;
  glyphColor: BlipGlyphColor;
  radiusPx?: number;
}

export interface Vfr1200BlipDrawInput {
  x: number;
  y: number;
  squawk: string | null;
  hasAltitudeReport: boolean;
  trackDeg: number | null;
}

export interface PrimaryTargetBlipDrawInput {
  x: number;
  y: number;
  trackDeg: number | null;
  tcpCode: string | null;
  squawk?: string | null;
  bodyShape?: PrimaryTargetBodyShape;
  symbolColor?: string;
  bodyOutlineOnly?: boolean;
  bodyOutlineColor?: string;
  bodyOutlineWidthPx?: number;
}

export type PrimaryTargetBodyShape = "circle" | "track-perpendicular-rectangle";

export interface BlipColors {
  searchTargetBlue: string;
  histBlue1: string;
  histBlue2: string;
  histBlue3: string;
  histBlue4: string;
  histBlue5: string;
  green: string;
  white: string;
  black: string;
}

const DEFAULT_COLORS: BlipColors = {
  searchTargetBlue: colors.SEARCH_TARGET_BLUE,
  histBlue1: colors.HIST_BLUE_1,
  histBlue2: colors.HIST_BLUE_2,
  histBlue3: colors.HIST_BLUE_3,
  histBlue4: colors.HIST_BLUE_4,
  histBlue5: colors.HIST_BLUE_5,
  green: colors.GREEN,
  white: colors.WHITE,
  black: colors.BLACK
};

interface BlipFonts {
  fill: LoadedBitmapFont;
  outline: LoadedBitmapFont;
}

export interface BlipResolvedCenterGlyph {
  kind: BlipCenterGlyphKind;
  letter: string | null;
}

export interface BlipProjectedPoint {
  x: number;
  y: number;
}

export type BlipHistoryPosition = PositionSample | BlipProjectedPoint;

export interface BlipHistoryDrawOptions {
  dotRadiusPx?: number;
  maxDots?: number;
  projectPosition?: (position: PositionSample) => BlipProjectedPoint | null;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function normalizeTcpLetter(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  if (normalized.length === 0) {
    return null;
  }
  return normalized[0];
}

function resolveGlyphFromTcpCode(tcpCode: string | null): BlipResolvedCenterGlyph {
  const normalized = (tcpCode ?? "").trim().toUpperCase();
  if (!normalized) {
    return {
      kind: "star",
      letter: null
    };
  }

  if (/^\d+$/.test(normalized) || normalized === "C") {
    return {
      kind: "letter",
      letter: "C"
    };
  }

  const hasDigit = /\d/.test(normalized);
  const letters = normalized.match(/[A-Z]/g);
  if (hasDigit && letters && letters.length > 0) {
    return {
      kind: "letter",
      letter: letters[letters.length - 1] ?? null
    };
  }

  return {
    kind: "star",
    letter: null
  };
}

export function resolveBlipCenterGlyph(input: BlipRuleInput): BlipResolvedCenterGlyph {
  const squawk = (input.squawk ?? "").trim();

  // STARS default treatment for VFR 1200-series beacon codes.
  if (squawk.startsWith("12")) {
    return {
      kind: input.hasAltitudeReport ? "square" : "triangle",
      letter: null
    };
  }

  if (!input.trackedByTcp) {
    return {
      kind: "star",
      letter: null
    };
  }

  const tcpLetter = normalizeTcpLetter(input.tcpLetter);
  if (!tcpLetter) {
    return {
      kind: "star",
      letter: null
    };
  }

  return {
    kind: "letter",
    letter: tcpLetter
  };
}

function shapeFillColor(glyphColor: BlipGlyphColor, colors: BlipColors): string {
  return glyphColor === "WHITE" ? colors.white : colors.green;
}

function isPositionSample(position: BlipHistoryPosition): position is PositionSample {
  return "lat" in position && "lon" in position;
}

// STARS symbol codepoints in the bitmap atlas.
// 128: triangle (delta), 129: openSquare, 42: star (asterisk glyph).
const BLIP_SYMBOL_CHARCODE: Record<Exclude<BlipCenterGlyphKind, "letter">, number> = {
  triangle: 128,
  square: 129,
  star: 42
};

const BLIP_PIXEL_CIRCLE_RADIUS_PX = 7;
const BLIP_PIXEL_CORNER_CHAMFER_PX = 4;
const BLIP_TRACK_RECT_WIDTH_PX = 19;
const BLIP_TRACK_RECT_HEIGHT_PX = 6.5;

const BLIP_PIXEL_BODY_OFFSETS: Array<{ dx: number; dy: number }> = (() => {
  const offsets: Array<{ dx: number; dy: number }> = [];
  for (let dy = -BLIP_PIXEL_CIRCLE_RADIUS_PX; dy <= BLIP_PIXEL_CIRCLE_RADIUS_PX; dy += 1) {
    for (let dx = -BLIP_PIXEL_CIRCLE_RADIUS_PX; dx <= BLIP_PIXEL_CIRCLE_RADIUS_PX; dx += 1) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const nearCorner =
        absX > BLIP_PIXEL_CIRCLE_RADIUS_PX - BLIP_PIXEL_CORNER_CHAMFER_PX &&
        absY > BLIP_PIXEL_CIRCLE_RADIUS_PX - BLIP_PIXEL_CORNER_CHAMFER_PX &&
        absX + absY > 2 * BLIP_PIXEL_CIRCLE_RADIUS_PX - BLIP_PIXEL_CORNER_CHAMFER_PX;
      if (nearCorner) {
        continue;
      }
      offsets.push({ dx, dy });
    }
  }
  return offsets;
})();

function drawPixelatedCircleBody(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  color: string
): void {
  const cx = Math.round(centerX);
  const cy = Math.round(centerY);
  ctx.fillStyle = color;
  for (let i = 0; i < BLIP_PIXEL_BODY_OFFSETS.length; i += 1) {
    const offset = BLIP_PIXEL_BODY_OFFSETS[i];
    ctx.fillRect(cx + offset.dx, cy + offset.dy, 1, 1);
  }
}

function normalizeHeadingDeg(headingDeg: number): number {
  const normalized = headingDeg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function resolveTrackRectangleAngleRad(trackDeg: number | null): number {
  if (trackDeg === null || !Number.isFinite(trackDeg)) {
    return 0;
  }
  return toRadians(normalizeHeadingDeg(trackDeg));
}

function drawTrackPerpendicularRectangleBody(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  trackDeg: number | null,
  color: string
): void {
  const angleRad = resolveTrackRectangleAngleRad(trackDeg);
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angleRad);
  ctx.fillStyle = color;
  ctx.fillRect(
    -BLIP_TRACK_RECT_WIDTH_PX / 2,
    -BLIP_TRACK_RECT_HEIGHT_PX / 2,
    BLIP_TRACK_RECT_WIDTH_PX,
    BLIP_TRACK_RECT_HEIGHT_PX
  );
  ctx.restore();
}

function drawTrackPerpendicularRectangleOutline(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  trackDeg: number | null,
  color: string,
  lineWidthPx: number
): void {
  const angleRad = resolveTrackRectangleAngleRad(trackDeg);
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angleRad);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidthPx;
  ctx.strokeRect(
    -BLIP_TRACK_RECT_WIDTH_PX / 2,
    -BLIP_TRACK_RECT_HEIGHT_PX / 2,
    BLIP_TRACK_RECT_WIDTH_PX,
    BLIP_TRACK_RECT_HEIGHT_PX
  );
  ctx.restore();
}

function drawPixelatedCircleOutline(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  color: string,
  lineWidthPx: number
): void {
  const radiusPx = Math.max(0.5, BLIP_PIXEL_CIRCLE_RADIUS_PX - lineWidthPx * 0.5);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidthPx;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function resolvePrimaryTargetBodyShape(bodyShape: PrimaryTargetBodyShape | undefined): PrimaryTargetBodyShape {
  return bodyShape === "track-perpendicular-rectangle" ? "track-perpendicular-rectangle" : "circle";
}

function drawPrimaryTargetBody(
  ctx: CanvasRenderingContext2D,
  input: Pick<PrimaryTargetBlipDrawInput, "x" | "y" | "trackDeg" | "bodyShape">,
  bodyColor: string,
  options?: {
    outlineOnly?: boolean;
    outlineColor?: string;
    outlineWidthPx?: number;
  }
): void {
  const shape = resolvePrimaryTargetBodyShape(input.bodyShape);
  const outlineOnly = Boolean(options?.outlineOnly);
  if (outlineOnly) {
    const outlineColor = options?.outlineColor ?? bodyColor;
    const requestedOutlineWidthPx = options?.outlineWidthPx;
    const outlineWidthPx =
      requestedOutlineWidthPx !== undefined && Number.isFinite(requestedOutlineWidthPx)
        ? requestedOutlineWidthPx
        : 0.5;
    if (shape === "track-perpendicular-rectangle") {
      drawTrackPerpendicularRectangleOutline(
        ctx,
        input.x,
        input.y,
        input.trackDeg,
        outlineColor,
        outlineWidthPx
      );
      return;
    }
    drawPixelatedCircleOutline(ctx, input.x, input.y, outlineColor, outlineWidthPx);
    return;
  }

  if (shape === "track-perpendicular-rectangle") {
    drawTrackPerpendicularRectangleBody(ctx, input.x, input.y, input.trackDeg, bodyColor);
    return;
  }
  drawPixelatedCircleBody(ctx, input.x, input.y, bodyColor);
}

function getTrackRectangleHitRegion(input: Pick<PrimaryTargetBlipDrawInput, "x" | "y" | "trackDeg">): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const angleRad = resolveTrackRectangleAngleRad(input.trackDeg);
  const halfLong = BLIP_TRACK_RECT_WIDTH_PX / 2;
  const halfShort = BLIP_TRACK_RECT_HEIGHT_PX / 2;
  const absCos = Math.abs(Math.cos(angleRad));
  const absSin = Math.abs(Math.sin(angleRad));
  const extentX = absCos * halfLong + absSin * halfShort;
  const extentY = absSin * halfLong + absCos * halfShort;
  const minX = Math.floor(input.x - extentX);
  const minY = Math.floor(input.y - extentY);
  const maxX = Math.ceil(input.x + extentX);
  const maxY = Math.ceil(input.y + extentY);
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function drawLetterGlyph(
  ctx: CanvasRenderingContext2D,
  fonts: BlipFonts,
  x: number,
  y: number,
  letter: string,
  fillColor: string,
  haloColor: string
): void {
  const glyph = letter[0]?.toUpperCase() ?? "?";
  const glyphCode = glyph.charCodeAt(0);
  const outlineMetric = fonts.outline.metrics[glyphCode] ?? fonts.outline.metrics["?".charCodeAt(0)];
  const fillMetric = fonts.fill.metrics[glyphCode] ?? fonts.fill.metrics["?".charCodeAt(0)];
  if (!outlineMetric || !fillMetric) {
    return;
  }

  drawTintedGlyphBoxCentered(ctx, fonts.outline, outlineMetric, x, y, haloColor);
  drawTintedGlyphBoxCentered(ctx, fonts.fill, fillMetric, x, y, fillColor);
}

function drawSymbolGlyph(
  ctx: CanvasRenderingContext2D,
  fonts: BlipFonts,
  x: number,
  y: number,
  glyphCode: number,
  fillColor: string,
  haloColor: string
): boolean {
  const outlineMetric = fonts.outline.metrics[glyphCode];
  const fillMetric = fonts.fill.metrics[glyphCode];
  if (!outlineMetric || !fillMetric) {
    return false;
  }

  drawTintedGlyphFromAtlas(ctx, fonts.outline, outlineMetric, x, y, haloColor);
  drawTintedGlyphFromAtlas(ctx, fonts.fill, fillMetric, x, y, fillColor);
  return true;
}

function drawSymbolGlyphPinnedCenter(
  ctx: CanvasRenderingContext2D,
  fonts: BlipFonts,
  centerX: number,
  centerY: number,
  glyphCode: number,
  fillColor: string,
  haloColor: string
): boolean {
  const outlineMetric = fonts.outline.metrics[glyphCode];
  const fillMetric = fonts.fill.metrics[glyphCode];
  if (!outlineMetric || !fillMetric) {
    return false;
  }

  drawTintedGlyphBoxCentered(ctx, fonts.outline, outlineMetric, centerX, centerY, haloColor);
  drawTintedGlyphBoxCentered(ctx, fonts.fill, fillMetric, centerX, centerY, fillColor);
  return true;
}

function drawTintedGlyphFromAtlas(
  ctx: CanvasRenderingContext2D,
  font: LoadedBitmapFont,
  metric: { sx: number; sy: number; w: number; h: number; offX: number; offY: number },
  centerX: number,
  centerY: number,
  tintColor: string
): void {
  if (metric.w <= 0 || metric.h <= 0) {
    return;
  }

  // Compute top-left render position using the same vertical metric system as drawBitmapText.
  const x = Math.round(centerX - metric.w / 2 - metric.offX);
  const y = Math.round(centerY - metric.h / 2 - (font.height - metric.offY - metric.h));

  const glyphCanvas = getTintedGlyphCanvas(font, metric, tintColor);
  if (!glyphCanvas) {
    return;
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(glyphCanvas, x, y);
}

function drawTintedGlyphBoxCentered(
  ctx: CanvasRenderingContext2D,
  font: LoadedBitmapFont,
  metric: { sx: number; sy: number; w: number; h: number; offX: number; offY: number },
  centerX: number,
  centerY: number,
  tintColor: string
): void {
  if (metric.w <= 0 || metric.h <= 0) {
    return;
  }

  const x = Math.round(centerX - metric.w / 2);
  const y = Math.round(centerY - metric.h / 2);

  const glyphCanvas = getTintedGlyphCanvas(font, metric, tintColor);
  if (!glyphCanvas) {
    return;
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(glyphCanvas, x, y);
}

export class RadarBlipRenderer {
  private searchTargetBlueColor: string;
  private historyDotColors: [string, string, string, string, string];

  private constructor(
    private readonly fonts: BlipFonts,
    private readonly colors: BlipColors
  ) {
    this.searchTargetBlueColor = colors.searchTargetBlue;
    this.historyDotColors = [
      colors.histBlue1,
      colors.histBlue2,
      colors.histBlue3,
      colors.histBlue4,
      colors.histBlue5
    ];
  }

  setSearchTargetBlueColor(color: string): void {
    this.searchTargetBlueColor = color;
  }

  setHistoryDotColors(colors: [string, string, string, string, string]): void {
    this.historyDotColors = colors;
  }

  private historyColorByIndex(index: number): string {
    return this.historyDotColors[Math.min(4, Math.max(0, index))];
  }

  static async create(colors: Partial<BlipColors> = {}): Promise<RadarBlipRenderer> {
    const [fill, outline] = await Promise.all([
      loadBitmapFont("/public/font/sddCharFontSetASize1"),
      loadBitmapFont("/public/font/sddCharOutlineFontSetASize1")
    ]);

    return new RadarBlipRenderer(
      { fill, outline },
      { ...DEFAULT_COLORS, ...colors }
    );
  }

  getVfr1200HitRegion(input: Pick<Vfr1200BlipDrawInput, "x" | "y" | "trackDeg">): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const radius = BLIP_PIXEL_CIRCLE_RADIUS_PX;
    return {
      x: Math.round(input.x - radius),
      y: Math.round(input.y - radius),
      width: radius * 2 + 1,
      height: radius * 2 + 1
    };
  }

  getPrimaryTargetHitRegion(
    input: Pick<PrimaryTargetBlipDrawInput, "x" | "y" | "trackDeg" | "squawk" | "bodyShape">
  ): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (resolvePrimaryTargetBodyShape(input.bodyShape) === "track-perpendicular-rectangle") {
      return getTrackRectangleHitRegion(input);
    }
    const radius = BLIP_PIXEL_CIRCLE_RADIUS_PX;
    return {
      x: Math.round(input.x - radius),
      y: Math.round(input.y - radius),
      width: radius * 2 + 1,
      height: radius * 2 + 1
    };
  }

  drawVfr1200(ctx: CanvasRenderingContext2D, input: Vfr1200BlipDrawInput): boolean {
    const squawk = (input.squawk ?? "").trim();
    if (squawk !== "1200") {
      return false;
    }

    drawPixelatedCircleBody(ctx, input.x, input.y, this.searchTargetBlueColor);

    // Draw a green square with black halo at target center via outline atlas.
    const rendered = drawSymbolGlyphPinnedCenter(
      ctx,
      this.fonts,
      input.x,
      input.y,
      input.hasAltitudeReport ? BLIP_SYMBOL_CHARCODE.square : BLIP_SYMBOL_CHARCODE.triangle,
      this.colors.green,
      this.colors.black
    );
    if (!rendered) {
      // Fallback if symbol glyph code is absent in the atlas.
      ctx.fillStyle = this.colors.black;
      ctx.fillRect(Math.round(input.x - 3), Math.round(input.y - 3), 6, 6);
      if (input.hasAltitudeReport) {
        ctx.fillStyle = this.colors.green;
        ctx.fillRect(Math.round(input.x - 2), Math.round(input.y - 2), 4, 4);
      } else {
        ctx.fillStyle = this.colors.green;
        ctx.beginPath();
        ctx.moveTo(Math.round(input.x), Math.round(input.y - 2));
        ctx.lineTo(Math.round(input.x - 2), Math.round(input.y + 2));
        ctx.lineTo(Math.round(input.x + 2), Math.round(input.y + 2));
        ctx.closePath();
        ctx.fill();
      }
    }
    return true;
  }

  drawPrimaryTarget(ctx: CanvasRenderingContext2D, input: PrimaryTargetBlipDrawInput): void {
    const symbolColor = input.symbolColor ?? this.colors.green;
    drawPrimaryTargetBody(ctx, input, this.searchTargetBlueColor, {
      outlineOnly: input.bodyOutlineOnly,
      outlineColor: input.bodyOutlineColor ?? this.searchTargetBlueColor,
      outlineWidthPx: input.bodyOutlineWidthPx
    });

    const centerGlyph = resolveGlyphFromTcpCode(input.tcpCode);
    if (centerGlyph.kind === "letter") {
      drawLetterGlyph(
        ctx,
        this.fonts,
        input.x,
        input.y,
        centerGlyph.letter ?? "?",
        symbolColor,
        this.colors.black
      );
      return;
    }

    const rendered = drawSymbolGlyphPinnedCenter(
      ctx,
      this.fonts,
      input.x,
      input.y,
      BLIP_SYMBOL_CHARCODE.star,
      symbolColor,
      this.colors.black
    );
    if (rendered) {
      return;
    }

    // Fallback star if symbol glyph is unavailable.
    ctx.save();
    ctx.strokeStyle = this.colors.black;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.round(input.x - 3), Math.round(input.y));
    ctx.lineTo(Math.round(input.x + 3), Math.round(input.y));
    ctx.moveTo(Math.round(input.x), Math.round(input.y - 3));
    ctx.lineTo(Math.round(input.x), Math.round(input.y + 3));
    ctx.stroke();

    ctx.strokeStyle = symbolColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(input.x - 3), Math.round(input.y));
    ctx.lineTo(Math.round(input.x + 3), Math.round(input.y));
    ctx.moveTo(Math.round(input.x), Math.round(input.y - 3));
    ctx.lineTo(Math.round(input.x), Math.round(input.y + 3));
    ctx.stroke();
    ctx.restore();
  }

  draw(ctx: CanvasRenderingContext2D, input: BlipDrawInput): BlipResolvedCenterGlyph {
    const centerGlyph = resolveBlipCenterGlyph(input);

    drawPixelatedCircleBody(ctx, input.x, input.y, this.searchTargetBlueColor);

    const fill = shapeFillColor(input.glyphColor, this.colors);
    const stroke = this.colors.black;

    switch (centerGlyph.kind) {
      case "triangle":
        drawSymbolGlyphPinnedCenter(
          ctx,
          this.fonts,
          input.x,
          input.y,
          BLIP_SYMBOL_CHARCODE.triangle,
          fill,
          stroke
        );
        break;
      case "square":
        drawSymbolGlyphPinnedCenter(
          ctx,
          this.fonts,
          input.x,
          input.y,
          BLIP_SYMBOL_CHARCODE.square,
          fill,
          stroke
        );
        break;
      case "star":
        drawSymbolGlyphPinnedCenter(
          ctx,
          this.fonts,
          input.x,
          input.y,
          BLIP_SYMBOL_CHARCODE.star,
          fill,
          stroke
        );
        break;
      case "letter":
        drawLetterGlyph(ctx, this.fonts, input.x, input.y, centerGlyph.letter ?? "?", fill, this.colors.black);
        break;
      default:
        break;
    }

    return centerGlyph;
  }

  drawHistoryDots(
    ctx: CanvasRenderingContext2D,
    positions: readonly BlipHistoryPosition[],
    options: BlipHistoryDrawOptions = {}
  ): void {
    if (positions.length === 0) {
      return;
    }

    const dotRadiusPx = options.dotRadiusPx ?? 2;
    const maxDots = Math.max(1, Math.floor(options.maxDots ?? 5));
    // Backend history is oldest -> newest; color by recency so nearest trail point is HIST_BLUE_1.
    const ordered = [...positions].slice(-maxDots).reverse();

    for (let index = 0; index < ordered.length; index += 1) {
      const position = ordered[index];
      let point: BlipProjectedPoint | null;

      if (isPositionSample(position)) {
        if (!options.projectPosition) {
          continue;
        }
        point = options.projectPosition(position);
      } else {
        point = position;
      }

      if (!point) {
        continue;
      }

      ctx.beginPath();
      ctx.arc(Math.round(point.x), Math.round(point.y), dotRadiusPx, 0, Math.PI * 2);
      ctx.fillStyle = this.historyColorByIndex(index);
      ctx.fill();
    }
  }
}
