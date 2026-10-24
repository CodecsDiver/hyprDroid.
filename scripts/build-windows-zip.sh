#!/usr/bin/env bash
# Builds release/python-discovery-windows_<version>.zip from dist-web (run `pnpm build:web` first).
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
[ -f dist-web/index.html ] || { echo "dist-web is missing. Run: pnpm build:web" >&2; exit 1; }
command -v zip >/dev/null || { echo "zip is required" >&2; exit 1; }

version="$(node -p "require('./package.json').version")"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
folder="$stage/Python Discovery"
mkdir -p "$folder"
cp -r dist-web "$folder/app"
cp "packaging/windows/server.ps1" "packaging/windows/README.txt" "$folder/"
# Windows batch files need CRLF line endings.
sed 's/$/\r/' "packaging/windows/Start Python Discovery.bat" > "$folder/Start Python Discovery.bat"
sed -i 's/$/\r/' "$folder/server.ps1" "$folder/README.txt"
mkdir -p release
output="$root/release/python-discovery-windows_${version}.zip"
rm -f "$output"
(cd "$stage" && zip -qr "$output" "Python Discovery")
echo "Built release/python-discovery-windows_${version}.zip"
