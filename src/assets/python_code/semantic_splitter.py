from typing import Callable, List, TypedDict
from argparse import ArgumentParser
import json

import numpy as np
from llama_index.core.node_parser import (
    SemanticSplitterNodeParser
)
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core import SimpleDirectoryReader
import jieba
from llama_index.core.bridge.pydantic import Field
import re


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


def split_by_sentence_tokenizer(text: str) -> list[str]:
    sentences = []
    start = 0
    words = jieba.tokenize(text, mode='search')
    for word, _, end in words:
        if text[end - 1] in '。！？. ,':  # 如果词语的最后一个字符是结束标点符号
            sentences.append(text[start:end])  # 提取当前句子
            start = end  # 更新下一个句子的起始位置
    return sentences

def build_node_chunks(sentences: List[str], distances: List[float], threshold_factor: float)-> List[str]:
    chunks = []
    if len(sentences) > 0:
        np_distances = np.array(distances)
        # 计算每个点的斜率
        slopes = np.diff(distances) / 1  # 这里假设每个点的间隔为1
        # 计算斜率变化的绝对值
        slope_changes_abs = np.abs(np.diff(slopes))
        # 计算斜率变化的方向
        slope_changes_sign = np.diff(slopes)
        # 计算连续斜率变化之间的乘积，以确定斜率是否发生了方向变化
        slope_product = slope_changes_sign[:-1] * slope_changes_sign[1:]

        # 找出斜率方向变化的位置（乘积为负）
        sign_changes = np.where(slope_product < 0)[0]

        slope_change_threshold = calculate_threshold(slope_changes_abs, threshold_factor)

        # 找出斜率变化显著且方向发生变化的索引
        significant_slope_changes = sign_changes[
            np.where(slope_changes_abs[sign_changes] > slope_change_threshold)[0]]

        # 斜率变化显著且方向发生变化的索引可能是潜在的语义断点
        potential_breakpoints = significant_slope_changes + 2  # 加2是因为np.diff减少了两个元素

        start_index = 0

        for index in potential_breakpoints:
            group = sentences[start_index: index]
            combined_text = "".join([d for d in group])
            chunks.append(combined_text)

            start_index = index

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


class CustomSentenceSplitter(SemanticSplitterNodeParser):
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
        self.threshold_factor = threshold_factor

    def _build_node_chunks(
            self, sentences: List[SentenceCombination], distances: List[float]
    ) -> List[str]:
        return build_node_chunks(
            [s['sentence'] for s in sentences],
            distances,
            self.threshold_factor
        )


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("--path", required=True, help="path to pdf")
    parser.add_argument("--openai_api_key", required=True, help="openai api key")
    parser.add_argument("--openai_api_base", default="https://api.openai.com/v1", help="openai api base url")
    args = parser.parse_args()

    documents = SimpleDirectoryReader(input_files=[args.path]).load_data()

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
    splitter = CustomSentenceSplitter(
        buffer_size=1,
        breakpoint_percentile_threshold=95,
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
