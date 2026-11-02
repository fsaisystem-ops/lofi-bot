import type { AudioPlayer, VoiceConnection } from "@discordjs/voice";
import type { ChildProcess } from "node:child_process";
import type { VoiceBasedChannel } from "discord.js";

export interface GuildAudioState {
  connection: VoiceConnection;
  player: AudioPlayer;
  ffmpegProcess: ChildProcess | null;
  reconnectAttempts: number;
  isPlaying: boolean;
  currentStationId: number | null;
  channelId: string;
  connectedSince: Date;
}

export interface CommandActor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CommandContext {
  guildId: string | null;
  guildName: string | null;
  actor: CommandActor;
  voiceChannel: VoiceBasedChannel | null;
  args: string[];
}

export interface CommandResult {
  success: boolean;
  message: string;
}
