import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import {FaissStore} from "langchain/vectorstores/faiss";
import PDFLoader from "@/loaders/pdf";
import {HttpsProxyAgent} from "https-proxy-agent";
import fsPromise from 'node:fs/promises'
import {app} from "electron";
import path from "path";

const userPath = app.getPath('userData')


/* Name of directory to retrieve your files from
   Make sure to add your PDF files inside the 'docs' folder
*/

export default async (buffer: Buffer, filename:string) => {
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
            httpAgent: new HttpsProxyAgent('http://127.0.0.1:7890'),
        }))
        const outputFilePath = path.join(userPath, 'faisscache',filename)
        await fsPromise.mkdir(outputFilePath, { recursive: true });
        await vectorStore.save(outputFilePath);

    } catch (error) {
        console.log('error', error);
        throw new Error('Failed to ingest your data');
    }
};

