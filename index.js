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
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const { Pool } = require("pg");

const token = process.env.DISCORD_TOKEN;
const databaseUrl = process.env.DATABASE_URL;

if (!token) {
  console.error("❌ Missing DISCORD_TOKEN");
  process.exit(1);
}

if (!databaseUrl) {
  console.error("❌ Missing DATABASE_URL");
  process.exit(1);
}

// ======================================================
// DATABASE
// ======================================================

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("railway.internal")
    ? false
    : { rejectUnauthorized: false },
});

// ======================================================
// DISCORD CLIENT
// ======================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ======================================================
// SHOP
// ======================================================

const SHOP_ITEMS = [
  {
    id: "website",
    name: "Custom Website",
    price: 25000,
    description: "A custom website made for you.",
  },
  {
    id: "paypal10",
    name: "€10 PayPal",
    price: 23500,
    description: "€10 sent through PayPal.",
  },
  {
    id: "brawlpass",
    name: "Brawl Pass",
    price: 19780,
    description: "1x Brawl Pass.",
  },
  {
    id: "everyone_ping",
    name: "@everyone Ping",
    price: 9500,
    description:
      "1x @everyone ping in a server of your choice.",
  },
  {
    id: "double30",
    name: "2x Chat Tokens — 30 Days",
    price: 9000,
    description:
      "Earn 2 WBL Tokens per active chat minute for 30 days.",
  },
  {
    id: "giveaway3",
    name: "3 Extra Giveaway Entries",
    price: 7000,
    description:
      "Receive 3 additional giveaway entries.",
  },
  {
    id: "vip_fl",
    name: "VIP Role + WBL Roster FL",
    price: 5000,
    description:
      "VIP role + friend-list add from any WBL roster player.",
  },
  {
    id: "tierc_fl",
    name: "1x Tier C FL",
    price: 3000,
    description:
      "1x Tier C friend-list add — organization's choice.",
  },
  {
    id: "goat",
    name: "GOAT Role",
    price: 1500,
    description: "Receive the GOAT role.",
  },
  {
    id: "giveaway1",
    name: "1 Extra Giveaway Entry",
    price: 750,
    description:
      "Receive 1 additional giveaway entry.",
  },
];

// ======================================================
// COMMANDS
// ======================================================

const commands = [
  // /send ADMIN
  new SlashCommandBuilder()
    .setName("send")
    .setDescription("Send a professional WBL embed")
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

  // /give ADMIN
  new SlashCommandBuilder()
    .setName("give")
    .setDescription("Admin: give WBL Tokens to a member")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Member receiving the tokens")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Number of WBL Tokens")
        .setMinValue(1)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  // /drop ADMIN
  new SlashCommandBuilder()
    .setName("drop")
    .setDescription("Admin: create a first-person token drop")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Tokens the first person receives")
        .setMinValue(1)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Optional channel for the drop")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  // /double ADMIN
  new SlashCommandBuilder()
    .setName("double")
    .setDescription("Admin: activate server-wide 2x chat tokens")
    .addIntegerOption(option =>
      option
        .setName("minutes")
        .setDescription("How many minutes should 2x last?")
        .setMinValue(1)
        .setMaxValue(1440)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  // /wallet
  new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Check a WBL Token balance")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Optional member to check")
        .setRequired(false)
    ),

  // /collect
  new SlashCommandBuilder()
    .setName("collect")
    .setDescription(
      "Collect 0–150 WBL Tokens after sending 5 messages"
    ),

  // /daily
  new SlashCommandBuilder()
    .setName("daily")
    .setDescription("View or claim your daily challenge"),

  // /leaderboard
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the richest WBL members"),

  // /shop
  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Open the WBL Token Shop"),
].map(command => command.toJSON());

// ======================================================
// HELPERS
// ======================================================

function randomInt(min, max) {
  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;
}

function luxembourgDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Luxembourg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = type =>
    parts.find(part => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  );
}

// ======================================================
// DATABASE SETUP
// ======================================================

