@echo off
echo ========================================
echo Starting PPN Karangantu Backend Server
echo ========================================
echo.

cd /d "%~dp0"

echo Checking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Node.js found: 
node -v
echo npm version:
npm -v
echo.

if not exist "node_modules\" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
    echo.
)

echo Starting server on port 8080...
echo.
echo Backend API will be available at: http://127.0.0.1:8080
echo Open your browser and go to: http://127.0.0.1:8080/register.html
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

node server.js
