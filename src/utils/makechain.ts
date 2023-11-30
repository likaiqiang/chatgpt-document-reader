import {OpenAI} from 'langchain/llms/openai';
import {ConversationalRetrievalQAChain} from 'langchain/chains';
import {FaissStore} from "langchain/vectorstores/faiss";
import {HttpsProxyAgent} from "https-proxy-agent";
import {VectorStoreRetriever} from "langchain/dist/vectorstores/base";

const CONDENSE_PROMPT = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

const QA_PROMPT = `You are a helpful AI assistant. Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say you don't know. DO NOT try to make up an answer.
If the question is not related to the context, politely respond that you are tuned to only answer questions that are related to the context.

{context}

Question: {question}
Helpful answer in markdown:`;

export const makeChain = (retriever: VectorStoreRetriever) => {
    const condenseQuestionPrompt =
        ChatPromptTemplate.fromTemplate(CONDENSE_TEMPLATE);
    const answerPrompt = ChatPromptTemplate.fromTemplate(QA_TEMPLATE);

    const model = new ChatOpenAI({
        temperature: 0, // increase temperature to get more creative answers
        modelName: 'gpt-3.5-turbo', //change this to gpt-4 if you have access
    });

    // Rephrase the initial question into a dereferenced standalone question based on
    // the chat history to allow effective vectorstore querying.
    const standaloneQuestionChain = RunnableSequence.from([
        condenseQuestionPrompt,
        model,
        new StringOutputParser(),
    ]);

    // Retrieve documents based on a query, then format them.
    const retrievalChain = retriever.pipe(combineDocumentsFn);

    // Generate an answer to the standalone question based on the chat history
    // and retrieved documents. Additionally, we return the source documents directly.
    const answerChain = RunnableSequence.from([
        {
            context: RunnableSequence.from([
                (input) => input.question,
                retrievalChain,
            ]),
            chat_history: (input) => input.chat_history,
            question: (input) => input.question,
        },
        answerPrompt,
        model,
        new StringOutputParser(),
    ]);

    // First generate a standalone question, then answer it based on
    // chat history and retrieved context documents.
    const conversationalRetrievalQAChain = RunnableSequence.from([
        {
            question: standaloneQuestionChain,
            chat_history: (input) => input.chat_history,
        },
        answerChain,
    ]);

    return conversationalRetrievalQAChain;
};
