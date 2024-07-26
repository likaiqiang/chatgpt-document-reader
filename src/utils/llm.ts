import { Runnable, RunnableSequence } from 'langchain/schema/runnable';
import { getApiConfig, getModel, getProxy } from '@/electron/storage';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { StringOutputParser } from 'langchain/schema/output_parser';
import { ChatPromptValue } from '@langchain/core/prompt_values';
import { getProxyAgent } from '@/utils/default';
import {fetch} from 'undici'

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
  private async getAccessToken(){
    return fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.apiKey}&client_secret=${this.secretKey}`).then(res=>res.json()).then((res:{access_token:string})=>res.access_token)
  }
  async chat(messages:Message[], model='ernie-speed-128k'){
    this.accessToken = await this.getAccessToken()
    return fetch(`https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${model}?access_token=${this.accessToken}`,{
      method:'post',
      body: JSON.stringify({
        messages
      })
    }).then(res=>res.json()).then((res:{result:string})=>res.result)
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
    const config = getApiConfig()
    const proxy = getProxy() as string;
    if(this.chatType === ChatType.ERNIE){
      const client = new Ernie({
        apiKey:'VvRRhjliQW4pYXLGcLIDmi96',
        secretKey:'uBf5UQFtnfgCUKWYcPnlbhexyjq7QNMN'
      })
      return client.chat(messages)
    }
    if(this.chatType === ChatType.CHATGPT){
      const modelName = getModel()

      const model = new ChatOpenAI({
        temperature: 0, // increase temperature to get more creative answers
        modelName,
        openAIApiKey: config.apiKey
      },{
        httpAgent: getProxyAgent(config.enableProxy, proxy),
        // @ts-ignore
        fetch,
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
