#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
GTFS_DIR="$ROOT_DIR/data/gtfs"
OSM_DIR="$ROOT_DIR/data/osm"
GRAPH_DIR="$ROOT_DIR/graphs/idf"
IMAGE="ghcr.io/opentripplanner/opentripplanner:v2.3.0"
MEMORY="${OTP_GRAPH_BUILD_MEMORY:-6G}"

if [[ ! -d "$GTFS_DIR" ]] || [[ -z $(ls -A "$GTFS_DIR" 2>/dev/null) ]]; then
  echo "No GTFS data found in $GTFS_DIR. Run fetch_gtfs_idfm.sh first." >&2
  exit 1
fi

if [[ ! -f "$OSM_DIR/ile-de-france-latest.osm.pbf" ]]; then
  echo "OSM extract missing in $OSM_DIR. Run fetch_osm_idf.sh first." >&2
  exit 1
fi

mkdir -p "$GRAPH_DIR"

echo "Building OTP graph into $GRAPH_DIR using $IMAGE ..."
docker run --rm \
  -v "$GTFS_DIR:/var/otp/gtfs:ro" \
  -v "$OSM_DIR:/var/otp/osm:ro" \
  -v "$GRAPH_DIR:/var/otp/graphs" \
  -e JAVA_OPTIONS="-Xmx$MEMORY" \
  "$IMAGE" \
  --build --save --serve false --router idf

echo "Graph build complete."
