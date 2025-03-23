#!/bin/bash

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# Configuration
API_PORT=8000
UI_PORT=8001  # Changed to different port
WORKSPACE_DIR="/project/sandbox/user-workspace"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_python() {
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is required but not installed."
        exit 1
    fi
    log_info "Python 3 is installed: $(python3 --version)"
}

check_required_files() {
    if [ ! -f "poe-api-wrapper/poe_api_wrapper/openai/secrets.json" ]; then
        log_error "secrets.json not found"
        exit 1
    fi
    
    if [ ! -f "poe-api-wrapper/poe_api_wrapper/openai/models.json" ]; then
        log_error "models.json not found"
        exit 1
    fi
    
    log_info "All required files are present"
}

install_dependencies() {
    log_info "Installing required Python packages..."
    cd poe-api-wrapper
    pip install -e . >/dev/null 2>&1
    pip install httpx fastapi uvicorn tiktoken nltk orjson >/dev/null 2>&1
    
    # Download required NLTK data
    python3 -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')" >/dev/null 2>&1
    cd ..
    log_info "Dependencies installed successfully"
}

kill_existing_server() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        log_warn "Port $port is in use. Attempting to free it..."
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

start_api_server() {
    log_info "Starting Poe API server on port $API_PORT..."
    cd poe-api-wrapper
    python3 -m uvicorn poe_api_wrapper.openai.api:app --host 127.0.0.1 --port $API_PORT &
    API_PID=$!
    sleep 3  # Give the server time to start
    cd ..
    
    # Check if server started successfully
    if ! curl -s "http://127.0.0.1:$API_PORT/v1/models" > /dev/null 2>&1; then
        log_error "Failed to start API server"
        exit 1
    fi
    log_info "API server started successfully"
}

serve_webui() {
    log_info "Starting Web UI server..."
    cd webui
    # Create a simple Python HTTP server
    cat > server.py << 'EOL'
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
EOL

    python3 server.py &
    UI_PID=$!
    sleep 2  # Give the server time to start
    cd ..
    log_info "Web UI server started successfully"
}

cleanup() {
    log_info "Cleaning up..."
    if [[ -v API_PID ]]; then
        kill $API_PID 2>/dev/null || true
    fi
    if [[ -v UI_PID ]]; then
        kill $UI_PID 2>/dev/null || true
    fi
    rm -f webui/server.py
}

main() {
    # Print banner
    echo -e "${GREEN}"
    cat << "EOF"
    ____              _____           _     
   |  _ \ ___   ___  |_   _|__   ___ | |___ 
   | |_) / _ \ / _ \   | |/ _ \ / _ \| / __|
   |  __/ (_) | (_) |  | | (_) | (_) | \__ \
   |_|   \___/ \___/   |_|\___/ \___/|_|___/
                                            
EOF
    echo -e "${NC}"

    # Setup trap for cleanup
    trap cleanup EXIT

    # Check requirements
    log_info "Checking requirements..."
    check_python
    check_required_files

    # Install dependencies
    install_dependencies

    # Kill any existing processes on our ports
    kill_existing_server $API_PORT
    kill_existing_server $UI_PORT

    # Start servers
    start_api_server
    serve_webui

    log_info "Setup complete!"
    log_info "API server running at http://127.0.0.1:$API_PORT"
    log_info "Web UI available at http://127.0.0.1:$UI_PORT"
    log_info "Press Ctrl+C to stop the servers"

    # Keep script running
    wait
}

main