import type { GuildMember } from "discord.js";
import { config } from "@/config";

export function isAdminAccess(administrator: boolean, roleIds: Iterable<string>): boolean {
  if (administrator) return true;
  if (!config.discord.adminRoleId) return false;

  for (const roleId of roleIds) {
    if (roleId === config.discord.adminRoleId) return true;
  }

  return false;
}

export function isAdmin(member: GuildMember | null): boolean {
  if (!member) return false;
  return isAdminAccess(member.permissions.has("Administrator"), member.roles.cache.keys());
}
