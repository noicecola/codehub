let selectedTools = new Set();
let isRunning = false;
let currentSessionId = null;
let lastResults = {};
let lastArtifacts = {};
let currentWorkDir = '';

// === 初始化 ===

async function init() {
  const tools = await window.codehub.getTools();
  renderToolSelector(tools);
  setupEventListeners();
  await loadOrCreateSession();
}

// === 工具选择 ===

function renderToolSelector(tools) {
  const container = document.getElementById('tool-selector');
  container.innerHTML = '';
  tools.forEach(tool => {
    const label = document.createElement('label');
    label.className = `tool-checkbox ${tool.available ? '' : 'unavailable'}`;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = tool.available;
    cb.disabled = !tool.available;
    if (tool.available) selectedTools.add(tool.id);
    cb.addEventListener('change', (e) => {
      e.target.checked ? selectedTools.add(tool.id) : selectedTools.delete(tool.id);
      label.classList.toggle('selected', e.target.checked);
      updateSendButton();
      updateSelectedInfo();
    });
    if (tool.available) label.classList.add('selected');
    const statusLabel = document.createElement('span');
    statusLabel.className = 'tool-status idle';
    statusLabel.id = `status-${tool.id}`;
    statusLabel.textContent = '就绪';
    const txt = document.createElement('span');
    txt.textContent = tool.available ? tool.name : `${tool.name} (未安装)`;
    const toolLabel = document.createElement('span');
    toolLabel.className = 'tool-label';
    toolLabel.append(statusLabel, txt);
    label.append(cb, toolLabel);
    container.appendChild(label);
  });
  updateSelectedInfo();
}

function updateSelectedInfo() {
  document.getElementById('selected-tools-info').textContent =
    selectedTools.size === 0 ? '未选择工具' : `已选择 ${selectedTools.size} 个工具`;
}

function updateSendButton() {
  document.getElementById('send-btn').disabled = selectedTools.size === 0 || isRunning;
}

// === 事件监听 ===

function setupEventListeners() {
  // 侧边栏折叠
  document.getElementById('sidebar-toggle-btn').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    const btn = document.getElementById('sidebar-toggle-btn');
    btn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
  });

  document.getElementById('message-input').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('stop-btn').addEventListener('click', stopAll);
  document.getElementById('new-session-btn').addEventListener('click', createNewSession);
  document.getElementById('compare-btn').addEventListener('click', showCompareModal);
  document.getElementById('artifacts-btn').addEventListener('click', showArtifactsModal);
  document.getElementById('export-btn').addEventListener('click', showExportModal);
  document.getElementById('manage-tools-btn').addEventListener('click', showToolsModal);
  document.getElementById('manage-templates-btn').addEventListener('click', showTemplatesModal);
  document.getElementById('template-btn').addEventListener('click', toggleTemplateDropdown);
  document.getElementById('browse-dir-btn').addEventListener('click', browseDirectory);

  modalManager.init();

  // 导出选项
  document.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', () => exportSession(btn.dataset.format));
  });

  // 添加自定义工具
  document.getElementById('add-tool-btn').addEventListener('click', addCustomTool);

  // 添加模板
  document.getElementById('add-tpl-btn').addEventListener('click', addTemplate);

  window.codehub.onStreamChunk(({ toolId, chunk }) => appendToOutput(toolId, chunk));
  window.codehub.onSessionUpdated(() => refreshSessionList());

  // 点击其他地方关闭下拉
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#template-btn') && !e.target.closest('#template-dropdown')) {
      document.getElementById('template-dropdown').classList.add('hidden');
    }
  });
}

// === 消息发送 ===

