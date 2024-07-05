import { type ClientOptions, OpenAI as OpenAIClient } from 'openai';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';
import { encodingForModel } from 'js-tiktoken';
import type {Tiktoken, TiktokenModel} from 'js-tiktoken'
import {
    APIConnectionTimeoutError,
    APIUserAbortError
} from 'openai';


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapOpenAIClientError(e: any) {
    let error;
    if (e.constructor.name === APIConnectionTimeoutError.name) {
        error = new Error(e.message);
        error.name = 'TimeoutError';
    } else if (e.constructor.name === APIUserAbortError.name) {
        error = new Error(e.message);
        error.name = 'AbortError';
    } else {
        error = e;
    }
    return error;
}

export const embeddingModel = 'text-embedding-ada-002';
const enc = encodingForModel(embeddingModel);

type OpenAICoreRequestOptions<
    Req extends object = Record<string, unknown>
> = {
    path?: string;
    query?: Req | undefined;
    body?: Req | undefined;
    headers?: Record<string, string | null | undefined> | undefined;

    maxRetries?: number;
    stream?: boolean | undefined;
    timeout?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    httpAgent?: any;
    signal?: AbortSignal | undefined | null;
    idempotencyKey?: string;
};

interface LegacyOpenAIInput {
    /** @deprecated Use baseURL instead */
    basePath?: string;
    /** @deprecated Use defaultHeaders and defaultQuery instead */
    baseOptions?: {
        headers?: Record<string, string>;
        params?: Record<string, string>;
    };
}

export interface OpenAIEmbeddingsParams extends EmbeddingsParams {
    /** Model name to use */
    modelName: string;

    /**
     * Timeout to use when making requests to OpenAI.
     */
    timeout?: number;


    /**
     * Whether to strip new lines from the input text. This is recommended by
     * OpenAI for older models, but may not be suitable for all use cases.
     * See: https://github.com/openai/openai-python/issues/418#issuecomment-1525939500
     */
    stripNewLines?: boolean;
}


