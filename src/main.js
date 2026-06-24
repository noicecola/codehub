const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { AdapterRegistry } = require('./core/registry');
const { MessageRouter } = require('./core/router');
const { SessionManager } = require('./session-manager');
const { FileTracker } = require('./file-tracker');

// 日志
const logFile = path.join('/tmp', 'codehub-main.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logFile, line); } catch(e) {}
  console.log(msg);
}

let mainWindow;
let registry;
let router;
let sessionManager;
let fileTracker;
let currentSessionId = null;

log('Main process started');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: true,
    center: true,
    title: 'CodeHub',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
}

// === 工具 ===

ipcMain.handle('get-tools', () => registry.list());

ipcMain.handle('broadcast-message', async (event, { content, toolIds, workDir }) => {
  log(`broadcast: "${content.substring(0, 50)}" tools=${toolIds}`);
  const results = {};
  const artifacts = {};

  const targetDir = workDir || __dirname;
  const TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟超时

  const promises = toolIds.map(async (toolId) => {
    const adapter = registry.get(toolId);
    if (!adapter) { results[toolId] = { error: `Unknown tool: ${toolId}` }; return; }

    // 快照和工具启动并行执行
    const snapshotPromise = targetDir ? fileTracker.snapshot(toolId, targetDir) : Promise.resolve();

    try {
      const result = await Promise.race([
        adapter.run(content, workDir || targetDir, (chunk) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('stream-chunk', { toolId, chunk });
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
      ]);

      log(`${toolId} done, code=${result.exitCode}, content=${(result.content || '').substring(0, 100)}`);
      results[toolId] = result;

      await snapshotPromise;
      artifacts[toolId] = await fileTracker.diff(toolId, targetDir);
    } catch (err) {
      log(`${toolId} error: ${err.message}`);
      results[toolId] = { error: err.message };
    }
  });

  await Promise.all(promises);
  log('all done');

  if (currentSessionId) {
    sessionManager.addMessage(currentSessionId, { content, toolResults: results, artifacts });
    mainWindow.webContents.send('session-updated', currentSessionId);
  }
  return { results, artifacts };
});

ipcMain.handle('stop-tool', (event, toolId) => router.stop(toolId));

ipcMain.handle('retry-tool', async (event, { toolId, content, workDir }) => {
  const adapter = registry.get(toolId);
  if (!adapter) return { error: `Unknown tool: ${toolId}` };
  const targetDir = workDir || __dirname;
  try {
    const result = await Promise.race([
      adapter.run(content, workDir || targetDir, (chunk) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('stream-chunk', { toolId, chunk });
        }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5 * 60 * 1000)),
    ]);
    if (currentSessionId) {
      sessionManager.updateToolOutput(currentSessionId, toolId, result);
    }
    return result;
  } catch (err) {
    return { error: err.message };
  }
});

// === 产物 ===

ipcMain.handle('read-file', (event, { dir, filePath }) => {
  try { return fs.readFileSync(path.join(dir, filePath), 'utf8'); }
  catch (err) { return `Error: ${err.message}`; }
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
  const adapter = registry.addCustom(tool);
  return { id: adapter.id, name: adapter.name };
});

ipcMain.handle('remove-custom-tool', (event, toolId) => {
  registry.removeCustom(toolId);
  return true;
});

ipcMain.handle('edit-custom-tool', (event, { id, name, command, args }) => {
  registry.editCustom(id, { name, command, args });
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

// === 会话 ===

ipcMain.handle('list-sessions', () => sessionManager.listSessions());

ipcMain.handle('get-latest-session', () => {
  const session = sessionManager.getLatestSession();
  if (session) currentSessionId = session.id;
  return session;
});

ipcMain.handle('create-session', (event, name) => {
  const s = sessionManager.createSession(name);
  currentSessionId = s.id;
  return s;
});

ipcMain.handle('load-session', (event, id) => {
  const s = sessionManager.loadSession(id);
  if (s) currentSessionId = id;
  return s;
});

ipcMain.handle('delete-session', (event, id) => {
  const r = sessionManager.deleteSession(id);
  if (currentSessionId === id) currentSessionId = null;
  return r;
});

ipcMain.handle('get-current-session-id', () => currentSessionId);

// === 目录 ===

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// === 启动 ===

app.whenReady().then(() => {
  registry = new AdapterRegistry();
  router = new MessageRouter(registry);
  sessionManager = new SessionManager();
  fileTracker = new FileTracker();
  createWindow();
  log('App ready');
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
