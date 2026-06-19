/**
 * Live spam detection test — drives a real Discord bot against a running ScamGuard instance.
 *
 * Required .env entries before running:
 *   SPAMMER_TOKEN    = bot token of the secondary "attacker" bot
 *   TEST_GUILD_ID    = guild ID where ScamGuard is active
 *   TEST_CHANNEL_IDS = comma-separated list of at least 4 text channel IDs
 *                      (e.g. "111,222,333,444,555")
 *
 * How to run:
 *   bun test test/spam.spec.ts
 *
 * Requirements:
 *   - ScamGuard must already be running in the test guild
 *   - Spammer bot must be a member of the guild with Send Messages permission
 *   - ScamGuard must have Manage Messages + Moderate Members in those channels
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  AttachmentBuilder,
  Client,
  GatewayIntentBits,
  type TextChannel,
} from 'discord.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const SPAMMER_TOKEN  = process.env.SPAMMER_TOKEN  ?? '';
const TEST_GUILD_ID  = process.env.TEST_GUILD_ID  ?? '';
const CHANNEL_IDS    = (process.env.TEST_CHANNEL_IDS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// How long to wait for ScamGuard to process and act after messages are sent
const SCAM_GUARD_WAIT_MS = 4_000;

// A minimal 1×1 PNG — used as the fake "scam image" in every test
const SCAM_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=',
  'base64'
);

const spammer = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Send the same named attachment to each channel. Returns [channelId, messageId] pairs. */
async function sendSameAttachment(
  channelIds: string[],
  filename: string
): Promise<[string, string][]> {
  const results: [string, string][] = [];
  for (const id of channelIds) {
    const channel = (await spammer.channels.fetch(id)) as TextChannel;
    const msg = await channel.send({
      files: [new AttachmentBuilder(SCAM_PNG, { name: filename })],
    });
    results.push([id, msg.id]);
  }
  return results;
}

/** Send a unique-named attachment to each channel (different key per channel). */
async function sendDifferentAttachments(channelIds: string[]): Promise<[string, string][]> {
  const results: [string, string][] = [];
  for (let i = 0; i < channelIds.length; i++) {
    const id = channelIds[i]!;
    const channel = (await spammer.channels.fetch(id)) as TextChannel;
    const msg = await channel.send({
      files: [new AttachmentBuilder(SCAM_PNG, { name: `unique_img_${i}.png` })],
    });
    results.push([id, msg.id]);
  }
  return results;
}

/** Send plain text (no attachment) to each channel. */
async function sendTextOnly(channelIds: string[]): Promise<[string, string][]> {
  const results: [string, string][] = [];
  for (const id of channelIds) {
    const channel = (await spammer.channels.fetch(id)) as TextChannel;
    const msg = await channel.send({ content: 'hey check this out everyone!' });
    results.push([id, msg.id]);
  }
  return results;
}

/** Returns true if the message is gone (deleted by ScamGuard). */
async function isDeleted(channelId: string, messageId: string): Promise<boolean> {
  try {
    const channel = (await spammer.channels.fetch(channelId)) as TextChannel;
    await channel.messages.fetch(messageId);
    return false;
  } catch {
    return true;
  }
}

/** Returns true if the spammer bot's guild member is currently timed out. */
async function isTimedOut(): Promise<boolean> {
  try {
    const guild = await spammer.guilds.fetch(TEST_GUILD_ID);
    const member = await guild.members.fetch(spammer.user!.id);
    const until = member.communicationDisabledUntilTimestamp;
    return until !== null && until > Date.now();
  } catch {
    return false;
  }
}

/** Remove timeout from the spammer bot member (cleanup between tests). */
async function removeTimeout(): Promise<void> {
  try {
    const guild = await spammer.guilds.fetch(TEST_GUILD_ID);
    const member = await guild.members.fetch(spammer.user!.id);
    await member.timeout(null, 'ScamGuard test cleanup');
  } catch {}
}

/** Try to delete leftover test messages (for tests that should NOT trigger). */
async function cleanupMessages(pairs: [string, string][]): Promise<void> {
  for (const [channelId, messageId] of pairs) {
    try {
      const channel = (await spammer.channels.fetch(channelId)) as TextChannel;
      await channel.messages.delete(messageId);
    } catch {}
  }
}

beforeAll(async () => {
  if (!SPAMMER_TOKEN) throw new Error('Missing SPAMMER_TOKEN in .env');
  if (!TEST_GUILD_ID) throw new Error('Missing TEST_GUILD_ID in .env');
  if (CHANNEL_IDS.length < 4)
    throw new Error('TEST_CHANNEL_IDS must have at least 4 channel IDs');

  await spammer.login(SPAMMER_TOKEN);
  // Wait for the client to be fully ready
  await new Promise<void>(resolve => spammer.once('ready', () => resolve()));
  await wait(1_000);
}, 15_000);

afterAll(async () => {
  await removeTimeout();
  spammer.destroy();
});

