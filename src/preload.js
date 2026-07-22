const { contextBridge, ipcRenderer } = require('electron');

// 硬编码所有 IPC 通道，避免模块加载问题
const IPC = {
  GET_TOOLS: 'get-tools',
  BROADCAST_MESSAGE: 'broadcast-message',
  STOP_TOOL: 'stop-tool',
  RETRY_TOOL: 'retry-tool',
  INSTALL_TOOL: 'install-tool',
  CANCEL_INSTALL: 'cancel-install',
  INSTALL_PROGRESS: 'install-progress',
  GET_TOOL_VERSIONS: 'get-tool-versions',
  GET_INSTALLABLE_TOOLS: 'get-installable-tools',
  BATCH_INSTALL: 'batch-install',
  STREAM_CHUNK: 'stream-chunk',
  TOOL_DONE: 'tool-done',
  READ_FILE: 'read-file',
  EXPORT_SESSION: 'export-session',
  ADD_CUSTOM_TOOL: 'add-custom-tool',
  REMOVE_CUSTOM_TOOL: 'remove-custom-tool',
  EDIT_CUSTOM_TOOL: 'edit-custom-tool',
  LIST_TEMPLATES: 'list-templates',
  SAVE_TEMPLATE: 'save-template',
  DELETE_TEMPLATE: 'delete-template',
  LIST_PRESETS: 'list-presets',
  SAVE_PRESET: 'save-preset',
  DELETE_PRESET: 'delete-preset',
  LIST_SESSIONS: 'list-sessions',
  SEARCH_SESSIONS: 'search-sessions',
  GET_LATEST_SESSION: 'get-latest-session',
  CREATE_SESSION: 'create-session',
  LOAD_SESSION: 'load-session',
  DELETE_SESSION: 'delete-session',
  UPDATE_SESSION_TAGS: 'update-session-tags',
  SESSION_UPDATED: 'session-updated',
  SELECT_DIRECTORY: 'select-directory',
};

contextBridge.exposeInMainWorld('codehub', {
  getTools: () => ipcRenderer.invoke(IPC.GET_TOOLS),
  broadcastMessage: (data) => ipcRenderer.invoke(IPC.BROADCAST_MESSAGE, data),
  stopTool: (toolId) => ipcRenderer.invoke(IPC.STOP_TOOL, toolId),
  retryTool: (data) => ipcRenderer.invoke(IPC.RETRY_TOOL, data),

  installTool: (toolId) => ipcRenderer.invoke(IPC.INSTALL_TOOL, { toolId }),
  cancelInstall: (toolId) => ipcRenderer.invoke(IPC.CANCEL_INSTALL, { toolId }),
  onInstallProgress: (cb) => ipcRenderer.on(IPC.INSTALL_PROGRESS, (e, data) => cb(data)),

  getToolVersions: () => ipcRenderer.invoke(IPC.GET_TOOL_VERSIONS),
  getInstallableTools: () => ipcRenderer.invoke(IPC.GET_INSTALLABLE_TOOLS),
  batchInstall: (toolIds) => ipcRenderer.invoke(IPC.BATCH_INSTALL, { toolIds }),
  onStreamChunk: (cb) => ipcRenderer.on(IPC.STREAM_CHUNK, (e, data) => cb(data)),
  onToolDone: (cb) => ipcRenderer.on(IPC.TOOL_DONE, (e, data) => cb(data)),

  readFile: (data) => ipcRenderer.invoke(IPC.READ_FILE, data),

  exportSession: (data) => ipcRenderer.invoke(IPC.EXPORT_SESSION, data),

  addCustomTool: (tool) => ipcRenderer.invoke(IPC.ADD_CUSTOM_TOOL, tool),
  removeCustomTool: (id) => ipcRenderer.invoke(IPC.REMOVE_CUSTOM_TOOL, id),
  editCustomTool: (data) => ipcRenderer.invoke(IPC.EDIT_CUSTOM_TOOL, data),

  listTemplates: () => ipcRenderer.invoke(IPC.LIST_TEMPLATES),
  saveTemplate: (tpl) => ipcRenderer.invoke(IPC.SAVE_TEMPLATE, tpl),
  deleteTemplate: (id) => ipcRenderer.invoke(IPC.DELETE_TEMPLATE, id),

  listPresets: () => ipcRenderer.invoke(IPC.LIST_PRESETS),
  savePreset: (preset) => ipcRenderer.invoke(IPC.SAVE_PRESET, preset),
  deletePreset: (id) => ipcRenderer.invoke(IPC.DELETE_PRESET, id),

  listSessions: () => ipcRenderer.invoke(IPC.LIST_SESSIONS),
  searchSessions: (query) => ipcRenderer.invoke(IPC.SEARCH_SESSIONS, query),
  getLatestSession: () => ipcRenderer.invoke(IPC.GET_LATEST_SESSION),
  createSession: (name) => ipcRenderer.invoke(IPC.CREATE_SESSION, name),
  loadSession: (id) => ipcRenderer.invoke(IPC.LOAD_SESSION, id),
  deleteSession: (id) => ipcRenderer.invoke(IPC.DELETE_SESSION, id),
  updateSessionTags: (data) => ipcRenderer.invoke(IPC.UPDATE_SESSION_TAGS, data),
  onSessionUpdated: (cb) => ipcRenderer.on(IPC.SESSION_UPDATED, (e, id) => cb(id)),

  selectDirectory: () => ipcRenderer.invoke(IPC.SELECT_DIRECTORY),
});
