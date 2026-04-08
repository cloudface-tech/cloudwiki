#!/bin/bash
# Generate favicon PNGs from SVG logo

set -e

# Source SVG file
SVG="ux/public/_assets/logo-cloudwiki.svg"

# Output directory
OUTPUT_DIR="ux/public/_assets"

# Check if SVG exists
if [ ! -f "$SVG" ]; then
    echo "Error: SVG file not found at $SVG"
    exit 1
fi

# Check if rsvg-convert is available
if ! command -v rsvg-convert &> /dev/null; then
    echo "Error: rsvg-convert is not installed"
    echo "Install librsvg: apt-get install librsvg2-bin (Debian/Ubuntu) or brew install librsvg (macOS)"
    exit 1
fi

# Generate favicon PNGs at different sizes
echo "Generating favicons from $SVG..."

rsvg-convert -w 16 -h 16 "$SVG" -o "$OUTPUT_DIR/favicon-16.png"
echo "Generated: $OUTPUT_DIR/favicon-16.png"

rsvg-convert -w 32 -h 32 "$SVG" -o "$OUTPUT_DIR/favicon-32.png"
echo "Generated: $OUTPUT_DIR/favicon-32.png"

rsvg-convert -w 48 -h 48 "$SVG" -o "$OUTPUT_DIR/favicon-48.png"
echo "Generated: $OUTPUT_DIR/favicon-48.png"

echo "Favicons generated successfully"
