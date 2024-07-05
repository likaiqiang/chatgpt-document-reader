import { ChatOpenAI } from 'langchain/chat_models/openai';
import { ChatPromptTemplate } from 'langchain/prompts';
import { RunnableSequence } from 'langchain/schema/runnable';
import { StringOutputParser } from 'langchain/schema/output_parser';
import type { VectorStoreRetriever } from 'langchain/vectorstores/base';
import {HttpsProxyAgent} from "https-proxy-agent";
import { getApiConfig, getModel, getProxy } from '@/electron/storage';
import fetch from 'node-fetch'
import { AnswerChain } from '@/utils/AnswerChain';
import LLM,{ChatType} from '@/utils/llm';
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
    const llm = new LLM({
        chatType: config.ernie ? ChatType.ERNIE : ChatType.CHATGPT,
    });

    // @ts-ignore
    const standaloneQuestionChain = RunnableSequence.from([
        condenseQuestionPrompt,
        llm,
    ]);

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
            question: (input)=> input.chat_history.length ? standaloneQuestionChain : input.question,
            chat_history: (input) => input.chat_history,
        },
        answerWithRetrievalChain,
    ]);

    return conversationalRetrievalQAChain
};
