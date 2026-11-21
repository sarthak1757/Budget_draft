import { z } from "zod";
import {
  BID_SECONDS_OPTIONS,
  CUSTOM_CATEGORY_SLUG,
  CUSTOM_MAX_ITEMS,
  CUSTOM_MIN_ITEMS,
  MAX_PLAYERS,
  MAX_PRICE,
  MAX_SLOTS,
  MIN_PLAYERS,
  MIN_PRICE,
  MIN_SLOTS,
  ONLINE_BID_SECONDS,
  ONLINE_TURN_SECONDS,
  ONLINE_VOTE_SECONDS,
  REACTION_EMOJIS,
  TURN_SECONDS_OPTIONS,
  VOTE_SECONDS_OPTIONS,
} from "../game/constants";

// Every payload that arrives from the outside world (sockets, admin forms,
// seed files) is checked with one of these schemas before we trust it.

export const playerNameSchema = z.string().trim().min(1).max(20);

// 6 characters, letters and digits. We upper-case first so "abc123" works too.
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "Room code must be 6 letters or digits");

export const playerIdSchema = z.string().min(8).max(64);

export const categorySlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase words joined by dashes");

export const gameSettingsSchema = z
  .object({
    startingBudget: z.number().int().min(5).max(100),
    slotCount: z.number().int().min(MIN_SLOTS).max(MAX_SLOTS),
    turnSeconds: z.number().int().min(0).max(60),
    // Older clients don't send it: 0 = no bid timer (the online room checks it separately).
    bidSeconds: z.number().int().min(0).max(60).default(0),
    voteSeconds: z.number().int().min(0).max(120),
    categorySlug: categorySlugSchema,
    // Defaults keep older clients (that don't send these) on the original rules.
    draftStyle: z.enum(["classic", "auction"]).default("classic"),
    balancedTeam: z.boolean().default(false),
    mysteryItems: z.boolean().default(false),
    powerUps: z.boolean().default(false),
    botDifficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
  })
  // The budget rule needs at least $1 per slot, otherwise nobody could fill their team.
  .refine((settings) => settings.startingBudget >= settings.slotCount, {
    message: "Starting budget must be at least $1 per slot",
    path: ["startingBudget"],
  });

// Online rooms: each timer must be one of the lobby's presets, nothing else,
// even if a modified client sends some other number.
function presetSeconds(options: readonly number[], timerName: string, fallback: number) {
  const list = options.map((seconds) => `${seconds}s`).join(", ");
  return z
    .number()
    .refine((seconds) => options.includes(seconds), { message: `${timerName} must be one of ${list}` })
    .default(fallback);
}

export const onlineTimersSchema = z.object({
  turnSeconds: presetSeconds(TURN_SECONDS_OPTIONS, "Turn timer", ONLINE_TURN_SECONDS),
  bidSeconds: presetSeconds(BID_SECONDS_OPTIONS, "Bid timer", ONLINE_BID_SECONDS),
  voteSeconds: presetSeconds(VOTE_SECONDS_OPTIONS, "Vote timer", ONLINE_VOTE_SECONDS),
});

// ---- Socket payloads (client -> server) ----

export const roomJoinSchema = z.object({
  code: roomCodeSchema,
  playerName: playerNameSchema,
  playerId: playerIdSchema.optional(), // sent when reconnecting
});

// The round the player was looking at. Lets the server ignore a stale click
// that arrives after the round already moved on.
const roundNumberSchema = z.number().int().min(1);

export const turnActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("buy"), roundNumber: roundNumberSchema }),
  z.object({ action: z.literal("pass"), roundNumber: roundNumberSchema }),
  z.object({ action: z.literal("bid"), amount: z.number().int().min(1).max(100), roundNumber: roundNumberSchema }),
  z.object({ action: z.literal("veto"), roundNumber: roundNumberSchema }),
  z.object({ action: z.literal("discount"), roundNumber: roundNumberSchema }),
]);

export const reactionSchema = z.object({ emoji: z.enum(REACTION_EMOJIS) });

export const roomReadySchema = z.object({ ready: z.boolean() });

// Host controls in the lobby: the player to kick, or to hand host to.
export const roomTargetSchema = z.object({ playerId: playerIdSchema });

export const peekSchema = z.object({ roundNumber: roundNumberSchema });

// ---- REST payloads ----


export const voteCastSchema = z.object({
  targetPlayerId: playerIdSchema,
});

// A finished local or bot game sent to the server to be stored.
// It is NOT trusted for the leaderboard (those games don't count); the server
// still checks it is consistent and recalculates the scores itself.
const resultItemSchema = z.object({
  name: z.string().trim().min(1).max(60),
  price: z.number().int().min(0).max(MAX_PRICE), // 0 = bench item
  rating: z.number().int().min(1).max(100),
  tag: z.string().trim().min(1).max(30),
  isBench: z.boolean(),
});

