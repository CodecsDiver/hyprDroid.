#!/usr/bin/env bash
# Serves the Python Discovery PWA on localhost (service workers need localhost or HTTPS) and opens it.
# Works from the repo (serves ./dist-web) or from the unzipped release (serves its own folder).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$here"
for candidate in "$here/dist-web" "$here/../dist-web"; do
  [ -f "$candidate/index.html" ] && root="$(cd "$candidate" && pwd)" && break
done
[ -f "$root/index.html" ] || { echo "No built app found. Run: pnpm build:web" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required to serve the app" >&2; exit 1; }

port="${PORT:-4173}"
url="http://localhost:${port}/"
echo "Python Discovery -> ${url}  (Ctrl+C to stop; install it from the browser's address bar)"
(sleep 1; xdg-open "$url" >/dev/null 2>&1 || true) &

exec python3 - "$root" "$port" <<'PY'
import functools, http.server, mimetypes, sys

root, port = sys.argv[1], int(sys.argv[2])
for extension, content_type in {
    ".wasm": "application/wasm",
    ".mjs": "text/javascript",
    ".js": "text/javascript",
    ".webmanifest": "application/manifest+json",
}.items():
    mimetypes.add_type(content_type, extension)

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

handler = functools.partial(Handler, directory=root)
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
PY
