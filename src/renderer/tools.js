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
    if (tool.available) label.classList.add('selected');
    const dot = document.createElement('span');
    dot.className = `tool-status ${tool.available ? 'selected' : ''}`;
    dot.id = `status-${tool.id}`;
    const txt = document.createElement('span');
    txt.textContent = tool.available ? tool.name : `${tool.name} (未安装)`;
    const toolLabel = document.createElement('span');
    toolLabel.className = 'tool-label';
    toolLabel.append(dot, txt);
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
          <span class="tool-panel-drag-handle">⠿</span>
          <span class="tool-panel-name">${esc(tool.name)}</span>
          <span class="tool-panel-status" id="panel-status-${tool.id}">就绪</span>
          <button class="panel-retry-btn hidden" id="panel-retry-${tool.id}" title="重试">↻</button>
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
  }
  this.classList.remove('drag-over');
}

function handleDragEnd() {
  document.querySelectorAll('.tool-panel').forEach(p => {
    p.classList.remove('dragging', 'drag-over');
  });
}

function updateSelectedInfo() {
  document.getElementById('selected-tools-info').textContent =
    state.selectedTools.size === 0 ? '未选择工具' : `已选择 ${state.selectedTools.size} 个工具`;
}

function updateSendButton() {
  document.getElementById('send-btn').disabled = state.selectedTools.size === 0 || state.isRunning;
}

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
      <div class="item-actions">
        ${!tool.builtin ? `<button class="edit-btn" data-id="${tool.id}" title="编辑">✎</button>` : ''}
        ${!tool.builtin ? `<button class="delete-btn" data-id="${tool.id}">&times;</button>` : ''}
      </div>`;
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
