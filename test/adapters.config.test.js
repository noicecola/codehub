const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ADAPTERS } = require('../src/core/adapters.config');
const { createAdapterFromConfig } = require('../src/core/adapter');

describe('Adapter Config', () => {
  it('has all expected tools', () => {
    const ids = ADAPTERS.map(a => a.id);
    assert.ok(ids.includes('claude-code'));
    assert.ok(ids.includes('mimo-code'));
    assert.ok(ids.includes('codex-cli'));
    assert.ok(ids.includes('gemini-cli'));
    assert.ok(ids.includes('copilot-cli'));
    assert.ok(ids.includes('opencode'));
    assert.ok(ids.includes('kilo-code'));
    assert.ok(ids.includes('qwen-code'));
  });

  it('each config has required fields', () => {
    ADAPTERS.forEach(config => {
      assert.ok(config.id, `Missing id in config`);
      assert.ok(config.name, `Missing name in config: ${config.id}`);
      assert.ok(config.command, `Missing command in config: ${config.id}`);
      assert.ok(config.parser, `Missing parser in config: ${config.id}`);
    });
  });

  it('creates adapter from config', () => {
    const config = ADAPTERS.find(a => a.id === 'codex-cli');
    const adapter = createAdapterFromConfig(config);
    assert.equal(adapter.id, 'codex-cli');
    assert.equal(adapter.name, 'Codex CLI');
    assert.equal(adapter.builtin, true);
  });

  it('creates all adapters without error', () => {
    ADAPTERS.forEach(config => {
      const adapter = createAdapterFromConfig(config);
      assert.ok(adapter.id);
      assert.ok(adapter.name);
      assert.ok(adapter.transport);
    });
  });
});
