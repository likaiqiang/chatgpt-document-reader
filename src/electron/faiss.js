import  {FaissStore} from "langchain/vectorstores/faiss";
import * as faiss from './faiss-node'

FaissStore.importFaiss = ()=>{
  return { IndexFlatL2: faiss.default.IndexFlatL2 };
}

export {FaissStore}

