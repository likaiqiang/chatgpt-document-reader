import { contextBridge, ipcRenderer } from 'electron'
import {Channel} from "@/types/bridge";
import { ChatParams, ChatResponse, Resource } from '@/types/chat';
import { FindInPageParmas, StopFindInPageParmas, WebContentsOnParams } from '@/types/webContents';


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
        return ipcRenderer.invoke(Channel.checkProxy, proxy)
    },
    checkApiConfig(){
        return ipcRenderer.invoke(Channel.checkApiConfig)
    },
    onOutputDirChange(cb=()=>{}){
        ipcRenderer.on(Channel.outputDirChange,cb)
    },
    onApiConfigChange(cb=()=>{}){
        ipcRenderer.on(Channel.apiConfigChange, cb)
    },
    replyApiConfig(config: ApiConfig){
        return ipcRenderer.invoke(Channel.replyApiConfig, config)
    },
    onProxyChange(cb=()=>{}){
        ipcRenderer.on(Channel.proxyChange,cb)
    },
    replyProxy(proxy:string){
        return ipcRenderer.invoke(Channel.replyProxy, proxy)
    },
    requestGetApiConfig(){
        return ipcRenderer.invoke(Channel.requestGetApiConfig)
    },
    requestGetProxy(){
        return ipcRenderer.invoke(Channel.requestGetProxy)
    },
    requestTestApi(config: ApiConfig & {proxy: string}){
        return ipcRenderer.invoke(Channel.requestTestApi, config)
    },
    findInPage(params: FindInPageParmas){
        return ipcRenderer.invoke(Channel.findInPage, params)
    },
    stopFindInPage(params: StopFindInPageParmas){
        return ipcRenderer.invoke(Channel.stopFindInPage, params)
    },
    webContentsOn(params: WebContentsOnParams){
        return ipcRenderer.invoke(Channel.webContentsOn, params)
    },
    electronStoreGet(key:string){
        return ipcRenderer.invoke(Channel.electronStoreGet, key)
    },
    electronStoreSet(key:string,value:any){
        return ipcRenderer.invoke(Channel.electronStoreSet, key, value)
    }
}

contextBridge.exposeInMainWorld('chatBot', api)