async function sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content || selectedTools.size === 0) return;
  if (!currentSessionId) return;

  isRunning = true;
  updateSendButton();
  document.getElementById('send-btn').style.display = 'none';
  document.getElementById('stop-btn').style.display = 'inline-block';

  // 追加用户消息到各面板
  appendUserMessage(content);
  selectedTools.forEach(id => updatePanelStatus(id, 'running'));

  const workDir = currentWorkDir || document.getElementById('work-dir-select').value || '';

  try {
    const { results, artifacts } = await window.codehub.broadcastMessage({
      content, toolIds: Array.from(selectedTools), workDir,
    });
    lastResults = results;
    lastArtifacts = artifacts || {};
    document.getElementById('artifacts-btn').style.display =
      Object.values(lastArtifacts).some(a => a?.length > 0) ? 'inline-block' : 'none';

    // 完成各工具输出
    for (const [toolId, result] of Object.entries(results)) {
      finalizeOutput(toolId, result.content || result.error, !!result.error);
      updatePanelStatus(toolId, result.error ? 'error' : 'completed');
    }
  } catch (err) {
    selectedTools.forEach(id => {
      finalizeOutput(id, err.message, true);
      updatePanelStatus(id, 'error');
    });
  }

  isRunning = false;
  updateSendButton();
  document.getElementById('send-btn').style.display = 'inline-block';
  document.getElementById('stop-btn').style.display = 'none';
  input.value = '';

  await refreshSessionList();
}

function stopAll() {
  selectedTools.forEach(id => {
    window.codehub.stopTool(id);
    updatePanelStatus(id, 'idle');
  });
  isRunning = false;
  updateSendButton();
  document.getElementById('send-btn').style.display = 'inline-block';
  document.getElementById('stop-btn').style.display = 'none';
}

// === 输出面板 ===

function showToolPanels() {
  document.getElementById('welcome-screen').classList.add('hidden');
  document.getElementById('tool-panels').classList.remove('hidden');
}

function appendUserMessage(content) {
  showToolPanels();
  selectedTools.forEach(toolId => {
    const panel = document.getElementById(`panel-content-${toolId}`);
    if (!panel) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'panel-user-msg';
    msgDiv.textContent = `> ${content}`;
    panel.appendChild(msgDiv);
  });
  scrollAllPanels();
}

function appendToOutput(toolId, text) {
  const panel = document.getElementById(`panel-content-${toolId}`);
  if (!panel) return;
  // 查找或创建当前回复块
  let reply = panel.querySelector('.panel-reply:last-child');
  if (!reply || reply.dataset.done === 'true') {
    reply = document.createElement('div');
    reply.className = 'panel-reply';
    panel.appendChild(reply);
  }
  reply.textContent += text;
  scrollPanel(toolId);
}

function finalizeOutput(toolId, content, isError) {
  const panel = document.getElementById(`panel-content-${toolId}`);
  if (!panel) return;
  let reply = panel.querySelector('.panel-reply:last-child');
  if (!reply) {
    reply = document.createElement('div');
    reply.className = 'panel-reply';
    if (isError) reply.classList.add('panel-reply-error');
    reply.textContent = content || '(无输出)';
    panel.appendChild(reply);
  } else {
    reply.dataset.done = 'true';
    if (isError) reply.classList.add('panel-reply-error');
  }
  scrollPanel(toolId);
}

function updatePanelStatus(toolId, status) {
  const el = document.getElementById(`panel-status-${toolId}`);
  if (el) {
    const labels = { idle: '就绪', running: '运行中...', completed: '完成', error: '错误' };
    el.textContent = labels[status] || status;
    el.className = `tool-panel-status status-${status}`;
  }
}

function scrollPanel(toolId) {
  const panel = document.getElementById(`panel-content-${toolId}`);
  if (panel) panel.scrollTop = panel.scrollHeight;
}

function scrollAllPanels() {
  selectedTools.forEach(id => scrollPanel(id));
}

function clearOutput() {
  document.getElementById('welcome-screen').classList.remove('hidden');
  document.getElementById('tool-panels').classList.add('hidden');
  // 清空所有面板内容
  document.querySelectorAll('.tool-panel-content').forEach(el => el.innerHTML = '');
}

// === 产物浏览 ===

function showArtifactsModal() {
  const allFiles = [];
  for (const [toolId, files] of Object.entries(lastArtifacts)) {
    if (files?.length) files.forEach(f => allFiles.push({ ...f, toolId }));
  }
  if (!allFiles.length) { toast.info('暂无产物'); return; }
  const fileList = document.getElementById('artifacts-file-list');
  const fileContent = document.getElementById('artifacts-file-content');
  fileList.innerHTML = '';
  fileContent.innerHTML = '<p class="placeholder">选择文件查看内容</p>';
  allFiles.forEach(f => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `<span class="file-badge ${f.type}">${f.type === 'created' ? '新' : f.type === 'modified' ? '改' : '删'}</span><span title="${f.path}">${f.path.split('/').pop()}</span>`;
    item.addEventListener('click', () => {
      document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      loadFileContent(f);
    });
    fileList.appendChild(item);
  });
  modalManager.open('artifacts-modal');
}

