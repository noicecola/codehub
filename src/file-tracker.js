const fs = require('fs');
const path = require('path');

class FileTracker {
  constructor() {
    this.snapshots = new Map();
  }

  async snapshot(toolId, dir) {
    if (!dir || !fs.existsSync(dir)) {
      this.snapshots.set(toolId, new Map());
      return;
    }
    const files = await this.walkDirWithStats(dir);
    this.snapshots.set(toolId, files);
  }

  async walkDirWithStats(dir, prefix = '', depth = 0) {
    const results = new Map();
    // 限制扫描深度，避免递归到底
    if (depth > 5) return results;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') continue;
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const fullPath = path.join(dir, entry.name);

        try {
          if (entry.isDirectory()) {
            const sub = await this.walkDirWithStats(fullPath, relPath, depth + 1);
            for (const [k, v] of sub) results.set(k, v);
          } else {
            const stat = this.safeStat(fullPath);
            results.set(relPath, stat ? stat.mtimeMs : 0);
          }
        } catch {}
      }
    } catch {}
    return results;
  }

  async diff(toolId, dir) {
    if (!dir || !fs.existsSync(dir)) return [];
    const before = this.snapshots.get(toolId) || new Map();
    const after = await this.walkDirWithStats(dir);

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

  safeStat(filePath) {
    try { return fs.statSync(filePath); } catch { return null; }
  }

  readFile(dir, relPath) {
    try {
      return fs.readFileSync(path.join(dir, relPath), 'utf8');
    } catch { return null; }
  }
}

module.exports = { FileTracker };