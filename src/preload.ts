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
    ingestData(files: string[], embedding = true):Promise<Resource>{
        return ipcRenderer.invoke(Channel.ingestdata, files, embedding)
    },
    chat(params: ChatParams): Promise<ChatResponse>{
        return ipcRenderer.invoke(Channel.chat, params)
    },
    getResources(): Promise<Resource[]>{
      return ipcRenderer.invoke(Channel.resources)
    },
    checkProxy(proxy:string){
        return ipcRenderer.invoke(Channel.checkProxy, proxy)
    },
    checkChatConfig(){
        return ipcRenderer.invoke(Channel.checkChatConfig)
    },
    checkEmbeddingConfig(){
        return ipcRenderer.invoke(Channel.checkEmbeddingConfig)
    },
    onOutputDirChange(cb=()=>{}){
        ipcRenderer.on(Channel.outputDirChange,cb)
    },
    onChatConfigChange(cb=()=>{}){
        ipcRenderer.on(Channel.chatConfigChange, cb)
    },
    onEmbeddingConfigChange(cb=()=>{}){
        ipcRenderer.on(Channel.embeddingConfigChange, cb)
    },
    onWindowFocussed(cb=()=>{}) {
        ipcRenderer.on(Channel.onWindowFocussed, cb)
    },
    onRenderFileHistoryCleared(cb=()=>{}){
        ipcRenderer.on(Channel.renderFileHistoryCleared, cb)
    },
    replyChatConfig(config: ApiConfig){
        return ipcRenderer.invoke(Channel.replyChatConfig, config)
    },
    replyEmbeddingConfig(config: ApiConfig){
        return ipcRenderer.invoke(Channel.replyEmbeddingConfig, config)
    },
    onProxyChange(cb=()=>{}){
        ipcRenderer.on(Channel.proxyChange,cb)
    },
    replyProxy(proxy:string){
        return ipcRenderer.invoke(Channel.replyProxy, proxy)
    },
    requestGetChatConfig(){
        return ipcRenderer.invoke(Channel.requestGetChatConfig)
    },
    requestGetEmbeddingConfig(){
        return ipcRenderer.invoke(Channel.requestGetEmbeddingConfig)
    },
    requestGetProxy(){
        return ipcRenderer.invoke(Channel.requestGetProxy)
    },
    requestGetModels(config: Partial<ApiConfig>): Promise<any[]>{
        return ipcRenderer.invoke(Channel.requestGetModels, config)
    },
    requestTestChatConfig(config: ApiConfig & {proxy: string}){
        return ipcRenderer.invoke(Channel.requestTestChatConfig, config)
    },
    requestTestEmbeddingConfig(config: ApiConfig){
        return ipcRenderer.invoke(Channel.requestTestEmbeddingConfig, config)
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
