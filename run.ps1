Write-Host "Building Tangent..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }
Write-Host "Starting Tangent..." -ForegroundColor Green
npx electron out/main/index.js