export const localResultSchema = z
  .object({
    mode: z.enum(["local", "bot"]),
    categorySlug: categorySlugSchema,
    draftStyle: z.enum(["classic", "auction"]).default("classic"),
    rulesPreset: z.enum(["classic", "custom", "chaos"]).default("classic"),
    // The roles for the Balanced team bonus, so the server scores it the same way.
    requiredRoles: z.array(z.string().trim().min(1).max(30)).max(6).default([]),
    startingBudget: z.number().int().min(5).max(100),
    slotCount: z.number().int().min(MIN_SLOTS).max(MAX_SLOTS),
    players: z
      .array(
        z.object({
          id: playerIdSchema,
          name: playerNameSchema,
          isBot: z.boolean(),
          budgetLeft: z.number().int().min(0).max(100),
          team: z.array(resultItemSchema).max(MAX_SLOTS),
        }),
      )
      .min(MIN_PLAYERS)
      .max(MAX_PLAYERS),
    votes: z.record(z.string(), z.string()).default({}),
  })
  .superRefine((result, ctx) => {
    for (const player of result.players) {
      if (player.team.length !== result.slotCount) {
        ctx.addIssue({ code: "custom", message: `${player.name}'s team has the wrong number of slots` });
      }
      let spent = 0;
      for (const item of player.team) {
        spent += item.price;
      }
      // Money can't appear or vanish: what was spent plus what's left is the starting budget.
      if (spent + player.budgetLeft !== result.startingBudget) {
        ctx.addIssue({ code: "custom", message: `${player.name}'s budget doesn't add up` });
      }
    }
  });

// A finished Daily Challenge: just the player's moves. The server replays
// them to work out the score, so nothing else needs to be trusted.
export const dailyResultSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must look like 2026-11-17"),
  playerName: playerNameSchema,
  moves: z
    .array(z.object({ type: z.enum(["buy", "pass"]) }))
    .min(1)
    .max(200),
});

export const dailyDateSchema = dailyResultSchema.shape.dateKey;

// ---- Seed files and admin forms ----

export const seedItemSchema = z.object({
  name: z.string().trim().min(1).max(60),
  price: z.number().int().min(MIN_PRICE).max(MAX_PRICE),
  rating: z.number().int().min(1).max(100),
  tag: z.string().trim().min(1).max(30),
  emoji: z.string().min(1).max(16).optional(),
});

// A host's own item list for one online room (see parseCustomItems).
export const customItemsSchema = z
  .array(seedItemSchema.omit({ emoji: true }))
  .min(CUSTOM_MIN_ITEMS, `Add at least ${CUSTOM_MIN_ITEMS} items`)
  .max(CUSTOM_MAX_ITEMS, `At most ${CUSTOM_MAX_ITEMS} items`)
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    for (const item of items) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", message: `"${item.name}" is in the list twice` });
      }
      seen.add(key);
    }
  });

// customItems turns the room into a custom-category room; categorySlug is
// then ignored.
export const createRoomSchema = z.object({
  categorySlug: categorySlugSchema,
  customItems: customItemsSchema.optional(),
});

const roleListSchema = z.array(z.string().trim().min(1).max(30)).max(6);

export const seedCategorySchema = z
  .object({
    slug: categorySlugSchema,
    name: z.string().trim().min(1).max(40),
    emoji: z.string().min(1).max(16),
    description: z.string().trim().min(1).max(200),
    // Optional roles for "Balanced team". When present, every item's tag must be one of them.
    roles: roleListSchema.default([]),
    items: z.array(seedItemSchema).min(40),
  })
  .superRefine((category, ctx) => {
    if (category.roles.length === 0) {
      return;
    }
    for (const item of category.items) {
      if (!category.roles.includes(item.tag)) {
        ctx.addIssue({ code: "custom", message: `${item.name}'s tag "${item.tag}" is not one of the category's roles` });
      }
    }
  });

// ---- Admin forms ----
// The same rules as seed files, so anything the admin page saves would also be a valid seed item.

// Roles aren't edited from the admin page (they come from the seed files),
// so they're left out here and an update never wipes them.
export const adminCategorySchema = z.object({
  slug: categorySlugSchema.refine((slug) => slug !== CUSTOM_CATEGORY_SLUG, "That slug is reserved for custom lists"),
  name: z.string().trim().min(1).max(40),
  emoji: z.string().min(1).max(16),
  description: z.string().trim().min(1).max(200),
});
export const adminCategoryUpdateSchema = adminCategorySchema.omit({ slug: true });
export const adminItemSchema = seedItemSchema;

export type RoomJoinPayload = z.infer<typeof roomJoinSchema>;
export type TurnActionPayload = z.infer<typeof turnActionSchema>;
export type ReactionPayload = z.infer<typeof reactionSchema>;
export type RoomReadyPayload = z.infer<typeof roomReadySchema>;
export type RoomTargetPayload = z.infer<typeof roomTargetSchema>;
export type PeekPayload = z.infer<typeof peekSchema>;
export type CreateRoomPayload = z.infer<typeof createRoomSchema>;
export type VoteCastPayload = z.infer<typeof voteCastSchema>;
export type GameSettingsPayload = z.input<typeof gameSettingsSchema>;
export type OnlineTimers = z.infer<typeof onlineTimersSchema>;
export type SeedItem = z.infer<typeof seedItemSchema>;
export type AdminCategoryPayload = z.infer<typeof adminCategorySchema>;
export type AdminCategoryUpdatePayload = z.infer<typeof adminCategoryUpdateSchema>;
export type AdminItemPayload = z.infer<typeof adminItemSchema>;
export type LocalResultPayload = z.input<typeof localResultSchema>;
export type SeedCategory = z.infer<typeof seedCategorySchema>;
export type CustomItem = z.infer<typeof customItemsSchema>[number];
export type DailyResultPayload = z.infer<typeof dailyResultSchema>;
