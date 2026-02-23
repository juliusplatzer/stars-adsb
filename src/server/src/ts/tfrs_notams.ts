import { pathToFileURL } from "node:url";

const HOST = process.env.HOST?.trim() || "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const MAIN_ICAO = (process.env.MAIN_ICAO ?? "KJFK").trim().toUpperCase();
const TRACON = (process.env.TRACON ?? "").trim().toUpperCase();
const ARTCC = (process.env.ARTCC ?? "").trim().toUpperCase();

const TFRS_LIST_API_URL = (
  process.env.TFRS_LIST_API_URL ?? "https://tfr.faa.gov/tfrapi/exportTfrList"
).trim();
const TFRS_EXPORT_URL = (process.env.TFRS_EXPORT_URL ?? "https://tfr.faa.gov/tfr3/export/xml").trim();
const TFRS_DETAIL_URL_TEMPLATE = (
  process.env.TFRS_DETAIL_URL_TEMPLATE ??
  "https://tfr.faa.gov/download/detail_{id_underscore}.xml"
).trim();
const TFRS_POST_URL = (
  process.env.TFRS_POST_URL ??
  `http://${HOST}:${PORT}/api/tfrs`
).trim();
const TFRS_SOURCE_TIMEOUT_MS = parsePositiveIntEnv("TFRS_SOURCE_TIMEOUT_MS", 15_000);
const TFRS_INGEST_TOKEN = (process.env.TFRS_INGEST_TOKEN ?? "").trim();
const TFRS_WORKER_ENABLED = parseBooleanEnv("TFRS_WORKER_ENABLED", true);
const TFRS_MAX_DETAILS_PER_CYCLE = parsePositiveIntEnv("TFRS_MAX_DETAILS_PER_CYCLE", 250);
const TFRS_ID_FALLBACK_URLS_RAW = (process.env.TFRS_ID_FALLBACK_URLS ?? "").trim();
const TFRS_STATIC_IDS_RAW = (process.env.TFRS_STATIC_IDS ?? "").trim();
const TFRS_ID_DISCOVERY_MAX_FETCHES = parsePositiveIntEnv("TFRS_ID_DISCOVERY_MAX_FETCHES", 30);
const TFRS_ID_DISCOVERY_MAX_DEPTH = parsePositiveIntEnv("TFRS_ID_DISCOVERY_MAX_DEPTH", 2);
const TFRS_SPA_DISCOVERY_MAX_SCRIPTS = parsePositiveIntEnv("TFRS_SPA_DISCOVERY_MAX_SCRIPTS", 12);
const TFRS_SPA_DISCOVERY_MAX_ENDPOINTS = parsePositiveIntEnv("TFRS_SPA_DISCOVERY_MAX_ENDPOINTS", 30);
const DEFAULT_TFR_ID_FALLBACK_URLS: ReadonlyArray<string> = [
  "https://tfr.faa.gov/tfr2/list.html",
  "https://tfr.faa.gov/tfr2/list.xml",
  "https://tfr.faa.gov/tfr2/list.json"
];

interface TfrPoint {
  lat: number;
  lon: number;
}

interface TfrArea {
  areaId: string | null;
  points: TfrPoint[];
}

export interface TfrRecord {
  id: string;
  localName: string | null;
  facility: string | null;
  codeType: string | null;
  effective: string | null;
  expire: string | null;
  lowerFt: number | null;
  upperFt: number | null;
  sourceXmlUrl: string;
  areas: TfrArea[];
}

export interface TfrsIngestPayload {
  updatedAtMs: number;
  source: string;
  artcc: string;
  tracon: string;
  mainIcao: string;
  ids: string[];
  tfrs: TfrRecord[];
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function normalizeTfrId(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const match = trimmed.match(/(\d+)\s*[/_]\s*(\d+)/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return null;
}

function collectTfrIds(value: unknown, ids: Set<string>, contextKey = ""): void {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectTfrIds(value[i], ids, contextKey);
    }
    return;
  }

