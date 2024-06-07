import json
from typing import TypedDict, Sequence
from argparse import ArgumentParser

from llama_index.core.node_parser import (
    SemanticSplitterNodeParser
)

from llama_index.core.node_parser.node_utils import (
    build_nodes_from_splits
)

from llama_index.core import SimpleDirectoryReader
import jieba
from llama_index.core.bridge.pydantic import Field
import re

from typing import Any, Dict, List, Optional

from llama_index.core.schema import Document, BaseNode
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.readers.file import PDFReader

from utils import build_node_chunks

def remove_space_between_english_and_chinese(text):
    """
    去除一段话中英文与中文之间的单个空格，不包括包含换行符的情况。

    :param text: 输入的文本字符串
    :return: 去除空格后的文本字符串
    """
    # 匹配中文字符
    chinese_chars = r'[\u4e00-\u9fff]'
    # 匹配英文字符
    english_chars = r'[a-zA-Z]'

    # 匹配模式：中文 + 单个空格 + 英文 或 英文 + 单个空格 + 中文
    pattern = re.compile(f'({chinese_chars}) (\\w)|({english_chars}) ({chinese_chars})')

    # 去除空格：将匹配到的模式中的空格去除
    result = pattern.sub(
        lambda match: match.group(1) + match.group(2) if match.group(1) else match.group(3) + match.group(4), text)

    return result


def split_by_sentence_tokenizer(text: str) -> list[str]:
    sentences = []
    start = 0
    words = jieba.tokenize(text, mode='search')
    for word, _, end in words:
        if text[end - 1] in '。！？. ,':  # 如果词语的最后一个字符是结束标点符号
            sentences.append(text[start:end])  # 提取当前句子
            start = end  # 更新下一个句子的起始位置
    return sentences


class SentenceCombination(TypedDict):
    sentence: str
    index: int
    combined_sentence: str
    combined_sentence_embedding: List[float]


class PdfSentenceSplitter(SemanticSplitterNodeParser):
    threshold_factor: float = Field(
        default=0.5,
        ge=0,
        le=1,
        description="A factor between 0 and 1 that scales the significance threshold for identifying potential "
                    "semantic breakpoints. A lower value results in a more sensitive breakpoint detection, "
                    "while a higher value requires more significant changes in slope to identify a breakpoint."
    )

    def __init__(self, threshold_factor: float = 0.5, **kwargs):
        super().__init__(**kwargs)
        self.breakpoint_percentile_threshold = 0
        self.threshold_factor = threshold_factor

    def _build_node_chunks(
            self, sentences: List[SentenceCombination], distances: List[float]
    ) -> List[str]:
        return build_node_chunks(
            [s['sentence'] for s in sentences],
            distances,
            self.threshold_factor
        )

    def semantic_sentence_combination(self, texts: List[str]) -> List[str]:
        sentences = self._build_sentence_groups(texts)

        combined_sentence_embeddings = self.embed_model.get_text_embedding_batch(
            [s["combined_sentence"] for s in sentences],
            show_progress=False,
        )

        for i, embedding in enumerate(combined_sentence_embeddings):
            sentences[i]["combined_sentence_embedding"] = embedding

        distances = self._calculate_distances_between_sentence_groups(sentences)

        chunks = self._build_node_chunks(sentences, distances)
        return chunks

    def build_semantic_nodes_from_documents(
        self,
        documents: Sequence[Document],
        show_progress: bool = False,
    ) -> List[BaseNode]:
        """Build window nodes from documents."""
        all_nodes: List[BaseNode] = []
        for doc in documents:
            text = doc.text
            text_splits = self.sentence_splitter(text)

            chunks = self.semantic_sentence_combination(text_splits)

            nodes = build_nodes_from_splits(
                chunks,
                doc,
                id_func=self.id_func,
            )

            all_nodes.extend(nodes)

        return all_nodes


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("--path", required=True, help="path to pdf")
    parser.add_argument("--openai_api_key", required=True, help="openai api key")
    parser.add_argument("--openai_api_base", default="https://api.openai.com/v1", help="openai api base url")
    args = parser.parse_args()

    documents = SimpleDirectoryReader(
        input_files=[args.path],
        file_extractor={
            ".pdf": PDFReader(return_full_document=False)
        }
    ).load_data()

    print(documents[0:10])

    for document in documents:
        document.text = remove_space_between_english_and_chinese(document.text)

    # 初始化嵌入模型
    embed_model = OpenAIEmbedding(
        # api_key="sk-1hAH06nVTFvJgHSpE34d2222E9524b808eCbAc9bBc8bD178",
        # api_base="https://www.gptapi.us/v1"
        api_key=args.openai_api_key,
        api_base=args.openai_api_base
    )

    # 初始化语义分块器
    splitter = PdfSentenceSplitter(
        buffer_size=1,
        embed_model=embed_model,
        sentence_splitter=split_by_sentence_tokenizer,
        threshold_factor=0.7
    )

    nodes = splitter.get_nodes_from_documents(documents)
    print(
        json.dumps(
            [{"page_content": content, "metadata": node.metadata} for node in nodes if (content := node.get_content().strip())]
        )
    )
    # 结果写入文件
