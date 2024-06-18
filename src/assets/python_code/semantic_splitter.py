import json
import os.path
from pdfReader import Reader
from typing import TypedDict
from argparse import ArgumentParser

from llama_index.core import SimpleDirectoryReader

from typing import List

from llama_index.embeddings.openai import OpenAIEmbedding
from utils import get_current_directory, split_by_sentence_tokenizer, BaseSentenceSplitter, remove_space_between_english_and_chinese


class SentenceCombination(TypedDict):
    sentence: str
    index: int
    combined_sentence: str
    combined_sentence_embedding: List[float]




if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("--write_path", default=f"{os.path.join(get_current_directory(),'result','semantic_splitter.json')}", help="path to write result")
    parser.add_argument("--path", required=True, help="path to pdf")
    args = parser.parse_args()

    documents = SimpleDirectoryReader(
        input_files=[args.path],
        file_extractor={
            ".pdf": Reader(return_full_document=True)
        }
    ).load_data()
    processed_documents = []
    for document in documents:
        if document.text.strip():
            document.text = remove_space_between_english_and_chinese(document.text)
            processed_documents.append(document)

    # 初始化嵌入模型
    embed_model = OpenAIEmbedding(
        # api_key="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"
        api_key="sk-bJLXDQCmLs6F7Ojy707cF29b67F94e4eAaBc55A0E3915b9f",
        api_base="https://www.gptapi.us/v1"
    )

    # 初始化语义分块器
    splitter = BaseSentenceSplitter(
        buffer_size=1,
        embed_model=embed_model,
        sentence_splitter=split_by_sentence_tokenizer,
        breakpoint_percentile_threshold=80
    )
    nodes = splitter.get_nodes_from_documents(processed_documents)
    result = [{"pageContent": content, "metadata": node.metadata} for node in nodes if (content := node.get_content().strip())]

    with open(args.write_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=4)
    # print(result)


