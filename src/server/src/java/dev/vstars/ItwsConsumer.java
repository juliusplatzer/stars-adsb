package dev.vstars;

import com.solacesystems.jms.SolConnectionFactory;
import com.solacesystems.jms.SolJmsUtility;

import javax.jms.*;
import javax.jms.Queue;
import javax.xml.stream.*;
import java.io.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

/**
 * ITWS Precipitation TRACON (productID=9850) -> POST http://localhost:8080/api/wx/radar
 *
 * Payload format:
 * {
 *   "updatedAtMs": ...,
 *   "source": "SWIM_ITWS",
 *   "levels": [1,3,4],                 // active levels in newest frame only
 *   "frames": [
 *     { "receiverMs":..., "itwsGenTimeMs":..., "grid":{...}, "cellsRle":"lvl,cnt ...", ... },
 *     { ... }, { ... }, { ... }
 *   ]
 * }
 *
 * Frames cache: last 4 frames (newest first + 3 history).
 *
 * Cells are mapped RLE (levels 0..6). Special/no-data => 0.
 * Geometry needed for plotting is included per frame.
 *
 * Reliability: ACK only after POST returns 2xx.
 */
public final class ItwsConsumer {

    private static final int TARGET_PRODUCT_ID = 9850;
    private static final int CACHE_N = 4;

    public static void main(String[] args) throws Exception {
        Config cfg = Config.fromEnv();

        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(cfg.httpConnectTimeoutMs))
                .build();

        SolConnectionFactory cf = SolJmsUtility.createConnectionFactory();
        cf.setHost(normalizeJmsHostList(cfg.jmsUrl));
        cf.setVPN(cfg.vpn);
        cf.setUsername(cfg.username);
        cf.setPassword(cfg.password);
        cf.setConnectRetries(5);
        cf.setConnectRetriesPerHost(3);

        FrameCache cache = new FrameCache(CACHE_N);

