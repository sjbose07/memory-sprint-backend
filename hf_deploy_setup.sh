#!/bin/bash

# Configuration
BACKEND_DIR="d:/ANTIGRAVITY/AGENTS/backend"
HF_DIR="d:/ANTIGRAVITY/AGENTS/hf-deployment"

echo "Step 1: Cleaning deployment directory..."
rm -rf "$HF_DIR"/*

echo "Step 2: Copying backend files..."
# Copy source files
cp -r "$BACKEND_DIR/src" "$HF_DIR/src"
# Copy configuration and dependency files
cp "$BACKEND_DIR/package.json" "$HF_DIR/"
cp "$BACKEND_DIR/package-lock.json" "$HF_DIR/"
cp "$BACKEND_DIR/Dockerfile" "$HF_DIR/"
cp "$BACKEND_DIR/.dockerignore" "$HF_DIR/"
echo "Step 3: Checking for .gitignore in deployment folder..."
if [ ! -f "$HF_DIR/.gitignore" ]; then
    echo "node_modules/" > "$HF_DIR/.gitignore"
    echo ".env" >> "$HF_DIR/.gitignore"
fi

echo "Backend files prepared in $HF_DIR"