  if (typeof value === "string") {
    const context = contextKey.trim().toLowerCase();
    const detailMatches = value.match(/detail_(\d+)_(\d+)\.(?:xml|html)\b/gi);
    if (detailMatches) {
      for (let i = 0; i < detailMatches.length; i += 1) {
        const detailMatch = detailMatches[i].match(/detail_(\d+)_(\d+)/i);
        if (!detailMatch) {
          continue;
        }
        const normalized = normalizeTfrId(`${detailMatch[1]}/${detailMatch[2]}`);
        if (normalized) {
          ids.add(normalized);
        }
      }
    }

    const parseByContext =
      context === "notam_id" ||
      context === "notamid" ||
      context === "tfrid" ||
      context === "id" ||
      context === "notamdetail" ||
      context === "detail";
    if (parseByContext) {
      const normalizedDirect = normalizeTfrId(value);
      if (normalizedDirect) {
        ids.add(normalizedDirect);
      } else {
        const matches = value.match(/\b\d+[/_]\d+\b/g);
        if (matches) {
          for (let i = 0; i < matches.length; i += 1) {
            const normalized = normalizeTfrId(matches[i]);
            if (normalized) {
              ids.add(normalized);
            }
          }
        }
      }
    }
    return;
  }

  const object = asObject(value);
  if (!object) {
    return;
  }

  for (const [key, child] of Object.entries(object)) {
    const keyNorm = key.trim().toLowerCase();
    if (keyNorm === "notam_id" || keyNorm === "notamid" || keyNorm === "tfrid" || keyNorm === "id") {
      const normalized = normalizeTfrId(String(child));
      if (normalized) {
        ids.add(normalized);
      }
    }
    collectTfrIds(child, ids, keyNorm);
  }
}

function parseFallbackUrlList(raw: string): string[] {
  if (raw.trim().length === 0) {
    return [];
  }
  const parts = raw
    .split(/[\s,;]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < parts.length; i += 1) {
    const token = parts[i];
    if (!token.startsWith("http://") && !token.startsWith("https://")) {
      continue;
    }
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    deduped.push(token);
  }
  return deduped;
}

function parseStaticTfrIds(raw: string): string[] {
  if (raw.trim().length === 0) {
    return [];
  }
  const parts = raw
    .split(/[\s,;]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < parts.length; i += 1) {
    const normalized = normalizeTfrId(parts[i]);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ids.push(normalized);
  }
  return ids;
}

function resolveHttpUrl(raw: string, baseUrl: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.startsWith("data:") || trimmed.startsWith("javascript:") || trimmed.startsWith("mailto:")) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function collectReferencedUrlsFromText(text: string, baseUrl: string): string[] {
  const found = new Set<string>();
  const htmlAttrRegex = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let htmlAttrMatch = htmlAttrRegex.exec(text);
  while (htmlAttrMatch) {
    const resolved = resolveHttpUrl(htmlAttrMatch[1], baseUrl);
    if (resolved) {
      found.add(resolved);
    }
    htmlAttrMatch = htmlAttrRegex.exec(text);
  }

  const quotedUrlRegex = /["'`](https?:\/\/[^"'`\s]+|\/[^"'`\s]+)["'`]/gi;
  let quotedMatch = quotedUrlRegex.exec(text);
  while (quotedMatch) {
    const resolved = resolveHttpUrl(quotedMatch[1], baseUrl);
    if (resolved) {
      found.add(resolved);
    }
    quotedMatch = quotedUrlRegex.exec(text);
  }

  return Array.from(found);
}

function looksRelevantDiscoveryUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("tfr") ||
    lower.includes("notam") ||
    lower.includes("export") ||
    lower.includes("list") ||
    lower.includes("json") ||
    lower.includes("xml") ||
    lower.includes("download") ||
    lower.endsWith(".js")
  );
}

function chooseAcceptHeaderForUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes(".xml")) {
    return "application/xml,text/xml,text/plain,*/*";
  }
  if (lower.includes(".json") || lower.includes("json")) {
    return "application/json,text/plain,*/*";
  }
  if (lower.endsWith(".js") || lower.includes(".js?")) {
    return "application/javascript,text/javascript,text/plain,*/*";
  }
  return "text/html,text/plain,*/*";
}

