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
    if (tool.available) state.selectedTools.add(tool.id);

    cb.addEventListener('change', (e) => {
      e.target.checked ? state.selectedTools.add(tool.id) : state.selectedTools.delete(tool.id);
      label.classList.toggle('selected', e.target.checked);
      dot.className = `tool-status ${e.target.checked ? 'selected' : ''}`;
      togglePanel(tool.id, e.target.checked);
      updateSendButton();
      updateSelectedInfo();
    });
    if (cb.checked) label.classList.add('selected');
    const dot = document.createElement('span');
    dot.className = `tool-status ${cb.checked ? 'selected' : ''}`;
    dot.id = `status-${tool.id}`;
    const txt = document.createElement('span');
    txt.textContent = tool.name;

    const toolLabel = document.createElement('span');
    toolLabel.className = 'tool-label';
    toolLabel.append(dot, txt);

    // 未安装时显示安装按钮
    if (!tool.available && tool.installCommand) {
      const installBtn = document.createElement('button');
      installBtn.className = 'tool-install-btn';
      installBtn.id = `install-btn-${tool.id}`;
      installBtn.textContent = '安装';
      installBtn.title = `安装命令: ${tool.installCommand}`;
      installBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        installToolById(tool.id);
      });
      toolLabel.appendChild(installBtn);
    }

    label.append(cb, toolLabel);
    container.appendChild(label);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'tool-add-btn';
  addBtn.textContent = '+';
  addBtn.title = '添加工具';
  addBtn.addEventListener('click', showToolsModal);
  container.appendChild(addBtn);

  renderToolPanels(tools);
  updateSelectedInfo();
  updateSendButton();
}

function renderToolPanels(tools) {
  const panelsContainer = document.getElementById('tool-panels');
  const toolIds = new Set(tools.map(t => t.id));

  // 删除已移除工具的面板
  panelsContainer.querySelectorAll('.tool-panel').forEach(panel => {
    const panelToolId = panel.id.replace('panel-', '');
    if (!toolIds.has(panelToolId)) {
      panel.remove();
    }
  });

  tools.forEach(tool => {
    let panel = document.getElementById(`panel-${tool.id}`);
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'tool-panel';
      panel.id = `panel-${tool.id}`;
      panel.draggable = false;
      panel.dataset.toolId = tool.id;
      panel.innerHTML = `
        <div class="tool-panel-header">
          <div class="tool-panel-header-left">
            <span class="tool-panel-drag-handle">⠿</span>
            <span class="tool-panel-name">${esc(tool.name)}</span>
          </div>
          <div class="tool-panel-header-right">
            <span class="tool-panel-timer" id="panel-timer-${tool.id}" style="display:none">0.0s</span>
            <span class="tool-panel-status" id="panel-status-${tool.id}">就绪</span>
            <button class="panel-retry-btn hidden" id="panel-retry-${tool.id}" title="重试">↻</button>
          </div>
        </div>
        <div class="tool-panel-content" id="panel-content-${tool.id}"></div>`;
      panel.querySelector('.panel-retry-btn').addEventListener('click', () => retryTool(tool.id));
      // 拖拽：只在拖拽手柄上触发
      const handle = panel.querySelector('.tool-panel-drag-handle');
      handle.addEventListener('mousedown', () => { panel.draggable = true; });
      panel.addEventListener('dragstart', handleDragStart);
      panel.addEventListener('dragover', handleDragOver);
      panel.addEventListener('dragenter', handleDragEnter);
      panel.addEventListener('dragleave', handleDragLeave);
      panel.addEventListener('drop', handleDrop);
      panel.addEventListener('dragend', (e) => { panel.draggable = false; handleDragEnd(e); });
      panelsContainer.appendChild(panel);
    }
    panel.style.display = state.selectedTools.has(tool.id) ? '' : 'none';
  });
}

let dragSrcEl = null;

function handleDragStart(e) {
  dragSrcEl = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.toolId);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  if (this !== dragSrcEl) this.classList.add('drag-over');
}

function handleDragLeave() {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  if (dragSrcEl !== this) {
    const fromId = dragSrcEl.dataset.toolId;
    const toId = this.dataset.toolId;
    const container = document.getElementById('tool-panels');
    const children = Array.from(container.children);
    const fromIdx = children.findIndex(c => c.dataset.toolId === fromId);
    const toIdx = children.findIndex(c => c.dataset.toolId === toId);
    if (fromIdx < toIdx) {
      container.insertBefore(dragSrcEl, this.nextSibling);
    } else {
      container.insertBefore(dragSrcEl, this);
    }
    syncToolSelectorOrder();
  }
  this.classList.remove('drag-over');
}

