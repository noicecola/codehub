# CodeHub

多工具消息分发桌面端 — 同时向多个 AI 编码工具发送消息，并行执行并对比结果。

## 功能

- **多工具并行**: 同时向 Claude Code、MiMo Code 等多个工具发送同一消息
- **流式输出**: 实时显示各工具的响应过程
- **结果对比**: 并排对比不同工具的输出
- **产物追踪**: 自动检测工具执行后的文件变更（创建/修改/删除）
- **会话管理**: 保存/加载/导出对话历史（支持 JSON 和 Markdown）
- **消息模板**: 内置常用模板（解释代码、代码审查、重构、写测试、调试）
- **自定义工具**: 支持添加任意 CLI 工具

## 架构

```
src/
├── main.js              # Electron 主进程（IPC 处理）
├── preload.js           # 上下文桥接（安全 API 暴露）
├── session-manager.js   # 会话持久化（JSON 文件）
├── file-tracker.js      # 文件变更追踪（快照 + diff）
├── core/
│   ├── adapter.js       # 适配器（组合 Transport + Parser）
│   ├── transport.js     # 通信层（CLI / HTTP）
│   ├── parser.js        # 输出解析（Claude/MiMo/纯文本）
│   ├── registry.js      # 适配器注册中心
│   └── router.js        # 工具停止控制
├── components/
│   ├── modal.js         # 模态框管理
│   ├── toast.js         # 通知提示
│   └── diff-viewer.js   # 结果对比视图
└── renderer/
    ├── index.html       # 界面结构
    ├── state.js         # 全局状态
    ├── app.js           # 入口 + 事件绑定
    ├── tools.js         # 工具选择器 + 管理
    ├── messages.js      # 消息发送 + 输出渲染
    ├── sessions.js      # 会话侧边栏
    ├── base.css         # 变量 + 布局
    ├── sidebar.css      # 侧边栏样式
    ├── panels.css       # 面板样式
    ├── input.css        # 输入区样式
    └── modals.css       # 弹窗样式
```

## 安装

```bash
npm install
```

## 运行

```bash
# 正常启动
npm start

# 开发模式（自动打开 DevTools）
npm run dev
```

## 构建

```bash
# macOS
npm run build

# Windows
npm run build:win

# Linux
npm run build:linux
```

构建产物输出到 `dist/` 目录。

## 前置要求

需要安装至少一个 AI 编码工具：

- [Claude Code](https://docs.anthropic.com/claude-code) — `claude` 命令
- [MiMo Code](https://github.com/xiaomi/mimo-code) — `mimo` 命令

未安装的工具会显示为"未安装"状态，不影响其他工具使用。

## 使用

1. 在底部工具选择器中勾选要使用的工具
2. 选择工作目录（可选）
3. 输入消息，按 `Ctrl+Enter` 或点击"发送"
4. 查看各工具的并行输出
5. 使用"对比"按钮并排查看结果
6. 使用"产物"按钮查看文件变更

## 自定义工具

点击侧边栏"工具"按钮，添加自定义 CLI 工具：

- **名称**: 显示名称
- **命令**: CLI 命令（如 `python3`、`node`）
- **参数**: 命令行参数（可选）

## 导出

支持将会话导出为：
- **Markdown**: 可读的对话记录
- **JSON**: 完整的结构化数据

## 许可

MIT
