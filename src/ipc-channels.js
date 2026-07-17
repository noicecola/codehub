// === IPC Channel 常量 ===
// 统一管理所有 IPC 通道名称，避免硬编码字符串漂移

const IPC = {
  // 工具相关
  GET_TOOLS: 'get-tools',
  GET_TOOL_VERSIONS: 'get-tool-versions',
  GET_INSTALLABLE_TOOLS: 'get-installable-tools',
  BATCH_INSTALL: 'batch-install',
  INSTALL_TOOL: 'install-tool',
  CANCEL_INSTALL: 'cancel-install',
  INSTALL_PROGRESS: 'install-progress',

  // 消息相关
  BROADCAST_MESSAGE: 'broadcast-message',
  STOP_TOOL: 'stop-tool',
  RETRY_TOOL: 'retry-tool',
  STREAM_CHUNK: 'stream-chunk',
  TOOL_DONE: 'tool-done',

  // 文件操作
  READ_FILE: 'read-file',
  SELECT_DIRECTORY: 'select-directory',

  // 会话导出
  EXPORT_SESSION: 'export-session',

  // 自定义工具
  ADD_CUSTOM_TOOL: 'add-custom-tool',
  REMOVE_CUSTOM_TOOL: 'remove-custom-tool',
  EDIT_CUSTOM_TOOL: 'edit-custom-tool',

  // 模板
  LIST_TEMPLATES: 'list-templates',
  SAVE_TEMPLATE: 'save-template',
  DELETE_TEMPLATE: 'delete-template',

  // 预设
  LIST_PRESETS: 'list-presets',
  SAVE_PRESET: 'save-preset',
  DELETE_PRESET: 'delete-preset',

  // 会话管理
  LIST_SESSIONS: 'list-sessions',
  SEARCH_SESSIONS: 'search-sessions',
  GET_LATEST_SESSION: 'get-latest-session',
  CREATE_SESSION: 'create-session',
  LOAD_SESSION: 'load-session',
  DELETE_SESSION: 'delete-session',
  UPDATE_SESSION_TAGS: 'update-session-tags',
  SESSION_UPDATED: 'session-updated',
};

module.exports = { IPC };
