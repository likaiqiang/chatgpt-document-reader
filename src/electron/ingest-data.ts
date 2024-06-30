import { FaissStore } from './faiss';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { documentsOutputDir, outputDir } from '@/config';
import { getApiConfig, getProxy } from '@/electron/storage';
import fetch from 'node-fetch';
import path from 'path'
import { getCodeDocs, getPdfDocs, getTextDocs, getZipDocs } from '@/loaders';
import { default as Embeddings } from '@/electron/embeddings';
import {GitHub} from '@/electron/download'
import ZIPLoader from '@/loaders/zip';

const embeddingModel = 'text-embedding-ada-002';


export const supportedLanguages = [
    '.py',
    '.php',
    '.js',
    '.ts',
    '.go',
    '.cpp',
    '.java',
    '.rb',
    '.cs'
]

export const supportedDocuments = [
    ...supportedLanguages,
    '.pdf',
    '.txt',
    '.zip'
];

export const checkSupported = (path:string, suffixes:string[] = supportedDocuments)=>{
    return suffixes.reduce((acc, ext) => {
        return acc || path.endsWith(ext);
    }, false);
}

 export const checkSupportedLanguages = (path:string)=>{
    return supportedLanguages.reduce((acc, ext)=>{
        return acc || path.endsWith(ext)
    },false)
}


async function getDocuments({ filePath }: IngestParams) {
    const tasks = []

    for(const fp of filePath){
        if (fp.endsWith('.pdf')) {
            tasks.push(()=> getPdfDocs(fp))
        }
        if(fp.endsWith('.txt')){
            tasks.push(()=> getTextDocs(fp))
        }
        if (fp.endsWith('.zip')) {
            tasks.push(()=> getZipDocs(fp))
        }
        if(checkSupported(fp)){
            tasks.push(()=> getCodeDocs(fp))
        }
    }
    return ZIPLoader.promiseAllWithConcurrency(tasks)
}

export const getRemoteFiles = async (url:string)=>{
    if(url.startsWith('https://github.com')){
        const proxy = getProxy() as string;
        const dl = new GitHub({
            url,
            proxy: proxy,
            downloadFileName: encodeURIComponent(new URL(url).pathname)
        })
        await dl.downloadZippedFiles()
        return dl.downloadedFiles
    }
    return Promise.reject('无法处理这个URL')
}

export const getRemoteDownloadedDir = async (url:string)=>{
    const downloadFileName = encodeURIComponent(new URL(url).pathname)
    if(url.startsWith('https://github.com')){
        const proxy = getProxy() as string;
        const dl = new GitHub({
            url,
            proxy: proxy,
            downloadFileName
        })
        await dl.downloadZippedFiles()
        return path.join(documentsOutputDir, downloadFileName)
    }
    return Promise.reject('无法处理这个URL')
}

export const ingestData = async ({ filename, filePath }: IngestParams) => {
    const proxy = getProxy() as string;
    const config = getApiConfig();
    try {
        const docs = await getDocuments({
            filePath
        });
        if(docs.length === 0) return Promise.reject('no supported docs')
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

