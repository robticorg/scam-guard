import type { Message } from "discord.js";
const CDN_RE = /https:\/\/cdn\.discordapp\.com\/attachments\/(\d+\/\d+\/[^\s?&#]+)/;

export function getAttachmentKey(message: Message): string | null {
  const attachment = message.attachments.first();
  if (attachment) {
    const key = `file_${attachment.name}_${attachment.size}`;
    return key;
  }

  const match = message.content.match(CDN_RE);
  if (match) {
    const key = `url_${match[1]}`;
    return key;
  }

  for (const embed of message.embeds) {
    const url = embed.image?.url ?? embed.thumbnail?.url ?? null;
    if (!url) continue;
    const embedMatch = url.match(CDN_RE);
    if (embedMatch) {
      const key = `embed_${embedMatch[1]}`;
      return key;
    }
  }
  return null;
}