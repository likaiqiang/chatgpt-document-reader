import { Runnable } from 'langchain/schema/runnable';
import { getApiConfig, getProxy } from '@/electron/storage';
import { getProxyAgent } from '@/utils/default';
import { fetch, RequestInfo, RequestInit } from 'undici';
import { ipcMain } from 'electron';
import { Channel } from '@/types/bridge';
import { Readable } from 'stream';
import { OpenAI } from "openai";

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
  private async getAccessToken(abortController?: AbortController){
    return fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.apiKey}&client_secret=${this.secretKey}`,{
      signal: abortController.signal
    }).then(res=>res.json()).then((res:{access_token:string})=>res.access_token)
  }
  chat({ messages, abortController, model = 'ernie-speed-128k', stream = false }: {
    messages: Message[];
    abortController: AbortController;
    model?: string;
    stream?: boolean;
  }) {
    if (messages[messages.length - 1].role !== 'user') {
      throw new Error('The last message must be user');
    }

    const readableStream = new Readable({
      read() {
      }, // 必须实现，但可以留空以使用 `push` 手动推送数据
      encoding: 'utf-8'
    });

    const fetchData = async () => {
      try {
        this.accessToken = await this.getAccessToken(abortController);
        const res = await fetch(
          `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${model}?access_token=${this.accessToken}`,
          {
            method: 'post',
            signal: abortController.signal,
            body: JSON.stringify({
              messages: Ernie.normalizeMessages(messages),
              stream
            })
          }
        );

        if (!stream) {
          const resJson = (await res.json()) as { result: string };
          const result = resJson.result;
          if (result) {
            readableStream.push(result); // 推送完整数据
            readableStream.push(null); // 结束流
          } else {
            readableStream.destroy(new Error(JSON.stringify(resJson))); // 错误时销毁流
          }
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              readableStream.push(null); // 推送结束信号
              break;
            }

            let chunk = decoder.decode(value, { stream: true });
            if (chunk.startsWith('data:')) {
              chunk = JSON.parse(chunk.replace(/^data:\s*/, '')).result;
            }

            readableStream.push(chunk); // 推送流数据
          }
        }
      } catch (error) {
        readableStream.destroy(error); // 发生错误时销毁流
      }
    };

    fetchData();
    // 返回 Readable 流
    return readableStream;
  }
}

interface chatParams{
  messages: Message[],
  signalId?: string,
  stream?: boolean
}

export default class LLM extends Runnable{
  lc_namespace = ["langchain_core", "runnables"];
  constructor() {
    super()
  }
  chat({messages, signalId, stream}: chatParams){
    if(typeof messages === 'string'){
      messages = [{content: messages, role:'user'}]
    }
    // if(messages instanceof ChatPromptValue){
    //   messages = [{content: messages.messages[0].content, role:'user'}] as {content: string, role:'assistant' | 'user'}[]
    // }
    const abortController = new AbortController()
    const readableStream = new Readable({
      read() {}, // 手动推送数据
      encoding: "utf-8",
    });
    if(signalId){
      ipcMain.once(Channel.sendSignalId, (e, id)=>{
        if(id === signalId){
          abortController.abort()
          readableStream.destroy(new Error(`user cancel`));
        }
      })
    }
    const config = getApiConfig()
    const proxy = getProxy() as string;

    if(config.ernie){
      const client = new Ernie({
        apiKey:'VvRRhjliQW4pYXLGcLIDmi96',
        secretKey:'uBf5UQFtnfgCUKWYcPnlbhexyjq7QNMN'
      })
      return client.chat({messages,abortController: abortController, stream})
    }
    else{

      const openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        // @ts-ignore
        fetch:(url: RequestInfo, init?: RequestInit,)=>{
          return fetch(url,{
            ...init,
            signal:abortController.signal,
            dispatcher: getProxyAgent(config.enableProxy, proxy)
          })
        },
      });
      const fetchData = async ()=>{
        try {
          if(stream){
            const resp = await openai.chat.completions.create({
              model: config.model,
              messages,
              stream: true,
            }, {
              signal: abortController.signal,
            });

            for await (const part of resp) {
              if (part.choices && part.choices[0].delta.content) {
                readableStream.push(part.choices[0].delta.content);
              }
            }
            readableStream.push(null); // 结束流
          }
          else{
            const response = await openai.chat.completions.create({
              model: config.model,
              messages,
              stream: false,
            }, {
              signal: abortController.signal,
            });

            const fullResponse = response.choices[0].message.content;
            readableStream.push(fullResponse);
            readableStream.push(null); // 结束流
          }
        } catch (error) {
          readableStream.destroy(error);
        }
      }
      fetchData()
      return readableStream
    }
  }
  async invoke(input: string): Promise<string> {
    return new Promise((resolve, reject)=>{
      const stream = this.chat({messages: [{content: input, role:'user'}], stream:false})
      stream.on('data', chunk=>{
        resolve(chunk)
      })
      stream.on('error',(err)=>{
        reject(err)
      })
    })
  }
}
