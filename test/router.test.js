const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MessageRouter } = require('../src/core/router');

function createMockRegistry(tools = {}) {
  return {
    get: (id) => tools[id] || null,
  };
}

describe('MessageRouter', () => {
  it('stop calls adapter stop', () => {
    let stopped = false;
    const tool = { stop: () => { stopped = true; } };
    const registry = createMockRegistry({ t1: tool });
    const router = new MessageRouter(registry);

    router.stop('t1');
    assert.ok(stopped);
  });

  it('stop does nothing for unknown tool', () => {
    const registry = createMockRegistry({});
    const router = new MessageRouter(registry);

    // Should not throw
    router.stop('unknown');
  });
});
