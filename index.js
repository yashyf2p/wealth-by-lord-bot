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

// ===============================
// DATABASE
// ===============================

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("railway.internal")
    ? false
    : { rejectUnauthorized: false },
});

// ===============================
// DISCORD CLIENT
// ===============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ===============================
// WBL SHOP
// ===============================

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
    description: "€10 sent via PayPal.",
  },
  {
    id: "brawlpass",
    name: "Brawl Pass",
    price: 19780,
    description: "1x Brawl Pass reward.",
  },
  {
    id: "everyone_ping",
    name: "@everyone Ping",
    price: 9500,
    description: "1x @everyone ping in a server of your choice.",
  },
  {
    id: "double30",
    name: "2x Chat Tokens — 30 Days",
    price: 9000,
    description: "Earn 2 tokens per active chat minute for 30 days.",
  },
  {
    id: "giveaway3",
    name: "3 Extra Giveaway Entries",
    price: 7000,
    description: "3 extra entries in an eligible giveaway.",
  },
  {
    id: "vip_fl",
    name: "VIP Role + WBL Roster FL",
    price: 5000,
    description:
      "VIP role + friend-list add from any player on the WBL roster.",
  },
  {
    id: "tierc_fl",
    name: "1x Tier C FL",
    price: 3000,
    description: "1x Tier C friend-list add — organization's choice.",
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
    description: "1 extra entry in an eligible giveaway.",
  },
];

// ===============================
// SLASH COMMANDS
// ===============================

const commands = [

  // ADMIN ONLY
  new SlashCommandBuilder()
    .setName("send")
    .setDescription("Send a WBL embed message")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Channel to send the message to")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("title")
        .setDescription("Embed title")
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
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  // ADMIN ONLY
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
        .setDescription("Number of tokens")
        .setMinValue(1)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  // ADMIN ONLY
  new SlashCommandBuilder()
    .setName("drop")
    .setDescription("Admin: make a first-person WBL Token drop")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Tokens the winner receives")
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

  // ADMIN ONLY
  new SlashCommandBuilder()
    .setName("double")
    .setDescription("Admin: activate server-wide 2x chat tokens")
    .addIntegerOption(option =>
      option
        .setName("minutes")
        .setDescription("How many minutes 2x lasts")
        .setMinValue(1)
        .setMaxValue(1440)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator
    ),

  // EVERYONE
  new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Check a WBL Token balance")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Optional member to check")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("collect")
    .setDescription(
      "Claim your 24-hour WBL reward after sending 5 messages"
    ),

  new SlashCommandBuilder()
    .setName("daily")
    .setDescription("View or claim your daily message challenge"),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the WBL Token leaderboard"),

  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("View the WBL Token Shop and buy rewards"),

].map(command => command.toJSON());

// ===============================
// HELPERS
// ===============================

function luxembourgDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Luxembourg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = type =>
    parts.find(part => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function randomInt(min, max) {
  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;
}

// ===============================
// DATABASE SETUP
// ===============================

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

async function ensureUser(
  guildId,
  userId,
  db = pool
) {

  await db.query(
    `
    INSERT INTO users (
      guild_id,
      user_id
    )
    VALUES ($1, $2)

    ON CONFLICT (
      guild_id,
      user_id
    )
    DO NOTHING
    `,
    [guildId, userId]
  );
}

async function ensureDaily(
  guildId,
  userId,
  db = pool
) {

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
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5
    )

    ON CONFLICT (
      guild_id,
      user_id,
      day
    )
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

async function isServerDoubleActive(guildId) {

  const result = await pool.query(
    `
    SELECT double_until
    FROM guild_events
    WHERE guild_id = $1
    `,
    [guildId]
  );

  return (
    result.rows.length > 0 &&
    Number(result.rows[0].double_until) >
      Date.now()
  );
}

// ===============================
// SHOP BUTTONS
// ===============================

function buildShopRows() {

  const rows = [];

  for (
    let i = 0;
    i < SHOP_ITEMS.length;
    i += 5
  ) {

    const row =
      new ActionRowBuilder();

    for (
      const item of
      SHOP_ITEMS.slice(i, i + 5)
    ) {

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(
            `shop_buy:${item.id}`
          )
          .setLabel(
            `Buy ${item.price.toLocaleString()}`
          )
          .setStyle(
            ButtonStyle.Primary
          )
      );
    }

    rows.push(row);
  }

  return rows;
}

// ===============================
// BOT START
// ===============================

