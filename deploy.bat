@echo off
echo.
echo ========================================
echo         CardGuard Deployment
echo ========================================
echo.

REM Check if git is initialized
if not exist ".git" (
    echo Initializing Git repository...
    git init
    echo.
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    echo.
)

REM Add all changes
echo Adding changes to Git...
git add .

REM Check if there are changes to commit
git diff --cached --quiet
if %errorlevel% equ 0 (
    echo No changes to commit.
    echo.
    echo Your app is already up to date!
    echo.
    echo Open your app at: https://cardguard-8q41.vercel.app/
    echo.
    pause
    exit /b 0
)

REM Get commit message from user or use default
set /p commit_msg="Enter commit message (or press Enter for default): "
if "%commit_msg%"=="" set commit_msg=Update CardGuard app

REM Commit changes
echo Committing changes...
git commit -m "%commit_msg%"

REM Push to GitHub
echo.
echo Pushing to GitHub...
git push

echo.
echo ========================================
echo           Deployment Complete!
echo ========================================
echo.
echo ✅ Your changes have been deployed!
echo.
echo 🌐 Your app will be live in 1-2 minutes at:
echo    https://cardguard-8q41.vercel.app/
echo.
echo 📱 You can also open it on your phone!
echo.
echo 📝 What was deployed:
git log --oneline -1
echo.
echo 🔄 If you don't see changes, wait 2 minutes
echo    then refresh the page.
echo.
pause
