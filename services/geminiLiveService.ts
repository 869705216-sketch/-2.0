import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { HandState, HandData } from "../types";

// Helper to encode binary data
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private onHandDataCallback: ((data: HandData) => void) | null = null;
  private videoInterval: number | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  public setOnHandData(callback: (data: HandData) => void) {
    this.onHandDataCallback = callback;
  }

  public async connect() {
    const config = {
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log('Gemini Live Session Opened');
        },
        onmessage: (message: LiveServerMessage) => {
          this.handleMessage(message);
        },
        onclose: () => {
          console.log('Gemini Live Session Closed');
        },
        onerror: (e: ErrorEvent) => {
          console.error('Gemini Live Error', e);
        }
      },
      config: {
        responseModalities: [Modality.AUDIO], // We mostly care about the tool/text data encoded in turns, but required config
        speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Kore'}},
        },
        systemInstruction: `
          You are a vision processing AI for a 3D Christmas Tree experience.
          Your ONLY job is to analyze the video stream of the user.
          
          You must constantly output JSON data describing the user's hand gesture.
          Format: { "state": "OPEN" | "CLOSED", "x": number, "y": number }
          
          Rules:
          1. "state": If the user's hand is open palm/fingers spread, return "OPEN". If fist/closed, return "CLOSED".
          2. "x": Horizontal position of the hand in the frame. -1 is left, 1 is right, 0 is center.
          3. "y": Vertical position of the hand. -1 is bottom, 1 is top, 0 is center.
          4. If no hand is visible, return the last known position and state "CLOSED".
          5. Keep the response extremely concise. Just the JSON object.
          6. Do not generate audio speech. Just silent analysis.
        `,
      }
    };

    this.sessionPromise = this.ai.live.connect(config);
    await this.sessionPromise;
  }

  private handleMessage(message: LiveServerMessage) {
    // The Live API primarily sends audio, but we are looking for textual turn data 
    // or we can hijack the system to parse text if the model speaks JSON.
    // However, currently, the Live API is audio-in/audio-out optimized.
    // A trick to get structured data is to ask it to use a Tool, OR we parse the transcription.
    // Given the limitations of the current preview for pure JSON streaming without tools,
    // we will parse the text transcription if available, or rely on the model 'speaking' the JSON which we won't play but will parse.
    
    // Note: In a production "Unleash" scenario, we might use a Tool call, 
    // but for this visual effect, parsing the model's text output (transcription) is faster to prototype.
    
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.text) {
            this.tryParseJSON(part.text);
        }
      }
    }
  }

  private tryParseJSON(text: string) {
    try {
      // Find JSON pattern
      const match = text.match(/\{.*\}/);
      if (match) {
        const json = JSON.parse(match[0]);
        if (json.state && typeof json.x === 'number') {
            this.onHandDataCallback?.({
                state: json.state === 'OPEN' ? HandState.OPEN : HandState.CLOSED,
                x: Math.max(-1, Math.min(1, json.x)),
                y: Math.max(-1, Math.min(1, json.y))
            });
        }
      }
    } catch (e) {
      // Ignore partial JSON chunks
    }
  }

  public startVideoStreaming(videoElement: HTMLVideoElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const FRAME_RATE = 5; // Low framerate to save tokens/latency for this demo
    const JPEG_QUALITY = 0.5;

    this.videoInterval = window.setInterval(async () => {
      if (!this.sessionPromise || !ctx || !videoElement.videoWidth) return;

      canvas.width = videoElement.videoWidth * 0.5; // Downscale for speed
      canvas.height = videoElement.videoHeight * 0.5;
      
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      const base64Data = canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];

      this.sessionPromise!.then((session) => {
        session.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'image/jpeg' }
        });
        
        // Trigger the model to analyze this frame immediately by sending a tiny text prompt if needed,
        // but usually, the system instruction handles continuous flow. 
        // For Live API, it reacts to input.
        session.sendRealtimeInput({
            media: {
                mimeType: "text/plain",
                data: btoa("Analyze hand")
            }
        });
      });

    }, 1000 / FRAME_RATE);
  }

  public stop() {
    if (this.videoInterval) clearInterval(this.videoInterval);
    // There is no explicit disconnect method exposed in the helper typically, 
    // but we can stop sending data.
  }
}
