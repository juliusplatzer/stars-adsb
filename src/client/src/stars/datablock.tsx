import { getTintedGlyphCanvas, loadBitmapFont, type LoadedBitmapFont } from "../lib/bitmapFont.js";
import colors from "./colors.js";

export type DatablockLeaderDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface DatablockCreateOptions {
  fontBasePath?: string;
  color?: string;
}

export interface DatablockDrawInput {
  id: string;
  blipX: number;
  blipY: number;
  altitudeAmslFt: number | null;
  groundspeedKts: number | null;
  wakeCategory: string | null;
  destinationIata: string | null;
  aircraftTypeIcao: string | null;
  squawk: string | null;
  callsign: string | null;
  expanded: boolean;
  vfr1200Style?: boolean;
  leaderLengthPx?: number;
  leaderDirection?: DatablockLeaderDirection;
  timeMs?: number;
  color?: string | null;
}

export interface DatablockDrawOptions {
  drawLeader?: boolean;
  drawText?: boolean;
}

export interface DatablockHitRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_FONT_BASE_PATH = "/public/font/sddCharFontSetASize1";
const DEFAULT_LEADER_LENGTH_PX = 10;
const DEFAULT_TEXT_OFFSET_PX = 3;
const TIMESHARE_CYCLE_MS = 4_000;
const TIMESHARE_ALTERNATE_MS = 1_000;

