#!/usr/bin/env bash
set -euo pipefail

# export_font.sh
#
# Usage examples:
#   ./export_font.sh --go ./font-bitmaps.go --size 1 --set A --out ./public/fonts
#   ./export_font.sh --go ./font-bitmaps.go --size 1 --set A --outline --out ./public/fonts
#   ./export_font.sh --go ./font-bitmaps.go --var sddCharFontSetASize1 --out ./public/fonts
#
# Output:
#   <out>/<var>.png
#   <out>/<var>.json

GO_FILE="./font-bitmaps.go"
SIZE=""
SET="A"
OUT_DIR="."
OUTLINE="0"
VAR_NAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --go) GO_FILE="$2"; shift 2 ;;
    --size) SIZE="$2"; shift 2 ;;
    --set) SET="$2"; shift 2 ;;
    --outline) OUTLINE="1"; shift 1 ;;
    --var) VAR_NAME="$2"; shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    -h|--help)
      sed -n '1,60p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$GO_FILE" ]]; then
  echo "Go file not found: $GO_FILE" >&2
  exit 1
fi

if [[ -z "$VAR_NAME" ]]; then
  if [[ -z "$SIZE" ]]; then
    echo "Provide --size N (or use --var NAME)." >&2
    exit 1
  fi
  if [[ "$OUTLINE" == "1" ]]; then
    VAR_NAME="sddCharOutlineFontSet${SET}Size${SIZE}"
  else
    VAR_NAME="sddCharFontSet${SET}Size${SIZE}"
  fi
fi

mkdir -p "$OUT_DIR"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

cat > "${TMPDIR}/export_font.go" <<'GO'
package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"regexp"
	"strconv"
	"strings"
)

type GlyphMetric struct {
	SX    int `json:"sx"`
	SY    int `json:"sy"`
	W     int `json:"w"`
	H     int `json:"h"`
	OffX  int `json:"offX"`
	OffY  int `json:"offY"`
	StepX int `json:"stepX"`
}

type FontMeta struct {
	Height    int           `json:"height"`
	Width     int           `json:"width"`
	PointSize int           `json:"pointSize"`
	Metrics   []GlyphMetric `json:"metrics"` // 256 entries
}

func main() {
	var (
		inFile  = flag.String("in", "", "path to font-bitmaps.go")
		varName = flag.String("var", "", "Go var name to export (e.g. sddCharFontSetASize1)")
		outPng  = flag.String("png", "", "output png path")
		outJson = flag.String("json", "", "output json path")
	)
	flag.Parse()

	if *inFile == "" || *varName == "" || *outPng == "" || *outJson == "" {
		fmt.Fprintln(os.Stderr, "missing required args: -in -var -png -json")
		os.Exit(2)
	}

	b, err := os.ReadFile(*inFile)
	must(err)
	src := string(b)

	block, err := extractVarBlock(src, *varName)
	must(err)

	// Parse basic fields
	height := mustFieldInt(block, "Height")
	width := mustFieldInt(block, "Width")
	pointSize := mustFieldInt(block, "PointSize")

	// Parse Metrics slice (StepX, Bounds{w,h}, Offset{offX,offY})
	metrics, maxW, maxH := mustParseMetrics(block)

	// Atlas layout: 16x16 grid, fixed cell = max glyph bounds + padding
	const cols = 16
	const pad = 1
	cellW := maxW + 2*pad
	cellH := maxH + 2*pad
	rows := (256 + cols - 1) / cols
	atlasW := cols * cellW
	atlasH := rows * cellH

	img := image.NewNRGBA(image.Rect(0, 0, atlasW, atlasH))
	// transparent background by default (NRGBA starts zeroed)

	// Fill in atlas positions in metrics
	for c := 0; c < 256; c++ {
		cx := (c % cols) * cellW
		cy := (c / cols) * cellH
		metrics[c].SX = cx + pad
		metrics[c].SY = cy + pad
	}

	// Parse Bitmaps and paint directly into atlas
	mustPaintBitmaps(block, metrics, img)

	// Write PNG
	{
		f, err := os.Create(*outPng)
		must(err)
		defer f.Close()
		must(png.Encode(f, img))
	}

	// Write JSON
	meta := FontMeta{
		Height:    height,
		Width:     width,
		PointSize: pointSize,
		Metrics:   metrics,
	}
	{
		jb, err := json.MarshalIndent(meta, "", "  ")
		must(err)
		must(os.WriteFile(*outJson, jb, 0644))
	}
}

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, "ERROR:", err)
		os.Exit(1)
	}
}

