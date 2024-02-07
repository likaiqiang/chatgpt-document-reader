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
import path from 'path';
import { getCommentSymbol, getLanguageParser, splitCode } from '@/loaders';
import {
  checkSupported as checkSupportedDocs,
  checkSupportedLanguages,
  supportedLanguages
} from '@/electron/ingest-data';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

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

const COMBINE_TEMPLATE = `您是一名专家研究员。以下上下文是关于{length}个相同问题及其不同答案，根据您对每个答案的理解，写出包含所有信息的综合答案，确保新答案流畅、连贯：
如果你不知道答案，就说你不知道。不要试图编造答案。
<context>
  {context}
</context>

markdown格式的有效回答:
`


const answerPrompt = ChatPromptTemplate.fromTemplate(ANSWER_TEMPLATE);
const combinePrompt = ChatPromptTemplate.fromTemplate(COMBINE_TEMPLATE);

const removeMetadataFromText = (text:string,source:string)=>{
  let regex = null
  if(checkSupportedDocs(source)){
    regex = /@@metadata@@.*?@@metadata@@\n/g;
  }
  if(checkSupportedLanguages(source)){
    const ext = path.extname(source).slice(1)
    const commentSymbol = getCommentSymbol(ext)
    regex = new RegExp(`${commentSymbol}@@metadata@@.*?@@metadata@@\n`,'g')
  }
  return regex ? text.replace(regex, '') : text
}


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
    return RunnableSequence.from([
      answerPrompt,
      this.getChatOpenAIModel(),
      new StringOutputParser()
    ])
  }
  private getCombineChain(){
    return RunnableSequence.from([
      combinePrompt,
      this.getChatOpenAIModel(),
      new StringOutputParser()
    ])
  }
  async invoke(input:AnswerInvokeParams): Promise<any> {
    const modelName = this.getModelName()
    const enc = encodingForModel(modelName as TiktokenModel)
    const maxToken = getMaxToken(modelName) - 200
    const {context,chat_history,question} = input
    const answers:string[] = []
    const answerChain = this.getAnswerChain()
    const combineChain = this.getCombineChain()

    for(const ctx of context){
      const {metadata} = ctx
      const pageContent = removeMetadataFromText(ctx.pageContent, metadata.source)

      const tokensCount = getTokenCount(enc, pageContent)
      const {source} = metadata
      if(tokensCount <= maxToken ) answers.push(
        await answerChain.invoke({
          context: pageContent,
          chat_history,
          question
        })
      )
      else{
        const ext = path.extname(source);
        if(supportedLanguages.includes(ext)){
          const Parser = await getLanguageParser(
            ext.slice(1)
          )
          const codes = splitCode(pageContent, Parser)
          answers.push(
            ...(
              await Promise.all(
                codes.map(code=>{
                  return answerChain.invoke({
                    context: code,
                    chat_history,
                    question
                  })
                })
              )
            )
          )
        }
        else{
          // splitDoc
          const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
          });
          const docs = await textSplitter.splitDocuments([ctx]);
          answers.push(
            ...(
              await Promise.all(
                docs.map(doc=>{
                  return answerChain.invoke({
                    context: doc.pageContent,
                    chat_history,
                    question
                  })
                })
              )
            )
          )

        }
      }
    }
    if(answers.length === 1) return answers[0]
    return combineChain.invoke({
      length: answers.length + '',
      context: answers.reduce((acc,ans,index)=>{
        acc = acc + `
          question ${index + 1}: ${question}
          answer: ${ans}
          \n\n
        `
        return acc
      },'')
    })
  }
}
