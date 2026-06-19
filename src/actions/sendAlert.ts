import { Client, EmbedBuilder } from 'discord.js';
import type { TextChannel } from 'discord.js';
import { warn } from '../utils/debug';

export async function sendAlert(client: Client, userId: string, records: AttachmentRecord[]): Promise<void> {
    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (!logChannelId) return;

    try {
        const channel = (await client.channels.fetch(logChannelId)) as TextChannel;

        const channelMentions = [...new Set(records.map(r => `<#${r.channelId}>`))].join('\n');

        const embed = new EmbedBuilder()
            .setTitle('Scam Raid Detected')
            .addFields(
                { name: 'User', value: `<@${userId}>`, inline: true },
                { name: 'Channels', value: channelMentions },
                { name: 'Action', value: 'Messages deleted · 10-minute timeout applied', inline: false }
            )
            .setFooter({ text: 'ScamGuard' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (err) {
        warn('sendAlert', `catch — failed to send alert to log channel ${logChannelId}`, err);
    }
}
