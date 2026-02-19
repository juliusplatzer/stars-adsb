// app/lib/bitmapFont.ts

export type GlyphMetric = {
    sx: number; sy: number; w: number; h: number;
    offX: number; offY: number; stepX: number;
  };

  type TintedGlyphMetric = Pick<GlyphMetric, "sx" | "sy" | "w" | "h">;
  
  type FontMeta = {
    height: number;
    width: number;
    pointSize: number;
    metrics: GlyphMetric[]; // indexed by charCode 0..255
  };
  
  export type LoadedBitmapFont = {
    height: number;
    width: number;
    metrics: GlyphMetric[];
    atlas: HTMLImageElement;
  };
  
  // Small cache to avoid re-downloading the same font repeatedly (RAM efficient)
  const fontCache = new Map<string, Promise<LoadedBitmapFont>>();
  const tintedGlyphCache = new Map<string, HTMLCanvasElement>();
  const MAX_TINTED_GLYPH_CACHE_ENTRIES = 2048;
  
  export function loadBitmapFont(basePath: string): Promise<LoadedBitmapFont> {
    const cached = fontCache.get(basePath);
    if (cached) return cached;
  
    const p = (async () => {
      const metaPromise = fetch(`${basePath}.json`).then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load ${basePath}.json (${r.status})`);
        return (await r.json()) as FontMeta;
      });
  
      const imgPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error(`Failed to load ${basePath}.png`));
        im.src = `${basePath}.png`;
      });
  
      const [meta, img] = await Promise.all([metaPromise, imgPromise]);
  
      return {
        height: meta.height,
        width: meta.width,
        metrics: meta.metrics,
        atlas: img,
      };
    })();
  
    fontCache.set(basePath, p);
    return p;
  }

  function makeTintedGlyphKey(
    font: LoadedBitmapFont,
    metric: TintedGlyphMetric,
    tintColor: string
  ): string {
    const atlasKey = font.atlas.currentSrc || font.atlas.src || "atlas";
    return `${atlasKey}|${metric.sx},${metric.sy},${metric.w},${metric.h}|${tintColor}`;
  }

  export function getTintedGlyphCanvas(
    font: LoadedBitmapFont,
    metric: TintedGlyphMetric,
    tintColor: string
  ): HTMLCanvasElement | null {
    if (metric.w <= 0 || metric.h <= 0) {
      return null;
    }

    const key = makeTintedGlyphKey(font, metric, tintColor);
    const cached = tintedGlyphCache.get(key);
    if (cached) {
      // LRU refresh
      tintedGlyphCache.delete(key);
      tintedGlyphCache.set(key, cached);
      return cached;
    }

    const canvas = document.createElement("canvas");
    canvas.width = metric.w;
    canvas.height = metric.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, metric.w, metric.h);
    ctx.drawImage(
      font.atlas,
      metric.sx,
      metric.sy,
      metric.w,
      metric.h,
      0,
      0,
      metric.w,
      metric.h
    );
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = tintColor;
    ctx.fillRect(0, 0, metric.w, metric.h);
    ctx.globalCompositeOperation = "source-over";

    tintedGlyphCache.set(key, canvas);
    if (tintedGlyphCache.size > MAX_TINTED_GLYPH_CACHE_ENTRIES) {
      const oldestKey = tintedGlyphCache.keys().next().value;
      if (oldestKey) {
        tintedGlyphCache.delete(oldestKey);
      }
    }

    return canvas;
  }
  
  export function drawBitmapText(
    ctx: CanvasRenderingContext2D,
    font: LoadedBitmapFont,
    x0: number,
    y0: number,
    text: string,
    scale = 1,
    lineGap = 0
  ) {
    // Pixel crispness
    ctx.imageSmoothingEnabled = false;
  
    let x = x0;
    let y = y0;
    const H = font.height;
  
    const q = "?".charCodeAt(0);
    const fallback = (q >= 0 && q < font.metrics.length) ? font.metrics[q] : font.metrics[0];
  
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
  
      if (ch === "\n") {
        x = x0;
        y += (H + lineGap) * scale;
        continue;
      }
  
      const c = text.charCodeAt(i);
      const g = (c >= 0 && c < font.metrics.length) ? font.metrics[c] : fallback;
      if (!g) continue;
  
      if (g.w > 0 && g.h > 0) {
        // Placement consistent with vice-style metrics:
        // dx = x + offX, dy = y + (H - offY - h)
        const dx = x + g.offX * scale;
        const dy = y + (H - g.offY - g.h) * scale;
  
        ctx.drawImage(
          font.atlas,
          g.sx, g.sy, g.w, g.h,
          dx, dy,
          g.w * scale, g.h * scale
        );
      }
  
      x += g.stepX * scale;
    }
  }
  
