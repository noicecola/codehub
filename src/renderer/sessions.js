async function loadOrCreateSession() {
  const session = await window.codehub.getLatestSession();
  if (session) {
    state.currentSessionId = session.id;
    await refreshSessionList();
    renderSessionHistory(session);
  } else {
    const s = await window.codehub.createSession();
    state.currentSessionId = s.id;
    await refreshSessionList();
    clearOutput();
  }
}

async function refreshSessionList() {
  const query = (document.getElementById('session-search')?.value || '').trim();
  const sessions = query
    ? await window.codehub.searchSessions(query)
    : await window.codehub.listSessions();
  const list = document.getElementById('session-list');
  list.innerHTML = '';

  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = `session-item ${s.id === state.currentSessionId ? 'active' : ''}`;
    const tagsHtml = (s.tags || []).map(t => `<span class="session-tag">${esc(t)}</span>`).join('');
    const snippetHtml = s.matchSnippet ? `<div class="session-snippet">${esc(s.matchSnippet)}</div>` : '';
    item.innerHTML = `
      <div class="session-info">
        <div class="session-name">${esc(s.name)}</div>
        ${tagsHtml ? `<div class="session-tags">${tagsHtml}</div>` : ''}
        ${snippetHtml}
        <div class="session-meta">${s.messageCount} 条 · ${formatTime(s.updatedAt)}</div>
      </div>
      <button class="session-delete" data-id="${s.id}">&times;</button>`;
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('session-delete') && !e.target.classList.contains('session-tag')) loadSession(s.id);
    });
    item.querySelector('.session-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteSession(s.id); });
    list.appendChild(item);
  });
}

async function createNewSession() {
  const s = await window.codehub.createSession();
  state.currentSessionId = s.id;
  await refreshSessionList();
  clearOutput();
  document.getElementById('artifacts-btn').style.display = 'none';
}

async function loadSession(id) {
  const input = document.getElementById('message-input');
  if (state.currentSessionId && input) {
    state.drafts[state.currentSessionId] = input.value;
  }
  const s = await window.codehub.loadSession(id);
  if (!s) return;
  state.currentSessionId = id;
  await refreshSessionList();
  renderSessionHistory(s);
  if (input) {
    input.value = state.drafts[id] || '';
  }
}

async function deleteSession(id) {
  await window.codehub.deleteSession(id);
  if (state.currentSessionId === id) {
    state.currentSessionId = null;
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

  const toolIds = new Set();
  session.messages.forEach(msg => {
    if (msg.toolOutputs) Object.keys(msg.toolOutputs).forEach(id => toolIds.add(id));
  });

  toolIds.forEach(toolId => {
    const panel = document.getElementById(`panel-content-${toolId}`);
    if (!panel) return;
    panel.innerHTML = '';

    let hasOutput = false;
    session.messages.forEach(msg => {
      if (msg.toolOutputs && msg.toolOutputs[toolId]) hasOutput = true;
    });
    if (!hasOutput) return;

    session.messages.forEach(msg => {
      const userDiv = document.createElement('div');
      userDiv.className = 'panel-user-msg';
      userDiv.innerHTML = `<span class="msg-avatar user-avatar">👤</span><span class="msg-text">${esc(msg.content)}</span>`;
      panel.appendChild(userDiv);

      if (msg.toolOutputs && msg.toolOutputs[toolId]) {
          const output = msg.toolOutputs[toolId];
          const replyDiv = document.createElement('div');
          replyDiv.className = 'panel-reply';
          replyDiv.dataset.done = 'true';
          if (output.error) {
            replyDiv.classList.add('panel-reply-error');
            replyDiv.textContent = output.error;
          } else {
            replyDiv.innerHTML = renderMarkdown(output.content || '(无输出)');
          }
          panel.appendChild(replyDiv);
        }
    });
  });

  scrollAllPanels();
}

async function editSessionTags() {
  if (!state.currentSessionId) return;
  const session = await window.codehub.loadSession(state.currentSessionId);
  if (!session) return;
  const currentTags = (session.tags || []).join(', ');
  const input = prompt('标签 (逗号分隔):', currentTags);
  if (input === null) return;
  const tags = input.split(',').map(t => t.trim()).filter(Boolean);
  await window.codehub.updateSessionTags({ sessionId: state.currentSessionId, tags });
  await refreshSessionList();
  toast.success(tags.length ? `标签已更新: ${tags.join(', ')}` : '标签已清除');
}
