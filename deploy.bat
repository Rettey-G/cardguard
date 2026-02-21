@echo off
echo === CardGuard Quick Deploy Script ===
echo.

REM Check if git is initialized
if not exist ".git" (
    echo Initializing git repository...
    git init
    git add .
    git commit -m "Initial commit: CardGuard with mobile navigation and cloud database support"
    echo.
    echo ⚠️  IMPORTANT: Next steps:
    echo 1. Create a new repository on GitHub: https://github.com/new
    echo 2. Run: git remote add origin https://github.com/YOUR_USERNAME/cardguard.git
    echo 3. Run: git push -u origin main
    echo 4. Go to https://vercel.com and import your repository
    echo 5. Click 'Deploy' - that's it!
) else (
    echo Git repository already exists.
    echo Adding changes and committing...
    git add .
    git commit -m "Add mobile navigation and Vercel Postgres support"
    echo.
    echo ✅ Ready to deploy!
    echo 1. Run: git push
    echo 2. Go to https://vercel.com and import your repository
    echo 3. Click 'Deploy'
)

echo.
echo 📱 After deployment, your app will have:
echo    - Mobile-friendly navigation
echo    - Free cloud database (Vercel Postgres)
echo    - OCR card scanning
echo    - PWA support (install as app)
echo.
pause
