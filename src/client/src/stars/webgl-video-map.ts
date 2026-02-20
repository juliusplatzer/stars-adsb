export interface LatLon {
  lat: number;
  lon: number;
}

export type VideoMapLines = LatLon[][];

export interface VideoMapRenderInput {
  scopeRect: { x: number; y: number; width: number; height: number };
  center: LatLon | null;
  radiusNm: number | null;
  panOffsetPxX: number;
  panOffsetPxY: number;
  brightnessPercent: number;
  activeMapIds: ReadonlySet<number>;
  videoMapsById: Map<number, VideoMapLines>;
  canvasCssHeight: number;
  canvasPixelWidth: number;
  canvasPixelHeight: number;
  canvasDpr: number;
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const METERS_PER_NM = 1852;
const METERS_PER_DEG_LAT = 60 * METERS_PER_NM;
const DEFAULT_TILE_SIZE_PX = 512;
const DEFAULT_BUCKET_SCALES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
const DEFAULT_MAX_TILES = 128;
const LINE_WIDTH_PX = 1.25;
// Raise to sharpen edges (more aliasing). Set to 0 to disable thresholding.
const MAP_LINE_ALPHA_CUTOFF = 0.2;

class LruTextureCache {
  private readonly entries = new Map<string, WebGLTexture>();

  constructor(
    private readonly gl: WebGLRenderingContext,
    private readonly maxEntries: number
  ) {}

  get(key: string): WebGLTexture | null {
    const existing = this.entries.get(key);
    if (!existing) {
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, existing);
    return existing;
  }

  set(key: string, texture: WebGLTexture): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    this.entries.set(key, texture);
    if (this.entries.size <= this.maxEntries) {
      return;
    }
    const firstKey = this.entries.keys().next().value;
    if (firstKey) {
      const evicted = this.entries.get(firstKey);
      if (evicted) {
        this.gl.deleteTexture(evicted);
      }
      this.entries.delete(firstKey);
    }
  }

  clear(): void {
    for (const texture of this.entries.values()) {
      this.gl.deleteTexture(texture);
    }
    this.entries.clear();
  }
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function latLonToMeters(point: LatLon, reference: LatLon): { x: number; y: number } {
  const latRad = toRadians(reference.lat);
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos(latRad);
  return {
    x: (point.lon - reference.lon) * metersPerDegLon,
    y: (point.lat - reference.lat) * METERS_PER_DEG_LAT
  };
}

function buildSegments(lines: VideoMapLines, reference: LatLon): { segments: Segment[]; bounds: Bounds | null } {
  const segments: Segment[] = [];
  let bounds: Bounds | null = null;

  for (const polyline of lines) {
    if (polyline.length < 2) {
      continue;
    }
    let prev = latLonToMeters(polyline[0], reference);
    for (let i = 1; i < polyline.length; i += 1) {
      const next = latLonToMeters(polyline[i], reference);
      const minX = Math.min(prev.x, next.x);
      const maxX = Math.max(prev.x, next.x);
      const minY = Math.min(prev.y, next.y);
      const maxY = Math.max(prev.y, next.y);
      segments.push({
        x1: prev.x,
        y1: prev.y,
        x2: next.x,
        y2: next.y,
        minX,
        maxX,
        minY,
        maxY
      });
      if (!bounds) {
        bounds = { minX, maxX, minY, maxY };
      } else {
        bounds.minX = Math.min(bounds.minX, minX);
        bounds.maxX = Math.max(bounds.maxX, maxX);
        bounds.minY = Math.min(bounds.minY, minY);
        bounds.maxY = Math.max(bounds.maxY, maxY);
      }
      prev = next;
    }
  }

  return { segments, bounds };
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to allocate shader.");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${info ?? "unknown error"}`);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("Unable to allocate WebGL program.");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${info ?? "unknown error"}`);
  }
  return program;
}

