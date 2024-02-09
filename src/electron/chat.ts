import type { Document } from 'langchain/document';
import { default as Embeddings } from '@/electron/embeddings';
import {FaissStore } from "./faiss";
import { makeChain } from '@/utils/makechain';
import path from 'path'
import fsPromise from 'node:fs/promises';
import {HttpsProxyAgent} from "https-proxy-agent";
import {outputDir} from '@/config'
import { ChatParams } from '@/types/chat';
import { getApiConfig, getProxy } from '@/electron/storage';
import fetch from 'node-fetch'


export default async ({question, history, filename}:ChatParams) => {
    const proxy = getProxy() as string
    const config = getApiConfig()
    console.log('question', question);
    console.log('history', history);

    // only accept post requests

    // OpenAI recommends replacing newlines with spaces for best results
    const sanitizedQuestion = question.trim().replaceAll('\n', ' ');
    try {
        const outputFilePath = path.join(outputDir,filename)
        await fsPromise.mkdir(outputFilePath,{recursive: true})
        /* create vectorstore */
        const vectorStore = await FaissStore.load(
            outputFilePath,
            new Embeddings({
                openAIApiKey: config.apiKey,
            },{
                httpAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
                // @ts-ignore
                fetch,
                baseURL: config.baseUrl
            }),
        );
        // Use a callback to get intermediate sources from the middle of the chain
        let resolveWithDocuments: (value: Document[]) => void;
        const documentPromise = new Promise<Document[]>((resolve) => {
            resolveWithDocuments = resolve;
        });
        const retriever = vectorStore.asRetriever({
            callbacks: [
                {
                    handleRetrieverEnd(documents) {
                        resolveWithDocuments(documents);
                    },
                },
            ],
            filter:([context, distance]:[context: string, distance: number])=> distance < 0.6
        });
        // create chain
        const chain = makeChain(retriever);

        const pastMessages = history
            .map((message: [string, string]) => {
                return [`Human: ${message[0]}`, `Assistant: ${message[1]}`].join('\n');
            })
            .join('\n');
        console.log(pastMessages);

        // Ask a question using chat history
        const response = await chain.invoke({
            question: sanitizedQuestion,
            chat_history: pastMessages,
        });

        const sourceDocuments = await documentPromise;

        console.log('response', response);
        return {
            text: response, sourceDocuments
        }
    } catch (error: any) {
        console.log('error', error);
        return Promise.reject(error.code || 'chat failed')
    }
}
