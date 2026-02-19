import { getTintedGlyphCanvas, loadBitmapFont, type LoadedBitmapFont } from "../lib/bitmapFont.js";
import colors from "./colors.js";

export interface ListsColors {
  green: string;
  red: string;
  ssaWx: string;
}

export interface ListsCreateOptions {
  fontBasePath?: string;
  colors?: Partial<ListsColors>;
}

export interface SsaDrawInput {
  x: number;
  y: number;
  airportIcao: string;
  qnhInHg: number | null;
  wxActiveLevels?: ReadonlySet<number>;
  wxAvailableLevels?: ReadonlySet<number>;
  qnhStations?: Array<{
    airportIcao: string;
    qnhInHg: number | null;
  }>;
  rangeNm?: number | null;
  wxHistoryFrameNo?: number | null;
  nowUtc?: Date;
  symbolScale?: number;
}

export interface CoastSuspendDrawInput {
  x: number;
  y: number;
  callsigns?: Array<string | null>;
  align?: "left" | "right";
}

export interface LaCaMciDrawInput {
  x: number;
  y: number;
  conflictAlerts?: string[];
  align?: "left" | "right";
}

export interface ControlPositionDrawInput {
  x: number;
  y: number;
  positionId: string;
  signedOnUtc: Date;
  align?: "left" | "right";
}

export interface TowerListDrawInput {
  x: number;
  y: number;
  airportIata: string;
  aircraft?: Array<{
    callsign: string | null;
    aircraftTypeIcao: string | null;
  }>;
  align?: "left" | "right";
}

export interface VfrListDrawInput {
  x: number;
  y: number;
  entries?: Array<{
    index: number | string;
    callsign: string | null;
    squawk: string | null;
  }>;
  align?: "left" | "right";
}

export interface FlightPlanListDrawInput {
  x: number;
  y: number;
  entries?: Array<{
    callsign: string | null;
    destination: string | null;
  }>;
  align?: "left" | "right";
}

const DEFAULT_LIST_COLORS: ListsColors = {
  green: colors.GREEN,
  red: colors.RED,
  ssaWx: colors.DCB_WX_ACTIVE
};

function formatUtcTime(nowUtc: Date): string {
  const hh = String(nowUtc.getUTCHours()).padStart(2, "0");
  const mm = String(nowUtc.getUTCMinutes()).padStart(2, "0");
  const ss = String(nowUtc.getUTCSeconds()).padStart(2, "0");
  return `${hh}${mm}/${ss}`;
}

function formatQnhInHg(qnhInHg: number | null): string {
  if (qnhInHg === null || !Number.isFinite(qnhInHg)) {
    return "--.--";
  }
  return qnhInHg.toFixed(2);
}

function formatAirportWithoutUsPrefix(airportIcao: string): string {
  const trimmed = airportIcao.trim().toUpperCase();
  if (trimmed.length === 4 && trimmed.startsWith("K")) {
    return trimmed.slice(1);
  }
  return trimmed;
}

function buildSsaQnhLines(
  stations: Array<{ airportIcao: string; qnhInHg: number | null }>,
  maxAirportsPerLine = 3
): string[] {
  const clampedPerLine = Math.max(1, Math.floor(maxAirportsPerLine));
  const tokens = stations
    .map((station) => {
      const airport = formatAirportWithoutUsPrefix(station.airportIcao);
      if (airport.length === 0) {
        return "";
      }
      return `${airport} ${formatQnhInHg(station.qnhInHg)}A`;
    })
    .filter((token) => token.length > 0);

  const lines: string[] = [];
  for (let i = 0; i < tokens.length; i += clampedPerLine) {
    lines.push(tokens.slice(i, i + clampedPerLine).join(" "));
  }
  return lines;
}

function buildSsaWxStatusLine(
  activeLevels: ReadonlySet<number> | undefined,
  availableLevels: ReadonlySet<number> | undefined
): string {
  const hasAnyLevel = Boolean(availableLevels && availableLevels.size > 0);
  if (!hasAnyLevel) {
    return "";
  }

  const slots: string[] = [];
  for (let level = 1; level <= 6; level += 1) {
    const isAvailable = availableLevels?.has(level) ?? false;
    if (!isAvailable) {
      slots.push("   ");
      continue;
    }
    if (activeLevels?.has(level)) {
      slots.push(`(${level})`);
    } else {
      slots.push(` ${level} `);
    }
  }
  return slots.join("");
}

