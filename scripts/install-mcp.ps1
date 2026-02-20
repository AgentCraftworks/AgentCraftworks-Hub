# install-mcp.ps1 — Auto-configure Tangent as an MCP server for Copilot CLI
# Writes/merges into ~/.github/copilot/copilot-mcp.json
#
# Usage:
#   .\scripts\install-mcp.ps1

$ErrorActionPreference = 'Stop'

# Resolve the path to the MCP server script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$McpServerPath = Join-Path $ScriptDir 'tangent-mcp-server.js'
$McpServerPath = (Resolve-Path $McpServerPath).Path

if (-not (Test-Path $McpServerPath)) {
    Write-Error "MCP server script not found at: $McpServerPath"
    exit 1
}

# Target config file
$ConfigDir = Join-Path (Join-Path $env:USERPROFILE '.github') 'copilot'
$ConfigFile = Join-Path $ConfigDir 'copilot-mcp.json'

# Ensure directory exists
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    Write-Host "Created directory: $ConfigDir"
}

# Load existing config or start fresh
$config = @{}
if (Test-Path $ConfigFile) {
    try {
        $existing = Get-Content -Raw $ConfigFile | ConvertFrom-Json
        # Convert PSObject to hashtable for easier manipulation
        $config = @{}
        foreach ($prop in $existing.PSObject.Properties) {
            $config[$prop.Name] = $prop.Value
        }
        Write-Host "Loaded existing config: $ConfigFile"
    } catch {
        Write-Warning "Could not parse existing config. Backing up and creating new one."
        Copy-Item $ConfigFile "$ConfigFile.bak"
        Write-Host "Backup saved to: $ConfigFile.bak"
    }
}

# Ensure mcpServers key exists
if (-not $config.ContainsKey('mcpServers')) {
    $config['mcpServers'] = @{}
}

# Convert mcpServers PSObject to hashtable if needed
$mcpServers = $config['mcpServers']
if ($mcpServers -is [PSCustomObject]) {
    $converted = @{}
    foreach ($prop in $mcpServers.PSObject.Properties) {
        $converted[$prop.Name] = $prop.Value
    }
    $mcpServers = $converted
    $config['mcpServers'] = $mcpServers
}

# Use forward slashes in the JSON path for cross-platform readability
$jsonPath = $McpServerPath -replace '\\', '/'

# Add or update the tangent server entry
$mcpServers['tangent'] = @{
    command = 'node'
    args = @($jsonPath)
}

# Write config
$json = $config | ConvertTo-Json -Depth 10
Set-Content -Path $ConfigFile -Value $json -Encoding UTF8

Write-Host ""
Write-Host "Tangent MCP server configured successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  Config file : $ConfigFile"
Write-Host "  Server path : $McpServerPath"
Write-Host ""
Write-Host "Restart Copilot CLI to pick up the new configuration."
