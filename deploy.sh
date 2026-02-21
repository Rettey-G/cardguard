#!/bin/bash

echo ""
echo "========================================"
echo "        CardGuard Deployment"
echo "========================================"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "Initializing Git repository..."
    git init
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Add all changes
echo "Adding changes to Git..."
git add .

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "No changes to commit."
    echo ""
    echo "Your app is already up to date!"
    echo ""
    echo "Open your app at: https://cardguard-8q41.vercel.app/"
    echo ""
    exit 0
fi

# Get commit message from user or use default
echo "Enter commit message (or press Enter for default):"
read commit_msg
if [ -z "$commit_msg" ]; then
    commit_msg="Update CardGuard app"
fi

# Commit changes
echo "Committing changes..."
git commit -m "$commit_msg"

# Push to GitHub
echo ""
echo "Pushing to GitHub..."
git push

echo ""
echo "========================================"
echo "         Deployment Complete!"
echo "========================================"
echo ""
echo "✅ Your changes have been deployed!"
echo ""
echo "🌐 Your app will be live in 1-2 minutes at:"
echo "   https://cardguard-8q41.vercel.app/"
echo ""
echo "📱 You can also open it on your phone!"
echo ""
echo "📝 What was deployed:"
git log --oneline -1
echo ""
echo "🔄 If you don't see changes, wait 2 minutes"
echo "   then refresh the page."
echo ""
