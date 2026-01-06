$ErrorActionPreference = "Stop"

Write-Host "=== Repository Migration Script ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "git@github.com:MateuszBorsuk2001"

Write-Host "Step 1: Migrating Directus repository..." -ForegroundColor Yellow
Set-Location "directus"
if (git remote get-url origin 2>$null) {
    git remote rename origin old-origin
    Write-Host "  Renamed old origin to old-origin" -ForegroundColor Green
}
git remote add origin "$baseUrl/Mbor_Mrg_directus.git"
Write-Host "  Added new origin: Mbor_Mrg_directus" -ForegroundColor Green
Write-Host "  Please run: git push -u origin master" -ForegroundColor Cyan
Set-Location ".."

Write-Host ""
Write-Host "Step 2: Migrating n8n repository..." -ForegroundColor Yellow
Set-Location "n8n"
if (-not (Test-Path ".git")) {
    git init
    Write-Host "  Initialized git repository" -ForegroundColor Green
}
git add .
git commit -m "Initial commit: n8n workflow automation" 2>&1 | Out-Null
git remote add origin "$baseUrl/Mbor_Mrg_n8n.git"
Write-Host "  Added origin: Mbor_Mrg_n8n" -ForegroundColor Green
Write-Host "  Please run: git push -u origin master" -ForegroundColor Cyan
Set-Location ".."

Write-Host ""
Write-Host "Step 3: Migrating Frontend repository..." -ForegroundColor Yellow
Set-Location "travel-search-frontend"
if (git remote get-url origin) {
    git remote rename origin old-origin
    Write-Host "  Renamed old origin to old-origin" -ForegroundColor Green
}
git remote add origin "$baseUrl/Mbor_Mrg_Frontend.git"
Write-Host "  Added new origin: Mbor_Mrg_Frontend" -ForegroundColor Green
Write-Host "  Please run: git push -u origin master" -ForegroundColor Cyan
Set-Location ".."

Write-Host ""
Write-Host "=== Migration Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Create the 3 repositories on GitHub:" -ForegroundColor White
Write-Host "   - Mbor_Mrg_directus" -ForegroundColor Gray
Write-Host "   - Mbor_Mrg_n8n" -ForegroundColor Gray
Write-Host "   - Mbor_Mrg_Frontend" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Push each repository:" -ForegroundColor White
Write-Host "   cd directus && git push -u origin master" -ForegroundColor Gray
Write-Host "   cd n8n && git push -u origin master" -ForegroundColor Gray
Write-Host "   cd travel-search-frontend && git push -u origin master" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Then run setup-main-repo.ps1 to set up the main repository" -ForegroundColor White

