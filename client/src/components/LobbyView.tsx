import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { MAX_PLAYERS, MAX_SLOTS, MIN_HUMANS_FOR_VOTE, MIN_SLOTS, type Category, type RoomSnapshot } from "@budget-draft/shared";
import { isTouchDevice } from "../lib/useMediaQuery";
import { Avatar } from "./Avatar";
import { RulesPanel } from "./RulesPanel";
import { Sheet } from "./Sheet";
import { Stepper } from "./Stepper";
import { TimerSettings } from "./TimerSettings";
import { ICON_STROKE, INPUT_CLASS, Label, PillButton } from "./brand/primitives";
import { Button, Card, CardTitle } from "./ui";

interface LobbyViewProps {
  room: RoomSnapshot;
  playerId: string | null;
  categories: Category[];
  busy: boolean;
  onChangeSettings: (settings: RoomSnapshot["settings"]) => void;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
}

export function LobbyView({ room, playerId, categories, busy, onChangeSettings, onReady, onStart, onLeave }: LobbyViewProps) {
  const [copied, setCopied] = useState(false);
  const [showingLink, setShowingLink] = useState(false);
  const isHost = room.hostId !== null && room.hostId === playerId;
  const connected = room.players.filter((player) => player.isConnected);
  const connectedCount = connected.length;
  const readyCount = connected.filter((player) => player.isReady).length;
  const allReady = readyCount === connectedCount;
  const me = room.players.find((player) => player.id === playerId);
  const iAmReady = me !== undefined && me.isReady;
  const inviteLink = `${window.location.origin}/join/${room.code}`;
  const settings = room.settings;

  // Phones get the system share sheet (WhatsApp, Messages...). Laptops copy.
  const canShare = typeof navigator.share === "function" && isTouchDevice();

  async function shareLink() {
    if (canShare) {
      try {
        await navigator.share({ title: "Budget Draft", text: `Join my Budget Draft room: ${room.code}`, url: inviteLink });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return; // closed the share sheet without picking anything
        }
        // Sharing failed for another reason: copy instead.
      }
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. plain http on a phone). Show the link instead.
      setShowingLink(true);
    }
  }

  const category = categories.find((c) => c.slug === settings.categorySlug);

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <Card className="grid justify-items-center gap-4 text-center">
        <Label>Room code</Label>
        <p className="display-serif max-w-full text-6xl tracking-[0.08em] text-ivory sm:text-8xl sm:tracking-[0.12em]">{room.code}</p>
        <Button variant="secondary" onClick={shareLink} className="w-full">
          {copied && (
            <>
              <Check size={15} strokeWidth={ICON_STROKE} className="mr-2 inline" aria-hidden />
              Link copied
            </>
          )}
          {!copied && canShare && (
            <>
              <Share2 size={15} strokeWidth={ICON_STROKE} className="mr-2 inline" aria-hidden />
              Share invite link
            </>
          )}
          {!copied && !canShare && "Copy invite link"}
        </Button>
      </Card>
      <Sheet open={showingLink} onClose={() => setShowingLink(false)} title="Invite link">
        <p className="text-mist">Copying is blocked here. Press and hold the link to copy it.</p>
        <input
          readOnly
          value={inviteLink}
          aria-label="Invite link"
          onFocus={(event) => event.target.select()}
          className={INPUT_CLASS}
        />
      </Sheet>

      <Card className="grid gap-5">
        <CardTitle>
          Players ({room.players.length}/{MAX_PLAYERS})
        </CardTitle>
        <ul className="grid gap-4">
          {room.players.map((player) => (
            <li key={player.id} className="flex items-center gap-3">
              <Avatar name={player.name} />
              <span className="display-serif text-2xl text-ivory">{player.name}</span>
              {player.id === playerId && <Label className="text-mist/80">You</Label>}
              {player.isHost && <Label className="text-gold">Host</Label>}
              <span className="ml-auto flex items-center gap-3">
                {player.isReady ? (
                  <Label className="flex items-center gap-1 text-gold">
                    <Check size={14} strokeWidth={ICON_STROKE} aria-hidden />
                    Ready
                  </Label>
                ) : (
                  <Label className="text-mist/60">Not ready</Label>
                )}
                <span
                  className={`size-2.5 rounded-full ${player.isConnected ? "bg-ivory" : "ring-1 ring-mist/60"}`}
                  aria-label={player.isConnected ? "online" : "offline"}
                />
              </span>
            </li>
          ))}
        </ul>
        {room.players.length < 2 && <p className="mt-4 text-sm text-mist">Waiting for at least one more player…</p>}
      </Card>

      <Card className="grid gap-5">
        <CardTitle>Settings{!isHost && " · host decides"}</CardTitle>
        {room.customItemCount !== null ? (
          <p className="flex items-baseline justify-between gap-4">
            <Label>Category</Label>
            <span className="display-serif text-2xl text-ivory">Custom list · {room.customItemCount} items</span>
          </p>
        ) : isHost ? (
          <label className="flex items-center justify-between gap-4">
            <Label>Category</Label>
            <select
              value={settings.categorySlug}
              onChange={(event) => onChangeSettings({ ...settings, categorySlug: event.target.value })}
              disabled={busy}
              className={`${INPUT_CLASS} min-h-11 w-auto bg-ink-raised`}
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="flex items-baseline justify-between gap-4">
            <Label>Category</Label>
            <span className="display-serif text-2xl text-ivory">
              {category ? `${category.emoji} ${category.name}` : settings.categorySlug}
            </span>
          </p>
        )}
        <Stepper
          label="Budget"
          value={settings.startingBudget}
          min={5}
          max={50}
          format={(v) => `$${v}`}
          disabled={!isHost || busy}
          onChange={(value) => onChangeSettings({ ...settings, startingBudget: value })}
        />
        <Stepper
          label="Slots"
          value={settings.slotCount}
          min={MIN_SLOTS}
          max={MAX_SLOTS}
          disabled={!isHost || busy}
          onChange={(value) => onChangeSettings({ ...settings, slotCount: value })}
        />
        <RulesPanel
          settings={settings}
          categoryRoles={category ? category.roles : []}
          disabled={!isHost || busy}
          onChange={onChangeSettings}
        />
        <TimerSettings
          settings={settings}
          isHost={isHost}
          disabled={busy}
          // Online rooms have no bots, so everyone here is a human voter.
          showVote={room.players.length >= MIN_HUMANS_FOR_VOTE}
          onChange={onChangeSettings}
        />
      </Card>

      <PillButton
        variant={iAmReady ? "secondary" : "primary"}
        className="py-4 text-lg"
        aria-pressed={iAmReady}
        disabled={busy || me === undefined}
        onClick={() => onReady(!iAmReady)}
      >
        {iAmReady ? "Not ready yet" : "I'm ready"}
      </PillButton>
      <p className="text-center" aria-live="polite">
        <Label>
          {readyCount} of {connectedCount} ready
          {connectedCount >= 2 && allReady && !isHost && " · waiting for the host to start…"}
        </Label>
      </p>
      {isHost && (
        <PillButton className="py-4 text-lg" disabled={busy || connectedCount < 2 || !allReady} onClick={onStart}>
          {allReady ? "Start game" : "Waiting for everyone to be ready"}
        </PillButton>
      )}
      <Button variant="ghost" onClick={onLeave}>
        Leave room
      </Button>
    </div>
  );
}
