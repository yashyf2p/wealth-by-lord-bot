require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = [
  new SlashCommandBuilder()
    .setName("send")
    .setDescription("Send a message to a Discord channel")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Choose the text channel")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("Message to send")
        .setRequired(true)
        .setMaxLength(2000)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
];

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("✅ /send command registered");
  } catch (error) {
    console.error("❌ Failed to register slash command:", error);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "send") return;

  const channel = interaction.options.getChannel("channel");
  const message = interaction.options.getString("message");

  try {
    await channel.send({
      content: message,
      allowedMentions: { parse: [] }
    });

    await interaction.reply({
      content: `✅ Message sent to ${channel}`,
      ephemeral: true,
    });
  } catch (error) {
    console.error("❌ Failed to send message:", error);

    const reply = {
      content: "❌ I couldn't send the message. Check the bot's channel permissions.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

client.login(token);
