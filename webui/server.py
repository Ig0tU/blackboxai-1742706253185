import http.server
import socketserver

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

Handler = CORSRequestHandler
Handler.extensions_map.update({
    '.js': 'application/javascript',
})

httpd = socketserver.TCPServer(("127.0.0.1", 8001), Handler)
httpd.serve_forever()
