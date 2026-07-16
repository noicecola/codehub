const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SessionManager {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'sessions');
    this.ensureDataDir();
    this.cleanupOldSessions();
    this._cache = new Map(); // filename -> { mtime, data }
    this._cacheMaxSize = 100; // LRU 上限
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  cleanupOldSessions(maxAgeDays = 30) {
    const files = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
    const cutoff = Date.now() - maxAgeDays * 86400000;
    files.forEach(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.dataDir, f), 'utf8'));
        if (data.updatedAt < cutoff) {
          fs.unlinkSync(path.join(this.dataDir, f));
          this._cache.delete(f);
        }
      } catch (err) {
        console.error(`Failed to process session ${f}:`, err.message);
      }
    });
  }

  // 基于 mtime 的增量缓存读取（LRU 淘汰）
  _readSessionFile(filename) {
    const filePath = path.join(this.dataDir, filename);
    try {
      const stat = fs.statSync(filePath);
      const mtime = stat.mtimeMs;
      const cached = this._cache.get(filename);
      if (cached && cached.mtime === mtime) {
        // 命中：移到末尾（最近使用）
        this._cache.delete(filename);
        this._cache.set(filename, cached);
        return cached.data;
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      // 写入前检查容量，淘汰最久未使用
      if (this._cache.size >= this._cacheMaxSize) {
        const oldest = this._cache.keys().next().value;
        this._cache.delete(oldest);
      }
      this._cache.set(filename, { mtime, data });
      return data;
    } catch (err) {
      this._cache.delete(filename);
      return null;
    }
  }

  // 写入后失效缓存
  _invalidate(filename) {
    this._cache.delete(filename);
  }

  // 手动刷新全部缓存（应对外部编辑等场景）
  invalidateCache() {
    this._cache.clear();
  }

  listSessions() {
    const files = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const data = this._readSessionFile(f);
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        messageCount: data.messages.length,
        tags: data.tags || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  searchSessions(query) {
    if (!query) return this.listSessions();
    const q = query.toLowerCase();
    const files = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const data = this._readSessionFile(f);
      if (!data) return null;
      let matchSnippet = null;
      for (const msg of data.messages) {
        if (msg.content && msg.content.toLowerCase().includes(q)) {
          matchSnippet = msg.content.substring(0, 80);
          break;
        }
        if (msg.toolOutputs || msg.toolResults) {
          for (const [toolId, output] of Object.entries(msg.toolOutputs || msg.toolResults)) {
            if (output.content && output.content.toLowerCase().includes(q)) {
              matchSnippet = `[${toolId}] ${output.content.substring(0, 60)}`;
              break;
            }
          }
          if (matchSnippet) break;
        }
      }
      return {
        id: data.id,
        name: data.name,
        messageCount: data.messages.length,
        tags: data.tags || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        matchSnippet,
      };
    })
    .filter(s => {
      if (!s) return false;
      if (s.name.toLowerCase().includes(q)) return true;
      if ((s.tags || []).some(t => t.toLowerCase().includes(q))) return true;
      if (s.matchSnippet) return true;
      return false;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getLatestSession() {
    const sessions = this.listSessions();
    if (sessions.length === 0) return null;
    return this.loadSession(sessions[0].id);
  }

  createSession(name) {
    const id = `session_${Date.now()}`;
    const session = {
      id,
      name: name || `会话 ${new Date().toLocaleString('zh-CN')}`,
      messages: [],
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.saveSession(session);
    return session;
  }

  saveSession(session) {
    session.updatedAt = Date.now();
    const filename = `${session.id}.json`;
    const filePath = path.join(this.dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
    // 写入后更新缓存（LRU：移到末尾）
    try {
      const stat = fs.statSync(filePath);
      this._cache.delete(filename);
      if (this._cache.size >= this._cacheMaxSize) {
        const oldest = this._cache.keys().next().value;
        this._cache.delete(oldest);
      }
      this._cache.set(filename, { mtime: stat.mtimeMs, data: session });
    } catch {}
    return session;
  }

  loadSession(sessionId) {
    const filename = `${sessionId}.json`;
    return this._readSessionFile(filename);
  }

  deleteSession(sessionId) {
    const filename = `${sessionId}.json`;
    const filePath = path.join(this.dataDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this._invalidate(filename);
      return true;
    }
    return false;
  }

  addMessage(sessionId, message) {
    const session = this.loadSession(sessionId);
    if (!session) return null;

    // 按工具区分存储
    const toolOutputs = {};
    for (const [toolId, result] of Object.entries(message.toolResults || {})) {
      toolOutputs[toolId] = {
        content: result.content || '',
        exitCode: result.exitCode || 0,
        error: result.error || null,
      };
    }

    session.messages.push({
      id: `msg_${Date.now()}`,
      content: message.content,
      timestamp: Date.now(),
      toolOutputs,
      artifacts: message.artifacts || {},
    });

    return this.saveSession(session);
  }

  updateToolOutput(sessionId, toolId, result) {
    const session = this.loadSession(sessionId);
    if (!session || session.messages.length === 0) return null;
    const lastMsg = session.messages[session.messages.length - 1];
    if (!lastMsg.toolOutputs) lastMsg.toolOutputs = {};
    lastMsg.toolOutputs[toolId] = {
      content: result.content || '',
      exitCode: result.exitCode || 0,
      error: result.error || null,
    };
    return this.saveSession(session);
  }
}

module.exports = { SessionManager };
