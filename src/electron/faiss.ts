import { FaissStore } from 'langchain/vectorstores/faiss';
import faiss  from "./faiss-node";
import type {IndexFlatL2} from './faiss-node'

class CustomFaissStore extends FaissStore{
  static async importFaiss(): Promise<{ IndexFlatL2: typeof IndexFlatL2 }> {
    // @ts-ignore
    return { IndexFlatL2: faiss.default.IndexFlatL2 };
  }
}


export {CustomFaissStore}

