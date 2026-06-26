const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SessionManager {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'sessions');
    this.ensureDataDir();
    this.cleanupOldSessions();
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
        }
      } catch (err) {
        console.error(`Failed to process session ${f}:`, err.message);
      }
    });
  }

  listSessions() {
    const files = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(this.dataDir, f), 'utf8'));
      return {
        id: data.id,
        name: data.name,
        messageCount: data.messages.length,
        tags: data.tags || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  searchSessions(query) {
    if (!query) return this.listSessions();
    const q = query.toLowerCase();
    const files = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(this.dataDir, f), 'utf8'));
      let matchSnippet = null;
      for (const msg of data.messages) {
        if (msg.content && msg.content.toLowerCase().includes(q)) {
          matchSnippet = msg.content.substring(0, 80);
          break;
        }
        if (msg.toolOutputs) {
          for (const [toolId, output] of Object.entries(msg.toolOutputs)) {
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
    const filePath = path.join(this.dataDir, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
    return session;
  }

  loadSession(sessionId) {
    const filePath = path.join(this.dataDir, `${sessionId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  deleteSession(sessionId) {
    const filePath = path.join(this.dataDir, `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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
