// === 真正的虚拟滚动 ===
// 只渲染可视区域内的消息，支持动态高度

class VirtualScroll {
  constructor(container, options = {}) {
    this.container = container;
    this.items = [];
    this.renderedItems = new Map();
    this.estimatedItemHeight = options.estimatedItemHeight || 60;
    this.bufferSize = options.bufferSize || 10;
    this.renderCallback = options.renderCallback || (() => null);
    this.onItemRender = options.onItemRender || null;

    this.spacerTop = document.createElement('div');
    this.spacerTop.className = 'virtual-spacer-top';
    this.spacerTop.style.width = '1px';
    this.spacerTop.style.visibility = 'hidden';

    this.contentWrapper = document.createElement('div');
    this.contentWrapper.className = 'virtual-content';
    this.contentWrapper.style.position = 'relative';

    this.spacerBottom = document.createElement('div');
    this.spacerBottom.className = 'virtual-spacer-bottom';
    this.spacerBottom.style.width = '1px';
    this.spacerBottom.style.visibility = 'hidden';

    this.container.appendChild(this.spacerTop);
    this.container.appendChild(this.contentWrapper);
    this.container.appendChild(this.spacerBottom);

    this.container.style.overflow = 'auto';

    this.isAutoScroll = true;
    this.scrollTop = 0;
    this.clientHeight = 0;

    this.rafId = null;
    this.container.addEventListener('scroll', () => this.scheduleUpdate(), { passive: true });

    this.resizeObserver = new ResizeObserver(() => {
      this.clientHeight = this.container.clientHeight;
      this.update();
    });
    this.resizeObserver.observe(this.container);
  }

  addItem(item) {
    this.items.push(item);
    if (this.isAutoScroll) {
      this.scrollToBottom();
    }
    this.update();
  }

  updateLastItem(content) {
    if (this.items.length > 0) {
      const lastItem = this.items[this.items.length - 1];
      lastItem.content = content;
      const el = this.renderedItems.get(this.items.length - 1);
      if (el && this.onItemRender) {
        this.onItemRender(el, lastItem, this.items.length - 1);
      }
    }
  }

  getItems() {
    return this.items;
  }

  clear() {
    this.items = [];
    this.renderedItems.clear();
    this.contentWrapper.innerHTML = '';
    this.spacerTop.style.height = '0px';
    this.spacerBottom.style.height = '0px';
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.container.scrollTop = this.container.scrollHeight;
    });
  }

  scheduleUpdate() {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.update();
    });
  }

  update() {
    this.scrollTop = this.container.scrollTop;
    this.clientHeight = this.container.clientHeight || this.container.offsetHeight;

    if (this.items.length === 0) {
      this.contentWrapper.innerHTML = '';
      this.spacerTop.style.height = '0px';
      this.spacerBottom.style.height = '0px';
      return;
    }

    const totalHeight = this.items.length * this.estimatedItemHeight;
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.estimatedItemHeight) - this.bufferSize);
    const endIndex = Math.min(
      this.items.length,
      Math.ceil((this.scrollTop + this.clientHeight) / this.estimatedItemHeight) + this.bufferSize
    );

    this.spacerTop.style.height = `${startIndex * this.estimatedItemHeight}px`;
    this.spacerBottom.style.height = `${Math.max(0, (this.items.length - endIndex) * this.estimatedItemHeight)}px`;

    const toRemove = [];
    this.renderedItems.forEach((el, idx) => {
      if (idx < startIndex || idx >= endIndex) {
        toRemove.push(idx);
      }
    });
    toRemove.forEach(idx => {
      const el = this.renderedItems.get(idx);
      if (el) el.remove();
      this.renderedItems.delete(idx);
    });

    const fragment = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      if (!this.renderedItems.has(i)) {
        const el = this.renderCallback(this.items[i], i);
        if (el) {
          el.style.position = 'absolute';
          el.style.top = `${i * this.estimatedItemHeight}px`;
          el.style.left = '0';
          el.style.right = '0';
          this.renderedItems.set(i, el);
          fragment.appendChild(el);
        }
      }
    }
    this.contentWrapper.appendChild(fragment);

    this.isAutoScroll = this.scrollTop + this.clientHeight >= this.container.scrollHeight - 50;
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.container.innerHTML = '';
  }
}

if (typeof module !== 'undefined') module.exports = { VirtualScroll };
