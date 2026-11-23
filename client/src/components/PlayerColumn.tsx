import { motion } from "motion/react";
import { Avatar } from "./Avatar";
import { Bot, Check, Gift } from "lucide-react";
import { findMissingRoles, maxSpendable, pricePaid, type PublicItem, type PublicPlayerState } from "@budget-draft/shared";
import { GAME_MOMENT, gameTransition } from "../lib/motion";
import { useAnimatedNumber } from "../lib/useAnimatedNumber";
import { LeaderGlow } from "./MotionBits";
import { ICON_STROKE, Label, UrgentNote } from "./brand/primitives";

interface PlayerColumnProps {
  player: PublicPlayerState;
  isCurrentTurn: boolean;
  cantAfford: boolean;
  isViewer?: boolean; // online: highlights "you"
  justBought?: boolean; // plays a short glow after this player buys
  isHighBidder?: boolean; // auction: holds the current high bid
  requiredRoles?: string[]; // Balanced team: roles to cover. Empty = not playing it.
  freshItemId?: string | null; // the item that was just bought: its slot bounces in
}

export function PlayerColumn({
  player,
  isCurrentTurn,
  cantAfford,
  isViewer = false,
  justBought = false,
  isHighBidder = false,
  requiredRoles = [],
  freshItemId = null,
}: PlayerColumnProps) {
  const shownBudget = useAnimatedNumber(player.budget);
  // The active player gets a gold frame and a soft glow; everyone else a hairline.
  const frame = isCurrentTurn ? "shadow-glow" : "ring-1 ring-mist/15";

  return (
    <section
      aria-label={`${player.name}'s team`}
      className={`flex min-w-0 flex-col gap-3 rounded-[1.75rem] bg-ink-raised p-4 transition-shadow lg:w-56 ${frame} ${justBought ? "animate-bought" : ""}`}
    >
      <header className="flex min-w-0 items-center gap-2">
        {player.isBot && <Bot size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-gold" aria-label="bot" />}
        {player.avatar && (
          <LeaderGlow active={isHighBidder}>
            <Avatar name={player.name} avatar={player.avatar} size="sm" />
          </LeaderGlow>
        )}
        <Label className={`truncate ${isCurrentTurn ? "text-ivory" : ""}`}>
          {player.name}
          {isViewer && " · you"}
        </Label>
        {isHighBidder && <Label className="ml-auto shrink-0 rounded-full bg-gold px-2 py-0.5 text-ink-raised">High bid</Label>}
        {!player.isConnected && <Label className="ml-auto shrink-0 text-gold">Offline</Label>}
      </header>

      <p className="display-serif self-start text-6xl text-ivory tabular-nums sm:text-7xl" aria-label={`Budget $${player.budget}`} data-budget-for={player.id}>
        ${shownBudget}
      </p>
      <div className="min-h-5">
        {cantAfford && <UrgentNote>Can't afford this one</UrgentNote>}
        {!cantAfford && maxSpendable(player) > 0 && <Label className="text-mist/80">Can spend up to ${maxSpendable(player)}</Label>}
        {!cantAfford && maxSpendable(player) === 0 && <Label className="text-mist/80">Team complete</Label>}
      </div>

      <TeamSlots team={player.team} requiredRoles={requiredRoles} playerId={player.id} freshItemId={freshItemId} />
    </section>
  );
}

// The numbered slots, plus the role chips when playing Balanced team.
// Also used by the phone layout's "your team" row and team sheet.
interface TeamSlotsProps {
  team: (PublicItem | null)[];
  requiredRoles?: string[];
  playerId?: string; // marks the slots, so the bought coin knows where to land
  freshItemId?: string | null; // the item that was just bought: its slot bounces in
}

export function TeamSlots({ team, requiredRoles = [], playerId, freshItemId = null }: TeamSlotsProps) {
  return (
    <div className="grid gap-3">
      <ol className="grid grid-cols-[minmax(0,1fr)]">
        {team.map((item, index) => (
          <Slot
            key={index}
            index={index}
            item={item}
            slotId={playerId === undefined ? undefined : `${playerId}:${index}`}
            fresh={item !== null && item.id === freshItemId}
          />
        ))}
      </ol>
      {requiredRoles.length > 0 && <RoleChips team={team} requiredRoles={requiredRoles} />}
    </div>
  );
}

// How many slots hold an item: "3/5" in the phone layout.
export function countFilled(team: (PublicItem | null)[]): number {
  let filled = 0;
  for (const item of team) {
    if (item !== null) {
      filled += 1;
    }
  }
  return filled;
}

// A numbered hairline row. A just-bought item lands with a small bounce,
// timed to arrive with the coin.
function Slot({ index, item, slotId, fresh }: { index: number; item: PublicItem | null; slotId: string | undefined; fresh: boolean }) {
  if (item === null) {
    return (
      <li className="flex min-h-12 items-center gap-3 border-t border-mist/15 py-2 last:border-b" data-slot-for={slotId}>
        <Label className="text-mist/70">Slot {index + 1}</Label>
      </li>
    );
  }
  return (
    <motion.li
      data-slot-for={slotId}
      initial={fresh ? { scale: 0.85, opacity: 0 } : false}
      animate={fresh ? { scale: [0.85, 1.05, 1], opacity: 1 } : undefined}
      transition={gameTransition(GAME_MOMENT.slot, GAME_MOMENT.coin * 0.6)}
      className={`flex min-h-12 items-center gap-2 border-t border-mist/15 py-2 last:border-b ${item.isBench ? "opacity-70" : ""}`}
      title={`${item.name} · ${item.tag} · paid $${pricePaid(item)} (listed $${item.price}) · rating ${item.rating === null ? "hidden" : item.rating}`}
    >
      <Label className="w-5 shrink-0 text-mist/70">{String(index + 1).padStart(2, "0")}</Label>
      <span className="min-w-0 flex-1">
        <span className="display-serif block truncate text-lg text-ivory">{item.name}</span>
        <Label className="block truncate text-mist/80">
          {item.tag} · ${pricePaid(item)}
        </Label>
      </span>
      {item.rating === null ? (
        <Gift size={16} strokeWidth={ICON_STROKE} className="shrink-0 text-gold" aria-label="Rating hidden until the draft ends" />
      ) : (
        <span className="display-serif text-2xl text-ivory tabular-nums">{item.rating}</span>
      )}
    </motion.li>
  );
}

// Balanced team: every role, ticked once the team has one.
function RoleChips({ team, requiredRoles }: { team: (PublicItem | null)[]; requiredRoles: string[] }) {
  const missing = findMissingRoles(team, requiredRoles);
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Roles for the balanced team bonus">
      {requiredRoles.map((role) => {
        const covered = !missing.includes(role);
        return (
          <li
            key={role}
            className={`label-caps inline-flex items-center gap-1 rounded-full px-2 py-1 ${covered ? "bg-gold text-ink" : "text-mist ring-1 ring-mist/40 ring-inset"}`}
          >
            {covered && <Check size={11} strokeWidth={2} aria-hidden />}
            {role}
            <span className="sr-only">{covered ? " covered" : " needed"}</span>
          </li>
        );
      })}
    </ul>
  );
}