func extractVarBlock(src, varName string) (string, error) {
	needle := "var " + varName
	i := strings.Index(src, needle)
	if i < 0 {
		return "", fmt.Errorf("could not find %q", needle)
	}
	// find '=' after var name
	eq := strings.Index(src[i:], "=")
	if eq < 0 {
		return "", errors.New("could not find '=' after var decl")
	}
	j := i + eq
	// find first '{' after '='
	open := strings.Index(src[j:], "{")
	if open < 0 {
		return "", errors.New("could not find '{' starting struct literal")
	}
	start := j + open

	// brace match
	depth := 0
	for k := start; k < len(src); k++ {
		switch src[k] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return src[start : k+1], nil
			}
		}
	}
	return "", errors.New("unterminated struct literal (brace mismatch)")
}

func mustFieldInt(block, field string) int {
	// e.g. Height: 14
	re := regexp.MustCompile(field + `\s*:\s*([0-9]+)`)
	m := re.FindStringSubmatch(block)
	if len(m) != 2 {
		must(fmt.Errorf("field %s not found", field))
	}
	v, err := strconv.Atoi(m[1])
	must(err)
	return v
}

func mustParseMetrics(block string) (metrics []GlyphMetric, maxW int, maxH int) {
	// Extract Metrics: ... { ... }
	metricsBlock, err := extractNamedComposite(block, "Metrics")
	must(err)

	// Find all entries of the shape:
	// {StepX: 9, Bounds: [2]int{7, 10}, Offset: [2]int{1, 3}}
	// Allow whitespace/newlines; allow optional type in Bounds/Offset.
	re := regexp.MustCompile(
		`StepX\s*:\s*([-\d]+)\s*,\s*` +
			`Bounds\s*:\s*(?:\[[0-9]+\]int)?\s*\{\s*([-\d]+)\s*,\s*([-\d]+)\s*\}\s*,\s*` +
			`Offset\s*:\s*(?:\[[0-9]+\]int)?\s*\{\s*([-\d]+)\s*,\s*([-\d]+)\s*\}`,
	)

	all := re.FindAllStringSubmatch(metricsBlock, -1)
	if len(all) != 256 {
		must(fmt.Errorf("expected 256 metric entries, got %d (pattern mismatch?)", len(all)))
	}

	metrics = make([]GlyphMetric, 256)
	for i := 0; i < 256; i++ {
		stepX := mustAtoi(all[i][1])
		w := mustAtoi(all[i][2])
		h := mustAtoi(all[i][3])
		offX := mustAtoi(all[i][4])
		offY := mustAtoi(all[i][5])

		if w > maxW {
			maxW = w
		}
		if h > maxH {
			maxH = h
		}

		metrics[i] = GlyphMetric{
			SX: 0, SY: 0,
			W: w, H: h,
			OffX: offX, OffY: offY,
			StepX: stepX,
		}
	}
	return metrics, maxW, maxH
}

func mustAtoi(s string) int {
	v, err := strconv.Atoi(s)
	must(err)
	return v
}

func extractNamedComposite(block string, name string) (string, error) {
	// Find "name:" then extract the following "{ ... }" (first composite literal)
	idx := strings.Index(block, name+":")
	if idx < 0 {
		return "", fmt.Errorf("could not find %s:", name)
	}
	rest := block[idx:]
	openRel := strings.Index(rest, "{")
	if openRel < 0 {
		return "", fmt.Errorf("could not find '{' for %s composite", name)
	}
	start := idx + openRel

	// brace match from start
	depth := 0
	for k := start; k < len(block); k++ {
		switch block[k] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return block[start : k+1], nil
			}
		}
	}
	return "", fmt.Errorf("unterminated composite for %s", name)
}

