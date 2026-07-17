// === 虚拟滚动 ===
// 只渲染可见区域的消息，优化大量消息时的性能

class VirtualScroll {
  constructor(container, options = {}) {
    this.container = container;
    this.items = [];
    this.renderedRange = { start: 0, end: 0 };
    this.estimatedItemHeight = options.estimatedItemHeight || 60;
    this.bufferSize = options.bufferSize || 5;
    this.renderCallback = options.renderCallback || (() => null);

    this.sentinel = document.createElement('div');
    this.sentinel.className = 'virtual-scroll-sentinel';
    this.sentinel.style.height = '0px';
    this.sentinel.style.visibility = 'hidden';

    this.contentWrapper = document.createElement('div');
    this.contentWrapper.className = 'virtual-scroll-content';

    this.container.appendChild(this.sentinel);
    this.container.appendChild(this.contentWrapper);

    this.container.style.overflow = 'auto';
    this.container.addEventListener('scroll', () => this.onScroll(), { passive: true });

    this.isAutoScroll = true;
    this.lastScrollHeight = 0;
  }

  addItem(item) {
    this.items.push(item);
    this.updateSentinel();
    if (this.isAutoScroll) {
      this.scrollToBottom();
    }
    this.renderVisible();
  }

  updateLastItem(content) {
    if (this.items.length > 0) {
      this.items[this.items.length - 1].content = content;
      this.renderVisible();
    }
  }

  getItems() {
    return this.items;
  }

  clear() {
    this.items = [];
    this.contentWrapper.innerHTML = '';
    this.renderedRange = { start: 0, end: 0 };
  }

  updateSentinel() {
    const totalHeight = this.items.length * this.estimatedItemHeight;
    this.sentinel.style.height = `${totalHeight}px`;
  }

  onScroll() {
    const { scrollTop, clientHeight } = this.container;
    const scrollHeight = this.container.scrollHeight;

    this.isAutoScroll = scrollTop + clientHeight >= scrollHeight - 50;
    this.renderVisible();
  }

  renderVisible() {
    const { scrollTop, clientHeight } = this.container;
    const startIdx = Math.max(0, Math.floor(scrollTop / this.estimatedItemHeight) - this.bufferSize);
    const endIdx = Math.min(
      this.items.length,
      Math.ceil((scrollTop + clientHeight) / this.estimatedItemHeight) + this.bufferSize
    );

    if (startIdx === this.renderedRange.start && endIdx === this.renderedRange.end) {
      return;
    }

    this.renderedRange = { start: startIdx, end: endIdx };
    this.renderItems();
  }

  renderItems() {
    const fragment = document.createDocumentFragment();
    const { start, end } = this.renderedRange;

    for (let i = start; i < end && i < this.items.length; i++) {
      const el = this.renderCallback(this.items[i], i);
      if (el) {
        el.style.position = 'absolute';
        el.style.top = `${i * this.estimatedItemHeight}px`;
        el.style.left = '0';
        el.style.right = '0';
        fragment.appendChild(el);
      }
    }

    this.contentWrapper.innerHTML = '';
    this.contentWrapper.style.position = 'relative';
    this.contentWrapper.style.minHeight = `${this.items.length * this.estimatedItemHeight}px`;
    this.contentWrapper.appendChild(fragment);
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.container.scrollTop = this.container.scrollHeight;
    });
  }

  measureItems() {
    if (this.items.length === 0) return;

    const testEl = this.renderCallback(this.items[0], 0);
    if (testEl) {
      testEl.style.position = 'absolute';
      testEl.style.visibility = 'hidden';
      testEl.style.left = '-9999px';
      this.container.appendChild(testEl);
      const height = testEl.offsetHeight || this.estimatedItemHeight;
      testEl.remove();
      this.estimatedItemHeight = Math.max(height, 30);
      this.updateSentinel();
    }
  }
}

if (typeof module !== 'undefined') module.exports = { VirtualScroll };
