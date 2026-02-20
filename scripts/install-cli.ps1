# Install the tangent CLI globally
Write-Host "Installing Tangent CLI..." -ForegroundColor Cyan
Set-Location $PSScriptRoot\..
npm link
Write-Host "Done! You can now use 'tangent' from any terminal." -ForegroundColor Green
tangent help
