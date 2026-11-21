import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import {
  AVATAR_IDS,
  DEFAULT_SETTINGS,
  firstFreeAvatar,
  MAX_PLAYERS,
  MAX_SLOTS,
  MIN_PLAYERS,
  MIN_SLOTS,
  type AvatarId,
  type GameSettings,
  type NewPlayer,
} from "@budget-draft/shared";
import { Avatar } from "../components/Avatar";
import { AvatarPicker } from "../components/AvatarPicker";
import { DifficultyPicker } from "../components/DifficultyPicker";
import { Sheet } from "../components/Sheet";
import { RulesPanel } from "../components/RulesPanel";
import { Stepper } from "../components/Stepper";
import { INPUT_CLASS, Label, PillButton, UrgentNote } from "../components/brand/primitives";
import { Button, Card, CardTitle, ErrorBox, PageShell, Spinner } from "../components/ui";
import { fetchCategories, fetchCategoryItems } from "../lib/categories";
import { parseMode } from "../lib/modes";
import { getStoredAvatar, getStoredName, storeAvatar, storeName } from "../lib/playerStorage";
import { useAsync } from "../lib/useAsync";
import { validateSetup } from "../lib/validateSetup";
import { useLocalGameStore } from "../store/localGameStore";

// Friendly names for bots, so the board doesn't read "Bot 1, Bot 2".
const BOT_NAMES = ["RoboScout", "Moneyball", "Bargain Bot"];
const MAX_BOTS = MAX_PLAYERS - 1;

