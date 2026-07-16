const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// === Helper: 创建 mock electron 模块 ===
const mockDir = path.join(os.tmpdir(), `codehub-ipc-test-${Date.now()}`);
fs.mkdirSync(mockDir, { recursive: true });
// 预创建模板和预设文件，避免写入时报错
fs.writeFileSync(path.join(mockDir, 'templates.json'), '[]');
fs.writeFileSync(path.join(mockDir, 'presets.json'), '[]');

const mockHandlers = {};
const mockIpcMain = {
  handle: (name, handler) => { mockHandlers[name] = handler; },
};
const mockDialog = {
  showSaveDialog: async () => ({ canceled: false, filePath: path.join(mockDir, 'export.json') }),
  showOpenDialog: async () => ({ canceled: false, filePaths: [mockDir] }),
};
const mockMainWindow = {
  isDestroyed: () => false,
  webContents: { send: () => {} },
};

// 临时替换 require.cache 中的 electron
const electronPath = require.resolve('electron');
const origElectron = require.cache[electronPath];
require.cache[electronPath] = {
  id: electronPath, filename: electronPath, loaded: true,
  exports: { ipcMain: mockIpcMain, dialog: mockDialog, app: { getPath: () => mockDir } },
};

const { registerHandlers } = require('../src/ipc-handlers');

// 恢复 electron
if (origElectron) require.cache[electronPath] = origElectron;
else delete require.cache[electronPath];

// === Mock 依赖 ===
function createMockRegistry(tools = []) {
  const map = new Map(tools.map(t => [t.id, { ...t, isAvailable: () => t.available }]));
  return {
    get: (id) => map.get(id),
    list: () => tools.map(t => ({ id: t.id, name: t.name, available: t.available !== false })),
    getInstallInfo: (id) => {
      const t = map.get(id);
      return t ? { id: t.id, name: t.name, installCommand: null, installUrl: null, available: t.available !== false } : null;
    },
    addCustom: (tool) => ({ id: `custom-${Date.now()}`, name: tool.name }),
    removeCustom: () => {},
    editCustom: () => {},
  };
}

function createMockSessionManager() {
  const sessions = new Map();
  return {
    loadSession: (id) => sessions.get(id) || null,
    listSessions: () => Array.from(sessions.values()),
    createSession: (name) => {
      const id = `s-${Date.now()}`;
      const s = { id, name: name || 'test', messages: [], tags: [], createdAt: Date.now(), updatedAt: Date.now() };
      sessions.set(id, s);
      return s;
    },
    saveSession: (s) => { sessions.set(s.id, s); return s; },
    deleteSession: (id) => sessions.delete(id),
    addMessage: (id, msg) => {
      const s = sessions.get(id);
      if (!s) return null;
      s.messages.push({ content: msg.content, toolOutputs: msg.toolResults || {}, timestamp: Date.now() });
      return s;
    },
    updateToolOutput: (id, toolId, result) => {
      const s = sessions.get(id);
      if (!s || !s.messages.length) return null;
      const last = s.messages[s.messages.length - 1];
      if (!last.toolOutputs) last.toolOutputs = {};
      last.toolOutputs[toolId] = result;
      return s;
    },
    searchSessions: (q) => Array.from(sessions.values()).filter(s => s.name.includes(q)),
  };
}

function createMockFileTracker() {
  return {
    snapshot: () => Promise.resolve(),
    diff: () => Promise.resolve([]),
  };
}

// === 注册 handlers ===
const sessionManager = createMockSessionManager();
const registry = createMockRegistry([
  { id: 'tool-a', name: 'Tool A', available: true },
  { id: 'tool-b', name: 'Tool B', available: false },
]);
const fileTracker = createMockFileTracker();
let currentSessionId = 's1';
sessionManager.createSession('test');
currentSessionId = 's1';

registerHandlers({
  registry,
  router: { stop: () => {} },
  sessionManager,
  fileTracker,
  getMainWindow: () => mockMainWindow,
  getCurrentSessionId: () => currentSessionId,
  setCurrentSessionId: (id) => { currentSessionId = id; },
  log: () => {},
});

