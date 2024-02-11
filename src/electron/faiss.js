import { FaissStore } from 'langchain/vectorstores/faiss';
import faiss  from "./faiss-node";

FaissStore.importFaiss = ()=>{
  return { IndexFlatL2: faiss.IndexFlatL2 };
}

FaissStore.prototype.similaritySearch = async function(query, k = 4, filter = undefined, _callbacks = undefined){
  const results = await this.similaritySearchVectorWithScore(await this.embeddings.embedQuery(query), k, filter);

  if(filter === undefined) filter = ()=> true
  return results.filter(filter).map((result) => result[0])
}

export {FaissStore}

