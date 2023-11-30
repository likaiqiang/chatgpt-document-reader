import { contextBridge, ipcRenderer } from 'electron'
import {Channel} from '@/types/bridge';

export const api = {
  /**
   * Here you can expose functions to the renderer process
   * so they can interact with the main (electron) side
   * without security problems.
   *
   * The function below can accessed using `window.chatBot.sendMessage`
   */

  invoke: (channel: Channel, data?: any) => {
    return ipcRenderer.invoke(channel, data)
  }
}

contextBridge.exposeInMainWorld('chatBot', api)
