import {fetch, ProxyAgent,Dispatcher} from 'undici'
import { IpcMainEvent } from 'electron';
import { getProxy } from '@/electron/storage';

export function mainSend(window: Electron.BrowserWindow | Electron.BrowserView, name: string): void
export function mainSend<T>(window: Electron.BrowserWindow | Electron.BrowserView, name: string, params: T): void
export function mainSend<T>(window: Electron.BrowserWindow | Electron.BrowserView, name: string, params?: T): void {
  window && window.webContents.send(name, params)
}

export function mainOn<T>(window: Electron.BrowserWindow | Electron.BrowserView, name:string, cb:(event: IpcMainEvent, params?: T)=>void = ()=>{}): void {
  // @ts-ignore
  window && window.webContents.on(name,cb)
}

export function getProxyAgent(enableProxy:boolean, proxy: string):Dispatcher|undefined {
  let dispatcher = undefined
  if(enableProxy){
    dispatcher = new ProxyAgent(proxy)
  }
  else if (enableProxy === false){
    dispatcher = undefined
  }
  else{
    dispatcher = proxy ? new ProxyAgent(proxy) : undefined
  }
  return dispatcher
}

export const fetchModels = async ({baseUrl, apiKey, enableProxy}: ApiConfig) =>{
  baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0,baseUrl.length -1) : baseUrl
  const proxy = getProxy()
  return fetch(`${baseUrl}/models`,{
    headers:{
      'Authorization': `Bearer ${apiKey}`
    },
    dispatcher: getProxyAgent(enableProxy, proxy),
    method:'GET',
  }).then(async res=>{
    const status = res.status + ''
    if(status.startsWith('4') || status.startsWith('5')) return Promise.reject(res.statusText)
    return res.json()
  }).catch(e=>{
    return Promise.reject(e.toString())
  })
}

export const getNormalizeBaseUrl = (baseUrl:string)=>{
  let url = baseUrl
  if(!url.includes('api.openai.com')) return url
  if(url.endsWith('/')) url = url.slice(0, url.length -1)
  if(!url.endsWith('v1')) url = url + '/v1'
  return url
}
