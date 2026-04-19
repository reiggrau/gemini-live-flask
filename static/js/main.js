import { GeminiClient } from './gemini-client.js';
import { startMicCapture } from './mic.js';

const startBtn = document.getElementById('start-btn');
let client = null;
let mic = null;

startBtn.addEventListener('click', async () => {
	if (client) {
		// Stop conversation
		if (mic) {
			mic.stream.getTracks().forEach((t) => t.stop());
			mic.processor.disconnect();
			mic.ctx.close();
			mic = null;
		}
		client.disconnect();
		client = null;
		startBtn.textContent = 'Start Conversation';
		return;
	}

	startBtn.textContent = 'Connecting...';
	client = new GeminiClient();
	await client.connect();
	mic = await startMicCapture(client);
	startBtn.textContent = 'End Conversation';
});
