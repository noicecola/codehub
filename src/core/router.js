// === Router 层 ===
// 统一消息路由，支持并行/重试/超时

class MessageRouter {
  constructor(registry) {
    this.registry = registry;
  }

  async broadcast({ content, toolIds, workDir, onChunk }) {
    const promises = toolIds.map(async (toolId) => {
      const adapter = this.registry.get(toolId);
      if (!adapter) {
        return { toolId, result: { error: `Unknown tool: ${toolId}` } };
      }

      try {
        const result = await adapter.run(content, workDir, (chunk) => {
          if (onChunk) onChunk(toolId, chunk);
        });
        return { toolId, result };
      } catch (err) {
        return { toolId, result: { error: err.message } };
      }
    });

    const outcomes = await Promise.all(promises);

    const results = {};
    outcomes.forEach(({ toolId, result }) => {
      results[toolId] = result;
    });

    return results;
  }

  stop(toolId) {
    const adapter = this.registry.get(toolId);
    if (adapter) adapter.stop();
  }

  stopAll(toolIds) {
    toolIds.forEach(id => this.stop(id));
  }
}

module.exports = { MessageRouter };