// Setup for games that run in the browser: pass-and-play (2–4 names)
// and solo vs bots (your name + 1–3 bots).
export function SetupPage() {
  const params = useParams();
  const mode = parseMode(params.mode);
  const categorySlug = params.categorySlug ?? "";
  const navigate = useNavigate();
  const startGame = useLocalGameStore((store) => store.start);

  const categories = useAsync(fetchCategories, []);
  const isBotMode = mode === "bot";
  const [names, setNames] = useState<string[]>(() => (isBotMode ? [getStoredName()] : ["", ""]));
  // One avatar per human, in the same order as the names.
  const [avatars, setAvatars] = useState<AvatarId[]>(() => {
    const first = getStoredAvatar() ?? AVATAR_IDS[0];
    return isBotMode ? [first] : [first, firstFreeAvatar([first])];
  });
  const [pickingFor, setPickingFor] = useState<number | null>(null);
  const [botCount, setBotCount] = useState(1);
  const [budget, setBudget] = useState(DEFAULT_SETTINGS.startingBudget);
  const [slots, setSlots] = useState(DEFAULT_SETTINGS.slotCount);
  // Draft style and extras. Budget and slots have their own steppers above.
  const [rules, setRules] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [problems, setProblems] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);

  if (mode !== "local" && mode !== "bot") {
    return <Navigate to="/" replace />;
  }
  // Saved after the check above, so TypeScript knows it's "local" or "bot" inside handleStart.
  const gameMode: "local" | "bot" = mode;

  let categoryName = categorySlug;
  let categoryRoles: string[] = [];
  if (categories.status === "ready") {
    const match = categories.data.find((category) => category.slug === categorySlug);
    if (!match) {
      return (
        <PageShell title="Category not found" backTo={`/new/${mode}`}>
          <ErrorBox message={`There's no category called "${categorySlug}".`} />
        </PageShell>
      );
    }
    categoryName = `${match.emoji} ${match.name}`;
    categoryRoles = match.roles;
  }

  function updateName(index: number, value: string) {
    const next = [...names];
    next[index] = value;
    setNames(next);
  }

  function addPlayer() {
    if (names.length < MAX_PLAYERS) {
      setNames([...names, ""]);
      setAvatars([...avatars, firstFreeAvatar(avatars)]);
    }
  }

  function removePlayer(index: number) {
    if (names.length > MIN_PLAYERS) {
      const next = [];
      const nextAvatars: AvatarId[] = [];
      for (let i = 0; i < names.length; i++) {
        if (i !== index) {
          next.push(names[i] ?? "");
          nextAvatars.push(avatars[i] ?? firstFreeAvatar(nextAvatars));
        }
      }
      setNames(next);
      setAvatars(nextAvatars);
    }
  }

  async function handleStart() {
    const settings: GameSettings = {
      ...rules,
      startingBudget: budget,
      slotCount: slots,
      turnSeconds: 0, // no timer: people are passing one phone around
      voteSeconds: 0,
      categorySlug,
    };
    const botNames = isBotMode ? BOT_NAMES.slice(0, botCount) : [];
    // Bot names are checked too, so nobody ends up sharing a name with a bot.
    const found = validateSetup([...names, ...botNames], settings);
    setProblems(found);
    if (found.length > 0) {
      return;
    }

    setStarting(true);
    try {
      const items = await fetchCategoryItems(categorySlug);
      const players: NewPlayer[] = [];
      names.forEach((name, index) => {
        players.push({ id: crypto.randomUUID(), name: name.trim(), isBot: false, avatar: avatars[index] ?? firstFreeAvatar(avatars) });
      });
      for (const botName of botNames) {
        players.push({ id: crypto.randomUUID(), name: botName, isBot: true });
      }
      if (isBotMode) {
        storeName(names[0]?.trim() ?? "");
      }
      const myAvatar = avatars[0];
      if (myAvatar !== undefined) {
        storeAvatar(myAvatar);
      }
      startGame({ mode: gameMode, settings, players, items, roles: categoryRoles });
      navigate("/play");
    } catch (error) {
      setProblems([error instanceof Error ? error.message : "Couldn't load items"]);
      setStarting(false);
    }
  }

  return (
    <PageShell title={isBotMode ? "Solo vs bots" : "Game setup"} backTo={`/new/${mode}`}>
      {categories.status === "loading" && <Spinner />}
      {categories.status === "error" && <ErrorBox message={categories.message} onRetry={categories.retry} />}
      {categories.status === "ready" && (
        <div className="grid max-w-xl gap-4">
          <div className="grid gap-1">
            <Label>Category</Label>
            <p className="display-serif text-4xl text-ivory sm:text-5xl">{categoryName}</p>
          </div>

          {isBotMode && (
            <Card className="grid gap-4">
              <label className="grid gap-2">
                <Label>Your name</Label>
                <span className="flex gap-2">
                  <AvatarButton name={names[0] ?? ""} avatar={avatars[0]} index={0} onOpen={setPickingFor} />
                  <input
                    value={names[0] ?? ""}
                    onChange={(event) => updateName(0, event.target.value)}
                    maxLength={20}
                    autoCapitalize="words"
                    autoCorrect="off"
                    aria-label="Player 1 name"
                    className={`${INPUT_CLASS} min-w-0 flex-1`}
                  />
                </span>
              </label>
              <Stepper label="Bots" value={botCount} min={1} max={MAX_BOTS} onChange={setBotCount} />
              <DifficultyPicker
                value={rules.botDifficulty}
                onChange={(botDifficulty) => setRules({ ...rules, botDifficulty })}
              />
            </Card>
          )}

          {!isBotMode && (
            <Card className="grid gap-5">
              <CardTitle>Players</CardTitle>
              <div className="grid gap-4">
                {names.map((name, index) => (
                  <div key={index} className="flex gap-2">
                    <AvatarButton name={name} avatar={avatars[index]} index={index} onOpen={setPickingFor} />
                    <input
                      value={name}
                      onChange={(event) => updateName(index, event.target.value)}
                      placeholder={`Player ${index + 1}`}
                      maxLength={20}
                      autoCapitalize="words"
                      autoCorrect="off"
                      aria-label={`Player ${index + 1} name`}
                      className={`${INPUT_CLASS} min-w-0 flex-1`}
                    />
                    {names.length > MIN_PLAYERS && (
                      <Button
                        variant="ghost"
                        onClick={() => removePlayer(index)}
                        aria-label={`Remove player ${index + 1}`}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {names.length < MAX_PLAYERS && (
                <Button variant="secondary" className="w-full" onClick={addPlayer}>
                  + Add player
                </Button>
              )}
            </Card>
          )}

          <Card className="grid gap-5">
            <CardTitle>Rules</CardTitle>
            <Stepper label="Budget" value={budget} min={5} max={50} format={(v) => `$${v}`} onChange={setBudget} />
            <Stepper label="Slots" value={slots} min={MIN_SLOTS} max={MAX_SLOTS} onChange={setSlots} />
            <p className="text-sm text-mist">
              You must always keep at least $1 for each empty slot, so you can't blow it all on one pick.
            </p>
            <RulesPanel
              settings={{ ...rules, slotCount: slots }}
              categoryRoles={categoryRoles}
              onChange={setRules}
            />
          </Card>

          {problems.length > 0 && (
            <div role="alert" className="grid gap-2 rounded-[1.75rem] bg-ink-raised p-5 ring-1 ring-gold">
              {problems.map((problem) => (
                <UrgentNote key={problem}>{problem}</UrgentNote>
              ))}
            </div>
          )}

          <PillButton onClick={handleStart} disabled={starting} className="py-4 text-lg">
            {starting ? "Starting…" : "Start draft"}
          </PillButton>
        </div>
      )}
      <Sheet open={pickingFor !== null} onClose={() => setPickingFor(null)} title={`Avatar for ${pickingFor === null ? "" : names[pickingFor]?.trim() || `player ${pickingFor + 1}`}`}>
        <AvatarPicker
          value={pickingFor === null ? undefined : avatars[pickingFor]}
          onChange={(avatar) => {
            if (pickingFor !== null) {
              const next = [...avatars];
              next[pickingFor] = avatar;
              setAvatars(next);
            }
            setPickingFor(null);
          }}
        />
      </Sheet>
    </PageShell>
  );
}

// The avatar next to a name field. Tap to pick another.
function AvatarButton({ name, avatar, index, onOpen }: { name: string; avatar: AvatarId | undefined; index: number; onOpen: (index: number) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      aria-label={`Change avatar for player ${index + 1}`}
      className="grid size-12 shrink-0 place-items-center rounded-full transition hover:opacity-80"
    >
      <Avatar name={name || "?"} avatar={avatar} size="md" />
    </button>
  );
}
