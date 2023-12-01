import type { Document } from 'langchain/document';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import {ChatFaissStore as FaissStore} from "./faiss";
import { makeChain } from '@/utils/makechain';
import {app} from "electron";
import path from 'path'
import fsPromise from 'node:fs/promises';
import {HttpsProxyAgent} from "https-proxy-agent";
import {outputDir} from '@/config'

global.crypto = require('node:crypto').webcrypto


interface ChatParams{
    question: string,
    filename:string,
    history: [string,string][]
}

export default async ({question, history, filename}:ChatParams) => {

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
            new OpenAIEmbeddings({},{
                httpAgent: new HttpsProxyAgent('http://127.0.0.1:7890')
            })
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
    }
}
