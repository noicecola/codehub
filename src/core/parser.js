// === Parser 层 ===
// 统一解析不同工具的输出格式

class JSONLineParser {
  // 解析每行JSON，提取文本内容
  parseLine(line) {
    try {
      const obj = JSON.parse(line);
      return this.extract(obj);
    } catch {
      return null;
    }
  }

  extract(obj) {
    return null; // 子类实现
  }
}

// Claude Code JSON解析器
class ClaudeParser extends JSONLineParser {
  extract(obj) {
    // 支持 stream-json 格式
    if (obj.type === 'assistant' && obj.message?.content) {
      for (const block of obj.message.content) {
        if (block.type === 'text' && block.text) {
          return block.text;
        }
      }
    }
    // 支持 json 格式（单次返回）
    if (obj.type === 'result' && obj.result) {
      return obj.result;
    }
    return null;
  }
}

// MiMo Code JSON解析器
class MimoParser extends JSONLineParser {
  extract(obj) {
    if (obj.type === 'text' && obj.part?.text) {
      return obj.part.text;
    }
    return null;
  }
}

// Codex CLI JSON解析器
class CodexParser extends JSONLineParser {
  extract(obj) {
    // codex --json 输出 item.completed 事件
    if (obj.type === 'item.completed' && obj.item?.type === 'agent_message') {
      return obj.item.text;
    }
    return null;
  }
}

// 纯文本解析器（直接输出文本的工具）
class PlainTextParser extends JSONLineParser {
  parseLine(line) {
    return line; // 直接返回文本
  }
}

// 流式解析器：处理缓冲区，按行分割
class StreamParser {
  constructor(lineParser) {
    this.lineParser = lineParser;
    this.buffer = '';
  }

  feed(data) {
    this.buffer += data.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // 保留不完整的行

    const results = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const text = this.lineParser.parseLine(line);
      if (text) results.push(text);
    }
    return results;
  }

  flush() {
    if (this.buffer.trim()) {
      const text = this.lineParser.parseLine(this.buffer);
      this.buffer = '';
      return text ? [text] : [];
    }
    this.buffer = '';
    return [];
  }
}

module.exports = {
  ClaudeParser,
  MimoParser,
  CodexParser,
  PlainTextParser,
  StreamParser,
};
