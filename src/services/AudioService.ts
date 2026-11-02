import {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
} from "@discordjs/voice";
import type { VoiceBasedChannel, VoiceState } from "discord.js";
import { config } from "@/config";
import { shouldLeaveWhenAlone, shouldRetryStream } from "@/services/presence-policy";
import type { GuildAudioState } from "@/models/types";
import { streamLogger, playerLogger, logger, voiceLogger } from "@/utils/logger";
import { runtimeLog } from "@/utils/runtime-log";
import type { IAudioService } from "./interfaces/IAudioService";
import type { ISessionService } from "./interfaces/ISessionService";
import type { IStreamService } from "./interfaces/IStreamService";

type ChannelResolver = (guildId: string, channelId: string) => Promise<VoiceBasedChannel | null>;

export class AudioService implements IAudioService {
  private readonly guildStates = new Map<string, GuildAudioState>();
  private readonly restoring = new Set<string>();
  private sessionService?: ISessionService;
  private channelResolver?: ChannelResolver;
  private holding = true;

  constructor(private readonly streamService: IStreamService) {}

  setSessionService(sessionService: ISessionService): void {
    this.sessionService = sessionService;
  }

  setChannelResolver(resolver: ChannelResolver): void {
    this.channelResolver = resolver;
  }

  hold(): void {
    this.holding = true;
  }

  releaseHold(): void {
    this.holding = false;
  }

  isHolding(): boolean {
    return this.holding;
  }

  async playInChannel(channel: VoiceBasedChannel, streamUrl: string): Promise<void> {
    this.hold();
    const guildId = channel.guild.id;
    if (this.hasState(guildId)) {
      this.cleanup(guildId);
    }
    if (!this.holding) return;
    await this.joinChannel(channel);
    if (!this.holding) {
      this.cleanup(guildId);
      return;
    }
    await this.startStream(guildId, streamUrl);
  }

  getState(guildId: string): GuildAudioState | undefined {
    return this.guildStates.get(guildId);
  }

  hasState(guildId: string): boolean {
    return this.guildStates.has(guildId);
  }

  getAllActiveStates(): Array<{ guildId: string; state: GuildAudioState }> {
    return Array.from(this.guildStates.entries()).map(([guildId, state]) => ({ guildId, state }));
  }

