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
import java.util.*;
import java.util.zip.Deflater;
import java.util.Base64;

/**
 * Consumes ITWS Forecast Image Product (productID=9901) from a Solace queue.
 *
 * Goal: POST a rolling window of the last 4 "current" grids (past 3 + current)
 * to http://localhost:8080/api/wx/radar (configurable).
 *
 * Payload notes:
 *  - levels are bytes (0..6) in row-major order (row 0 then row 1 ...).
 *  - data is zlib-compressed then base64 encoded: encoding="zlib+base64".
 *
 * Geometry included:
 *  - rows, cols, dxM, dyM, rotationDeg, TRP lat/lon
 *  - origin offsets xOffsetM/yOffsetM:
 *      If message doesn't provide explicit offsets, we assume TRP is grid center and set:
 *        xOffsetM = - (cols * dxM)/2
 *        yOffsetM = - (rows * dyM)/2
 *      This makes cell centers:
 *        x = xOffsetM + (c + 0.5)*dxM
 *        y = yOffsetM + (r + 0.5)*dyM
 *      then rotate by rotationDeg around TRP.
 *
 * Required env:
 *  SCDS_JMS_URL_ITWS
 *  SCDS_VPN_ITWS
 *  SCDS_USERNAME
 *  SCDS_PASSWORD
 *  SCDS_QUEUE_ITWS
 *
 * Optional env:
 *  ITWS_SELECTOR=                  (usually empty)
 *  ITWS_TARGET_PRODUCT_ID=9901
 *  RECEIVE_TIMEOUT_MS=15000
 *  HEARTBEAT_MS=10000
 *  MAX_XML_BYTES=32000000
 *
 *  WX_POST_URL=http://localhost:8080/api/wx/radar (or ITWS_POST_URL)
 *  ITWS_INGEST_TOKEN=...          (sent as X-WX-Token)
 *
 *  HTTP_CONNECT_TIMEOUT_MS=1500
 *  HTTP_REQUEST_TIMEOUT_MS=5000
 *  HTTP_RETRY_SLEEP_MS=250
 *
 *  ACK_ON_EXCEPTION=false          (true will ACK even on exceptions)
 */
public final class ItwsConsumer {

    public static void main(String[] args) throws Exception {
        final Config cfg = Config.fromEnv();

        final HttpClient http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(cfg.httpConnectTimeoutMs))
                .build();

        final SolConnectionFactory cf = SolJmsUtility.createConnectionFactory();
        cf.setHost(normalizeJmsHostList(cfg.jmsUrl));
        cf.setVPN(cfg.vpn);
        cf.setUsername(cfg.username);
        cf.setPassword(cfg.password);
        cf.setConnectRetries(5);
        cf.setConnectRetriesPerHost(3);
        if (!cfg.clientName.isEmpty()) cf.setClientID(cfg.clientName);

        final XMLInputFactory xif = XMLInputFactory.newFactory();
        trySet(xif, XMLInputFactory.SUPPORT_DTD, Boolean.FALSE);
        trySet(xif, "javax.xml.stream.isSupportingExternalEntities", Boolean.FALSE);

        // rolling buffer of last 4 "current" grids
        final ArrayDeque<GridSnapshot> ring = new ArrayDeque<>(4);
        GridGeom lastGeom = null;

