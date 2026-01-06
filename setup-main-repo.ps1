$ErrorActionPreference = "Stop"

Write-Host "=== Setting Up Main Repository ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "git@github.com:MateuszBorsuk2001"

if (-not (Test-Path ".git")) {
    git init
    Write-Host "Initialized main repository" -ForegroundColor Green
}

try {
    $null = git remote get-url origin 2>&1
    Write-Host "Remote already exists" -ForegroundColor Yellow
} catch {
    git remote add origin "$baseUrl/Mbor_Mrg_TravelAdvisor.git"
    Write-Host "Added remote: Mbor_Mrg_TravelAdvisor" -ForegroundColor Green
}

Write-Host ""
Write-Host "Adding new submodules..." -ForegroundColor Yellow

if (Test-Path "directus") {
    if (Test-Path "directus\.git") {
        Remove-Item -Recurse -Force "directus" -ErrorAction SilentlyContinue
    }
}
git submodule add "$baseUrl/Mbor_Mrg_directus.git" directus
Write-Host "  Added directus submodule" -ForegroundColor Green

if (Test-Path "n8n") {
    if (Test-Path "n8n\.git") {
        Remove-Item -Recurse -Force "n8n" -ErrorAction SilentlyContinue
    }
}
git submodule add "$baseUrl/Mbor_Mrg_n8n.git" n8n
Write-Host "  Added n8n submodule" -ForegroundColor Green

if (Test-Path "travel-search-frontend") {
    if (Test-Path "travel-search-frontend\.git") {
        Remove-Item -Recurse -Force "travel-search-frontend" -ErrorAction SilentlyContinue
    }
}
git submodule add -b main "$baseUrl/Mbor_Mrg_Frontend.git" travel-search-frontend
Write-Host "  Added travel-search-frontend submodule" -ForegroundColor Green

Write-Host ""
Write-Host "Creating .gitignore..." -ForegroundColor Yellow
@"
node_modules/
.env
.env.local
*.log
.DS_Store
dist/
build/
coverage/
.vscode/
.idea/
"@ | Out-File -FilePath ".gitignore" -Encoding utf8

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Create Mbor_Mrg_TravelAdvisor repository on GitHub" -ForegroundColor White
Write-Host "2. Review and commit changes:" -ForegroundColor White
Write-Host "   git add ." -ForegroundColor Gray
Write-Host "   git commit -m 'Initial commit: TravelAdvisor monorepo with submodules'" -ForegroundColor Gray
Write-Host "   git push -u origin master" -ForegroundColor Gray

