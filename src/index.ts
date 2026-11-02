// Suppress harmless TimeoutNegativeWarning from @discordjs/voice
process.on("warning", (warning) => {
  if (warning.name === "TimeoutNegativeWarning") return;
  console.warn(warning);
});

import { generateDependencyReport } from "@discordjs/voice";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { config, validateConfig } from "@/config";
import { db } from "@/database/connection";
import { ensureSchema } from "@/database/ensure-schema";
import { stations } from "@/database/schema";
import { StationRepository } from "@/repositories/StationRepository";
import { UserProfileRepository } from "@/repositories/UserProfileRepository";
import { GuildUserStatsRepository } from "@/repositories/GuildUserStatsRepository";
import { GuildRepository } from "@/repositories/GuildRepository";
import { SessionRepository } from "@/repositories/SessionRepository";
import { AudioService } from "@/services/AudioService";
import { StationService } from "@/services/StationService";
import { StreamService } from "@/services/StreamService";
import { ProfileService } from "@/services/ProfileService";
import { SessionService } from "@/services/SessionService";
import { PlayCommand } from "@/commands/PlayCommand";
import { StopCommand } from "@/commands/StopCommand";
import { StationsCommand } from "@/commands/StationsCommand";
import { AddStationCommand } from "@/commands/AddStationCommand";
import { RemoveStationCommand } from "@/commands/RemoveStationCommand";
import { SetDefaultCommand } from "@/commands/SetDefaultCommand";
import { HealthCommand } from "@/commands/HealthCommand";
import { ProfileCommand } from "@/commands/ProfileCommand";
import { RankCommand } from "@/commands/RankCommand";
import { GlobalRankCommand } from "@/commands/GlobalRankCommand";
import { CommandController } from "@/controllers/CommandController";
import { StationController } from "@/controllers/StationController";
import { GuildController } from "@/controllers/GuildController";
import { HealthService } from "@/services/HealthService";
import { VersionService } from "@/services/VersionService";
import { ApiServer } from "@/server/ApiServer";
import { botLogger, seedLogger } from "@/utils/logger";
import { runtimeLog } from "@/utils/runtime-log";

// Validate configuration
validateConfig();

// Initialize Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// Dependency Injection - Build the object graph
const stationRepository = new StationRepository(db);
const userProfileRepository = new UserProfileRepository(db);
const guildUserStatsRepository = new GuildUserStatsRepository(db);
const guildRepository = new GuildRepository(db);
const sessionRepository = new SessionRepository(db);
const stationService = new StationService(stationRepository);
const streamService = new StreamService();
const audioService = new AudioService(streamService);
const profileService = new ProfileService(
  userProfileRepository,
  guildUserStatsRepository,
  guildRepository
);
const sessionService = new SessionService(sessionRepository, profileService);
audioService.setSessionService(sessionService);
audioService.setChannelResolver(async (guildId, channelId) => {
  const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
  const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId));
  return channel?.isVoiceBased() ? channel : null;
});
const healthService = new HealthService(client, db, audioService);
const versionService = new VersionService(healthService);
const stationController = new StationController(stationService);
const guildController = new GuildController(audioService, stationService, sessionService, client);
const apiServer = config.api.enabled
  ? new ApiServer(
      healthService,
      stationController,
      guildController,
      versionService,
      config.api.port,
      config.api.key || undefined
    )
  : null;

// Initialize controller and register commands
const commandController = new CommandController();
commandController.registerCommands([
  new PlayCommand(audioService, stationService, sessionService),
  new StopCommand(audioService),
  new StationsCommand(stationService),
  new AddStationCommand(stationService),
  new RemoveStationCommand(stationService),
  new SetDefaultCommand(stationService),
  new HealthCommand(healthService),
  new ProfileCommand(profileService),
  new RankCommand(profileService, client),
  new GlobalRankCommand(profileService, client),
]);

// Seed default station if none exist
async function seedDefaultStation(): Promise<void> {
  const existingStations = await stationService.getAllStations();
  if (existingStations.length === 0) {
    seedLogger.info("No stations found, creating default Lofi station...");
    await db.insert(stations).values({
      name: "Lofi Girl",
      url: "https://play.streamafrica.net/lofiradio",
      description: "Lofi hip hop radio - beats to relax/study to",
      isDefault: true,
    });
    seedLogger.info("Default station created");
  }
}

async function joinHomeChannel(): Promise<void> {
  const { guildId, channelId } = config.autoJoin;
  if (!guildId || !channelId) return;

  for (;;) {
    if (!audioService.isHolding()) return;
    try {
      const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId));
      const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId));
      if (!channel?.isVoiceBased()) {
        throw new Error(`channel ${channelId} is not voice`);
      }
      const station = await stationService.getDefaultStation();
      if (!station) {
        throw new Error("no default station");
      }
      if (audioService.hasState(guildId)) {
        runtimeLog(`home already in ${channelId}`);
        return;
      }
      await audioService.joinChannel(channel);
      if (!audioService.isHolding()) {
        audioService.cleanup(guildId);
        return;
      }
      await audioService.startStream(guildId, station.url);
      runtimeLog(`home joined ${channelId} ${station.name}`);
      return;
    } catch (error) {
      if (!audioService.isHolding()) return;
      const text = error instanceof Error ? error.message : String(error);
      runtimeLog(`home join failed ${text}`);
      await new Promise((resolve) => setTimeout(resolve, config.stream.reconnectDelayMs));
    }
  }
}

// Event handlers
client.once(Events.ClientReady, async (readyClient) => {
  try {
    botLogger.info({ tag: readyClient.user.tag }, "Logged in");
    runtimeLog(`logged in ${readyClient.user.tag}`);
    await ensureSchema();
    runtimeLog("schema ok");
    await seedDefaultStation();
    runtimeLog("seed ok");
    await sessionService.cleanupOrphanedSessions();
    runtimeLog("sessions cleaned");
    try {
      await commandController.register(readyClient);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      runtimeLog(`slash register failed ${text}`);
      botLogger.error({ err: error }, "Failed to register slash commands");
    }
  } catch (error) {
    const text = error instanceof Error ? error.stack ?? error.message : String(error);
    runtimeLog(`ready failed ${text}`);
    botLogger.error({ err: error }, "Startup after login failed");
  }
  void joinHomeChannel();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await commandController.handleInteraction(interaction);
});

client.on(Events.GuildCreate, async (guild) => {
  if (!guild.client.isReady()) return;
  try {
    await commandController.register(guild.client);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    runtimeLog(`slash register failed ${text}`);
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  audioService.handleVoiceStateUpdate(oldState, newState);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  botLogger.info("Shutting down...");
  apiServer?.stop();
  audioService.cleanupAll();
  client.destroy();
  process.exit(0);
});

export function getApiFetch(): ((request: Request) => Promise<Response>) | null {
  if (!apiServer) return null;
  return (request) => apiServer.fetch(request);
}

export async function main(): Promise<string> {
  for (const line of generateDependencyReport().split("\n")) {
    if (line.trim()) runtimeLog(line);
  }
  return client.login(config.discord.token);
}

if (process.env["LOFI_BOOT"] !== "1") {
  apiServer?.start();
  void main();
}
