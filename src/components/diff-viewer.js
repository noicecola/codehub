class DiffViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(results) {
    if (!this.container || !Object.keys(results).length) return;
    let html = '<div class="diff-grid">';
    for (const [toolId, result] of Object.entries(results)) {
      const content = result.content || result.error || '(无输出)';
      const isError = !!result.error;
      html += `
        <div class="diff-column">
          <div class="diff-header">
            <span class="diff-tool-name">${this.esc(toolId)}</span>
            <button class="diff-copy-btn" data-tool="${toolId}">复制</button>
          </div>
          <pre class="diff-content ${isError ? 'diff-error' : ''}">${this.esc(content)}</pre>
        </div>`;
    }
    html += '</div>';
    this.container.innerHTML = html;
    this.container.querySelectorAll('.diff-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const toolId = btn.dataset.tool;
        const text = results[toolId]?.content || '';
        navigator.clipboard.writeText(text);
        btn.textContent = '已复制';
        setTimeout(() => btn.textContent = '复制', 1500);
      });
    });
  }

  esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
}

window.DiffViewer = DiffViewer;
