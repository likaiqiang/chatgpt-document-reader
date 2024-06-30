import io


from llama_index.readers.file import PDFReader
from pathlib import Path
from typing import Any, Dict, List, Optional

from fsspec import AbstractFileSystem

from llama_index.core.readers.file.base import get_default_fs, is_default_fs
from llama_index.core.schema import Document
class Reader(PDFReader):
    def load_data(
        self,
        file: Path,
        extra_info: Optional[Dict] = None,
        fs: Optional[AbstractFileSystem] = None,
    ) -> List[Document]:
        """Parse file."""
        if not isinstance(file, Path):
            file = Path(file)

        try:
            import pypdf
        except ImportError:
            raise ImportError(
                "pypdf is required to read PDF files: `pip install pypdf`"
            )
        fs = fs or get_default_fs()
        with fs.open(file, "rb") as fp:
            # Load the file in memory if the filesystem is not the default one to avoid
            # issues with pypdf
            stream = fp if is_default_fs(fs) else io.BytesIO(fp.read())

            # Create a PDF object
            pdf = pypdf.PdfReader(stream)

            # Get the number of pages in the PDF document
            num_pages = len(pdf.pages)

            docs = []

            # This block returns a whole PDF as a single Document
            if self.return_full_document:
                metadata = {"file_name": file.name}
                text = ""
                if extra_info is not None:
                    metadata.update(extra_info)

                # Join text extracted from each page
                for page in range(num_pages):
                    # Extract the text from the page
                    page_text = pdf.pages[page].extract_text()
                    text += page_text

                docs.append(Document(text=text, metadata=metadata))

            # This block returns each page of a PDF as its own Document
            else:
                # Iterate over every page

                for page in range(num_pages):
                    # Extract the text from the page
                    page_text = pdf.pages[page].extract_text()
                    page_label = pdf.page_labels[page]

                    metadata = {"page_label": page_label, "file_name": file.name, 'source': str(file.resolve())}
                    if extra_info is not None:
                        metadata.update(extra_info)

                    docs.append(Document(text=page_text, metadata=metadata))

            return docs