'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('setup', {
  info: () => ipcRenderer.invoke('setup:info'),
  choose: () => ipcRenderer.invoke('setup:choose'),
  install: (target) => ipcRenderer.invoke('setup:install', target),
  launch: () => ipcRenderer.invoke('setup:launch'),
  open: () => ipcRenderer.invoke('setup:open'),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  onProgress: (callback) => {
    ipcRenderer.on('setup:progress', (_event, payload) => callback(payload))
  },
})
