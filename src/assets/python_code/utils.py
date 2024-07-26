import math

import httpx
import re
from fsspec import AbstractFileSystem
from pathlib import Path
from llama_index.core.bridge.pydantic import Field
import numpy as np

from llama_index.core.node_parser import (
    SemanticSplitterNodeParser
)

from llama_index.core.node_parser.node_utils import (
    build_nodes_from_splits
)

from typing import Any, Dict, List, Optional, Callable
from typing import TypedDict, Sequence
from llama_index.core.schema import Document, BaseNode
from concurrent.futures import ThreadPoolExecutor
from llama_index.core.readers.base import BaseReader
from llama_index.core.readers.file.base import get_default_fs, is_default_fs
from llama_index.core.schema import Document

from typing import List

import tree_sitter_python as tspython
import tree_sitter_php as tsphp
import tree_sitter_javascript as tsjavascript
import tree_sitter_typescript as tstypescript
import tree_sitter_go as tsgo
import tree_sitter_cpp as tscpp
import tree_sitter_java as tsjava
import tree_sitter_ruby as tsruby
import tree_sitter_c_sharp as tscs
from tree_sitter import Language, Parser
import tiktoken
from llama_index.core import SimpleDirectoryReader
from pdfReader import Reader
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core.utils import get_tqdm_iterable


def split_by_sentence_tokenizer(text: str, metadata: Optional[Dict]) -> list[str]:
    # 使用正则表达式拆分文本
    sentences = re.split('(?<=[.。?？!！])\\s+', text)
    merged_sentences = []
    current_sentence = ''

    for sentence in sentences:
        if len(current_sentence + sentence) < 50:
            current_sentence += sentence
        else:
            merged_sentences.append(current_sentence + sentence)
            current_sentence = ''

    # 确保最后一个句子也被添加
    if current_sentence:
        merged_sentences.append(current_sentence)

    return merged_sentences


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


def get_current_directory():
    current_file_path = Path(__file__).resolve()
    current_directory = current_file_path.parent
    return current_directory


def calculate_threshold(slope_changes, factor):
    """
    根据给定的因子计算阈值。

    :param slope_changes: 斜率变化量的数组
    :param factor: 0到1之间的值，用于调节阈值的大小
    :return: 计算出的阈值
    """
    mean_change = np.mean(slope_changes)
    std_change = np.std(slope_changes)
    threshold = mean_change + factor * std_change
    return threshold


def build_node_chunks(sentences: List[str], distances: List[float], breakpoint_percentile_threshold) -> List[str]:
    chunks = []
    if len(distances) > 0:
        breakpoint_distance_threshold = np.percentile(
            distances, breakpoint_percentile_threshold
        )

        indices_above_threshold = [
            i for i, x in enumerate(distances) if x > breakpoint_distance_threshold
        ]

        # Chunk sentences into semantic groups based on percentile breakpoints
        start_index = 0

        for index in indices_above_threshold:
            group = sentences[start_index: index + 1]
            combined_text = "".join([d for d in group])
            chunks.append(combined_text)

            start_index = index + 1

        if start_index < len(sentences):
            combined_text = "".join(
                [d for d in sentences[start_index:]]
            )
            chunks.append(combined_text)
    else:
        # If, for some reason we didn't get any distances (i.e. very, very small documents) just
        # treat the whole document as a single node
        chunks = [" ".join([s for s in sentences])]

    return chunks


class SentenceCombination(TypedDict):
    sentence: str
    index: int
    combined_sentence: str
    combined_sentence_embedding: List[float]


