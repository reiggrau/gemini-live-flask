# app.py
import json
import time
import asyncio
import websockets
from flask import Flask, render_template
from flask_sock import Sock
from config import Settings

settings = Settings()
app = Flask(__name__)
sock = Sock(app)

MODEL = "gemini-3.1-flash-live-preview"
GEMINI_WS_URL = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
    f"?key={settings.GEMINI_API_KEY}"
)

# Pricing per minute (paid tier) — free tier is $0
AUDIO_INPUT_COST_PER_MIN = 0.005   # $/min
AUDIO_OUTPUT_COST_PER_MIN = 0.018  # $/min


@app.route("/")
def index():
    return render_template("index.html")


@sock.route("/ws")
def gemini_proxy(ws):
    """Bidirectional proxy: Browser ↔ Flask ↔ Gemini Live API."""
    print("[proxy] Browser connected")
    start_time = time.time()
    audio_in_chunks = 0   # each chunk = 4096 samples at 16kHz = 0.256s
    audio_out_bytes = 0   # 24kHz 16-bit mono = 48000 bytes/s
    loop = asyncio.new_event_loop()

    async def run_proxy():
        nonlocal audio_in_chunks, audio_out_bytes
        print("[proxy] Connecting to Gemini...")
        async with websockets.connect(GEMINI_WS_URL) as gemini:
            print("[proxy] Gemini WS connected, sending setup...")
            # 1. Send setup to Gemini (raw WS uses "setup", not "config")
            await gemini.send(json.dumps({
                "setup": {
                    "model": f"models/{MODEL}",
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                    },
                    "systemInstruction": {
                        "parts": [{"text": """You are E-Will, the helpful male-voice 
                                   assistant of the Wilhelm's Virtual Observatory.

                                   Behind you is a beautiful starry sky
                                   constructed using real life astronomical data,
                                   displaying each star accurately both in position, 
                                   brightness and color.
                                   
                                   Your purpose is to answer 
                                   questions about the stars, planets, and other 
                                   celestial objects visible in the sky, but
                                   also any other questions the user may have, as you
                                   are an educational assistant.

                                   Always maintain a friendly and engaging tone, and 
                                   feel free to include fun facts about astronomy in
                                   your responses!

                                   You can also explain how the app is built, which is
                                   a Flask server acting as a proxy between the browser 
                                   and the Gemini Live API, handling real-time audio 
                                   streaming in both directionsm while the starry sky 
                                   is rendered in the browser using Three.js and 
                                   custom-built glsl shaders.

                                   The app is in early preview stage, so there may be some
                                   bugs and rough edges, but it's a fun demo of Gemini's 
                                   real-time capabilities.
                                   
                                   Your creator is Reig Grau, a passionate AI engineer, 
                                   and astronomy enthusiast.
                                   """
                                   }]
                    },
                }
            }))

            # 2. Wait for setupComplete
            print("[proxy] Waiting for setupComplete...")
            setup_raw = await gemini.recv()
            print(f"[proxy] Got from Gemini: {setup_raw[:200]}")
            setup = json.loads(setup_raw)
            if "setupComplete" not in setup:
                print(f"[proxy] Setup failed! Response: {setup}")
                ws.send(json.dumps(
                    {"type": "error", "message": "Setup failed"}))
                return
            print("[proxy] Setup complete, notifying browser")
            ws.send(json.dumps({"type": "setupComplete"}))

            # 3. Bidirectional proxy with concurrent tasks
            stop = asyncio.Event()

            async def browser_to_gemini():
                nonlocal audio_in_chunks
                while not stop.is_set():
                    try:
                        raw = await loop.run_in_executor(None, ws.receive)
                        if raw is None:
                            break
                        msg = json.loads(raw)
                        if "audio" in msg:
                            audio_in_chunks += 1
                            await gemini.send(json.dumps({
                                "realtimeInput": {
                                    "audio": {
                                        "data": msg["audio"],
                                        "mimeType": "audio/pcm;rate=16000",
                                    }
                                }
                            }))
                    except Exception:
                        break
                stop.set()

            async def gemini_to_browser():
                nonlocal audio_out_bytes
                try:
                    async for message in gemini:
                        if stop.is_set():
                            break
                        data = json.loads(message)

                        # Forward audio chunks
                        parts = (data.get("serverContent", {})
                                     .get("modelTurn", {})
                                     .get("parts", []))
                        for part in parts:
                            if "inlineData" in part:
                                b64_data = part["inlineData"]["data"]
                                # base64 decodes to ~75% of string length
                                audio_out_bytes += len(b64_data) * 3 // 4
                                ws.send(json.dumps({
                                    "type": "audio",
                                    "data": b64_data,
                                }))

                        # Turn complete
                        if data.get("serverContent", {}).get("turnComplete"):
                            ws.send(json.dumps({"type": "turnComplete"}))

                        # Tool calls — handled here in Python!
                        if "toolCall" in data:
                            responses = handle_tool_calls(data["toolCall"])
                            await gemini.send(json.dumps({
                                "toolResponse": {
                                    "functionResponses": responses
                                }
                            }))
                except Exception:
                    pass
                stop.set()

            await asyncio.gather(browser_to_gemini(), gemini_to_browser())

    try:
        loop.run_until_complete(run_proxy())
    finally:
        loop.close()
        duration = time.time() - start_time
        # Audio input: 4096 samples / 16000 Hz = 0.256s per chunk
        audio_in_min = (audio_in_chunks * 0.256) / 60
        # Audio output: 24kHz 16-bit mono = 48000 bytes/s
        audio_out_min = (audio_out_bytes / 48000) / 60
        input_cost = audio_in_min * AUDIO_INPUT_COST_PER_MIN
        output_cost = audio_out_min * AUDIO_OUTPUT_COST_PER_MIN
        total_cost = input_cost + output_cost
        print(f"\n{'='*50}")
        print(f"[cost] Session ended — duration: {duration:.1f}s")
        print(
            f"[cost] Audio input:  {audio_in_min:.2f} min  (${input_cost:.5f})")
        print(
            f"[cost] Audio output: {audio_out_min:.2f} min  (${output_cost:.5f})")
        print(f"[cost] Total estimated cost: ${total_cost:.5f}")
        print(f"[cost] (Free tier: $0.00)")
        print(f"{'='*50}\n")


def handle_tool_calls(tool_call):
    """Process Gemini tool calls server-side."""
    responses = []
    for fc in tool_call.get("functionCalls", []):
        # Add tool implementations here
        result = {"error": f"Unknown function: {fc['name']}"}
        responses.append({
            "name": fc["name"],
            "id": fc["id"],
            "response": {"result": result},
        })
    return responses
