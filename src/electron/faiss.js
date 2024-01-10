import { FaissStore } from 'langchain/vectorstores/faiss';
import faiss  from "./faiss-node";

FaissStore.importFaiss = ()=>{
  return { IndexFlatL2: faiss.IndexFlatL2 };
}


export {FaissStore}

