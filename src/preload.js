const { contextBridge, ipcRenderer } = require('electron');
const { IPC } = require('./ipc-channels');

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
