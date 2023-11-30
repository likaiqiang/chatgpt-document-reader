import { encoding_for_model, get_encoding, Tiktoken } from '@dqbd/tiktoken'

const decoder = new TextDecoder();

type supportModelType =
    | 'gpt-3.5-turbo'
    | 'gpt-3.5-turbo-0301'
    | 'gpt-4'
    | 'gpt-4-0314'
    | 'gpt-4-32k'
    | 'gpt-4-32k-0314'
    | 'text-davinci-003'
    | 'text-curie-001'
    | 'text-babbage-001'
    | 'text-ada-001'
    | 'code-davinci-002'
    | 'code-cushman-001'


type roleType =
    | 'system'
    | 'user'
    | 'assistant'

interface MessageItem {
    name?: string
    role: roleType
    content: string
}


function get_sliced_message(messages: MessageItem[],model:supportModelType){
    let encoding!: Tiktoken
    try {
        encoding = encoding_for_model(model)
    } catch (e) {
        // this.warning('model not found. Using cl100k_base encoding.')

        encoding = get_encoding('cl100k_base')
    }
    return messages.map(message=>{
        const {content} = message
        const tokens = encoding.encode(content as string)
        if(tokens.length > getModelContextSize(model)){
            const slicedTokens = tokens.slice(0,getModelContextSize(model))
            const slicedValue = decoder.decode(encoding.decode(slicedTokens))
            return {
                ...message,
                content: slicedValue
            }
        }
        return {...message}
    })

}


const num_tokens_from_messages = (messages: MessageItem[],model:supportModelType):number=>{
    if (model === 'gpt-3.5-turbo') {
        return num_tokens_from_messages(messages, 'gpt-3.5-turbo-0301')
    }

    if (model === 'gpt-4') {
        /**
         * https://help.openai.com/en/articles/7127966-what-is-the-difference-between-the-gpt-4-models
         *
         * Secondly, gpt-4 will refer to our most up-to-date model (and gpt-4-32k for the latest 32k-context model).
         * If you're interested in using a previous snapshot of the model, you can refer to the specific date in the model name, such as gpt-4-0314 or gpt-4-32k-0314.
         * The March 14th snapshot will be available until June 14th.
         */
        // this.warning('gpt-4 may change over time. Returning num tokens assuming gpt-4-0314.')

        return num_tokens_from_messages(messages, 'gpt-4-0314')
    }

    if (model === 'gpt-4-32k') {
        /**
         * https://help.openai.com/en/articles/7127966-what-is-the-difference-between-the-gpt-4-models
         *
         * Secondly, gpt-4 will refer to our most up-to-date model (and gpt-4-32k for the latest 32k-context model).
         * If you're interested in using a previous snapshot of the model, you can refer to the specific date in the model name, such as gpt-4-0314 or gpt-4-32k-0314.
         * The March 14th snapshot will be available until June 14th.
         */
        // this.warning('gpt-4-32k may change over time. Returning num tokens assuming gpt-4-32k-0314.')

        return num_tokens_from_messages(messages, 'gpt-4-32k-0314')
    }

    let encoding!: Tiktoken
    let tokens_per_message!: number
    let tokens_per_name !: number
    let num_tokens = 0

    try {
        encoding = encoding_for_model(model)
    } catch (e) {
        // this.warning('model not found. Using cl100k_base encoding.')

        encoding = get_encoding('cl100k_base')
    }

    if (model === 'gpt-3.5-turbo-0301') {
        tokens_per_message = 4
        tokens_per_name    = -1
    }

    if (['gpt-4-0314', 'gpt-4-32k-0314'].includes(model)) {
        tokens_per_message = 3
        tokens_per_name    = 1
    }

    // Python 2 Typescript by gpt-4
    for (const message of messages) {
        num_tokens += tokens_per_message

        for (const [key, value] of Object.entries(message)) {
            num_tokens += encoding.encode(value as string).length
            if (key === 'name') { num_tokens += tokens_per_name }
        }
    }

    // Supplementary
    encoding.free()



    return num_tokens + 3
}


export const getModelNameForTiktoken = (modelName:supportModelType) => {
    if (modelName.startsWith("gpt-3.5-turbo-")) {
        return "gpt-3.5-turbo";
    }
    if (modelName.startsWith("gpt-4-32k-")) {
        return "gpt-4-32k";
    }
    if (modelName.startsWith("gpt-4-")) {
        return "gpt-4";
    }
    return modelName;
};
export const getModelContextSize = (modelName:supportModelType) => {
    switch (getModelNameForTiktoken(modelName)) {
        case "gpt-3.5-turbo":
            return 4096;
        case "gpt-4-32k":
            return 32768;
        case "gpt-4":
            return 8192;
        case "text-davinci-003":
            return 4097;
        case "text-curie-001":
            return 2048;
        case "text-babbage-001":
            return 2048;
        case "text-ada-001":
            return 2048;
        case "code-davinci-002":
            return 8000;
        case "code-cushman-001":
            return 2048;
        default:
            return 4097;
    }
};

