const { spawn } = require('child_process');

class ClaudeCodeAdapter {
  constructor() {
    this.name = 'Claude Code';
    this.process = null;
  }

  isAvailable() {
    try {
      require('child_process').execSync('which claude', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  parseStreamChunk(text) {
    const lines = text.split('\n').filter(l => l.trim());
    let extracted = '';
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'assistant' && obj.message?.content) {
          for (const block of obj.message.content) {
            if (block.type === 'text' && block.text) {
              extracted += block.text;
            }
          }
        } else if (obj.type === 'result' && obj.result) {
          // result事件包含最终结果，但text已经在assistant中输出过了
        }
      } catch {}
    }
    return extracted;
  }

  async run(message, workDir, onChunk) {
    return new Promise((resolve, reject) => {
      const args = [
        '--print',
        '--verbose',
        '--output-format', 'stream-json',
        '--add-dir', workDir || require('os').homedir(),
      ];

      this.process = spawn('claude', args, {
        cwd: workDir || require('os').homedir(),
        env: { ...process.env },
      });

      let fullOutput = '';
      let buffer = '';

      this.process.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留不完整的行

        for (const line of lines) {
          if (!line.trim()) continue;
          const text = this.parseStreamChunk(line);
          if (text) {
            fullOutput += text;
            if (onChunk) onChunk(text);
          }
        }
      });

      this.process.stderr.on('data', (data) => {
        // 忽略stderr的warning
      });

      this.process.on('close', (code) => {
        // 处理buffer中剩余的行
        if (buffer.trim()) {
          const text = this.parseStreamChunk(buffer);
          if (text) fullOutput += text;
        }
        this.process = null;
        resolve({ content: fullOutput, exitCode: code });
      });

      this.process.on('error', (err) => {
        this.process = null;
        reject(err);
      });

      this.process.stdin.write(message);
      this.process.stdin.end();
    });
  }

  stop() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

module.exports = { ClaudeCodeAdapter };
