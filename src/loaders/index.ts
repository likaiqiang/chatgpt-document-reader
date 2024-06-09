import PDFLoader from '@/loaders/pdf';
import CodeLoader from '@/loaders/code';
import TextLoader from '@/loaders/text';


export const getTextDocs = async ({buffer, filePath}: IngestParams)=>{
  return new TextLoader().parse(filePath)
}


export const getPdfDocs = async ({buffer, filePath}: IngestParams)=>{
  return await new PDFLoader().parse(filePath);
}

export const getCodeDocs = async ({buffer, filePath}: IngestParams)=>{
  return await new CodeLoader().parse(filePath)
}

