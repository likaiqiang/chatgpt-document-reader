import { contextBridge, ipcRenderer } from 'electron'
import {Channel} from "@/types/bridge";
import { ChatParams, ChatResponse, Resource } from '@/types/chat';
import { FindInPageParmas, StopFindInPageParmas, WebContentsOnParams } from '@/types/webContents';

interface RequestllmParams{
    prompt: string,
    chatType?: 'ernie' | 'gpt3',
    signalId?: string
}


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
    onRenderFileHistoryCleared(cb=()=>{}){
        ipcRenderer.on(Channel.renderFileHistoryCleared, cb)
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
    requestCallGraph(path:string){
        return ipcRenderer.invoke(Channel.requestCallGraph, path)
    },
    requestllm({prompt, chatType = 'ernie',signalId}:RequestllmParams){
        return ipcRenderer.invoke(Channel.requestllm, {prompt, chatType, signalId})
    },
    findInPage(params: FindInPageParmas){
        return ipcRenderer.invoke(Channel.findInPage, params)
    },
    stopFindInPage(params: StopFindInPageParmas){
        return ipcRenderer.invoke(Channel.stopFindInPage, params)
    },
    onFoundInPageResult(cb=()=>{}){
        ipcRenderer.on(Channel.onFoundInPageResult,cb)
    },
    electronStoreGet(key:string){
        return ipcRenderer.invoke(Channel.electronStoreGet, key)
    },
    electronStoreSet(key:string,value:any){
        return ipcRenderer.invoke(Channel.electronStoreSet, key, value)
    },
    setRenderCurrentFile(name: string){
        return ipcRenderer.invoke(Channel.setRenderCurrentFile, name)
    },
    requestOpenFindWindow(){
        return ipcRenderer.invoke(Channel.requestOpenFindWindow)
    },
    setSearchBoxSize({width, height}: {width: number, height: number}){
        return ipcRenderer.invoke(Channel.setSearchBoxSize,{width,height})
    },
    onFind(cb=()=>{}){
        ipcRenderer.on(Channel.onFound, cb)
    },
    closeSearchWindow(){
        return ipcRenderer.invoke(Channel.closeSearchWindow)
    },
    onShowClearHistoryModal(cb=()=>{}){
        ipcRenderer.on(Channel.showClearHistoryModal, cb)
    },
    onShowDeleteFileModal(cb=()=>{}){
        ipcRenderer.on(Channel.showDeleteFileModal, cb)
    },
    replyClearHistory(filename:string){
        return ipcRenderer.invoke(Channel.replyClearHistory, {filename})
    },
    replyDeleteFile(filename:string){
        return ipcRenderer.invoke(Channel.replyDeleteFile, {filename})
    },
    sendSignalId: (signalId:string) => ipcRenderer.send(Channel.sendSignalId,signalId)
}

contextBridge.exposeInMainWorld('chatBot', api)