  async joinChannel(channel: VoiceBasedChannel): Promise<GuildAudioState> {
    const guildId = channel.guild.id;

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30000);

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });
    connection.subscribe(player);

    const state: GuildAudioState = {
      connection,
      player,
      ffmpegProcess: null,
      reconnectAttempts: 0,
      isPlaying: false,
      currentStationId: null,
      currentStreamUrl: null,
      channelId: channel.id,
      connectedSince: new Date(),
    };

    this.guildStates.set(guildId, state);
    this.setupPlayerListeners(state, guildId);
    this.setupConnectionListeners(state, guildId);

    return state;
  }

  async startStream(guildId: string, streamUrl: string): Promise<void> {
    const state = this.guildStates.get(guildId);
    if (!state) {
      throw new Error(`No audio state found for guild ${guildId}`);
    }

    await this.startStreamInternal(state, streamUrl);
  }

  private async startStreamInternal(state: GuildAudioState, streamUrl: string): Promise<void> {
    try {
      if (state.ffmpegProcess) {
        state.ffmpegProcess.kill();
      }

      state.ffmpegProcess = this.streamService.createStream(streamUrl);

      if (!state.ffmpegProcess.stdout) {
        throw new Error("Failed to create ffmpeg stdout stream");
      }

      const resource = createAudioResource(state.ffmpegProcess.stdout, {
        inputType: StreamType.OggOpus,
      });
      state.player.play(resource);
      state.isPlaying = true;
      state.reconnectAttempts = 0;
      state.currentStreamUrl = streamUrl;
      runtimeLog("player.play called");

      streamLogger.info("Started playing radio");
    } catch (error) {
      streamLogger.error({ err: error }, "Error starting stream");
      await this.handleStreamError(state);
    }
  }

  private async handleStreamError(state: GuildAudioState): Promise<void> {
    if (!shouldRetryStream(state.reconnectAttempts, config.stream.maxReconnectAttempts)) {
      streamLogger.error(
        { maxAttempts: config.stream.maxReconnectAttempts },
        "Max reconnection attempts reached"
      );
      state.isPlaying = false;
      return;
    }

    state.reconnectAttempts++;
    streamLogger.warn(
      { attempt: state.reconnectAttempts },
      "Reconnecting..."
    );

    await new Promise((resolve) => setTimeout(resolve, config.stream.reconnectDelayMs));

    const streamUrl = state.currentStreamUrl;
    if (state.isPlaying && streamUrl && this.holding) {
      await this.startStreamInternal(state, streamUrl);
    }
  }

  stopStream(guildId: string): void {
    const state = this.guildStates.get(guildId);
    if (state) {
      state.isPlaying = false;
      if (state.ffmpegProcess) {
        state.ffmpegProcess.kill();
        state.ffmpegProcess = null;
      }
      state.player.stop();
    }
  }

  cleanup(guildId: string): void {
    const state = this.guildStates.get(guildId);
    if (state) {
      // Delete first to prevent re-entrant calls from the Destroyed event
      this.guildStates.delete(guildId);

      // End all listening sessions for this guild
      this.sessionService?.endAllGuildSessions(guildId).catch((error) => {
        voiceLogger.error({ guildId, err: error }, "Failed to end guild sessions during cleanup");
      });

      state.isPlaying = false;
      if (state.ffmpegProcess) {
        state.ffmpegProcess.kill();
      }
      state.connection.destroy();
      logger.info({ guildId }, "Cleaned up resources");
    }
  }

  cleanupAll(): void {
    for (const guildId of this.guildStates.keys()) {
      this.cleanup(guildId);
    }
  }

  describePlayback(): string[] {
    const lines: string[] = [];
    for (const [guildId, state] of this.guildStates) {
      const ffmpeg = state.ffmpegProcess;
      lines.push(
        `${guildId} player=${state.player.state.status} voice=${state.connection.state.status} flag=${state.isPlaying} ffmpegExit=${ffmpeg?.exitCode ?? "running"} channel=${state.channelId}`
      );
    }
    return lines;
  }

  handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): void {
    const guildId = oldState.guild.id;
    const state = this.guildStates.get(guildId);

    if (!state) return;

    // Check if someone left the bot's channel
    if (oldState.channelId === state.channelId && oldState.channelId !== newState.channelId) {
      const userId = oldState.member?.id;

      // End the leaving user's session
      if (userId && !oldState.member?.user.bot) {
        this.sessionService?.endSession(guildId, userId).catch((error) => {
          voiceLogger.error({ guildId, userId, err: error }, "Failed to end user session on leave");
        });
      }

      const channel = oldState.channel;
      if (channel) {
        const humanMembers = channel.members.filter((member) => !member.user.bot).size;
        if (shouldLeaveWhenAlone(this.holding, humanMembers)) {
          voiceLogger.info(
            { guildId, channelId: state.channelId },
            "All users left voice channel, stopping bot"
          );
          this.cleanup(guildId);
        }
      }
    }

    if (oldState.id === oldState.client.user?.id && this.holding) {
      const homeId = config.autoJoin.channelId;
      if (!homeId || newState.channelId === homeId) return;
      const url = state.currentStreamUrl ?? undefined;
      void this.restore(guildId, homeId, url);
    }
  }

  private setupPlayerListeners(state: GuildAudioState, guildId: string): void {
    state.player.on(AudioPlayerStatus.Playing, () => {
      playerLogger.info({ guildId }, "Audio is playing");
      runtimeLog(`${guildId} audio playing`);
    });

    state.player.on(AudioPlayerStatus.Buffering, () => {
      playerLogger.warn({ guildId }, "Audio is buffering");
      runtimeLog(`${guildId} audio buffering`);
    });

    state.player.on(AudioPlayerStatus.Idle, async () => {
      runtimeLog(`${guildId} audio idle`);
      if (state.isPlaying) {
        playerLogger.warn({ guildId }, "Stream ended unexpectedly, attempting reconnect");
        await this.handleStreamError(state);
      }
    });

    state.player.on("error", async (error) => {
      playerLogger.error({ guildId, error: error.message }, "Player error");
      runtimeLog(`${guildId} player error ${error.message}`);
      if (state.isPlaying) {
        await this.handleStreamError(state);
      }
    });
  }

  private setupConnectionListeners(state: GuildAudioState, guildId: string): void {
    state.connection.on("stateChange", (_oldState, newState) => {
      runtimeLog(`${guildId} voice ${newState.status}`);
    });

    state.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(state.connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(state.connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch {
        if (this.guildStates.get(guildId) !== state) return;
        if (!this.holding) {
          this.cleanup(guildId);
          return;
        }
        const homeId = config.autoJoin.channelId || state.channelId;
        await this.restore(guildId, homeId, state.currentStreamUrl ?? undefined);
      }
    });

    state.connection.on(VoiceConnectionStatus.Destroyed, () => {
      if (this.restoring.has(guildId)) return;
      if (this.guildStates.get(guildId) !== state) return;
      if (!this.holding) {
        this.cleanup(guildId);
        return;
      }
      const homeId = config.autoJoin.channelId || state.channelId;
      void this.restore(guildId, homeId, state.currentStreamUrl ?? undefined);
    });
  }

  private async restore(guildId: string, channelId: string, streamUrl?: string): Promise<void> {
    if (!this.holding || this.restoring.has(guildId)) return;
    this.restoring.add(guildId);
    try {
      this.cleanup(guildId);
      if (!this.holding) return;
      const channel = this.channelResolver
        ? await this.channelResolver(guildId, channelId)
        : null;
      if (!this.holding) return;
      if (!channel) {
        throw new Error(`channel ${channelId} unavailable`);
      }
      await this.joinChannel(channel);
      if (streamUrl) {
        await this.startStream(guildId, streamUrl);
      }
      runtimeLog(`${guildId} rejoined ${channelId}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      runtimeLog(`${guildId} rejoin failed ${text}`);
      setTimeout(() => {
        this.restoring.delete(guildId);
        if (this.holding) {
          void this.restore(guildId, channelId, streamUrl);
        }
      }, config.stream.reconnectDelayMs);
      return;
    }
    this.restoring.delete(guildId);
  }
}
