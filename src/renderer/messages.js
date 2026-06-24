// === Markdown 渲染 ===
const _markedConfigured = (() => {
  if (typeof marked === 'undefined') return false;
  const renderer = {
    code({ text, lang }) {
      let highlighted = text;
      if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(text, { language: lang }).value;
      } else if (typeof hljs !== 'undefined') {
        highlighted = hljs.highlightAuto(text).value;
      }
      return `<pre><code class="hljs language-${esc(lang || '')}">${highlighted}</code></pre>`;
    },
  };
  marked.use({ renderer, breaks: true, gfm: true });
  return true;
})();

function renderMarkdown(text) {
  if (!_markedConfigured) return esc(text);
  try { return marked.parse(text); } catch { return esc(text); }
}

async function retryTool(toolId) {
  const content = state.lastMessageContent;
  if (!content) return;
  const workDir = state.currentWorkDir || document.getElementById('work-dir-select').value || '';

  const reply = document.querySelector(`#panel-content-${toolId} .panel-reply:last-child`);
  if (reply) {
    reply.textContent = '';
    reply.classList.remove('panel-reply-error');
    reply.dataset.done = '';
  }

  updatePanelStatus(toolId, 'running');

  try {
    const result = await window.codehub.retryTool({ toolId, content, workDir });
    finalizeOutput(toolId, result.content || result.error, !!result.error);
    updatePanelStatus(toolId, result.error ? 'error' : 'completed');
  } catch (err) {
    finalizeOutput(toolId, err.message, true);
    updatePanelStatus(toolId, 'error');
  }
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content || state.selectedTools.size === 0) return;
  if (!state.currentSessionId) return;

  input.value = '';
  state.lastMessageContent = content;
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
      if (result.elapsed) showToolStats(toolId, result);
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

let scrollbarInited = false;

function initScrollbar() {
  if (scrollbarInited) return;
  scrollbarInited = true;

  const track = document.getElementById('scrollbar-track');
  const thumb = document.getElementById('scrollbar-thumb');
  const content = document.getElementById('tool-panels');
  let isDragging = false;
  let startY, startScrollTop;

  function updateThumb() {
    const ratio = content.clientHeight / content.scrollHeight;
    if (ratio >= 1) { thumb.style.display = 'none'; return; }
    thumb.style.display = '';
    const trackH = track.clientHeight;
    const thumbH = Math.max(30, trackH * ratio);
    const maxScroll = content.scrollHeight - content.clientHeight;
    const thumbTop = (content.scrollTop / maxScroll) * (trackH - thumbH);
    thumb.style.height = thumbH + 'px';
    thumb.style.top = thumbTop + 'px';
  }

  track.addEventListener('mousedown', (e) => {
    if (e.target === thumb) {
      isDragging = true;
      startY = e.clientY;
      startScrollTop = content.scrollTop;
      e.preventDefault();
    } else {
      const trackRect = track.getBoundingClientRect();
      const clickRatio = (e.clientY - trackRect.top) / trackRect.height;
      content.scrollTop = clickRatio * (content.scrollHeight - content.clientHeight);
    }
  });

  track.addEventListener('wheel', (e) => {
    e.preventDefault();
    content.scrollTop += e.deltaY;
  }, { passive: false });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const trackH = track.clientHeight;
    const ratio = content.clientHeight / content.scrollHeight;
    const thumbH = Math.max(30, trackH * ratio);
    const trackScrollable = trackH - thumbH;
    const contentScrollable = content.scrollHeight - content.clientHeight;
    const dy = e.clientY - startY;
    const scrollDelta = (dy / trackScrollable) * contentScrollable;
    content.scrollTop = startScrollTop + scrollDelta;
  });

  document.addEventListener('mouseup', () => { isDragging = false; });

  content.addEventListener('scroll', updateThumb);

  new MutationObserver(updateThumb).observe(content, { childList: true, subtree: true });
}

