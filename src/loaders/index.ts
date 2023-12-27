import PDFLoader from '@/loaders/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export const getPdfDocs = async ({buffer, filename}: IngestParams)=>{
  const rawDocsArray = await new PDFLoader().parse(buffer, { source: filename });
  /* Split text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200
  });
  return await textSplitter.splitDocuments(rawDocsArray);
}
