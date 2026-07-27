// === IPC Handler 层 ===
// 所有 ipcMain.handle 注册，按功能分组

const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');
const { spawn } = require('child_process');
const { IPC } = require('./ipc-channels');

function registerHandlers({ registry, router, sessionManager, fileTracker, getMainWindow, getCurrentSessionId, setCurrentSessionId, log }) {

  const TIMEOUT_MS = 5 * 60 * 1000;

  // 可重试的错误类型：超时、进程级异常（EPIPE/ENOENT 等）
  // 不重试：非零退出码（正常业务行为）、用户取消
  function isRetryableError(err) {
    if (err.message === 'timeout') return true;
    if (err.code === 'EPIPE' || err.code === 'ENOENT' || err.code === 'EACCES') return true;
    if (err.message?.includes('spawn') || err.message?.includes('fork')) return true;
    return false;
  }

  // === 工具 ===

  ipcMain.handle(IPC.GET_TOOLS, () => registry.list());

  ipcMain.handle(IPC.GET_TOOL_VERSIONS, async () => {
    try {
      return await registry.getVersions();
    } catch (err) {
      log(`get-tool-versions error: ${err.message}`);
      return {};
    }
  });

  ipcMain.handle(IPC.GET_INSTALLABLE_TOOLS, () => registry.getInstallableTools());

  ipcMain.handle(IPC.BATCH_INSTALL, async (event, { toolIds }) => {
    const results = {};
    const mainWindow = getMainWindow();

    for (const toolId of toolIds) {
      const info = registry.getInstallInfo(toolId);
      if (!info || !info.installCommand) {
        results[toolId] = { success: false, error: 'No install command' };
        continue;
      }
      if (info.available) {
        results[toolId] = { success: false, error: 'Already installed' };
        continue;
      }

      try {
        const result = await new Promise((resolve) => {
          const { spawn } = require('child_process');
          const proc = spawn('sh', ['-c', info.installCommand], {
            stdio: ['ignore', 'pipe', 'pipe'],
          });

          let stdout = '', stderr = '';
          proc.stdout.on('data', (d) => { stdout += d.toString(); });
          proc.stderr.on('data', (d) => { stderr += d.toString(); });

          const timeout = setTimeout(() => {
            proc.kill('SIGTERM');
            resolve({ success: false, error: 'Timeout' });
          }, 5 * 60 * 1000);

          proc.on('close', (code) => {
            clearTimeout(timeout);
            if (code === 0) {
              results[toolId] = { success: true };
            } else {
              results[toolId] = { success: false, error: stderr || stdout || `Exit code ${code}` };
            }
          });

          proc.on('error', (err) => {
            clearTimeout(timeout);
            results[toolId] = { success: false, error: err.message };
          });
        });
      } catch (err) {
        results[toolId] = { success: false, error: err.message };
      }
    }

    return results;
  });

  ipcMain.handle(IPC.BROADCAST_MESSAGE, async (event, { content, toolIds, workDir }) => {
    log(`broadcast: "${content.substring(0, 50)}" tools=${toolIds}`);
    const results = {};
    const artifacts = {};
    const mainWindow = getMainWindow();
    const targetDir = workDir || os.homedir();
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
                mainWindow.webContents.send(IPC.STREAM_CHUNK, { toolId, chunk });
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
          // 非零退出码视为错误，确保前端展示错误状态
          if (result.exitCode !== 0 && !result.error) {
            result.error = result.content || `Process exited with code ${result.exitCode}`;
          }
          results[toolId] = result;

          await snapshotPromise;
          artifacts[toolId] = await fileTracker.diff(toolId, targetDir);

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC.TOOL_DONE, { toolId, result: { ...result }, artifacts: artifacts[toolId] || [] });
          }
          return;
        } catch (err) {
          clearTimeout(timeoutId);
          adapter.stop();
          const elapsed = Date.now() - startTime;
          log(`${toolId} error: ${err.message} (${elapsed}ms), attempt=${attempt}`);

          if (attempt < MAX_RETRIES && isRetryableError(err)) {
            log(`${toolId} will retry in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          results[toolId] = { error: err.message, elapsed };
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC.TOOL_DONE, { toolId, result: { error: err.message, elapsed }, artifacts: [] });
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
        mainWindow.webContents.send(IPC.SESSION_UPDATED, sessionId);
      }
    }
    return { results, artifacts };
  });

  ipcMain.handle(IPC.STOP_TOOL, (event, toolId) => router.stop(toolId));

  // === 一键安装 ===

  const installProcesses = new Map();

  ipcMain.handle(IPC.INSTALL_TOOL, async (event, { toolId }) => {
    const info = registry.getInstallInfo(toolId);
    if (!info) return { success: false, error: `Unknown tool: ${toolId}` };
    if (info.available) return { success: false, error: 'Tool is already installed' };
    if (!info.installCommand) return { success: false, error: 'No install command configured' };

    const mainWindow = getMainWindow();
    const sendProgress = (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.INSTALL_PROGRESS, { toolId, ...data });
      }
    };

    // 防重复点击
    if (installProcesses.has(toolId)) {
      return { success: false, error: 'Installation already in progress' };
    }

    sendProgress({ status: 'installing', message: `Running: ${info.installCommand}` });

    return new Promise((resolve) => {
      const proc = spawn('sh', ['-c', info.installCommand], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      installProcesses.set(toolId, proc);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        sendProgress({ status: 'installing', message: text.trim() });
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        sendProgress({ status: 'installing', message: text.trim() });
      });

      // 超时保护：5 分钟
      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        installProcesses.delete(toolId);
        sendProgress({ status: 'error', message: 'Installation timed out (5 min)' });
        resolve({ success: false, error: 'Installation timed out' });
      }, 5 * 60 * 1000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        installProcesses.delete(toolId);

        if (code === 0) {
          // 安装后验证
          const adapter = registry.get(toolId);
          const verified = adapter ? adapter.isAvailable() : false;
          if (verified) {
            sendProgress({ status: 'completed', message: 'Installation successful' });
            log(`install ${toolId} success`);
            resolve({ success: true });
          } else {
            sendProgress({ status: 'error', message: 'Installed but command not found in PATH' });
            log(`install ${toolId} completed but verification failed`);
            resolve({ success: false, error: 'Installed but command not found in PATH. You may need to restart the terminal or add the tool to your PATH.' });
          }
        } else {
          const errorMsg = stderr || stdout || `Process exited with code ${code}`;
          sendProgress({ status: 'error', message: errorMsg });
          log(`install ${toolId} failed: code=${code}`);
          resolve({ success: false, error: errorMsg });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        installProcesses.delete(toolId);
        sendProgress({ status: 'error', message: err.message });
        log(`install ${toolId} error: ${err.message}`);
        resolve({ success: false, error: err.message });
      });
    });
  });

  ipcMain.handle(IPC.CANCEL_INSTALL, (event, { toolId }) => {
    const proc = installProcesses.get(toolId);
    if (proc) {
      proc.kill('SIGTERM');
      installProcesses.delete(toolId);
      return true;
    }
    return false;
  });

  ipcMain.handle(IPC.RETRY_TOOL, async (event, { toolId, content, workDir }) => {
    const adapter = registry.get(toolId);
    if (!adapter) return { error: `Unknown tool: ${toolId}` };
    const targetDir = workDir || os.homedir();
    const mainWindow = getMainWindow();
    let timeoutId;
    try {
      const result = await Promise.race([
        adapter.run(content, workDir || targetDir, (chunk) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC.STREAM_CHUNK, { toolId, chunk });
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

  ipcMain.handle(IPC.READ_FILE, (event, { dir, filePath }) => {
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

  ipcMain.handle(IPC.EXPORT_SESSION, async (event, { sessionId, format }) => {
    const session = sessionManager.loadSession(sessionId);
    if (!session) return null;
    const ext = format === 'json' ? 'json' : 'md';
    const result = await dialog.showSaveDialog(getMainWindow(), {
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
        if (msg.toolResults || msg.toolOutputs) {
          for (const [toolId, r] of Object.entries(msg.toolResults || msg.toolOutputs)) {
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

  // command 字段白名单校验：只允许字母数字、@、-、_、.、/（覆盖 scoped package 和 Go 路径格式）
  const SAFE_COMMAND_RE = /^[\w@\-./]+$/;
  const MAX_COMMAND_LEN = 200;

  function validateCommand(command) {
    if (!command || typeof command !== 'string') return 'Command is required';
    if (command.length > MAX_COMMAND_LEN) return `Command exceeds ${MAX_COMMAND_LEN} characters`;
    if (!SAFE_COMMAND_RE.test(command)) return 'Command contains invalid characters (allowed: letters, digits, @, -, _, ., /)';
    return null;
  }

  ipcMain.handle(IPC.ADD_CUSTOM_TOOL, (event, tool) => {
    if (!tool || !tool.name) return { error: 'Name is required' };
    if (tool.command) {
      const err = validateCommand(tool.command);
      if (err) return { error: err };
    }
    const adapter = registry.addCustom(tool);
    return { id: adapter.id, name: adapter.name };
  });

  ipcMain.handle(IPC.REMOVE_CUSTOM_TOOL, (event, toolId) => {
    if (!toolId) return false;
    registry.removeCustom(toolId);
    return true;
  });

  ipcMain.handle(IPC.EDIT_CUSTOM_TOOL, (event, { id, name, command, args }) => {
    if (!id) return false;
    if (command) {
      const err = validateCommand(command);
      if (err) return { error: err };
    }
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

  ipcMain.handle(IPC.LIST_TEMPLATES, () => loadTemplates());
  ipcMain.handle(IPC.SAVE_TEMPLATE, (event, tpl) => {
    const t = loadTemplates();
    const idx = t.findIndex(x => x.id === tpl.id);
    if (idx >= 0) t[idx] = tpl; else { tpl.id = `tpl-${Date.now()}`; t.push(tpl); }
    saveTemplates(t);
    return tpl;
  });
  ipcMain.handle(IPC.DELETE_TEMPLATE, (event, id) => {
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

  ipcMain.handle(IPC.LIST_PRESETS, () => loadPresets());
  ipcMain.handle(IPC.SAVE_PRESET, (event, preset) => {
    const p = loadPresets();
    const idx = p.findIndex(x => x.id === preset.id);
    if (idx >= 0) p[idx] = preset; else { preset.id = `tpl-${Date.now()}`; p.push(preset); }
    savePresets(p);
    return preset;
  });
  ipcMain.handle(IPC.DELETE_PRESET, (event, id) => {
    savePresets(loadPresets().filter(p => p.id !== id));
    return true;
  });

  // === 会话 ===

  ipcMain.handle(IPC.LIST_SESSIONS, () => sessionManager.listSessions());

  ipcMain.handle(IPC.SEARCH_SESSIONS, (event, query) => sessionManager.searchSessions(query));

  ipcMain.handle(IPC.GET_LATEST_SESSION, () => {
    const session = sessionManager.getLatestSession();
    if (session) setCurrentSessionId(session.id);
    return session;
  });

  ipcMain.handle(IPC.CREATE_SESSION, (event, name) => {
    const s = sessionManager.createSession(name);
    setCurrentSessionId(s.id);
    return s;
  });

  ipcMain.handle(IPC.LOAD_SESSION, (event, id) => {
    const s = sessionManager.loadSession(id);
    if (s) setCurrentSessionId(id);
    return s;
  });

  ipcMain.handle(IPC.DELETE_SESSION, (event, id) => {
    const r = sessionManager.deleteSession(id);
    if (getCurrentSessionId() === id) setCurrentSessionId(null);
    return r;
  });

  ipcMain.handle(IPC.UPDATE_SESSION_TAGS, (event, { sessionId, tags }) => {
    const session = sessionManager.loadSession(sessionId);
    if (!session) return null;
    session.tags = tags;
    return sessionManager.saveSession(session);
  });

  // === 目录 ===

  ipcMain.handle(IPC.SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), { properties: ['openDirectory'] });
    if (result.canceled) return null;
    return result.filePaths[0];
  });
}

module.exports = { registerHandlers };