async function setupDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      balance BIGINT NOT NULL DEFAULT 0,
      last_collect BIGINT NOT NULL DEFAULT 0,
      last_chat_reward BIGINT NOT NULL DEFAULT 0,
      personal_double_until BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      day TEXT NOT NULL,
      messages INTEGER NOT NULL DEFAULT 0,
      target INTEGER NOT NULL,
      reward INTEGER NOT NULL,
      claimed BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (guild_id, user_id, day)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_events (
      guild_id TEXT PRIMARY KEY,
      double_until BIGINT NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS token_drops (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT,
      amount INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      claimed_by TEXT,
      claimed_at BIGINT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      price INTEGER NOT NULL,
      purchased_at BIGINT NOT NULL
    )
  `);

  console.log("✅ Database ready");
}

async function ensureUser(guildId, userId, db = pool) {
  await db.query(
    `
    INSERT INTO users (guild_id, user_id)
    VALUES ($1, $2)

    ON CONFLICT (guild_id, user_id)
    DO NOTHING
    `,
    [guildId, userId]
  );
}

async function ensureDaily(guildId, userId, db = pool) {
  const day = luxembourgDay();

  await db.query(
    `
    INSERT INTO daily_stats (
      guild_id,
      user_id,
      day,
      target,
      reward
    )
    VALUES ($1, $2, $3, $4, $5)

    ON CONFLICT (guild_id, user_id, day)
    DO NOTHING
    `,
    [
      guildId,
      userId,
      day,
      randomInt(100, 150),
      randomInt(100, 300),
    ]
  );

  const result = await db.query(
    `
    SELECT *
    FROM daily_stats
    WHERE guild_id = $1
      AND user_id = $2
      AND day = $3
    `,
    [guildId, userId, day]
  );

  return result.rows[0];
}

async function serverDoubleActive(guildId) {
  const result = await pool.query(
    `
    SELECT double_until
    FROM guild_events
    WHERE guild_id = $1
    `,
    [guildId]
  );

  if (!result.rows.length) return false;

  return (
    Number(result.rows[0].double_until) >
    Date.now()
  );
}

// ======================================================
// SHOP BUTTONS
// ======================================================

function buildShopRows() {
  const rows = [];

  for (let i = 0; i < SHOP_ITEMS.length; i += 5) {
    const row = new ActionRowBuilder();

    SHOP_ITEMS
      .slice(i, i + 5)
      .forEach((item, localIndex) => {
        const itemNumber = i + localIndex + 1;

        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`shop_buy:${item.id}`)
            .setLabel(`Buy #${itemNumber}`)
            .setStyle(ButtonStyle.Primary)
        );
      });

    rows.push(row);
  }

  return rows;
}

// ======================================================
// START BOT
// ======================================================

client.once(
  Events.ClientReady,
  async readyClient => {
    console.log(
      `✅ Logged in as ${readyClient.user.tag}`
    );

    try {
      await setupDatabase();

      const rest = new REST({
        version: "10",
      }).setToken(token);

      await rest.put(
        Routes.applicationCommands(
          readyClient.user.id
        ),
        {
          body: commands,
        }
      );

      console.log(
        "✅ WBL slash commands registered"
      );
    } catch (error) {
      console.error(
        "❌ Startup error:",
        error
      );
    }
  }
);

// ======================================================
// CHAT EARNING
// ======================================================