function extractTfrIdsFromText(text: string): string[] {
  const ids = new Set<string>();

  const notamContextRegex =
    /\b(?:NOTAMID|NOTAM_ID|TFRID|notamId|notam_id|tfrId)\b[^0-9]{0,24}(\d+\s*[/_]\s*\d+)/gi;
  let notamMatch = notamContextRegex.exec(text);
  while (notamMatch) {
    const normalized = normalizeTfrId(notamMatch[1]);
    if (normalized) {
      ids.add(normalized);
    }
    notamMatch = notamContextRegex.exec(text);
  }

  const detailRegex = /detail_(\d+)_(\d+)\.(?:xml|html)\b/gi;
  for (const match of text.matchAll(detailRegex)) {
    const normalized = normalizeTfrId(`${match[1]}/${match[2]}`);
    if (normalized) {
      ids.add(normalized);
    }
  }

  return Array.from(ids);
}

function buildDetailUrl(tfrId: string): string {
  const idUnderscore = tfrId.replace("/", "_");
  return TFRS_DETAIL_URL_TEMPLATE.replace("{id_underscore}", idUnderscore);
}

function parseXmlTagFirst(xml: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(pattern);
  if (!match) {
    return null;
  }
  const text = decodeXmlEntities(match[1].trim());
  return text.length > 0 ? text : null;
}

function parseXmlBlocks(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  const out: string[] = [];
  let match = pattern.exec(xml);
  while (match) {
    out.push(match[0]);
    match = pattern.exec(xml);
  }
  return out;
}

function extractTfrIdsFromXmlList(xml: string): string[] {
  const ids = new Set<string>();

  const notamIdTagRegex = /<\s*NOTAMID\s*>([^<]+)<\s*\/\s*NOTAMID\s*>/gi;
  let tagMatch = notamIdTagRegex.exec(xml);
  while (tagMatch) {
    const normalized = normalizeTfrId(tagMatch[1]);
    if (normalized) {
      ids.add(normalized);
    }
    tagMatch = notamIdTagRegex.exec(xml);
  }

  const detailRegex = /detail_(\d+)_(\d+)\.(?:xml|html)\b/gi;
  let detailMatch = detailRegex.exec(xml);
  while (detailMatch) {
    const normalized = normalizeTfrId(`${detailMatch[1]}/${detailMatch[2]}`);
    if (normalized) {
      ids.add(normalized);
    }
    detailMatch = detailRegex.exec(xml);
  }

  return Array.from(ids);
}

function decodeBase64XmlPayload(payload: string): string | null {
  if (payload.trim().length === 0) {
    return null;
  }

  try {
    const normalized = payload.replace(/\s+/g, "");
    const buffer = Buffer.from(normalized, "base64");
    if (buffer.length === 0) {
      return null;
    }

    const utf8 = buffer.toString("utf8");
    if (utf8.includes("<TFRList") || utf8.includes("<NOTAMID")) {
      return utf8;
    }

    const utf16le = buffer.toString("utf16le");
    if (utf16le.includes("<TFRList") || utf16le.includes("<NOTAMID")) {
      return utf16le;
    }

    return utf8;
  } catch {
    return null;
  }
}

function extractEmbeddedXmlCandidates(body: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const pushCandidate = (value: string): void => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  const decodedBody = decodeXmlEntities(body);
  if (decodedBody !== body && (decodedBody.includes("<TFRList") || decodedBody.includes("<NOTAMID"))) {
    pushCandidate(decodedBody);
  }

  const preRegex = /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi;
  let preMatch = preRegex.exec(body);
  while (preMatch) {
    const preDecoded = decodeXmlEntities(preMatch[1]);
    if (preDecoded.includes("<TFRList") || preDecoded.includes("<NOTAMID")) {
      pushCandidate(preDecoded);
    }
    preMatch = preRegex.exec(body);
  }

  const dataUriRegex = /data:application\/octet-stream[^,]*,([A-Za-z0-9+/_=%-]+)/gi;
  let dataUriMatch = dataUriRegex.exec(body);
  while (dataUriMatch) {
    let encodedPayload = dataUriMatch[1];
    try {
      encodedPayload = decodeURIComponent(encodedPayload);
    } catch {
      // ignore decode errors and use the raw payload
    }
    const decoded = decodeBase64XmlPayload(encodedPayload);
    if (decoded && (decoded.includes("<TFRList") || decoded.includes("<NOTAMID"))) {
      pushCandidate(decoded);
    }
    dataUriMatch = dataUriRegex.exec(body);
  }

  return candidates;
}

