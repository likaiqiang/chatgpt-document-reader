import { FaissStore } from './faiss';
import ZipLoader from '@/loaders/zip';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {fileTypeFromStream} from 'file-type';
import path from 'path';
import { outputDir } from '@/config';
import { getApiConfig, getProxy } from '@/electron/storage';
import fetch from 'node-fetch';

import { Document } from '@/types/document';
import { getCodeDocs, getPdfDocs, getTextDocs } from '@/loaders';
import { default as Embeddings } from '@/electron/embeddings';

const embeddingModel = 'text-embedding-ada-002';


export const supportedLanguages = [
    '.cpp',
    '.go',
    '.java',
    '.js',
    '.php',
    '.proto', //
    '.py',
    '.rst', //
    '.rb',
    '.rs',
    '.scala',
    '.markdown',
    '.md',
    '.sol',
    '.kt',
    '.cs',
    '.ts',
    '.tsx'
]

export const supportedDocuments = [
    ...supportedLanguages,
    '.pdf',
    '.txt',
    '.zip'
];

export const checkSupported = (path:string)=>{
    return supportedDocuments.reduce((acc, ext) => {
        return acc || path.endsWith(ext);
    }, false);
}

 export const checkSupportedLanguages = (path:string)=>{
    return supportedLanguages.reduce((acc, ext)=>{
        return acc || path.endsWith(ext)
    },false)
}


async function getDocuments({ buffer, filename, filePath, ext }: IngestParams & {ext?:string}): Promise<Document[]> {
    if(/^https?/.test(filePath)){
        const {buffer: remoteBuffer, ext} = await getRemoteBuffer(filePath)
        if(checkSupported('.' + ext)){
            return getDocuments({buffer: remoteBuffer, filePath, filename, ext})
        }
        return Promise.reject({code: '不支持的文件'})
    }
    if (filePath.endsWith('.pdf')) {
        return getPdfDocs({ buffer, filename, filePath });
    }
    if(filePath.endsWith('.txt')){
        return getTextDocs({ buffer: buffer.toString(), filename, filePath })
    }
    if (filePath.endsWith('.zip')) {
        const tasks: Array<Promise<Document[]>> = [];
        const files = await new ZipLoader().parse(buffer as Buffer, path => {
            return checkSupported(path)
        });
        for (const file of files) {
            const { path, content } = file;
            if (path.endsWith('.pdf')) {
                tasks.push(
                    getPdfDocs({ buffer: Buffer.from(content), filename, filePath })
                );
            }
            else if(path.endsWith('.txt')){
                tasks.push(
                    getTextDocs({ buffer: content, filename, filePath })
                )
            }
            else if(checkSupportedLanguages(path)){
                tasks.push(
                  getCodeDocs({ buffer: content, filename, filePath:path })
                )
            }

        }
        return Promise.all(tasks).then(docs => {
            return docs.flat();
        });
    }
    return getCodeDocs({ buffer: buffer.toString(), filename, filePath, ext })
}

const getRemoteBuffer = async (url:string)=>{
    const proxy = getProxy() as string;
    const response = await fetch(url,{
        agent: proxy ? new HttpsProxyAgent(proxy) : undefined
    })
    // @ts-ignore
    const ext = (await fileTypeFromStream(response.body)).ext
    return {
        ext,
        buffer: new TextDecoder().decode(await response.arrayBuffer())
    }
}

export const ingestData = async ({ buffer, filename, filePath }: IngestParams) => {
    const proxy = getProxy() as string;
    const config = getApiConfig();
    try {
        const docs = await getDocuments({
            buffer,
            filename,
            filePath
        });
        const vectorStore = await FaissStore.fromDocuments(docs,
            new Embeddings({
                    openAIApiKey: config.apiKey,
                    modelName: embeddingModel
                }, {
                    httpAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
                    // @ts-ignore
                    fetch,
                    baseURL: config.baseUrl
                }
            ));
        const outputFilePath = path.join(outputDir, filename);
        await vectorStore.save(outputFilePath);

    } catch (error) {
        console.log('error', error);
        return Promise.reject(error.code || 'ingest data failed');
    }
};

