import { FaissStore } from './faiss';
import { documentsOutputDir, outputDir } from '@/config';
import { getEmbeddingConfig, getProxy } from '@/electron/storage';
import path from 'path'
import { getCodeDocs, getPdfDocs, getTextDocs } from '@/loaders';
import { default as Embeddings } from '@/electron/embeddings';
import {GitHub} from '@/electron/download'
import fs from 'fs/promises';
import { getProxyAgent } from '@/utils/default';
import { RequestInfo, RequestInit,fetch } from 'undici';

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
    // '.zip'
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

async function getDocuments({ filePath: fp, fileType }: { filePath: string, fileType?: string }) {
    const stat = await fs.stat(fp);
    if (stat.isDirectory()) {
        if(fileType === 'code'){
            return getCodeDocs(fp);
        }
    }

    if (fp.endsWith('.pdf')) {
        return getPdfDocs(fp);
    }
    if (fp.endsWith('.txt')) {
        return getTextDocs(fp);
    }
    // if (fp.endsWith('.zip')) {
    //     return getZipDocs(fp); // 待优化
    // }
    if (checkSupported(fp)) {
        return getCodeDocs(fp);
    }

    return [];
}
export const getRemoteFiles = async (url:string)=>{
    if(url.startsWith('https://github.com')){
        const proxy = getProxy() as string;
        const {enableProxy} = getEmbeddingConfig()

        const dl = await GitHub.createInstance({
            url,
            proxy: getProxyAgent(enableProxy, proxy),
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
        const {enableProxy} = getEmbeddingConfig()
        const dl = await GitHub.createInstance({
            url,
            proxy: getProxyAgent(enableProxy, proxy),
            downloadFileName
        })
        await dl.downloadZippedFiles()
        return path.join(documentsOutputDir, downloadFileName)
    }
    return Promise.reject('无法处理这个URL')
}

export const ingestData = async ({ filename, filePath,embedding, fileType }: IngestParams) => {
    const proxy = getProxy() as string;
    const config = getEmbeddingConfig();
    try {
        const docs = await getDocuments({
            filePath,
            fileType
        });
        console.log('docs', docs);

        if(docs.length === 0) return Promise.reject('no supported docs')
        const vectorStore = await FaissStore.fromDocuments(docs,
            new Embeddings({
                    openAIApiKey: config.apiKey,
                    modelName: embeddingModel
                }, {
                    // @ts-ignore
                    fetch:(url: RequestInfo, init?: RequestInit,)=>{
                        return fetch(url,{
                            ...init,
                            dispatcher: getProxyAgent(config.enableProxy, proxy)
                        })
                    },
                    baseURL: config.baseUrl,
                }
            ));
        const outputFilePath = path.join(outputDir, filename);
        await vectorStore.save(outputFilePath);

    } catch (error) {
        console.log('error', error.stack);
        return Promise.reject(error.code || 'ingest data failed');
    }
};

