#!/bin/bash
# Test script for Windows compatibility

echo "Testing Windows compatibility..."
echo "Current directory: $(pwd)"
echo "Script location: $0"

# Determine output directory based on platform
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows with Git Bash - use absolute path
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    OUTPUT_DIR="$SCRIPT_DIR/../data"
else
    # Unix/Linux
    OUTPUT_DIR="/tmp/soc_data"
fi

echo "Output directory: $OUTPUT_DIR"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate simple test data
cat > "$OUTPUT_DIR/test_output.json" << EOF
{
  "test_status": "success",
  "timestamp": "$(date -Iseconds)",
  "platform": "windows",
  "bash_version": "$(bash --version | head -n1)",
  "output_dir": "$OUTPUT_DIR",
  "script_dir": "$SCRIPT_DIR"
}
EOF

echo "Test completed successfully!"
echo "Generated test file: $OUTPUT_DIR/test_output.json" 