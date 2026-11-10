#!/usr/bin/env bash
# 手元で確かめる：study/common/ の共通部品を入れた公開フォルダを作って、http://localhost:${PORT:-8765}/simulator/ で開く（PORT=8766 などで変えられる）
#   使い方: bash tools/serve.sh [study リポのフォルダ（既定 ../study）]
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
STUDY="${1:-$HERE/../study}"
OUT="${OUT:-/tmp/sim-pub}"
rm -rf "$OUT" && mkdir -p "$OUT/simulator" "$OUT/study"
cp -r "$HERE"/. "$OUT/simulator/" && rm -rf "$OUT/simulator/.git"
cp -r "$STUDY"/. "$OUT/study/" && rm -rf "$OUT/study/.git"
cp "$STUDY"/common/*.js "$STUDY"/common/*.css "$OUT/simulator/"
cd "$OUT" && exec python3 -m http.server "${PORT:-8765}"
