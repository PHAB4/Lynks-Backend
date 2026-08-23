# test_new_features.ps1
# Paste your actual JWT token here (from create_test_user.py output)
$TOKEN = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjI2ZmQ2NjgxLTliZDItNGE4Yy05NGY4LWVlMWJkYzUwMzRjZSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3FjeXh5dW5uZ2JrdXB0dGN3bGJrLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIxY2VkNjdjZi1lMDVmLTQwOWItOWQ5MS05YjI2OWMxOGYyZmMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzg3NDU3MzMxLCJpYXQiOjE3ODc0NTM3MzEsImVtYWlsIjoidGVzdHVzZXJfMTc4NzQ1MzcyOUBseW5rcy5kZXYiLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoidGVzdHVzZXJfMTc4NzQ1MzcyOUBseW5rcy5kZXYiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiIxY2VkNjdjZi1lMDVmLTQwOWItOWQ5MS05YjI2OWMxOGYyZmMifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc4NzQ1MzczMX1dLCJzZXNzaW9uX2lkIjoiMGFhNzc4ZjItYjAwYi00NzcxLWI3YjItYTI5ZThiM2ZmM2FjIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.KNFWxCbeTCFo36WRYw1O4GmUnvLQBlwQLrpa7vl1-zDcflhzr2cjtScDSKOEDTIL3c-Oz6P_UOHOcbPjVG7Vs"
$headers = @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" }
# Make sure server is running first, then:
Write-Host "`n=== 1. Resume Generate ===" -ForegroundColor Cyan
try {
    $resume = Invoke-RestMethod -Uri "http://localhost:8000/resume/generate" -Method POST -Headers $headers -TimeoutSec 60
    $resume | ConvertTo-Json -Depth 5
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}
Write-Host "`n=== 2. Enhanced Mentor (roadmap context) ===" -ForegroundColor Cyan
try {
    $chat = Invoke-RestMethod -Uri "http://localhost:8000/chat/message" -Method POST -Headers $headers -Body (@{ message = "What is my current progress on my roadmap?" } | ConvertTo-Json) -TimeoutSec 60
    Write-Host "Response: $($chat.response)" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}
Write-Host "`n=== 3. Expanded Opportunities ===" -ForegroundColor Cyan
try {
    $opps = Invoke-RestMethod -Uri "http://localhost:8000/opportunities" -Method GET -Headers $headers -TimeoutSec 120
    Write-Host "Found $($opps.Count) opportunities" -ForegroundColor Green
    $opps | ForEach-Object { Write-Host "  - $($_.title) [$($_.category)] $($_.country)" }
} catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
}
Write-Host "`nDone!" -ForegroundColor Cyan