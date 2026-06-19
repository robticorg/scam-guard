import { Client, Events, GatewayIntentBits } from 'discord.js';
import { registerMessageCreate } from './messageCreate';
import { prune } from './tracker';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, () => {
  console.log(`[ScamGuard] online as ${client.user?.tag} (${client.user?.id})`);
  console.log(`[ScamGuard] watching ${client.guilds.cache.size} guild(s)`);
  setInterval(() => { prune(60_000) }, 30_000);
});

registerMessageCreate(client);

if (!process.env.TOKEN) {
  console.error('[ScamGuard] ERROR — TOKEN env var is missing, cannot login');
  process.exit(1);
}

client.login(process.env.TOKEN).catch((err) => {
  console.error('[ScamGuard] catch — login failed:', err);
  process.exit(1);
});
