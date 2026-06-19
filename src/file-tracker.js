const fs = require('fs');
const path = require('path');

class FileTracker {
  constructor() {
    this.snapshots = new Map(); // toolId -> Set of file paths
  }

  // 执行前快照
  snapshot(toolId, dir) {
    if (!dir || !fs.existsSync(dir)) {
      this.snapshots.set(toolId, new Map());
      return;
    }
    const files = this.walkDirWithStats(dir);
    this.snapshots.set(toolId, files);
  }

  walkDirWithStats(dir, prefix = '') {
    const results = new Map();
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          for (const [k, v] of this.walkDirWithStats(fullPath, relPath)) {
            results.set(k, v);
          }
        } else {
          const stat = this.safeStat(fullPath);
          results.set(relPath, stat ? stat.mtimeMs : 0);
        }
      }
    } catch {}
    return results;
  }

  // 执行后对比，返回变更文件列表
  diff(toolId, dir) {
    if (!dir || !fs.existsSync(dir)) return [];
    const before = this.snapshots.get(toolId) || new Map();
    const after = this.walkDirWithStats(dir);

    const changed = [];
    for (const [f, afterMtime] of after) {
      if (!before.has(f)) {
        changed.push({ path: f, type: 'created' });
      } else if (before.get(f) < afterMtime) {
        changed.push({ path: f, type: 'modified' });
      }
    }
    for (const f of before.keys()) {
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
