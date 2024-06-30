import sys

import json
import asyncio
import signal
from argparse import ArgumentParser
from llama_index.core import SimpleDirectoryReader
from typing import List, TypedDict, Dict, Optional

from llama_index.embeddings.openai import OpenAIEmbedding

from semantic_splitter import BaseSentenceSplitter
from utils import CODEReader, get_code_document
import socketio
from pathlib import Path

sio = socketio.AsyncClient()


def signal_handler(sig, frame):
    print('Interrupt signal received, exiting...')
    sys.exit(0)


signal.signal(signal.SIGTERM, signal_handler)


class SentenceCombination(TypedDict):
    sentence: str
    index: int
    combined_sentence: str
    combined_sentence_embedding: List[float]




@sio.event
def connect():
    parser = ArgumentParser()
    parser.add_argument("--path", required=True, help="path to file")
    args = parser.parse_args()

    result = get_code_document(args.path)

    def ack_callback(response):
        print(response)
        asyncio.create_task(sio.disconnect())

    sio.emit('split_code_result', json.dumps(result), callback=ack_callback)


async def main():
    await sio.connect('http://127.0.0.1:7765')
    await sio.wait()


if __name__ == '__main__':
    asyncio.run(main())
