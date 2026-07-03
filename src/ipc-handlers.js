// === IPC Handler 层 ===
// 所有 ipcMain.handle 注册，按功能分组

const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

function registerHandlers({ registry, router, sessionManager, fileTracker, getMainWindow, getCurrentSessionId, setCurrentSessionId, log }) {

  const TIMEOUT_MS = 5 * 60 * 1000;

  // === 工具 ===

  ipcMain.handle('get-tools', () => registry.list());

  ipcMain.handle('broadcast-message', async (event, { content, toolIds, workDir }) => {
    log(`broadcast: "${content.substring(0, 50)}" tools=${toolIds}`);
    const results = {};
    const artifacts = {};
    const mainWindow = getMainWindow();
    const targetDir = workDir || __dirname;
    const MAX_RETRIES = 1;

    const promises = toolIds.map(async (toolId) => {
      const adapter = registry.get(toolId);
      if (!adapter) { results[toolId] = { error: `Unknown tool: ${toolId}` }; return; }

      const snapshotPromise = targetDir ? fileTracker.snapshot(toolId, targetDir) : Promise.resolve();
      const startTime = Date.now();

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        let timeoutId;
        try {
          if (attempt > 0) log(`${toolId} retry #${attempt}`);
          const result = await Promise.race([
            adapter.run(content, workDir || targetDir, (chunk) => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('stream-chunk', { toolId, chunk });
              }
            }),
            new Promise((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
            }),
          ]);

          clearTimeout(timeoutId);
          const elapsed = Date.now() - startTime;
          log(`${toolId} done, code=${result.exitCode}, ${elapsed}ms`);
          result.elapsed = elapsed;
          results[toolId] = result;

          await snapshotPromise;
          artifacts[toolId] = await fileTracker.diff(toolId, targetDir);

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('tool-done', { toolId, result: { ...result }, artifacts: artifacts[toolId] || [] });
          }
          return;
        } catch (err) {
          clearTimeout(timeoutId);
          adapter.stop();
          const elapsed = Date.now() - startTime;
          log(`${toolId} error: ${err.message} (${elapsed}ms), attempt=${attempt}`);

          if (attempt < MAX_RETRIES && err.message === 'timeout') {
            log(`${toolId} will retry in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          results[toolId] = { error: err.message, elapsed };
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('tool-done', { toolId, result: { error: err.message, elapsed }, artifacts: [] });
          }
        }
      }
    });

    await Promise.all(promises);
    log('all done');

    const sessionId = getCurrentSessionId();
    if (sessionId) {
      sessionManager.addMessage(sessionId, { content, toolResults: results, artifacts });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('session-updated', sessionId);
      }
    }
    return { results, artifacts };
  });

  ipcMain.handle('stop-tool', (event, toolId) => router.stop(toolId));

  ipcMain.handle('retry-tool', async (event, { toolId, content, workDir }) => {
    const adapter = registry.get(toolId);
    if (!adapter) return { error: `Unknown tool: ${toolId}` };
    const targetDir = workDir || __dirname;
    const mainWindow = getMainWindow();
    let timeoutId;
    try {
      const result = await Promise.race([
        adapter.run(content, workDir || targetDir, (chunk) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stream-chunk', { toolId, chunk });
          }
        }),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
        }),
      ]);
      clearTimeout(timeoutId);
      const sessionId = getCurrentSessionId();
      if (sessionId) {
        sessionManager.updateToolOutput(sessionId, toolId, result);
      }
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      adapter.stop();
      return { error: err.message };
    }
  });

  // === 产物 ===

  ipcMain.handle('read-file', (event, { dir, filePath }) => {
    try {
      const resolved = path.resolve(dir, filePath);
      if (!resolved.startsWith(path.resolve(dir))) {
        return { error: 'Invalid path' };
      }
      return { content: fs.readFileSync(resolved, 'utf8') };
    } catch (err) {
      return { error: err.message };
    }
  });

  // === 导出 ===

  ipcMain.handle('export-session', async (event, { sessionId, format }) => {
    const session = sessionManager.loadSession(sessionId);
    if (!session) return null;
    const ext = format === 'json' ? 'json' : 'md';
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${session.name}.${ext}`,
      filters: [{ name: format === 'json' ? 'JSON' : 'Markdown', extensions: [ext] }],
    });
    if (result.canceled) return null;

    let content;
    if (format === 'json') {
      content = JSON.stringify(session, null, 2);
    } else {
      content = `# ${session.name}\n\n创建时间: ${new Date(session.createdAt).toLocaleString('zh-CN')}\n\n---\n\n`;
      session.messages.forEach((msg, i) => {
        content += `## 消息 ${i + 1}\n\n**你:** ${msg.content}\n\n`;
        if (msg.toolResults) {
          for (const [toolId, r] of Object.entries(msg.toolResults)) {
            content += `**${toolId}:**\n\n${r.content || r.error || '(无输出)'}\n\n`;
          }
        }
        content += `---\n\n`;
      });
    }
    fs.writeFileSync(result.filePath, content, 'utf8');
    return result.filePath;
  });

  // === 自定义工具 ===

  ipcMain.handle('add-custom-tool', (event, tool) => {
    if (!tool || !tool.name) return { error: 'Name is required' };
    const adapter = registry.addCustom(tool);
    return { id: adapter.id, name: adapter.name };
  });

  ipcMain.handle('remove-custom-tool', (event, toolId) => {
    if (!toolId) return false;
    registry.removeCustom(toolId);
    return true;
  });

  ipcMain.handle('edit-custom-tool', (event, { id, name, command, args }) => {
    if (!id) return false;
    const updates = {};
    if (name) updates.name = name;
    if (command) updates.command = command;
    if (args && args.length > 0) updates.args = args;
    registry.editCustom(id, updates);
    return true;
  });

  // === 模板 ===

  const templatesFile = path.join(app.getPath('userData'), 'templates.json');
  function loadTemplates() {
    try { return JSON.parse(fs.readFileSync(templatesFile, 'utf8')); }
    catch {
      return [
        { id: 'explain', name: '解释代码', content: '请解释以下代码的功能和逻辑：\n\n' },
        { id: 'review', name: '代码审查', content: '请审查以下代码，指出问题和改进建议：\n\n' },
        { id: 'refactor', name: '重构代码', content: '请重构以下代码，提升可读性和性能：\n\n' },
        { id: 'test', name: '写测试', content: '请为以下代码编写单元测试：\n\n' },
        { id: 'debug', name: '调试问题', content: '请帮我调试以下问题：\n\n错误信息：\n相关代码：\n' },
      ];
    }
  }
  function saveTemplates(t) { fs.writeFileSync(templatesFile, JSON.stringify(t, null, 2), 'utf8'); }

  ipcMain.handle('list-templates', () => loadTemplates());
  ipcMain.handle('save-template', (event, tpl) => {
    const t = loadTemplates();
    const idx = t.findIndex(x => x.id === tpl.id);
    if (idx >= 0) t[idx] = tpl; else { tpl.id = `tpl-${Date.now()}`; t.push(tpl); }
    saveTemplates(t);
    return tpl;
  });
  ipcMain.handle('delete-template', (event, id) => {
    saveTemplates(loadTemplates().filter(t => t.id !== id));
    return true;
  });

  // === 工具预设 ===

  const presetsFile = path.join(app.getPath('userData'), 'presets.json');
  function loadPresets() {
    try { return JSON.parse(fs.readFileSync(presetsFile, 'utf8')); }
    catch { return []; }
  }
  function savePresets(p) { fs.writeFileSync(presetsFile, JSON.stringify(p, null, 2), 'utf8'); }

  ipcMain.handle('list-presets', () => loadPresets());
  ipcMain.handle('save-preset', (event, preset) => {
    const p = loadPresets();
    const idx = p.findIndex(x => x.id === preset.id);
    if (idx >= 0) p[idx] = preset; else { preset.id = `tpl-${Date.now()}`; p.push(preset); }
    savePresets(p);
    return preset;
  });
  ipcMain.handle('delete-preset', (event, id) => {
    savePresets(loadPresets().filter(p => p.id !== id));
    return true;
  });

  // === 会话 ===

  ipcMain.handle('list-sessions', () => sessionManager.listSessions());

  ipcMain.handle('search-sessions', (event, query) => sessionManager.searchSessions(query));

  ipcMain.handle('get-latest-session', () => {
    const session = sessionManager.getLatestSession();
    if (session) setCurrentSessionId(session.id);
    return session;
  });

  ipcMain.handle('create-session', (event, name) => {
    const s = sessionManager.createSession(name);
    setCurrentSessionId(s.id);
    return s;
  });

  ipcMain.handle('load-session', (event, id) => {
    const s = sessionManager.loadSession(id);
    if (s) setCurrentSessionId(id);
    return s;
  });

  ipcMain.handle('delete-session', (event, id) => {
    const r = sessionManager.deleteSession(id);
    if (getCurrentSessionId() === id) setCurrentSessionId(null);
    return r;
  });

  ipcMain.handle('update-session-tags', (event, { sessionId, tags }) => {
    const session = sessionManager.loadSession(sessionId);
    if (!session) return null;
    session.tags = tags;
    return sessionManager.saveSession(session);
  });

  // === 目录 ===

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (result.canceled) return null;
    return result.filePaths[0];
  });
}

module.exports = { registerHandlers };
