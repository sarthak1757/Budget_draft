import { Bot, ChevronUp } from "lucide-react";
import { useState } from "react";
import { maxSpendable, type PublicPlayerState } from "@budget-draft/shared";
import { useAnimatedNumber } from "../lib/useAnimatedNumber";
import { Avatar } from "./Avatar";
import { ICON_STROKE, Label, UrgentNote } from "./brand/primitives";
import { countFilled, PlayerColumn, TeamSlots } from "./PlayerColumn";
import { Sheet } from "./Sheet";

// Facts about each player that the strip, the row and the sheet all need.
export interface PlayerBadges {
  currentId: string | null;
  boughtBy: string | null;
  highBidderId: string | null;
  cantAffordIds: string[];
  requiredRoles: string[];
}

// ---- The other players: a row of small cards at the top ----

interface OpponentStripProps {
  players: PublicPlayerState[];
  badges: PlayerBadges;
}

// Up to 3 opponents side by side, each one tap away from their full team.
// Equal columns with minmax(0, 1fr), so long names truncate instead of
// pushing the page wider than the phone.
export function OpponentStrip({ players, badges }: OpponentStripProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (players.length === 0) {
    return null;
  }
  let openPlayer: PublicPlayerState | undefined;
  for (const player of players) {
    if (player.id === openId) {
      openPlayer = player;
    }
  }

  return (
    <>
      <ul
        aria-label="Other players"
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}
      >
        {players.map((player) => (
          <li key={player.id} className="min-w-0">
            <OpponentChip player={player} badges={badges} onOpen={() => setOpenId(player.id)} />
          </li>
        ))}
      </ul>
      <Sheet open={openPlayer !== undefined} onClose={() => setOpenId(null)} title={openPlayer ? `${openPlayer.name}'s team` : "Team"}>
        {openPlayer && (
          <PlayerColumn
            player={openPlayer}
            isCurrentTurn={openPlayer.id === badges.currentId}
            cantAfford={badges.cantAffordIds.includes(openPlayer.id)}
            isHighBidder={openPlayer.id === badges.highBidderId}
            requiredRoles={badges.requiredRoles}
          />
        )}
      </Sheet>
    </>
  );
}

function OpponentChip({ player, badges, onOpen }: { player: PublicPlayerState; badges: PlayerBadges; onOpen: () => void }) {
  const shownBudget = useAnimatedNumber(player.budget);
  const isCurrent = player.id === badges.currentId;
  const isHighBidder = player.id === badges.highBidderId;
  const filled = countFilled(player.team);

  let frame = "ring-1 ring-mist/15";
  if (isCurrent) {
    frame = "shadow-glow";
  }
  let status = "";
  if (isCurrent) {
    status = ", their turn";
  }
  if (isHighBidder) {
    status += ", high bidder";
  }
  if (!player.isConnected) {
    status += ", offline";
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${player.name}: $${player.budget} left, ${filled} of ${player.team.length} slots filled${status}. Show team`}
      className={`relative grid min-h-14 w-full gap-0.5 rounded-2xl bg-ink-raised px-2.5 py-1.5 text-left transition active:scale-[0.98] ${frame} ${badges.boughtBy === player.id ? "animate-bought" : ""} ${player.isConnected ? "" : "opacity-60"}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {player.isBot ? (
          <Bot size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-gold" aria-hidden />
        ) : (
          <Avatar name={player.name} avatar={player.avatar} size="xs" />
        )}
        <Label className={`truncate tracking-[0.1em] ${isCurrent ? "text-ivory" : ""}`}>{player.name}</Label>
      </span>
      <span className="flex items-baseline justify-between gap-1">
        <span className="display-serif text-2xl text-ivory tabular-nums">${shownBudget}</span>
        <Label className="tracking-[0.1em] text-mist/80">
          {filled}/{player.team.length}
        </Label>
      </span>
      {isHighBidder && (
        <span aria-hidden className="label-caps absolute -top-2 right-2 rounded-full bg-gold px-1.5 text-[10px] tracking-[0.1em] text-ink">
          High bid
        </span>
      )}
    </button>
  );
}

// ---- Your own team: a row above the buttons that opens upward ----

interface MyTeamBarProps {
  player: PublicPlayerState;
  title: string; // "Your team", or "Asha's team" in pass and play
  badges: PlayerBadges;
}

export function MyTeamBar({ player, title, badges }: MyTeamBarProps) {
  const [open, setOpen] = useState(false);
  const shownBudget = useAnimatedNumber(player.budget);
  const filled = countFilled(player.team);
  const cantAfford = badges.cantAffordIds.includes(player.id);
  const spendable = maxSpendable(player);

  return (
    <div className={`rounded-2xl bg-ink-raised ring-1 ring-mist/15 ${badges.boughtBy === player.id ? "animate-bought" : ""}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="my-team-slots"
        aria-label={`${title}: $${player.budget} left, ${filled} of ${player.team.length} slots filled`}
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center gap-3 px-4 text-left"
      >
        {player.avatar && <Avatar name={player.name} avatar={player.avatar} size="sm" />}
        <Label className="min-w-0 flex-1 truncate text-ivory">{title}</Label>
        <Label className="shrink-0 text-mist/80">
          {filled}/{player.team.length}
        </Label>
        <span className="display-serif shrink-0 text-2xl text-ivory tabular-nums">
          ${shownBudget}
        </span>
        <ChevronUp
          size={18}
          strokeWidth={ICON_STROKE}
          className={`shrink-0 text-mist transition-transform ${open ? "" : "rotate-180"}`}
          aria-hidden
        />
      </button>
      {open && (
        // Capped height, so a big team never pushes the buttons off the screen.
        <div id="my-team-slots" className="grid max-h-[38dvh] gap-3 overflow-y-auto px-4 pb-3">
          {cantAfford && <UrgentNote>Can't afford this one</UrgentNote>}
          {!cantAfford && spendable > 0 && <Label className="text-mist/80">Can spend up to ${spendable}</Label>}
          {!cantAfford && spendable === 0 && <Label className="text-mist/80">Team complete</Label>}
          <TeamSlots team={player.team} requiredRoles={badges.requiredRoles} />
        </div>
      )}
    </div>
  );
}
