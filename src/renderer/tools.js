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
