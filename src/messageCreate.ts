import { Client, Events } from 'discord.js';
import type { Message } from 'discord.js';
import { track } from './tracker';
import { isSpam } from './detector';
import { handleSpam } from './actions';
import { getAttachmentKey } from './utils/getAttachmentKey';
import { warn } from './utils/debug';

export function registerMessageCreate(client: Client): void {
  client.on(Events.MessageCreate, async (message: Message) => {

    const allowBots = process.env.ALLOW_BOT_MESSAGES === '1';
    if (message.author.bot && !allowBots) return;
    if (!message.guild) return;

    const key = getAttachmentKey(message);
    if (!key) return;

    track(key, {
      userId: message.author.id,
      channelId: message.channelId,
      messageId: message.id,
      timestamp: Date.now(),
    });

    const spam = isSpam(key, message.author.id);
    if (!spam) return;

    try {
      await message.delete();
    } catch (err) {
      warn('messageCreate', `failed to delete current spam message ${message.id}`, err);
    }

    await handleSpam(client, message.guild.id, message.author.id, key);
  });
}