        Connection conn = null;
        Session session = null;
        MessageConsumer consumer = null;
        try {
            conn = cf.createConnection();
            session = conn.createSession(false, Session.CLIENT_ACKNOWLEDGE);

            Queue queue = session.createQueue(cfg.queueName);
            consumer = session.createConsumer(queue);

            conn.start();
            System.out.println("Connected. Consuming queue: " + cfg.queueName);
            System.out.println("Posting to: " + cfg.postUrl);

            XMLInputFactory xif = XMLInputFactory.newFactory();
            trySet(xif, XMLInputFactory.SUPPORT_DTD, false);
            trySet(xif, "javax.xml.stream.isSupportingExternalEntities", false);

            long empty = 0;
            long lastBeat = System.currentTimeMillis();

            while (true) {
                Message msg = consumer.receive(cfg.receiveTimeoutMs);
                if (msg == null) {
                    empty++;
                    long now = System.currentTimeMillis();
                    if (now - lastBeat >= cfg.heartbeatMs) {
                        System.out.println("Waiting… (" + empty + " empty polls)");
                        lastBeat = now;
                    }
                    continue;
                }

                boolean acked = false;
                try {
                    // Cheap gate: skip non-9850 quickly
                    if (msg.propertyExists("productID")) {
                        int pid = toInt(msg.getObjectProperty("productID"), -1);
                        if (pid != TARGET_PRODUCT_ID) {
                            msg.acknowledge();
                            acked = true;
                            continue;
                        }
                    }

                    // Receiver timestamp for this frame
                    long receiverMs = System.currentTimeMillis();

                    Frame f = parse9850(msg, xif, cfg.maxXmlBytes, receiverMs);
                    if (f == null || f.productId != TARGET_PRODUCT_ID || f.cellsRle == null) {
                        msg.acknowledge();
                        acked = true;
                        continue;
                    }

                    // Add to cache (newest first)
                    cache.push(f);

                    // Build payload using cached frames
                    byte[] json = buildPayloadJsonBytes(cache);

                    if (cfg.printJson) {
                        System.out.write(json);
                        System.out.write('\n');
                        System.out.flush();
                    }

                    postWithRetry(http, cfg.postUrl, cfg.ingestToken, json,
                            cfg.httpRequestTimeoutMs, cfg.retrySleepMs);

                    System.out.println("POST OK " + Instant.now()
                            + " frames=" + cache.size()
                            + " newestNonZero=" + f.nonZeroCells
                            + " newestMaxLvl=" + f.maxLevel
                            + " newestCells=" + f.cellsTotal
                            + " newestPlot=" + f.plotCols + "x" + f.plotRows
                            + " dimsSrc=" + f.dimsSource
                    );

                    msg.acknowledge();
                    acked = true;

                } catch (Exception e) {
                    System.err.println("Error: " + e.getMessage());
                    // No ACK on exception => redelivery (reliability)
                } finally {
                    if (!acked && cfg.ackOnException) {
                        try { msg.acknowledge(); } catch (Exception ignored) {}
                    }
                }
            }
        } finally {
            if (consumer != null) {
                try { consumer.close(); } catch (JMSException ignored) {}
            }
            if (session != null) {
                try { session.close(); } catch (JMSException ignored) {}
            }
            if (conn != null) {
                try { conn.close(); } catch (JMSException ignored) {}
            }
        }
    }

    // ---------------- Cache (newest first) ----------------

    private static final class FrameCache {
        private final Frame[] buf;
        private int size = 0;    // <= buf.length

        FrameCache(int n) { this.buf = new Frame[n]; }

        void push(Frame f) {
            // shift right by 1 (n is tiny = 4)
            for (int i = Math.min(size, buf.length - 1); i >= 1; i--) {
                buf[i] = buf[i - 1];
            }
            buf[0] = f;
            if (size < buf.length) size++;
        }

        int size() { return size; }

        Frame get(int idx) { return buf[idx]; }
    }

    // ---------------- Parse 9850 (streaming) ----------------

    private static Frame parse9850(Message msg, XMLInputFactory xif, int maxBytes, long receiverMs) throws Exception {
        InputStream in = extractXmlStream(msg, maxBytes);
        if (in == null) return null;

        XMLStreamReader r = xif.createXMLStreamReader(in);

        Frame f = new Frame();
        f.receiverMs = receiverMs;
        f.receivedAt = Instant.ofEpochMilli(receiverMs).toString();

        String current = null;
        StringBuilder small = null;

        MappedRleBuilder rle = null;

        while (r.hasNext()) {
            int ev = r.next();

            if (ev == XMLStreamConstants.START_ELEMENT) {
                current = r.getLocalName();
                if ("prcp_grid_compressed".equals(current)) {
                    small = null;
                    if (rle == null) rle = new MappedRleBuilder();
                    rle.setSpecials(f.badValue, f.noCoverage, f.attenuated, f.apDetected);
                } else {
                    small = new StringBuilder(64);
                }

            } else if (ev == XMLStreamConstants.CHARACTERS || ev == XMLStreamConstants.CDATA) {
                if ("prcp_grid_compressed".equals(current)) {
                    if (rle != null) rle.feed(r.getText());
                } else if (small != null) {
                    if (small.length() < 1024) small.append(r.getText());
                }

            } else if (ev == XMLStreamConstants.END_ELEMENT) {
                String end = r.getLocalName();

                if ("prcp_grid_compressed".equals(end)) {
                    if (rle != null) rle.finish();
                    current = null;
                    small = null;
                    continue;
                }

                if (small != null && current != null && current.equals(end)) {
                    String v = small.toString().trim();
                    applyField(f, end, v);
                    if (rle != null) rle.setSpecials(f.badValue, f.noCoverage, f.attenuated, f.apDetected);
                }

                current = null;
                small = null;
            }
        }

        if (rle == null) return null;

        f.cellsRle = rle.outString();
        f.cellsTotal = rle.totalCells();
        f.maxLevel = rle.maxLevel();
        f.nonZeroCells = rle.nonZeroCells();
        f.activeMask = rle.activeMask();

        f.noCoverageCells = rle.noCoverageCells();
        f.badCells = rle.badCells();
        f.apCells = rle.apCells();
        f.attenCells = rle.attenCells();

        // must be our product
        if (f.productId != TARGET_PRODUCT_ID) return null;

        // choose plotting dims robustly
        finalizePlotDims(f);

        if (f.plotRows <= 0 || f.plotCols <= 0) {
            System.err.println("WARN: cannot determine plot dims (cellsTotal=" + f.cellsTotal
                    + " nrows=" + f.rows + " ncols=" + f.cols
                    + " gridMaxY=" + f.gridMaxY + " gridMaxX=" + f.gridMaxX + ")");
            return null;
        }

        long expected = (long) f.plotRows * (long) f.plotCols;
        if (f.cellsTotal > 0 && expected > 0 && f.cellsTotal != expected) {
            System.err.println("WARN: cellsTotal=" + f.cellsTotal
                    + " but plotRows*plotCols=" + expected
                    + " (dimsSource=" + f.dimsSource
                    + ", nrows*ncols=" + ((long)f.rows * (long)f.cols)
                    + ", gridMaxY*gridMaxX=" + ((long)f.gridMaxY * (long)f.gridMaxX)
                    + ")");
        }

        return f;
    }

    /**
     * Decide the authoritative dimensions to reshape row-major cells.
     * Priority:
     *  1) gridMaxX/gridMaxY if present AND matches cellsTotal (or cellsTotal==0)
     *  2) ncols/nrows if matches
     *  3) infer square if cellsTotal is perfect square
     *  4) best-effort fallback with a warning downstream
     */
    private static void finalizePlotDims(Frame f) {
        long cells = f.cellsTotal;

        int gx = f.gridMaxX;
        int gy = f.gridMaxY;
        int nr = f.rows;
        int nc = f.cols;

        // helper: matches cells count (if known)
        // (cellsTotal should be known for real frames; but keep robust)
        if (gx > 0 && gy > 0) {
            long e = (long) gx * (long) gy;
            if (cells == 0 || cells == e) {
                f.plotCols = gx;
                f.plotRows = gy;
                f.dimsSource = "gridMax";
                return;
            }
        }

        if (nc > 0 && nr > 0) {
            long e = (long) nc * (long) nr;
            if (cells == 0 || cells == e) {
                f.plotCols = nc;
                f.plotRows = nr;
                f.dimsSource = "nrows_ncols";
                return;
            }
        }

        if (cells > 0) {
            int s = (int) Math.round(Math.sqrt((double) cells));
            if ((long) s * (long) s == cells) {
                f.plotCols = s;
                f.plotRows = s;
                f.dimsSource = "inferredSquare";
                return;
            }
        }

        // fallback preference: still prefer gridMax if present, else nrows/ncols
        if (gx > 0 && gy > 0) {
            f.plotCols = gx;
            f.plotRows = gy;
            f.dimsSource = "gridMax_mismatch";
        } else {
            f.plotCols = nc;
            f.plotRows = nr;
            f.dimsSource = "nrows_ncols_mismatch";
        }
    }

    private static void applyField(Frame f, String tag, String v) {
        switch (tag) {
            // identity
            case "product_msg_id" -> f.productId = parseInt(v, -1);
            case "product_msg_name" -> f.productName = v;
            case "product_header_itws_sites" -> f.site = v;
            case "product_header_airports" -> f.airport = v;

            // ITWS times (recommended)
            case "product_header_generation_time_seconds" -> f.genSec = parseLong(v, 0);
            case "product_header_generation_time_milliseconds" -> f.genMs = parseInt(v, 0);
            case "product_header_expiration_time_seconds" -> f.expSec = parseLong(v, 0);
            case "product_header_expiration_time_milliseconds" -> f.expMs = parseInt(v, 0);

            // geometry/grid
            case "prcp_TRP_latitude" -> f.trpLatMicroDeg = parseInt(v, 0);
            case "prcp_TRP_longitude" -> f.trpLonMicroDeg = parseInt(v, 0);

            case "prcp_xoffset" -> f.xOffsetM = parseInt(v, 0);
            case "prcp_yoffset" -> f.yOffsetM = parseInt(v, 0);

            case "prcp_dx" -> f.dxM = parseInt(v, 0);
            case "prcp_dy" -> f.dyM = parseInt(v, 0);

            case "prcp_rotation" -> f.rotationMilliDeg = parseInt(v, 0);

            case "prcp_nrows" -> f.rows = parseInt(v, -1);
            case "prcp_ncols" -> f.cols = parseInt(v, -1);

            // IMPORTANT: authoritative grid bounds (often match the compressed cells)
            case "prcp_grid_max_x" -> f.gridMaxX = parseInt(v, -1);
            case "prcp_grid_max_y" -> f.gridMaxY = parseInt(v, -1);

            // special codes
            case "prcp_attenuated" -> f.attenuated = parseInt(v, 7);
            case "prcp_ap_detected" -> f.apDetected = parseInt(v, 8);
            case "prcp_bad_value" -> f.badValue = parseInt(v, 9);
            case "prcp_no_coverage" -> f.noCoverage = parseInt(v, 15);

            // misc
            case "prcp_grid_compression_encoding_scheme" -> f.compression = v;
            case "prcp_grid_max_precip_level" -> f.maxPrecipLevel = parseInt(v, -1);

            default -> { /* ignore */ }
        }

        if (f.genSec > 0) f.itwsGenTimeMs = f.genSec * 1000L + Math.max(0, f.genMs);
        if (f.expSec > 0) f.itwsExpTimeMs = f.expSec * 1000L + Math.max(0, f.expMs);
    }

    // ---------------- RLE: ITWS "val,cnt" -> mapped "lvl,cnt" ----------------

    private static final class MappedRleBuilder {
        private final StringBuilder out = new StringBuilder(1 << 16);

        private int bad = 9, noCov = 15, atten = 7, ap = 8;

        private long totalCells = 0;
        private int maxLevel = 0;
        private long nonZero = 0;

        private long noCovCells = 0, badCells = 0, apCells = 0, attenCells = 0;

        // which mapped levels (1..6) occur in this frame
        private int activeMask = 0; // bit i means level i active

        // parser state
        private int curVal = 0;
        private int curCnt = 0;
        private boolean neg = false;
        private boolean inVal = false;
        private boolean inCnt = false;
        private boolean sawDigit = false;

        // merge state
        private int lastLevel = -1;
        private int lastCount = 0;

        void setSpecials(int bad, int noCov, int atten, int ap) {
            this.bad = bad;
            this.noCov = noCov;
            this.atten = atten;
            this.ap = ap;
        }

        void feed(String chunk) {
            if (chunk == null || chunk.isEmpty()) return;
            final int n = chunk.length();

            for (int i = 0; i < n; i++) {
                char c = chunk.charAt(i);

                if (!inVal && !inCnt) {
                    if (isWs(c)) continue;
                    inVal = true;
                    neg = false;
                    curVal = 0;
                    curCnt = 0;
                    sawDigit = false;
                    if (c == '-') { neg = true; continue; }
                    if (isDigit(c)) { sawDigit = true; curVal = c - '0'; continue; }
                    inVal = false;
                    continue;
                }

                if (inVal) {
                    if (isDigit(c)) {
                        sawDigit = true;
                        curVal = curVal * 10 + (c - '0');
                        continue;
                    }
                    if (c == ',' && sawDigit) {
                        if (neg) curVal = -curVal;
                        inVal = false;
                        inCnt = true;
                        curCnt = 0;
                        sawDigit = false;
                        continue;
                    }
                    inVal = false;
                    continue;
                }

                if (inCnt) {
                    if (isDigit(c)) {
                        sawDigit = true;
                        curCnt = curCnt * 10 + (c - '0');
                        continue;
                    }
                    if (isWs(c) && sawDigit) {
                        emitRun(curVal, curCnt);
                        inCnt = false;
                        continue;
                    }
                }
            }
        }

        void finish() {
            if (inCnt && sawDigit) emitRun(curVal, curCnt);
            flushLast();
            inVal = false; inCnt = false; sawDigit = false;
        }

        private void emitRun(int originalVal, int cnt) {
            if (cnt <= 0) return;

            // count specials before mapping
            if (originalVal == noCov) noCovCells += cnt;
            else if (originalVal == bad) badCells += cnt;
            else if (originalVal == ap) apCells += cnt;
            else if (originalVal == atten) attenCells += cnt;

            int level = mapLevel(originalVal);

            totalCells += (long) cnt;
            if (level > 0) {
                nonZero += (long) cnt;
                activeMask |= (1 << level);
            }
            if (level > maxLevel) maxLevel = level;

            // merge consecutive same levels
            if (level == lastLevel) {
                long sum = (long) lastCount + (long) cnt;
                if (sum > Integer.MAX_VALUE) {
                    flushLast();
                    lastLevel = level;
                    lastCount = cnt;
                } else {
                    lastCount += cnt;
                }
            } else {
                flushLast();
                lastLevel = level;
                lastCount = cnt;
            }
        }

        private void flushLast() {
            if (lastLevel < 0 || lastCount <= 0) return;
            if (!out.isEmpty()) out.append(' ');
            out.append(lastLevel).append(',').append(lastCount);
        }

        private int mapLevel(int v) {
            if (v == bad || v == noCov || v == atten || v == ap) return 0;
            if (v < 0 || v > 6) return 0;
            return v;
        }

        String outString() { return out.toString(); }
        long totalCells() { return totalCells; }
        int maxLevel() { return maxLevel; }
        long nonZeroCells() { return nonZero; }
        int activeMask() { return activeMask; }

        long noCoverageCells() { return noCovCells; }
        long badCells() { return badCells; }
        long apCells() { return apCells; }
        long attenCells() { return attenCells; }

        private static boolean isDigit(char c) { return c >= '0' && c <= '9'; }
        private static boolean isWs(char c) { return c == ' ' || c == '\n' || c == '\r' || c == '\t'; }
    }

    // ---------------- JSON build: {levels:[..], frames:[..]} ----------------

    private static byte[] buildPayloadJsonBytes(FrameCache cache) {
        // active levels in newest frame (cache[0])
        int activeMask = (cache.size() > 0) ? cache.get(0).activeMask : 0;

        StringBuilder sb = new StringBuilder(1 << 18);
        sb.append('{');

        kvNum(sb, "updatedAtMs", System.currentTimeMillis()); sb.append(',');
        kvStr(sb, "source", "SWIM_ITWS"); sb.append(',');

        // top-level levels array: only levels 1..6 that occur in newest frame
        sb.append("\"levels\":[");
        boolean first = true;
        for (int lvl = 1; lvl <= 6; lvl++) {
            if ((activeMask & (1 << lvl)) != 0) {
                if (!first) sb.append(',');
                sb.append(lvl);
                first = false;
            }
        }
        sb.append("],");

        sb.append("\"frames\":[");
        for (int i = 0; i < cache.size(); i++) {
            if (i > 0) sb.append(',');
            appendFrameJson(sb, cache.get(i));
        }
        sb.append("]");

        sb.append('}');
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static void appendFrameJson(StringBuilder sb, Frame f) {
        double trpLatDeg = f.trpLatMicroDeg / 1_000_000.0;
        double trpLonDeg = f.trpLonMicroDeg / 1_000_000.0;
        double rotDeg = f.rotationMilliDeg / 1000.0;

        sb.append('{');

        kvNum(sb, "receiverMs", f.receiverMs); sb.append(',');
        kvStr(sb, "receivedAt", nz(f.receivedAt)); sb.append(',');

        kvNum(sb, "itwsGenTimeMs", f.itwsGenTimeMs); sb.append(',');
        kvNum(sb, "itwsExpTimeMs", f.itwsExpTimeMs); sb.append(',');

        kvNum(sb, "productId", f.productId); sb.append(',');
        kvStr(sb, "productName", nz(f.productName)); sb.append(',');
        kvStr(sb, "site", nz(f.site)); sb.append(',');
        kvStr(sb, "airport", nz(f.airport)); sb.append(',');

        sb.append("\"grid\":{");

        // publish chosen plotting dims
        kvNum(sb, "rows", f.plotRows); sb.append(',');
        kvNum(sb, "cols", f.plotCols); sb.append(',');
        kvStr(sb, "dimsSource", nz(f.dimsSource)); sb.append(',');

        // publish raw dims for debugging / future decisions
        sb.append("\"rawDims\":{");
        kvNum(sb, "nrows", f.rows); sb.append(',');
        kvNum(sb, "ncols", f.cols); sb.append(',');
        kvNum(sb, "gridMaxY", f.gridMaxY); sb.append(',');
        kvNum(sb, "gridMaxX", f.gridMaxX);
        sb.append("},");

        kvStr(sb, "layout", "row-major"); sb.append(',');

        sb.append("\"trp\":{");
        kvNumD(sb, "latDeg", trpLatDeg); sb.append(',');
        kvNumD(sb, "lonDeg", trpLonDeg);
        sb.append("},");

        sb.append("\"geom\":{");
        kvNum(sb, "xOffsetM", f.xOffsetM); sb.append(',');
        kvNum(sb, "yOffsetM", f.yOffsetM); sb.append(',');
        kvNum(sb, "dxM", f.dxM); sb.append(',');
        kvNum(sb, "dyM", f.dyM); sb.append(',');
        kvNumD(sb, "rotationDeg", rotDeg);
        sb.append("},");

        kvStr(sb, "cellsEncoding", "rle"); sb.append(',');
        kvStr(sb, "cellsRle", f.cellsRle == null ? "" : f.cellsRle); sb.append(',');

        kvNum(sb, "cellsTotal", f.cellsTotal); sb.append(',');
        kvNum(sb, "maxLevel", f.maxLevel); sb.append(',');
        kvNum(sb, "nonZeroCells", f.nonZeroCells); sb.append(',');
        kvNum(sb, "itwsMaxPrecipLevel", f.maxPrecipLevel); sb.append(',');

        sb.append("\"special\":{");
        kvNum(sb, "noCoverageCells", f.noCoverageCells); sb.append(',');
        kvNum(sb, "badCells", f.badCells); sb.append(',');
        kvNum(sb, "apCells", f.apCells); sb.append(',');
        kvNum(sb, "attenCells", f.attenCells);
        sb.append("}");

        sb.append("}"); // grid
        sb.append('}');
    }

    private static void kvStr(StringBuilder sb, String k, String v) {
        sb.append('"').append(esc(k)).append('"').append(':')
          .append('"').append(esc(v)).append('"');
    }

    private static void kvNum(StringBuilder sb, String k, long v) {
        sb.append('"').append(esc(k)).append('"').append(':').append(v);
    }

    private static void kvNum(StringBuilder sb, String k, int v) {
        sb.append('"').append(esc(k)).append('"').append(':').append(v);
    }

    private static void kvNumD(StringBuilder sb, String k, double v) {
        sb.append('"').append(esc(k)).append('"').append(':').append(Double.toString(v));
    }

    private static String esc(String s) {
        if (s == null) return "";
        StringBuilder out = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\' -> out.append("\\\\");
                case '"' -> out.append("\\\"");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> out.append(c);
            }
        }
        return out.toString();
    }

    private static String nz(String s) { return (s == null) ? "" : s; }

    // ---------------- POST with retry ----------------

    private static void postWithRetry(
            HttpClient http,
            URI url,
            String token,
            byte[] json,
            int requestTimeoutMs,
            int retrySleepMs
    ) throws InterruptedException {
        while (true) {
            try {
                HttpRequest req = HttpRequest.newBuilder(url)
                        .timeout(Duration.ofMillis(requestTimeoutMs))
                        .header("Content-Type", "application/json")
                        .header("X-WX-Token", token)   // <- ITWS_INGEST_TOKEN
                        .POST(HttpRequest.BodyPublishers.ofByteArray(json))
                        .build();

                HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
                int code = resp.statusCode();
                if (code >= 200 && code < 300) return;

                System.err.println("WX POST failed: HTTP " + code);
                System.err.println("Response: " + resp.body());
            } catch (Exception e) {
                System.err.println("WX POST error: " + e.getMessage());
            }
            Thread.sleep(Math.max(50, retrySleepMs));
        }
    }

    // ---------------- JMS/XML helpers ----------------

    private static InputStream extractXmlStream(Message msg, int maxBytes) throws JMSException {
        if (msg instanceof TextMessage tm) {
            String s = tm.getText();
            if (s == null || s.isBlank()) return null;
            if (s.length() > maxBytes) s = s.substring(0, maxBytes);
            return new ByteArrayInputStream(s.getBytes(StandardCharsets.UTF_8));
        }
        if (msg instanceof BytesMessage bm) {
            long len = bm.getBodyLength();
            int take = (int) Math.min(len, (long) maxBytes);
            byte[] out = new byte[take];
            bm.readBytes(out);
            return new ByteArrayInputStream(out);
        }
        return null;
    }

    private static void trySet(XMLInputFactory f, String prop, Object value) {
        try { f.setProperty(prop, value); } catch (Exception ignored) {}
    }

    private static int parseInt(String s, int def) {
        if (s == null || s.isBlank()) return def;
        try {
            int dot = s.indexOf('.');
            String t = (dot >= 0) ? s.substring(0, dot) : s;
            return Integer.parseInt(t.trim());
        } catch (Exception e) { return def; }
    }

    private static long parseLong(String s, long def) {
        if (s == null || s.isBlank()) return def;
        try {
            int dot = s.indexOf('.');
            String t = (dot >= 0) ? s.substring(0, dot) : s;
            return Long.parseLong(t.trim());
        } catch (Exception e) { return def; }
    }

    private static int toInt(Object o, int def) {
        if (o == null) return def;
        if (o instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(o).trim()); } catch (Exception e) { return def; }
    }

    private static String normalizeJmsHostList(String raw) {
        if (raw == null) return "";
        String[] parts = raw.split(",");
        StringBuilder out = new StringBuilder(raw.length());
        for (String part : parts) {
            String token = part.trim();
            if (token.isEmpty()) continue;

            String normalized;
            int idx = token.indexOf("://");
            if (idx > 0 && idx + 3 < token.length()) {
                String scheme = token.substring(0, idx).toLowerCase(Locale.ROOT);
                String hostPort = token.substring(idx + 3);
                while (hostPort.endsWith("/")) hostPort = hostPort.substring(0, hostPort.length() - 1);

                if (scheme.equals("tcps")) normalized = "smfs://" + hostPort;
                else if (scheme.equals("tcp")) normalized = "smf://" + hostPort;
                else normalized = scheme + "://" + hostPort;
            } else {
                while (token.endsWith("/")) token = token.substring(0, token.length() - 1);
                normalized = token;
            }

            if (!out.isEmpty()) out.append(',');
            out.append(normalized);
        }
        return out.isEmpty() ? raw.trim() : out.toString();
    }

    // ---------------- Data model ----------------

    private static final class Frame {
        // receive time
        long receiverMs = 0;
        String receivedAt = "";

        // identity
        int productId = -1;
        String productName = "";
        String site = "";
        String airport = "";

        // ITWS times
        long genSec = 0;
        int genMs = 0;
        long expSec = 0;
        int expMs = 0;
        long itwsGenTimeMs = 0;
        long itwsExpTimeMs = 0;

        // geometry
        int trpLatMicroDeg = 0;
        int trpLonMicroDeg = 0;

        int xOffsetM = 0;
        int yOffsetM = 0;
        int dxM = 0;
        int dyM = 0;
        int rotationMilliDeg = 0;

        // raw dims
        int rows = -1; // prcp_nrows
        int cols = -1; // prcp_ncols
        int gridMaxX = -1; // prcp_grid_max_x
        int gridMaxY = -1; // prcp_grid_max_y

        // chosen plotting dims
        int plotRows = -1;
        int plotCols = -1;
        String dimsSource = "";

        // specials
        int attenuated = 7;
        int apDetected = 8;
        int badValue = 9;
        int noCoverage = 15;

        // misc
        String compression = "";
        int maxPrecipLevel = -1;

        // cells (mapped)
        String cellsRle = "";
        long cellsTotal = 0;
        int maxLevel = 0;
        long nonZeroCells = 0;
        int activeMask = 0;

        // original-special counts
        long noCoverageCells = 0;
        long badCells = 0;
        long apCells = 0;
        long attenCells = 0;
    }

    // ---------------- Config ----------------

    private static final class Config {
        final String jmsUrl, vpn, username, password, queueName;

        final URI postUrl;
        final String ingestToken;

        final int receiveTimeoutMs, heartbeatMs;
        final int maxXmlBytes;

        final boolean printJson;
        final int httpConnectTimeoutMs, httpRequestTimeoutMs, retrySleepMs;

        final boolean ackOnException;

        private Config(String jmsUrl, String vpn, String username, String password, String queueName,
                       URI postUrl, String ingestToken,
                       int receiveTimeoutMs, int heartbeatMs, int maxXmlBytes,
                       boolean printJson,
                       int httpConnectTimeoutMs, int httpRequestTimeoutMs, int retrySleepMs,
                       boolean ackOnException) {
            this.jmsUrl = jmsUrl;
            this.vpn = vpn;
            this.username = username;
            this.password = password;
            this.queueName = queueName;

            this.postUrl = postUrl;
            this.ingestToken = ingestToken;

            this.receiveTimeoutMs = receiveTimeoutMs;
            this.heartbeatMs = heartbeatMs;
            this.maxXmlBytes = maxXmlBytes;

            this.printJson = printJson;
            this.httpConnectTimeoutMs = httpConnectTimeoutMs;
            this.httpRequestTimeoutMs = httpRequestTimeoutMs;
            this.retrySleepMs = retrySleepMs;

            this.ackOnException = ackOnException;
        }

        static Config fromEnv() {
            String url = must("SCDS_JMS_URL_ITWS");
            String vpn = must("SCDS_VPN_ITWS");
            String user = must("SCDS_USERNAME");
            String pass = must("SCDS_PASSWORD");
            String q = must("SCDS_QUEUE_ITWS");

            // Required token for your API
            String token = must("ITWS_INGEST_TOKEN");

            // default requested endpoint
            String postRaw = System.getenv("WX_POST_URL");
            URI postUrl = (postRaw == null || postRaw.isBlank())
                    ? URI.create("http://localhost:8080/api/wx/radar")
                    : URI.create(postRaw.trim());

            int rto = parseIntOrDefault(System.getenv("ITWS_RECEIVE_TIMEOUT_MS"), 1000);
            int hb  = parseIntOrDefault(System.getenv("ITWS_HEARTBEAT_MS"), 5000);
            int max = parseIntOrDefault(System.getenv("ITWS_MAX_XML_BYTES"), 32 * 1024 * 1024);

            boolean printJson = parseBoolOrDefault(System.getenv("ITWS_PRINT_JSON"), false);

            int cto = parseIntOrDefault(System.getenv("HTTP_CONNECT_TIMEOUT_MS"), 1500);
            int hto = parseIntOrDefault(System.getenv("HTTP_REQUEST_TIMEOUT_MS"), 5000);
            int rs  = parseIntOrDefault(System.getenv("HTTP_RETRY_SLEEP_MS"), 200);

            boolean ackOnEx = parseBoolOrDefault(System.getenv("ITWS_ACK_ON_EXCEPTION"), false);

            return new Config(url, vpn, user, pass, q, postUrl, token,
                    rto, hb, max, printJson, cto, hto, rs, ackOnEx);
        }

        private static int parseIntOrDefault(String s, int def) {
            if (s == null || s.isBlank()) return def;
            try { return Integer.parseInt(s.trim()); } catch (Exception e) { return def; }
        }

        private static boolean parseBoolOrDefault(String s, boolean def) {
            if (s == null || s.isBlank()) return def;
            String v = s.trim().toLowerCase(Locale.ROOT);
            return v.equals("1") || v.equals("true") || v.equals("yes") || v.equals("y");
        }

        private static String must(String k) {
            String v = System.getenv(k);
            if (v == null || v.isBlank()) throw new IllegalArgumentException("Missing env var: " + k);
            return v;
        }
    }
}
