#!/bin/sh
# Startet Neon Nights Casino im Standardbrowser (Linux)
DIR="$(cd "$(dirname "$0")" && pwd)"
xdg-open "$DIR/index.html" 2>/dev/null || sensible-browser "$DIR/index.html"
