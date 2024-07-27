import PDFLoader from '@/loaders/pdf';
import CodeLoader from '@/loaders/code';
import TextLoader from '@/loaders/text';
import ZIPLoader from '@/loaders/zip';


export const getTextDocs = async (p:string)=>{
  return new TextLoader().parse(p)
}


export const getPdfDocs = async (p:string)=>{
  return new PDFLoader().parse(p);
}

export const getCodeDocs = async (p:string)=>{
  return new CodeLoader().parse(p)
}
export const getZipDocs = async (p:string)=>{
  return new ZIPLoader().parse(p)
}


