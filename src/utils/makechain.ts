import { ChatPromptTemplate } from 'langchain/prompts';
import { RunnableSequence } from 'langchain/schema/runnable';
import type { VectorStoreRetriever } from 'langchain/vectorstores/base';
import { AnswerChain } from '@/utils/AnswerChain';
import LLM from '@/utils/llm';

const CONDENSE_TEMPLATE = `鉴于以下对话和后续问题，将后续问题改写为一个独立的问题。

<chat_history>
  {chat_history}
</chat_history>

后续输入: {question}
独立问题:`;



export const makeChain = (retriever: VectorStoreRetriever) => {
    const condenseQuestionPrompt =
        ChatPromptTemplate.fromTemplate(CONDENSE_TEMPLATE);

    const llm = new LLM();

    const standaloneQuestionChain = RunnableSequence.from([
        condenseQuestionPrompt,
        llm,
    ]);

    const answerWithRetrievalChain = RunnableSequence.from([
        {
            context: RunnableSequence.from([
                (input) => input.question,
                retriever
            ]),
            question: input => input.question,
            chat_history: input => input.chat_history
        },
        new AnswerChain()
    ])

    // First generate a standalone question, then answer it based on
    // chat history and retrieved context documents.
    return RunnableSequence.from([
        {
            question: (input) => input.chat_history.length ? standaloneQuestionChain : input.question,
            chat_history: (input) => input.chat_history,
        },
        answerWithRetrievalChain,
    ])
};
