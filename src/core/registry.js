// === Registry 层 ===
// 适配器注册中心，动态管理工具

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { createClaudeCodeAdapter, createMimoCodeAdapter, createCustomAdapter } = require('./adapter');

class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
    this.customToolsFile = path.join(app.getPath('userData'), 'custom-tools.json');
    this.init();
  }

  init() {
    // 注册内置适配器
    this.register(createClaudeCodeAdapter());
    this.register(createMimoCodeAdapter());

    // 加载自定义适配器
    this.loadCustomTools();
  }

  register(adapter) {
    this.adapters.set(adapter.id, adapter);
  }

  unregister(id) {
    this.adapters.delete(id);
  }

  get(id) {
    return this.adapters.get(id);
  }

  getAll() {
    return Array.from(this.adapters.values());
  }

  list() {
    return this.getAll().map(a => ({
      id: a.id,
      name: a.name,
      available: a.isAvailable(),
      builtin: ['claude-code', 'mimo-code'].includes(a.id),
    }));
  }

  // === 自定义工具持久化 ===

  loadCustomTools() {
    try {
      const tools = JSON.parse(fs.readFileSync(this.customToolsFile, 'utf8'));
      tools.forEach(tool => {
        if (!this.adapters.has(tool.id)) {
          this.register(createCustomAdapter(tool));
        }
      });
    } catch {}
  }

  saveCustomTools() {
    const tools = this.getAll()
      .filter(a => !['claude-code', 'mimo-code'].includes(a.id))
      .map(a => ({
        id: a.id,
        name: a.name,
        type: a.transport instanceof require('./transport').HTTPTransport ? 'http' : 'cli',
        command: a.transport.command || '',
        url: a.transport.baseUrl || '',
        path: a.transport.options?.path || '',
        args: a.args.join(' '),
      }));
    fs.writeFileSync(this.customToolsFile, JSON.stringify(tools, null, 2), 'utf8');
  }

  addCustom(tool) {
    const adapter = createCustomAdapter(tool);
    this.register(adapter);
    this.saveCustomTools();
    return adapter;
  }

  removeCustom(id) {
    this.unregister(id);
    this.saveCustomTools();
  }

  editCustom(id, updates) {
    const adapter = this.adapters.get(id);
    if (!adapter) return;
    if (updates.name) adapter.name = updates.name;
    if (updates.command) adapter.transport.command = updates.command;
    if (updates.args) adapter.args = updates.args;
    this.saveCustomTools();
  }
}

module.exports = { AdapterRegistry };
