/**
 * Audio utilities for Gemini Live API (PCM 16kHz)
 */

export class AudioHandler {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime: number = 0;

  constructor(private onAudioData: (base64Data: string) => void) {}

  async start() {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    
    // ScriptProcessor is deprecated but often easier for raw PCM in simple apps
    // than AudioWorklet for a quick build.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = this.floatTo16BitPCM(inputData);
      const base64Data = this.arrayBufferToBase64(pcmData);
      this.onAudioData(base64Data);
    };
    
    this.nextStartTime = this.audioContext.currentTime;
  }

  stop() {
    this.stream?.getTracks().forEach(track => track.stop());
    this.processor?.disconnect();
    this.source?.disconnect();
    this.audioContext?.close();
  }

  playPCM(base64Data: string) {
    if (!this.audioContext) return;

    const arrayBuffer = this.base64ToArrayBuffer(base64Data);
    const floatData = this.sixteenBitToFloat(new Int16Array(arrayBuffer));
    
    const audioBuffer = this.audioContext.createBuffer(1, floatData.length, 16000);
    audioBuffer.getChannelData(0).set(floatData);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    const startTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;
  }

  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  private sixteenBitToFloat(input: Int16Array): Float32Array {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] / 0x8000;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