        Connection conn = null;
        Session session = null;
        MessageConsumer consumer = null;
        try {
            conn = cf.createConnection();
            session = conn.createSession(false, Session.CLIENT_ACKNOWLEDGE);

            final Queue queue = session.createQueue(cfg.queueName);
            consumer = (cfg.selector == null || cfg.selector.isBlank())
                    ? session.createConsumer(queue)
                    : session.createConsumer(queue, cfg.selector);

            conn.start();
            System.out.println("Connected. Queue=" + cfg.queueName);
            System.out.println("Posting to: " + cfg.postUrl);

            long empty = 0;
            long lastBeat = System.currentTimeMillis();

            while (true) {
                final Message msg = consumer.receive(cfg.receiveTimeoutMs);
                final long now = System.currentTimeMillis();

                if (msg == null) {
                    empty++;
                    if (now - lastBeat >= cfg.heartbeatMs) {
                        System.out.println("Waiting… (" + empty + " empty polls)");
                        lastBeat = now;
                    }
                    continue;
                }

                boolean acked = false;
                try {
                    // Quick gate by productID property if present
                    if (msg.propertyExists("productID")) {
                        int pid = toIntSafe(msg.getObjectProperty("productID"), -1);
                        if (pid != -1 && pid != cfg.targetProductId) {
                            msg.acknowledge();
                            acked = true;
                            continue;
                        }
                    }

                    // Parse the CURRENT grid (frame #0) from this message
                    ParsedCurrent cur = parseCurrentGrid9901(msg, xif, cfg.maxXmlBytes);

                    if (cur == null || cur.geom == null || cur.levels == null || cur.levels.length == 0) {
                        // malformed => ACK to avoid poison-loop
                        msg.acknowledge();
                        acked = true;
                        continue;
                    }

                    // If geometry changes, reset history (safer for plotting)
                    if (lastGeom != null && !lastGeom.compatibleWith(cur.geom)) {
                        ring.clear();
                    }
                    lastGeom = cur.geom;

                    // Add to rolling buffer (dedupe by timestamp ms)
                    if (!ring.isEmpty() && ring.peekLast().tEpochMs == cur.tEpochMs) {
                        // same timestamp; ignore duplicate
                    } else {
                        ring.addLast(new GridSnapshot(cur.tEpochMs, cur.tIso, cur.maxLevel, cur.geom, cur.levels));
                        while (ring.size() > 4) ring.removeFirst();
                    }

                    // Only POST once we have at least 1 grid (it’ll grow up to 4)
                    byte[] json = buildHistoryJson(ring, lastGeom);
                    postWithRetry(http, cfg.postUrl, cfg.ingestToken, json,
                            cfg.httpRequestTimeoutMs, cfg.retrySleepMs);

                    System.out.println("POST OK " + Instant.now()
                            + " frames=" + ring.size()
                            + " newest=" + ring.peekLast().tIso
                            + " maxLevelAll=" + maxLevelAll(ring));

                    // ACK only after successful POST
                    msg.acknowledge();
                    acked = true;

                } catch (Exception e) {
                    System.err.println("Error: " + e.getMessage());
                } finally {
                    if (!acked && cfg.ackOnException) {
                        try { msg.acknowledge(); } catch (Exception ignored) {}
                    }
                }
            }
        } finally {
            closeQuietly(consumer);
            closeQuietly(session);
            closeQuietly(conn);
        }
    }

    // ---------------- Data Models ----------------

    private static final class GridGeom {
        int rows, cols;
        int dxM, dyM;
        double rotationDeg;

        double trpLatDeg, trpLonDeg;

        // If not provided by message, we fill with centered assumption.
        int xOffsetM, yOffsetM;
        String offsetMode; // "from_message" or "centered_on_trp"

        boolean compatibleWith(GridGeom o) {
            if (o == null) return false;
            return this.rows == o.rows
                    && this.cols == o.cols
                    && this.dxM == o.dxM
                    && this.dyM == o.dyM
                    && Math.abs(this.rotationDeg - o.rotationDeg) < 1e-6
                    && Math.abs(this.trpLatDeg - o.trpLatDeg) < 1e-8
                    && Math.abs(this.trpLonDeg - o.trpLonDeg) < 1e-8;
        }
    }

    private static final class GridSnapshot {
        final long tEpochMs;
        final String tIso;
        final int maxLevel;
        final GridGeom geom; // same for all (normally)
        final byte[] levels; // raw levels (0..6), length rows*cols

        GridSnapshot(long tEpochMs, String tIso, int maxLevel, GridGeom geom, byte[] levels) {
            this.tEpochMs = tEpochMs;
            this.tIso = tIso;
            this.maxLevel = maxLevel;
            this.geom = geom;
            this.levels = levels;
        }
    }

    private static final class ParsedCurrent {
        long tEpochMs;
        String tIso;

        GridGeom geom;
        byte[] levels;
        int maxLevel;
    }

    // ---------------- Parsing current grid from 9901 ----------------

    private static ParsedCurrent parseCurrentGrid9901(Message msg, XMLInputFactory xif, int maxXmlBytes) throws Exception {
        InputStream in = extractXmlStream(msg, maxXmlBytes);
        if (in == null) return null;

        XMLStreamReader r = null;
        try {
            r = xif.createXMLStreamReader(in, StandardCharsets.UTF_8.name());

            // message-level meta
            long genSec = 0L;
            long genMs = 0L;
            int spacing = 0; // seconds (assumed)
            int targetProductId = -1;
            String productName = "";
            String site = "";
            String airport = "";

            int dxM = 0, dyM = 0;
            double rotationDeg = 0.0;
            Double trpLat = null, trpLon = null;

            Integer xOffsetM = null, yOffsetM = null; // rarely present in 9901, but support if it is.

            // frame 0 meta
            boolean inFirstImage = false;
            boolean gotFirstImage = false;

            Integer mx = null, my = null; // fci_grid_max_x/y (semantics uncertain)
            Integer maxPrecipLevel = null;
            String compression = null;

            // decoding state
            boolean inCompressed = false;
            RleByteDecoder dec = null;

            String current = null;
            StringBuilder small = null;

            while (r.hasNext()) {
                int ev = r.next();

                if (ev == XMLStreamConstants.START_ELEMENT) {
                    current = r.getLocalName();

                    if ("fci_image".equals(current) && !gotFirstImage) {
                        inFirstImage = true;
                        gotFirstImage = true;
                        small = null;
                        continue;
                    }

                    if (inFirstImage && "fci_grid_compressed".equals(current)) {
                        inCompressed = true;

                        // We'll allocate after we have mx/my. If still missing, allocate later by growing,
                        // but usually mx/my appear before compressed.
                        dec = new RleByteDecoder();
                        small = null;
                        continue;
                    }

                    // buffer text for non-payload tags
                    small = new StringBuilder(64);

                } else if (ev == XMLStreamConstants.CHARACTERS || ev == XMLStreamConstants.CDATA) {

                    if (inFirstImage && inCompressed && dec != null) {
                        dec.feed(r.getText());
                    } else if (small != null) {
                        if (small.length() < 4096) small.append(r.getText());
                    }

                } else if (ev == XMLStreamConstants.END_ELEMENT) {
                    String end = r.getLocalName();

                    // end of compressed payload => finalize decode and stop parsing (we only need current grid)
                    if (inFirstImage && inCompressed && "fci_grid_compressed".equals(end)) {
                        inCompressed = false;
                        dec.finish();

                        // infer geometry sizes
                        int[] rc = inferRowsCols(mx, my, dec.filled());
                        int rows = rc[0], cols = rc[1];

                        if (rows <= 0 || cols <= 0) return null;
                        int total = safeMul(rows, cols);
                        if (total <= 0) return null;

                        // Get levels array trimmed to filled cells
                        byte[] levels = dec.takeLevels(total);

                        // Build geom
                        GridGeom geom = new GridGeom();
                        geom.rows = rows;
                        geom.cols = cols;
                        geom.dxM = dxM;
                        geom.dyM = dyM;
                        geom.rotationDeg = rotationDeg;
                        geom.trpLatDeg = (trpLat != null) ? trpLat : 0.0;
                        geom.trpLonDeg = (trpLon != null) ? trpLon : 0.0;

                        if (xOffsetM != null && yOffsetM != null) {
                            geom.xOffsetM = xOffsetM;
                            geom.yOffsetM = yOffsetM;
                            geom.offsetMode = "from_message";
                        } else {
                            // centered-on-TRP assumption
                            // origin here is SW-corner offset relative to TRP
                            geom.xOffsetM = - (int) Math.round((cols * (double) dxM) / 2.0);
                            geom.yOffsetM = - (int) Math.round((rows * (double) dyM) / 2.0);
                            geom.offsetMode = "centered_on_trp";
                        }

                        // Timestamp for "current" grid:
                        // use generation time as validity time for frame #0.
                        long tMs = genSec > 0 ? (genSec * 1000L + genMs) : System.currentTimeMillis();
                        String tIso = Instant.ofEpochMilli(tMs).toString();

                        // compute maxLevel from decoded data (already mapped 0..6)
                        int maxLevelSeen = dec.maxMappedSeen;

                        ParsedCurrent out = new ParsedCurrent();
                        out.tEpochMs = tMs;
                        out.tIso = tIso;
                        out.geom = geom;
                        out.levels = levels;
                        out.maxLevel = maxLevelSeen;

                        // done: current grid extracted
                        return out;
                    }

                    if (small != null && current != null && current.equals(end)) {
                        String v = small.toString().trim();

                        // message-level tags
                        switch (end) {
                            case "product_msg_id" -> targetProductId = parseInt(v, -1);
                            case "product_msg_name" -> productName = v;
                            case "product_header_site_id", "product_header_itws_sites" -> site = v;
                            case "product_header_airports" -> airport = v;

                            case "product_header_generation_time_seconds" -> genSec = parseLong(v, 0L);
                            case "product_header_generation_time_milliseconds" -> genMs = parseLong(v, 0L);
                            case "fci_spacing" -> spacing = parseInt(v, 0);

                            case "grid_dx" -> dxM = parseInt(v, 0);
                            case "grid_dy" -> dyM = parseInt(v, 0);
                            case "grid_rotation" -> rotationDeg = parseDouble(v, 0.0);

                            case "grid_TRP_latitude" -> trpLat = parseDouble(v, null);
                            case "grid_TRP_longitude" -> trpLon = parseDouble(v, null);

                            // if any offset-like tags appear
                            case "grid_xoffset", "grid_x_offset", "xOffsetM", "prcp_xoffset" -> xOffsetM = parseInt(v, null);
                            case "grid_yoffset", "grid_y_offset", "yOffsetM", "prcp_yoffset" -> yOffsetM = parseInt(v, null);

                            default -> { /* ignore */ }
                        }

                        // frame 0 tags
                        if (inFirstImage) {
                            switch (end) {
                                case "fci_grid_max_x" -> mx = parseInt(v, null);
                                case "fci_grid_max_y" -> my = parseInt(v, null);
                                case "fci_grid_max_precip_level" -> maxPrecipLevel = parseInt(v, null);
                                case "fci_grid_compression_encoding_scheme" -> compression = v;
                                default -> { /* ignore */ }
                            }
                        }
                    }

                    if ("fci_image".equals(end) && inFirstImage) {
                        // We expected to return from end-of-compressed; if no compressed found, leave.
                        inFirstImage = false;
                    }

                    current = null;
                    small = null;
                }
            }

            return null;

        } finally {
            if (r != null) try { r.close(); } catch (Exception ignored) {}
            try { in.close(); } catch (Exception ignored) {}
        }
    }

    /**
     * Infer rows/cols from XML mx/my and actual filled cell count.
     * mx/my in 9901 may be "count" or "max index"; we resolve by matching filledCells.
     */
    private static int[] inferRowsCols(Integer mx, Integer my, int filledCells) {
        if (filledCells <= 0) return new int[]{-1, -1};

        // Candidate sets (value, value+1)
        int[] xs = (mx != null && mx > 0) ? new int[]{mx, mx + 1} : new int[]{};
        int[] ys = (my != null && my > 0) ? new int[]{my, my + 1} : new int[]{};

        if (xs.length > 0 && ys.length > 0) {
            for (int r : ys) for (int c : xs) {
                long prod = (long) r * (long) c;
                if (prod == (long) filledCells) return new int[]{r, c};
            }
        }

        // fallback: square root if perfect square
        int s = (int) Math.round(Math.sqrt(filledCells));
        if ((long) s * (long) s == (long) filledCells) return new int[]{s, s};

        // last resort: treat as 1 x N
        return new int[]{1, filledCells};
    }

    // ---------------- RLE decoder producing mapped byte levels ----------------

    private static final class RleByteDecoder {
        // Store decoded levels in a growable byte[].
        // We grow conservatively; final trimming happens before POST.
        private byte[] out = new byte[1 << 20]; // 1MB initial
        private int pos = 0;

        // specials (ITWS uses these codes frequently)
        private int bad = 9, noCov = 15, atten = 7, ap = 8;

        int maxMappedSeen = 0;

        // streaming parse state
        private int curVal = 0;
        private int curCnt = 0;
        private boolean neg = false;
        private boolean inVal = false;
        private boolean inCnt = false;
        private boolean sawDigit = false;

        int filled() { return pos; }

        byte[] takeLevels(int exactLen) {
            // exactLen is rows*cols inferred.
            // If pos < exactLen, pad remaining with 0; if pos > exactLen, truncate.
            byte[] trimmed = new byte[exactLen];
            int copy = Math.min(exactLen, pos);
            System.arraycopy(out, 0, trimmed, 0, copy);
            // remaining bytes already 0
            return trimmed;
        }

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
            inVal = false;
            inCnt = false;
            sawDigit = false;
        }

        private void emitRun(int rawVal, int cnt) {
            if (cnt <= 0) return;

            final int lvl = mapLevel(rawVal);

            // update max mapped
            if (lvl > maxMappedSeen) maxMappedSeen = lvl;

            // ensure capacity
            ensureCapacity(pos + cnt);

            // fast fill
            Arrays.fill(out, pos, pos + cnt, (byte) lvl);
            pos += cnt;
        }

        private int mapLevel(int v) {
            if (v == bad || v == noCov || v == atten || v == ap) return 0;
            if (v < 0 || v > 6) return 0;
            return v;
        }

        private void ensureCapacity(int needed) {
            if (needed <= out.length) return;
            int cap = out.length;
            while (cap < needed) {
                // grow ~1.5x to reduce RAM spikes but keep realloc count low
                cap = cap + (cap >> 1);
                if (cap < 0) { cap = needed; break; }
            }
            out = Arrays.copyOf(out, cap);
        }

        private static boolean isDigit(char c) { return c >= '0' && c <= '9'; }
        private static boolean isWs(char c) { return c == ' ' || c == '\n' || c == '\r' || c == '\t'; }
    }

    // ---------------- JSON build (compressed levels) ----------------

    private static byte[] buildHistoryJson(ArrayDeque<GridSnapshot> ring, GridGeom geom) throws IOException {
        // Compress each frame levels on-demand; these grids are large so avoid building huge strings.
        ByteArrayOutputStream baos = new ByteArrayOutputStream(1 << 20);
        OutputStreamWriter osw = new OutputStreamWriter(baos, StandardCharsets.UTF_8);
        BufferedWriter w = new BufferedWriter(osw, 1 << 16);

        int[] levels = observedWxLevels(ring);

        w.write('{');
        jstr(w, "schema", "itws-radar-history/v1"); w.write(',');
        jstr(w, "layout", "row-major"); w.write(',');
        jstr(w, "levelsEncoding", "u8"); w.write(',');
        jstr(w, "dataEncoding", "zlib+base64"); w.write(',');
        jintArray(w, "levels", levels); w.write(',');

        // geometry
        w.write("\"grid\":{");
        jint(w, "rows", geom.rows); w.write(',');
        jint(w, "cols", geom.cols); w.write(',');
        jint(w, "dxM", geom.dxM); w.write(',');
        jint(w, "dyM", geom.dyM); w.write(',');
        jnum(w, "rotationDeg", geom.rotationDeg); w.write(',');

        w.write("\"trp\":{");
        jnum(w, "latDeg", geom.trpLatDeg); w.write(',');
        jnum(w, "lonDeg", geom.trpLonDeg);
        w.write("},");

        w.write("\"origin\":{");
        jint(w, "xOffsetM", geom.xOffsetM); w.write(',');
        jint(w, "yOffsetM", geom.yOffsetM); w.write(',');
        jstr(w, "mode", geom.offsetMode);
        w.write("}");

        w.write("},");

        // frames
        w.write("\"frames\":[");
        boolean first = true;
        for (GridSnapshot f : ring) {
            if (!first) w.write(',');
            first = false;

            // compress levels -> base64
            byte[] compressed = zlibCompress(f.levels);
            String b64 = Base64.getEncoder().encodeToString(compressed);

            w.write('{');
            jstr(w, "t", f.tIso); w.write(',');
            jlong(w, "tEpochMs", f.tEpochMs); w.write(',');
            jint(w, "maxLevel", f.maxLevel); w.write(',');
            jint(w, "rawBytes", f.levels.length); w.write(',');
            jint(w, "zlibBytes", compressed.length); w.write(',');
            jstr(w, "data", b64);
            w.write('}');
        }
        w.write(']');

        w.write('}');
        w.flush();
        return baos.toByteArray();
    }

    private static int maxLevelAll(ArrayDeque<GridSnapshot> ring) {
        int m = 0;
        for (GridSnapshot s : ring) if (s.maxLevel > m) m = s.maxLevel;
        return m;
    }

    private static int[] observedWxLevels(ArrayDeque<GridSnapshot> ring) {
        GridSnapshot latest = ring.peekLast();
        if (latest == null || latest.levels == null || latest.levels.length == 0) {
            return new int[0];
        }

        boolean[] seen = new boolean[7]; // indices 1..6 used
        for (byte raw : latest.levels) {
            int level = raw & 0xFF;
            if (level >= 1 && level <= 6) {
                seen[level] = true;
            }
        }

        int count = 0;
        for (int level = 1; level <= 6; level += 1) {
            if (seen[level]) {
                count += 1;
            }
        }

        int[] out = new int[count];
        int at = 0;
        for (int level = 1; level <= 6; level += 1) {
            if (seen[level]) {
                out[at++] = level;
            }
        }
        return out;
    }

    private static void closeQuietly(MessageConsumer c) {
        if (c == null) return;
        try { c.close(); } catch (Exception ignored) {}
    }

    private static void closeQuietly(Session s) {
        if (s == null) return;
        try { s.close(); } catch (Exception ignored) {}
    }

    private static void closeQuietly(Connection c) {
        if (c == null) return;
        try { c.close(); } catch (Exception ignored) {}
    }

    private static byte[] zlibCompress(byte[] raw) throws IOException {
        Deflater def = new Deflater(Deflater.BEST_SPEED);
        try {
            def.setInput(raw);
            def.finish();

            byte[] buf = new byte[1 << 16];
            ByteArrayOutputStream baos = new ByteArrayOutputStream(Math.max(1024, raw.length / 8));

            while (!def.finished()) {
                int n = def.deflate(buf);
                if (n > 0) baos.write(buf, 0, n);
            }
            return baos.toByteArray();
        } finally {
            def.end();
        }
    }

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
                HttpRequest.Builder b = HttpRequest.newBuilder(url)
                        .timeout(Duration.ofMillis(requestTimeoutMs))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofByteArray(json));

                if (token != null && !token.isBlank()) {
                    b.header("X-WX-Token", token);
                }

                HttpResponse<String> resp = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
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

    // ---------------- JSON helpers (no deps) ----------------

    private static void jstr(Writer w, String k, String v) throws IOException {
        w.write('\"'); w.write(esc(k)); w.write('\"'); w.write(':');
        w.write('\"'); w.write(esc(v)); w.write('\"');
    }

    private static void jint(Writer w, String k, int v) throws IOException {
        w.write('\"'); w.write(esc(k)); w.write('\"'); w.write(':');
        w.write(Integer.toString(v));
    }

    private static void jlong(Writer w, String k, long v) throws IOException {
        w.write('\"'); w.write(esc(k)); w.write('\"'); w.write(':');
        w.write(Long.toString(v));
    }

    private static void jnum(Writer w, String k, double v) throws IOException {
        w.write('\"'); w.write(esc(k)); w.write('\"'); w.write(':');
        w.write(Double.toString(v));
    }

    private static void jintArray(Writer w, String k, int[] values) throws IOException {
        w.write('\"'); w.write(esc(k)); w.write('\"'); w.write(':');
        w.write('[');
        for (int i = 0; i < values.length; i += 1) {
            if (i > 0) {
                w.write(',');
            }
            w.write(Integer.toString(values[i]));
        }
        w.write(']');
    }

    private static String esc(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\' -> sb.append("\\\\");
                case '"' -> sb.append("\\\"");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    // ---------------- JMS payload extraction ----------------

    private static InputStream extractXmlStream(Message msg, int maxBytes) throws JMSException {
        if (msg instanceof TextMessage tm) {
            String s = tm.getText();
            if (s == null || s.isBlank()) return null;
            if (s.length() > maxBytes) s = s.substring(0, maxBytes);
            return new ByteArrayInputStream(s.getBytes(StandardCharsets.UTF_8));
        }
        if (msg instanceof BytesMessage bm) {
            bm.reset();
            long len = bm.getBodyLength();
            int take = (int) Math.min(len, (long) maxBytes);
            byte[] out = new byte[Math.max(0, take)];
            if (take > 0) bm.readBytes(out);
            return new ByteArrayInputStream(out);
        }
        return null;
    }

    private static void trySet(XMLInputFactory f, String prop, Object value) {
        try { f.setProperty(prop, value); } catch (Exception ignored) {}
    }

    // ---------------- Parsing helpers ----------------

    private static Integer parseInt(String s, Integer def) {
        if (s == null || s.isBlank()) return def;
        try {
            int dot = s.indexOf('.');
            String t = (dot >= 0) ? s.substring(0, dot) : s;
            return Integer.parseInt(t.trim());
        } catch (Exception e) { return def; }
    }

    private static int parseInt(String s, int def) {
        Integer v = parseInt(s, (Integer) null);
        return v == null ? def : v;
    }

    private static long parseLong(String s, long def) {
        if (s == null || s.isBlank()) return def;
        try {
            int dot = s.indexOf('.');
            String t = (dot >= 0) ? s.substring(0, dot) : s;
            return Long.parseLong(t.trim());
        } catch (Exception e) { return def; }
    }

    private static Double parseDouble(String s, Double def) {
        if (s == null || s.isBlank()) return def;
        try { return Double.parseDouble(s.trim()); } catch (Exception e) { return def; }
    }

    private static double parseDouble(String s, double def) {
        Double v = parseDouble(s, (Double) null);
        return v == null ? def : v;
    }

    private static int toIntSafe(Object o, int def) {
        if (o == null) return def;
        if (o instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(o).trim()); } catch (Exception e) { return def; }
    }

    private static int safeMul(int a, int b) {
        long x = (long) a * (long) b;
        if (x <= 0) return 0;
        if (x > Integer.MAX_VALUE) return Integer.MAX_VALUE;
        return (int) x;
    }

    // ---------------- Host normalization (tcps -> smfs) ----------------

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
                else if (scheme.equals("smfs") || scheme.equals("smf")) normalized = scheme + "://" + hostPort;
                else normalized = token;
            } else {
                while (token.endsWith("/")) token = token.substring(0, token.length() - 1);
                normalized = token;
            }

            if (!out.isEmpty()) out.append(',');
            out.append(normalized);
        }
        return out.isEmpty() ? raw.trim() : out.toString();
    }

    // ---------------- Config ----------------

    private static final class Config {
        final String jmsUrl, vpn, username, password, queueName, clientName;
        final String selector;

        final int targetProductId;
        final int receiveTimeoutMs;
        final int heartbeatMs;
        final int maxXmlBytes;

        final URI postUrl;
        final String ingestToken;

        final int httpConnectTimeoutMs;
        final int httpRequestTimeoutMs;
        final int retrySleepMs;

        final boolean ackOnException;

        private Config(
                String jmsUrl, String vpn, String username, String password, String queueName, String clientName,
                String selector,
                int targetProductId,
                int receiveTimeoutMs,
                int heartbeatMs,
                int maxXmlBytes,
                URI postUrl,
                String ingestToken,
                int httpConnectTimeoutMs,
                int httpRequestTimeoutMs,
                int retrySleepMs,
                boolean ackOnException
        ) {
            this.jmsUrl = jmsUrl;
            this.vpn = vpn;
            this.username = username;
            this.password = password;
            this.queueName = queueName;
            this.clientName = clientName;
            this.selector = selector;

            this.targetProductId = targetProductId;
            this.receiveTimeoutMs = receiveTimeoutMs;
            this.heartbeatMs = heartbeatMs;
            this.maxXmlBytes = maxXmlBytes;

            this.postUrl = postUrl;
            this.ingestToken = ingestToken;

            this.httpConnectTimeoutMs = httpConnectTimeoutMs;
            this.httpRequestTimeoutMs = httpRequestTimeoutMs;
            this.retrySleepMs = retrySleepMs;

            this.ackOnException = ackOnException;
        }

        static Config fromEnv() {
            String url = must("SCDS_JMS_URL_ITWS");
            String vpn = must("SCDS_VPN_ITWS");
            String user = mustFirst("SCDS_USERNAME", "JMS_USER", "USERNAME");
            String pass = mustFirst("SCDS_PASSWORD", "JMS_PASS", "PASSWORD");
            String q = must("SCDS_QUEUE_ITWS");

            String client = envOr("SWIM_CLIENT_NAME", "");
            String selector = envOr("ITWS_SELECTOR", "");

            int target = intEnvOr("ITWS_TARGET_PRODUCT_ID", 9901);
            int rto = intEnvOr("RECEIVE_TIMEOUT_MS", 15_000);
            int hb  = intEnvOr("HEARTBEAT_MS", 10_000);
            int maxXml = intEnvOr("MAX_XML_BYTES", 32_000_000);

            String postRaw = envOrFirst("http://localhost:8080/api/wx/radar", "WX_POST_URL", "ITWS_POST_URL");
            URI postUrl = URI.create(postRaw);

            String token = System.getenv("ITWS_INGEST_TOKEN"); // optional

            int cto = intEnvOr("HTTP_CONNECT_TIMEOUT_MS", 1500);
            int hto = intEnvOr("HTTP_REQUEST_TIMEOUT_MS", 5000);
            int rs  = intEnvOr("HTTP_RETRY_SLEEP_MS", 250);

            boolean ackOnEx = boolEnvOr("ACK_ON_EXCEPTION", false);

            return new Config(url, vpn, user, pass, q, client, selector,
                    target, rto, hb, maxXml, postUrl, token,
                    cto, hto, rs, ackOnEx);
        }

        private static String envOr(String k, String def) {
            String v = System.getenv(k);
            return (v == null || v.trim().isEmpty()) ? def : v.trim();
        }

        private static String envOrFirst(String def, String... keys) {
            for (String k : keys) {
                String v = System.getenv(k);
                if (v != null && !v.trim().isEmpty()) {
                    return v.trim();
                }
            }
            return def;
        }

        private static int intEnvOr(String k, int def) {
            String v = System.getenv(k);
            if (v == null || v.trim().isEmpty()) return def;
            try { return Integer.parseInt(v.trim()); } catch (Exception e) { return def; }
        }

        private static boolean boolEnvOr(String k, boolean def) {
            String v = System.getenv(k);
            if (v == null || v.trim().isEmpty()) return def;
            String s = v.trim().toLowerCase(Locale.ROOT);
            return s.equals("1") || s.equals("true") || s.equals("yes") || s.equals("y");
        }

        private static String must(String k) {
            String v = System.getenv(k);
            if (v == null || v.isBlank()) throw new IllegalArgumentException("Missing env var: " + k);
            return v.trim();
        }

        private static String mustFirst(String... keys) {
            for (String k : keys) {
                String v = System.getenv(k);
                if (v != null && !v.trim().isEmpty()) return v.trim();
            }
            throw new IllegalArgumentException("Missing required env var (one of): " + String.join(", ", keys));
        }
    }
}
