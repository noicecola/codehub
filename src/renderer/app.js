function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function formatTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

async function init() {
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('session-search').addEventListener('input', () => refreshSessionList());
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

  document.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', () => exportSession(btn.dataset.format));
  });
  document.getElementById('add-tool-btn').addEventListener('click', addCustomTool);
  document.getElementById('add-tpl-btn').addEventListener('click', addTemplate);

  window.codehub.onStreamChunk(({ toolId, chunk }) => appendToOutput(toolId, chunk));
  window.codehub.onSessionUpdated(() => refreshSessionList());

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#template-btn') && !e.target.closest('#template-dropdown')) {
      document.getElementById('template-dropdown').classList.add('hidden');
    }
  });
}

init();