function extractTfrIdsFromBodyPayload(body: string): string[] {
  const ids = new Set<string>();
  const bodyCandidates = [body, ...extractEmbeddedXmlCandidates(body)];
  for (let candidateIndex = 0; candidateIndex < bodyCandidates.length; candidateIndex += 1) {
    const candidate = bodyCandidates[candidateIndex];
    const xmlIds = extractTfrIdsFromXmlList(candidate);
    for (let i = 0; i < xmlIds.length; i += 1) {
      ids.add(xmlIds[i]);
    }
    const textIds = extractTfrIdsFromText(candidate);
    for (let i = 0; i < textIds.length; i += 1) {
      ids.add(textIds[i]);
    }
  }
  return Array.from(ids);
}

function looksLikeTfrSpaShell(body: string): boolean {
  const lower = body.toLowerCase();
  return (
    lower.includes("federal aviation administration - graphic tfrs") &&
    (lower.includes("id=\"__nuxt\"") || lower.includes("window.__nuxt__"))
  );
}

function extractScriptUrlsFromHtml(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  const scriptRegex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let scriptMatch = scriptRegex.exec(html);
  while (scriptMatch) {
    const resolved = resolveHttpUrl(scriptMatch[1], baseUrl);
    if (resolved) {
      urls.add(resolved);
    }
    scriptMatch = scriptRegex.exec(html);
  }
  return Array.from(urls);
}

function normalizePossibleJsUrlToken(token: string): string {
  return token
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}

