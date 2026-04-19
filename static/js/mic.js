export function startMicCapture(client) {
	return navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
		const ctx = new AudioContext({ sampleRate: 16000 });
		const source = ctx.createMediaStreamSource(stream);
		const processor = ctx.createScriptProcessor(4096, 1, 1);

		processor.onaudioprocess = (e) => {
			const float32 = e.inputBuffer.getChannelData(0);
			const int16 = new Int16Array(float32.length);
			for (let i = 0; i < float32.length; i++) {
				int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
			}
			const bytes = new Uint8Array(int16.buffer);
			let binary = '';
			for (let i = 0; i < bytes.length; i += 8192) {
				binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
			}
			client.sendAudio(btoa(binary));
		};

		source.connect(processor);
		processor.connect(ctx.destination);
		return { stream, ctx, processor };
	});
}
