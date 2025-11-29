# PowerShell script to start server with port cleanup
# Usage: .\scripts\start-server.ps1

param(
    [int]$Port = 3001
)

Write-Host "🚀 Starting server..." -ForegroundColor Cyan

# Kill any existing processes on the port
& "$PSScriptRoot\kill-port.ps1" -Port $Port

# Wait a moment for port to be released
Start-Sleep -Seconds 1

# Start the server
Write-Host "`n📦 Starting Node.js server..." -ForegroundColor Cyan
npm run server


