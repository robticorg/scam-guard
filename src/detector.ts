import { getRecords } from './tracker';
import constant from './config/constant';

export function isSpam(key: string, userId: string): boolean {
  const cutoff = Date.now() - constant.WINDOW_MS;
  const all = getRecords(key);

  const relevant = all.filter(
    r => r.userId === userId && r.timestamp > cutoff
  );

  const uniqueChannels = new Set(relevant.map(r => r.channelId));

  return uniqueChannels.size >= constant.CHANNEL_THRESHOLD;
}