describe('ScamGuard — live spam detection', () => {

  /**
   * SHOULD trigger.
   * Same image → 3 channels → within 60s.
   * ScamGuard must delete all 3 messages and timeout the user.
   */
  it('Scenario 1: same image in 3 channels → detects spam', async () => {
    const channels = CHANNEL_IDS.slice(0, 3);
    const pairs = await sendSameAttachment(channels, 'scam_s1.png');

    await wait(SCAM_GUARD_WAIT_MS);

    const deletedFlags = await Promise.all(pairs.map(([ch, id]) => isDeleted(ch, id)));
    expect(deletedFlags.every(Boolean), 'all spam messages should be deleted').toBe(true);
    expect(await isTimedOut(), 'user should be timed out').toBe(true);

    await removeTimeout();
    await wait(500);
  }, 30_000);

  /**
   * Should NOT trigger.
   * Same image → only 2 channels → below the 3-channel threshold.
   * ScamGuard must not act.
   */
  it('Scenario 2: same image in 2 channels → below threshold, no action', async () => {
    const channels = CHANNEL_IDS.slice(0, 2);
    const pairs = await sendSameAttachment(channels, 'scam_s2.png');

    await wait(SCAM_GUARD_WAIT_MS);

    const deletedFlags = await Promise.all(pairs.map(([ch, id]) => isDeleted(ch, id)));
    expect(deletedFlags.some(Boolean), 'messages should NOT be deleted').toBe(false);
    expect(await isTimedOut(), 'user should NOT be timed out').toBe(false);

    await cleanupMessages(pairs);
    await wait(500);
  }, 30_000);

  /**
   * Should NOT trigger.
   * Each channel gets a differently-named attachment → 3 distinct tracker keys.
   * ScamGuard only fires when the same key appears in 3+ channels.
   */
  it('Scenario 3: different images in 3 channels → different keys, no action', async () => {
    const channels = CHANNEL_IDS.slice(0, 3);
    const pairs = await sendDifferentAttachments(channels);

    await wait(SCAM_GUARD_WAIT_MS);

    const deletedFlags = await Promise.all(pairs.map(([ch, id]) => isDeleted(ch, id)));
    expect(deletedFlags.some(Boolean), 'messages should NOT be deleted').toBe(false);
    expect(await isTimedOut(), 'user should NOT be timed out').toBe(false);

    await cleanupMessages(pairs);
    await wait(500);
  }, 30_000);

  /**
   * Should NOT trigger.
   * Plain text messages with no attachment → ScamGuard ignores them entirely.
   */
  it('Scenario 4: no attachment in 3 channels → ignored, no action', async () => {
    const channels = CHANNEL_IDS.slice(0, 3);
    const pairs = await sendTextOnly(channels);

    await wait(SCAM_GUARD_WAIT_MS);

    const deletedFlags = await Promise.all(pairs.map(([ch, id]) => isDeleted(ch, id)));
    expect(deletedFlags.some(Boolean), 'text messages should NOT be deleted').toBe(false);
    expect(await isTimedOut(), 'user should NOT be timed out').toBe(false);

    await cleanupMessages(pairs);
    await wait(500);
  }, 30_000);

  /**
   * SHOULD trigger, step by step.
   * Verifies that ScamGuard does NOT act at 1 or 2 channels,
   * and fires exactly when the 3rd channel is hit.
   */
  it('Scenario 5: trigger fires precisely on the 3rd channel', async () => {
    const [ch1Id, ch2Id, ch3Id] = CHANNEL_IDS.slice(0, 3) as [string, string, string];
    const file = () => new AttachmentBuilder(SCAM_PNG, { name: 'scam_s5.png' });

    const ch1 = (await spammer.channels.fetch(ch1Id)) as TextChannel;
    const msg1 = await ch1.send({ files: [file()] });
    await wait(600);

    // After 1 channel — must not have acted
    expect(await isDeleted(ch1Id, msg1.id), 'msg1 should still exist after 1 channel').toBe(false);
    expect(await isTimedOut(), 'should not be timed out after 1 channel').toBe(false);

    const ch2 = (await spammer.channels.fetch(ch2Id)) as TextChannel;
    const msg2 = await ch2.send({ files: [file()] });
    await wait(600);

    // After 2 channels — still must not have acted
    expect(await isDeleted(ch1Id, msg1.id), 'msg1 should still exist after 2 channels').toBe(false);
    expect(await isDeleted(ch2Id, msg2.id), 'msg2 should still exist after 2 channels').toBe(false);
    expect(await isTimedOut(), 'should not be timed out after 2 channels').toBe(false);

    const ch3 = (await spammer.channels.fetch(ch3Id)) as TextChannel;
    const msg3 = await ch3.send({ files: [file()] });

    // 3rd channel sent — now ScamGuard should fire
    await wait(SCAM_GUARD_WAIT_MS);

    expect(await isDeleted(ch1Id, msg1.id), 'msg1 should be deleted after trigger').toBe(true);
    expect(await isDeleted(ch2Id, msg2.id), 'msg2 should be deleted after trigger').toBe(true);
    expect(await isDeleted(ch3Id, msg3.id), 'msg3 should be deleted after trigger').toBe(true);
    expect(await isTimedOut(), 'user should be timed out after trigger').toBe(true);

    await removeTimeout();
    await wait(500);
  }, 45_000);

});
