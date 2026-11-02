import { PermissionFlagsBits, type ChatInputCommandInteraction, type Client } from "discord.js";
import type { ICommand } from "@/commands/interfaces/ICommand";
import { argsFromOptions, slashBodies } from "@/commands/slash-args";
import type { CommandActor } from "@/models/types";
import { commandLogger } from "@/utils/logger";
import { runtimeLog } from "@/utils/runtime-log";
import { isAdminAccess } from "@/utils/permissions";
import { MessageView } from "@/views/MessageView";

function fit(text: string): string {
  if (text.length <= 2000) return text;
  return `${text.slice(0, 1997)}...`;
}

function roleIdsOf(interaction: ChatInputCommandInteraction): string[] {
  const roles = interaction.member?.roles;
  if (!roles) return [];
  if (Array.isArray(roles)) return roles;
  return [...roles.cache.keys()];
}

function actorFrom(interaction: ChatInputCommandInteraction): CommandActor {
  const member = interaction.member;
  const displayName =
    member && "displayName" in member ? member.displayName : interaction.user.displayName;

  return {
    id: interaction.user.id,
    username: interaction.user.username,
    displayName,
    avatarUrl: interaction.user.displayAvatarURL(),
  };
}

export class CommandController {
  private readonly commands = new Map<string, ICommand>();
  private readonly view = new MessageView();

  registerCommand(command: ICommand): void {
    this.commands.set(command.name.toLowerCase(), command);
  }

  registerCommands(commands: ICommand[]): void {
    for (const command of commands) {
      this.registerCommand(command);
    }
  }

  async register(client: Client): Promise<void> {
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set(slashBodies);
      runtimeLog(`slash ${guild.id} ${slashBodies.length}`);
    }
  }

  async handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const command = this.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({ content: "Unknown command.", ephemeral: true });
      return;
    }

    const administrator =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
    if (command.adminOnly && !isAdminAccess(administrator, roleIdsOf(interaction))) {
      await interaction.reply(this.view.permissionDenied());
      return;
    }

    await interaction.deferReply();

    try {
      const voiceChannel =
        interaction.guild?.voiceStates.cache.get(interaction.user.id)?.channel ?? null;
      const result = await command.execute({
        guildId: interaction.guildId,
        guildName: interaction.guild?.name ?? null,
        actor: actorFrom(interaction),
        voiceChannel,
        args: argsFromOptions(interaction.commandName, {
          string: (name) => interaction.options.getString(name),
          integer: (name) => interaction.options.getInteger(name),
        }),
      });
      await interaction.editReply(fit(result.message));
    } catch (error) {
      commandLogger.error({ command: interaction.commandName, err: error }, "Error executing command");
      const text = error instanceof Error ? error.message : String(error);
      runtimeLog(`slash ${interaction.commandName} failed ${text}`);
      await interaction.editReply("An unexpected error occurred. Please try again.");
    }
  }
}
