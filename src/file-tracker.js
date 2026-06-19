const fs = require('fs');
const path = require('path');

class FileTracker {
  constructor() {
    this.snapshots = new Map(); // toolId -> Set of file paths
  }

  // 执行前快照
  snapshot(toolId, dir) {
    if (!dir || !fs.existsSync(dir)) {
      this.snapshots.set(toolId, new Set());
      return;
    }
    const files = this.walkDir(dir);
    this.snapshots.set(toolId, new Set(files));
  }

  // 执行后对比，返回变更文件列表
  diff(toolId, dir) {
    if (!dir || !fs.existsSync(dir)) return [];
    const before = this.snapshots.get(toolId) || new Set();
    const after = new Set(this.walkDir(dir));

    const changed = [];
    for (const f of after) {
      if (!before.has(f)) {
        changed.push({ path: f, type: 'created' });
      } else {
        const beforeStat = this.safeStat(path.join(dir, f));
        const afterStat = this.safeStat(path.join(dir, f));
        if (beforeStat && afterStat && beforeStat.mtimeMs < afterStat.mtimeMs) {
          changed.push({ path: f, type: 'modified' });
        }
      }
    }
    for (const f of before) {
      if (!after.has(f)) {
        changed.push({ path: f, type: 'deleted' });
      }
    }

    this.snapshots.delete(toolId);
    return changed;
  }

  walkDir(dir, prefix = '') {
    const results = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        // 跳过隐藏文件和node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.walkDir(fullPath, relPath));
        } else {
          results.push(relPath);
        }
      }
    } catch {}
    return results;
  }

  safeStat(filePath) {
    try { return fs.statSync(filePath); } catch { return null; }
  }

  // 读取文件内容
  readFile(dir, relPath) {
    try {
      return fs.readFileSync(path.join(dir, relPath), 'utf8');
    } catch { return null; }
  }
}

module.exports = { FileTracker };
