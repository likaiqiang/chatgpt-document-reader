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
import { getLanguageParser, splitCode } from '@/loaders';
import { supportedLanguages } from '@/electron/ingest-data';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

const modelName = getModel()

const ANSWER_TEMPLATE = `You are an expert researcher. Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say you don't know. DO NOT try to make up an answer.
If the question is not related to the context or chat history, politely respond that you are tuned to only answer questions that are related to the context.

<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
Helpful answer in markdown:`;

const COMBINE_TEMPLATE = `You are an expert researcher.The following context is about {length} same questions and their different answers，based on your understanding of each answer, write a comprehensive answer that contains all the information, ensuring that the new answer is smooth, coherent:
If you don't know the answer, just say you don't know. DO NOT try to make up an answer.
If the question is not related to the context or chat history, politely respond that you are tuned to only answer questions that are related to the context.

<context>
  {context}
</context>

Helpful answer in markdown:
`


const answerPrompt = ChatPromptTemplate.fromTemplate(ANSWER_TEMPLATE);
const combinePrompt = ChatPromptTemplate.fromTemplate(COMBINE_TEMPLATE);


interface AnswerInvokeParams{
  context: Document[],
  chat_history: string,
  question: string
}


export class AnswerChain extends Runnable{
  lc_namespace = ["langchain_core", "runnables"];
  private getChatOpenAIModel(){
    const config = getApiConfig()
    const proxy = getProxy() as string;
    return new ChatOpenAI({
      temperature: 0, // increase temperature to get more creative answers
      modelName,
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
    const enc = encodingForModel(modelName as TiktokenModel)
    const maxToken = getMaxToken(modelName) - 200
    const {context,chat_history,question} = input
    const answers:string[] = []
    const answerChain = this.getAnswerChain()
    const combineChain = this.getCombineChain()

    for(const ctx of context){
      const {pageContent,metadata} = ctx
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
          const Parser = getLanguageParser(
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
