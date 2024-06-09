import json
import os.path
from llama_index.core import SimpleDirectoryReader
from argparse import ArgumentParser

from llama_index.embeddings.openai import OpenAIEmbedding


from utils import split_by_sentence_tokenizer, get_current_directory, remove_space_between_english_and_chinese, \
    BaseSentenceSplitter, TXTReader


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument("--write_path",
                        default=f"{os.path.join(get_current_directory(), 'result', 'semantic_splitter_text.json')}",
                        help="path to write result")
    parser.add_argument("--path", required=True, help="path to text")
    args = parser.parse_args()

    documents = SimpleDirectoryReader(
        input_files=[args.path],
        file_extractor={
            ".txt": TXTReader()
        }
    ).load_data()

    for document in documents:
        document.text = remove_space_between_english_and_chinese(document.text)

    # 初始化嵌入模型
    embed_model = OpenAIEmbedding(
        api_key="sk-bJLXDQCmLs6F7Ojy707cF29b67F94e4eAaBc55A0E3915b9f",
        api_base="https://www.gptapi.us/v1",
    )
    splitter = BaseSentenceSplitter(
        buffer_size=1,
        embed_model=embed_model,
        sentence_splitter=split_by_sentence_tokenizer,
        threshold_factor=0.7
    )
    nodes = splitter.get_nodes_from_documents(documents)
    result = [{"page_content": content, "metadata": node.metadata} for node in nodes if
              (content := node.get_content().strip())]

    with open(args.write_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False)
