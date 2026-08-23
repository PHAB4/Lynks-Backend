# test_new_features.ps1
# Reads JWT_TOKEN from .env file automatically

# Read .env file from project root (backend/)
$envPath = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "Loaded .env from $envPath" -ForegroundColor DarkGray
} else {
    Write-Host "WARNING: .env not found at $envPath" -ForegroundColor Yellow
}

$TOKEN = $env:JWT_TOKEN
if (-not $TOKEN) {
    Write-Host "Set JWT_TOKEN in your .env file to run these tests." -ForegroundColor Red
    exit 1
}

$HEADERS = @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" }

Write-Host "`n=============================" -ForegroundColor Cyan
Write-Host "   Lynks Feature Tests" -ForegroundColor Cyan
Write-Host "===============================`n" -ForegroundColor Cyan

# 1. Resume Generate
Write-Host "==== 1. Resume Generate ====" -ForegroundColor Green
try {
    $resume = Invoke-RestMethod -Uri "http://localhost:8000/resume/generate" -Method POST -Headers $HEADERS -Body (@{} | ConvertTo-Json -Depth 5) -TimeoutSec 60
    $resume | ConvertTo-Json -Depth 5
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}

# 2. Enhanced Mentor (with roadmap context)
Write-Host "`n==== 2. Enhanced Mentor (roadmap context) ====" -ForegroundColor Green
try {
    $chat = Invoke-RestMethod -Uri "http://localhost:8000/chat/message" -Method POST -Headers $HEADERS -Body (@{ message = "What is my current progress on my roadmap?" } | ConvertTo-Json -Depth 5) -TimeoutSec 60
    Write-Host "Response: $($chat.response)" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}

# 3. Expanded Opportunities
Write-Host "`n==== 3. Expanded Opportunities ====" -ForegroundColor Green
try {
    $opps = Invoke-RestMethod -Uri "http://localhost:8000/opportunities" -Method GET -Headers $HEADERS -TimeoutSec 120
    Write-Host "Found $($opps.Count) opportunities" -ForegroundColor Green
    $opps | ForEach-Object { Write-Host "  - $($_.title) [$($_.category)] - $($_.country)" }
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}

Write-Host "`nDone!" -ForegroundColor Cyan