async function loadFileContent(file) {
  const el = document.getElementById('artifacts-file-content');
  if (file.type === 'deleted') { el.innerHTML = `<pre style="color:var(--danger)">[已删除] ${file.path}</pre>`; return; }
  el.innerHTML = '<p class="placeholder">加载中...</p>';
  try {
    const content = await window.codehub.readFile({
      dir: currentWorkDir || document.getElementById('work-dir-select').value || '.',
      filePath: file.path,
    });
    el.innerHTML = content.startsWith('Error')
      ? `<pre style="color:var(--danger)">${esc(content)}</pre>`
      : `<pre>${esc(content)}</pre>`;
  } catch (err) { el.innerHTML = `<pre style="color:var(--danger)">${err.message}</pre>`; }
}

// === 结果对比 ===

function showCompareModal() {
  if (!Object.keys(lastResults).length) { toast.info('暂无结果'); return; }
  const viewer = new DiffViewer('compare-content');
  viewer.render(lastResults);
  modalManager.open('compare-modal');
}

// === 导出 ===

function showExportModal() {
  if (!currentSessionId) { toast.info('请先选择会话'); return; }
  modalManager.open('export-modal');
}

async function exportSession(format) {
  const path = await window.codehub.exportSession({ sessionId: currentSessionId, format });
  modalManager.closeById('export-modal');
  if (path) toast.success(`已导出: ${path}`);
}

// === 模板 ===

async function toggleTemplateDropdown() {
  const dropdown = document.getElementById('template-dropdown');
  const isHidden = dropdown.classList.contains('hidden');
  if (isHidden) {
    const templates = await window.codehub.listTemplates();
    const list = document.getElementById('template-list');
    list.innerHTML = '';
    if (!templates.length) {
      list.innerHTML = '<div class="dropdown-item" style="color:var(--text-secondary)">暂无模板，请在模板管理中添加</div>';
    } else {
      templates.forEach(tpl => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.innerHTML = `<div class="tpl-name">${esc(tpl.name)}</div><div class="tpl-preview">${esc(tpl.content.substring(0, 50))}</div>`;
        item.addEventListener('click', () => {
          document.getElementById('message-input').value = tpl.content;
          dropdown.classList.add('hidden');
        });
        list.appendChild(item);
      });
    }
  }
  dropdown.classList.toggle('hidden', !isHidden);
}

async function showTemplatesModal() {
  const templates = await window.codehub.listTemplates();
  const list = document.getElementById('templates-list');
  list.innerHTML = '';
  templates.forEach(tpl => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="item-info">
        <div class="item-name">${esc(tpl.name)}</div>
        <div class="item-detail">${esc(tpl.content.substring(0, 60))}</div>
      </div>
      <button class="delete-btn" data-id="${tpl.id}">&times;</button>`;
    item.querySelector('.delete-btn').addEventListener('click', async () => {
      await window.codehub.deleteTemplate(tpl.id);
      showTemplatesModal();
    });
    list.appendChild(item);
  });
  document.getElementById('templates-modal').classList.remove('hidden');
}

async function addTemplate() {
  const name = document.getElementById('tpl-name-input').value.trim();
  const content = document.getElementById('tpl-content-input').value.trim();
  if (!name || !content) { toast.info('请填写名称和内容'); return; }
  await window.codehub.saveTemplate({ name, content });
  document.getElementById('tpl-name-input').value = '';
  document.getElementById('tpl-content-input').value = '';
  showTemplatesModal();
}

// === 工具管理 ===

async function showToolsModal() {
  const tools = await window.codehub.getTools();
  const list = document.getElementById('tools-list');
  list.innerHTML = '';
  tools.forEach(tool => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="item-info">
        <div class="item-name">${esc(tool.name)}</div>
        <div class="item-detail">${tool.builtin ? '内置' : '自定义'} · ${tool.available ? '可用' : '未安装'}</div>
      </div>
      ${!tool.builtin ? `<button class="delete-btn" data-id="${tool.id}">&times;</button>` : ''}`;
    item.querySelector('.delete-btn')?.addEventListener('click', async () => {
      await window.codehub.removeCustomTool(tool.id);
      showToolsModal();
      await refreshToolSelector();
    });
    list.appendChild(item);
  });
  document.getElementById('tools-modal').classList.remove('hidden');
}

