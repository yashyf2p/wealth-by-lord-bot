require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ Missing DISCORD_TOKEN");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = [
  new SlashCommandBuilder()
    .setName("send")
    .setDescription("Send an embed message to a channel")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Choose the channel")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("title")
        .setDescription("Title of the embed")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("Main message")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("image")
        .setDescription("Optional image URL")
        .setRequired(false)
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

    console.log("✅ /send embed command registered");
  } catch (error) {
    console.error(error);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "send") return;

  const channel = interaction.options.getChannel("channel");
  const title = interaction.options.getString("title");
  const message = interaction.options.getString("message");
  const image = interaction.options.getString("image");

  try {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(message)
      .setColor(0x2b2d31)
      .setFooter({
        text: "Wealth By Lords • New Server. New Us.",
      })
      .setTimestamp();

    if (image) {
      embed.setImage(image);
    }

    await channel.send({
      embeds: [embed],
    });

    await interaction.reply({
      content: `✅ Embed sent to ${channel}`,
      ephemeral: true,
    });

  } catch (error) {
    console.error(error);

    await interaction.reply({
      content: "❌ I couldn't send the embed.",
      ephemeral: true,
    });
  }
});

client.login(token);

