import type { AvatarId } from "@budget-draft/shared";
import { AVATAR_LOOKS } from "../lib/avatars";

// A circle with the player's chosen avatar, an emoji, or the name's initials in serif.
// We never use real photos or logos, so this is how items and players get a face.

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "?";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

const SIZES = {
  xs: { box: "size-6 text-[11px]", icon: 13 },
  sm: { box: "size-8 text-sm", icon: 16 },
  md: { box: "size-10 text-lg", icon: 20 },
  lg: { box: "size-20 text-4xl", icon: 38 },
};

interface AvatarProps {
  name: string;
  emoji?: string | undefined;
  avatar?: AvatarId | undefined;
  size?: keyof typeof SIZES;
}

export function Avatar({ name, emoji, avatar, size = "md" }: AvatarProps) {
  const { box, icon } = SIZES[size];
  if (avatar) {
    const look = AVATAR_LOOKS[avatar];
    const Icon = look.icon;
    return (
      <span className={`inline-grid shrink-0 place-items-center rounded-full ${box} ${look.className}`} aria-hidden>
        <Icon size={icon} strokeWidth={1.75} />
      </span>
    );
  }
  const base = `inline-grid shrink-0 place-items-center rounded-full ring-1 ring-mist/60 text-ivory ${box}`;
  if (emoji) {
    return (
      <span className={base} aria-hidden>
        {emoji}
      </span>
    );
  }
  return (
    <span className={`${base} display-serif`} aria-hidden>
      {getInitials(name)}
    </span>
  );
}
