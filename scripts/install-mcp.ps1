# install-mcp.ps1 — Auto-configure AgentCraftworks Hub as an MCP server
# Writes/merges into ~/.github/copilot/copilot-mcp.json (Copilot CLI)
# and optionally into Claude Desktop config.
#
# Usage:
#   .\scripts\install-mcp.ps1
#   .\scripts\install-mcp.ps1 -Claude   # also configure Claude Desktop

param([switch]$Claude)

$ErrorActionPreference = 'Stop'

# Resolve the path to the MCP server script
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot    = Split-Path -Parent $ScriptDir
$McpScript   = Join-Path $ScriptDir 'hub-mcp-server.js'
$McpScript   = (Resolve-Path $McpScript).Path

if (-not (Test-Path $McpScript)) {
    Write-Error "MCP server script not found at: $McpScript`nRun 'npm install && npm run build --workspace=packages/mcp-server' first."
    exit 1
}

# ── Helper: merge mcpServers entry into a JSON config file ──────────────────
function Merge-McpConfig($ConfigFile, $ServerKey, $Entry) {
    $ConfigDir = Split-Path -Parent $ConfigFile
    if (-not (Test-Path $ConfigDir)) {
        New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
        Write-Host "Created directory: $ConfigDir"
    }

    $config = @{}
    if (Test-Path $ConfigFile) {
        try {
            $existing = Get-Content -Raw $ConfigFile | ConvertFrom-Json
            foreach ($prop in $existing.PSObject.Properties) { $config[$prop.Name] = $prop.Value }
            Write-Host "Loaded existing config: $ConfigFile"
        } catch {
            Write-Warning "Could not parse existing config. Backing up."
            Copy-Item $ConfigFile "$ConfigFile.bak"
        }
    }

    if (-not $config.ContainsKey('mcpServers')) { $config['mcpServers'] = @{} }
    $mcpServers = $config['mcpServers']
    if ($mcpServers -is [PSCustomObject]) {
        $converted = @{}
        foreach ($prop in $mcpServers.PSObject.Properties) { $converted[$prop.Name] = $prop.Value }
        $mcpServers = $converted
        $config['mcpServers'] = $mcpServers
    }

    $mcpServers[$ServerKey] = $Entry
    $json = $config | ConvertTo-Json -Depth 10
    Set-Content -Path $ConfigFile -Value $json -Encoding UTF8
    Write-Host "  ✓ Wrote: $ConfigFile" -ForegroundColor Green
}

# ── Detect GITHUB_TOKEN ──────────────────────────────────────────────────────
$token = $env:GITHUB_TOKEN
if (-not $token) {
    try { $token = (gh auth token 2>$null).Trim() } catch {}
}
$tokenNote = if ($token) { "(token detected via gh CLI)" } else { "(set GITHUB_TOKEN env var manually)" }

$jsonPath = $McpScript -replace '\\', '/'
$entry = @{
    command = 'node'
    args    = @($jsonPath)
    env     = @{
        GITHUB_ENTERPRISE = 'AICraftworks'
        GITHUB_TOKEN      = if ($token) { $token } else { '<your-github-pat>' }
    }
}

# ── Copilot CLI config ───────────────────────────────────────────────────────
$copilotConfig = Join-Path (Join-Path $env:USERPROFILE '.github') 'copilot\copilot-mcp.json'
Write-Host "`nConfiguring Copilot CLI MCP..." -ForegroundColor Cyan
Merge-McpConfig $copilotConfig 'agentcraftworks-hub' $entry

# ── Claude Desktop config (optional) ────────────────────────────────────────
if ($Claude) {
    $claudeConfig = Join-Path $env:APPDATA 'Claude\claude_desktop_config.json'
    Write-Host "`nConfiguring Claude Desktop MCP..." -ForegroundColor Cyan
    # Claude Desktop uses "mcpServers" at root level
    Merge-McpConfig $claudeConfig 'agentcraftworks-hub' $entry
}

Write-Host ""
Write-Host "AgentCraftworks Hub MCP server configured!" -ForegroundColor Green
Write-Host ""
Write-Host "  Server script : $McpScript"
Write-Host "  Enterprise    : AICraftworks"
Write-Host "  Token source  : $tokenNote"
Write-Host ""
Write-Host "Available MCP tools:" -ForegroundColor Yellow
Write-Host "  get_rate_limits      - Current API rate limit status + ETA"
Write-Host "  get_token_activity   - Top API callers (requires read:audit_log)"
Write-Host "  get_actions_minutes  - Monthly Actions minutes + cost"
Write-Host "  get_copilot_usage    - Copilot premium request consumption"
Write-Host "  get_billing_summary  - Estimated month-to-date spend"
Write-Host ""
Write-Host "Restart Copilot CLI / Claude Desktop to pick up the new server."
if ($Claude) {
    Write-Host "Then ask Claude: 'How's my GitHub API rate limit?'"
}
