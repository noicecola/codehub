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

  updateSelectedInfo();
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
    form.innerHTML = `
      <h4>添加自定义工具</h4>
      <input id="tool-name-input" placeholder="名称" />
      <input id="tool-command-input" placeholder="命令 (如 python3)" />
      <input id="tool-args-input" placeholder="参数 (可选)" />
      <button id="add-tool-btn" class="primary-btn">添加</button>`;
    document.getElementById('add-tool-btn').addEventListener('click', addCustomTool);
  });
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
  const name = document.getElementById('tool-name-input').value.trim();
  const command = document.getElementById('tool-command-input').value.trim();
  const argsStr = document.getElementById('tool-args-input').value.trim();
  if (!name || !command) { toast.info('请填写名称和命令'); return; }
  const args = argsStr ? argsStr.split(/\s+/) : [];
  await window.codehub.addCustomTool({ name, command, args });
  document.getElementById('tool-name-input').value = '';
  document.getElementById('tool-command-input').value = '';
  document.getElementById('tool-args-input').value = '';
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
