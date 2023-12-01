import { Document } from "@/types/document";

const formatDocumentsAsString = (
    documents: Document[],
    separator = "\n\n"
): string => documents.map((doc) => doc.pageContent).join(separator);

class PDFLoader {
    private splitPages: boolean;

    private pdfjs: typeof PDFLoaderImports;

    protected parsedItemSeparator: string;
    constructor(
        {
            splitPages = true,
            pdfjs = PDFLoaderImports,
            parsedItemSeparator = " ",
        } = {}
    ) {
        this.splitPages = splitPages;
        this.pdfjs = pdfjs;
        this.parsedItemSeparator = parsedItemSeparator;
    }

    async parse(raw: Buffer, metadata: Document["metadata"]): Promise<Document[]>{
        const { getDocument, version } = await this.pdfjs();
        const pdf = await getDocument({
            data: new Uint8Array(raw.buffer),
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true,
        }).promise;
        const meta = await pdf.getMetadata().catch();
        const documents: Document[] = [];

        for (let i = 1; i <= pdf.numPages; i += 1) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();

            if (content.items.length === 0) {
                continue;
            }

            // Eliminate excessive newlines
            // Source: https://github.com/albertcui/pdf-parse/blob/7086fc1cc9058545cdf41dd0646d6ae5832c7107/lib/pdf-parse.js#L16
            let lastY;
            const textItems = [];
            for (const item of content.items) {
                if ("str" in item) {
                    if (lastY === item.transform[5] || !lastY) {
                        textItems.push(item.str);
                    } else {
                        textItems.push(`\n${item.str}`);
                    }
                    // eslint-disable-next-line prefer-destructuring
                    lastY = item.transform[5];
                }
            }

            const text = textItems.join(this.parsedItemSeparator);

            documents.push(
                new Document({
                    pageContent: text,
                    metadata: {
                        ...metadata,
                        pdf: {
                            version,
                            info: meta?.info,
                            metadata: meta?.metadata,
                            totalPages: pdf.numPages,
                        },
                        loc: {
                            pageNumber: i,
                        },
                    },
                })
            );
        }

        if (this.splitPages) {
            return documents;
        }

        if (documents.length === 0) {
            return [];
        }

        return [
            new Document({
                pageContent: formatDocumentsAsString(documents),
                metadata: {
                    ...metadata,
                    pdf: {
                        version,
                        info: meta?.info,
                        metadata: meta?.metadata,
                        totalPages: pdf.numPages,
                    },
                },
            }),
        ];
    }
}
export default PDFLoader

async function PDFLoaderImports() {
    try {
        const { default: mod } = await import(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            "pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js"
            );
        const { getDocument, version } = mod;
        return { getDocument, version };
    } catch (e) {
        console.error(e);
        throw new Error(
            "Failed to load pdf-parse. Please install it with eg. `npm install pdf-parse`."
        );
    }
}
