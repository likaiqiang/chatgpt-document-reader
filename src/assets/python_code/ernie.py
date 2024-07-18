import asyncio
from erniebot_agent.chat_models import ERNIEBot
from erniebot_agent.memory import HumanMessage, SystemMessage
import socketio
from argparse import ArgumentParser
import signal
import sys

sio = socketio.AsyncClient()

def signal_handler(sig, frame):
    print('Interrupt signal received, exiting...')
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)


@sio.event
async def connect():
    parser = ArgumentParser()
    parser.add_argument("--prompt", required=True, help="prompt")
    args = parser.parse_args()
    model = ERNIEBot(model="ernie-speed-128k", access_token="8c0c6d5d01c16888a6f9a37021dc438d12174e53")
    human_message = HumanMessage(
        content=args.prompt
    )
    ai_message = await model.chat(messages=[human_message])

    def ack_callback(response):
        print(response)
        asyncio.create_task(sio.disconnect())

    await sio.emit('llm_response', ai_message.content, callback=ack_callback)


async def main():
    await sio.connect('http://127.0.0.1:7765')
    await sio.wait()


if __name__ == '__main__':
    asyncio.run(main())
