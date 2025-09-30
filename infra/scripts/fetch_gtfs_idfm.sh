#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)/data/gtfs"
mkdir -p "$DATA_DIR"

GTFS_URL="https://transitfeeds.maas.global/gtfs/ile-de-france-mobilites/latest.zip"
OUTPUT_FILE="$DATA_DIR/idfm_gtfs_latest.zip"

if [[ -f "$OUTPUT_FILE" ]]; then
  echo "[fetch_gtfs_idfm] Existing file detected at $OUTPUT_FILE. Overwrite? [y/N]"
  read -r answer
  if [[ ! "$answer" =~ ^[Yy]$ ]]; then
    echo "Skipping download."
    exit 0
  fi
fi

echo "Downloading GTFS from $GTFS_URL ..."
curl -L "$GTFS_URL" -o "$OUTPUT_FILE"

echo "GTFS saved to $OUTPUT_FILE"
