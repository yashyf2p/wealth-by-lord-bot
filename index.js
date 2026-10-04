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
  ButtonBuilder,
  ButtonStyle,
  Events,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  PermissionsBitField,
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;

// ======================================================
// SETTINGS
// ======================================================

const TICKET_CATEGORY_ID = "1555971064146952313";

const STAFF_ROLE_NAMES = [
  "Founder",
  "Admin",
  "Staff",
];

// ======================================================
// TOKEN CHECK
// ======================================================

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
// HELPERS
// ======================================================

function isStaff(member) {
  if (!member) return false;

  if (
    member.permissions.has(
      PermissionFlagsBits.Administrator
    )
  ) {
    return true;
  }

  return member.roles.cache.some(role =>
    STAFF_ROLE_NAMES.includes(role.name)
  );
}

function cleanChannelName(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

function getTicketTypeLabel(type) {
  const types = {
    support: "Support",
    mc_collab: "MC Collab",
    report: "Report a Player",
    staff_application: "Staff Application",
    other: "Other",
  };

  return types[type] || "Ticket";
}

function getTicketPrefix(type) {
  const prefixes = {
    support: "support",
    mc_collab: "mc-collab",
    report: "report",
    staff_application: "staff-app",
    other: "other",
  };

  return prefixes[type] || "ticket";
}

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

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Post the TTC ticket selection panel")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  new SlashCommandBuilder()
    .setName("closeticket")
    .setDescription("Close the current TTC ticket"),
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

    const rest = new REST({
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
      // /SEND
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
            .setLabel("Title")
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
            .setLabel("Message")
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
            .addComponents(titleInput),

          new ActionRowBuilder()
            .addComponents(messageInput),

          new ActionRowBuilder()
            .addComponents(imageInput)
        );

        return interaction.showModal(
          modal
        );
      }

      // ==================================================
      // SEND MODAL
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
              "❌ Only administrators can use this.",
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
              text: "TTC",
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

      // ==================================================
      // /TICKETPANEL
      // ==================================================

      if (
        interaction.isChatInputCommand() &&
        interaction.commandName ===
          "ticketpanel"
      ) {
        if (
          !interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
          )
        ) {
          return interaction.reply({
            content:
              "❌ Only administrators can create the ticket panel.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🎫 TTC TICKETS"
            )
            .setDescription(
              "Need to contact the TTC team?\n\n" +
              "Choose the ticket type that best matches what you need below.\n\n" +
              "Please do not create unnecessary tickets."
            )
            .setColor(0x38bdf8)
            .setFooter({
              text:
                "TTC Ticket System",
            });

        const menu =
          new StringSelectMenuBuilder()
            .setCustomId(
              "ticket_select"
            )
            .setPlaceholder(
              "Choose a ticket type..."
            )
            .addOptions(
              {
                label:
                  "Support",
                description:
                  "Get help from TTC staff",
                value:
                  "support",
                emoji:
                  "🛠️",
              },
              {
                label:
                  "MC Collab",
                description:
                  "Contact TTC about an MC collaboration",
                value:
                  "mc_collab",
                emoji:
                  "🤝",
              },
              {
                label:
                  "Report a Player",
                description:
                  "Report a player or member",
                value:
                  "report",
                emoji:
                  "🚨",
              },
              {
                label:
                  "Staff Application",
                description:
                  "Apply to join the TTC staff team",
                value:
                  "staff_application",
                emoji:
                  "📝",
              },
              {
                label:
                  "Other / General Inquiry",
                description:
                  "Anything that does not fit another category",
                value:
                  "other",
                emoji:
                  "❓",
              }
            );

        const row =
          new ActionRowBuilder()
            .addComponents(menu);

        await interaction.channel.send({
          embeds: [embed],
          components: [row],
        });

        return interaction.reply({
          content:
            "✅ TTC ticket panel created.",
          flags:
            MessageFlags.Ephemeral,
        });
      }

      // ==================================================
      // TICKET SELECT
      // ==================================================

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId ===
          "ticket_select"
      ) {
        await interaction.deferReply({
          flags:
            MessageFlags.Ephemeral,
        });

        const type =
          interaction.values[0];

        const typeLabel =
          getTicketTypeLabel(type);

        // Existing ticket check
        const existingTicket =
          interaction.guild.channels.cache.find(
            channel =>
              channel.type ===
                ChannelType.GuildText &&
              channel.topic?.includes(
                `ticketOwner:${interaction.user.id}`
              )
          );

        if (existingTicket) {
          return interaction.editReply({
            content:
              `❌ You already have an open ticket: ${existingTicket}`,
          });
        }

        // IMPORTANT FIX:
        // Fetch category directly from Discord
        let category;

        try {
          category =
            await interaction.guild.channels.fetch(
              TICKET_CATEGORY_ID
            );
        } catch (error) {
          console.error(
            "❌ Failed to fetch ticket category:",
            error
          );

          return interaction.editReply({
            content:
              "❌ I could not find the ticket category. Check the category ID and bot permissions.",
          });
        }

        if (!category) {
          return interaction.editReply({
            content:
              "❌ I could not find the ticket category.",
          });
        }

        if (
          category.type !==
          ChannelType.GuildCategory
        ) {
          return interaction.editReply({
            content:
              `❌ The ID \`${TICKET_CATEGORY_ID}\` exists, but it is not a Discord category.`,
          });
        }

        const staffRoles =
          interaction.guild.roles.cache.filter(
            role =>
              STAFF_ROLE_NAMES.includes(
                role.name
              )
          );

        const permissionOverwrites = [
          {
            id:
              interaction.guild.roles.everyone.id,
            deny: [
              PermissionsBitField.Flags
                .ViewChannel,
            ],
          },
          {
            id:
              interaction.user.id,
            allow: [
              PermissionsBitField.Flags
                .ViewChannel,
              PermissionsBitField.Flags
                .SendMessages,
              PermissionsBitField.Flags
                .ReadMessageHistory,
              PermissionsBitField.Flags
                .AttachFiles,
              PermissionsBitField.Flags
                .EmbedLinks,
            ],
          },
          {
            id:
              client.user.id,
            allow: [
              PermissionsBitField.Flags
                .ViewChannel,
              PermissionsBitField.Flags
                .SendMessages,
              PermissionsBitField.Flags
                .ReadMessageHistory,
              PermissionsBitField.Flags
                .ManageChannels,
              PermissionsBitField.Flags
                .EmbedLinks,
            ],
          },
        ];

        for (
          const role of
          staffRoles.values()
        ) {
          permissionOverwrites.push({
            id: role.id,
            allow: [
              PermissionsBitField.Flags
                .ViewChannel,
              PermissionsBitField.Flags
                .SendMessages,
              PermissionsBitField.Flags
                .ReadMessageHistory,
              PermissionsBitField.Flags
                .AttachFiles,
              PermissionsBitField.Flags
                .EmbedLinks,
            ],
          });
        }

        const username =
          cleanChannelName(
            interaction.user.username
          ) || "member";

        const prefix =
          getTicketPrefix(type);

        const ticketChannel =
          await interaction.guild.channels.create({
            name:
              `${prefix}-${username}`,

            type:
              ChannelType.GuildText,

            parent:
              category.id,

            topic:
              `ticketOwner:${interaction.user.id}|type:${type}|claimedBy:none`,

            permissionOverwrites:
              permissionOverwrites,
          });

        const ticketEmbed =
          new EmbedBuilder()
            .setTitle(
              `🎫 ${typeLabel}`
            )
            .setDescription(
              `Welcome ${interaction.user}!\n\n` +
              `A member of the **TTC Staff Team** will assist you here.\n\n` +
              `Please explain your request clearly and provide any important information.\n\n` +
              `**Ticket Type:** ${typeLabel}`
            )
            .setColor(0x38bdf8)
            .setFooter({
              text:
                "TTC Ticket System",
            });

        const claimButton =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "ticket_claim"
                )
                .setLabel(
                  "Claim Ticket"
                )
                .setEmoji("🙋")
                .setStyle(
                  ButtonStyle.Primary
                )
            );

        await ticketChannel.send({
          content:
            `${interaction.user}`,
          embeds: [
            ticketEmbed,
          ],
          components: [
            claimButton,
          ],
        });

        return interaction.editReply({
          content:
            `✅ Your ticket has been created: ${ticketChannel}`,
        });
      }

      // ==================================================
      // CLAIM TICKET
      // ==================================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "ticket_claim"
      ) {
        if (
          !isStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ Only TTC staff can claim tickets.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const channel =
          interaction.channel;

        if (
          !channel.topic?.includes(
            "ticketOwner:"
          )
        ) {
          return interaction.reply({
            content:
              "❌ This is not a TTC ticket channel.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        if (
          !channel.topic.includes(
            "claimedBy:none"
          )
        ) {
          return interaction.reply({
            content:
              "❌ This ticket has already been claimed.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const newTopic =
          channel.topic.replace(
            "claimedBy:none",
            `claimedBy:${interaction.user.id}`
          );

        await channel.setTopic(
          newTopic
        );

        const disabledButton =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "ticket_claimed"
                )
                .setLabel(
                  `Claimed by ${interaction.user.username}`
                )
                .setStyle(
                  ButtonStyle.Secondary
                )
                .setDisabled(true)
            );

        await interaction.update({
          components: [
            disabledButton,
          ],
        });

        await channel.send({
          content:
            `🙋 ${interaction.user} has claimed this ticket.`,
        });

        return;
      }

      // ==================================================
      // /CLOSETICKET
      // ==================================================

      if (
        interaction.isChatInputCommand() &&
        interaction.commandName ===
          "closeticket"
      ) {
        if (
          !isStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ Only TTC staff can close tickets.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const channel =
          interaction.channel;

        if (
          !channel.topic?.includes(
            "ticketOwner:"
          )
        ) {
          return interaction.reply({
            content:
              "❌ `/closeticket` can only be used inside a TTC ticket.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        await interaction.reply({
          content:
            "🔒 Ticket closing in **5 seconds**...",
        });

        setTimeout(
          async () => {
            try {
              await channel.delete(
                `Ticket closed by ${interaction.user.tag}`
              );
            } catch (error) {
              console.error(
                "❌ Failed to delete ticket:",
                error
              );
            }
          },
          5000
        );

        return;
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
