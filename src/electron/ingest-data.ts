import { FaissStore } from './faiss';
import ZipLoader from '@/loaders/zip';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { outputDir } from '@/config';
import { getApiConfig, getProxy } from '@/electron/storage';
import fetch from 'node-fetch';
import path from 'path'
import { getCodeDocs, getPdfDocs, getTextDocs, getZipDocs } from '@/loaders';
import { default as Embeddings } from '@/electron/embeddings';
import {GitHub} from '@/electron/download'

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
    const doc = []
    for(const fp of filePath){
        if (fp.endsWith('.pdf')) {
            doc.push(
              ...await getPdfDocs(fp)
            )
        }
        if(fp.endsWith('.txt')){
            doc.push(...await getTextDocs(fp))
        }
        if (fp.endsWith('.zip')) {
            doc.push(...await getZipDocs(fp))
        }
        if(checkSupported(fp)){
            doc.push(...await getCodeDocs(fp))
        }
    }
    return doc
}

async function handleGithubUrl(url:string) {
    const proxy = getProxy() as string;
    const response = await fetch(url,{
        agent: proxy ? new HttpsProxyAgent(proxy) : undefined
    });
    const data = await response.json();

    console.log('data',data);

    if (data.payload?.blob?.rawLines) {
        return {
            code: data.payload.blob.rawLines.join('\n'),
            ext: path.extname(url),
            filename: `github_${data.payload.repo.ownerLogin}_${data.payload.repo.name}_${encodeURIComponent(data.payload.path)}`
        }
    }
    return Promise.reject('无法处理这个URL')
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