export class WebGLVideoMapRenderer {
  static create(canvas: HTMLCanvasElement): WebGLVideoMapRenderer | null {
    const attributes: WebGLContextAttributes = {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false
    };
    const gl =
      (canvas.getContext("webgl2", attributes) as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl", attributes) as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl", attributes) as WebGLRenderingContext | null);
    if (!gl) {
      return null;
    }
    return new WebGLVideoMapRenderer(gl);
  }

  private readonly program: WebGLProgram;
  private readonly positionBuffer: WebGLBuffer;
  private readonly texCoordBuffer: WebGLBuffer;
  private readonly aPositionLoc: number;
  private readonly aTexCoordLoc: number;
  private readonly uResolutionLoc: WebGLUniformLocation;
  private readonly uColorLoc: WebGLUniformLocation;
  private readonly uTextureLoc: WebGLUniformLocation;
  private readonly uAlphaCutoffLoc: WebGLUniformLocation;
  private readonly tileCache: LruTextureCache;
  private readonly emptyTiles = new Set<string>();
  private readonly rasterCanvas: HTMLCanvasElement;
  private readonly rasterCtx: CanvasRenderingContext2D;
  private readonly bucketScales: number[];
  private readonly tileSizePx: number;
  private readonly quadPositions: Float32Array;
  private readonly quadTexCoords: Float32Array;

  private basePxPerMeter: number | null = null;
  private lastMapSignature = "";
  private lastMapRef: Map<number, VideoMapLines> | null = null;
  private lastReferenceKey = "";
  private segments: Segment[] = [];
  private bounds: Bounds | null = null;

  private constructor(
    private readonly gl: WebGLRenderingContext,
    options: { tileSizePx?: number; bucketScales?: number[]; maxTiles?: number } = {}
  ) {
    this.tileSizePx = options.tileSizePx ?? DEFAULT_TILE_SIZE_PX;
    this.bucketScales = options.bucketScales ?? DEFAULT_BUCKET_SCALES.slice();
    this.tileCache = new LruTextureCache(gl, options.maxTiles ?? DEFAULT_MAX_TILES);

    const vertexSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      uniform vec2 u_resolution;
      varying vec2 v_texCoord;
      void main() {
        vec2 zeroToOne = a_position / u_resolution;
        vec2 clip = zeroToOne * 2.0 - 1.0;
        gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform vec4 u_color;
      uniform float u_alphaCutoff;
      varying vec2 v_texCoord;
      void main() {
        vec4 tex = texture2D(u_texture, v_texCoord);
        if (tex.a <= u_alphaCutoff) {
          discard;
        }
        float a = (tex.a - u_alphaCutoff) / max(1.0 - u_alphaCutoff, 0.0001);
        gl_FragColor = vec4(tex.rgb * u_color.rgb, a * u_color.a);
      }
    `;
    this.program = createProgram(gl, vertexSource, fragmentSource);
    const positionBuffer = gl.createBuffer();
    const texCoordBuffer = gl.createBuffer();
    if (!positionBuffer || !texCoordBuffer) {
      throw new Error("Failed to allocate WebGL buffers.");
    }
    this.positionBuffer = positionBuffer;
    this.texCoordBuffer = texCoordBuffer;
    const aPositionLoc = gl.getAttribLocation(this.program, "a_position");
    const aTexCoordLoc = gl.getAttribLocation(this.program, "a_texCoord");
    const uResolutionLoc = gl.getUniformLocation(this.program, "u_resolution");
    const uColorLoc = gl.getUniformLocation(this.program, "u_color");
    const uTextureLoc = gl.getUniformLocation(this.program, "u_texture");
    const uAlphaCutoffLoc = gl.getUniformLocation(this.program, "u_alphaCutoff");
    if (
      aPositionLoc < 0 ||
      aTexCoordLoc < 0 ||
      !uResolutionLoc ||
      !uColorLoc ||
      !uTextureLoc ||
      !uAlphaCutoffLoc
    ) {
      throw new Error("Failed to locate WebGL program attributes.");
    }
    this.aPositionLoc = aPositionLoc;
    this.aTexCoordLoc = aTexCoordLoc;
    this.uResolutionLoc = uResolutionLoc;
    this.uColorLoc = uColorLoc;
    this.uTextureLoc = uTextureLoc;
    this.uAlphaCutoffLoc = uAlphaCutoffLoc;

    gl.useProgram(this.program);
    gl.enableVertexAttribArray(this.aPositionLoc);
    gl.enableVertexAttribArray(this.aTexCoordLoc);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);

    this.rasterCanvas = document.createElement("canvas");
    this.rasterCanvas.width = this.tileSizePx;
    this.rasterCanvas.height = this.tileSizePx;
    const rasterCtx = this.rasterCanvas.getContext("2d");
    if (!rasterCtx) {
      throw new Error("Unable to initialize raster canvas.");
    }
    rasterCtx.lineWidth = LINE_WIDTH_PX;
    rasterCtx.strokeStyle = "#ffffff";
    rasterCtx.lineCap = "butt";
    rasterCtx.lineJoin = "miter";
    this.rasterCtx = rasterCtx;

    this.quadPositions = new Float32Array(12);
    this.quadTexCoords = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]);
  }

  dispose(): void {
    this.tileCache.clear();
    this.gl.deleteProgram(this.program);
    this.gl.deleteBuffer(this.positionBuffer);
    this.gl.deleteBuffer(this.texCoordBuffer);
  }

  draw(input: VideoMapRenderInput): void {
    const {
      scopeRect,
      center,
      radiusNm,
      panOffsetPxX,
      panOffsetPxY,
      brightnessPercent,
      activeMapIds,
      videoMapsById,
      canvasCssHeight,
      canvasPixelWidth,
      canvasPixelHeight,
      canvasDpr
    } = input;

    const gl = this.gl;
    gl.viewport(0, 0, canvasPixelWidth, canvasPixelHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!center || radiusNm === null || radiusNm <= 0 || activeMapIds.size === 0) {
      return;
    }

    const alpha = Math.max(0, Math.min(1, brightnessPercent / 100));
    if (alpha <= 0) {
      return;
    }

    this.ensureMapData(videoMapsById, activeMapIds, center);
    if (this.segments.length === 0) {
      return;
    }

    const pixelsPerNm = Math.min(scopeRect.width, scopeRect.height) / (2 * radiusNm);
    if (!Number.isFinite(pixelsPerNm) || pixelsPerNm <= 0) {
      return;
    }
    const pxPerMeter = pixelsPerNm / METERS_PER_NM;

    const basePxPerMeter = this.ensureBaseScale(pxPerMeter);
    const bucketScale = this.pickBucketScale(pxPerMeter / basePxPerMeter);
    const bucketPxPerMeter = basePxPerMeter * bucketScale;
    const tileWorldSize = this.tileSizePx / bucketPxPerMeter;

    const reference = this.lastReferenceKey ? this.parseReferenceKey(this.lastReferenceKey) : center;
    const centerWorld = latLonToMeters(center, reference);

    const panMetersX = -panOffsetPxX / pxPerMeter;
    const panMetersY = panOffsetPxY / pxPerMeter;
    const viewCenterX = centerWorld.x + panMetersX;
    const viewCenterY = centerWorld.y + panMetersY;

    const halfWidthMeters = scopeRect.width / (2 * pxPerMeter);
    const halfHeightMeters = scopeRect.height / (2 * pxPerMeter);
    let minX = viewCenterX - halfWidthMeters;
    let maxX = viewCenterX + halfWidthMeters;
    let minY = viewCenterY - halfHeightMeters;
    let maxY = viewCenterY + halfHeightMeters;

    if (this.bounds) {
      minX = Math.max(minX, this.bounds.minX);
      maxX = Math.min(maxX, this.bounds.maxX);
      minY = Math.max(minY, this.bounds.minY);
      maxY = Math.min(maxY, this.bounds.maxY);
    }

    if (minX > maxX || minY > maxY) {
      return;
    }

    const tileMinX = Math.floor(minX / tileWorldSize);
    const tileMaxX = Math.floor(maxX / tileWorldSize);
    const tileMinY = Math.floor(minY / tileWorldSize);
    const tileMaxY = Math.floor(maxY / tileWorldSize);

    const scissorX = Math.floor(scopeRect.x * canvasDpr);
    const scissorY = Math.floor((canvasCssHeight - (scopeRect.y + scopeRect.height)) * canvasDpr);
    const scissorWidth = Math.floor(scopeRect.width * canvasDpr);
    const scissorHeight = Math.floor(scopeRect.height * canvasDpr);

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(scissorX, scissorY, scissorWidth, scissorHeight);
    gl.useProgram(this.program);
    gl.uniform2f(this.uResolutionLoc, canvasPixelWidth, canvasPixelHeight);
    gl.uniform4f(this.uColorLoc, 1, 1, 1, alpha);
    gl.uniform1i(this.uTextureLoc, 0);
    gl.uniform1f(this.uAlphaCutoffLoc, Math.max(0, Math.min(0.95, MAP_LINE_ALPHA_CUTOFF)));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.quadTexCoords, gl.STATIC_DRAW);
    gl.vertexAttribPointer(this.aTexCoordLoc, 2, gl.FLOAT, false, 0, 0);

    for (let ty = tileMinY; ty <= tileMaxY; ty += 1) {
      for (let tx = tileMinX; tx <= tileMaxX; tx += 1) {
        const texture = this.getOrCreateTile(tx, ty, bucketScale, tileWorldSize);
        if (!texture) {
          continue;
        }
        const tileLeft = tx * tileWorldSize;
        const tileRight = tileLeft + tileWorldSize;
        const tileBottom = ty * tileWorldSize;
        const tileTop = tileBottom + tileWorldSize;

        const leftPx = Math.round(
          (scopeRect.x + scopeRect.width / 2 + (tileLeft - viewCenterX) * pxPerMeter) * canvasDpr
        );
        const rightPx = Math.round(
          (scopeRect.x + scopeRect.width / 2 + (tileRight - viewCenterX) * pxPerMeter) * canvasDpr
        );
        const topPx = Math.round(
          (scopeRect.y + scopeRect.height / 2 - (tileTop - viewCenterY) * pxPerMeter) * canvasDpr
        );
        const bottomPx = Math.round(
          (scopeRect.y + scopeRect.height / 2 - (tileBottom - viewCenterY) * pxPerMeter) * canvasDpr
        );

        const positions = this.quadPositions;
        positions[0] = leftPx;
        positions[1] = topPx;
        positions[2] = rightPx;
        positions[3] = topPx;
        positions[4] = leftPx;
        positions[5] = bottomPx;
        positions[6] = leftPx;
        positions[7] = bottomPx;
        positions[8] = rightPx;
        positions[9] = topPx;
        positions[10] = rightPx;
        positions[11] = bottomPx;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STREAM_DRAW);
        gl.vertexAttribPointer(this.aPositionLoc, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }

    gl.disable(gl.SCISSOR_TEST);
  }

  private ensureMapData(
    videoMapsById: Map<number, VideoMapLines>,
    activeMapIds: ReadonlySet<number>,
    reference: LatLon
  ): void {
    const mapSignature = this.buildMapSignature(activeMapIds);
    const referenceKey = `${reference.lat.toFixed(6)},${reference.lon.toFixed(6)}`;
    if (
      this.lastMapRef === videoMapsById &&
      this.lastMapSignature === mapSignature &&
      this.lastReferenceKey === referenceKey
    ) {
      return;
    }

    const activeLines: VideoMapLines = [];
    for (const mapId of activeMapIds) {
      const lines = videoMapsById.get(mapId);
      if (!lines || lines.length === 0) {
        continue;
      }
      for (const line of lines) {
        activeLines.push(line);
      }
    }

    const { segments, bounds } = buildSegments(activeLines, reference);
    this.segments = segments;
    this.bounds = bounds;
    this.lastMapRef = videoMapsById;
    this.lastMapSignature = mapSignature;
    this.lastReferenceKey = referenceKey;
    this.basePxPerMeter = null;
    this.tileCache.clear();
    this.emptyTiles.clear();
  }

  private buildMapSignature(activeMapIds: ReadonlySet<number>): string {
    if (activeMapIds.size === 0) {
      return "";
    }
    return Array.from(activeMapIds).sort((a, b) => a - b).join(",");
  }

  private ensureBaseScale(pxPerMeter: number): number {
    if (!this.basePxPerMeter || !Number.isFinite(this.basePxPerMeter)) {
      this.basePxPerMeter = pxPerMeter;
      return this.basePxPerMeter;
    }
    const ratio = pxPerMeter / this.basePxPerMeter;
    if (ratio < 0.125 || ratio > 8) {
      this.basePxPerMeter = pxPerMeter;
      this.tileCache.clear();
      this.emptyTiles.clear();
    }
    return this.basePxPerMeter;
  }

  private pickBucketScale(ratio: number): number {
    let best = this.bucketScales[0];
    let bestScore = Infinity;
    for (const scale of this.bucketScales) {
      const score = Math.abs(Math.log2(ratio / scale));
      if (score < bestScore) {
        bestScore = score;
        best = scale;
      }
    }
    return best;
  }

  private getOrCreateTile(
    tileX: number,
    tileY: number,
    bucketScale: number,
    tileWorldSize: number
  ): WebGLTexture | null {
    const key = `${bucketScale}:${tileX}:${tileY}`;
    if (this.emptyTiles.has(key)) {
      return null;
    }
    const cached = this.tileCache.get(key);
    if (cached) {
      return cached;
    }

    const tileBounds = {
      minX: tileX * tileWorldSize,
      maxX: (tileX + 1) * tileWorldSize,
      minY: tileY * tileWorldSize,
      maxY: (tileY + 1) * tileWorldSize
    };

    const hasContent = this.rasterizeTile(tileBounds, bucketScale);
    if (!hasContent) {
      this.emptyTiles.add(key);
      return null;
    }

    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) {
      return null;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.rasterCanvas
    );

    this.tileCache.set(key, texture);
    return texture;
  }

  private rasterizeTile(tile: Bounds, bucketScale: number): boolean {
    const ctx = this.rasterCtx;
    ctx.clearRect(0, 0, this.tileSizePx, this.tileSizePx);

    const pxPerMeter = (this.basePxPerMeter ?? 0) * bucketScale;
    if (!Number.isFinite(pxPerMeter) || pxPerMeter <= 0) {
      return false;
    }

    const tileTop = tile.maxY;
    const tileLeft = tile.minX;
    let drawn = false;

    ctx.beginPath();
    for (const segment of this.segments) {
      if (
        segment.maxX < tile.minX ||
        segment.minX > tile.maxX ||
        segment.maxY < tile.minY ||
        segment.minY > tile.maxY
      ) {
        continue;
      }

      const x1 = (segment.x1 - tileLeft) * pxPerMeter;
      const y1 = (tileTop - segment.y1) * pxPerMeter;
      const x2 = (segment.x2 - tileLeft) * pxPerMeter;
      const y2 = (tileTop - segment.y2) * pxPerMeter;

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      drawn = true;
    }
    if (!drawn) {
      return false;
    }
    ctx.stroke();
    return true;
  }

  private parseReferenceKey(key: string): LatLon {
    const [latStr, lonStr] = key.split(",");
    return {
      lat: Number(latStr),
      lon: Number(lonStr)
    };
  }
}
