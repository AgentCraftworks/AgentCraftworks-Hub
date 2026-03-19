# Install the AgentCraftworks Hub CLI globally
Write-Host "Installing AgentCraftworks Hub CLI..." -ForegroundColor Cyan
Set-Location $PSScriptRoot\..
npm link
Write-Host "Done! You can now use 'hub' from any terminal." -ForegroundColor Green
Write-Host ""
Write-Host "Try these commands:" -ForegroundColor Yellow
Write-Host "  hub status           # Quick rate limit summary"
Write-Host "  hub monitor          # Full terminal dashboard (works in VS Code terminal)"
Write-Host "  hub agents list      # List configured agents"
hub help
