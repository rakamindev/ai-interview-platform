export type Scenario = 'happy-path' | 'resumption';

export interface SetupPart {
  text?: string;
}

export interface SetupConfig {
  model?: string;
  generationConfig?: {
    responseModalities?: string[];
    speechConfig?: {
      voiceConfig?: {
        prebuiltVoiceConfig?: { voiceName: string };
      };
    };
  };
  systemInstruction?: {
    parts?: SetupPart[];
  };
  sessionResumption?: {
    handle?: string;
  };
}

export interface GeminiSetupMessage {
  setup: SetupConfig;
}

export interface GeminiRealtimeInputMessage {
  realtimeInput: {
    text?: string;
    audio?: {
      mimeType: string;
      data: string; // base64 encoded PCM bytes
    };
  };
}

export interface InlineAudioPart {
  inlineData: {
    mimeType: string;
    data: string; // base64 encoded PCM bytes
  };
}

export interface GeminiModelTurn {
  parts: InlineAudioPart[];
}

export interface GeminiServerContent {
  modelTurn?: GeminiModelTurn;
  inputTranscription?: {
    text?: string;
    parts?: Array<{ text: string }>;
  };
  outputTranscription?: {
    text?: string;
    parts?: Array<{ text: string }>;
  };
  generationComplete?: boolean;
  turnComplete?: boolean;
  interrupted?: boolean;
}

export interface GeminiServerMessage {
  setupComplete?: Record<string, never>;
  sessionResumption?: {
    handle: string;
  };
  sessionResumptionUpdate?: {
    newHandle: string;
  };
  serverContent?: GeminiServerContent;
  goAway?: {
    timeLeft: string;
  };
}
