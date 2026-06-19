// === Adapter 层 ===
// 统一适配器接口，组合 Transport + Parser

const { CLITransport } = require('./transport');
const { ClaudeParser, MimoParser, PlainTextParser, StreamParser } = require('./parser');

class ToolAdapter {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.transport = config.transport;
    this.streamParser = config.streamParser;
    this.args = config.args || [];
    this.options = config.options || {};
  }

  isAvailable() {
    try {
      require('child_process').execSync(`which ${this.transport.command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
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

    // 内置适配器在 run 时动态设置工作目录参数
    if (this._prepareArgs) {
      this._prepareArgs(workDir);
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

// === 内置适配器工厂 ===

function createClaudeCodeAdapter() {
  const adapter = new ToolAdapter({
    id: 'claude-code',
    name: 'Claude Code',
    transport: new CLITransport('claude', [
      '--print', '--verbose', '--output-format', 'stream-json',
    ]),
    streamParser: new ClaudeParser(),
  });

  // 动态添加 --add-dir 参数
  adapter._prepareArgs = function(workDir) {
    if (workDir) {
      this.transport.args = [
        '--print', '--verbose', '--output-format', 'stream-json',
        '--add-dir', workDir,
      ];
    }
  };

  return adapter;
}

function createMimoCodeAdapter() {
  return new ToolAdapter({
    id: 'mimo-code',
    name: 'MiMo Code',
    transport: new CLITransport('mimo', ['run', '--format', 'json']),
    streamParser: new MimoParser(),
  });
}

function createCustomAdapter(config) {
  const args = config.args ? config.args.split(/\s+/) : [];
  return new ToolAdapter({
    id: config.id || `custom-${Date.now()}`,
    name: config.name,
    transport: new CLITransport(config.command, args),
    streamParser: new PlainTextParser(),
  });
}

module.exports = { ToolAdapter, createClaudeCodeAdapter, createMimoCodeAdapter, createCustomAdapter };
