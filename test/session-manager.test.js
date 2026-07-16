const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 使用临时目录模拟 electron userData
const mockDataDir = path.join(os.tmpdir(), `codehub-test-${Date.now()}`);

// 在 require SessionManager 之前 mock electron
const electronPath = require.resolve('electron');
const originalElectron = require.cache[electronPath];
require.cache[electronPath] = {
  id: electronPath,
  filename: electronPath,
  loaded: true,
  exports: { app: { getPath: () => mockDataDir } },
};

const { SessionManager } = require('../src/session-manager');

describe('SessionManager', () => {
  let manager;

  before(() => {
    manager = new SessionManager();
  });

  after(() => {
    // 恢复 electron mock
    if (originalElectron) require.cache[electronPath] = originalElectron;
    else delete require.cache[electronPath];
    // 清理测试目录
    try { fs.rmSync(mockDataDir, { recursive: true }); } catch {}
  });

  it('creates a new session', () => {
    const session = manager.createSession('test session');
    assert.ok(session.id);
    assert.equal(session.name, 'test session');
    assert.equal(session.messages.length, 0);
  });

  it('lists sessions', () => {
    const sessions = manager.listSessions();
    assert.ok(sessions.length > 0);
    assert.ok(sessions[0].id);
  });

  it('loads a session by id', () => {
    const created = manager.createSession('load test');
    const loaded = manager.loadSession(created.id);
    assert.ok(loaded);
    assert.equal(loaded.id, created.id);
  });

  it('adds a message to session', () => {
    const session = manager.createSession('msg test');
    const result = manager.addMessage(session.id, {
      content: 'hello',
      toolResults: { 'claude-code': { content: 'hi there', exitCode: 0 } },
    });
    assert.ok(result);
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0].toolOutputs['claude-code'].content, 'hi there');
  });

  it('updates tool output', () => {
    const session = manager.createSession('update test');
    manager.addMessage(session.id, { content: 'test', toolResults: {} });
    const result = manager.updateToolOutput(session.id, 'mimo-code', {
      content: 'mimo response', exitCode: 0,
    });
    assert.ok(result);
    assert.equal(result.messages[0].toolOutputs['mimo-code'].content, 'mimo response');
  });

  it('deletes a session', () => {
    const session = manager.createSession('delete test');
    const deleted = manager.deleteSession(session.id);
    assert.equal(deleted, true);
    assert.equal(manager.loadSession(session.id), null);
  });

  it('searches sessions by content', () => {
    const session = manager.createSession('search test');
    manager.addMessage(session.id, { content: 'unique keyword xyz123', toolResults: {} });
    const results = manager.searchSessions('xyz123');
    assert.ok(results.length > 0);
    assert.ok(results[0].matchSnippet);
  });

  it('cache works correctly', () => {
    const session = manager.createSession('cache test');
    const loaded1 = manager.loadSession(session.id);
    const loaded2 = manager.loadSession(session.id);
    assert.deepEqual(loaded1, loaded2);
  });

  it('cache invalidation works', () => {
    const session = manager.createSession('invalidation test');
    manager.loadSession(session.id);
    manager.invalidateCache();
    const loaded = manager.loadSession(session.id);
    assert.ok(loaded);
  });

  it('getLatestSession returns most recent', () => {
    manager.createSession('first');
    const s2 = manager.createSession('second');
    const latest = manager.getLatestSession();
    assert.equal(latest.id, s2.id);
  });
});
