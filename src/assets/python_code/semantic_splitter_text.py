import sys

import asyncio
import json
import signal
from argparse import ArgumentParser

from utils import get_text_document
import socketio

sio = socketio.AsyncClient()


def signal_handler(sig, frame):
    print('Interrupt signal received, exiting...')
    sys.exit(0)


signal.signal(signal.SIGTERM, signal_handler)


async def connect_handler():
    result = get_text_document(args.path)

    def ack_callback(response):
        print(response)
        asyncio.create_task(sio.disconnect())

    await sio.emit('split_text_result', json.dumps(result), callback=ack_callback)


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
