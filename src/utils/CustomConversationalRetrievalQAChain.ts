import {ConversationalRetrievalQAChain} from 'langchain/chains';
import {ChainValues} from "langchain/dist/schema";
import {CallbackManagerForChainRun} from "langchain/dist/callbacks/manager";
import {Document} from "langchain/document";
export default class CustomConversationalRetrievalQAChain extends ConversationalRetrievalQAChain{
  async _call(values:ChainValues, runManager?: CallbackManagerForChainRun): Promise<ChainValues> {
   if (!(this.inputKey in values)) {
    throw new Error(`Question key ${this.inputKey} not found.`);
   }
   if (!(this.chatHistoryKey in values)) {
    throw new Error(`chat history key ${this.inputKey} not found.`);
   }
   const question = values[this.inputKey];
   const chatHistory = values[this.chatHistoryKey];
   let newQuestion = question;
   if (chatHistory.length > 0) {
    const result = await this.questionGeneratorChain.call({
     question,
     chat_history: chatHistory,
    }, runManager?.getChild());
    const keys = Object.keys(result);
    if (keys.length === 1) {
     newQuestion = result[keys[0]];
    }
    else {
     throw new Error("Return from llm chain has multiple values, only single values supported.");
    }
   }
   const docs = this.makeDocuments(
       await this.retriever.getRelevantDocuments(newQuestion)
   )

   const inputs = {
    question: newQuestion,
    input_documents: docs,
    chat_history: chatHistory,
   };
   const result = await this.combineDocumentsChain.call(inputs, runManager?.getChild());
   if (this.returnSourceDocuments) {
    return {
     ...result,
     sourceDocuments: docs,
    };
   }
   return result;
  }
  makeDocuments(documents: Document[]){
   return documents.map(document=>{
    const {metadata,pageContent} = document
    return new Document({
     metadata,
     pageContent: pageContent.replace(/\\n/g,'')
    })
   })
  }
 }