function handleDragEnd() {
  document.querySelectorAll('.tool-panel').forEach(p => {
    p.classList.remove('dragging', 'drag-over');
  });
}

function syncToolSelectorOrder() {
  const panels = document.getElementById('tool-panels');
  const selector = document.getElementById('tool-selector');
  if (!panels || !selector) return;

  const panelOrder = Array.from(panels.children).map(p => p.dataset.toolId);
  const checkboxes = Array.from(selector.querySelectorAll('.tool-checkbox'));
  const addBtn = selector.querySelector('.tool-add-btn');

  panelOrder.forEach(toolId => {
    const cb = checkboxes.find(c => {
      const statusDot = c.querySelector('.tool-status');
      return statusDot && statusDot.id === `status-${toolId}`;
    });
    if (cb) selector.insertBefore(cb, addBtn);
  });
}

function updateSelectedInfo() {
  const badge = document.getElementById('tools-count-badge');
  if (badge) {
    badge.textContent = state.selectedTools.size;
  }
}

function updateSendButton() {
  document.getElementById('send-btn').disabled = state.selectedTools.size === 0 || state.isRunning;
}

async function showToolsModal() {
  const tools = await window.codehub.getTools();
  const versions = await window.codehub.getToolVersions();
  const list = document.getElementById('tools-list');
  list.innerHTML = '';

  // 批量安装按钮
  const installable = tools.filter(t => !t.available && t.installCommand);
  if (installable.length > 0) {
    const batchBtn = document.createElement('button');
    batchBtn.className = 'tool-install-btn';
    batchBtn.style.cssText = 'width: 100%; margin-bottom: 8px; padding: 6px;';
    batchBtn.textContent = `一键安装全部 (${installable.length})`;
    batchBtn.addEventListener('click', async () => {
      batchBtn.disabled = true;
      batchBtn.textContent = '安装中...';
      const toolIds = installable.map(t => t.id);
      const results = await window.codehub.batchInstall(toolIds);
      const successCount = Object.values(results).filter(r => r.success).length;
      const failCount = Object.values(results).filter(r => !r.success).length;
      toast.success(`批量安装完成：${successCount} 成功，${failCount} 失败`);
      await refreshToolSelector();
      showToolsModal();
    });
    list.appendChild(batchBtn);
  }

  tools.forEach(tool => {
    const item = document.createElement('div');
    item.className = 'list-item';
    const version = versions[tool.id];
    const versionStr = tool.available ? (version ? `v${version}` : '已安装') : '未安装';
    const installBtnHtml = !tool.available && tool.installCommand
      ? `<button class="tool-install-btn" data-install="${tool.id}" title="安装命令: ${tool.installCommand}">安装</button>`
      : '';
    item.innerHTML = `
      <div class="item-info">
        <div class="item-name">${esc(tool.name)}</div>
        <div class="item-detail">${tool.builtin ? '内置' : '自定义'} · ${versionStr}</div>
      </div>
      <div class="item-actions">
        ${installBtnHtml}
        ${!tool.builtin ? `<button class="edit-btn" data-id="${tool.id}" title="编辑">✎</button>` : ''}
        ${!tool.builtin ? `<button class="delete-btn" data-id="${tool.id}">&times;</button>` : ''}
      </div>`;
    item.querySelector('.tool-install-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = '安装中...';
      try {
        const result = await window.codehub.installTool(tool.id);
        if (result.success) {
          toast.success(`${tool.name} 安装成功！`);
          await refreshToolSelector();
          showToolsModal();
        } else {
          toast.error(`安装失败: ${result.error}`);
          btn.disabled = false;
          btn.textContent = '安装';
        }
      } catch (err) {
        toast.error(`安装出错: ${err.message}`);
        btn.disabled = false;
        btn.textContent = '安装';
      }
    });
    item.querySelector('.edit-btn')?.addEventListener('click', () => editTool(tool));
    item.querySelector('.delete-btn')?.addEventListener('click', async () => {
      await window.codehub.removeCustomTool(tool.id);
      state.selectedTools.delete(tool.id);
      showToolsModal();
      await refreshToolSelector();
    });
    list.appendChild(item);
  });
  document.getElementById('tools-modal').classList.remove('hidden');
}

