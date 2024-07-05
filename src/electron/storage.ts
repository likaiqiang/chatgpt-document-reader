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

export const getModel = ()=>{
  return (store.get(partKeyPrefix + 'model') as string) || 'gpt-3.5-turbo-1106'
}

export const setModal = (model:string)=>{
  return store.set(partKeyPrefix + 'model', model)
}

