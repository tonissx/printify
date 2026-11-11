import { contextBridge, ipcRenderer } from 'electron'
import type { PrintifyApi } from '../shared/types'

const api: PrintifyApi = {
  overlayReady: () => ipcRenderer.invoke('overlay:ready'),
  saveShot: (png, copyOnly) => ipcRenderer.invoke('shot:save', png, copyOnly),
  startRecording: (req, region) => ipcRenderer.invoke('rec:start', req, region),
  setPrefs: (p) => ipcRenderer.invoke('prefs:set', p),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  pillReady: () => ipcRenderer.invoke('pill:ready'),
  onStopRequest: (cb) => {
    ipcRenderer.on('rec:stop', () => cb())
  },
  saveRecording: (data, format) => ipcRenderer.invoke('rec:save', data, format),
  cancelRecording: (reason) => ipcRenderer.invoke('rec:cancel', reason),
  toastReady: () => ipcRenderer.invoke('toast:ready'),
  revealPath: (p) => ipcRenderer.invoke('toast:reveal', p),
  ocr: (png) => ipcRenderer.invoke('ocr', png),
  copyText: (text) => ipcRenderer.invoke('text:copy', text),
  libSearch: (q) => ipcRenderer.invoke('lib:search', q),
  libStats: () => ipcRenderer.invoke('lib:stats'),
  libOpen: (p) => ipcRenderer.invoke('lib:open', p),
  libReveal: (p) => ipcRenderer.invoke('lib:reveal', p),
  libCopyImage: (p) => ipcRenderer.invoke('lib:copy-image', p)
}

contextBridge.exposeInMainWorld('printify', api)