client.once(
  Events.ClientReady,
  async readyClient => {

    console.log(
      `✅ Logged in as ${readyClient.user.tag}`
    );

    try {

      await setupDatabase();

      const rest =
        new REST({
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

// ===============================
// CHAT TOKEN EARNING
// ===============================

client.on(
  Events.MessageCreate,
  async message => {

    if (!message.guild) return;
    if (message.author.bot) return;

    const content =
      message.content.trim();

    // super tiny messages don't count
    if (content.length < 2) return;

    const guildId =
      message.guild.id;

    const userId =
      message.author.id;

    const now =
      Date.now();

    try {

      await ensureUser(
        guildId,
        userId
      );

      await ensureDaily(
        guildId,
        userId
      );

      // Every valid message counts
      // for daily challenge
      await pool.query(
        `
        UPDATE daily_stats

        SET messages =
          messages + 1

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

      const userResult =
        await pool.query(
          `
          SELECT
            last_chat_reward,
            personal_double_until

          FROM users

          WHERE guild_id = $1
            AND user_id = $2
          `,
          [
            guildId,
            userId,
          ]
        );

      const user =
        userResult.rows[0];

      // Only reward once per minute
      if (
        now -
          Number(
            user.last_chat_reward
          ) >=
        60000
      ) {

        const personalDouble =
          Number(
            user.personal_double_until
          ) > now;

        const serverDouble =
          await isServerDoubleActive(
            guildId
          );

        // MAXIMUM IS 2X
        // personal + server do NOT become 4x
        const reward =
          personalDouble ||
          serverDouble
            ? 2
            : 1;

        await pool.query(
          `
          UPDATE users

          SET
            balance =
              balance + $1,

            last_chat_reward =
              $2

          WHERE guild_id = $3
            AND user_id = $4
          `,
          [
            reward,
            now,
            guildId,
            userId,
          ]
        );
      }

    } catch (error) {

      console.error(
        "❌ Message tracking error:",
        error
      );
    }
  }
);

// ===============================
// INTERACTIONS
// ===============================

client.on(
  Events.InteractionCreate,
  async interaction => {

    try {

      // ===========================
      // BUTTONS
      // ===========================

      if (interaction.isButton()) {

        // =========================
        // TOKEN DROP CLAIM
        // =========================

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

            if (
              result.rows.length === 0
            ) {

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
                  `❌ Already claimed by <@${drop.claimed_by}>.`,
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

            await db.query(
              "COMMIT"
            );

            const claimedEmbed =
              new EmbedBuilder()
                .setTitle(
                  "🎁 WBL TOKEN DROP — CLAIMED"
                )
                .setDescription(
                  `🏆 ${interaction.user} was first and claimed **${Number(
                    drop.amount
                  ).toLocaleString()} WBL Tokens**!`
                )
                .setColor(
                  0x38bdf8
                )
                .setFooter({
                  text:
                    "Wealth By Lords",
                });

            const disabledRow =
              new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder()
                    .setCustomId(
                      `drop_claim:${dropId}`
                    )
                    .setLabel(
                      "Claimed"
                    )
                    .setStyle(
                      ButtonStyle.Secondary
                    )
                    .setDisabled(
                      true
                    )
                );

            await interaction.update({
              embeds: [
                claimedEmbed,
              ],
              components: [
                disabledRow,
              ],
            });

            return;

          } catch (error) {

            await db
              .query("ROLLBACK")
              .catch(() => {});

            throw error;

          } finally {

            db.release();
          }
        }

        // =========================
        // SHOP BUY BUTTON
        // =========================

        if (
          interaction.customId.startsWith(
            "shop_buy:"
          )
        ) {

          if (!interaction.guildId)
            return;

          const itemId =
            interaction.customId.split(
              ":"
            )[1];

          const item =
            SHOP_ITEMS.find(
              shopItem =>
                shopItem.id === itemId
            );

          if (!item) {

            return interaction.reply({
              content:
                "❌ That shop item no longer exists.",
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

            const user =
              result.rows[0];

            const balance =
              Number(user.balance);

            if (
              balance <
              item.price
            ) {

              await db.query(
                "ROLLBACK"
              );

              return interaction.reply({
                content:
                  `❌ You need **${(
                    item.price -
                    balance
                  ).toLocaleString()}** more WBL Tokens for **${item.name}**.`,
                flags:
                  MessageFlags.Ephemeral,
              });
            }

            // REMOVE TOKENS
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

            // PERSONAL 2X BOOST
            if (
              item.id ===
              "double30"
            ) {

              const now =
                Date.now();

              const currentUntil =
                Number(
                  user.personal_double_until
                );

              // buying again extends it
              const startFrom =
                Math.max(
                  now,
                  currentUntil
                );

              const newUntil =
                startFrom +
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

            // RECORD PURCHASE
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

            await db.query(
              "COMMIT"
            );

            const extra =
              item.id === "double30"
                ? "\n⚡ Your **2x chat-token boost is active for 30 days**."
                : "\n📩 Purchase recorded. WBL staff will handle rewards that require manual delivery.";

            return interaction.reply({
              content:
                `✅ You bought **${item.name}** for **${item.price.toLocaleString()} WBL Tokens**.${extra}`,
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

      // ===========================
      // SLASH COMMANDS
      // ===========================

      if (
        !interaction.isChatInputCommand()
      )
        return;

      if (!interaction.guildId)
        return;

      const guildId =
        interaction.guildId;

      // ===========================
      // /SEND — ADMIN
      // ===========================

      if (
        interaction.commandName ===
        "send"
      ) {

        const channel =
          interaction.options.getChannel(
            "channel"
          );

        const title =
          interaction.options.getString(
            "title"
          );

        const message =
          interaction.options.getString(
            "message"
          );

        const image =
          interaction.options.getString(
            "image"
          );

        const embed =
          new EmbedBuilder()
            .setTitle(title)
            .setDescription(message)
            .setColor(
              0x38bdf8
            )
            .setFooter({
              text:
                "Wealth By Lords",
            })
            .setTimestamp();

        if (image)
          embed.setImage(image);

        await channel.send({
          embeds: [embed],
        });

        return interaction.reply({
          content:
            `✅ Message sent to ${channel}`,
          flags:
            MessageFlags.Ephemeral,
        });
      }

      // ===========================
      // /GIVE — ADMIN
      // ===========================

      if (
        interaction.commandName ===
        "give"
      ) {

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
            `✅ Gave ${user} **${amount.toLocaleString()} WBL Tokens**.`,
          flags:
            MessageFlags.Ephemeral,
        });
      }

      // ===========================
      // /DROP — ADMIN
      // FIRST PERSON ONLY
      // ===========================

      if (
        interaction.commandName ===
        "drop"
      ) {

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
              `First person to press **CLAIM** wins **${amount.toLocaleString()} WBL Tokens**!\n\nThe drop stays open until someone claims it.`
            )
            .setColor(
              0x38bdf8
            )
            .setFooter({
              text:
                "Wealth By Lords",
            });

        const row =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `drop_claim:${dropId}`
                )
                .setLabel(
                  "CLAIM"
                )
                .setStyle(
                  ButtonStyle.Success
                )
            );

        const sent =
          await channel.send({
            embeds: [embed],
            components: [row],
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
            `✅ Drop posted in ${channel}.`,
          flags:
            MessageFlags.Ephemeral,
        });
      }

      // ===========================
      // /DOUBLE — ADMIN
      // ===========================

      if (
        interaction.commandName ===
        "double"
      ) {

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

          VALUES (
            $1,
            $2
          )

          ON CONFLICT (
            guild_id
          )

          DO UPDATE

          SET double_until =
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
              "⚡ DOUBLE TOKEN EVENT"
            )
            .setDescription(
              `Everyone now earns **2 WBL Tokens per active chat minute** for **${minutes} minute${minutes === 1 ? "" : "s"}**!\n\nPersonal 2x boosts do not stack above 2x.`
            )
            .setColor(
              0x38bdf8
            )
            .setFooter({
              text:
                "Wealth By Lords",
            });

        return interaction.reply({
          embeds: [embed],
        });
      }

      // ===========================
      // /WALLET
      // ===========================

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

        const boosted =
          Number(
            data.personal_double_until
          ) >
          Date.now();

        const boostText =
          boosted
            ? `\n⚡ 2x chat boost active until <t:${Math.floor(
                Number(
                  data.personal_double_until
                ) / 1000
              )}:R>`
            : "";

        const embed =
          new EmbedBuilder()
            .setTitle(
              "💰 WBL Wallet"
            )
            .setDescription(
              `**${target.username}** has **${Number(
                data.balance
              ).toLocaleString()} WBL Tokens** 🪙${boostText}`
            )
            .setThumbnail(
              target.displayAvatarURL()
            )
            .setColor(
              0x38bdf8
            )
            .setFooter({
              text:
                "Wealth By Lords Economy",
            });

        return interaction.reply({
          embeds: [embed],
        });
      }

      // ===========================
      // /COLLECT
      // ===========================

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

        // NEED 5 MESSAGES TODAY
        if (
          Number(
            daily.messages
          ) < 5
        ) {

          return interaction.reply({
            content:
              `❌ You need **5 messages today** before collecting.\nYou currently have **${daily.messages}/5**.`,
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

        const user =
          result.rows[0];

        const cooldown =
          24 *
          60 *
          60 *
          1000;

        const next =
          Number(
            user.last_collect
          ) +
          cooldown;

        if (
          Date.now() <
          next
        ) {

          return interaction.reply({
            content:
              `⏳ You can collect again <t:${Math.floor(
                next / 1000
              )}:R>.`,
            flags:
              MessageFlags.Ephemeral,
          });
        }

        const reward =
          randomInt(
            0,
            150
          );

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
              "🎁 WBL Collect"
            )
            .setDescription(
              reward === 0
                ? "💀 Unlucky — you collected **0 WBL Tokens** this time."
                : `You collected **${reward} WBL Tokens** 🪙!`
            )
            .setColor(
              0x38bdf8
            )
            .setFooter({
              text:
                "Come back in 24 hours",
            });

        return interaction.reply({
          embeds: [embed],
        });
      }

      // ===========================
      // /DAILY
      // ===========================

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
              `✅ Today's challenge is already claimed.\nProgress: **${daily.messages}/${daily.target}**.`,
            flags:
              MessageFlags.Ephemeral,
          });
        }

        // NOT FINISHED
        if (
          Number(
            daily.messages
          ) <
          Number(
            daily.target
          )
        ) {

          const embed =
            new EmbedBuilder()
              .setTitle(
                "📅 WBL Daily Challenge"
              )
              .setDescription(
                `Send **${daily.target} messages today**.\n\n` +
                `Progress: **${daily.messages}/${daily.target}**\n` +
                `Reward: **${daily.reward} WBL Tokens** 🪙`
              )
              .setColor(
                0x38bdf8
              )
              .setFooter({
                text:
                  "Resets daily in Luxembourg time",
              });

          return interaction.reply({
            embeds: [embed],
          });
        }

        // CLAIM DAILY REWARD
        const db =
          await pool.connect();

        try {

          await db.query(
            "BEGIN"
          );

          const check =
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

          if (
            check.rows[0].claimed
          ) {

            await db.query(
              "ROLLBACK"
            );

            return interaction.reply({
              content:
                "✅ You already claimed today's challenge.",
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
              check.rows[0]
                .reward,
              guildId,
              interaction.user.id,
            ]
          );

          await db.query(
            `
            UPDATE daily_stats

            SET claimed =
              TRUE

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

          await db.query(
            "COMMIT"
          );

          return interaction.reply({
            content:
              `🏆 Daily challenge complete!\nYou received **${Number(
                check.rows[0].reward
              ).toLocaleString()} WBL Tokens** 🪙.`,
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

      // ===========================
      // /LEADERBOARD
      // ===========================

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

            ORDER BY
              balance DESC

            LIMIT 10
            `,
            [guildId]
          );

        if (
          result.rows.length === 0
        ) {

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
          i <
          result.rows.length;
          i++
        ) {

          const row =
            result.rows[i];

          let userName =
            `<@${row.user_id}>`;

          try {

            const user =
              await client.users.fetch(
                row.user_id
              );

            userName =
              `**${user.username}**`;

          } catch {}

          lines.push(
            `${medals[i] || `**${i + 1}.**`} ${userName} — 🪙 ${Number(
              row.balance
            ).toLocaleString()}`
          );
        }

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🏆 WBL Token Leaderboard"
            )
            .setDescription(
              lines.join("\n")
            )
            .setColor(
              0x38bdf8
            )
            .setFooter({
              text:
                "Wealth By Lords",
            });

        return interaction.reply({
          embeds: [embed],
        });
      }

      // ===========================
      // /SHOP
      // ===========================

      if (
        interaction.commandName ===
        "shop"
      ) {

        const description =
          SHOP_ITEMS
            .map(
              (item, index) =>
                `**${index + 1}. ${item.name}** — 🪙 **${item.price.toLocaleString()}**\n${item.description}`
            )
            .join("\n\n");

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🛒 WBL TOKEN SHOP"
            )
            .setDescription(
              `${description}\n\nPress a **Buy** button below. The bot checks your balance automatically.`
            )
            .setColor(
              0x38bdf8
            )
            .setFooter({
              text:
                "Wealth By Lords",
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

