export class GeminiClient {
	constructor() {
		this.ws = null;
		this.playbackCtx = null;
		this.nextPlayTime = 0;
	}

	connect() {
		return new Promise((resolve, reject) => {
			const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
			this.ws = new WebSocket(`${proto}//${location.host}/ws`);
			this.playbackCtx = new AudioContext({ sampleRate: 24000 });

			this.ws.onmessage = (event) => {
				const msg = JSON.parse(event.data);
				if (msg.type === 'setupComplete') resolve();
				if (msg.type === 'audio') this._playAudio(msg.data);
				if (msg.type === 'turnComplete') this.nextPlayTime = 0;
			};
			this.ws.onerror = (e) => reject(e);
		});
	}

	sendAudio(base64PCM) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ audio: base64PCM }));
		}
	}

	_playAudio(b64) {
		const raw = atob(b64);
		const int16 = new Int16Array(raw.length / 2);
		for (let i = 0; i < int16.length; i++) {
			int16[i] = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
		}
		const float32 = new Float32Array(int16.length);
		for (let i = 0; i < int16.length; i++) {
			float32[i] = int16[i] / 32768;
		}
		const buffer = this.playbackCtx.createBuffer(1, float32.length, 24000);
		buffer.getChannelData(0).set(float32);
		const source = this.playbackCtx.createBufferSource();
		source.buffer = buffer;
		source.connect(this.playbackCtx.destination);
		const now = this.playbackCtx.currentTime;
		const startAt = Math.max(now, this.nextPlayTime);
		source.start(startAt);
		this.nextPlayTime = startAt + buffer.duration;
	}

	disconnect() {
		this.ws?.close();
	}
}
