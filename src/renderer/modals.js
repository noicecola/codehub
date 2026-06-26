// === 弹窗 ===

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
    const result = await window.codehub.readFile({
      dir: state.currentWorkDir || document.getElementById('work-dir-select').value || '.',
      filePath: file.path,
    });
    if (result.error) {
      el.innerHTML = `<pre style="color:var(--danger)">${esc(result.error)}</pre>`;
    } else {
      el.innerHTML = `<pre>${esc(result.content)}</pre>`;
    }
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
