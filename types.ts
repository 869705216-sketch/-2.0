export enum HandState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  UNKNOWN = 'UNKNOWN'
}

export interface HandData {
  state: HandState;
  x: number; // -1 to 1 (normalized screen space, 0 is center)
  y: number; // -1 to 1
}

export interface AppState {
  isConnected: boolean;
  isStreaming: boolean;
  handData: HandData;
  error: string | null;
}
