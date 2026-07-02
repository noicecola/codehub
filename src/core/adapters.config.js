// === 适配器配置表 ===
// 新增工具只需在此添加一条配置，无需修改 adapter.js / registry.js

const ADAPTERS = [
  // === 已有工具 ===
  {
    id: 'claude-code',
    name: 'Claude Code',
    builtin: true,
    command: 'claude',
    args: ['--print', '--output-format', 'json'],
    messageAsArg: false,
    parser: 'claude',
    prepareArgs: (workDir) => workDir
      ? ['--print', '--output-format', 'json', '--add-dir', workDir]
      : ['--print', '--output-format', 'json'],
  },
  {
    id: 'mimo-code',
    name: 'MiMo Code',
    builtin: true,
    command: 'mimo',
    args: ['run', '--format', 'json', '--pure'],
    messageAsArg: true,
    parser: 'mimo',
  },

  // === 新增工具 ===
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    builtin: true,
    command: 'codex',
    args: ['--quiet', '--approval-mode', 'auto-edit'],
    messageAsArg: true,
    parser: 'text',
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    builtin: true,
    command: 'gemini',
    args: ['-p'],
    messageAsArg: true,
    parser: 'text',
  },
  {
    id: 'copilot-cli',
    name: 'Copilot CLI',
    builtin: true,
    command: 'gh',
    args: ['copilot', 'suggest', '-t', 'shell'],
    messageAsArg: true,
    parser: 'text',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    builtin: true,
    command: 'opencode',
    args: ['run', '--quiet'],
    messageAsArg: true,
    parser: 'text',
  },
  {
    id: 'kilo-code',
    name: 'Kilo Code',
    builtin: true,
    command: 'kilo',
    args: ['run', '--format', 'text'],
    messageAsArg: true,
    parser: 'text',
  },
  {
    id: 'qwen-code',
    name: 'Qwen Code',
    builtin: true,
    command: 'qwen',
    args: ['run', '--format', 'text'],
    messageAsArg: true,
    parser: 'text',
  },
  {
    id: 'trae',
    name: 'Trae',
    builtin: true,
    command: 'trae',
    args: ['run', '--quiet'],
    messageAsArg: true,
    parser: 'text',
  },
];

module.exports = { ADAPTERS };
