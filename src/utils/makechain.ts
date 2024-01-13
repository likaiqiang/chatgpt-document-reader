import { ChatOpenAI } from 'langchain/chat_models/openai';
import { ChatPromptTemplate } from 'langchain/prompts';
import { RunnableSequence } from 'langchain/schema/runnable';
import { StringOutputParser } from 'langchain/schema/output_parser';
import type { VectorStoreRetriever } from 'langchain/vectorstores/base';
import {HttpsProxyAgent} from "https-proxy-agent";
import { getApiConfig, getModel, getProxy } from '@/electron/storage';
import fetch from 'node-fetch'
import { AnswerChain } from '@/utils/AnswerChain';
const CONDENSE_TEMPLATE = `鉴于以下对话和后续问题，将后续问题改写为一个独立的问题。

<chat_history>
  {chat_history}
</chat_history>

后续输入: {question}
独立问题:`;



export const makeChain = (retriever: VectorStoreRetriever) => {
    const modelName = getModel()
    console.log('modelName',modelName);
    const proxy = getProxy() as string;
    const condenseQuestionPrompt =
        ChatPromptTemplate.fromTemplate(CONDENSE_TEMPLATE);

    const config = getApiConfig()

    const model = new ChatOpenAI({
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



    // Rephrase the initial question into a dereferenced standalone question based on
    // the chat history to allow effective vectorstore querying.
    const standaloneQuestionChain = RunnableSequence.from([
        condenseQuestionPrompt,
        model,
        new StringOutputParser(),
    ]);

    // Retrieve documents based on a query, then format them.
    // @ts-ignore
    // const retrievalChain = retriever.pipe(combineDocumentsFn);


    const answerWithRetrievalChain = RunnableSequence.from([
        {
            context: RunnableSequence.from([
                (input) => input.question,
                retriever
            ]),
            question: input => input.question,
            chat_history: input => input.chat_history
        },
        new AnswerChain()
    ])

    // First generate a standalone question, then answer it based on
    // chat history and retrieved context documents.
    const conversationalRetrievalQAChain = RunnableSequence.from([
        {
            question: standaloneQuestionChain,
            chat_history: (input) => input.chat_history,
        },
        answerWithRetrievalChain,
    ]);

    return conversationalRetrievalQAChain
};
