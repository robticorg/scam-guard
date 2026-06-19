import { Client } from 'discord.js';
import { getRecords } from '../tracker';
import { acting } from '../config/store';
import constant from '../config/constant';
import { deleteMessages, sendAlert, timeoutUser } from '.';

export async function handleSpam(
    client: Client,
    guildId: string,
    userId: string,
    attachmentKey: string
): Promise<void> {
    const dedupKey = `${userId}_${attachmentKey}`;
    if (acting.has(dedupKey)) return;
    acting.add(dedupKey);
    setTimeout(() => acting.delete(dedupKey), constant.WINDOW_MS);

    const cutoff = Date.now() - constant.WINDOW_MS;
    const records = getRecords(attachmentKey).filter(
        r => r.userId === userId && r.timestamp > cutoff
    );

    await Promise.allSettled([
        deleteMessages(client, records),
        timeoutUser(client, guildId, userId),
        sendAlert(client, userId, records),
    ]);
}