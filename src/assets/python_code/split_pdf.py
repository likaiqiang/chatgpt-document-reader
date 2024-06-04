import pymupdf  # PyMuPDF
from argparse import ArgumentParser
import json

class RecursiveCharacterTextSplitter:
    def __init__(self, chunk_size=5000, chunk_overlap=200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split(self, text):
        if len(text) <= self.chunk_size:
            return [text]

        chunks = []
        i = 0
        while i < len(text):
            # 如果不是第一个块，就向前移动一定的重叠字符数
            start_index = max(i - self.chunk_overlap, 0)
            end_index = min(i + self.chunk_size, len(text))
            chunks.append(text[start_index:end_index])
            i += self.chunk_size
        return chunks


def extract_text_by_chapter(pdf_document, chapter, next_chapter):
    """Extract text for a given chapter."""
    start_page = chapter[2] - 1
    current_page = start_page + 1
    end_page = next_chapter[2] - 1
    text = ""
    while current_page < end_page:
        page_text = pdf_document.load_page(start_page).get_text()
        text += page_text
        current_page += 1
    return text, start_page, end_page


def split_pdf_by_toc(pdf_document, block_size=5000, block_overlap=500, metadata=None):
    """Splits the PDF text into blocks based on the table of contents and block size."""
    if metadata is None:
        metadata = {}
    toc = pdf_document.get_toc(simple=True)
    splitter = RecursiveCharacterTextSplitter(chunk_size=block_size, chunk_overlap=block_overlap)
    blocks = []
    if len(toc) > 0:
        for index, entry in enumerate(toc):
            next_entry = toc[index + 1] if index + 1 < len(toc) else toc[-1]
            chapter_text, start_page, end_page = extract_text_by_chapter(pdf_document, entry, next_entry)
            default_metadata = {
                **metadata,
                "toc": {
                    "level": entry[0],
                    "title": entry[1],
                    "start_page": start_page
                },
                "pdf": {
                    "metadata": pdf_document.metadata,
                    "totalPages": pdf_document.page_count
                }
            }
            if len(chapter_text) <= block_size:
                blocks.append({
                    "pageContent": chapter_text,
                    "metadata": {
                        **default_metadata
                    }
                })
            else:
                paragraphs = chapter_text.split('\n\n')  # Split text into paragraphs
                for paragraph in paragraphs:
                    if len(paragraph) > block_size:
                        # Split long paragraphs using the RecursiveCharacterTextSplitter algorithm
                        paragraph_blocks = splitter.split(paragraph)
                        # blocks.extend(paragraph_blocks)
                        blocks.extend(
                            list(
                                map(lambda paragraph_block: {
                                    "pageContent": paragraph_block,
                                    "metadata": {
                                        **default_metadata
                                    }
                                }, paragraph_blocks)
                            )
                        )
                    else:
                        blocks.append({
                            "pageContent": paragraph,
                            "metadata": {
                                **default_metadata
                            }
                        })
    else:
        for i in range(0, pdf_document.page_count):
            page_text = pdf_document.load_page(i).get_text()
            blocks.extend(
                list(
                    map(lambda text: {
                        "pageContent": text,
                        "metadata": {
                            **default_metadata
                        }
                    }, splitter.split(page_text))
                )
            )
    return blocks


def extract_text_by_page_range(pdf_document, start_page: int, end_page: int) -> str:
    """Extract text within a range of pages."""
    text = []
    for page_num in range(start_page, end_page):
        page = pdf_document.load_page(page_num - 1)
        text.append(page.get_text())
    return "\n".join(text)

if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("--path", required=True, help="path to pdf")
    args = parser.parse_args()
    pdf_document = pymupdf.open(args.path)
    blocks = split_pdf_by_toc(pdf_document)
    print(json.dumps(blocks))
