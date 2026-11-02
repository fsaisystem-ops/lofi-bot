import type { AudioPlayer, VoiceConnection } from "@discordjs/voice";
import type { ChildProcess } from "node:child_process";
import type { Message } from "discord.js";

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

export interface CommandContext {
  message: Message;
  args: string[];
}

export interface CommandResult {
  success: boolean;
  message: string;
}
