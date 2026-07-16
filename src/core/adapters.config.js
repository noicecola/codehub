// === 适配器配置表 ===
// 新增工具只需在此添加一条配置，无需修改 adapter.js / registry.js
// installCommand / installUrl 经逐条验证（2026-07-08），标记"待确认"的包未在对应包管理器中找到

const ADAPTERS = [
  // === 已有工具 ===
  {
    id: 'claude-code',
    name: 'Claude Code',
    builtin: true,
    command: 'claude',
    args: ['--print', '--output-format', 'json'],
    messageAsArg: true,
    parser: 'claude',
    prepareArgs: (workDir) => workDir
      ? ['--print', '--output-format', 'json', '--add-dir', workDir]
      : ['--print', '--output-format', 'json'],
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    installUrl: 'https://docs.anthropic.com/en/docs/claude-code',
  },
  {
    id: 'mimo-code',
    name: 'MiMo Code',
    builtin: true,
    command: 'mimo',
    args: ['run', '--format', 'json', '--pure'],
    messageAsArg: true,
    parser: 'mimo',
    installCommand: 'npm install -g @mimo-ai/cli',
    installUrl: 'https://github.com/XiaomiMiMo/MiMo-Code',
  },

  // === 新增工具 ===
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    builtin: true,
    command: 'codex',
    args: ['exec', '--skip-git-repo-check', '--json'],
    messageAsArg: true,
    parser: 'codex',
    installCommand: 'npm install -g @openai/codex',
    installUrl: 'https://github.com/openai/codex',
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    builtin: true,
    command: 'gemini',
    args: ['-p'],
    messageAsArg: true,
    parser: 'text',
    installCommand: 'npm install -g @google/gemini-cli',
    installUrl: 'https://github.com/google-gemini/gemini-cli',
  },
  {
    id: 'copilot-cli',
    name: 'Copilot CLI',
    builtin: true,
    command: 'gh',
    args: ['copilot', 'suggest', '-t', 'shell'],
    messageAsArg: true,
    parser: 'text',
    installCommand: 'brew install gh && gh extension install github/gh-copilot',
    installUrl: 'https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    builtin: true,
    command: 'opencode',
    args: ['run', '--quiet'],
    messageAsArg: true,
    parser: 'text',
    installCommand: 'go install github.com/opencode-ai/opencode@latest',
    installUrl: 'https://github.com/opencode-ai/opencode',
  },
  {
    id: 'kilo-code',
    name: 'Kilo Code',
    builtin: true,
    command: 'kilo',
    args: ['run'],
    messageAsArg: true,
    parser: 'text',
    installCommand: 'npm install -g @kilocode/cli',
    installUrl: 'https://github.com/Kilo-Org/kilocode',
  },
  {
    id: 'qwen-code',
    name: 'Qwen Code',
    builtin: true,
    command: 'qwen',
    args: ['-p'],
    messageAsArg: true,
    parser: 'text',
    installCommand: 'npm install -g @qwen-code/qwen-code@latest',
    installUrl: 'https://github.com/QwenLM/qwen-code',
  },
];

module.exports = { ADAPTERS };
