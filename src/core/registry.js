// === Registry 层 ===
// 适配器注册中心，配置驱动，动态管理工具

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { createAdapterFromConfig, createCustomAdapter } = require('./adapter');
const { ADAPTERS } = require('./adapters.config');

class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
    this.customToolsFile = path.join(app.getPath('userData'), 'custom-tools.json');
    this.init();
  }

  init() {
    // 从配置表批量注册内置适配器
    ADAPTERS.forEach(config => {
      this.register(createAdapterFromConfig(config));
    });

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
    const builtinIds = ADAPTERS.map(a => a.id);
    return this.getAll().map(a => ({
      id: a.id,
      name: a.name,
      available: a.isAvailable(),
      builtin: builtinIds.includes(a.id),
      installCommand: a.getInstallCommand(),
      installUrl: a.getInstallUrl(),
    }));
  }

  // 获取所有工具版本（异步）
  async getVersions() {
    const versions = {};
    const promises = this.getAll().map(async (a) => {
      if (a.isAvailable()) {
        versions[a.id] = await a.getVersion();
      }
    });
    await Promise.all(promises);
    return versions;
  }

  // 获取未安装工具的安装命令
  getInstallableTools() {
    return this.getAll()
      .filter(a => !a.isAvailable() && a.getInstallCommand())
      .map(a => ({
        id: a.id,
        name: a.name,
        installCommand: a.getInstallCommand(),
      }));
  }

  getInstallInfo(toolId) {
    const adapter = this.adapters.get(toolId);
    if (!adapter) return null;
    return {
      id: adapter.id,
      name: adapter.name,
      installCommand: adapter.getInstallCommand(),
      installUrl: adapter.getInstallUrl(),
      available: adapter.isAvailable(),
    };
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
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Failed to load custom tools:', err.message);
      }
    }
  }

  saveCustomTools() {
    const builtinIds = ADAPTERS.map(a => a.id);
    const tools = this.getAll()
      .filter(a => !builtinIds.includes(a.id))
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
    if (Array.isArray(updates.args) && updates.args.length > 0) adapter.args = updates.args;
    this.saveCustomTools();
  }
}

module.exports = { AdapterRegistry };
