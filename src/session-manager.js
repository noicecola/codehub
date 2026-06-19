const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SessionManager {
  constructor() {
    this.dataDir = path.join(app.getPath('userData'), 'sessions');
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  listSessions() {
    const files = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(this.dataDir, f), 'utf8'));
      return {
        id: data.id,
        name: data.name,
        messageCount: data.messages.length,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }).sort((a, b) => b.updatedAt - a.updatedAt);
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
}

module.exports = { SessionManager };
