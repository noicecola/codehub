const { spawn } = require('child_process');

class MimoCodeAdapter {
  constructor() {
    this.name = 'MiMo Code';
    this.process = null;
  }

  isAvailable() {
    try {
      require('child_process').execSync('which mimo', { stdio: 'ignore' });
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
        if (obj.type === 'text' && obj.part?.text) {
          extracted += obj.part.text;
        }
      } catch {}
    }
    return extracted;
  }

  async run(message, workDir, onChunk) {
    return new Promise((resolve, reject) => {
      const args = [
        'run',
        '--format', 'json',
      ];

      this.process = spawn('mimo', args, {
        cwd: workDir || require('os').homedir(),
        env: { ...process.env },
      });

      let fullOutput = '';
      let buffer = '';

      this.process.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          const text = this.parseStreamChunk(line);
          if (text) {
            fullOutput += text;
            if (onChunk) onChunk(text);
          }
        }
      });

      this.process.stderr.on('data', (data) => {});

      this.process.on('close', (code) => {
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

module.exports = { MimoCodeAdapter };
