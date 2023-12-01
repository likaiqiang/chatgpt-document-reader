import {FaissStore} from "langchain/vectorstores/faiss";
import * as faiss from './faiss-node'

console.log('faiss',faiss);

export class ChatFaissStore extends FaissStore{
  static async importFaiss() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return { IndexFlatL2: faiss.default.IndexFlatL2 };
  }
}
