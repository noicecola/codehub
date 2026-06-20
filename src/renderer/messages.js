async function sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content || state.selectedTools.size === 0) return;
  if (!state.currentSessionId) return;

  input.value = '';
  state.isRunning = true;
  updateSendButton();
  document.getElementById('send-btn').style.display = 'none';
  document.getElementById('stop-btn').style.display = 'inline-block';

  appendUserMessage(content);
  state.selectedTools.forEach(id => updatePanelStatus(id, 'running'));

  const workDir = state.currentWorkDir || document.getElementById('work-dir-select').value || '';

  try {
    const { results, artifacts } = await window.codehub.broadcastMessage({
      content, toolIds: Array.from(state.selectedTools), workDir,
    });
    state.lastResults = results;
    state.lastArtifacts = artifacts || {};
    document.getElementById('artifacts-btn').style.display =
      Object.values(state.lastArtifacts).some(a => a?.length > 0) ? 'inline-block' : 'none';

    for (const [toolId, result] of Object.entries(results)) {
      finalizeOutput(toolId, result.content || result.error, !!result.error);
      updatePanelStatus(toolId, result.error ? 'error' : 'completed');
    }
  } catch (err) {
    state.selectedTools.forEach(id => {
      finalizeOutput(id, err.message, true);
      updatePanelStatus(id, 'error');
    });
  }

  state.isRunning = false;
  updateSendButton();
  document.getElementById('send-btn').style.display = 'inline-block';
  document.getElementById('stop-btn').style.display = 'none';

  await refreshSessionList();
}

function stopAll() {
  state.selectedTools.forEach(id => {
    window.codehub.stopTool(id);
    updatePanelStatus(id, 'idle');
  });
  state.isRunning = false;
  updateSendButton();
  document.getElementById('send-btn').style.display = 'inline-block';
  document.getElementById('stop-btn').style.display = 'none';
}

// === 输出面板 ===

function showToolPanels() {
  document.getElementById('welcome-screen').classList.add('hidden');
  const container = document.getElementById('tool-panels');
  container.classList.remove('hidden');

  const visibleCount = Array.from(document.querySelectorAll('.tool-panel'))
    .filter(p => state.selectedTools.has(p.id.replace('panel-', '')))
    .length;

  const cols = visibleCount <= 2 ? visibleCount : (visibleCount === 3 ? 3 : 2);
  container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  container.classList.toggle('cols-3', cols === 3);

  document.querySelectorAll('.tool-panel').forEach(panel => {
    const toolId = panel.id.replace('panel-', '');
    panel.style.display = state.selectedTools.has(toolId) ? '' : 'none';
  });
}

function appendUserMessage(content) {
  showToolPanels();
  state.selectedTools.forEach(toolId => {
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
  updateToolStatus(toolId, status);
}

function updateToolStatus(toolId, status) {
  const dot = document.getElementById(`status-${toolId}`);
  if (!dot) return;
  dot.className = `tool-status ${status}`;
  if (status === 'completed') {
    setTimeout(() => { dot.className = 'tool-status selected'; }, 2000);
  }
}

function togglePanel(toolId, visible) {
  const panel = document.getElementById(`panel-${toolId}`);
  if (panel) panel.style.display = visible ? '' : 'none';
}

function scrollPanel(toolId) {
  const panel = document.getElementById(`panel-content-${toolId}`);
  if (panel) panel.scrollTop = panel.scrollHeight;
}

function scrollAllPanels() {
  state.selectedTools.forEach(id => scrollPanel(id));
}

function clearOutput() {
  document.getElementById('welcome-screen').classList.remove('hidden');
  document.getElementById('tool-panels').classList.add('hidden');
  document.querySelectorAll('.tool-panel-content').forEach(el => el.innerHTML = '');
}

// === 模态框 ===

function showArtifactsModal() {
  const allFiles = [];
  for (const [toolId, files] of Object.entries(state.lastArtifacts)) {
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
      dir: state.currentWorkDir || document.getElementById('work-dir-select').value || '.',
      filePath: file.path,
    });
    el.innerHTML = content.startsWith('Error')
      ? `<pre style="color:var(--danger)">${esc(content)}</pre>`
      : `<pre>${esc(content)}</pre>`;
  } catch (err) { el.innerHTML = `<pre style="color:var(--danger)">${err.message}</pre>`; }
}

function showCompareModal() {
  if (!Object.keys(state.lastResults).length) { toast.info('暂无结果'); return; }
  const viewer = new DiffViewer('compare-content');
  viewer.render(state.lastResults);
  modalManager.open('compare-modal');
}

function showExportModal() {
  if (!state.currentSessionId) { toast.info('请先选择会话'); return; }
  modalManager.open('export-modal');
}

async function exportSession(format) {
  const path = await window.codehub.exportSession({ sessionId: state.currentSessionId, format });
  modalManager.closeById('export-modal');
  if (path) toast.success(`已导出: ${path}`);
}

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
