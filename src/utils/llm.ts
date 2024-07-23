import path from 'path'
import {runPython} from '@/utils/shell'
import { Runnable, RunnableSequence } from 'langchain/schema/runnable';
import { getApiConfig, getModel, getProxy } from '@/electron/storage';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import fetch from 'node-fetch';
import {HttpsProxyAgent} from "https-proxy-agent";
import { StringOutputParser } from 'langchain/schema/output_parser';
const scriptPath = MAIN_WINDOW_VITE_DEV_SERVER_URL ? path.join(process.cwd(),'src','assets','python_code','ernie.py') : path.join(__dirname,'python_code','ernie.py')


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
  async chat(messages: {content: string, role:'assistant' | 'user'}[] | string, signalId?:string){
    console.log('signalId', signalId);
    if(typeof messages === 'string'){
      messages = [{content: messages, role:'user'}]
    }
    if(this.chatType === ChatType.ERNIE){
      return runPython<string>({
        scriptPath,
        args: ["--messages", JSON.stringify(messages)],
        socketEvent:'llm_response',
        signalId
      })
    }
    if(this.chatType === ChatType.CHATGPT){
      const modelName = getModel()
      const config = getApiConfig()
      const proxy = getProxy() as string;
      const model = new ChatOpenAI({
        temperature: 0, // increase temperature to get more creative answers
        modelName,
        openAIApiKey: config.apiKey
      },{
        httpAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
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
