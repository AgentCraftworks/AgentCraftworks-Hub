# Tangent Config File Schemas

Tangent stores its configuration in `~/.tangent/` (i.e. `%USERPROFILE%\.tangent\` on Windows). Both files are JSON, watched for changes at runtime, and can be hand-edited while Tangent is running.

---

## `~/.tangent/config.json` — App Settings

Managed by `ConfigStore`. Changes are picked up automatically (debounced 500 ms).

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `startFolder` | `string` | User home dir | Absolute path used as the initial working directory for new terminal sessions. |
| `editor` | `string` | `"code"` | Shell command used to open files/folders externally (e.g. `"code"`, `"cursor"`, `"vim"`). |
| `fontSize` | `number` | `14` | Terminal font size in pixels. Valid range: **8–32**, adjusted in steps of 2. |

All fields are optional — omitted fields fall back to their defaults.

### Example

```json
{
  "startFolder": "D:\\Projects",
  "editor": "cursor",
  "fontSize": 16
}
```

### Notes

- The file is created automatically on first launch if it doesn't exist.
- Invalid JSON is silently ignored; Tangent falls back to defaults.
- You can also change these values from the Settings panel inside the app.

---

## `~/.tangent/agents.json` — Agent Profiles

Managed by `AgentStore`. Defines the agent groups shown in the Agents sidebar.

### Top-Level Schema (`AgentStoreData`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `2` | Yes | Schema version. Must be the number `2`. Any other value causes Tangent to reset to defaults. |
| `groups` | `ProjectFolder[]` | Yes | Array of agent groups displayed in the sidebar. |

### `ProjectFolder` (group)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier (UUID v4 recommended). |
| `name` | `string` | Yes | Display name shown as the group header in the sidebar. |
| `agents` | `AgentProfile[]` | Yes | Ordered list of agent profiles in this group. |
| `iconPath` | `string` | No | Path to a custom icon image for the group. |

### `AgentProfile` (agent)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `string` | Yes | — | Unique identifier (UUID v4 recommended). |
| `name` | `string` | Yes | — | Display name shown in the sidebar. |
| `command` | `string` | Yes | — | Executable to run (must be on `PATH` or an absolute path). |
| `args` | `string[]` | Yes | — | Command-line arguments passed to `command`. |
| `env` | `Record<string, string>` | No | `{}` | Extra environment variables injected into the agent's process. |
| `cwdMode` | `"activeSession"` | Yes | — | How the working directory is resolved. Currently only `"activeSession"` is supported (uses the active terminal's cwd). |
| `launchTarget` | `"currentTab"` \| `"newTab"` \| `"path"` | Yes | — | Where to launch: promote the current tab, open a new tab, or launch in a specific path. |
| `cwdPath` | `string` | No | — | Explicit working-directory path. Only used when `launchTarget` is `"path"`. |

### Example

```json
{
  "version": 2,
  "groups": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Agents",
      "agents": [
        {
          "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
          "name": "Copilot CLI",
          "command": "copilot",
          "args": [],
          "cwdMode": "activeSession",
          "launchTarget": "currentTab"
        },
        {
          "id": "6ba7b811-9dad-11d1-80b4-00c04fd430c8",
          "name": "Claude Code",
          "command": "claude",
          "args": [],
          "cwdMode": "activeSession",
          "launchTarget": "currentTab"
        }
      ]
    },
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "My Project",
      "iconPath": "D:\\icons\\project.png",
      "agents": [
        {
          "id": "a1b2c3d4-5678-9abc-def0-1234567890ab",
          "name": "Project Agent",
          "command": "copilot",
          "args": ["--profile", "project"],
          "env": { "PROJECT_ROOT": "D:\\Projects\\myapp" },
          "cwdMode": "activeSession",
          "launchTarget": "newTab"
        }
      ]
    }
  ]
}
```

### Notes

- If the file is missing or has a `version` other than `2`, Tangent regenerates it with the default group containing Copilot CLI and Claude Code.
- IDs must be unique across all groups and agents. Use any UUID generator; Tangent uses UUID v4 internally.
- The sidebar renders groups in array order, and agents within each group in array order.
- Editing this file while Tangent is running requires a restart to pick up changes (unlike `config.json`, `agents.json` is only read at startup).
