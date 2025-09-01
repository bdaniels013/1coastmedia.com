#!/bin/bash

echo "🚀 Starting 1CoastMedia Server..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm found"
echo ""

# Navigate to server directory
cd server

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🌐 Starting server on port 3000..."
echo "📱 Admin panel: http://localhost:3000/admin.html"
echo "🌍 Main site: http://localhost:3000/index.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm start
