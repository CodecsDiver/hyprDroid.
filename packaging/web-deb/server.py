#!/usr/bin/env python3
"""Serves the installed Python Discovery web app on localhost only.

Usage: server.py [port] [directory]. Exits quietly if the port is already taken, so it is safe to
start from several places (login autostart, the launcher) without ever running two copies.
"""
import functools
import http.server
import mimetypes
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
ROOT = sys.argv[2] if len(sys.argv) > 2 else "/usr/share/python-discovery-web/app"

for extension, content_type in {
    ".wasm": "application/wasm",
    ".mjs": "text/javascript",
    ".js": "text/javascript",
    ".webmanifest": "application/manifest+json",
}.items():
    mimetypes.add_type(content_type, extension)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # The service worker handles offline caching; the browser must always revalidate with this server.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, format, *args):
        pass


try:
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler, directory=ROOT))
except OSError:
    sys.exit(0)
server.serve_forever()
