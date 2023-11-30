export interface DocumentInput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Metadata extends Record<string, any> = Record<string, any>
> {
    pageContent: string;

    metadata?: Metadata;
}

/**
 * Interface for interacting with a document.
 */
export class Document<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Metadata extends Record<string, any> = Record<string, any>
> implements DocumentInput
{
    pageContent: string = '';

    metadata: Metadata;

    constructor(fields: DocumentInput<Metadata>) {
        if(fields.pageContent){
            this.pageContent = fields.pageContent.toString()
        }
        this.metadata = fields.metadata ?? ({} as Metadata);
    }
}
