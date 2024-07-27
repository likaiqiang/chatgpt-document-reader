import { Document } from 'langchain/document';

export type Message = {
  type: 'apiMessage' | 'userMessage';
  message: string;
  isStreaming?: boolean;
  sourceDocs?: Document[];
};

export interface Resource{
  filename:string,
  birthtime: Date,
  embedding: boolean
}
export interface ChatResponse{
  text: string,
  sourceDocuments: Document[]
}
export interface ChatParams{
  question: string,
  filename:string,
  history: [string,string][]
}
