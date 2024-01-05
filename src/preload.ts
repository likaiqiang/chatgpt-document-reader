import { contextBridge, ipcRenderer } from 'electron'
import {Channel} from "@/types/bridge";
import { ChatParams, ChatResponse, Resource } from '@/types/chat';

export const api = {
    /**
     * Here you can expose functions to the renderer process
     * so they can interact with the main (electron) side
     * without security problems.
     *
     * The function below can accessed using `window.chatBot.sendMessage`
     */
    selectFile(){
        return ipcRenderer.invoke(Channel.selectFile)
    },
    ingestData(files: string[]):Promise<Resource>{
        return ipcRenderer.invoke(Channel.ingestdata, files)
    },
    chat(params: ChatParams): Promise<ChatResponse>{
        return ipcRenderer.invoke(Channel.chat, params)
    },
    getResources(): Promise<Resource[]>{
      return ipcRenderer.invoke(Channel.resources)
    },
    checkproxy(proxy:string){
        return ipcRenderer.invoke(Channel.checkproxy, proxy)
    },
    checkapikey(){
        return ipcRenderer.invoke(Channel.checkapikey)
    },
    onOutputDirChange(cb=()=>{}){
        ipcRenderer.on(Channel.outputDirChange,cb)
    }
}

contextBridge.exposeInMainWorld('chatBot', api)
