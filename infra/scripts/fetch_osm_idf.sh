#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)/data/osm"
mkdir -p "$DATA_DIR"

OSM_URL="https://download.geofabrik.de/europe/france/ile-de-france-latest.osm.pbf"
OUTPUT_FILE="$DATA_DIR/ile-de-france-latest.osm.pbf"

if [[ -f "$OUTPUT_FILE" ]]; then
  echo "[fetch_osm_idf] Existing file detected at $OUTPUT_FILE. Overwrite? [y/N]"
  read -r answer
  if [[ ! "$answer" =~ ^[Yy]$ ]]; then
    echo "Skipping download."
    exit 0
  fi
fi

echo "Downloading OSM extract from $OSM_URL ..."
curl -L "$OSM_URL" -o "$OUTPUT_FILE"

echo "OSM extract saved to $OUTPUT_FILE"
