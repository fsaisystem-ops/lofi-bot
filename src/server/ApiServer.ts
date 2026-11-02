import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { healthLogger } from "@/utils/logger";
import type { IHealthService } from "@/services/interfaces/IHealthService";
import type { IVersionService } from "@/services/interfaces/IVersionService";
import type { StationController } from "@/controllers/StationController";
import type { GuildController } from "@/controllers/GuildController";

export class ApiServer {
  private app: Elysia;
  private server: Server | null = null;

  constructor(
    private readonly healthService: IHealthService,
    private readonly stationController: StationController,
    private readonly guildController: GuildController,
    private readonly versionService: IVersionService,
    private readonly port: number,
    private readonly apiKey?: string
  ) {
    this.app = new Elysia().use(cors());

    if (this.apiKey) {
      this.app.guard({
        beforeHandle: ({ headers, set }) => {
          const providedKey = headers["x-api-key"];
          if (providedKey !== this.apiKey) {
            set.status = 401;
            return { error: "Invalid or missing API key" };
          }
        },
      });
    }

    this.app
      .get("/", () => ({
        name: "lofi-bot",
        version: "1.0.0",
        endpoints: [
          "/health",
          "/api/version",
          "/api/stations",
          "/api/stations/:id",
          "/api/stations/:id/default",
          "/api/guilds",
          "/api/guilds/:guildId/status",
          "/api/guilds/:guildId/play",
          "/api/guilds/:guildId/stop",
          "/api/guilds/stop-all",
        ],
      }))
      .get("/api/version", async () => this.versionService.getVersion())
      .get("/health", async ({ set }) => {
        const status = await this.healthService.getStatus();
        if (status.status === "unhealthy") {
          set.status = 503;
        }
        return status;
      })
      .get("/api/stations", async () => {
        const result = await this.stationController.getAll();
        return result.data;
      })
      .get("/api/stations/:id", async ({ params, set }) => {
        const id = parseInt(params.id, 10);
        const result = await this.stationController.getById(id);
        set.status = result.status;
        return result.data;
      })
      .post("/api/stations", async ({ body, set }) => {
        const { name, url, description } = body as {
          name?: string;
          url?: string;
          description?: string;
        };
        const result = await this.stationController.create(name, url, description);
        set.status = result.status;
        return result.data;
      })
      .delete("/api/stations/:id", async ({ params, set }) => {
        const id = parseInt(params.id, 10);
        const result = await this.stationController.remove(id);
        set.status = result.status;
        return result.data;
      })
      .put("/api/stations/:id/default", async ({ params, set }) => {
        const id = parseInt(params.id, 10);
        const result = await this.stationController.setDefault(id);
        set.status = result.status;
        return result.data;
      })
      .get("/api/guilds", async () => {
        const result = await this.guildController.getGuilds();
        return result.data;
      })
      .post("/api/guilds/stop-all", async () => {
        const result = await this.guildController.stopAll();
        return result.data;
      })
      .get("/api/guilds/:guildId/status", async ({ params, set }) => {
        const result = await this.guildController.getGuildStatus(params.guildId);
        set.status = result.status;
        return result.data;
      })
      .post("/api/guilds/:guildId/play", async ({ params, body, set }) => {
        const { stationId, channelId } = body as {
          stationId?: number;
          channelId?: string;
        };
        const result = await this.guildController.playInGuild(params.guildId, stationId, channelId);
        set.status = result.status;
        return result.data;
      })
      .post("/api/guilds/:guildId/stop", async ({ params, set }) => {
        const result = await this.guildController.stopInGuild(params.guildId);
        set.status = result.status;
        return result.data;
      });
  }

  fetch(request: Request): Promise<Response> {
    return this.app.fetch(request);
  }

  start(): void {
    if (this.server) return;

    this.server = createServer((req, res) => {
      this.handleNodeRequest(req, res).catch((error) => {
        healthLogger.error({ err: error }, "API request failed");
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("internal error");
        }
      });
    });

    this.server.listen(this.port, "0.0.0.0", () => {
      healthLogger.info({ port: this.port }, "API server started");
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
    healthLogger.info("API server stopped");
  }

  private async handleNodeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const host = req.headers.host ?? "127.0.0.1";
    const method = req.method ?? "GET";
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const hasBody = method !== "GET" && method !== "HEAD";
    const chunks: Buffer[] = [];
    if (hasBody) {
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    }

    const response = await this.fetch(
      new Request(`http://${host}${req.url ?? "/"}`, {
        method,
        headers,
        body: hasBody ? Buffer.concat(chunks) : undefined,
      })
    );

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      res.setHeader(key, value);
    });
    res.end(Buffer.from(await response.arrayBuffer()));
  }
}
