import { Runnable, RunnableSequence } from 'langchain/schema/runnable';
import {Document} from '@/types/document'
import { StringOutputParser } from 'langchain/schema/output_parser';
import { ChatPromptTemplate } from 'langchain/prompts';
import { getApiConfig, getModel, getProxy } from '@/electron/storage';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import fetch from 'node-fetch';
import {HttpsProxyAgent} from "https-proxy-agent";
import { getMaxToken, getTokenCount } from '@/electron/embeddings';
import { encodingForModel, TiktokenModel } from 'js-tiktoken';


const ANSWER_TEMPLATE = `你是一位专家研究员。使用以下上下文来回答最后的问题.
如果你不知道答案，就说你不知道。不要试图编造答案。
如果问题与上下文或聊天记录无关，您只回答与上下文相关的问题

<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

问题: {question}
markdown格式的有效回答:`;


const answerPrompt = ChatPromptTemplate.fromTemplate(ANSWER_TEMPLATE);

interface AnswerInvokeParams{
  context: Document[],
  chat_history: string,
  question: string
}


export class AnswerChain extends Runnable{
  lc_namespace = ["langchain_core", "runnables"];
  private getModelName(){
    return getModel()
  }
  private getChatOpenAIModel(){
    const config = getApiConfig()
    const proxy = getProxy() as string;
    return new ChatOpenAI({
      temperature: 0, // increase temperature to get more creative answers
      modelName: this.getModelName(),
      openAIApiKey: config.apiKey
      //change this to gpt-4 if you have access
    },{
      httpAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
      // @ts-ignore
      fetch,
      baseURL: config.baseUrl
    });
  }
  private getAnswerChain(){
    // @ts-ignore
    return RunnableSequence.from([
      answerPrompt,
      this.getChatOpenAIModel(),
      new StringOutputParser()
    ])
  }
  async invoke(input:AnswerInvokeParams): Promise<any> {
    const modelName = this.getModelName()
    const enc = encodingForModel(modelName as TiktokenModel)
    const maxToken = getMaxToken(modelName) - 200
    const {context,chat_history,question} = input
    if(context.length === 0) return '没有检索到有效的上下文'
    const answerChain = this.getAnswerChain()

    let currentTokenCount = 0, allContext= ''
    for(const ctx of context){
      const tokensCount = getTokenCount(enc, ctx.pageContent)
      currentTokenCount += tokensCount
      if(currentTokenCount < maxToken) allContext = allContext + '\n' + ctx.pageContent
      else break
    }

    return answerChain.invoke({
      context: allContext,
      chat_history,
      question
    })
  }
}
