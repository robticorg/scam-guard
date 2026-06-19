import { Client } from 'discord.js';
import constant from '../config/constant';
import { log, warn } from '../utils/debug';

export async function timeoutUser(client: Client, guildId: string, userId: string): Promise<void> {
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    await member.timeout(constant.TIMEOUT_MS, 'ScamGuard: same attachment posted in 3+ channels within 60s');
  } catch (err) {
    warn('timeoutUser', `catch — failed to timeout user ${userId} in guild ${guildId}`, err);
  }
}