async function addCustomTool() {
  const name = document.getElementById('tool-name-input').value.trim();
  const command = document.getElementById('tool-command-input').value.trim();
  const argsStr = document.getElementById('tool-args-input').value.trim();
  if (!name || !command) { toast.info('请填写名称和命令'); return; }
  const args = argsStr ? argsStr.split(/\s+/) : [];
  await window.codehub.addCustomTool({ name, command, args });
  document.getElementById('tool-name-input').value = '';
  document.getElementById('tool-command-input').value = '';
  document.getElementById('tool-args-input').value = '';
  showToolsModal();
  await refreshToolSelector();
}

async function refreshToolSelector() {
  const tools = await window.codehub.getTools();
  renderToolSelector(tools);
}

// === 目录 ===

async function browseDirectory() {
  const dir = await window.codehub.selectDirectory();
  if (dir) {
    currentWorkDir = dir;
    const select = document.getElementById('work-dir-select');
    const opt = document.createElement('option');
    opt.value = dir;
    opt.textContent = dir.split('/').pop();
    opt.selected = true;
    select.appendChild(opt);
  }
}

// === 会话管理 ===

async function loadOrCreateSession() {
  const session = await window.codehub.getLatestSession();
  if (session) {
    currentSessionId = session.id;
    await refreshSessionList();
    renderSessionHistory(session);
  } else {
    const s = await window.codehub.createSession();
    currentSessionId = s.id;
    await refreshSessionList();
    clearOutput();
  }
}

async function refreshSessionList() {
  const sessions = await window.codehub.listSessions();
  const list = document.getElementById('session-list');
  list.innerHTML = '';
  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = `session-item ${s.id === currentSessionId ? 'active' : ''}`;
    item.innerHTML = `
      <div class="session-info">
        <div class="session-name">${esc(s.name)}</div>
        <div class="session-meta">${s.messageCount} 条 · ${formatTime(s.updatedAt)}</div>
      </div>
      <button class="session-delete" data-id="${s.id}">&times;</button>`;
    item.addEventListener('click', (e) => { if (!e.target.classList.contains('session-delete')) loadSession(s.id); });
    item.querySelector('.session-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteSession(s.id); });
    list.appendChild(item);
  });
}

async function createNewSession() {
  const s = await window.codehub.createSession();
  currentSessionId = s.id;
  await refreshSessionList();
  clearOutput();
  document.getElementById('artifacts-btn').style.display = 'none';
}

async function loadSession(id) {
  const s = await window.codehub.loadSession(id);
  if (!s) return;
  currentSessionId = id;
  await refreshSessionList();
  renderSessionHistory(s);
}

async function deleteSession(id) {
  await window.codehub.deleteSession(id);
  if (currentSessionId === id) {
    currentSessionId = null;
    await loadOrCreateSession();
  } else {
    await refreshSessionList();
  }
}

function renderSessionHistory(session) {
  if (!session.messages.length) {
    clearOutput();
    return;
  }

  showToolPanels();

  // 获取所有工具 ID
  const toolIds = new Set();
  session.messages.forEach(msg => {
    if (msg.toolOutputs) Object.keys(msg.toolOutputs).forEach(id => toolIds.add(id));
  });

  // 为每个工具面板渲染历史
  toolIds.forEach(toolId => {
    const panel = document.getElementById(`panel-content-${toolId}`);
    if (!panel) return;
    panel.innerHTML = '';

    session.messages.forEach(msg => {
      // 用户消息
      const userDiv = document.createElement('div');
      userDiv.className = 'panel-user-msg';
      userDiv.textContent = `> ${msg.content}`;
      panel.appendChild(userDiv);

      // 工具回复
      if (msg.toolOutputs && msg.toolOutputs[toolId]) {
        const output = msg.toolOutputs[toolId];
        const replyDiv = document.createElement('div');
        replyDiv.className = 'panel-reply';
        replyDiv.dataset.done = 'true';
        if (output.error) {
          replyDiv.classList.add('panel-reply-error');
          replyDiv.textContent = output.error;
        } else {
          replyDiv.textContent = output.content || '(无输出)';
        }
        panel.appendChild(replyDiv);
      }
    });
  });

  scrollAllPanels();
}

// === 工具函数 ===

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

init();
