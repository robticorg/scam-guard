import { Client } from 'discord.js';
import type { TextChannel } from 'discord.js';
import { warn } from '../utils/debug';

export async function sendAlert(client: Client, userId: string, records: AttachmentRecord[]): Promise<void> {
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId) return;

    try {
        const channel = (await client.channels.fetch(logChannelId)) as TextChannel;

        const channelMentions = [...new Set(records.map(r => `<#${r.channelId}>`))].join(', ');
        await channel.send(
            `**[ScamGuard]** <@${userId}> timed out — posted the same attachment in ${channelMentions} within 60s.`
        );
    } catch (err) {
        warn('sendAlert', `catch — failed to send alert to log channel ${logChannelId}`, err);
    }
}
