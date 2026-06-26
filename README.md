# CodeHub

Multi-tool message dispatch desktop app — Send the same message to multiple AI coding tools simultaneously, execute in parallel, and compare results.

## Features

### Core
- **Multi-tool parallel**: Send messages to 9 built-in AI coding tools at once, results appear as each tool finishes
- **Streaming output**: Real-time display of each tool's response process
- **Result comparison**: Side-by-side comparison of different tools' outputs
- **Artifact tracking**: Automatically detect file changes (create/modify/delete) after tool execution
- **Session management**: Save/load/export conversation history (JSON and Markdown)
- **Message templates**: Built-in templates (explain code, code review, refactor, write tests, debug)
- **Custom tools**: Support adding CLI command or HTTP API interface tools

### UI/UX
- **Markdown rendering**: Output supports Markdown format + code syntax highlighting (15 languages)
- **User/AI avatars**: Message bubbles with role avatars, user right-aligned, AI left-aligned
- **Message round separators**: Timestamp dividers between each conversation round
- **Border breathing animation**: Border brightness pulses during tool execution, each tool has its own color
- **Panel drag-to-reorder**: Drag panels to adjust order
- **Colored borders**: Each tool has its own color (red/blue/green/orange/purple/teal/brown)
- **Timing stats**: Each tool shows response time (seconds) and output length (characters)

### Interaction
- **Retry single tool**: Retry button appears on failed panels, re-run individually
- **Error detail expand**: Long error messages can be collapsed/expanded
- **Message draft**: Auto-saves unsent input when switching sessions
- **File drag & drop**: Drag file paths into the input area
- **Large output optimization**: Auto-truncates at 8k characters, click "Show all" to expand
- **Session search**: Search session names, tags, and conversation content
- **Tool presets**: Save common tool combinations, switch with one click
- **Session tags**: Add tags to sessions for categorization

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Send message |
| `Ctrl+N` | New session |
| `Ctrl+K` | Search sessions |
| `Ctrl+B` | Toggle sidebar |

### Data Management
- **Session export**: Markdown / JSON format
- **Auto session cleanup**: Automatically cleans up sessions older than 30 days
- **Tag search**: Filter sessions by tags
- **Content search**: Search keywords in conversation history

### Technical
- **Config-driven architecture**: Adding new tools only requires one line in `adapters.config.js`
- **Unit tests**: 34 tests covering core modules
- **CSS modularization**: Styles split into 5 files by functionality
- **Electron security**: `contextIsolation: true`, all IPC via preload bridge

## Architecture

```
src/
├── main.js              # Electron main process (IPC handling)
├── preload.js           # Context bridge (secure API exposure)
├── session-manager.js   # Session persistence (JSON files)
├── file-tracker.js      # File change tracking (snapshot + diff)
├── core/
│   ├── adapters.config.js # Adapter config table (add new tools here)
│   ├── adapter.js       # Adapter (config-driven factory)
│   ├── transport.js     # Communication layer (CLI / HTTP)
│   ├── parser.js        # Output parsing (Claude/MiMo/plain text)
│   ├── registry.js      # Adapter registry
│   └── router.js        # Tool stop control
├── components/
│   ├── modal.js         # Modal management
│   ├── toast.js         # Toast notifications
│   └── diff-viewer.js   # Result comparison view
└── renderer/
    ├── index.html       # UI structure
    ├── state.js         # Global state
    ├── app.js           # Entry point + event binding
    ├── tools.js         # Tool selector + management
    ├── messages.js      # Message sending
    ├── output.js        # Output panel management
    ├── modals.js        # Modal management
    ├── sessions.js      # Session sidebar
    ├── base.css         # Variables + layout
    ├── sidebar.css      # Sidebar styles
    ├── panels.css       # Panel styles
    ├── input.css        # Input area styles
    └── modals.css       # Modal styles
```

## Installation

```bash
npm install
```

## Running

