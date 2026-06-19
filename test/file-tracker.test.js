const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { FileTracker } = require('../src/file-tracker');

describe('FileTracker', () => {
  let tracker;
  let tmpDir;

  beforeEach(() => {
    tracker = new FileTracker();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filetracker-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects created files', async () => {
    await tracker.snapshot('tool1', tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'new.txt'), 'hello');
    const changes = await tracker.diff('tool1', tmpDir);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].path, 'new.txt');
    assert.equal(changes[0].type, 'created');
  });

  it('detects modified files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'existing.txt'), 'old');
    await tracker.snapshot('tool1', tmpDir);
    await new Promise(r => setTimeout(r, 50));
    fs.writeFileSync(path.join(tmpDir, 'existing.txt'), 'new');
    const changes = await tracker.diff('tool1', tmpDir);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].path, 'existing.txt');
    assert.equal(changes[0].type, 'modified');
  });

  it('detects deleted files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'to-delete.txt'), 'bye');
    await tracker.snapshot('tool1', tmpDir);
    fs.unlinkSync(path.join(tmpDir, 'to-delete.txt'));
    const changes = await tracker.diff('tool1', tmpDir);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].path, 'to-delete.txt');
    assert.equal(changes[0].type, 'deleted');
  });

  it('returns empty array when no changes', async () => {
    fs.writeFileSync(path.join(tmpDir, 'stable.txt'), 'same');
    await tracker.snapshot('tool1', tmpDir);
    const changes = await tracker.diff('tool1', tmpDir);
    assert.deepEqual(changes, []);
  });

  it('skips hidden files and node_modules', async () => {
    await tracker.snapshot('tool1', tmpDir);
    fs.writeFileSync(path.join(tmpDir, '.hidden'), 'secret');
    fs.mkdirSync(path.join(tmpDir, 'node_modules'));
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg.js'), '');
    const changes = await tracker.diff('tool1', tmpDir);
    assert.deepEqual(changes, []);
  });

  it('handles non-existent directory gracefully', async () => {
    await tracker.snapshot('tool1', '/nonexistent');
    const changes = await tracker.diff('tool1', '/nonexistent');
    assert.deepEqual(changes, []);
  });

  it('detects files in subdirectories', async () => {
    await tracker.snapshot('tool1', tmpDir);
    fs.mkdirSync(path.join(tmpDir, 'sub'));
    fs.writeFileSync(path.join(tmpDir, 'sub', 'deep.txt'), 'deep');
    const changes = await tracker.diff('tool1', tmpDir);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].path, 'sub/deep.txt');
    assert.equal(changes[0].type, 'created');
  });

  it('respects depth limit (depth > 5 skipped)', async () => {
    // 创建 7 层嵌套目录
    let dir = tmpDir;
    for (let i = 0; i < 7; i++) {
      dir = path.join(dir, `level${i}`);
      fs.mkdirSync(dir);
    }
    fs.writeFileSync(path.join(dir, 'deep.txt'), 'too deep');

    await tracker.snapshot('tool1', tmpDir);
    // level5 以下的文件不应被扫描到
    const changes = await tracker.diff('tool1', tmpDir);
    const deepFile = changes.find(c => c.path.includes('level6'));
    assert.equal(deepFile, undefined);
  });
});
