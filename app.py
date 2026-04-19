import datetime
from flask import Flask, render_template, jsonify
from google import genai
from config import Settings

settings = Settings()
app = Flask(__name__)

client = genai.Client(
    api_key=settings.GEMINI_API_KEY,
    http_options={"api_version": "v1alpha"}
)


@app.route("/")
def hello_world():
    return render_template("index.html")


@app.route("/api/token", methods=["POST"])
def create_token():
    now = datetime.datetime.now(tz=datetime.timezone.utc)
    token = client.auth_tokens.create(
        config={
            "uses": 1,
            "expire_time": now + datetime.timedelta(minutes=30),
            "new_session_expire_time": now + datetime.timedelta(minutes=2),
            "http_options": {"api_version": "v1alpha"},
        }
    )
    return jsonify({"token": token.name})
