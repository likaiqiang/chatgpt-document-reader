import fetch from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent';

export function mainSend(window: Electron.BrowserWindow, name: string): void
export function mainSend<T>(window: Electron.BrowserWindow, name: string, params: T): void
export function mainSend<T>(window: Electron.BrowserWindow, name: string, params?: T): void {
  window && window.webContents.send(name, params)
}

let fetchModelsDone = false
let fetchModelController = new AbortController()
export const fetchModels = async ({baseUrl, apiKey, proxy}: ApiConfig & {proxy: string})=>{
  baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0,baseUrl.length -1) : baseUrl
  if(!fetchModelsDone){
    fetchModelController.abort()
    fetchModelController = new AbortController()
    return fetchApi()
  }
  else{
    fetchModelController = new AbortController()
    return fetchApi()
  }
  async function fetchApi(){
    fetchModelsDone = false
    return fetch(`${baseUrl}/models`,{
      headers:{
        'Authorization': `Bearer ${apiKey}`
      },
      agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
      signal: fetchModelController.signal
    }).then(res=>{
      fetchModelsDone = true
      const status = res.status + ''
      if(status.startsWith('4') || status.startsWith('5')) return Promise.reject(res.statusText)
      return res.json()
    }).catch(e=>{
      fetchModelsDone = true
      return Promise.reject(e)
    })
  }
}

export const getNormalizeBaseUrl = (baseUrl:string)=>{
  let url = baseUrl
  if(!url.includes('api.openai.com')) return url
  if(url.endsWith('/')) url = url.slice(0, url.length -1)
  if(!url.endsWith('v1')) url = url + '/v1'
  return url
}
