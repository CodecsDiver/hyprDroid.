#!/usr/bin/env bash
# Builds release/python-discovery-web_<version>_all.deb from dist-web (run `pnpm build:web` first).
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
[ -f dist-web/index.html ] || { echo "dist-web is missing. Run: pnpm build:web" >&2; exit 1; }
command -v dpkg-deb >/dev/null || { echo "dpkg-deb is required" >&2; exit 1; }

version="$(node -p "require('./package.json').version")"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
pkg="$stage/python-discovery-web_${version}_all"

install -d "$pkg/DEBIAN" "$pkg/usr/bin" "$pkg/usr/lib/python-discovery-web" "$pkg/usr/share/python-discovery-web" \
  "$pkg/usr/share/applications" "$pkg/etc/xdg/autostart" "$pkg/usr/share/icons/hicolor/512x512/apps" \
  "$pkg/usr/share/icons/hicolor/192x192/apps"
cp -r dist-web "$pkg/usr/share/python-discovery-web/app"
install -m 0755 packaging/web-deb/python-discovery-web "$pkg/usr/bin/python-discovery-web"
install -m 0755 packaging/web-deb/server.py "$pkg/usr/lib/python-discovery-web/server.py"
install -m 0644 packaging/web-deb/python-discovery-web.desktop "$pkg/usr/share/applications/python-discovery-web.desktop"
install -m 0644 packaging/web-deb/python-discovery-web-server.desktop "$pkg/etc/xdg/autostart/python-discovery-web-server.desktop"
install -m 0644 public/icons/icon-512.png "$pkg/usr/share/icons/hicolor/512x512/apps/python-discovery-web.png"
install -m 0644 public/icons/icon-192.png "$pkg/usr/share/icons/hicolor/192x192/apps/python-discovery-web.png"

cat > "$pkg/DEBIAN/control" <<CONTROL
Package: python-discovery-web
Version: ${version}
Architecture: all
Maintainer: pythondiscovery
Priority: optional
Section: education
Depends: python3
Recommends: chromium | chromium-browser | google-chrome-stable | brave-browser
Description: Python Discovery as an installable offline web app (PWA)
 Serves the Python Discovery web app on localhost:4173 and adds a launcher.
 Install it once from a Chromium-based browser; after that the app runs
 offline, and installing a newer version of this package updates it.
CONTROL

cat > "$pkg/DEBIAN/postinst" <<'POSTINST'
#!/bin/sh
set -e
# Stop any running copy so the next launch serves the new files and server.
pkill -f '[p]ython-discovery-web/server.py' 2>/dev/null || true
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q /usr/share/applications || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t /usr/share/icons/hicolor 2>/dev/null || true
exit 0
POSTINST
cat > "$pkg/DEBIAN/prerm" <<'PRERM'
#!/bin/sh
set -e
pkill -f '[p]ython-discovery-web/server.py' 2>/dev/null || true
exit 0
PRERM
chmod 0755 "$pkg/DEBIAN/postinst" "$pkg/DEBIAN/prerm"

mkdir -p release
dpkg-deb --root-owner-group --build "$pkg" "release/python-discovery-web_${version}_all.deb" >/dev/null
echo "Built release/python-discovery-web_${version}_all.deb"
