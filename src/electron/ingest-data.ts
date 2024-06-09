import { FaissStore } from './faiss';
import ZipLoader from '@/loaders/zip';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { outputDir } from '@/config';
import { getApiConfig, getProxy } from '@/electron/storage';
import fetch from 'node-fetch';
import path from 'path'
import { Document } from '@/types/document';
import { getCodeDocs, getPdfDocs, getTextDocs } from '@/loaders';
import { default as Embeddings } from '@/electron/embeddings';

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
    return getCodeDocs({ buffer: buffer.toString(), filename, filePath })
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

export const getRemoteCode = async (url:string)=>{
    const {code, ext, filename} = await handleGithubUrl(url)
    return {
        ext,
        code,
        filename
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

