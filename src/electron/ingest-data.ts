import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import {FaissStore } from "./faiss";
import PDFLoader from "@/loaders/pdf";
import {HttpsProxyAgent} from "https-proxy-agent";
import path from "path";
import { outputDir } from '@/config';
import { getApikey, getProxy } from '@/electron/storage';

/* Name of directory to retrieve your files from
   Make sure to add your PDF files inside the 'docs' folder
*/

export default async ({buffer, filename}: {buffer:Buffer, filename:string}) => {
    const proxy = getProxy() as string
    const apikey = getApikey() as string
    try {
        const rawDocsArray = await new PDFLoader().parse(buffer, {source: filename})

        /* Split text into chunks */
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const docs = await textSplitter.splitDocuments(rawDocsArray);
        console.log('split docs', docs);

        console.log('creating vector store...');
        const vectorStore = await FaissStore.fromDocuments(docs,new OpenAIEmbeddings({},{
            httpAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
            apiKey: apikey
        }))
        const outputFilePath = path.join(outputDir,filename)
        await vectorStore.save(outputFilePath);

    } catch (error) {
        console.log('error', error);
        throw new Error('Failed to ingest your data');
    }
};

