import { Runnable, RunnableSequence } from 'langchain/schema/runnable';
import { getApiConfig, getModel, getProxy } from '@/electron/storage';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { StringOutputParser } from 'langchain/schema/output_parser';
import { ChatPromptValue } from '@langchain/core/prompt_values';
import { getProxyAgent } from '@/utils/default';
import { fetch, RequestInfo, RequestInit } from 'undici';
import { ipcMain } from 'electron';
import { Channel } from '@/types/bridge';

interface Message{
  content: string,
  role: 'user' | 'assistant'
}

class Ernie{
  private apiKey
  private secretKey
  private accessToken: string
  constructor({apiKey, secretKey}:{apiKey:string, secretKey:string}) {
    this.apiKey = apiKey
    this.secretKey = secretKey
  }
  static normalizeMessages(messages:Message[]){
    let userIndex = 0;
    const currentMessage = messages[messages.length - 1].role === 'user' ? messages[messages.length - 1] : null;
    const normalizedMessages = [];
    while (userIndex < messages.length - 1) {
      if(messages[userIndex].role === 'user' && messages[userIndex + 1].role === 'assistant') {
        normalizedMessages.push(messages[userIndex]);
        normalizedMessages.push(messages[userIndex + 1]);
      }
      userIndex ++
    }
    currentMessage && normalizedMessages.push(currentMessage);
    if(normalizedMessages.length % 2 === 0) {
      normalizedMessages.unshift({ role: 'user', content: '' });
    }
    return normalizedMessages;
  }
  private async getAccessToken(signal?: AbortSignal){
    return fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.apiKey}&client_secret=${this.secretKey}`,{
      signal
    }).then(res=>res.json()).then((res:{access_token:string})=>res.access_token)
  }
  async chat(messages:Message[], signal: AbortSignal ,model='ernie-speed-128k'){
    if(messages[messages.length - 1].role !== 'user'){
      return Promise.reject('The last message must be user')
    }
    this.accessToken = await this.getAccessToken(signal)
    return fetch(`https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${model}?access_token=${this.accessToken}`,{
      method:'post',
      signal: signal,
      body: JSON.stringify({
        messages: Ernie.normalizeMessages(messages)
      })
    }).then(res=>res.json()).then((res:{result:string})=>{
      if(res.result) return res.result
      return Promise.reject(res)
    })
  }
}


export enum ChatType {
  ERNIE = 'ernie',
  CHATGPT = 'chatgpt'
}
interface LLMParams{
  chatType: ChatType
}

export default class LLM extends Runnable{
  lc_namespace = ["langchain_core", "runnables"];
  chatType: ChatType = ChatType.ERNIE
  constructor({chatType}: LLMParams) {
    super()
    this.chatType = chatType
  }
  async chat(messages: {content: string, role:'assistant' | 'user'}[] | string | ChatPromptValue, signalId?:string){
    if(typeof messages === 'string'){
      messages = [{content: messages, role:'user'}]
    }
    if(messages instanceof ChatPromptValue){
      messages = [{content: messages.messages[0].content, role:'user'}] as {content: string, role:'assistant' | 'user'}[]
    }
    const abortController = new AbortController()
    if(signalId){
      ipcMain.once(Channel.sendSignalId, (e, id)=>{
        if(id === signalId){
          abortController.abort()
          return Promise.reject('user cancel')
        }
      })
    }
    const config = getApiConfig()
    const proxy = getProxy() as string;
    if(this.chatType === ChatType.ERNIE){
      const client = new Ernie({
        apiKey:'VvRRhjliQW4pYXLGcLIDmi96',
        secretKey:'uBf5UQFtnfgCUKWYcPnlbhexyjq7QNMN'
      })
      return client.chat(messages, abortController.signal)
    }
    if(this.chatType === ChatType.CHATGPT){
      const modelName = getModel()

      const model = new ChatOpenAI({
        temperature: 0, // increase temperature to get more creative answers
        modelName,
        openAIApiKey: config.apiKey
      },{
        // @ts-ignore
        fetch:(url: RequestInfo, init?: RequestInit,)=>{
            return fetch(url,{
                ...init,
                signal:abortController.signal,
                dispatcher: getProxyAgent(config.enableProxy, proxy)
            })
        },
        baseURL: config.baseUrl
      });
      const runnable = RunnableSequence.from([
        // @ts-ignore
        model,
        new StringOutputParser(),
      ])
      return runnable.invoke(JSON.stringify(messages))
    }
  }
  invoke(input: string): Promise<string> {
    return this.chat(input)
  }
}
