import { Bird, Cat, Crown, Dog, Fish, Flame, Ghost, Leaf, Music, Rocket, Star, Zap, type LucideIcon } from "lucide-react";
import type { AvatarId } from "@budget-draft/shared";

// How each avatar looks: a lucide icon on a circle, all from the theme's own
// colours (gold, ivory, mist on midnight) in different strengths.
export const AVATAR_LOOKS: Record<AvatarId, { icon: LucideIcon; label: string; className: string }> = {
  crown: { icon: Crown, label: "Crown", className: "bg-gold text-ink" },
  rocket: { icon: Rocket, label: "Rocket", className: "bg-ivory text-ink" },
  flame: { icon: Flame, label: "Flame", className: "bg-gold/20 text-gold" },
  star: { icon: Star, label: "Star", className: "bg-ivory/15 text-ivory" },
  zap: { icon: Zap, label: "Lightning", className: "bg-mist text-ink" },
  ghost: { icon: Ghost, label: "Ghost", className: "bg-mist/20 text-ivory" },
  cat: { icon: Cat, label: "Cat", className: "bg-ink text-gold ring-1 ring-gold" },
  dog: { icon: Dog, label: "Dog", className: "bg-ink text-ivory ring-1 ring-ivory/70" },
  bird: { icon: Bird, label: "Bird", className: "bg-gold/60 text-ink" },
  fish: { icon: Fish, label: "Fish", className: "bg-ink-hover text-gold" },
  leaf: { icon: Leaf, label: "Leaf", className: "bg-ivory/60 text-ink" },
  music: { icon: Music, label: "Music", className: "bg-ink-hover text-mist ring-1 ring-mist/40" },
};
