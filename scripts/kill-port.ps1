# PowerShell script to kill process on port 3001
# Usage: .\scripts\kill-port.ps1 [port]

param(
    [int]$Port = 3001
)

Write-Host "🔍 Checking for processes on port $Port..." -ForegroundColor Cyan

# Find processes using the port
$connections = netstat -ano | Select-String ":$Port" | Select-String "LISTENING"

if ($connections) {
    $pids = @()
    foreach ($line in $connections) {
        $parts = $line -split '\s+'
        $pid = $parts[-1]
        if ($pid -and $pid -ne '0') {
            $pids += $pid
        }
    }
    
    $uniquePids = $pids | Sort-Object -Unique
    
    if ($uniquePids.Count -gt 0) {
        Write-Host "⚠️  Found $($uniquePids.Count) process(es) using port $Port" -ForegroundColor Yellow
        foreach ($pid in $uniquePids) {
            try {
                $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Host "   Killing process: $($process.ProcessName) (PID: $pid)" -ForegroundColor Yellow
                    Stop-Process -Id $pid -Force -ErrorAction Stop
                    Write-Host "   ✅ Process $pid terminated" -ForegroundColor Green
                }
            } catch {
                Write-Host "   ⚠️  Failed to kill process $pid : $_" -ForegroundColor Red
            }
        }
        Start-Sleep -Seconds 1
        Write-Host "✅ Port $Port is now free" -ForegroundColor Green
    } else {
        Write-Host "✅ No processes found on port $Port" -ForegroundColor Green
    }
} else {
    Write-Host "✅ Port $Port is free" -ForegroundColor Green
}