export default class OpenAIEmbeddings
    extends Embeddings
    implements OpenAIEmbeddingsParams {
    modelName = 'text-embedding-ada-002';

    // TODO: Update to `false` on next minor release (see: https://github.com/langchain-ai/langchainjs/pull/3612)
    stripNewLines = true;

    timeout?: number;

    organization?: string;

    private client: OpenAIClient;

    batchSize = 512;

    private clientConfig: ClientOptions;


    constructor(
        fields?: Partial<OpenAIEmbeddingsParams> & {
            verbose?: boolean;
            openAIApiKey?: string;
            configuration?: ClientOptions;
        },
        configuration?: ClientOptions & LegacyOpenAIInput
    ) {
        const fieldsWithDefaults = { maxConcurrency: 2, ...fields };

        super(fieldsWithDefaults);

        const apiKey =
            fieldsWithDefaults?.openAIApiKey ??
            getEnvironmentVariable('OPENAI_API_KEY');

        this.organization =
            fieldsWithDefaults?.configuration?.organization ??
            getEnvironmentVariable('OPENAI_ORGANIZATION');

        this.modelName = fieldsWithDefaults?.modelName ?? this.modelName;

        this.stripNewLines =
            fieldsWithDefaults?.stripNewLines ?? this.stripNewLines;
        this.timeout = fieldsWithDefaults?.timeout;


        this.clientConfig = {
            apiKey,
            organization: this.organization,
            baseURL: configuration?.basePath,
            dangerouslyAllowBrowser: true,
            defaultHeaders: configuration?.baseOptions?.headers,
            defaultQuery: configuration?.baseOptions?.params,
            ...configuration,
            ...fields?.configuration
        };
    }
    private getBatch(texts: string[], modelName: TiktokenModel = embeddingModel): Array<string[]> {
        const enc = encodingForModel(modelName)
        let curChunk: string[] = []
        let curChunkCount = 0
        const batches: Array<string[]> = []
        for (const text of texts) {
            const tokenCount = getTokenCount(enc, text)
            if (tokenCount + curChunkCount > getMaxToken(embeddingModel)) {
                batches.push(curChunk)
                curChunkCount = tokenCount
                curChunk = [text]
            } else {
                curChunkCount += tokenCount
                curChunk.push(text)
            }
        }
        if (curChunk.length > 0) {
            batches.push(curChunk)
        }
        return batches
    }
    override async embedDocuments(texts: string[]): Promise<number[][]> {
        const batches = this.getBatch(texts)
        const batchRequests = batches.map((batch) =>
            this.embeddingWithRetry({
                model: this.modelName,
                input: batch,
            })
        );
        const batchResponses = await Promise.all(batchRequests);

        const embeddings: number[][] = [];
        for (let i = 0; i < batchResponses.length; i += 1) {
            const batch = batches[i];
            const { data: batchResponse } = batchResponses[i];
            for (let j = 0; j < batch.length; j += 1) {
                embeddings.push(batchResponse[j].embedding);
            }
        }
        return embeddings;
    }


    /**
     * Method to generate an embedding for a single document. Calls the
     * embeddingWithRetry method with the document as the input.
     * @param text Document to generate an embedding for.
     * @returns Promise that resolves to an embedding for the document.
     */
    async embedQuery(text: string): Promise<number[]> {
        const { data } = await this.embeddingWithRetry({
            model: this.modelName,
            input: this.stripNewLines ? text.replace(/\n/g, ' ') : text
        });
        return data[0].embedding;
    }

    /**
     * Private method to make a request to the OpenAI API to generate
     * embeddings. Handles the retry logic and returns the response from the
     * API.
     * @param request Request to send to the OpenAI API.
     * @returns Promise that resolves to the response from the API.
     */
    private async embeddingWithRetry(
        request: OpenAIClient.EmbeddingCreateParams
    ) {
        if (!this.client) {
            const params = {
                ...this.clientConfig,
                timeout: this.timeout,
                maxRetries: 0
            };

            if (!params.baseURL) {
                delete params.baseURL;
            }

            this.client = new OpenAIClient(params);
        }
        const requestOptions: OpenAICoreRequestOptions = {};

        return this.caller.call(async () => {
            try {
                const res = await this.client.embeddings.create(
                    request,
                    requestOptions
                );
                return res;
            } catch (e) {
                const error = wrapOpenAIClientError(e);
                throw error;
            }
        });
    }
}

export function getTokenCount(enc: Tiktoken ,text: string) {
    return enc.encode(text).length;
}

export function splitTextToken(enc: Tiktoken ,text: string, maxToken: number) {
    let currentTokenCount = 0, index = 0;
    for(let i=0;i<text.length;i++){
        const tokenCount = getTokenCount(enc, text[i]);
        if(tokenCount + currentTokenCount <= maxToken){
            currentTokenCount += tokenCount;
            index = i
        }
        else break
    }
    return text.slice(0, index+1)
}

export function getMaxToken(modelName: string): number {
    const models: { [key: string]: number } = {
        'gpt-3.5-turbo-1106': 16385,
        'gpt-3.5-turbo': 4096,
        'gpt-3.5-turbo-16k': 16385,
        'gpt-3.5-turbo-instruct': 4096,
        'gpt-3.5-turbo-0613': 4096,
        'gpt-3.5-turbo-16k-0613': 16385,
        'gpt-3.5-turbo-0301': 4096,
        'text-davinci-003': 4096,
        'text-davinci-002': 4096,
        'code-davinci-002': 8001,
        'gpt-4-1106-preview': 128000,
        'gpt-4-vision-preview': 128000,
        'gpt-4': 8192,
        'gpt-4-32k': 32768,
        'gpt-4-0613': 8192,
        'gpt-4-32k-0613': 32768,
        'gpt-4-0314': 8192,
        'gpt-4-32k-0314': 32768,
        'text-embedding-ada-002': 8191
    };
    return models[modelName] || -1;
}
