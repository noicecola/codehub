// === Adapter 层 ===
// 统一适配器接口，组合 Transport + Parser，支持配置驱动

const { CLITransport, HTTPTransport } = require('./transport');
const { ClaudeParser, MimoParser, CodexParser, PlainTextParser, StreamParser } = require('./parser');

class ToolAdapter {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.builtin = config.builtin || false;
    this.transport = config.transport;
    this.streamParser = config.streamParser;
    this.args = config.args || [];
    this.options = config.options || {};
    this._prepareArgs = config.prepareArgs || null;
    this._originalMessageAsArg = config.transport?.messageAsArg ?? true;
  }

  isAvailable() {
    try {
      const cmd = this.transport.command || this.transport.baseUrl;
      if (!cmd) return false;
      require('child_process').execSync(`which ${cmd}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  getInstallCommand() {
    return this.options?.installCommand || null;
  }

  getInstallUrl() {
    return this.options?.installUrl || null;
  }

  async getVersion() {
    try {
      const cmd = this.transport.command || this.transport.baseUrl;
      if (!cmd) return null;
      const { execSync } = require('child_process');
      // 尝试常见版本参数
      for (const flag of ['--version', '-v', 'version']) {
        try {
          const output = execSync(`${cmd} ${flag}`, { timeout: 5000, encoding: 'utf8' }).trim();
          if (output) return output.split('\n')[0]; // 取第一行
        } catch {}
      }
      return null;
    } catch {
      return null;
    }
  }

  async run(message, workDir, onChunk) {
    const parser = new StreamParser(this.streamParser);
    let fullContent = '';

    const sendOptions = {
      workDir,
      onStdout: (data) => {
        const texts = parser.feed(data);
        texts.forEach(t => {
          fullContent += t;
          if (onChunk) onChunk(t);
        });
      },
      onStderr: (data) => {
        const texts = parser.feed(data);
        texts.forEach(t => {
          fullContent += t;
          if (onChunk) onChunk(t);
        });
      },
    };

    if (this._prepareArgs) {
      const newArgs = this._prepareArgs(workDir);
      if (newArgs) {
        this.transport.args = newArgs;
        // claude --add-dir 模式下必须用 stdin 传递 prompt，不能作为参数
        if (newArgs.includes('--add-dir')) {
          this.transport.messageAsArg = false;
        } else {
          this.transport.messageAsArg = this._originalMessageAsArg;
        }
      }
    }

    const result = await this.transport.send(message, sendOptions);

    const remaining = parser.flush();
    remaining.forEach(t => {
      fullContent += t;
      if (onChunk) onChunk(t);
    });

    return { content: fullContent, exitCode: result.exitCode };
  }

  stop() {
    this.transport.stop();
  }
}

// === Parser 映射 ===

const PARSER_MAP = {
  claude: () => new ClaudeParser(),
  mimo: () => new MimoParser(),
  codex: () => new CodexParser(),
  text: () => new PlainTextParser(),
};

// === 配置驱动的适配器工厂 ===

function createAdapterFromConfig(config) {
  const parserFactory = PARSER_MAP[config.parser] || PARSER_MAP.text;
  const transport = config.url
    ? new HTTPTransport(config.url, { path: config.path || '/chat', body: config.body || {} })
    : new CLITransport(config.command, [...config.args], { messageAsArg: config.messageAsArg || false });

  const adapter = new ToolAdapter({
    id: config.id,
    name: config.name,
    builtin: config.builtin || false,
    transport,
    streamParser: parserFactory(),
    args: config.args || [],
    prepareArgs: config.prepareArgs || null,
    options: {
      installCommand: config.installCommand || null,
      installUrl: config.installUrl || null,
    },
  });

  return adapter;
}

// === 自定义适配器工厂 ===

function createCustomAdapter(config) {
  const args = Array.isArray(config.args) ? config.args : [];
  const type = config.type || 'cli';

  if (type === 'http') {
    return new ToolAdapter({
      id: config.id || `custom-${Date.now()}`,
      name: config.name,
      transport: new HTTPTransport(config.url, { path: config.path || '/chat', body: config.body || {} }),
      streamParser: new PlainTextParser(),
    });
  }

  return new ToolAdapter({
    id: config.id || `custom-${Date.now()}`,
    name: config.name,
    transport: new CLITransport(config.command, args),
    streamParser: new PlainTextParser(),
  });
}

module.exports = { ToolAdapter, createAdapterFromConfig, createCustomAdapter };