func mustPaintBitmaps(block string, metrics []GlyphMetric, img *image.NRGBA) {
	bmBlock, err := extractNamedComposite(block, "Bitmaps")
	must(err)

	// We need to iterate 256 glyph slices inside the outer composite.
	// We'll scan for the next '{' for each glyph and brace-match it.
	pos := 0
	// Find first '{' of outer block already at bmBlock[0] == '{'
	// We'll start scanning after the first '{' to find inner composites.
	if len(bmBlock) == 0 || bmBlock[0] != '{' {
		must(errors.New("bitmaps block malformed"))
	}
	pos = 1

	for glyph := 0; glyph < 256; glyph++ {
		// Find next '{' that starts this glyph's []uint32{...}
		open := strings.Index(bmBlock[pos:], "{")
		if open < 0 {
			must(fmt.Errorf("bitmaps: ran out of glyph entries at %d", glyph))
		}
		start := pos + open

		inner, end := braceMatch(bmBlock, start)
		pos = end

		// Parse uint32 literals inside inner
		rows := parseUint32Literals(inner)

		// Paint glyph bitmap into atlas
		g := metrics[glyph]
		if g.W <= 0 || g.H <= 0 {
			continue
		}
		sx := g.SX
		sy := g.SY

		// Fill pixels: MSB (bit 31) is leftmost column.
		// If your source uses LSB-left, flip the shift to (col) instead.
		for y := 0; y < g.H; y++ {
			var word uint32 = 0
			if y < len(rows) {
				word = rows[y]
			}
			py := sy + y
			for x := 0; x < g.W; x++ {
				bit := (word >> (31 - uint(x))) & 1
				if bit == 1 {
					px := sx + x
					setOpaqueWhite(img, px, py)
				}
			}
		}
	}
}

func braceMatch(s string, start int) (sub string, end int) {
	depth := 0
	for i := start; i < len(s); i++ {
		switch s[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return s[start : i+1], i + 1
			}
		}
	}
	must(errors.New("brace mismatch in inner composite"))
	return "", 0
}

func parseUint32Literals(inner string) []uint32 {
	// Extract tokens that look like 0x.... or decimal numbers.
	// inner includes braces; we just scan and parse.
	out := make([]uint32, 0, 32)

	// A tiny scanner: build tokens of [0-9a-fA-Fx]
	for i := 0; i < len(inner); {
		c := inner[i]
		if (c >= '0' && c <= '9') || c == 'x' || c == 'X' || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F') {
			j := i + 1
			for j < len(inner) {
				cc := inner[j]
				if (cc >= '0' && cc <= '9') || cc == 'x' || cc == 'X' || (cc >= 'a' && cc <= 'f') || (cc >= 'A' && cc <= 'F') {
					j++
				} else {
					break
				}
			}
			token := inner[i:j]
			// Skip lone "x" tokens (shouldn't happen)
			if token != "x" && token != "X" {
				v, err := strconv.ParseUint(token, 0, 32)
				if err == nil {
					out = append(out, uint32(v))
				}
			}
			i = j
			continue
		}
		i++
	}
	return out
}

func setOpaqueWhite(img *image.NRGBA, x, y int) {
	if !(image.Point{X: x, Y: y}.In(img.Rect)) {
		return
	}
	off := img.PixOffset(x, y)
	img.Pix[off+0] = 255
	img.Pix[off+1] = 255
	img.Pix[off+2] = 255
	img.Pix[off+3] = 255
}

// avoid unused import warning if color isn't used (kept for easy tweaks)
var _ = color.NRGBA{R: 255, G: 255, B: 255, A: 255}
GO

PNG_OUT="${OUT_DIR}/${VAR_NAME}.png"
JSON_OUT="${OUT_DIR}/${VAR_NAME}.json"

go run "${TMPDIR}/export_font.go" \
  -in "${GO_FILE}" \
  -var "${VAR_NAME}" \
  -png "${PNG_OUT}" \
  -json "${JSON_OUT}"

echo "Wrote:"
echo "  ${PNG_OUT}"
echo "  ${JSON_OUT}"