function toUpperTrimmed(value: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

function formatAltitudeHundreds(altitudeFt: number | null): string {
  if (altitudeFt === null || !Number.isFinite(altitudeFt)) {
    return "---";
  }
  const hundreds = Math.max(0, Math.round(altitudeFt / 100));
  return String(hundreds).padStart(3, "0");
}

function formatGroundspeed(groundspeedKts: number | null): string {
  if (groundspeedKts === null || !Number.isFinite(groundspeedKts)) {
    return "XX";
  }
  const tens = Math.floor(Math.max(0, groundspeedKts) / 10);
  return String(Math.min(99, tens)).padStart(2, "0");
}

function formatWakeCategory(wakeCategory: string | null): string {
  const normalized = toUpperTrimmed(wakeCategory);
  if (!normalized || normalized === "NOWGT" || normalized === "UNKNOWN" || normalized === "UNK") {
    return "X";
  }
  return normalized;
}

function shouldShowTimeshareAlternate(timeMs: number): boolean {
  const phaseMs = ((timeMs % TIMESHARE_CYCLE_MS) + TIMESHARE_CYCLE_MS) % TIMESHARE_CYCLE_MS;
  return phaseMs >= TIMESHARE_CYCLE_MS - TIMESHARE_ALTERNATE_MS;
}

function directionToUnitVector(direction: DatablockLeaderDirection): { x: number; y: number } {
  switch (direction) {
    case "N":
      return { x: 0, y: -1 };
    case "NE":
      return { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
    case "E":
      return { x: 1, y: 0 };
    case "SE":
      return { x: Math.SQRT1_2, y: Math.SQRT1_2 };
    case "S":
      return { x: 0, y: 1 };
    case "SW":
      return { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
    case "W":
      return { x: -1, y: 0 };
    case "NW":
      return { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };
    default:
      return { x: 0, y: -1 };
  }
}

function measureBitmapTextWidth(font: LoadedBitmapFont, text: string): number {
  let width = 0;
  const fallback = font.metrics["?".charCodeAt(0)] ?? font.metrics[0];
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
  x: number,
  y: number,
  text: string,
  tintColor: string
): void {
  let cursorX = x;
  const fallback = font.metrics["?".charCodeAt(0)] ?? font.metrics[0];

  for (let i = 0; i < text.length; i += 1) {
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

      const dx = Math.round(cursorX + metric.offX);
      const dy = Math.round(y + (font.height - metric.offY - metric.h));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(glyphCanvas, dx, dy);
    }

    cursorX += metric.stepX;
  }
}

export class StarsDatablockRenderer {
  private constructor(
    private readonly font: LoadedBitmapFont,
    private readonly color: string
  ) {}

  static async create(options: DatablockCreateOptions = {}): Promise<StarsDatablockRenderer> {
    const font = await loadBitmapFont(options.fontBasePath ?? DEFAULT_FONT_BASE_PATH);
    return new StarsDatablockRenderer(font, options.color ?? colors.GREEN);
  }

  private buildLines(input: DatablockDrawInput): { lines: string[]; anchorLineIndex: number } {
    const nowMs = Number.isFinite(input.timeMs) ? (input.timeMs as number) : Date.now();
    const showAlternate = shouldShowTimeshareAlternate(nowMs);
    const altitude = formatAltitudeHundreds(input.altitudeAmslFt);
    const groundspeed = formatGroundspeed(input.groundspeedKts);
    const cwt = formatWakeCategory(input.wakeCategory);
    const destinationIata = toUpperTrimmed(input.destinationIata);
    const aircraftTypeIcao = toUpperTrimmed(input.aircraftTypeIcao);

    if (input.vfr1200Style) {
      const squawk = toUpperTrimmed(input.squawk) || "1200";
      const callsign = toUpperTrimmed(input.callsign) || "------";
      return {
        lines: [squawk, `    ${groundspeed}`, callsign],
        anchorLineIndex: 1
      };
    }
    const singleLinePrimary = `${altitude} ${groundspeed} ${cwt}`;
    const singleLineAlternate =
      destinationIata.length > 0
        ? `${destinationIata} ${groundspeed} ${cwt}`
        : singleLinePrimary;

    if (!input.expanded) {
      return {
        lines: [showAlternate ? singleLineAlternate : singleLinePrimary],
        anchorLineIndex: 0
      };
    }

    const callsign = toUpperTrimmed(input.callsign) || "------";
    const expandedPrimary = `${altitude} ${groundspeed} ${cwt}`;
    const expandedAlternate =
      destinationIata.length > 0 && aircraftTypeIcao.length > 0
        ? `${destinationIata} ${aircraftTypeIcao}`
        : expandedPrimary;
    return {
      lines: [callsign, showAlternate ? expandedAlternate : expandedPrimary],
      anchorLineIndex: 0
    };
  }

  draw(ctx: CanvasRenderingContext2D, input: DatablockDrawInput): DatablockHitRegion {
    return this.drawWithOptions(ctx, input, { drawLeader: true, drawText: true });
  }

  drawWithOptions(
    ctx: CanvasRenderingContext2D,
    input: DatablockDrawInput,
    options: DatablockDrawOptions
  ): DatablockHitRegion {
    const drawLeader = options.drawLeader ?? true;
    const drawText = options.drawText ?? true;
    const resolvedColor = input.color && input.color.trim().length > 0 ? input.color : this.color;
    const leaderLengthPx = input.leaderLengthPx ?? DEFAULT_LEADER_LENGTH_PX;
    const leaderDirection = input.leaderDirection ?? "N";
    const vector = directionToUnitVector(leaderDirection);
    const endpointX = input.blipX + vector.x * leaderLengthPx;
    const endpointY = input.blipY + vector.y * leaderLengthPx;

    const { lines, anchorLineIndex } = this.buildLines(input);
    const lineHeight = this.font.height;
    const textWidths = lines.map((line) => measureBitmapTextWidth(this.font, line));
    const maxWidth = Math.max(...textWidths, 0);
    const textOffsetX = DEFAULT_TEXT_OFFSET_PX;
    const textLeft =
      vector.x < -0.2
        ? Math.round(endpointX - textOffsetX - maxWidth)
        : Math.round(endpointX + textOffsetX);
    const blockTopY = Math.round(endpointY - lineHeight * 0.5 - anchorLineIndex * lineHeight);
    const blockHeight = lines.length * lineHeight;

    if (drawLeader) {
      ctx.save();
      ctx.strokeStyle = resolvedColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(input.blipX), Math.round(input.blipY));
      ctx.lineTo(Math.round(endpointX), Math.round(endpointY));
      ctx.stroke();
      ctx.restore();
    }

    if (drawText) {
      ctx.save();
      for (let i = 0; i < lines.length; i += 1) {
        drawTintedBitmapText(ctx, this.font, textLeft, blockTopY + i * lineHeight, lines[i], resolvedColor);
      }
      ctx.restore();
    }

    return {
      id: input.id,
      x: textLeft,
      y: blockTopY,
      width: maxWidth,
      height: blockHeight
    };
  }

  hitTest(hits: readonly DatablockHitRegion[], x: number, y: number): string | null {
    for (let i = hits.length - 1; i >= 0; i -= 1) {
      const hit = hits[i];
      if (x >= hit.x && x <= hit.x + hit.width && y >= hit.y && y <= hit.y + hit.height) {
        return hit.id;
      }
    }
    return null;
  }
}
