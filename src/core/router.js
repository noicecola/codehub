// === Router 层 ===
// 工具停止控制

class MessageRouter {
  constructor(registry) {
    this.registry = registry;
  }

  stop(toolId) {
    const adapter = this.registry.get(toolId);
    if (adapter) adapter.stop();
  }
}

module.exports = { MessageRouter };
