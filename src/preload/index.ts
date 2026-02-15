import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('tangentAPI', {
  // Will be populated in Task 10
})
