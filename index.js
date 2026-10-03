require("dotenv").config();

const http = require("http");

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  Events,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("❌ Missing DISCORD_TOKEN");
  process.exit(1);
}

// ======================================================
// RENDER WEB SERVER
// ======================================================

const PORT = process.env.PORT || 3000;

http
  .createServer((req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/plain",
    });

    res.end("TTC Bot is online!");
  })
  .listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
  });

// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
});

// ======================================================
// COMMANDS
// ======================================================

const commands = [
  new SlashCommandBuilder()
    .setName("send")
    .setDescription("Send a TTC embed message")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Choose where the message should be sent")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),
].map(command => command.toJSON());

// ======================================================
// BOT READY
// ======================================================

client.once(
  Events.ClientReady,
  async readyClient => {
    console.log(
      `✅ Logged in as ${readyClient.user.tag}`
    );

    const rest =
      new REST({
        version: "10",
      }).setToken(token);

    try {
      await rest.put(
        Routes.applicationCommands(
          readyClient.user.id
        ),
        {
          body: commands,
        }
      );

      console.log(
        "✅ TTC slash commands registered"
      );

    } catch (error) {
      console.error(
        "❌ Failed to register commands:",
        error
      );
    }
  }
);

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  Events.InteractionCreate,
  async interaction => {
    try {

      // ==================================================
      // /SEND COMMAND
      // ==================================================

      if (
        interaction.isChatInputCommand() &&
        interaction.commandName === "send"
      ) {
        if (
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
          )
        ) {
          return interaction.reply({
            content:
              "❌ Only administrators can use `/send`.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const channel =
          interaction.options.getChannel(
            "channel"
          );

        const modal =
          new ModalBuilder()
            .setCustomId(
              `send_modal:${channel.id}`
            )
            .setTitle(
              "Send TTC Message"
            );

        const titleInput =
          new TextInputBuilder()
            .setCustomId(
              "send_title"
            )
            .setLabel(
              "Title"
            )
            .setPlaceholder(
              "TTC ANNOUNCEMENT"
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setMaxLength(256)
            .setRequired(true);

        const messageInput =
          new TextInputBuilder()
            .setCustomId(
              "send_message"
            )
            .setLabel(
              "Message"
            )
            .setPlaceholder(
              "Write your message here...\n\nYou can use blank lines."
            )
            .setStyle(
              TextInputStyle.Paragraph
            )
            .setMaxLength(4000)
            .setRequired(true);

        const imageInput =
          new TextInputBuilder()
            .setCustomId(
              "send_image"
            )
            .setLabel(
              "Image URL (optional)"
            )
            .setPlaceholder(
              "https://..."
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(
              titleInput
            ),

          new ActionRowBuilder()
            .addComponents(
              messageInput
            ),

          new ActionRowBuilder()
            .addComponents(
              imageInput
            )
        );

        return interaction.showModal(
          modal
        );
      }

      // ==================================================
      // SEND MODAL SUBMISSION
      // ==================================================

      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
          "send_modal:"
        )
      ) {
        if (
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
          )
        ) {
          return interaction.reply({
            content:
              "❌ Only administrators can send messages.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const channelId =
          interaction.customId.split(
            ":"
          )[1];

        const channel =
          interaction.guild.channels.cache.get(
            channelId
          );

        if (
          !channel ||
          !channel.isTextBased()
        ) {
          return interaction.reply({
            content:
              "❌ I couldn't find that channel.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const title =
          interaction.fields.getTextInputValue(
            "send_title"
          );

        const message =
          interaction.fields.getTextInputValue(
            "send_message"
          );

        const image =
          interaction.fields.getTextInputValue(
            "send_image"
          );

        const embed =
          new EmbedBuilder()
            .setTitle(title)
            .setDescription(message)
            .setColor(0x38bdf8)
            .setFooter({
              text:
                "TTC",
            })
            .setTimestamp();

        if (image.trim()) {
          try {
            new URL(image);

            embed.setImage(
              image.trim()
            );
          } catch {
            return interaction.reply({
              content:
                "❌ The image URL isn't valid.",
              flags:
                MessageFlags.Ephemeral,
            });
          }
        }

        await channel.send({
          embeds: [embed],
        });

        return interaction.reply({
          content:
            `✅ TTC message sent to ${channel}.`,
          flags:
            MessageFlags.Ephemeral,
        });
      }

    } catch (error) {
      console.error(
        "❌ Interaction error:",
        error
      );

      if (
        interaction.replied ||
        interaction.deferred
      ) {
        return interaction
          .followUp({
            content:
              "❌ Something went wrong.",
            flags:
              MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }

      return interaction
        .reply({
          content:
            "❌ Something went wrong.",
          flags:
            MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }
  }
);

client.login(token);

