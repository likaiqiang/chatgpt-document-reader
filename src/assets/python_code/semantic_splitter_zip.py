import sys
import asyncio
import json
import signal
from argparse import ArgumentParser
from pathlib import Path

from utils import get_text_document, get_pdf_document, CODEReader, get_code_document
import socketio
from llama_index.core import SimpleDirectoryReader

sio = socketio.AsyncClient()


def signal_handler(sig, frame):
    print('Interrupt signal received, exiting...')
    sys.exit(0)


signal.signal(signal.SIGTERM, signal_handler)


async def connect_handler():
    input_files = SimpleDirectoryReader(
        input_dir=args.path,
        exclude_hidden=False
    ).input_files

    files = [str(file.resolve()) for file in input_files]
    result = []

    for file in files:
        if file.endswith(".txt"):
            result.extend(get_text_document(path=file, embedding_api_key=args.embedding_api_key,
                                            embedding_api_base=args.embedding_api_base))
        if file.endswith(".pdf"):
            result.extend(get_pdf_document(path=file, embedding_api_key=args.embedding_api_key,
                                           embedding_api_base=args.embedding_api_base))
        if CODEReader.is_supported(Path(file).suffix):
            result.extend(get_code_document(path=file, embedding_api_key=args.embedding_api_key,
                                            embedding_api_base=args.embedding_api_base))

    def ack_callback(response):
        print(response)
        asyncio.create_task(sio.disconnect())

    await sio.emit('split_zip_result', json.dumps(result), callback=ack_callback)


@sio.event
async def connect():
    await connect_handler()


async def main():
    parser = ArgumentParser()
    parser.add_argument("--path", required=True, help="path to zip")
    parser.add_argument("--embedding_api_key", required=True, help="embedding api key")
    parser.add_argument("--embedding_api_base", default="https://api.openai.com/v1", help="embedding api base")
    global args
    args = parser.parse_args()

    await sio.connect('http://127.0.0.1:7765')
    await sio.wait()


if __name__ == '__main__':
    asyncio.run(main())
