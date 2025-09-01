#!/bin/bash

echo "🚀 Preparing 1CoastMedia for live deployment..."
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📁 Initializing git repository..."
    git init
    echo ""
fi

# Check git status
echo "📊 Git status:"
git status --short
echo ""

# Add all files
echo "📦 Adding all files to git..."
git add .
echo ""

# Commit changes
echo "💾 Committing changes..."
git commit -m "Ready for production deployment - $(date)"
echo ""

# Check if remote exists
if ! git remote get-url origin &> /dev/null; then
    echo "🔗 No remote repository configured."
    echo ""
    echo "To deploy to Render.com or Railway:"
    echo "1. Create a new repository on GitHub.com"
    echo "2. Copy the repository URL"
    echo "3. Run: git remote add origin YOUR_REPO_URL"
    echo "4. Run: git push -u origin main"
    echo ""
    echo "Then follow the deployment guide in DEPLOYMENT.md"
else
    echo "🔗 Remote repository found:"
    git remote get-url origin
    echo ""
    echo "📤 Pushing to remote repository..."
    git push origin main
    echo ""
    echo "✅ Ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Go to render.com or railway.app"
    echo "2. Connect your GitHub repository"
    echo "3. Deploy as a Node.js web service"
    echo "4. Get your live URL!"
    echo ""
    echo "See DEPLOYMENT.md for detailed instructions."
fi

echo ""
echo "🎯 Your site will be live at: https://your-app-name.onrender.com"
echo "📱 Admin panel: https://your-app-name.onrender.com/admin.html"