client.on(
  Events.MessageCreate,
  async message => {
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = message.content.trim();

    // Messages shorter than 2 characters do not count
    if (content.length < 2) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const now = Date.now();

    try {
      await ensureUser(guildId, userId);

      await ensureDaily(
        guildId,
        userId
      );

      // Every valid message counts toward daily challenge
      await pool.query(
        `
        UPDATE daily_stats
        SET messages = messages + 1

        WHERE guild_id = $1
          AND user_id = $2
          AND day = $3
        `,
        [
          guildId,
          userId,
          luxembourgDay(),
        ]
      );

      const result = await pool.query(
        `
        SELECT
          last_chat_reward,
          personal_double_until

        FROM users

        WHERE guild_id = $1
          AND user_id = $2
        `,
        [guildId, userId]
      );

      const user = result.rows[0];

      // 1 earning event every 60 seconds
      if (
        now -
          Number(user.last_chat_reward) >=
        60000
      ) {
        const personalDouble =
          Number(
            user.personal_double_until
          ) > now;

        const globalDouble =
          await serverDoubleActive(
            guildId
          );

        // Max 2x
        const chatReward =
          personalDouble || globalDouble
            ? 2
            : 1;

        await pool.query(
          `
          UPDATE users
          SET
            balance = balance + $1,
            last_chat_reward = $2

          WHERE guild_id = $3
            AND user_id = $4
          `,
          [
            chatReward,
            now,
            guildId,
            userId,
          ]
        );
      }
    } catch (error) {
      console.error(
        "❌ Chat tracking error:",
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
      // /SEND MODAL SUBMISSION
      // ==================================================

      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
          "send_modal:"
        )
      ) {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content:
              "❌ Only administrators can use this.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const channelId =
          interaction.customId.split(":")[1];

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
              text: "Wealth By Lords",
            })
            .setTimestamp();

        if (image.trim()) {
          try {
            new URL(image);
            embed.setImage(image);
          } catch {
            return interaction.reply({
              content:
                "❌ That image URL is invalid.",
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
            `✅ Message sent to ${channel}.`,
          flags:
            MessageFlags.Ephemeral,
        });
      }

      // ==================================================
      // BUTTONS
      // ==================================================

      if (interaction.isButton()) {

        // =================================================
        // DROP CLAIM
        // =================================================

        if (
          interaction.customId.startsWith(
            "drop_claim:"
          )
        ) {
          const dropId =
            interaction.customId.split(
              ":"
            )[1];

          const db =
            await pool.connect();

          try {
            await db.query("BEGIN");

            const result =
              await db.query(
                `
                SELECT *
                FROM token_drops
                WHERE id = $1
                FOR UPDATE
                `,
                [dropId]
              );

            if (!result.rows.length) {
              await db.query(
                "ROLLBACK"
              );

              return interaction.reply({
                content:
                  "❌ This drop no longer exists.",
                flags:
                  MessageFlags.Ephemeral,
              });
            }

            const drop =
              result.rows[0];

            if (drop.claimed_by) {
              await db.query(
                "ROLLBACK"
              );

              return interaction.reply({
                content:
                  `❌ This drop was already claimed by <@${drop.claimed_by}>.`,
                flags:
                  MessageFlags.Ephemeral,
              });
            }

            await ensureUser(
              drop.guild_id,
              interaction.user.id,
              db
            );

            await db.query(
              `
              UPDATE users
              SET balance =
                balance + $1

              WHERE guild_id = $2
                AND user_id = $3
              `,
              [
                drop.amount,
                drop.guild_id,
                interaction.user.id,
              ]
            );

            await db.query(
              `
              UPDATE token_drops
              SET
                claimed_by = $1,
                claimed_at = $2

              WHERE id = $3
              `,
              [
                interaction.user.id,
                Date.now(),
                dropId,
              ]
            );

            await db.query("COMMIT");

            const embed =
              new EmbedBuilder()
                .setTitle(
                  "🎁 WBL TOKEN DROP — CLAIMED"
                )
                .setDescription(
                  `🏆 ${interaction.user} was first and won **${Number(
                    drop.amount
                  ).toLocaleString()} WBL Tokens**!`
                )
                .setColor(0x38bdf8)
                .setFooter({
                  text:
                    "Wealth By Lords",
                });

            const disabledButton =
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(
                      `drop_claim:${dropId}`
                    )
                    .setLabel(
                      "CLAIMED"
                    )
                    .setStyle(
                      ButtonStyle.Secondary
                    )
                    .setDisabled(true)
                );

            return interaction.update({
              embeds: [embed],
              components: [
                disabledButton,
              ],
            });

          } catch (error) {
            await db
              .query("ROLLBACK")
              .catch(() => {});

            throw error;
          } finally {
            db.release();
          }
        }

        // =================================================
        // SHOP BUY
        // =================================================

        if (
          interaction.customId.startsWith(
            "shop_buy:"
          )
        ) {
          const itemId =
            interaction.customId.split(
              ":"
            )[1];

          const item =
            SHOP_ITEMS.find(
              shopItem =>
                shopItem.id ===
                itemId
            );

          if (!item) {
            return interaction.reply({
              content:
                "❌ This item no longer exists.",
              flags:
                MessageFlags.Ephemeral,
            });
          }

          const db =
            await pool.connect();

          try {
            await db.query("BEGIN");

            await ensureUser(
              interaction.guildId,
              interaction.user.id,
              db
            );

            const result =
              await db.query(
                `
                SELECT
                  balance,
                  personal_double_until

                FROM users

                WHERE guild_id = $1
                  AND user_id = $2

                FOR UPDATE
                `,
                [
                  interaction.guildId,
                  interaction.user.id,
                ]
              );

            const data =
              result.rows[0];

            const balance =
              Number(data.balance);

            if (
              balance < item.price
            ) {
              await db.query(
                "ROLLBACK"
              );

              return interaction.reply({
                content:
                  `❌ You need **${(
                    item.price -
                    balance
                  ).toLocaleString()} more WBL Tokens** to buy **${item.name}**.`,
                flags:
                  MessageFlags.Ephemeral,
              });
            }

            await db.query(
              `
              UPDATE users
              SET balance =
                balance - $1

              WHERE guild_id = $2
                AND user_id = $3
              `,
              [
                item.price,
                interaction.guildId,
                interaction.user.id,
              ]
            );

            // 30-day personal 2x
            if (
              item.id === "double30"
            ) {
              const now =
                Date.now();

              const current =
                Number(
                  data.personal_double_until
                );

              const startingPoint =
                Math.max(
                  now,
                  current
                );

              const newUntil =
                startingPoint +
                30 *
                  24 *
                  60 *
                  60 *
                  1000;

              await db.query(
                `
                UPDATE users
                SET personal_double_until =
                  $1

                WHERE guild_id = $2
                  AND user_id = $3
                `,
                [
                  newUntil,
                  interaction.guildId,
                  interaction.user.id,
                ]
              );
            }

            await db.query(
              `
              INSERT INTO purchases (
                guild_id,
                user_id,
                item_id,
                item_name,
                price,
                purchased_at
              )

              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6
              )
              `,
              [
                interaction.guildId,
                interaction.user.id,
                item.id,
                item.name,
                item.price,
                Date.now(),
              ]
            );

            await db.query("COMMIT");

            if (
              item.id === "double30"
            ) {
              return interaction.reply({
                content:
                  `✅ You bought **${item.name}**!\n⚡ Your 2x chat-token boost is active for **30 days**.`,
                flags:
                  MessageFlags.Ephemeral,
              });
            }

            return interaction.reply({
              content:
                `✅ You bought **${item.name}** for **${item.price.toLocaleString()} WBL Tokens**.\n\n📩 Your purchase has been recorded. WBL staff will handle the reward.`,
              flags:
                MessageFlags.Ephemeral,
            });

          } catch (error) {
            await db
              .query("ROLLBACK")
              .catch(() => {});

            throw error;
          } finally {
            db.release();
          }
        }

        return;
      }

      // ==================================================
      // SLASH COMMANDS
      // ==================================================

      if (
        !interaction.isChatInputCommand()
      ) {
        return;
      }

      if (!interaction.guildId) {
        return;
      }

      const guildId =
        interaction.guildId;

      // ==================================================
      // /SEND
      // ADMIN ONLY
      // ==================================================

      if (
        interaction.commandName ===
        "send"
      ) {
        if (!isAdmin(interaction)) {
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
              "Send WBL Message"
            );

        const titleInput =
          new TextInputBuilder()
            .setCustomId(
              "send_title"
            )
            .setLabel("Title")
            .setPlaceholder(
              "WBL ANNOUNCEMENT"
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
              "Write your full message here...\n\nYou can use blank lines."
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
      // /GIVE
      // ADMIN ONLY
      // ==================================================

      if (
        interaction.commandName ===
        "give"
      ) {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content:
              "❌ Only administrators can use `/give`.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const user =
          interaction.options.getUser(
            "user"
          );

        const amount =
          interaction.options.getInteger(
            "amount"
          );

        if (user.bot) {
          return interaction.reply({
            content:
              "❌ You cannot give tokens to a bot.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        await ensureUser(
          guildId,
          user.id
        );

        await pool.query(
          `
          UPDATE users
          SET balance =
            balance + $1

          WHERE guild_id = $2
            AND user_id = $3
          `,
          [
            amount,
            guildId,
            user.id,
          ]
        );

        return interaction.reply({
          content:
            `✅ ${user} received **${amount.toLocaleString()} WBL Tokens**.`,
          flags:
            MessageFlags.Ephemeral,
        });
      }

      // ==================================================
      // /DROP
      // ADMIN ONLY
      // FIRST PERSON WINS
      // ==================================================

      if (
        interaction.commandName ===
        "drop"
      ) {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content:
              "❌ Only administrators can use `/drop`.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const amount =
          interaction.options.getInteger(
            "amount"
          );

        const channel =
          interaction.options.getChannel(
            "channel"
          ) ||
          interaction.channel;

        const result =
          await pool.query(
            `
            INSERT INTO token_drops (
              guild_id,
              channel_id,
              amount,
              created_by
            )

            VALUES (
              $1,
              $2,
              $3,
              $4
            )

            RETURNING id
            `,
            [
              guildId,
              channel.id,
              amount,
              interaction.user.id,
            ]
          );

        const dropId =
          result.rows[0].id;

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🎁 WBL TOKEN DROP"
            )
            .setDescription(
              `A WBL Token Drop has appeared!\n\n` +
              `🪙 **${amount.toLocaleString()} WBL Tokens**\n\n` +
              `🏃 The **first person** to press **CLAIM** wins everything!`
            )
            .setColor(0x38bdf8)
            .setFooter({
              text:
                "First come, first served • Wealth By Lords",
            });

        const button =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `drop_claim:${dropId}`
                )
                .setLabel(
                  "🎁 CLAIM"
                )
                .setStyle(
                  ButtonStyle.Success
                )
            );

        const sent =
          await channel.send({
            embeds: [embed],
            components: [button],
          });

        await pool.query(
          `
          UPDATE token_drops
          SET message_id = $1
          WHERE id = $2
          `,
          [
            sent.id,
            dropId,
          ]
        );

        return interaction.reply({
          content:
            `✅ Token drop created in ${channel}.`,
          flags:
            MessageFlags.Ephemeral,
        });
      }

      // ==================================================
      // /DOUBLE
      // ADMIN ONLY
      // ==================================================

      if (
        interaction.commandName ===
        "double"
      ) {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content:
              "❌ Only administrators can use `/double`.",
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const minutes =
          interaction.options.getInteger(
            "minutes"
          );

        const until =
          Date.now() +
          minutes * 60000;

        await pool.query(
          `
          INSERT INTO guild_events (
            guild_id,
            double_until
          )

          VALUES ($1, $2)

          ON CONFLICT (guild_id)

          DO UPDATE SET
            double_until =
              EXCLUDED.double_until
          `,
          [
            guildId,
            until,
          ]
        );

        const embed =
          new EmbedBuilder()
            .setTitle(
              "⚡ WBL DOUBLE TOKEN EVENT"
            )
            .setDescription(
              `Chat rewards are now **2x** for **${minutes} minute${minutes === 1 ? "" : "s"}**!\n\n` +
              `💬 Normal: **1 → 2 tokens/minute**\n` +
              `⚡ Maximum multiplier: **2x**`
            )
            .setColor(0x38bdf8)
            .setFooter({
              text:
                "Wealth By Lords",
            });

        return interaction.reply({
          embeds: [embed],
        });
      }

      // ==================================================
      // /WALLET
      // ==================================================

      if (
        interaction.commandName ===
        "wallet"
      ) {
        const target =
          interaction.options.getUser(
            "user"
          ) ||
          interaction.user;

        await ensureUser(
          guildId,
          target.id
        );

        const result =
          await pool.query(
            `
            SELECT
              balance,
              personal_double_until

            FROM users

            WHERE guild_id = $1
              AND user_id = $2
            `,
            [
              guildId,
              target.id,
            ]
          );

        const data =
          result.rows[0];

        const boostUntil =
          Number(
            data.personal_double_until
          );

        const boost =
          boostUntil > Date.now()
            ? `\n\n⚡ **2x Chat Boost:** Active until <t:${Math.floor(
                boostUntil / 1000
              )}:R>`
            : "";

        const embed =
          new EmbedBuilder()
            .setTitle(
              "💰 WBL Wallet"
            )
            .setThumbnail(
              target.displayAvatarURL()
            )
            .setDescription(
              `${target} has **${Number(
                data.balance
              ).toLocaleString()} WBL Tokens** 🪙${boost}`
            )
            .setColor(0x38bdf8)
            .setFooter({
              text:
                "Wealth By Lords Economy",
            });

        return interaction.reply({
          embeds: [embed],
        });
      }

      // ==================================================
      // /COLLECT
      // ==================================================

      if (
        interaction.commandName ===
        "collect"
      ) {
        await ensureUser(
          guildId,
          interaction.user.id
        );

        const daily =
          await ensureDaily(
            guildId,
            interaction.user.id
          );

        if (
          Number(daily.messages) <
          5
        ) {
          return interaction.reply({
            content:
              `❌ You need to send **5 valid messages today** first.\n\n` +
              `Progress: **${daily.messages}/5**`,
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const result =
          await pool.query(
            `
            SELECT
              balance,
              last_collect

            FROM users

            WHERE guild_id = $1
              AND user_id = $2
            `,
            [
              guildId,
              interaction.user.id,
            ]
          );

        const data =
          result.rows[0];

        const cooldown =
          24 *
          60 *
          60 *
          1000;

        const nextCollect =
          Number(
            data.last_collect
          ) +
          cooldown;

        if (
          Date.now() <
          nextCollect
        ) {
          return interaction.reply({
            content:
              `⏳ You already collected your reward.\n\nCome back <t:${Math.floor(
                nextCollect / 1000
              )}:R>.`,
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const reward =
          randomInt(0, 150);

        await pool.query(
          `
          UPDATE users
          SET
            balance =
              balance + $1,
            last_collect =
              $2

          WHERE guild_id = $3
            AND user_id = $4
          `,
          [
            reward,
            Date.now(),
            guildId,
            interaction.user.id,
          ]
        );

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🎁 WBL COLLECT"
            )
            .setDescription(
              reward === 0
                ? `💀 Unlucky! You received **0 WBL Tokens**.`
                : `You collected **${reward} WBL Tokens**! 🪙`
            )
            .setColor(0x38bdf8)
            .setFooter({
              text:
                "Available again in 24 hours",
            });

        return interaction.reply({
          embeds: [embed],
        });
      }

      // ==================================================
      // /DAILY
      // ==================================================

      if (
        interaction.commandName ===
        "daily"
      ) {
        await ensureUser(
          guildId,
          interaction.user.id
        );

        const daily =
          await ensureDaily(
            guildId,
            interaction.user.id
          );

        if (daily.claimed) {
          return interaction.reply({
            content:
              `✅ You already completed today's daily challenge.\n\nMessages: **${daily.messages}/${daily.target}**`,
            flags:
              MessageFlags.Ephemeral,
          });
        }

        if (
          Number(daily.messages) <
          Number(daily.target)
        ) {
          const embed =
            new EmbedBuilder()
              .setTitle(
                "📅 WBL DAILY CHALLENGE"
              )
              .setDescription(
                `💬 Send **${daily.target} messages today**\n\n` +
                `📊 Progress: **${daily.messages}/${daily.target}**\n\n` +
                `🪙 Reward: **${daily.reward} WBL Tokens**`
              )
              .setColor(0x38bdf8)
              .setFooter({
                text:
                  "Resets daily • Luxembourg time",
              });

          return interaction.reply({
            embeds: [embed],
          });
        }

        const db =
          await pool.connect();

        try {
          await db.query("BEGIN");

          const result =
            await db.query(
              `
              SELECT
                claimed,
                reward

              FROM daily_stats

              WHERE guild_id = $1
                AND user_id = $2
                AND day = $3

              FOR UPDATE
              `,
              [
                guildId,
                interaction.user.id,
                luxembourgDay(),
              ]
            );

          const current =
            result.rows[0];

          if (current.claimed) {
            await db.query(
              "ROLLBACK"
            );

            return interaction.reply({
              content:
                "✅ You already claimed today's reward.",
              flags:
                MessageFlags.Ephemeral,
            });
          }

          await ensureUser(
            guildId,
            interaction.user.id,
            db
          );

          await db.query(
            `
            UPDATE users
            SET balance =
              balance + $1

            WHERE guild_id = $2
              AND user_id = $3
            `,
            [
              current.reward,
              guildId,
              interaction.user.id,
            ]
          );

          await db.query(
            `
            UPDATE daily_stats
            SET claimed = TRUE

            WHERE guild_id = $1
              AND user_id = $2
              AND day = $3
            `,
            [
              guildId,
              interaction.user.id,
              luxembourgDay(),
            ]
          );

          await db.query("COMMIT");

          return interaction.reply({
            content:
              `🏆 **Daily Challenge Complete!**\n\nYou earned **${Number(
                current.reward
              ).toLocaleString()} WBL Tokens** 🪙`,
          });

        } catch (error) {
          await db
            .query("ROLLBACK")
            .catch(() => {});

          throw error;
        } finally {
          db.release();
        }
      }

      // ==================================================
      // /LEADERBOARD
      // ==================================================

      if (
        interaction.commandName ===
        "leaderboard"
      ) {
        const result =
          await pool.query(
            `
            SELECT
              user_id,
              balance

            FROM users

            WHERE guild_id = $1

            ORDER BY balance DESC

            LIMIT 10
            `,
            [guildId]
          );

        if (!result.rows.length) {
          return interaction.reply(
            "Nobody has WBL Tokens yet."
          );
        }

        const medals = [
          "🥇",
          "🥈",
          "🥉",
        ];

        const lines = [];

        for (
          let i = 0;
          i < result.rows.length;
          i++
        ) {
          const row =
            result.rows[i];

          let username =
            `<@${row.user_id}>`;

          try {
            const user =
              await client.users.fetch(
                row.user_id
              );

            username =
              `**${user.username}**`;
          } catch {}

          lines.push(
            `${medals[i] || `**${i + 1}.**`} ${username} — 🪙 **${Number(
              row.balance
            ).toLocaleString()}**`
          );
        }

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🏆 WBL TOKEN LEADERBOARD"
            )
            .setDescription(
              lines.join("\n")
            )
            .setColor(0x38bdf8)
            .setFooter({
              text:
                "Wealth By Lords",
            });

        return interaction.reply({
          embeds: [embed],
        });
      }

      // ==================================================
      // /SHOP
      // ==================================================

      if (
        interaction.commandName ===
        "shop"
      ) {
        const description =
          SHOP_ITEMS
            .map(
              (item, index) =>
                `**${index + 1}. ${item.name}**\n` +
                `🪙 **${item.price.toLocaleString()} Tokens**\n` +
                `${item.description}`
            )
            .join("\n\n");

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🛒 WBL TOKEN SHOP"
            )
            .setDescription(
              `${description}\n\n` +
              `Use the **Buy #** buttons below to purchase an item.`
            )
            .setColor(0x38bdf8)
            .setFooter({
              text:
                "Wealth By Lords Economy",
            });

        return interaction.reply({
          embeds: [embed],
          components:
            buildShopRows(),
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