```bash
# Normal start
npm start

# Development mode (auto-opens DevTools)
npm run dev
```

## Building

```bash
# macOS
npm run build

# Windows
npm run build:win

# Linux
npm run build:linux
```

Build output goes to the `dist/` directory.

## Prerequisites

At least one AI coding tool must be installed:

| Tool | Command | Install |
|------|---------|---------|
| Claude Code | `claude` | [docs.anthropic.com](https://docs.anthropic.com/claude-code) |
| MiMo Code | `mimo` | [github.com/xiaomi/mimo-code](https://github.com/xiaomi/mimo-code) |
| Codex CLI | `codex` | [github.com/openai/codex](https://github.com/openai/codex) |
| Gemini CLI | `gemini` | [github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) |
| Copilot CLI | `gh copilot` | [github.com/features/copilot](https://github.com/features/copilot) |
| OpenCode | `opencode` | [github.com/opencode-ai/opencode](https://github.com/opencode-ai/opencode) |
| Kilo Code | `kilo` | [github.com/Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode) |
| Qwen Code | `qwen` | [Qwen docs](https://help.aliyun.com/zh/model-studio/) |
| Trae | `trae` | [trae.ai](https://trae.ai) |

Uninstalled tools will show as "Not installed" and won't affect other tools.

## Usage

1. Select tools in the bottom tool selector
2. Choose a working directory (optional)
3. Type a message, press `Ctrl+Enter` or click "Send"
4. View parallel outputs from each tool
5. Use the "Compare" button to view results side by side
6. Use the "Artifacts" button to view file changes

### Example: Sending to all 9 tools simultaneously

```
Input: Implement a quicksort algorithm in Python

Output panels:
┌─────────────────┬─────────────────┬─────────────────┐
│ Claude Code     │ MiMo Code       │ Codex CLI       │
│ [streaming...]  │ [streaming...]  │ [streaming...]  │
│                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┤
│ Gemini CLI      │ Copilot CLI     │ OpenCode        │
│ [streaming...]  │ [streaming...]  │ [streaming...]  │
│                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┤
│ Kilo Code       │ Qwen Code       │ Trae            │
│ [streaming...]  │ [streaming...]  │ [streaming...]  │
│                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

### Tool Presets

Save common tool combinations and switch with one click:

- **Frontend**: Claude Code + Codex CLI + Gemini CLI
- **Backend**: Claude Code + MiMo Code + Qwen Code
- **All tools**: All 9 tools
- **Custom**: Any tool combination

Presets are stored at `~/Library/Application Support/codehub/presets.json`

### Session Tags

Add tags to sessions for easy categorization:

- `#frontend` `#backend` `#debug` `#refactor`
- Search automatically matches tag content

## Custom Tools

Click the "Tools" button in the sidebar to add custom tools:

### CLI Command
- **Name**: Display name
- **Command**: CLI command (e.g., `python3`, `node`)
- **Args**: Command-line arguments (optional)

### HTTP API
- **Name**: Display name
- **URL**: API address (e.g., `http://localhost:8080`)
- **Path**: Endpoint path (default `/chat`)

Custom tools are stored at `~/Library/Application Support/codehub/custom-tools.json`

## Export

Supports exporting sessions as:
- **Markdown**: Readable conversation records
- **JSON**: Complete structured data

## Data Storage

| Data | Path |
|------|------|
| Sessions | `~/Library/Application Support/codehub/sessions/` |
| Custom tools | `~/Library/Application Support/codehub/custom-tools.json` |
| Presets | `~/Library/Application Support/codehub/presets.json` |
| Templates | `~/Library/Application Support/codehub/templates.json` |

## Testing

```bash
npm test
```

34 unit tests covering:
- Parser (Claude/MiMo/plain text/streaming)
- Transport (CLI/HTTP)
- Router (tool stop)
- FileTracker (file change detection)
- Adapter Config (config table validation)

## License

MIT
