const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codehub', {
  getTools: () => ipcRenderer.invoke('get-tools'),
  broadcastMessage: (data) => ipcRenderer.invoke('broadcast-message', data),
  stopTool: (toolId) => ipcRenderer.invoke('stop-tool', toolId),
  retryTool: (data) => ipcRenderer.invoke('retry-tool', data),
  onStreamChunk: (cb) => ipcRenderer.on('stream-chunk', (e, data) => cb(data)),

  readFile: (data) => ipcRenderer.invoke('read-file', data),

  exportSession: (data) => ipcRenderer.invoke('export-session', data),

  addCustomTool: (tool) => ipcRenderer.invoke('add-custom-tool', tool),
  removeCustomTool: (id) => ipcRenderer.invoke('remove-custom-tool', id),
  editCustomTool: (data) => ipcRenderer.invoke('edit-custom-tool', data),

  listTemplates: () => ipcRenderer.invoke('list-templates'),
  saveTemplate: (tpl) => ipcRenderer.invoke('save-template', tpl),
  deleteTemplate: (id) => ipcRenderer.invoke('delete-template', id),

  listSessions: () => ipcRenderer.invoke('list-sessions'),
  getLatestSession: () => ipcRenderer.invoke('get-latest-session'),
  createSession: (name) => ipcRenderer.invoke('create-session', name),
  loadSession: (id) => ipcRenderer.invoke('load-session', id),
  deleteSession: (id) => ipcRenderer.invoke('delete-session', id),
  getCurrentSessionId: () => ipcRenderer.invoke('get-current-session-id'),
  onSessionUpdated: (cb) => ipcRenderer.on('session-updated', (e, id) => cb(id)),

  selectDirectory: () => ipcRenderer.invoke('select-directory'),
});
