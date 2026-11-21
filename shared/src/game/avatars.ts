// The 12 avatars a player can pick. The client draws each one as an icon on a
// coloured circle; the server and the engine only ever see the id.
export const AVATAR_IDS = [
  "crown",
  "rocket",
  "flame",
  "star",
  "zap",
  "ghost",
  "cat",
  "dog",
  "bird",
  "fish",
  "leaf",
  "music",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && (AVATAR_IDS as readonly string[]).includes(value);
}

// The first avatar nobody in `taken` has yet (so a room starts out varied).
// With every avatar taken, avatars repeat in order.
export function firstFreeAvatar(taken: (AvatarId | undefined)[]): AvatarId {
  for (const avatar of AVATAR_IDS) {
    if (!taken.includes(avatar)) {
      return avatar;
    }
  }
  return AVATAR_IDS[taken.length % AVATAR_IDS.length] ?? "crown";
}