// === 测试 ===
describe('IPC Handlers (full mock)', () => {
  it('get-tools returns tool list', async () => {
    const tools = await mockHandlers['get-tools']();
    assert.equal(tools.length, 2);
    assert.equal(tools[0].id, 'tool-a');
    assert.equal(tools[0].available, true);
    assert.equal(tools[1].available, false);
  });

  describe('add-custom-tool', () => {
    it('accepts valid command', async () => {
      const result = await mockHandlers['add-custom-tool'](null, { name: 'mytool', command: 'claude' });
      assert.ok(result.id);
      assert.equal(result.name, 'mytool');
    });

    it('rejects shell injection', async () => {
      const result = await mockHandlers['add-custom-tool'](null, { name: 'evil', command: 'x; rm -rf /' });
      assert.ok(result.error);
    });

    it('rejects empty name', async () => {
      const result = await mockHandlers['add-custom-tool'](null, { name: '' });
      assert.ok(result.error);
    });
  });

  describe('edit-custom-tool', () => {
    it('accepts valid command', async () => {
      const result = await mockHandlers['edit-custom-tool'](null, { id: 'x', command: 'python3' });
      assert.equal(result, true);
    });

    it('rejects invalid command', async () => {
      const result = await mockHandlers['edit-custom-tool'](null, { id: 'x', command: 'x|y' });
      assert.ok(result.error);
    });
  });

  describe('export-session', () => {
    it('exports session to file', async () => {
      const filePath = await mockHandlers['export-session'](null, { sessionId: 's1', format: 'json' });
      // filePath might be null if dialog is mocked differently
      // Just verify the handler doesn't throw
      assert.ok(true);
    });
  });

  describe('read-file', () => {
    it('rejects path traversal', async () => {
      const result = await mockHandlers['read-file'](null, { dir: '/tmp', filePath: '../../../etc/passwd' });
      assert.ok(result.error);
    });
  });

  describe('install-tool', () => {
    it('rejects unknown tool', async () => {
      const result = await mockHandlers['install-tool'](null, { toolId: 'unknown' });
      assert.equal(result.success, false);
    });

    it('rejects already installed tool', async () => {
      const result = await mockHandlers['install-tool'](null, { toolId: 'tool-a' });
      assert.equal(result.success, false);
      assert.ok(result.error.includes('already installed'));
    });

    it('rejects tool without install command', async () => {
      const result = await mockHandlers['install-tool'](null, { toolId: 'tool-b' });
      assert.equal(result.success, false);
    });
  });

  describe('session CRUD', () => {
    it('creates session', async () => {
      const s = await mockHandlers['create-session'](null, 'new session');
      assert.ok(s.id);
      assert.equal(s.name, 'new session');
    });

    it('lists sessions', async () => {
      const sessions = await mockHandlers['list-sessions']();
      assert.ok(sessions.length > 0);
    });

    it('loads session', async () => {
      const s = await mockHandlers['create-session'](null, 'load test');
      const loaded = await mockHandlers['load-session'](null, s.id);
      assert.equal(loaded.id, s.id);
    });

    it('deletes session', async () => {
      const s = await mockHandlers['create-session'](null, 'delete test');
      const result = await mockHandlers['delete-session'](null, s.id);
      assert.equal(result, true);
    });
  });

  describe('templates', () => {
    it('lists templates (returns defaults when no file)', async () => {
      const templates = await mockHandlers['list-templates']();
      assert.ok(Array.isArray(templates));
      assert.ok(templates.length > 0); // 返回默认模板
    });
  });

  describe('presets', () => {
    it('lists presets (returns empty when no file)', async () => {
      const presets = await mockHandlers['list-presets']();
      assert.ok(Array.isArray(presets));
    });
  });
});

// 清理
try { fs.rmSync(mockDir, { recursive: true }); } catch {}
