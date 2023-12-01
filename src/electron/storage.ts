import Store from 'electron-store';
const store = new Store()

const partKeyPrefix = '@___PART___'

export const getApikey = ()=>{
  return store.get(partKeyPrefix + 'apikey') || ''
}
export const getProxy = ()=>{
  return store.get(partKeyPrefix + 'proxy') || ''
}

export const setApikey = (apikey:string)=>{
  store.set(partKeyPrefix + 'apikey', apikey)
}

export const setProxy = (proxy:string)=>{
  store.set(partKeyPrefix + 'proxy', proxy)
}

