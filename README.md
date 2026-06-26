# CodeHub

多工具消息分发桌面端 — 同时向多个 AI 编码工具发送消息，并行执行并对比结果。

## 功能

### 核心
- **多工具并行**: 同时向 9 个内置 AI 编码工具发送同一消息，先完成先显示
- **流式输出**: 实时显示各工具的响应过程
- **结果对比**: 并排对比不同工具的输出
- **产物追踪**: 自动检测工具执行后的文件变更（创建/修改/删除）
- **会话管理**: 保存/加载/导出对话历史（支持 JSON 和 Markdown）
- **消息模板**: 内置常用模板（解释代码、代码审查、重构、写测试、调试）
- **自定义工具**: 支持添加 CLI 命令或 HTTP API 接口工具

### UI/UX
- **Markdown 渲染**: 输出支持 Markdown 格式 + 代码语法高亮（15 种语言）
- **用户/AI 头像**: 消息气泡带角色头像，用户右对齐，AI 左对齐
- **消息轮次分隔**: 每轮对话之间有时间戳分隔线
- **边框呼吸动画**: 工具运行时边框亮暗变化，每工具独立颜色
- **面板拖拽排序**: 拖拽面板调整顺序
- **彩色边框**: 每个工具独立颜色（红/蓝/绿/橙/紫/青/棕）
- **耗时统计**: 每工具显示响应时间（秒）和输出长度（字符数）

### 交互
- **重试单个工具**: 失败后面板显示重试按钮，单独重跑
- **错误详情展开**: 长错误信息可折叠/展开
- **消息草稿**: 切换会话时自动保存未发送的输入内容
- **文件拖拽**: 拖拽文件路径到输入框
- **大输出优化**: 超过 8k 字符自动截断，点击"显示全部"展开
- **会话搜索**: 搜索会话名称、标签、对话内容
- **工具预设**: 保存常用工具组合，一键切换
- **会话标签**: 为会话添加标签，分类管理

### 快捷键
| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Enter` | 发送消息 |
| `Ctrl+N` | 新建会话 |
| `Ctrl+K` | 搜索会话 |
| `Ctrl+B` | 折叠/展开侧边栏 |

### 数据管理
- **会话导出**: Markdown / JSON 格式
- **会话自动清理**: 30 天自动清理旧会话
- **会话标签搜索**: 按标签过滤会话
- **消息内容搜索**: 搜索对话历史中的关键词

### 技术特性
- **配置驱动架构**: 新增工具只需在 `adapters.config.js` 添加一行配置
- **单元测试**: 34 个测试覆盖核心模块
- **CSS 模块化**: 样式按功能拆分为 5 个文件
- **Electron 安全**: `contextIsolation: true`，IPC 全部通过 preload 桥接

## 架构

```
src/
├── main.js              # Electron 主进程（IPC 处理）
├── preload.js           # 上下文桥接（安全 API 暴露）
├── session-manager.js   # 会话持久化（JSON 文件）
├── file-tracker.js      # 文件变更追踪（快照 + diff）
├── core/
│   ├── adapters.config.js # 适配器配置表（新增工具只需改这里）
│   ├── adapter.js       # 适配器（配置驱动工厂）
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
    ├── messages.js      # 消息发送
    ├── output.js        # 输出面板管理
    ├── modals.js        # 弹窗管理
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

| 工具 | 命令 | 安装 |
|------|------|------|
| Claude Code | `claude` | [docs.anthropic.com](https://docs.anthropic.com/claude-code) |
| MiMo Code | `mimo` | [github.com/xiaomi/mimo-code](https://github.com/xiaomi/mimo-code) |
| Codex CLI | `codex` | [github.com/openai/codex](https://github.com/openai/codex) |
| Gemini CLI | `gemini` | [github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) |
| Copilot CLI | `gh copilot` | [github.com/features/copilot](https://github.com/features/copilot) |
| OpenCode | `opencode` | [github.com/opencode-ai/opencode](https://github.com/opencode-ai/opencode) |
| Kilo Code | `kilo` | [github.com/Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode) |
| Qwen Code | `qwen` | [qwen 文档](https://help.aliyun.com/zh/model-studio/) |
| Trae | `trae` | [trae.ai](https://trae.ai) |

未安装的工具会显示为"未安装"状态，不影响其他工具使用。

## 使用

1. 在底部工具选择器中勾选要使用的工具
2. 选择工作目录（可选）
3. 输入消息，按 `Ctrl+Enter` 或点击"发送"
4. 查看各工具的并行输出
5. 使用"对比"按钮并排查看结果
6. 使用"产物"按钮查看文件变更

### 示例：同时向 9 个工具发送消息

```
输入：请用 Python 实现一个快速排序算法

输出面板：
┌─────────────────┬─────────────────┬─────────────────┐
│ Claude Code     │ MiMo Code       │ Codex CLI       │
│ [流式输出中...]  │ [流式输出中...]   │ [流式输出中...]   │
│                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┤
│ Gemini CLI      │ Copilot CLI     │ OpenCode        │
│ [流式输出中...]  │ [流式输出中...]   │ [流式输出中...]   │
│                 │                 │                 │
├─────────────────┼─────────────────┼─────────────────┤
│ Kilo Code       │ Qwen Code       │ Trae            │
│ [流式输出中...]  │ [流式输出中...]   │ [流式输出中...]   │
│                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Enter` | 发送消息 |
| `Ctrl+N` | 新建会话 |
| `Ctrl+K` | 搜索会话 |
| `Ctrl+B` | 折叠/展开侧边栏 |

### 工具预设

保存常用的工具组合，一键切换：

- **前端组**: Claude Code + Codex CLI + Gemini CLI
- **后端组**: Claude Code + MiMo Code + Qwen Code
- **全量组**: 全部 9 个工具
- **自定义**: 任意工具组合

预设存储在 `~/Library/Application Support/codehub/presets.json`

### 会话标签

为会话添加标签，方便分类管理：

- `#前端` `#后端` `#调试` `#重构`
- 搜索时自动匹配标签内容

## 自定义工具

点击侧边栏"工具"按钮，添加自定义工具：

### CLI 命令
- **名称**: 显示名称
- **命令**: CLI 命令（如 `python3`、`node`）
- **参数**: 命令行参数（可选）

### HTTP API
- **名称**: 显示名称
- **URL**: API 地址（如 `http://localhost:8080`）
- **路径**: 接口路径（默认 `/chat`）

自定义工具存储在 `~/Library/Application Support/codehub/custom-tools.json`

## 导出

支持将会话导出为：
- **Markdown**: 可读的对话记录
- **JSON**: 完整的结构化数据

## 数据存储

| 数据 | 路径 |
|------|------|
| 会话 | `~/Library/Application Support/codehub/sessions/` |
| 自定义工具 | `~/Library/Application Support/codehub/custom-tools.json` |
| 预设 | `~/Library/Application Support/codehub/presets.json` |
| 模板 | `~/Library/Application Support/codehub/templates.json` |

## 测试

```bash
npm test
```

34 个单元测试覆盖：
- Parser（Claude/MiMo/纯文本/流式解析）
- Transport（CLI/HTTP）
- Router（工具停止）
- FileTracker（文件变更检测）
- Adapter Config（配置表验证）

## 许可

MIT
