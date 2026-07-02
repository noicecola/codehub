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
  const cols = masonry ? 2 : (visiblePanels.length <= 2 ? visiblePanels.length : (visiblePanels.length === 3 ? 3 : 2));

  if (masonry) {
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
    msgDiv.innerHTML = `<span class="msg-text">${esc(content)}</span><span class="msg-avatar user-avatar">👤</span><button class="copy-msg-btn" title="复制">📋</button>`;
    msgDiv.querySelector('.copy-msg-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(content);
      e.target.textContent = '✓';
      setTimeout(() => e.target.textContent = '📋', 1500);
    });
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
    reply.innerHTML = `<span class="msg-avatar ai-avatar">🤖</span><span class="reply-body"></span><button class="copy-msg-btn" title="复制">📋</button>`;
    reply.querySelector('.copy-msg-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const body = reply.querySelector('.reply-body');
      navigator.clipboard.writeText(body ? body.textContent : reply.textContent);
      e.target.textContent = '✓';
      setTimeout(() => e.target.textContent = '📋', 1500);
    });
    panel.appendChild(reply);
  }
  const body = reply.querySelector('.reply-body');
  if (body) body.textContent += text;
  else reply.textContent += text;
  scrollPanel(toolId);
}

function finalizeOutput(toolId, content, isError) {
  const panel = document.getElementById(`panel-content-${toolId}`);
  if (!panel) return;
  let reply = panel.querySelector('.panel-reply:last-child');
  if (!reply) {
    reply = document.createElement('div');
    reply.className = 'panel-reply';
    reply.innerHTML = `<span class="msg-avatar ai-avatar">🤖</span><span class="reply-body"></span><button class="copy-msg-btn" title="复制">📋</button>`;
    reply.querySelector('.copy-msg-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const body = reply.querySelector('.reply-body');
      navigator.clipboard.writeText(body ? body.textContent : reply.textContent);
      e.target.textContent = '✓';
      setTimeout(() => e.target.textContent = '📋', 1500);
    });
    const body = reply.querySelector('.reply-body');
    if (isError) {
      reply.classList.add('panel-reply-error');
      body.innerHTML = formatError(content || '(无输出)');
    } else {
      const rendered = renderMarkdown(content || '(无输出)');
      if (content && content.length > 8000) {
        body.innerHTML = renderMarkdown(content.substring(0, 8000));
        const btn = document.createElement('button');
        btn.className = 'show-more-btn';
        btn.textContent = `显示全部 (${(content.length / 1000).toFixed(0)}k chars)`;
        btn.addEventListener('click', () => {
          body.innerHTML = renderMarkdown(content);
          reply.dataset.done = 'true';
        });
        body.appendChild(btn);
      } else {
        body.innerHTML = rendered;
      }
    }
    panel.appendChild(reply);
  } else {
    reply.dataset.done = 'true';
    const body = reply.querySelector('.reply-body');
    const finalContent = content || (body ? body.textContent : '') || '(无输出)';
    if (isError) {
      reply.classList.add('panel-reply-error');
      if (body) body.innerHTML = formatError(finalContent);
      else reply.innerHTML = `<span class="msg-avatar ai-avatar">🤖</span><span class="reply-body">${formatError(finalContent)}</span>`;
    } else {
      if (body) body.innerHTML = renderMarkdown(finalContent);
      else reply.innerHTML = `<span class="msg-avatar ai-avatar">🤖</span><span class="reply-body">${renderMarkdown(finalContent)}</span>`;
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
