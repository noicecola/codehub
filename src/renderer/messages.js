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

// === 消息发送 ===

function updateSendButton() {
  const btn = document.getElementById('send-btn');
  if (btn) btn.disabled = state.isRunning || state.selectedTools.size === 0;
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
    if (result.elapsed) showToolStats(toolId, result);
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
    if (artifacts) {
      for (const [toolId, files] of Object.entries(artifacts)) {
        if (files?.length) state.lastArtifacts[toolId] = files;
      }
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

function checkAllDone() {
  const allDone = Array.from(state.selectedTools).every(id => {
    const el = document.getElementById(`panel-status-${id}`);
    return el && (el.classList.contains('status-completed') || el.classList.contains('status-error'));
  });
  if (allDone && state.isRunning) {
    state.isRunning = false;
    updateSendButton();
    document.getElementById('send-btn').style.display = 'inline-block';
    document.getElementById('stop-btn').style.display = 'none';
    refreshSessionList();
  }
}
