import type { CommandContext, CommandResult } from "@/models/types";
import type { IProfileService } from "@/services/interfaces/IProfileService";
import { MessageView } from "@/views/MessageView";
import type { ICommand } from "./interfaces/ICommand";

export class ProfileCommand implements ICommand {
  readonly name = "profile";
  readonly description = "View your lofi profile";
  readonly usage = "/profile";
  readonly adminOnly = false;

  private readonly view = new MessageView();

  constructor(private readonly profileService: IProfileService) {}

  async execute(context: CommandContext): Promise<CommandResult> {
    const { actor } = context;
    const userId = actor.id;
    const guildId = context.guildId;

    const profile = await this.profileService.getProfile(userId);

    if (!profile) {
      return {
        success: true,
        message:
          "You haven't started your lofi journey yet! Use `/play` to start listening and earn XP.",
      };
    }

    const levelInfo = this.profileService.getLevelInfo(profile.totalXp);
    const progressBar = this.view.createProgressBar(levelInfo.progress);
    const title = this.view.getLevelTitleFormatted(profile.currentLevel);

    // Get guild stats if in a guild
    let guildRankText = "";
    if (guildId) {
      const guildStats = await this.profileService.getGuildStats(guildId, userId);
      if (guildStats) {
        const topInGuild = await this.profileService.getTopByGuild(guildId, 100);
        const guildRank = topInGuild.findIndex((s) => s.userId === userId) + 1;
        if (guildRank > 0) {
          guildRankText = `\n🏆 Server Rank: #${guildRank}`;
        }
      }
    }

    // Get global rank
    const topGlobal = await this.profileService.getTopGlobal(100);
    const globalRank = topGlobal.findIndex((p) => p.userId === userId) + 1;
    const globalRankText = globalRank > 0 ? `\n🌍 Global Rank: #${globalRank}` : "";

    const displayName = profile.displayName || profile.username || actor.displayName;
    const totalTime = this.view.formatTime(profile.totalMinutesListened);

    const lines = [
      `🎧 **Lofi Profile: ${displayName}**`,
      "",
      `${title}`,
      `📊 Level ${profile.currentLevel} ${progressBar} (${levelInfo.currentXp} / ${levelInfo.xpForNextLevel} XP)`,
      `⏱️ Total Time: ${totalTime}`,
      `✨ Total XP: ${profile.totalXp.toLocaleString()}`,
      guildRankText,
      globalRankText,
      "",
      "Keep listening to level up! 🎵",
    ];

    return { success: true, message: lines.filter((l) => l !== "").join("\n") };
  }
}
