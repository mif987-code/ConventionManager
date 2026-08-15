// Preload script for security - exposes only necessary APIs to renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  savePlan: (data) => ipcRenderer.invoke('save-plan', data),
  loadPlan: () => ipcRenderer.invoke('load-plan')
});