class BaseSentenceSplitter(SemanticSplitterNodeParser):
    sentence_splitter: Callable[[str, Optional[Dict]], List[str]] = Field(
        description="The text splitter to use when splitting documents.",
        exclude=True,
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # self.sentence_splitter = sentence_splitter

    def _get_batch(self, texts: List[str]) -> List[List[str]]:
        enc = tiktoken.encoding_for_model('text-embedding-ada-002')
        cur_chunk: List[str] = []
        cur_chunk_count = 0
        batches: List[List[str]] = []
        for text in texts:
            tokens = enc.encode(text)
            token_count = len(tokens)
            if token_count + cur_chunk_count > 8191:
                batches.append(cur_chunk)
                cur_chunk_count = token_count
                cur_chunk = [text]
            else:
                cur_chunk_count += token_count
                cur_chunk.append(text)
        if len(cur_chunk) > 0:
            batches.append(cur_chunk)
        return batches

    def _build_node_chunks(
            self, sentences: List[SentenceCombination], distances: List[float]
    ) -> List[str]:
        return build_node_chunks(
            [s['sentence'] for s in sentences],
            distances,
            self.breakpoint_percentile_threshold
        )

    def semantic_sentence_combination(self, texts: List[str]) -> List[str]:
        sentences = self._build_sentence_groups(texts)

        batches = self._get_batch([s["combined_sentence"] for s in sentences])
        combined_sentence_embeddings = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            embeddings = list(executor.map(lambda batch: self.embed_model.get_text_embedding_batch(batch), batches))
            for batch in embeddings:
                for embedding in batch:
                    combined_sentence_embeddings.append(embedding)

        for i, embedding in enumerate(combined_sentence_embeddings):
            sentences[i]["combined_sentence_embedding"] = embedding

        distances = self._calculate_distances_between_sentence_groups(sentences)

        chunks = self._build_node_chunks(sentences, distances)
        return chunks

    def _parse_nodes(
            self,
            nodes: Sequence[BaseNode],
            show_progress: bool = False,
            **kwargs: Any,
    ) -> List[BaseNode]:
        """Parse document into nodes."""
        all_nodes: List[BaseNode] = []
        nodes_with_progress = get_tqdm_iterable(nodes, show_progress, "Parsing nodes")

        def process_node(node):
            return self.build_semantic_nodes_from_document(node, show_progress)

        with ThreadPoolExecutor(max_workers=5) as executor:
            # Use executor.map to process nodes concurrently
            results = list(executor.map(process_node, nodes_with_progress))

            # Flatten the results and extend all_nodes
            for nodes in results:
                all_nodes.extend(nodes)

        return all_nodes

    def build_semantic_nodes_from_document(
            self,
            document: Document,
            show_progress: bool = False,
    ) -> List[BaseNode]:
        """Build window nodes from documents."""
        text = document.text
        text_splits = self.sentence_splitter(text, document.metadata)

        chunks = self.semantic_sentence_combination(text_splits)
        nodes = build_nodes_from_splits(
            chunks,
            document,
            id_func=self.id_func,
        )

        return nodes


class TXTReader(BaseReader):
    def load_data(
            self,
            file: Path,
            extra_info: Optional[Dict] = None,
            fs: Optional[AbstractFileSystem] = None,
    ) -> List[Document]:
        """Parse file."""
        if not isinstance(file, Path):
            file = Path(file)

        fs = fs or get_default_fs()
        with fs.open(file, "r", encoding='utf-8') as fp:
            # Read the entire file content
            content = fp.read()

            # Create metadata dictionary
            metadata = {"file_name": file.name, "source": str(file.resolve())}
            if extra_info is not None:
                metadata.update(extra_info)

            # Create a single Document with the entire file content
            doc = Document(text=content, metadata=metadata)

            return [doc]


class CODEReader(BaseReader):
    @staticmethod
    def is_supported(suffix: str) -> bool:
        return suffix in ['.py', '.php', '.js', '.ts', '.go', '.cpp', '.java', '.rb', '.cs']

    @staticmethod
    def get_parser(suffix: str):
        if suffix is None:
            return None
        parser_dict = {
            '.py': Language(tspython.language()),
            '.php': Language(tsphp.language_php()),
            '.js': Language(tsjavascript.language()),
            '.ts': Language(tstypescript.language_typescript()),
            '.go': Language(tsgo.language()),
            '.cpp': Language(tscpp.language()),
            '.java': Language(tsjava.language()),
            '.rb': Language(tsruby.language()),
            '.cs': Language(tscs.language())
        }
        if not suffix.startswith('.'):
            suffix = '.' + suffix
        language = parser_dict[suffix]
        if language is None:
            return None
        parser = Parser()
        parser.set_language(language)
        return parser

    @staticmethod
    def extract_top_level_nodes(source_code, suffix):
        parser = CODEReader.get_parser(suffix)
        if parser is not None:
            tree = parser.parse(bytes(source_code, 'utf8'))
            root_node = tree.root_node
            top_level_nodes = []

            # 遍历根节点的直接子节点
            for child in root_node.children:
                # 提取每个顶层节点的文本内容
                start_byte = child.start_byte
                end_byte = child.end_byte
                node_text = source_code[start_byte:end_byte]
                top_level_nodes.append(node_text)

            return top_level_nodes
        return []

    @staticmethod
    def split_by_ast(source_code, suffix):
        parser = CODEReader.get_parser(suffix)
        if parser is not None:
            tree = parser.parse(bytes(source_code, 'utf8'))
            root_node = tree.root_node
            top_level_nodes = []

        return []

    def load_data(
            self,
            file: Path,
            extra_info: Optional[Dict] = None,
            fs: Optional[AbstractFileSystem] = None,
    ) -> List[Document]:
        """Parse file."""
        if not isinstance(file, Path):
            file = Path(file)

        fs = fs or get_default_fs()
        with fs.open(file, "r", encoding='utf-8') as fp:
            # Read the entire file content
            content = fp.read()

            # Create metadata dictionary
            metadata = {"file_name": file.name, "suffix": file.suffix.lower(), "source": str(file.resolve())}
            if extra_info is not None:
                metadata.update(extra_info)

            # Create a single Document with the entire file content
            doc = Document(text=content, metadata=metadata)

            return [doc]

    @staticmethod
    def split_code_by_token(code: str, suffix) -> List[str]:
        max_tokens = 8191
        # models = {
        #     'text-embedding-3-large': 8191,
        #     'text-embedding-ada-002': 8191,
        #     'text-embedding-3-small': 8191
        # }
        enc = tiktoken.encoding_for_model('text-embedding-ada-002')
        tokens = enc.encode(code)
        chunks = []
        start = 0
        parser = CODEReader.get_parser(suffix)
        if parser is not None:
            while start < len(tokens):
                end = start + max_tokens
                chunk_tokens = tokens[start:end]
                chunk_text = enc.decode(chunk_tokens)
                chunks.append(chunk_text)
                start = end

        return chunks


def get_pdf_document(path: str, embedding_api_key: str, embedding_api_base: str, proxy: str) -> List[Document]:
    input_files = None
    input_dir = None
    if Path(path).is_file():
        input_files = [path]
    if Path(path).is_dir():
        input_dir = path
    documents = SimpleDirectoryReader(
        exclude_hidden=False,
        recursive=True,
        input_files=input_files,
        input_dir=input_dir,
        file_extractor={
            ".pdf": Reader(return_full_document=True)
        },
        required_exts=['.pdf']
    ).load_data()
    if len(documents) == 0:
        return []
    processed_documents = []
    for document in documents:
        if document.text.strip():
            document.text = remove_space_between_english_and_chinese(document.text)
            processed_documents.append(document)

    # 初始化嵌入模型
    embed_model = OpenAIEmbedding(
        api_key=embedding_api_key,
        api_base=embedding_api_base,
        http_client=httpx.Client(proxies={"http://": proxy, "https://": proxy})
    )

    # 初始化语义分块器
    splitter = BaseSentenceSplitter(
        buffer_size=1,
        embed_model=embed_model,
        sentence_splitter=split_by_sentence_tokenizer,
        breakpoint_percentile_threshold=80
    )
    nodes = splitter.get_nodes_from_documents(processed_documents)
    result = [{"pageContent": content, "metadata": node.metadata} for node in nodes if
              (content := node.get_content().strip())]
    return result


def get_text_document(path: str, embedding_api_key: str, embedding_api_base: str, proxy: str) -> List[Document]:
    input_files = None
    input_dir = None
    if Path(path).is_file():
        input_files = [path]
    if Path(path).is_dir():
        input_dir = path

    documents = SimpleDirectoryReader(
        exclude_hidden=False,
        input_files=input_files,
        input_dir=input_dir,
        file_extractor={
            ".txt": TXTReader()
        },
        required_exts=['.txt']
    ).load_data()
    if len(documents) == 0:
        return []

    processed_documents = []
    for document in documents:
        if document.text.strip():
            document.text = remove_space_between_english_and_chinese(document.text)
            processed_documents.append(document)

    # 初始化嵌入模型
    embed_model = OpenAIEmbedding(
        api_key=embedding_api_key,
        api_base=embedding_api_base,
        http_client=httpx.Client(proxies={"http://": proxy, "https://": proxy})
    )
    splitter = BaseSentenceSplitter(
        buffer_size=1,
        embed_model=embed_model,
        sentence_splitter=split_by_sentence_tokenizer,
        breakpoint_percentile_threshold=80
    )
    nodes = splitter.get_nodes_from_documents(processed_documents)
    result = [{"pageContent": content, "metadata": node.metadata} for node in nodes if
              (content := node.get_content().strip())]
    return result


def split_by_ast(text: str, metadata: Optional[Dict]):
    suffix = metadata.get("suffix")
    return CODEReader.extract_top_level_nodes(source_code=text, suffix=suffix)


def get_code_document(path: str, embedding_api_key: str, embedding_api_base: str, proxy: str) -> List[Document]:
    input_files = None
    input_dir = None
    if Path(path).is_file():
        input_files = [path]
    if Path(path).is_dir():
        input_dir = path
    documents = SimpleDirectoryReader(
        exclude_hidden=False,
        recursive=True,
        input_files=input_files,
        input_dir=input_dir,
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
        },
        required_exts=['.py', '.php', '.js', '.ts', '.go', '.cpp', '.java', '.rb', '.cs']
    ).load_data()

    if len(documents) == 0:
        return []
    result = []
    for doc in documents:
        chunks = CODEReader.split_code_by_token(doc.get_content(), doc.metadata['suffix'])
        for chunk in chunks:
            result.append({
                "pageContent": chunk,
                "metadata": doc.metadata
            })
    return result
