import type { CommandContext, CommandResult } from "@/models/types";
import type { IAudioService } from "@/services/interfaces/IAudioService";
import type { ISessionService } from "@/services/interfaces/ISessionService";
import type { IStationService } from "@/services/interfaces/IStationService";
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
    private readonly sessionService: ISessionService
  ) {}

  async execute(context: CommandContext): Promise<CommandResult> {
    const { actor, args, voiceChannel } = context;
    const guildId = context.guildId;

    if (!guildId) {
      return { success: false, message: "This command can only be used in a server." };
    }

    if (!voiceChannel) {
      return { success: false, message: this.view.notInVoiceChannel() };
    }

    if (this.audioService.hasState(guildId)) {
      return { success: false, message: this.view.alreadyPlaying() };
    }

    // Resolve the station to play
    const stationQuery = args.join(" ") || undefined;
    const station = await this.stationService.resolveStation(stationQuery);

    if (!station) {
      return { success: false, message: this.view.stationNotFound(stationQuery) };
    }

    try {
      await this.audioService.joinChannel(voiceChannel);
      await this.audioService.startStream(guildId, station.url);

      // Start listening session for the user
      const userId = actor.id;
      await this.sessionService.startSession(guildId, userId, station.id, {
        userId,
        username: actor.username,
        displayName: actor.displayName,
        avatarUrl: actor.avatarUrl,
      });

      return { success: true, message: this.view.nowPlaying(station.name) };
    } catch (error) {
      commandLogger.error(
        { command: "play", guildId, stationId: station.id, err: error },
        "Failed to play station"
      );
      this.audioService.cleanup(guildId);
      return { success: false, message: this.view.failedToJoin() };
    }
  }
}
