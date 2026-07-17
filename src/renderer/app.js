function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'select'];
  const dangerousAttrs = ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onchange', 'onkeydown', 'onkeyup', 'onkeypress'];
  body.querySelectorAll('*').forEach(el => {
    if (dangerousTags.includes(el.tagName.toLowerCase())) {
      el.remove();
      return;
    }
    dangerousAttrs.forEach(attr => el.removeAttribute(attr));
    if (el.tagName === 'A') {
      el.removeAttribute('onclick');
      const href = el.getAttribute('href') || '';
      if (href.startsWith('javascript:')) el.removeAttribute('href');
    }
  });
  return body.innerHTML;
}

function formatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

// === 快捷键配置 ===
const DEFAULT_SHORTCUTS = {
  send: { key: 'Enter', ctrl: true, label: '发送消息' },
  newSession: { key: 'n', ctrl: true, label: '新建会话' },
  search: { key: 'k', ctrl: true, label: '搜索会话' },
  toggleSidebar: { key: 'b', ctrl: true, label: '切换侧边栏' },
};

let shortcuts = { ...DEFAULT_SHORTCUTS };

function loadShortcuts() {
  try {
    const saved = localStorage.getItem('codehub-shortcuts');
    if (saved) {
      const parsed = JSON.parse(saved);
      shortcuts = { ...DEFAULT_SHORTCUTS, ...parsed };
    }
  } catch {}
}

function saveShortcuts() {
  try {
    localStorage.setItem('codehub-shortcuts', JSON.stringify(shortcuts));
  } catch {}
}

function resetShortcuts() {
  shortcuts = { ...DEFAULT_SHORTCUTS };
  saveShortcuts();
}

function matchShortcut(e, shortcut) {
  const mod = e.ctrlKey || e.metaKey;
  return e.key.toLowerCase() === shortcut.key.toLowerCase() && mod === !!shortcut.ctrl;
}

async function init() {
  loadShortcuts();
  const tools = await window.codehub.getTools();
  renderToolSelector(tools);
  setupEventListeners();
  await loadOrCreateSession();
}

function setupEventListeners() {
  document.getElementById('sidebar-toggle-btn').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    document.getElementById('sidebar-toggle-btn').textContent =
      sidebar.classList.contains('collapsed') ? '▶' : '◀';
  });

  document.getElementById('message-input').addEventListener('keydown', (e) => {
    if (matchShortcut(e, shortcuts.send)) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('session-search').addEventListener('input', () => refreshSessionList());
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('stop-btn').addEventListener('click', stopAll);
  document.getElementById('new-session-btn').addEventListener('click', createNewSession);

  document.addEventListener('keydown', (e) => {
    if (matchShortcut(e, shortcuts.newSession)) { e.preventDefault(); createNewSession(); }
    if (matchShortcut(e, shortcuts.search)) { e.preventDefault(); document.getElementById('session-search').focus(); }
    if (matchShortcut(e, shortcuts.toggleSidebar)) { e.preventDefault(); document.getElementById('sidebar').classList.toggle('collapsed'); }
  });
  document.getElementById('compare-btn').addEventListener('click', showCompareModal);
  document.getElementById('edit-tags-btn').addEventListener('click', editSessionTags);
  document.getElementById('artifacts-btn').addEventListener('click', showArtifactsModal);
  document.getElementById('export-btn').addEventListener('click', showExportModal);
  document.getElementById('manage-tools-btn').addEventListener('click', showToolsModal);
  document.getElementById('manage-presets-btn').addEventListener('click', showPresetsModal);
  document.getElementById('manage-templates-btn').addEventListener('click', showTemplatesModal);
  document.getElementById('template-btn').addEventListener('click', toggleTemplateDropdown);
  document.getElementById('browse-dir-btn').addEventListener('click', browseDirectory);

  modalManager.init();

  document.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', () => exportSession(btn.dataset.format));
  });
  document.getElementById('add-tool-btn').addEventListener('click', addCustomTool);
  document.getElementById('add-tpl-btn').addEventListener('click', addTemplate);
  document.getElementById('save-preset-btn').addEventListener('click', saveCurrentAsPreset);

  const inputArea = document.getElementById('input-area');
  inputArea.addEventListener('dragover', (e) => { e.preventDefault(); inputArea.classList.add('drag-over'); });
  inputArea.addEventListener('dragleave', () => inputArea.classList.remove('drag-over'));
  inputArea.addEventListener('drop', (e) => {
    e.preventDefault();
    inputArea.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      const input = document.getElementById('message-input');
      const paths = files.map(f => f.path).join('\n');
      input.value += (input.value ? '\n' : '') + paths;
      input.focus();
    }
  });

  window.codehub.onStreamChunk(({ toolId, chunk }) => appendToOutput(toolId, chunk));
  window.codehub.onToolDone(({ toolId, result, artifacts }) => {
    console.log('[DEBUG] tool-done', toolId, 'elapsed:', result.elapsed, 'content len:', (result.content||'').length);
    finalizeOutput(toolId, result.content || result.error, !!result.error);
    updatePanelStatus(toolId, result.error ? 'error' : 'completed');
    // Note: finalizeOutput already cleans up _streamingState[toolId]
    if (result.elapsed) showToolStats(toolId, result);
    if (artifacts?.length) {
      state.lastArtifacts[toolId] = artifacts;
      document.getElementById('artifacts-btn').style.display = 'inline-block';
    }
    checkAllDone();
  });
  window.codehub.onSessionUpdated(() => refreshSessionList());

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#template-btn') && !e.target.closest('#template-dropdown')) {
      document.getElementById('template-dropdown').classList.add('hidden');
    }
  });
}

