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
    this.messageAsArg = options.messageAsArg || false;
  }

  async send(message, { workDir, onStdout, onStderr } = {}) {
    return new Promise((resolve, reject) => {
      let args = [...this.args];
      
      // 如果配置了 messageAsArg，将消息作为参数传递
      if (this.messageAsArg && message) {
        args.push(message);
      }

      this.process = spawn(this.command, args, {
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

      // 通过 stdin 传递消息（非 messageAsArg 模式时）
      // 三重防护：检查 writable + try-catch + error 事件
      const stdin = this.process.stdin;
      stdin.on('error', (err) => {
        // EPIPE: 子进程已关闭 stdin，静默忽略
        if (err.code !== 'EPIPE') {
          console.error(`stdin error for ${this.command}:`, err.message);
        }
      });

      try {
        if (!this.messageAsArg && message && stdin.writable) {
          stdin.write(message + '\n');
        }
      } catch (err) {
        if (err.code !== 'EPIPE') {
          console.error(`stdin write error for ${this.command}:`, err.message);
        }
      }

      try {
        if (stdin.writable) {
          stdin.end();
        }
      } catch (err) {
        if (err.code !== 'EPIPE') {
          console.error(`stdin end error for ${this.command}:`, err.message);
        }
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