function extractEndpointCandidatesFromJavaScript(js: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  const quotedRegex = /["'`]([^"'`\r\n]{1,300})["'`]/g;
  let quotedMatch = quotedRegex.exec(js);
  while (quotedMatch) {
    const rawToken = normalizePossibleJsUrlToken(quotedMatch[1]);
    const lower = rawToken.toLowerCase();
    const looksRelevant =
      lower.includes("tfr") ||
      lower.includes("notam") ||
      lower.includes("export") ||
      lower.includes("list") ||
      lower.includes("detail_");
    if (!looksRelevant) {
      quotedMatch = quotedRegex.exec(js);
      continue;
    }

    const resolved = resolveHttpUrl(rawToken, baseUrl);
    if (resolved && looksRelevantDiscoveryUrl(resolved)) {
      urls.add(resolved);
    }
    quotedMatch = quotedRegex.exec(js);
  }
  return Array.from(urls);
}

function parseGeoCoordinateToken(raw: string): number | null {
  const trimmed = raw.trim().toUpperCase();
  const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)([NSEW])$/);
  if (!match) {
    return null;
  }
  const magnitude = Number.parseFloat(match[1]);
  if (!Number.isFinite(magnitude)) {
    return null;
  }
  const hemisphere = match[2];
  const signed = hemisphere === "S" || hemisphere === "W" ? -magnitude : magnitude;
  const limit = hemisphere === "N" || hemisphere === "S" ? 90 : 180;
  return Math.abs(signed) <= limit ? signed : null;
}

function parseAreaPoints(areaXml: string): TfrPoint[] {
  const points: TfrPoint[] = [];
  const avxBlocks = parseXmlBlocks(areaXml, "Avx");
  for (let i = 0; i < avxBlocks.length; i += 1) {
    const latRaw = parseXmlTagFirst(avxBlocks[i], "geoLat");
    const lonRaw = parseXmlTagFirst(avxBlocks[i], "geoLong");
    if (!latRaw || !lonRaw) {
      continue;
    }
    const lat = parseGeoCoordinateToken(latRaw);
    const lon = parseGeoCoordinateToken(lonRaw);
    if (lat === null || lon === null) {
      continue;
    }
    points.push({ lat, lon });
  }
  return points;
}

function parseAltitudeFeet(xml: string, tag: string): number | null {
  const raw = parseXmlTagFirst(xml, tag);
  if (!raw) {
    return null;
  }
  const parsed = asFiniteNumber(raw);
  if (parsed === null) {
    return null;
  }
  return Math.round(parsed);
}

function parseTfrDetailXml(xml: string, tfrId: string, sourceXmlUrl: string): TfrRecord | null {
  const localName = parseXmlTagFirst(xml, "txtLocalName");
  const facility = parseXmlTagFirst(xml, "codeFacility")?.toUpperCase() ?? null;
  const codeType = parseXmlTagFirst(xml, "codeType");
  const effective = parseXmlTagFirst(xml, "dateEffective");
  const expire = parseXmlTagFirst(xml, "dateExpire");
  const lowerFt = parseAltitudeFeet(xml, "valDistVerLower");
  const upperFt = parseAltitudeFeet(xml, "valDistVerUpper");

  const mergedAreaBlocks = parseXmlBlocks(xml, "abdMergedArea");
  const areas: TfrArea[] = [];
  for (let i = 0; i < mergedAreaBlocks.length; i += 1) {
    const points = parseAreaPoints(mergedAreaBlocks[i]);
    if (points.length < 3) {
      continue;
    }
    const areaId = parseXmlTagFirst(mergedAreaBlocks[i], "txtRmk");
    areas.push({
      areaId,
      points
    });
  }

  // Fallback: some TFR XMLs may have Avx points outside abdMergedArea.
  if (areas.length === 0) {
    const fallbackPoints = parseAreaPoints(xml);
    if (fallbackPoints.length >= 3) {
      areas.push({
        areaId: null,
        points: fallbackPoints
      });
    }
  }

  if (areas.length === 0) {
    return null;
  }

  return {
    id: tfrId,
    localName,
    facility,
    codeType,
    effective,
    expire,
    lowerFt,
    upperFt,
    sourceXmlUrl,
    areas
  };
}

function isCurrentlyActive(record: TfrRecord, nowMs: number): boolean {
  const effectiveMs = record.effective ? Date.parse(record.effective) : NaN;
  const expireMs = record.expire ? Date.parse(record.expire) : NaN;

  if (Number.isFinite(effectiveMs) && nowMs < effectiveMs) {
    return false;
  }
  if (Number.isFinite(expireMs) && nowMs >= expireMs) {
    return false;
  }
  return true;
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json,text/plain,*/*",
        "user-agent": "stars-adsb-tfr-worker/1.0",
        referer: "https://tfr.faa.gov/"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const bodyText = await response.text();
    const trimmed = bodyText.trim();
    const looksJsonByType = contentType.includes("application/json") || contentType.includes("+json");
    const looksJsonByBody = trimmed.startsWith("{") || trimmed.startsWith("[");

    if (looksJsonByType || looksJsonByBody) {
      try {
        return JSON.parse(bodyText) as unknown;
      } catch (jsonError) {
        const message = jsonError instanceof Error ? jsonError.message : String(jsonError);
        throw new Error(`Invalid JSON payload (${message})`);
      }
    }

    throw new Error(
      `Unexpected non-JSON export payload (content-type="${contentType || "unknown"}").`
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string, timeoutMs: number, acceptHeader = "application/xml,text/xml,*/*"): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: acceptHeader,
        "user-agent": "stars-adsb-tfr-worker/1.0",
        referer: "https://tfr.faa.gov/"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTfrIds(): Promise<string[]> {
  let listApiError: unknown = null;
  try {
    const payload = await fetchJson(TFRS_LIST_API_URL, TFRS_SOURCE_TIMEOUT_MS);
    const listIds = new Set<string>();
    collectTfrIds(payload, listIds);
    if (listIds.size > 0) {
      return Array.from(listIds);
    }
    listApiError = new Error(`List API returned no NOTAM IDs (${TFRS_LIST_API_URL}).`);
  } catch (error) {
    listApiError = error;
  }

  const rawCandidates = [
    TFRS_EXPORT_URL,
    "https://tfr.faa.gov/tfr3/export/xml",
    ...parseFallbackUrlList(TFRS_ID_FALLBACK_URLS_RAW),
    ...DEFAULT_TFR_ID_FALLBACK_URLS
  ];
  const xmlSourceCandidates = Array.from(new Set<string>(rawCandidates)).filter(
    (url) => url.trim().length > 0
  );

  let xmlError: unknown = null;
  for (let i = 0; i < xmlSourceCandidates.length; i += 1) {
    const xmlUrl = xmlSourceCandidates[i];
    try {
      const body = await fetchText(
        xmlUrl,
        TFRS_SOURCE_TIMEOUT_MS,
        "application/xml,text/xml,text/html,text/plain,*/*"
      );
      const directIds = extractTfrIdsFromBodyPayload(body);
      if (directIds.length > 0) {
        if (xmlUrl !== TFRS_EXPORT_URL) {
          console.warn(`Primary TFR export URL failed; using XML source ${xmlUrl}.`);
        }
        return directIds;
      }

      const preview = body.replace(/\s+/g, " ").trim().slice(0, 160);
      xmlError = new Error(`No NOTAM IDs at ${xmlUrl}. Preview: "${preview || "n/a"}"`);
    } catch (error) {
      xmlError = error;
    }
  }

  const staticIds = parseStaticTfrIds(TFRS_STATIC_IDS_RAW);
  if (staticIds.length > 0) {
    console.warn(
      `TFR XML export failed; using ${staticIds.length} static TFR ID(s) from TFRS_STATIC_IDS.`
    );
    return staticIds;
  }

  const listMessage = listApiError instanceof Error ? listApiError.message : String(listApiError);
  const xmlMessage = xmlError instanceof Error ? xmlError.message : String(xmlError);
  throw new Error(
    `Failed to fetch/parse TFR IDs (list API: ${listMessage}; XML fallback: ${xmlMessage}).`
  );
}

async function postTfrPayload(payload: TfrsIngestPayload): Promise<void> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (TFRS_INGEST_TOKEN.length > 0) {
    headers["x-tfrs-token"] = TFRS_INGEST_TOKEN;
  }

  const response = await fetch(TFRS_POST_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TFR POST failed HTTP ${response.status}: ${body}`);
  }
}

