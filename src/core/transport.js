// === Transport 层 ===
// 统一不同通信方式：CLI / HTTP / IPC / MCP

const { spawn } = require('child_process');
const http = require('http');

class CLITransport {
  constructor(command, args = [], options = {}) {
    this.command = command;
    this.args = args;
    this.options = options;
    this.process = null;
  }

  async send(message, { workDir, onStdout, onStderr } = {}) {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.command, this.args, {
        cwd: workDir || require('os').homedir(),
        env: { ...process.env, ...this.options.env },
      });

      let stdout = '';
      let stderr = '';

      this.process.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        if (onStdout) onStdout(text);
      });

      this.process.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        if (onStderr) onStderr(text);
      });

      this.process.on('close', (code) => {
        this.process = null;
        resolve({ stdout, stderr, exitCode: code });
      });

      this.process.on('error', (err) => {
        this.process = null;
        reject(err);
      });

      // 通过stdin传递消息
      if (message) {
        this.process.stdin.write(message);
        this.process.stdin.end();
      }
    });
  }

  stop() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

class HTTPTransport {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.options = options;
  }

  async send(message, { headers = {}, onChunk } = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.options.path || '/chat', this.baseUrl);
      const postData = JSON.stringify({ message, ...this.options.body });

      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...headers,
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
          if (onChunk) onChunk(chunk.toString());
        });
        res.on('end', () => {
          resolve({ stdout: data, stderr: '', exitCode: res.statusCode });
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  stop() {}
}

module.exports = { CLITransport, HTTPTransport };
