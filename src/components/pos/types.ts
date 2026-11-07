export interface ConnectedWaiter {
  id: string;
  name: string;
  ip: string;
  activeTable: string;
  device: string;
  lastSeen: number;
  lastSeenTime: string;
  status: 'online' | 'idle';
}

export interface SyncServerInfo {
  running: boolean;
  port: number;
  ip: string;
  localUrl: string;
  token?: string;
}