function showToolPanels() {
  document.getElementById('welcome-screen').classList.add('hidden');
  const wrapper = document.getElementById('panels-wrapper');
  wrapper.classList.remove('hidden');
  const container = document.getElementById('tool-panels');
  const track = document.getElementById('scrollbar-track');

  const allPanels = document.querySelectorAll('.tool-panel');
  const visiblePanels = Array.from(allPanels)
    .filter(p => state.selectedTools.has(p.id.replace('panel-', '')));

  const masonry = visiblePanels.length > 4;

  if (masonry) {
    const cols = 2;
    const rows = Math.ceil(visiblePanels.length / cols);
    const rowHeight = 330;
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${rows}, ${rowHeight}px)`;
    container.style.gridAutoRows = '';
    container.style.alignContent = '';
    container.style.overflowY = 'hidden';
    track.classList.add('active');
    initScrollbar();
  } else {
    const cols = visiblePanels.length <= 2 ? visiblePanels.length : (visiblePanels.length === 3 ? 3 : 2);
    const rows = Math.ceil(visiblePanels.length / cols);
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    container.style.gridAutoRows = '';
    container.style.alignContent = '';
    container.style.overflowY = '';
    track.classList.remove('active');
    container.scrollTop = 0;
  }

  container.classList.toggle('cols-3', !masonry && visiblePanels.length === 3);

  allPanels.forEach(panel => {
    const toolId = panel.id.replace('panel-', '');
    const selected = state.selectedTools.has(toolId);
    panel.style.display = selected ? '' : 'none';
    panel.classList.remove('span-full');
    const content = panel.querySelector('.tool-panel-content');
    if (content) {
      content.style.flex = '1';
      content.style.overflowY = 'auto';
      content.style.maxHeight = '';
    }
  });

  if (!masonry && cols === 2 && visiblePanels.length % 2 === 1) {
    visiblePanels[visiblePanels.length - 1].classList.add('span-full');
  }

  requestAnimationFrame(() => {
    if (masonry) {
      const track = document.getElementById('scrollbar-track');
      const thumb = document.getElementById('scrollbar-thumb');
      const content = document.getElementById('tool-panels');
      const ratio = content.clientHeight / content.scrollHeight;
      if (ratio >= 1) {
        track.classList.remove('active');
      } else {
        track.classList.add('active');
        const trackH = track.clientHeight;
        const thumbH = Math.max(30, trackH * ratio);
        const maxScroll = content.scrollHeight - content.clientHeight;
        thumb.style.height = thumbH + 'px';
        thumb.style.top = '0px';
        thumb.style.display = '';
      }
    }
  });
}

function appendUserMessage(content) {
  showToolPanels();
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  state.selectedTools.forEach(toolId => {
    const panel = document.getElementById(`panel-content-${toolId}`);
    if (!panel) return;
    if (panel.children.length > 0) {
      const sep = document.createElement('div');
      sep.className = 'panel-round-separator';
      sep.textContent = timeStr;
      panel.appendChild(sep);
    }
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
    if (isError) {
      reply.classList.add('panel-reply-error');
      reply.innerHTML = formatError(content || '(无输出)');
    } else {
      reply.innerHTML = renderMarkdown(content || '(无输出)');
    }
    panel.appendChild(reply);
  } else {
    reply.dataset.done = 'true';
    if (isError) {
      reply.classList.add('panel-reply-error');
      reply.innerHTML = formatError(content || reply.textContent || '(无输出)');
    } else if (content) {
      reply.innerHTML = renderMarkdown(content);
    }
  }
  scrollPanel(toolId);
}

function formatError(text) {
  const lines = text.split('\n');
  if (lines.length <= 3) return esc(text);
  const preview = lines.slice(0, 3).join('\n');
  const rest = lines.slice(3).join('\n');
  return `${esc(preview)}<details class="error-details"><summary>展开完整错误 (${lines.length} 行)</summary><pre>${esc(rest)}</pre></details>`;
}

function showToolStats(toolId, result) {
  const panel = document.getElementById(`panel-content-${toolId}`);
  if (!panel) return;
  let stats = panel.querySelector('.panel-stats');
  if (!stats) {
    stats = document.createElement('div');
    stats.className = 'panel-stats';
    panel.appendChild(stats);
  }
  const elapsed = result.elapsed || 0;
  const len = (result.content || '').length;
  const sec = (elapsed / 1000).toFixed(1);
  stats.textContent = `${sec}s · ${len} chars`;
}

function updatePanelStatus(toolId, status) {
  const el = document.getElementById(`panel-status-${toolId}`);
  if (el) {
    const labels = { idle: '就绪', running: '运行中...', completed: '完成', error: '错误' };
    el.textContent = labels[status] || status;
    el.className = `tool-panel-status status-${status}`;
  }
  const panel = document.getElementById(`panel-${toolId}`);
  if (panel) {
    panel.classList.toggle('running', status === 'running');
  }
  const retryBtn = document.getElementById(`panel-retry-${toolId}`);
  if (retryBtn) {
    retryBtn.classList.toggle('hidden', status !== 'error');
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
  showToolPanels();
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
  document.getElementById('panels-wrapper').classList.add('hidden');
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
