import fetch from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent';

export function mainSend(window: Electron.BrowserWindow, name: string): void
export function mainSend<T>(window: Electron.BrowserWindow, name: string, params: T): void
export function mainSend<T>(window: Electron.BrowserWindow, name: string, params?: T): void {
  window && window.webContents.send(name, params)
}


export const fetchModels = async ({baseUrl, apiKey, proxy}: ApiConfig & {proxy: string})=>{
  baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0,baseUrl.length -1) : baseUrl
  try{
    return fetch(`${baseUrl}/models`,{
      headers:{
        'Authorization': `Bearer ${apiKey}`
      },
      agent: proxy ? new HttpsProxyAgent(proxy) : undefined
    }).then(res=>{
      const status = res.status + ''
      if(status.startsWith('4') || status.startsWith('5')) return Promise.reject(res.statusText)
      return res.json()
    })
  } catch (e){
    return Promise.reject(e)
  }
}

export const getNormalizeBaseUrl = (baseUrl:string)=>{
  let url = baseUrl
  if(!url.includes('api.openai.com')) return url
  if(url.endsWith('/')) url = url.slice(0, url.length -1)
  if(!url.endsWith('v1')) url = url + '/v1'
  return url
}
