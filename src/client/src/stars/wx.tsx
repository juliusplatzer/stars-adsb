import type { WxReflectivityResponse } from "@vstars/shared";
import colors from "./colors.js";

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

type WxStippleKind = "light" | "dense";

export interface StarsWxDrawInput {
  scopeRect: ScopeRect;
  viewCenter: LatLon | null;
  viewRadiusNm: number | null;
  panOffsetPxX: number;
  panOffsetPxY: number;
  activeLevels: ReadonlySet<number>;
  radar: WxReflectivityResponse | null;
  lowLevelFillColor?: string;
  highLevelFillColor?: string;
  stippleBrightnessPercent?: number;
}

const WX_STIPPLE_LIGHT: number[] = [
  0b00000000000000000000000000000000,
  0b00000000000000000000000000000000,
  0b00000000000011000000000000000000,
  0b00000000000011000000000000000000,
  0b00000000000000000000000000000000,
  0b00000000000000000000000000000000,
  0b00000000000000000000000000000000,
  0b00000000000000000000001100000000,
  0b00000000000000000000001100000000,
  0b00000000000000000000000000000000,
  0b00000000000000000000000000000000,
  0b00000001100000000000000000000000,
  0b00000001100000000000000000000000,
  0b00000000000000000000000000000000,
  0b00000000000000000000000000000000,
  0b00000000000000110000000000000000,
  0b00000000000000110000000000000000,
  0b00000000000000000000000000001100,
  0b00000000000000000000000000001100,
  0b00000000000000000000000000000000,
  0b00000000000000000000000000000000,
  0b00000000000000000000000000000000,
  0b00000000110000000000000000000000,
  0b00000000110000000000000000000000,
  0b00000000000000000000000000000000,
  0b00000000000000000011000000000000,
  0b00000000000000000011000000000000,
  0b00000000000000000000000000000000,
  0b00000000000000000000000000000000,
  0b00000000000000000000000000000000,
  0b11000000000000000000000000000000,
  0b11000000000000000000000000000000
];

const WX_STIPPLE_DENSE: number[] = [
  0b00000000000000000000000000000000,
  0b00000000000000000000000000000000,
  0b00001000000000000000100000000000,
  0b00001000000000000000100000000000,
  0b00000000000110000000000000011000,
  0b01000000000000000100000000000000,
  0b01000000000000000100000000000000,
  0b00000001100000000000000110000000,
  0b00000000000000000000000000000000,
  0b00000000000000110000000000000011,
  0b00000000000000000000000000000000,
  0b00011000000000000001100000000000,
  0b00000000000000000000000000000000,
  0b00000000001000000000000000100000,
  0b00000000001000000000000000100000,
  0b11000000000000001100000000000000,
  0b00000000000000000000000000000000,
  0b00000000000000000000000000000000,
  0b00001000000000000000100000000000,
  0b00001000000000000000100000000000,
  0b00000000000110000000000000011000,
  0b01000000000000000100000000000000,
  0b01000000000000000100000000000000,
  0b00000001100000000000000110000000,
  0b00000000000000000000000000000000,
  0b00000000000000110000000000000011,
  0b00000000000000000000000000000000,
  0b00011000000000000001100000000000,
  0b00000000000000000000000000000000,
  0b00000000001000000000000000100000,
  0b00000000001000000000000000100000,
  0b11000000000000001100000000000000
];

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function resolveStippleKind(level: number): WxStippleKind | null {
  // Requested mapping for current ITWS workflow.
  if (level === 2 || level === 4) {
    return "light";
  }
  if (level === 3 || level === 6) {
    return "dense";
  }
  return null;
}

