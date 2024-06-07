from argparse import ArgumentParser
from typing import List, TypedDict, Dict

from llama_index.core.base.embeddings.base import BaseEmbedding
from llama_index.core.bridge.pydantic import Field
from llama_index.embeddings.openai import OpenAIEmbedding
from utils import build_node_chunks
import ast
from semantic_splitter import PdfSentenceSplitter


class SentenceCombination(TypedDict):
    sentence: str
    index: int
    combined_sentence: str
    combined_sentence_embedding: List[float]


class CodeSplitter:
    path: str = Field(
        description="code file path"
    )
    # embed_model: BaseEmbedding = Field(
    #     description="The embedding model to use to for semantic comparison",
    # )
    #
    # buffer_size: int = Field(
    #     default=1,
    #     description=(
    #         "The number of sentences to group together when evaluating semantic similarity. "
    #         "Set to 1 to consider each sentence individually. "
    #         "Set to >1 to group sentences together."
    #     ),
    # )
    threshold_factor: float = Field(
        default=0.5,
        ge=0,
        le=1,
        description="A factor between 0 and 1 that scales the significance threshold for identifying potential "
                    "semantic breakpoints. A lower value results in a more sensitive breakpoint detection, "
                    "while a higher value requires more significant changes in slope to identify a breakpoint."
    )

    def __init__(self, path: str, embed_model: BaseEmbedding, threshold_factor: float, buffer_size: int = 1):
        self.path = path
        self.threshold_factor = threshold_factor
        self.embed_model = embed_model
        self.buffer_size = buffer_size

    def parse_and_decompose_code(self, path: str) -> List[str]:
        with open(path, "r", encoding='utf-8') as f:
            code = f.read()
            parsed_code = ast.parse(code.strip())
            return [ast.unparse(node) for node in parsed_code.body]

    def _build_sentence_groups(
            self, texts: List[str]
    ) -> list[SentenceCombination]:
        sentences: List[SentenceCombination] = [
            {
                "sentence": x,
                "index": i,
                "combined_sentence": "",
                "combined_sentence_embedding": [],
            }
            for i, x in enumerate(texts)
        ]

        # Group sentences and calculate embeddings for sentence groups
        for i in range(len(sentences)):
            combined_sentence = ""

            for j in range(i - self.buffer_size, i):
                if j >= 0:
                    combined_sentence += sentences[j]["sentence"]

            combined_sentence += sentences[i]["sentence"]

            for j in range(i + 1, i + 1 + self.buffer_size):
                if j < len(sentences):
                    combined_sentence += sentences[j]["sentence"]

            sentences[i]["combined_sentence"] = combined_sentence

        return sentences

    def _calculate_distances_between_sentence_groups(
            self, embedding_list: List[float]
    ) -> List[float]:
        distances = []
        for i in range(len(embedding_list) - 1):
            embedding_current = embedding_list[i]
            embedding_next = embedding_list[i + 1]

            similarity = self.embed_model.similarity(embedding_current, embedding_next)

            distance = 1 - similarity

            distances.append(distance)

        return distances

    def get_nodes_from_documents(
            self,
    ) -> List[str]:
        split_codes = self.parse_and_decompose_code(self.path)
        splitter = PdfSentenceSplitter(
            buffer_size=self.buffer_size,
            embed_model=self.embed_model,
            threshold_factor=self.threshold_factor
        )
        return splitter.semantic_sentence_combination(split_codes)


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("--path", required=True, help="path to file")
    parser.add_argument("--openai_api_key", required=True, help="openai api key")
    parser.add_argument("--openai_api_base", default="https://api.openai.com/v1", help="openai api base url")
    args = parser.parse_args()

    embed_model = OpenAIEmbedding(
        # api_key="sk-1hAH06nVTFvJgHSpE34d2222E9524b808eCbAc9bBc8bD178",
        # api_base="https://www.gptapi.us/v1"
        api_key=args.openai_api_key,
        api_base=args.openai_api_base
    )

    splitter = CodeSplitter(path=args.path, embed_model=embed_model, threshold_factor=0.8, buffer_size=1)

    nodes = splitter.get_nodes_from_documents()
    for node in nodes:
        print(node)
