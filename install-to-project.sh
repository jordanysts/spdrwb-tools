#!/bin/bash

# SPDRWB AI Tools - Installation Script
# Usage: ./install-to-project.sh /path/to/your/nextjs-project

set -e

if [ -z "$1" ]; then
    echo "❌ Error: Please provide the path to your Next.js project"
    echo ""
    echo "Usage: ./install-to-project.sh /path/to/your/nextjs-project"
    echo ""
    echo "Example: ./install-to-project.sh ~/Desktop/my-nextjs-app"
    exit 1
fi

TARGET_DIR="$1"

if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ Error: Directory '$TARGET_DIR' does not exist"
    exit 1
fi

# Check if it looks like a Next.js project
if [ ! -f "$TARGET_DIR/package.json" ]; then
    echo "⚠️  Warning: No package.json found. Are you sure this is a Next.js project?"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🕸️  SPDRWB AI Tools Installer"
echo "=============================="
echo ""
echo "Source: $SCRIPT_DIR"
echo "Target: $TARGET_DIR"
echo ""

# Create directories if they don't exist
echo "📁 Creating directories..."
mkdir -p "$TARGET_DIR/app/tools"
mkdir -p "$TARGET_DIR/app/api/tools"
mkdir -p "$TARGET_DIR/components/tools"
mkdir -p "$TARGET_DIR/lib"
mkdir -p "$TARGET_DIR/public"

# Copy files
echo "📋 Copying tool pages..."
cp -r "$SCRIPT_DIR/app/tools/"* "$TARGET_DIR/app/tools/"

echo "📋 Copying API routes..."
cp -r "$SCRIPT_DIR/app/api/tools/"* "$TARGET_DIR/app/api/tools/"

echo "📋 Copying components..."
cp "$SCRIPT_DIR/components/SpiderWebIcon.tsx" "$TARGET_DIR/components/" 2>/dev/null || true
cp -r "$SCRIPT_DIR/components/tools/"* "$TARGET_DIR/components/tools/"

echo "📋 Copying utilities..."
cp "$SCRIPT_DIR/lib/image-compression.ts" "$TARGET_DIR/lib/"

echo "📋 Copying public assets..."
cp "$SCRIPT_DIR/public/"* "$TARGET_DIR/public/" 2>/dev/null || true

echo ""
echo "✅ Files copied successfully!"
echo ""
echo "📦 Next steps:"
echo ""
echo "1. Install dependencies:"
echo "   cd $TARGET_DIR"
echo "   npm install @google/genai @google/generative-ai @runwayml/sdk replicate react-compare-slider react-dropzone react-easy-crop framer-motion lucide-react"
echo ""
echo "2. Add environment variables to .env.local:"
echo "   GOOGLE_GENAI_API_KEY=your_key"
echo "   REPLICATE_API_TOKEN=your_token"
echo "   RUNWAY_API_KEY=your_key"
echo "   ELEVENLABS_API_KEY=your_key"
echo ""
echo "3. Navigate to /tools to see your AI Tools hub!"
echo ""
echo "🕸️  Happy building!"
