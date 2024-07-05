import sys

import json
import asyncio
import signal
from argparse import ArgumentParser
from typing import List, TypedDict

from utils import get_code_document
import socketio

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


async def connect_handler():
    result = get_code_document(args.path)

    def ack_callback(response):
        print(response)
        asyncio.create_task(sio.disconnect())

    await sio.emit('split_code_result', json.dumps(result), callback=ack_callback)


@sio.event
async def connect():
    await connect_handler()


async def main():
    parser = ArgumentParser()
    parser.add_argument("--path", required=True, help="path to pdf")
    global args
    args = parser.parse_args()

    await sio.connect('http://127.0.0.1:7765')
    await sio.wait()


if __name__ == '__main__':
    asyncio.run(main())
