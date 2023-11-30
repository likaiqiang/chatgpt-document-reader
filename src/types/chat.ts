import { Document } from 'langchain/document';

export type Message = {
  type: 'apiMessage' | 'userMessage';
  message: string;
  isStreaming?: boolean;
  sourceDocs?: Document[];
};

export interface Resource{
  filename:string
}
export interface ChatResponse{
  text: string,
  sourceDocuments: Document[]
}