let tfrRefreshInFlight = false;

async function refreshAndPostTfrs(): Promise<void> {
  if (tfrRefreshInFlight) {
    return;
  }
  tfrRefreshInFlight = true;

  try {
    const listedIds = await fetchTfrIds();
    const idsToProcess = listedIds.slice(0, TFRS_MAX_DETAILS_PER_CYCLE);
    const nowMs = Date.now();
    const tfrs: TfrRecord[] = [];
    for (let i = 0; i < idsToProcess.length; i += 1) {
      const tfrId = idsToProcess[i];
      const detailUrl = buildDetailUrl(tfrId);
      try {
        const xml = await fetchText(detailUrl, TFRS_SOURCE_TIMEOUT_MS);
        const parsed = parseTfrDetailXml(xml, tfrId, detailUrl);
        if (!parsed) {
          continue;
        }
        if (ARTCC.length > 0 && parsed.facility !== ARTCC) {
          continue;
        }
        if (!isCurrentlyActive(parsed, nowMs)) {
          continue;
        }
        tfrs.push(parsed);
      } catch (detailError) {
        console.warn(`Failed to fetch/parse TFR ${tfrId}:`, detailError);
      }
    }

    const payload: TfrsIngestPayload = {
      updatedAtMs: nowMs,
      source: TFRS_LIST_API_URL,
      artcc: ARTCC,
      tracon: TRACON,
      mainIcao: MAIN_ICAO,
      ids: tfrs.map((tfr) => tfr.id),
      tfrs
    };

    await postTfrPayload(payload);
    console.info(
      `TFR refresh complete: ${tfrs.length} active TFR(s) for ARTCC=${ARTCC || "ALL"}`
    );
  } catch (error) {
    console.error("Failed to refresh/post TFRs:", error);
  } finally {
    tfrRefreshInFlight = false;
  }
}

export function startTfrNotamsWorker(): void {
  if (!TFRS_WORKER_ENABLED) {
    console.info("TFR worker disabled (TFRS_WORKER_ENABLED=false).");
    return;
  }

  // Fetch once on startup and rely on the server-side in-memory cache afterward.
  void refreshAndPostTfrs();
}

function isEntryPoint(): boolean {
  const entryPath = process.argv[1];
  if (!entryPath) {
    return false;
  }
  return pathToFileURL(entryPath).href === import.meta.url;
}

if (isEntryPoint()) {
  console.info(
    `TFR worker starting. ListAPI=${TFRS_LIST_API_URL} XMLFallback=${TFRS_EXPORT_URL} ` +
      `ARTCC=${ARTCC || "ALL"} TRACON=${TRACON || "n/a"}`
  );
  console.info(`TFR POST target=${TFRS_POST_URL}`);
  startTfrNotamsWorker();
}
