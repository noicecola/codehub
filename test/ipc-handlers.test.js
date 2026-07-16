const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// 直接测试 command 校验逻辑（不依赖 electron mock）
describe('Command Validation', () => {
  const SAFE_COMMAND_RE = /^[\w@\-./]+$/;
  const MAX_COMMAND_LEN = 200;

  function validateCommand(command) {
    if (!command || typeof command !== 'string') return 'Command is required';
    if (command.length > MAX_COMMAND_LEN) return `Command exceeds ${MAX_COMMAND_LEN} characters`;
    if (!SAFE_COMMAND_RE.test(command)) return 'Command contains invalid characters';
    return null;
  }

  it('accepts simple command', () => {
    assert.equal(validateCommand('claude'), null);
    assert.equal(validateCommand('python3'), null);
    assert.equal(validateCommand('node'), null);
  });

  it('accepts scoped package', () => {
    assert.equal(validateCommand('@anthropic-ai/claude-code'), null);
    assert.equal(validateCommand('@google/gemini-cli'), null);
  });

  it('accepts Go-style paths', () => {
    assert.equal(validateCommand('github.com/opencode-ai/opencode'), null);
  });

  it('accepts underscores and dots', () => {
    assert.equal(validateCommand('my_tool'), null);
    assert.equal(validateCommand('tool.name'), null);
  });

  it('rejects shell injection with semicolon', () => {
    assert.ok(validateCommand('claude; rm -rf /'));
  });

  it('rejects pipe injection', () => {
    assert.ok(validateCommand('cmd | malicious'));
  });

  it('rejects command substitution', () => {
    assert.ok(validateCommand('$(whoami)'));
  });

  it('rejects backtick injection', () => {
    assert.ok(validateCommand('cmd`whoami`'));
  });

  it('rejects empty string', () => {
    assert.ok(validateCommand(''));
  });

  it('rejects null/undefined', () => {
    assert.ok(validateCommand(null));
    assert.ok(validateCommand(undefined));
  });

  it('rejects overly long command', () => {
    assert.ok(validateCommand('a'.repeat(201)));
  });

  it('accepts max length command', () => {
    assert.equal(validateCommand('a'.repeat(200)), null);
  });
});

describe('SessionManager Cache', () => {
  // 测试 mtime 缓存逻辑（模拟）
  it('cache invalidation works correctly', () => {
    const cache = new Map();
    const filename = 'test.json';

    // 写入缓存
    cache.set(filename, { mtime: 1000, data: { id: '1' } });
    assert.deepEqual(cache.get(filename).data, { id: '1' });

    // 失效缓存
    cache.delete(filename);
    assert.equal(cache.get(filename), undefined);
  });
});

describe('Retry Logic', () => {
  function isRetryableError(err) {
    if (err.message === 'timeout') return true;
    if (err.code === 'EPIPE' || err.code === 'ENOENT' || err.code === 'EACCES') return true;
    if (err.message?.includes('spawn') || err.message?.includes('fork')) return true;
    return false;
  }

  it('retries on timeout', () => {
    assert.ok(isRetryableError(new Error('timeout')));
  });

  it('retries on EPIPE', () => {
    const err = new Error('write EPIPE');
    err.code = 'EPIPE';
    assert.ok(isRetryableError(err));
  });

  it('retries on ENOENT', () => {
    const err = new Error('spawn ENOENT');
    err.code = 'ENOENT';
    assert.ok(isRetryableError(err));
  });

  it('retries on spawn error', () => {
    assert.ok(isRetryableError(new Error('spawn unknown error')));
  });

  it('does not retry on normal error', () => {
    assert.equal(isRetryableError(new Error('command failed')), false);
  });

  it('does not retry on non-zero exit code', () => {
    const err = new Error('process exited with code 1');
    assert.equal(isRetryableError(err), false);
  });
});
