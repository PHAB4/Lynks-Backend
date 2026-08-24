# Run this to get a fresh JWT token
# Usage: .\tests\get_token.ps1

$envFile = Get-Content ".env" | ForEach-Object {
    if ($_ -match "^([^#=]+)=(.+)$") {
        @{ Name = $Matches[1].Trim(); Value = $Matches[2].Trim() }
    }
}

$supabaseUrl = ($envFile | Where-Object { $_.Name -eq "SUPABASE_URL" }).Value
$anonKey = ($envFile | Where-Object { $_.Name -eq "SUPABASE_ANON_KEY" }).Value
$email = ($envFile | Where-Object { $_.Name -eq "TEST_EMAIL" }).Value
$password = ($envFile | Where-Object { $_.Name -eq "TEST_PASSWORD" }).Value

if (-not $email -or -not $password) {
    Write-Host "Add TEST_EMAIL and TEST_PASSWORD to your .env first" -ForegroundColor Red
    Write-Host "Example:" -ForegroundColor Yellow
    Write-Host "  TEST_EMAIL=test@lynks.com" -ForegroundColor Gray
    Write-Host "  TEST_PASSWORD=TestPassword123!" -ForegroundColor Gray
    exit 1
}

$body = @{ email = $email; password = $password } | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$supabaseUrl/auth/v1/token?grant_type=password" `
    -Method Post `
    -Headers @{ "apikey" = $anonKey; "Content-Type" = "application/json" } `
    -Body $body

$token = $response.access_token

# Save to .env
$envContent = Get-Content ".env" -Raw
if ($envContent -match "JWT_TOKEN=") {
    $envContent = $envContent -replace "JWT_TOKEN=.*", "JWT_TOKEN=$token"
} else {
    $envContent += "`nJWT_TOKEN=$token"
}
$envContent | Set-Content ".env"

Write-Host "Fresh JWT saved to .env" -ForegroundColor Green
Write-Host "Token (first 50 chars): $($token.Substring(0, [Math]::Min(50, $token.Length)))..." -ForegroundColor Cyan