function editTool(tool) {
  const modal = document.getElementById('tools-modal');
  const form = modal.querySelector('.add-tool-form');
  form.innerHTML = `
    <h4>编辑工具</h4>
    <input id="edit-tool-id" type="hidden" value="${tool.id}" />
    <input id="edit-tool-name" placeholder="名称" value="${esc(tool.name)}" />
    <input id="edit-tool-command" placeholder="命令" value="${esc(tool.transport?.command || '')}" />
    <input id="edit-tool-args" placeholder="参数 (可选)" value="${esc((tool.args || []).join(' '))}" />
    <div class="edit-form-btns">
      <button class="primary-btn" id="save-edit-tool-btn">保存</button>
      <button class="secondary-btn" id="cancel-edit-tool-btn">取消</button>
    </div>`;
  document.getElementById('save-edit-tool-btn').addEventListener('click', saveEditTool);
  document.getElementById('cancel-edit-tool-btn').addEventListener('click', () => {
    resetAddToolForm();
  });
}

function resetAddToolForm() {
  const form = document.querySelector('.add-tool-form');
  form.innerHTML = `
    <h4>添加自定义工具</h4>
    <select id="tool-type-select">
      <option value="cli">CLI 命令</option>
      <option value="http">HTTP API</option>
    </select>
    <input id="tool-name-input" placeholder="名称" />
    <div id="cli-fields">
      <input id="tool-command-input" placeholder="命令 (如 python3)" />
      <input id="tool-args-input" placeholder="参数 (可选)" />
    </div>
    <div id="http-fields" style="display:none">
      <input id="tool-url-input" placeholder="URL (如 http://localhost:8080)" />
      <input id="tool-path-input" placeholder="路径 (默认 /chat)" />
    </div>
    <button id="add-tool-btn" class="primary-btn">添加</button>`;
  document.getElementById('tool-type-select').addEventListener('change', (e) => {
    document.getElementById('cli-fields').style.display = e.target.value === 'cli' ? '' : 'none';
    document.getElementById('http-fields').style.display = e.target.value === 'http' ? '' : 'none';
  });
  document.getElementById('add-tool-btn').addEventListener('click', addCustomTool);
}

async function saveEditTool() {
  const id = document.getElementById('edit-tool-id').value;
  const name = document.getElementById('edit-tool-name').value.trim();
  const command = document.getElementById('edit-tool-command').value.trim();
  const argsStr = document.getElementById('edit-tool-args').value.trim();
  if (!name || !command) { toast.info('请填写名称和命令'); return; }
  const args = argsStr ? argsStr.split(/\s+/) : [];
  await window.codehub.editCustomTool({ id, name, command, args });
  modalManager.closeById('tools-modal');
  await refreshToolSelector();
  toast.success(`已更新: ${name}`);
}

async function addCustomTool() {
  const type = document.getElementById('tool-type-select').value;
  const name = document.getElementById('tool-name-input').value.trim();
  if (!name) { toast.info('请填写名称'); return; }

  if (type === 'http') {
    const url = document.getElementById('tool-url-input').value.trim();
    const path = document.getElementById('tool-path-input').value.trim() || '/chat';
    if (!url) { toast.info('请填写 URL'); return; }
    await window.codehub.addCustomTool({ name, type: 'http', url, path });
  } else {
    const command = document.getElementById('tool-command-input').value.trim();
    const argsStr = document.getElementById('tool-args-input').value.trim();
    if (!command) { toast.info('请填写命令'); return; }
    const args = argsStr ? argsStr.split(/\s+/) : [];
    await window.codehub.addCustomTool({ name, command, args });
  }
  resetAddToolForm();
  modalManager.closeById('tools-modal');
  await refreshToolSelector();
  toast.success(`已添加: ${name}`);
}

async function refreshToolSelector() {
  const tools = await window.codehub.getTools();
  renderToolSelector(tools);
}

async function browseDirectory() {
  const dir = await window.codehub.selectDirectory();
  if (dir) {
    state.currentWorkDir = dir;
    const select = document.getElementById('work-dir-select');
    const opt = document.createElement('option');
    opt.value = dir;
    opt.textContent = dir.split('/').pop();
    opt.selected = true;
    select.appendChild(opt);
  }
}

// === 工具预设 ===

