import type { CommandContext, CommandResult } from "@/models/types";
import type { IAudioService } from "@/services/interfaces/IAudioService";
import { MessageView } from "@/views/MessageView";
import type { ICommand } from "./interfaces/ICommand";

export class StopCommand implements ICommand {
  readonly name = "stop";
  readonly description = "Stop playing and leave the voice channel";
  readonly usage = "/stop";
  readonly adminOnly = false;

  private readonly view = new MessageView();

  constructor(private readonly audioService: IAudioService) {}

  async execute(context: CommandContext): Promise<CommandResult> {
    const guildId = context.guildId;
    if (!guildId) {
      return { success: false, message: "This command can only be used in a server." };
    }

    if (!this.audioService.hasState(guildId)) {
      return { success: false, message: this.view.notPlaying() };
    }

    this.audioService.releaseHold();
    this.audioService.cleanup(guildId);
    return { success: true, message: this.view.stopped() };
  }
}
