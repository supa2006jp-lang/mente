import { pipeline, env } from './assets/vendor/transformers/3.8.1/transformers.web.min.js';

env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = new URL('assets/vendor/transformers/3.8.1/', self.location.href).href;

let transcriberPromise = null;

function getTranscriber() {
    if (!transcriberPromise) {
        transcriberPromise = pipeline(
            'automatic-speech-recognition',
            'onnx-community/whisper-tiny',
            {
                dtype: 'q8',
                progress_callback: progress => {
                    self.postMessage({ type: 'progress', progress });
                }
            }
        ).catch(error => {
            transcriberPromise = null;
            throw error;
        });
    }
    return transcriberPromise;
}

self.onmessage = async event => {
    const { requestId, audioBuffer } = event.data || {};
    if (!requestId || !audioBuffer) return;

    try {
        const transcriber = await getTranscriber();
        self.postMessage({ type: 'recognizing', requestId });
        const result = await transcriber(new Float32Array(audioBuffer), {
            language: 'japanese',
            task: 'transcribe'
        });
        self.postMessage({
            type: 'result',
            requestId,
            text: String(result?.text || '').trim()
        });
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId,
            message: String(error?.message || error || '音声を認識できませんでした。')
        });
    }
};
