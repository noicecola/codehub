const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const { MessageRouter } = require('../src/core/router');

function createMockRegistry(tools = {}) {
  return {
    get: (id) => tools[id] || null,
  };
}

describe('MessageRouter', () => {
  it('broadcasts message to multiple tools in parallel', async () => {
    const results = {};
    const tool1 = { run: async () => ({ content: 'r1', exitCode: 0 }) };
    const tool2 = { run: async () => ({ content: 'r2', exitCode: 0 }) };
    const registry = createMockRegistry({ t1: tool1, t2: tool2 });
    const router = new MessageRouter(registry);

    const out = await router.broadcast({
      content: 'hello',
      toolIds: ['t1', 't2'],
      workDir: '/tmp',
    });

    assert.equal(out.t1.content, 'r1');
    assert.equal(out.t2.content, 'r2');
  });

  it('returns error for unknown tool', async () => {
    const registry = createMockRegistry({});
    const router = new MessageRouter(registry);

    const out = await router.broadcast({
      content: 'hello',
      toolIds: ['unknown'],
      workDir: '/tmp',
    });

    assert.ok(out.unknown.error);
  });

  it('catches tool execution errors', async () => {
    const tool = { run: async () => { throw new Error('fail'); } };
    const registry = createMockRegistry({ t1: tool });
    const router = new MessageRouter(registry);

    const out = await router.broadcast({
      content: 'hello',
      toolIds: ['t1'],
      workDir: '/tmp',
    });

    assert.ok(out.t1.error);
    assert.ok(out.t1.error.includes('fail'));
  });

  it('calls onChunk callback during execution', async () => {
    const tool = {
      run: async (msg, dir, onChunk) => {
        onChunk('chunk1');
        return { content: 'done', exitCode: 0 };
      },
    };
    const registry = createMockRegistry({ t1: tool });
    const router = new MessageRouter(registry);
    const chunks = [];

    await router.broadcast({
      content: 'hello',
      toolIds: ['t1'],
      workDir: '/tmp',
      onChunk: (toolId, chunk) => chunks.push({ toolId, chunk }),
    });

    assert.deepEqual(chunks, [{ toolId: 't1', chunk: 'chunk1' }]);
  });

  it('stop calls adapter stop', async () => {
    let stopped = false;
    const tool = { stop: () => { stopped = true; } };
    const registry = createMockRegistry({ t1: tool });
    const router = new MessageRouter(registry);

    router.stop('t1');
    assert.ok(stopped);
  });
});