function formatRangeNm(rangeNm: number | null): string {
  if (rangeNm === null || !Number.isFinite(rangeNm)) {
    return "--NM";
  }
  const rounded = Math.max(0, Math.round(rangeNm));
  return `${rounded}NM`;
}

function formatZuluHhmm(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hh}${mm}`;
}

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

function drawSsaSymbol(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sizePx: number,
  color: ListsColors
): void {
  const squareSize = Math.max(7, Math.round(sizePx));
  const pxX = Math.round(x);
  const pxY = Math.round(y);
  const symbolCenterX = pxX + squareSize * 0.5;
  const symbolCenterY = pxY + squareSize * 0.5;

  // Keep a tight margin to the square walls while reserving one pixel for the square stroke.
  const triangleMargin = Math.max(1, Math.round(squareSize * 0.12));
  const innerBoxSize = Math.max(4, squareSize - 2 - triangleMargin * 2);
  const triangleSide = innerBoxSize;
  const triangleHeight = triangleSide * (Math.sqrt(3) / 2);
  const triangleHalfSide = triangleSide * 0.5;
  const baseY = symbolCenterY - triangleHeight / 3;
  const apexY = baseY + triangleHeight;

  // Green square outline.
  ctx.strokeStyle = color.green;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(pxX + 0.5, pxY + 0.5, squareSize - 1, squareSize - 1);

  // Red inverted equilateral triangle with small side margins.
  ctx.fillStyle = color.red;
  ctx.beginPath();
  ctx.moveTo(symbolCenterX - triangleHalfSide, baseY);
  ctx.lineTo(symbolCenterX + triangleHalfSide, baseY);
  ctx.lineTo(symbolCenterX, apexY);
  ctx.closePath();
  ctx.fill();
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

export class StarsListsRenderer {
  private constructor(
    private readonly font: LoadedBitmapFont,
    private colors: ListsColors
  ) {}

  static async create(options: ListsCreateOptions = {}): Promise<StarsListsRenderer> {
    const fontBasePath = options.fontBasePath ?? "/font/sddCharFontSetASize1";
    const font = await loadBitmapFont(fontBasePath);
    return new StarsListsRenderer(font, { ...DEFAULT_LIST_COLORS, ...(options.colors ?? {}) });
  }

  getLineHeight(): number {
    return this.font.height;
  }

  drawText(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    color?: string
  ): void {
    drawTintedBitmapText(
      ctx,
      this.font,
      Math.round(x),
      Math.round(y),
      text,
      color ?? this.colors.green
    );
  }

  setGreenColor(color: string): void {
    this.colors = {
      ...this.colors,
      green: color
    };
  }

  setRedColor(color: string): void {
    this.colors = {
      ...this.colors,
      red: color
    };
  }

  setSsaWxColor(color: string): void {
    this.colors = {
      ...this.colors,
      ssaWx: color
    };
  }

  drawSsa(ctx: CanvasRenderingContext2D, input: SsaDrawInput): void {
    const symbolScale = input.symbolScale ?? 1;
    const symbolSizePx = Math.max(8, Math.round(11 * symbolScale));
    drawSsaSymbol(ctx, input.x, input.y, symbolSizePx, this.colors);

    const stationSource =
      input.qnhStations && input.qnhStations.length > 0
        ? input.qnhStations
        : [{ airportIcao: input.airportIcao, qnhInHg: input.qnhInHg }];
    const qnhLines = buildSsaQnhLines(stationSource, 3);
    const utcLine = formatUtcTime(input.nowUtc ?? new Date());
    const mainQnhLine = formatQnhInHg(input.qnhInHg);
    const wxStatusLine = buildSsaWxStatusLine(input.wxActiveLevels, input.wxAvailableLevels);
    const wxHistoryFrameNo =
      typeof input.wxHistoryFrameNo === "number" && Number.isFinite(input.wxHistoryFrameNo)
        ? Math.max(1, Math.floor(input.wxHistoryFrameNo))
        : null;
    const ssaUtcAltimeterLine = `${utcLine} ${mainQnhLine}`;
    const ssaLine2 = "OK/OK/NA MULTI";
    const ssaLine3 = `${formatRangeNm(input.rangeNm ?? null)} PTL: 1.0`;
    const baseLines = [
      ssaUtcAltimeterLine,
      ssaLine2,
      ssaLine3,
      ...qnhLines,
      ...(wxHistoryFrameNo === null ? [] : [`WX HISTORY: ${wxHistoryFrameNo}`])
    ];
    const textX = Math.round(input.x);
    const textY = Math.round(input.y + symbolSizePx + 3);

    if (wxStatusLine.length > 0) {
      drawTintedBitmapText(
        ctx,
        this.font,
        textX,
        textY,
        wxStatusLine,
        this.colors.ssaWx
      );
      drawTintedBitmapText(
        ctx,
        this.font,
        textX,
        textY + this.font.height,
        baseLines.join("\n"),
        this.colors.green
      );
      return;
    }

    drawTintedBitmapText(
      ctx,
      this.font,
      textX,
      textY,
      baseLines.join("\n"),
      this.colors.green
    );
  }

  drawCoastSuspend(ctx: CanvasRenderingContext2D, input: CoastSuspendDrawInput): void {
    const headerLine = "COAST/SUSPEND";
    const callsigns = (input.callsigns ?? [])
      .map((callsign) => (typeof callsign === "string" ? callsign.trim().toUpperCase() : ""))
      .filter((callsign) => callsign.length > 0)
      .slice(0, 5);
    const lines = [headerLine, ...callsigns];
    const align = input.align ?? "left";

    let drawX = Math.round(input.x);
    if (align === "right") {
      const maxWidth = lines.reduce(
        (currentMax, line) => Math.max(currentMax, measureBitmapTextWidth(this.font, line)),
        0
      );
      drawX = Math.round(input.x - maxWidth);
    }

    drawTintedBitmapText(
      ctx,
      this.font,
      drawX,
      Math.round(input.y),
      lines.join("\n"),
      this.colors.green
    );
  }

  drawLaCaMci(ctx: CanvasRenderingContext2D, input: LaCaMciDrawInput): void {
    const headerLine = "LA/CA/MCI";
    const alerts = (input.conflictAlerts ?? [])
      .map((label) => label.trim().toUpperCase())
      .filter((label) => label.length > 0)
      .slice(0, 5)
      .map((label) => {
        const laParsed = label.match(/^(.*)\s+([0-9]{1,3})\s+(LA)$/);
        if (laParsed) {
          const callsign = laParsed[1].trim();
          const altitude = laParsed[2].trim();
          return {
            left: callsign.length > 0 ? callsign : label,
            altitude,
            right: "LA"
          };
        }

        const caParsed = label.match(/^(.*)\s+(CA)$/);
        if (caParsed) {
          const left = caParsed[1].trim();
          return {
            left: left.length > 0 ? left : label,
            altitude: null as string | null,
            right: "CA"
          };
        }

        const parsed = label.match(/^(.*)\s+(CA|LA)$/);
        if (parsed) {
          const left = parsed[1].trim();
          const right = parsed[2].trim();
          return {
            left: left.length > 0 ? left : label,
            altitude: null as string | null,
            right
          };
        }

        if (!label) {
          return {
            left: label,
            altitude: null as string | null,
            right: null as string | null
          };
        }

        return {
          left: label,
          altitude: null as string | null,
          right: null as string | null
        };
      });
    const align = input.align ?? "left";
    const leftColumnWidthPx = alerts.reduce(
      (currentMax, row) => Math.max(currentMax, measureBitmapTextWidth(this.font, row.left)),
      0
    );
    const middleColumnGapPx = measureBitmapTextWidth(this.font, " ");
    const middleColumnWidthPx = alerts.reduce(
      (currentMax, row) =>
        Math.max(currentMax, row.altitude ? measureBitmapTextWidth(this.font, row.altitude) : 0),
      0
    );
    const rightColumnGapPx = measureBitmapTextWidth(this.font, " ");
    const maxRightWidthPx = alerts.reduce(
      (currentMax, row) =>
        Math.max(currentMax, row.right ? measureBitmapTextWidth(this.font, row.right) : 0),
      0
    );
    let rowWidthPx = leftColumnWidthPx;
    if (maxRightWidthPx > 0) {
      if (middleColumnWidthPx > 0) {
        rowWidthPx += middleColumnGapPx + middleColumnWidthPx + rightColumnGapPx + maxRightWidthPx;
      } else {
        rowWidthPx += middleColumnGapPx + maxRightWidthPx;
      }
    }
    const blockWidthPx = Math.max(measureBitmapTextWidth(this.font, headerLine), rowWidthPx);

    let drawX = Math.round(input.x);
    if (align === "right") {
      drawX = Math.round(input.x - blockWidthPx);
    }

    const baseY = Math.round(input.y);
    drawTintedBitmapText(ctx, this.font, drawX, baseY, headerLine, this.colors.green);

    for (let i = 0; i < alerts.length; i += 1) {
      const row = alerts[i];
      const rowY = baseY + this.font.height * (i + 1);
      drawTintedBitmapText(ctx, this.font, drawX, rowY, row.left, this.colors.green);
      const altitudeX = drawX + leftColumnWidthPx + middleColumnGapPx;
      if (row.altitude) {
        drawTintedBitmapText(
          ctx,
          this.font,
          altitudeX,
          rowY,
          row.altitude,
          this.colors.green
        );
      }
      if (row.right) {
        const statusX =
          middleColumnWidthPx > 0
            ? altitudeX + middleColumnWidthPx + rightColumnGapPx
            : drawX + leftColumnWidthPx + middleColumnGapPx;
        drawTintedBitmapText(
          ctx,
          this.font,
          statusX,
          rowY,
          row.right,
          this.colors.green
        );
      }
    }
  }

  drawControlPosition(ctx: CanvasRenderingContext2D, input: ControlPositionDrawInput): void {
    const positionId = input.positionId.trim().toUpperCase();
    const signOn = formatZuluHhmm(input.signedOnUtc);
    const line = `${positionId} ${signOn}`;
    const align = input.align ?? "left";
    let drawX = Math.round(input.x);

    if (align === "right") {
      drawX = Math.round(input.x - measureBitmapTextWidth(this.font, line));
    }

    drawTintedBitmapText(ctx, this.font, drawX, Math.round(input.y), line, this.colors.green);
  }

  drawTowerList(ctx: CanvasRenderingContext2D, input: TowerListDrawInput): void {
    const airportIata = input.airportIata.trim().toUpperCase();
    const headerLine = `${airportIata} TOWER`;
    const towerRows = (input.aircraft ?? [])
      .map((entry) => {
        const callsign = (entry.callsign ?? "").trim().toUpperCase();
        const aircraftTypeIcao = (entry.aircraftTypeIcao ?? "").trim().toUpperCase();
        if (!callsign) {
          return null;
        }
        return {
          callsign,
          aircraftTypeIcao: aircraftTypeIcao || "----"
        };
      })
      .filter((row): row is { callsign: string; aircraftTypeIcao: string } => row !== null)
      .slice(0, 5);
    const align = input.align ?? "left";
    const callsignColumnWidthPx = towerRows.reduce(
      (currentMax, row) => Math.max(currentMax, measureBitmapTextWidth(this.font, row.callsign)),
      0
    );
    const typeColumnGapPx = measureBitmapTextWidth(this.font, " ");
    const maxTypeWidthPx = towerRows.reduce(
      (currentMax, row) => Math.max(currentMax, measureBitmapTextWidth(this.font, row.aircraftTypeIcao)),
      0
    );
    const rowWidthPx =
      towerRows.length > 0 ? callsignColumnWidthPx + typeColumnGapPx + maxTypeWidthPx : 0;
    const blockWidthPx = Math.max(measureBitmapTextWidth(this.font, headerLine), rowWidthPx);

    let drawX = Math.round(input.x);
    if (align === "right") {
      drawX = Math.round(input.x - blockWidthPx);
    }

    const baseY = Math.round(input.y);
    drawTintedBitmapText(ctx, this.font, drawX, baseY, headerLine, this.colors.green);

    for (let i = 0; i < towerRows.length; i += 1) {
      const row = towerRows[i];
      const rowY = baseY + this.font.height * (i + 1);
      drawTintedBitmapText(ctx, this.font, drawX, rowY, row.callsign, this.colors.green);
      drawTintedBitmapText(
        ctx,
        this.font,
        drawX + callsignColumnWidthPx + typeColumnGapPx,
        rowY,
        row.aircraftTypeIcao,
        this.colors.green
      );
    }
  }

  drawVfrList(ctx: CanvasRenderingContext2D, input: VfrListDrawInput): void {
    const headerLine = "VFR LIST";
    const entries = (input.entries ?? [])
      .map((entry) => {
        const rawCallsign = (entry.callsign ?? "").trim().toUpperCase();
        const rawSquawk = (entry.squawk ?? "").trim().toUpperCase();
        if (!rawCallsign) {
          return null;
        }
        const index = String(entry.index).trim().toUpperCase();
        if (!index) {
          return null;
        }
        return {
          left: `${index} ${rawCallsign}`,
          beacon: rawSquawk || "----"
        };
      })
      .filter((row): row is { left: string; beacon: string } => row !== null)
      .slice(0, 5);
    const align = input.align ?? "left";
    const leftColumnWidthPx = entries.reduce(
      (currentMax, row) => Math.max(currentMax, measureBitmapTextWidth(this.font, row.left)),
      0
    );
    const beaconColumnGapPx = measureBitmapTextWidth(this.font, " ");
    const maxBeaconWidthPx = entries.reduce(
      (currentMax, row) => Math.max(currentMax, measureBitmapTextWidth(this.font, row.beacon)),
      0
    );
    const rowWidthPx =
      entries.length > 0 ? leftColumnWidthPx + beaconColumnGapPx + maxBeaconWidthPx : 0;
    const blockWidthPx = Math.max(measureBitmapTextWidth(this.font, headerLine), rowWidthPx);

    let drawX = Math.round(input.x);
    if (align === "right") {
      drawX = Math.round(input.x - blockWidthPx);
    }

    const baseY = Math.round(input.y);
    drawTintedBitmapText(ctx, this.font, drawX, baseY, headerLine, this.colors.green);

    for (let i = 0; i < entries.length; i += 1) {
      const row = entries[i];
      const rowY = baseY + this.font.height * (i + 1);
      drawTintedBitmapText(ctx, this.font, drawX, rowY, row.left, this.colors.green);
      drawTintedBitmapText(
        ctx,
        this.font,
        drawX + leftColumnWidthPx + beaconColumnGapPx,
        rowY,
        row.beacon,
        this.colors.green
      );
    }
  }

  drawFlightPlanList(ctx: CanvasRenderingContext2D, input: FlightPlanListDrawInput): void {
    const headerLine = "FLIGHT PLAN";
    const entries = (input.entries ?? [])
      .map((entry) => {
        const callsign = (entry.callsign ?? "").trim().toUpperCase();
        const destination = (entry.destination ?? "").trim().toUpperCase();
        if (!callsign) {
          return null;
        }
        return {
          callsign,
          destination: destination || "----"
        };
      })
      .filter((row): row is { callsign: string; destination: string } => row !== null)
      .slice(0, 5);
    const align = input.align ?? "left";
    const callsignColumnWidthPx = entries.reduce(
      (currentMax, row) => Math.max(currentMax, measureBitmapTextWidth(this.font, row.callsign)),
      0
    );
    const destinationColumnGapPx = measureBitmapTextWidth(this.font, " ");
    const maxDestinationWidthPx = entries.reduce(
      (currentMax, row) => Math.max(currentMax, measureBitmapTextWidth(this.font, row.destination)),
      0
    );
    const rowWidthPx =
      entries.length > 0 ? callsignColumnWidthPx + destinationColumnGapPx + maxDestinationWidthPx : 0;
    const blockWidthPx = Math.max(measureBitmapTextWidth(this.font, headerLine), rowWidthPx);

    let drawX = Math.round(input.x);
    if (align === "right") {
      drawX = Math.round(input.x - blockWidthPx);
    }

    const baseY = Math.round(input.y);
    drawTintedBitmapText(ctx, this.font, drawX, baseY, headerLine, this.colors.green);

    for (let i = 0; i < entries.length; i += 1) {
      const row = entries[i];
      const rowY = baseY + this.font.height * (i + 1);
      drawTintedBitmapText(ctx, this.font, drawX, rowY, row.callsign, this.colors.green);
      drawTintedBitmapText(
        ctx,
        this.font,
        drawX + callsignColumnWidthPx + destinationColumnGapPx,
        rowY,
        row.destination,
        this.colors.green
      );
    }
  }
}
