#!/usr/bin/env python3
"""Local dev server that never lets the browser cache.

python's http.server sends Last-Modified but no Cache-Control and no ETag, so
browsers fall back to heuristic caching and will happily render new HTML against
a stale stylesheet. This sends no-store on everything.

    python3 tools/serve.py [port]
"""
import functools, http.server, os, socketserver, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "304" not in (args[1] if len(args) > 1 else ""):
            super().log_message(fmt, *args)

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(NoCache, directory=ROOT)
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        print(f"serving {ROOT} on http://127.0.0.1:{port} (no-store)")
        httpd.serve_forever()