init();

// === 快速开始卡片 ===
document.querySelectorAll('.quick-start-card').forEach(card => {
  card.addEventListener('click', () => {
    const action = card.dataset.action;
    if (action === 'new-session') document.getElementById('new-session-btn')?.click();
    else if (action === 'load-template') document.getElementById('template-btn')?.click();
    else if (action === 'manage-tools') document.getElementById('manage-tools-btn')?.click();
  });
});

// === 键盘快捷键：/ 聚焦搜索 ===
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
    const search = document.getElementById('session-search');
    const input = document.getElementById('message-input');
    if (document.activeElement !== search && document.activeElement !== input) {
      e.preventDefault();
      search?.focus();
    }
  }
});

// === Welcome 页初始化 ===
if (typeof renderToolStatusBar === 'function') renderToolStatusBar();
if (typeof renderPresetBar === 'function') renderPresetBar();

// === 快捷键设置 ===

function renderShortcutsModal() {
  const list = document.getElementById('shortcuts-list');
  if (!list) return;
  list.innerHTML = '';

  Object.entries(shortcuts).forEach(([id, shortcut]) => {
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    const modLabel = shortcut.ctrl ? (navigator.platform.includes('Mac') ? '⌘' : 'Ctrl') : '';
    const keyLabel = shortcut.key === 'Enter' ? '↵' : shortcut.key.toUpperCase();
    item.innerHTML = `
      <span class="shortcut-label">${shortcut.label}</span>
      <div class="shortcut-keys">
        <kbd>${modLabel}</kbd><span>+</span><kbd>${keyLabel}</kbd>
      </div>
      <button class="shortcut-edit-btn" data-shortcut="${id}">修改</button>`;
    item.querySelector('.shortcut-edit-btn').addEventListener('click', () => editShortcut(id));
    list.appendChild(item);
  });

  document.getElementById('shortcuts-modal').classList.remove('hidden');
}

let recordingShortcut = null;

function editShortcut(id) {
  recordingShortcut = id;
  const item = document.querySelector(`[data-shortcut="${id}"]`).closest('.shortcut-item');
  const keysDiv = item.querySelector('.shortcut-keys');
  keysDiv.innerHTML = '<span class="recording-hint">按下新快捷键...</span>';

  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      recordingShortcut = null;
      renderShortcutsModal();
      document.removeEventListener('keydown', handler, true);
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl || (e.key.length === 1 && !e.altKey && !e.shiftKey)) {
      shortcuts[id] = { ...shortcuts[id], key: e.key, ctrl };
      saveShortcuts();
      recordingShortcut = null;
      renderShortcutsModal();
      document.removeEventListener('keydown', handler, true);
    }
  };
  document.addEventListener('keydown', handler, true);
}

document.getElementById('reset-shortcuts-btn')?.addEventListener('click', () => {
  resetShortcuts();
  renderShortcutsModal();
});

// 绑定快捷键设置入口（在工具管理按钮旁）
document.getElementById('manage-tools-btn')?.addEventListener('click', () => {
  // 原有的工具管理逻辑已在 setupEventListeners 中绑定
});

// 在 sidebar-footer 添加快捷键按钮
const sidebarFooter = document.querySelector('.sidebar-footer');
if (sidebarFooter) {
  const shortcutsBtn = document.createElement('button');
  shortcutsBtn.id = 'manage-shortcuts-btn';
  shortcutsBtn.className = 'sidebar-tool-btn';
  shortcutsBtn.innerHTML = '<span class="btn-icon">⌨️</span> 快捷键';
  shortcutsBtn.addEventListener('click', renderShortcutsModal);
  sidebarFooter.appendChild(shortcutsBtn);
}
