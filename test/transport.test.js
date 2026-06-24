const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { CLITransport, HTTPTransport } = require('../src/core/transport');

describe('CLITransport', () => {
  it('sends message via stdin and returns exit code', async () => {
    const transport = new CLITransport('echo', ['hello']);
    const result = await transport.send('');
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('hello'));
  });

  it('sends message as argument when messageAsArg is true', async () => {
    const transport = new CLITransport('echo', [], { messageAsArg: true });
    const result = await transport.send('test message');
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('test message'));
  });

  it('calls onStdout callback with output chunks', async () => {
    const transport = new CLITransport('echo', ['chunk test']);
    const chunks = [];
    await transport.send('', { onStdout: (data) => chunks.push(data) });
    assert.ok(chunks.length > 0);
    assert.ok(chunks.join('').includes('chunk test'));
  });

  it('returns non-zero exit code for failing commands', async () => {
    const transport = new CLITransport('false');
    const result = await transport.send('');
    assert.notEqual(result.exitCode, 0);
  });

  it('stop kills running process', async () => {
    const transport = new CLITransport('sleep', ['10']);
    const promise = transport.send('');
    transport.stop();
    const result = await promise;
    assert.notEqual(result.exitCode, 0);
  });
});

describe('HTTPTransport', () => {
  it('has stop method', () => {
    const transport = new HTTPTransport('http://localhost:9999');
    assert.equal(typeof transport.stop, 'function');
  });
});
