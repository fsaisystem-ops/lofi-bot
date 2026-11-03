import type { CommandContext, CommandResult } from "@/models/types";
import type { IAudioService } from "@/services/interfaces/IAudioService";
import type { ISessionService } from "@/services/interfaces/ISessionService";
import type { IStationService } from "@/services/interfaces/IStationService";
import type { StationClock } from "@/services/station-rotation";
import { commandLogger } from "@/utils/logger";
import { MessageView } from "@/views/MessageView";
import type { ICommand } from "./interfaces/ICommand";

export class PlayCommand implements ICommand {
  readonly name = "play";
  readonly description = "Play a radio station in your voice channel";
  readonly usage = "/play [station]";
  readonly adminOnly = false;

  private readonly view = new MessageView();

  constructor(
    private readonly audioService: IAudioService,
    private readonly stationService: IStationService,
    private readonly sessionService: ISessionService,
    private readonly clock?: StationClock
  ) {}

  async execute(context: CommandContext): Promise<CommandResult> {
    const { actor, args, voiceChannel } = context;
    const guildId = context.guildId;

    if (!guildId) {
      return { success: false, message: "This command can only be used in a server." };
    }

    const switching = this.audioService.hasState(guildId);
    if (!switching && !voiceChannel) {
      return { success: false, message: this.view.notInVoiceChannel() };
    }

    const stationQuery = args.join(" ") || undefined;
    const station = await this.stationService.resolveStation(stationQuery);

    if (!station) {
      return { success: false, message: this.view.stationNotFound(stationQuery) };
    }

    try {
      if (switching) {
        await this.audioService.startStream(guildId, station.url);
      } else if (voiceChannel) {
        await this.audioService.playInChannel(voiceChannel, station.url);
      }

      const state = this.audioService.getState(guildId);
      if (!state) {
        return { success: false, message: this.view.failedToJoin() };
      }
      state.currentStationId = station.id;
      this.clock?.started();

      const listeningHere = voiceChannel?.id === state.channelId;
      if (listeningHere) {
        const userId = actor.id;
        await this.sessionService.startSession(guildId, userId, station.id, {
          userId,
          username: actor.username,
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl,
        });
      }

      return { success: true, message: this.view.nowPlaying(station.name) };
    } catch (error) {
      commandLogger.error(
        { command: "play", guildId, stationId: station.id, err: error },
        "Failed to play station"
      );
      if (!switching) this.audioService.cleanup(guildId);
      return { success: false, message: this.view.failedToJoin() };
    }
  }
}
