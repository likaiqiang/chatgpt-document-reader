import fetch from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent';

export function mainSend(window: Electron.BrowserWindow, name: string): void
export function mainSend<T>(window: Electron.BrowserWindow, name: string, params: T): void
export function mainSend<T>(window: Electron.BrowserWindow, name: string, params?: T): void {
  window && window.webContents.send(name, params)
}


export const fetchModels = async ({baseUrl, apiKey, proxy}: ApiConfig & {proxy: string})=>{
  baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0,baseUrl.length -1) : baseUrl
  return fetch(`${baseUrl}/v1/models`,{
    headers:{
      'Authorization': `Bearer ${apiKey}`
    },
    agent: proxy ? new HttpsProxyAgent(proxy) : undefined
  }).then(res=>{
    if(res.status !== 200) return Promise.reject()
    return res.json()
  })
}

export const getNormalizeBaseUrl = (baseUrl:string)=>{
  let url = baseUrl
  if(!url.includes('api.openai.com')) return url
  if(url.endsWith('/')) url = url.slice(0, url.length -1)
  if(!url.endsWith('v1')) url = url + '/v1'
  return url
}
