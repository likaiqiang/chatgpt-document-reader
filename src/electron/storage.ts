import Store from 'electron-store';
export const store = new Store()

const partKeyPrefix = '@___PART___'
export const getProxy = ():string=>{
  return (store.get(partKeyPrefix + 'proxy') || '') as string
}


export const setProxy = (proxy:string)=>{
  store.set(partKeyPrefix + 'proxy', proxy)
}
export const getApiConfig = (): ApiConfig=>{
  return (store.get(partKeyPrefix + 'apiConfig') || {ernie: true,apiKey:'',baseUrl:'https://api.openai.com/v1'}) as ApiConfig
}
export const setApiConfig = (config: ApiConfig)=>{
  store.set(partKeyPrefix + 'apiConfig', config)
}

export const getEmbeddingConfig = ():Partial<ApiConfig>=>{
  let config = (store.get(partKeyPrefix + 'embeddingConfig') || {apiKey:'',baseUrl:''}) as Partial<ApiConfig>
  if(!config.apiKey && !config.baseUrl){
    config = getApiConfig()
  }
  return config
}
export const setEmbeddingConfig = (config:Partial<ApiConfig>)=>{
  store.set(partKeyPrefix + 'embeddingConfig', config)
}

export const getModel = ()=>{
  return (store.get(partKeyPrefix + 'model') as string) || 'gpt-3.5-turbo-1106'
}

export const setModal = (model:string)=>{
  return store.set(partKeyPrefix + 'model', model)
}
export const getStore = (key:string)=>{
  key = !key.startsWith('@___PART___') ? ('@___PART___' + key) : key
  return store.get(key) || {};
}
export const setStore = (key:string, value:any)=>{
  key = !key.startsWith('@___PART___') ? ('@___PART___' + key) : key
  return store.set(key, value);
}

