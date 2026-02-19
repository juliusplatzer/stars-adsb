#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 videomaps/<name>.gob.zst" >&2
  exit 2
fi

IN="$1"
if [[ "${IN}" != videomaps/*\.gob\.zst ]]; then
  echo "error: input must be in videomaps/ and end with .gob.zst" >&2
  exit 2
fi
if [[ ! -f "${IN}" ]]; then
  echo "error: file not found: ${IN}" >&2
  exit 1
fi
command -v zstd >/dev/null 2>&1 || { echo "error: zstd not found. Install: brew install zstd" >&2; exit 1; }

OUT="${IN%.gob.zst}.json"

TMPDIR="$(mktemp -d)"
cleanup() { rm -rf "${TMPDIR}"; }
trap cleanup EXIT

cat > "${TMPDIR}/main.go" <<'EOF'
package main

import (
	"encoding/gob"
	"encoding/json"
	"fmt"
	"os"
)

// vice math.Point2LL: [lon, lat]
type Point2LL [2]float32

type VideoMap struct {
	Label       string
	Group       int
	Name        string
	Id          int
	Category    int
	Restriction struct {
		Id        int
		Text      [2]string
		TextBlink bool
		HideText  bool
	}
	Color int
	Lines [][]Point2LL
}

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: go run main.go <out.json>  (reads gob from stdin)")
		os.Exit(2)
	}
	outPath := os.Args[1]

	dec := gob.NewDecoder(os.Stdin)
	var maps []VideoMap
	if err := dec.Decode(&maps); err != nil {
		fmt.Fprintf(os.Stderr, "gob decode: %v\n", err)
		os.Exit(1)
	}

	f, err := os.Create(outPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "create output: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(maps); err != nil {
		fmt.Fprintf(os.Stderr, "json encode: %v\n", err)
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "wrote %d maps to %s\n", len(maps), outPath)
}
EOF

# stream: zstd -> gob decoder (stdin) -> json file
zstd -dc "${IN}" | go run "${TMPDIR}/main.go" "${OUT}"

echo "OK: ${OUT}"
