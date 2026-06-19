import { Client } from 'discord.js';
import type { TextChannel } from 'discord.js';
import { warn } from '../utils/debug';

export async function deleteMessages(client: Client, records: AttachmentRecord[]): Promise<void> {
    for (const r of records) {
        try {
            const channel = (await client.channels.fetch(r.channelId)) as TextChannel;
            const message = await channel.messages.fetch(r.messageId);
            await message.delete();
        } catch (err) {
            warn('deleteMessages', `catch — failed to delete message ${r.messageId} in channel ${r.channelId}`, err);
        }
    }
}