async function showPresetsModal() {
  const presets = await window.codehub.listPresets();
  const list = document.getElementById('presets-list');
  list.innerHTML = '';
  presets.forEach(p => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="item-info">
        <div class="item-name">${esc(p.name)}</div>
        <div class="item-detail">${p.toolIds.length} 个工具</div>
      </div>
      <div class="item-actions">
        <button class="edit-btn apply-preset" data-id="${p.id}" title="应用">✓</button>
        <button class="delete-btn" data-id="${p.id}">&times;</button>
      </div>`;
    item.querySelector('.apply-preset').addEventListener('click', () => applyPreset(p));
    item.querySelector('.delete-btn').addEventListener('click', async () => {
      await window.codehub.deletePreset(p.id);
      showPresetsModal();
    });
    list.appendChild(item);
  });
  document.getElementById('presets-modal').classList.remove('hidden');
}

function applyPreset(preset) {
  state.selectedTools.clear();
  preset.toolIds.forEach(id => state.selectedTools.add(id));
  refreshToolSelector();
  modalManager.closeById('presets-modal');
  toast.success(`已应用预设: ${preset.name}`);
}

async function saveCurrentAsPreset() {
  if (state.selectedTools.size === 0) { toast.info('请先选择工具'); return; }
  const name = prompt('预设名称:');
  if (!name) return;
  await window.codehub.savePreset({ name, toolIds: Array.from(state.selectedTools) });
  toast.success(`已保存预设: ${name}`);
  modalManager.closeById('presets-modal');
}

// === 一键安装 ===

async function installToolById(toolId) {
  const btn = document.getElementById(`install-btn-${toolId}`);
  if (!btn) return;

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '安装中...';
  btn.classList.add('installing');

  try {
    const result = await window.codehub.installTool(toolId);
    if (result.success) {
      toast.success('安装成功！工具已可用。');
      await refreshToolSelector();
    } else {
      toast.error(`安装失败: ${result.error}`);
      btn.disabled = false;
      btn.textContent = originalText;
      btn.classList.remove('installing');
    }
  } catch (err) {
    toast.error(`安装出错: ${err.message}`);
    btn.disabled = false;
    btn.textContent = originalText;
    btn.classList.remove('installing');
  }
}

// 安装进度监听
if (window.codehub.onInstallProgress) {
  window.codehub.onInstallProgress(({ toolId, status, message }) => {
    const btn = document.getElementById(`install-btn-${toolId}`);
    if (!btn) return;

    if (status === 'installing') {
      btn.textContent = '安装中...';
      btn.title = message;
    } else if (status === 'completed') {
      toast.success('安装完成！');
    } else if (status === 'error') {
      toast.error(`安装失败: ${message}`);
      btn.disabled = false;
      btn.textContent = '安装';
      btn.classList.remove('installing');
    }
  });
}

// === 工具计数徽章 ===
function updateToolsCount() {
  const badge = document.getElementById('tools-count-badge');
  const selected = document.querySelectorAll('.tool-checkbox.selected');
  if (badge) badge.textContent = `${selected.length} 个工具`;
}

(function initToolsCount() {
  const selector = document.getElementById('tool-selector');
  if (!selector) return;
  const observer = new MutationObserver(updateToolsCount);
  observer.observe(selector, { childList: true, subtree: true, attributes: true });
  updateToolsCount();
})();

// === 工具状态栏（Welcome 页） ===
function renderToolStatusBar() {
  const container = document.getElementById('tool-status-bar');
  if (!container) return;
  const tools = window.CodeHubState?.tools || [];
  container.innerHTML = tools.slice(0, 5).map(tool => `
    <div class="tool-status-item">
      <div class="tool-status-dot ${tool.available ? 'online' : 'offline'}"></div>
      <span>${tool.name}</span>
    </div>
  `).join('');
}

// === 预设快捷栏 ===
function renderPresetBar() {
  const container = document.getElementById('preset-bar');
  if (!container) return;
  const presets = window.CodeHubState?.presets || [];
  if (presets.length === 0) { container.style.display = 'none'; return; }

  // 插入折叠切换按钮（如果尚未插入）
  let toggle = document.getElementById('preset-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'preset-toggle';
    toggle.className = 'preset-toggle';
    toggle.textContent = '⚡ 预设';
    toggle.addEventListener('click', () => {
      container.classList.toggle('expanded');
      toggle.textContent = container.classList.contains('expanded') ? '⚡ 收起' : '⚡ 预设';
    });
    container.parentNode.insertBefore(toggle, container);
  }

  container.innerHTML = presets.slice(0, 6).map(preset => `
    <button class="preset-btn" data-preset-id="${preset.id}">
      <span class="preset-icon">⚡</span>${preset.name}
    </button>
  `).join('');
  const messageInput = document.getElementById('message-input');
  container.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = presets.find(p => p.id === btn.dataset.presetId);
      if (preset && messageInput) {
        messageInput.value = preset.message || '';
        messageInput.dispatchEvent(new Event('input'));
        messageInput.focus();
      }
    });
  });
}
