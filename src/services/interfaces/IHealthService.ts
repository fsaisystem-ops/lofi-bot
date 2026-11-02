export interface HealthStatus {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  discord: {
    connected: boolean;
    ping: number;
    guilds: number;
  };
  database: {
    connected: boolean;
  };
  audio: {
    activeConnections: number;
    playback: string[];
    log: string[];
  };
}

export interface IHealthService {
  getStatus(): Promise<HealthStatus>;
}
