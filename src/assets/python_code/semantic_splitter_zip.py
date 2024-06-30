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


@sio.event
def connect():
    parser = ArgumentParser()
    parser.add_argument("--path", required=True, help="path to text")
    args = parser.parse_args()

    input_files = SimpleDirectoryReader(
        input_dir=args.path,
    ).input_files

    files = [str(file.resolve()) for file in input_files]
    result = []

    for file in files:
        if file.endswith(".txt"):
            result.extend(get_text_document(file))
        if file.endswith(".pdf"):
            result.extend(get_pdf_document(file))
        if CODEReader.is_supported(Path(file).suffix):
            result.extend(get_code_document(file))

    def ack_callback(response):
        print(response)
        asyncio.create_task(sio.disconnect())

    sio.emit('split_zip_result', json.dumps(result), callback=ack_callback)


async def main():
    await sio.connect('http://127.0.0.1:7765')
    await sio.wait()


if __name__ == '__main__':
    asyncio.run(main())