function createStippleCanvas(
  bits: number[],
  alpha: number,
  color: { r: number; g: number; b: number }
): HTMLCanvasElement {
  const size = bits.length;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return canvas;
  }

  const imageData = context.createImageData(size, size);
  const data = imageData.data;
  for (let row = 0; row < size; row += 1) {
    const mask = bits[row] >>> 0;
    for (let col = 0; col < size; col += 1) {
      const isSet = ((mask >>> (31 - col)) & 1) === 1;
      if (!isSet) {
        continue;
      }
      const offset = (row * size + col) * 4;
      data[offset + 0] = color.r;
      data[offset + 1] = color.g;
      data[offset + 2] = color.b;
      data[offset + 3] = alpha;
    }
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

export class StarsWxRenderer {
  private readonly lightCanvasByAlpha = new Map<number, HTMLCanvasElement>();
  private readonly denseCanvasByAlpha = new Map<number, HTMLCanvasElement>();

  private getStipplePattern(
    ctx: CanvasRenderingContext2D,
    kind: WxStippleKind,
    brightnessPercent: number
  ): CanvasPattern | null {
    const clampedBrightness = Math.max(0, Math.min(100, Math.round(brightnessPercent)));
    if (clampedBrightness <= 0) {
      return null;
    }

    const maxAlpha = 255;
    const alpha = Math.round((maxAlpha * clampedBrightness) / 100);
    if (alpha <= 0) {
      return null;
    }

    const cache = kind === "light" ? this.lightCanvasByAlpha : this.denseCanvasByAlpha;
    let canvas = cache.get(alpha);
    if (!canvas) {
      canvas = createStippleCanvas(
        kind === "light" ? WX_STIPPLE_LIGHT : WX_STIPPLE_DENSE,
        alpha,
        { r: 255, g: 255, b: 255 }
      );
      cache.set(alpha, canvas);
    }
    return ctx.createPattern(canvas, "repeat");
  }

  private drawLegacy(
    ctx: CanvasRenderingContext2D,
    input: StarsWxDrawInput,
    radar: WxReflectivityResponse,
    scopeCenterX: number,
    scopeCenterY: number,
    pixelsPerNm: number,
    viewCenter: LatLon,
    lowLevelFillColor: string,
    highLevelFillColor: string,
    lightPattern: CanvasPattern | null,
    densePattern: CanvasPattern | null
  ): void {
    const nmPerLonDeg = 60 * Math.cos(toRadians(viewCenter.lat));
    if (!Number.isFinite(nmPerLonDeg) || Math.abs(nmPerLonDeg) < 1e-9) {
      return;
    }

    if (radar.width <= 0 || radar.height <= 0) {
      return;
    }

    const radarCenterDxNm = (radar.center.lon - viewCenter.lon) * nmPerLonDeg;
    const radarCenterDyNm = (radar.center.lat - viewCenter.lat) * 60;
    const cellNm = radar.cellSizeNm;
    const halfCellNm = cellNm * 0.5;
    const cellPx = cellNm * pixelsPerNm;
    const halfCellPx = cellPx * 0.5;
    const startXNm = radarCenterDxNm - radar.radiusNm + halfCellNm;
    const startYNm = radarCenterDyNm + radar.radiusNm - halfCellNm;
    const maxIndex = radar.width * radar.height;
    const visibleMinX = input.scopeRect.x - cellPx;
    const visibleMaxX = input.scopeRect.x + input.scopeRect.width + cellPx;
    const visibleMinY = input.scopeRect.y - cellPx;
    const visibleMaxY = input.scopeRect.y + input.scopeRect.height + cellPx;
    for (let row = 0; row < radar.height; row += 1) {
      const yNm = startYNm - row * cellNm;
      const y = scopeCenterY - yNm * pixelsPerNm - halfCellPx;
      if (y + cellPx < visibleMinY || y > visibleMaxY) {
        continue;
      }

      for (let col = 0; col < radar.width; col += 1) {
        const index = row * radar.width + col;
        if (index < 0 || index >= maxIndex) {
          continue;
        }

        const level = radar.levels[index] ?? 0;
        if (level < 1 || level > 6 || !input.activeLevels.has(level)) {
          continue;
        }

        const xNm = startXNm + col * cellNm;
        const x = scopeCenterX + xNm * pixelsPerNm - halfCellPx;
        if (x + cellPx < visibleMinX || x > visibleMaxX) {
          continue;
        }

        ctx.fillStyle = level <= 3 ? lowLevelFillColor : highLevelFillColor;
        ctx.fillRect(x, y, cellPx, cellPx);

        const stipple = resolveStippleKind(level);
        if (stipple === "light" && lightPattern) {
          ctx.fillStyle = lightPattern;
          ctx.fillRect(x, y, cellPx, cellPx);
        } else if (stipple === "dense" && densePattern) {
          ctx.fillStyle = densePattern;
          ctx.fillRect(x, y, cellPx, cellPx);
        }
      }
    }
  }

  private drawItws(
    ctx: CanvasRenderingContext2D,
    input: StarsWxDrawInput,
    radar: WxReflectivityResponse,
    scopeCenterX: number,
    scopeCenterY: number,
    pixelsPerNm: number,
    viewCenter: LatLon,
    lowLevelFillColor: string,
    highLevelFillColor: string,
    lightPattern: CanvasPattern | null,
    densePattern: CanvasPattern | null
  ): boolean {
    const rows = radar.rows ?? 0;
    const cols = radar.cols ?? 0;
    const cells = radar.cells ?? null;
    const trp = radar.trp;
    const gridGeom = radar.gridGeom;
    if (!trp || !gridGeom || !cells || rows <= 0 || cols <= 0 || cells.length === 0) {
      return false;
    }

    const nmPerLonDeg = 60 * Math.cos(toRadians(viewCenter.lat));
    if (!Number.isFinite(nmPerLonDeg) || Math.abs(nmPerLonDeg) < 1e-9) {
      return false;
    }

    const dxM = gridGeom.dxM;
    const dyM = gridGeom.dyM;
    if (!Number.isFinite(dxM) || !Number.isFinite(dyM) || dxM <= 0 || dyM <= 0) {
      return false;
    }

    const rotationRad = toRadians(gridGeom.rotationDeg);
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);

    const trpDxNm = (trp.lonDeg - viewCenter.lon) * nmPerLonDeg;
    const trpDyNm = (trp.latDeg - viewCenter.lat) * 60;

    const halfColVecX = ((dxM * cos * pixelsPerNm) / 1852) * 0.5;
    const halfColVecY = ((-dxM * sin * pixelsPerNm) / 1852) * 0.5;
    // Row increases downward in row-major plotting.
    const halfRowVecX = ((dyM * sin * pixelsPerNm) / 1852) * 0.5;
    const halfRowVecY = ((dyM * cos * pixelsPerNm) / 1852) * 0.5;

    // Slightly enlarge each cell polygon to avoid anti-aliased seams between adjacent fills.
    const seamBleedPx = 0.6;
    const halfColLenPx = Math.hypot(halfColVecX, halfColVecY);
    const halfRowLenPx = Math.hypot(halfRowVecX, halfRowVecY);
    const colScale = halfColLenPx > 1e-9 ? 1 + seamBleedPx / halfColLenPx : 1;
    const rowScale = halfRowLenPx > 1e-9 ? 1 + seamBleedPx / halfRowLenPx : 1;
    const drawHalfColVecX = halfColVecX * colScale;
    const drawHalfColVecY = halfColVecY * colScale;
    const drawHalfRowVecX = halfRowVecX * rowScale;
    const drawHalfRowVecY = halfRowVecY * rowScale;

    const cellPadX = Math.abs(drawHalfColVecX) + Math.abs(drawHalfRowVecX);
    const cellPadY = Math.abs(drawHalfColVecY) + Math.abs(drawHalfRowVecY);
    const visibleMinX = input.scopeRect.x - cellPadX;
    const visibleMaxX = input.scopeRect.x + input.scopeRect.width + cellPadX;
    const visibleMinY = input.scopeRect.y - cellPadY;
    const visibleMaxY = input.scopeRect.y + input.scopeRect.height + cellPadY;

    for (let row = 0; row < rows; row += 1) {
      const yLocalM = gridGeom.yOffsetM + (row + 0.5) * dyM;
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const level = cells[index] ?? 0;
        if (level < 1 || level > 6 || !input.activeLevels.has(level)) {
          continue;
        }

        const xLocalM = gridGeom.xOffsetM + (col + 0.5) * dxM;

        // Local meters are relative to TRP and rotated by rotationDeg around TRP.
        const eastCenterM = xLocalM * cos - yLocalM * sin;
        const northCenterM = xLocalM * sin + yLocalM * cos;

        const cx = scopeCenterX + (trpDxNm + eastCenterM / 1852) * pixelsPerNm;
        const cy = scopeCenterY - (trpDyNm + northCenterM / 1852) * pixelsPerNm;

        const x0 = cx - drawHalfColVecX - drawHalfRowVecX;
        const y0 = cy - drawHalfColVecY - drawHalfRowVecY;
        const x1 = cx + drawHalfColVecX - drawHalfRowVecX;
        const y1 = cy + drawHalfColVecY - drawHalfRowVecY;
        const x2 = cx + drawHalfColVecX + drawHalfRowVecX;
        const y2 = cy + drawHalfColVecY + drawHalfRowVecY;
        const x3 = cx - drawHalfColVecX + drawHalfRowVecX;
        const y3 = cy - drawHalfColVecY + drawHalfRowVecY;

        const minX = Math.min(x0, x1, x2, x3);
        const maxX = Math.max(x0, x1, x2, x3);
        const minY = Math.min(y0, y1, y2, y3);
        const maxY = Math.max(y0, y1, y2, y3);
        if (maxX < visibleMinX || minX > visibleMaxX || maxY < visibleMinY || minY > visibleMaxY) {
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.closePath();
        ctx.fillStyle = level <= 3 ? lowLevelFillColor : highLevelFillColor;
        ctx.fill();

        const stipple = resolveStippleKind(level);
        if (stipple === "light" && lightPattern) {
          ctx.fillStyle = lightPattern;
          ctx.fill();
        } else if (stipple === "dense" && densePattern) {
          ctx.fillStyle = densePattern;
          ctx.fill();
        }
      }
    }

    return true;
  }

  draw(ctx: CanvasRenderingContext2D, input: StarsWxDrawInput): void {
    const { radar, viewCenter, viewRadiusNm } = input;
    if (!radar || !viewCenter || viewRadiusNm === null || viewRadiusNm <= 0) {
      return;
    }
    if (input.activeLevels.size === 0) {
      return;
    }

    const scopeCenterX = input.scopeRect.x + input.scopeRect.width * 0.5 + input.panOffsetPxX;
    const scopeCenterY = input.scopeRect.y + input.scopeRect.height * 0.5 + input.panOffsetPxY;
    const pixelsPerNm = Math.min(input.scopeRect.width, input.scopeRect.height) / (2 * viewRadiusNm);
    if (!Number.isFinite(pixelsPerNm) || pixelsPerNm <= 0) {
      return;
    }
    const lowLevelFillColor = input.lowLevelFillColor ?? colors.DARK_GRAY_BLUE;
    const highLevelFillColor = input.highLevelFillColor ?? colors.DARK_MUSTARD;
    const lightPattern = this.getStipplePattern(ctx, "light", input.stippleBrightnessPercent ?? 100);
    const densePattern = this.getStipplePattern(ctx, "dense", input.stippleBrightnessPercent ?? 100);

    ctx.save();
    ctx.beginPath();
    ctx.rect(input.scopeRect.x, input.scopeRect.y, input.scopeRect.width, input.scopeRect.height);
    ctx.clip();

    const drewItws = this.drawItws(
      ctx,
      input,
      radar,
      scopeCenterX,
      scopeCenterY,
      pixelsPerNm,
      viewCenter,
      lowLevelFillColor,
      highLevelFillColor,
      lightPattern,
      densePattern
    );
    if (!drewItws) {
      this.drawLegacy(
        ctx,
        input,
        radar,
        scopeCenterX,
        scopeCenterY,
        pixelsPerNm,
        viewCenter,
        lowLevelFillColor,
        highLevelFillColor,
        lightPattern,
        densePattern
      );
    }

    ctx.restore();
  }
}
