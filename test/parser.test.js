const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ClaudeParser, MimoParser, PlainTextParser, StreamParser } = require('../src/core/parser');

describe('ClaudeParser', () => {
  const parser = new ClaudeParser();

  it('extracts text from assistant message', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Hello world' }] },
    });
    assert.equal(parser.parseLine(line), 'Hello world');
  });

  it('returns null for non-assistant messages', () => {
    const line = JSON.stringify({ type: 'system', message: 'test' });
    assert.equal(parser.parseLine(line), null);
  });

  it('returns null for invalid JSON', () => {
    assert.equal(parser.parseLine('not json'), null);
  });

  it('returns null when content has no text blocks', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: '123' }] },
    });
    assert.equal(parser.parseLine(line), null);
  });
});

describe('MimoParser', () => {
  const parser = new MimoParser();

  it('extracts text from text event', () => {
    const line = JSON.stringify({ type: 'text', part: { text: 'MiMo output' } });
    assert.equal(parser.parseLine(line), 'MiMo output');
  });

  it('returns null for non-text events', () => {
    const line = JSON.stringify({ type: 'tool', part: { name: 'bash' } });
    assert.equal(parser.parseLine(line), null);
  });
});

describe('PlainTextParser', () => {
  const parser = new PlainTextParser();

  it('returns line as-is', () => {
    assert.equal(parser.parseLine('any text'), 'any text');
  });

  it('returns empty string as-is', () => {
    assert.equal(parser.parseLine(''), '');
  });
});

describe('StreamParser', () => {
  it('buffers incomplete lines', () => {
    const sp = new StreamParser(new PlainTextParser());
    const r1 = sp.feed('hello ');
    assert.deepEqual(r1, []);
    const r2 = sp.feed('world\n');
    assert.deepEqual(r2, ['hello world']);
  });

  it('handles multiple lines in one chunk', () => {
    const sp = new StreamParser(new PlainTextParser());
    const results = sp.feed('line1\nline2\nline3\n');
    assert.deepEqual(results, ['line1', 'line2', 'line3']);
  });

  it('flush returns remaining buffer', () => {
    const sp = new StreamParser(new PlainTextParser());
    sp.feed('partial');
    const remaining = sp.flush();
    assert.deepEqual(remaining, ['partial']);
  });

  it('flush returns empty after flush', () => {
    const sp = new StreamParser(new PlainTextParser());
    sp.feed('partial');
    sp.flush();
    const remaining = sp.flush();
    assert.deepEqual(remaining, []);
  });

  it('skips empty lines', () => {
    const sp = new StreamParser(new PlainTextParser());
    const results = sp.feed('a\n\nb\n\n');
    assert.deepEqual(results, ['a', 'b']);
  });

  it('works with ClaudeParser for JSON streams', () => {
    const sp = new StreamParser(new ClaudeParser());
    const msg1 = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'part1' }] },
    });
    const msg2 = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'part2' }] },
    });
    const results = sp.feed(`${msg1}\n${msg2}\n`);
    assert.deepEqual(results, ['part1', 'part2']);
  });
});
