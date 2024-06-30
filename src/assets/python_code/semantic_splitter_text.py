import sys

import asyncio
import json
import signal
from argparse import ArgumentParser

from utils import  get_text_document
import socketio

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

    result = get_text_document(args.path)

    def ack_callback(response):
        print(response)
        asyncio.create_task(sio.disconnect())

    sio.emit('split_text_result', json.dumps(result), callback=ack_callback)


async def main():
    await sio.connect('http://127.0.0.1:7765')
    await sio.wait()


if __name__ == '__main__':
    asyncio.run(main())
