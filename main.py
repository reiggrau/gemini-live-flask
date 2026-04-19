import json
import asyncio
import websockets
from config import Settings

settings = Settings()

MODEL_NAME = "gemini-3.1-flash-live-preview"
WS_URL = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={settings.GEMINI_API_KEY}"


async def connect_and_configure():
    async with websockets.connect(WS_URL) as websocket:
        print("1. WebSocket Connected")

        # 1. Send the initial configuration
        config_message = {
            "config": {
                "model": f"models/{MODEL_NAME}",
                "responseModalities": ["AUDIO"],
                "systemInstruction": {
                    "parts": [{"text": "You are a helpful assistant."}]
                }
            }
        }
        await websocket.send(json.dumps(config_message))
        print("2. Configuration Sent")

        # Keep the session alive for further interactions
        await asyncio.sleep(3600)  # Example: keep open for an hour


async def main():
    await connect_and_configure()

if __name__ == "__main__":
    asyncio.run(main())
