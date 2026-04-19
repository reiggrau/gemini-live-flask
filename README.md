# Wilhelm's Virtual Observatory

A real-time voice-to-voice AI assistant set against an astronomically accurate starfield. Talk to **E-Will**, an astronomy-focused assistant powered by the **Gemini Live API**, while 100,000 real stars twinkle behind it — each one placed, colored, and sized from actual astronomical data.

## Stack

| Layer      | Technology                                                          |
| ---------- | ------------------------------------------------------------------- |
| Backend    | Flask, flask-sock, websockets (async)                               |
| Voice AI   | Gemini Live API (`gemini-3.1-flash-live-preview`) via raw WebSocket |
| Starfield  | Three.js with custom GLSL vertex/fragment shaders                   |
| Star data  | HYG Database v4.1 → Python script → binary → GPU                    |
| Config     | pydantic-settings (`.env`)                                          |
| Production | Gunicorn + gevent worker, deployed on Render                        |

### Architecture

```
Browser (mic/audio + Three.js) ←WebSocket→ Flask proxy ←WebSocket→ Gemini Live API
```

Flask acts as a bidirectional WebSocket proxy: the browser captures 16 kHz PCM audio from the microphone, base64-encodes it, and sends it to the Flask server, which forwards it to the Gemini Live API. Gemini streams 24 kHz PCM audio back through the same path for playback via the Web Audio API.

### Star Data Pipeline

The starfield uses the [HYG Database](https://github.com/astronexus/HYG-Database) (v4.1), a compilation of the Hipparcos, Yale, and Gliese catalogs containing ~120,000 stars.

1. **CSV → Binary** — A Python script (`static/star-data/cvs_to_json.py`) reads the CSV, selects the 100,000 brightest stars by visual magnitude, converts RA/Dec to 3D Cartesian coordinates, and computes color temperature from the B-V color index. The output is a compact binary file (5 × float32 per star: x, y, z, magnitude, kelvin).
2. **Binary → GPU** — `particles.js` fetches the `.bin` file, builds Three.js buffer geometry, and maps each star's Kelvin temperature to an RGB color and its magnitude to a point size (inverted log scale).
3. **GLSL shaders** — The vertex shader animates a per-star twinkle using a randomized sine phase. The fragment shader renders each point with a bright core (`exp(-36r²)`), a visible disc (`smoothstep`), and a soft halo, all with additive blending.

## Setup

Requires Python ≥ 3.12 and [uv](https://docs.astral.sh/uv/).

```bash
# Clone and enter the project
git clone <repo-url>
cd gemini-live-flask

# Create venv and install dependencies
uv sync

# Add your Gemini API key
echo "GEMINI_API_KEY=your-key-here" > .env
```

## Run

```bash
# Development (Windows/Mac/Linux)
uv run flask --app app run

# Production (Linux only — used by Render)
gunicorn -w 1 --worker-class gevent --timeout 120 --bind 0.0.0.0:$PORT app:app
```

Open [http://localhost:5000](http://localhost:5000), click **Connect**, and start talking.

## Star Data Source

Star coordinates, magnitudes, and color indices from the [HYG Database](https://github.com/astronexus/HYG-Database/tree/main) by David Nash.
