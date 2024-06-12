import json
import os
from argparse import ArgumentParser
from llama_index.core import SimpleDirectoryReader
from typing import List, TypedDict, Dict, Optional

from llama_index.embeddings.openai import OpenAIEmbedding

from semantic_splitter import BaseSentenceSplitter
from utils import get_current_directory, CODEReader


class SentenceCombination(TypedDict):
    sentence: str
    index: int
    combined_sentence: str
    combined_sentence_embedding: List[float]


def split_by_ast(text: str, metadata: Optional[Dict]):
    suffix = metadata.get("suffix")
    return CODEReader.extract_top_level_nodes(source_code=text, suffix=suffix)


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("--write_path",
                        default=f"{os.path.join(get_current_directory(), 'result', 'semantic_splitter_code.json')}",
                        help="path to write result")
    parser.add_argument("--path", required=True, help="path to file")
    args = parser.parse_args()

    documents = SimpleDirectoryReader(
        input_files=[args.path],
        file_extractor={
            ".py": CODEReader(),
            ".php": CODEReader(),
            ".js": CODEReader(),
            ".ts": CODEReader(),
            ".go": CODEReader(),
            ".cpp": CODEReader(),
            ".java": CODEReader(),
            ".rb": CODEReader(),
            ".cs": CODEReader(),
        }
    ).load_data()

    embed_model = OpenAIEmbedding(
        api_key="sk-bJLXDQCmLs6F7Ojy707cF29b67F94e4eAaBc55A0E3915b9f",
        api_base="https://www.gptapi.us/v1"
    )

    # 初始化语义分块器
    splitter = BaseSentenceSplitter(
        buffer_size=1,
        embed_model=embed_model,
        sentence_splitter=split_by_ast,
        breakpoint_percentile_threshold=80
    )

    nodes = splitter.get_nodes_from_documents(documents)
    result = [{"page_content": content, "metadata": node.metadata} for node in nodes if
              (content := node.get_content().strip())]
    with open(args.write_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False)
