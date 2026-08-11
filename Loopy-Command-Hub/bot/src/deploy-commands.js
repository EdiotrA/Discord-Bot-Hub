const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

function collectCommands(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectCommands(fullPath);
    } else if (entry.name.endsWith('.js') && !entry.name.startsWith('_')) {
      try {
        const cmd = require(fullPath);
        if (cmd?.data?.toJSON) commands.push(cmd.data.toJSON());
      } catch (err) {
        console.error(`Failed to load ${fullPath}:`, err.message);
      }
    }
  }
}

collectCommands(commandsPath);

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Deploying ${commands.length} slash commands...`);
    const data = await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`Successfully deployed ${data.length} commands globally!`);
  } catch (err) {
    console.error('Deploy failed:', err);
    process.exit(1);
  }
})();
