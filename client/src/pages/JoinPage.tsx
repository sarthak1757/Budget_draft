import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { playerNameSchema, roomCodeSchema, type RoomInfo } from "@budget-draft/shared";
import { INPUT_CLASS, Label, UrgentNote } from "../components/brand/primitives";
import { NameField } from "../components/NameField";
import { Button, Card, PageShell } from "../components/ui";
import { apiRequest } from "../lib/api";
import { getStoredName, getStoredPlayerId, storeName } from "../lib/playerStorage";

// Reached from the home page (/join) or an invite link (/join/ABC123).
export function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState(useParams().code ?? "");
  const [name, setName] = useState(getStoredName);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedCode = roomCodeSchema.safeParse(code);
    if (!parsedCode.success) {
      setError("Room codes are 6 letters or digits");
      return;
    }
    const parsedName = playerNameSchema.safeParse(name);
    if (!parsedName.success) {
      setError("Enter a name (1–20 characters)");
      return;
    }

    setChecking(true);
    setError(null);
    try {
      // Check before connecting so we can give a clear message.
      const info = await apiRequest<RoomInfo>(`/api/rooms/${parsedCode.data}`);
      const isReturning = getStoredPlayerId(parsedCode.data) !== undefined;
      // A game in progress can still be watched (and joined on Rematch).
      if (!info.joinable && !info.watchable && !isReturning) {
        setError("That room is full");
        setChecking(false);
        return;
      }
      storeName(parsedName.data);
      navigate(`/room/${parsedCode.data}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Couldn't find that room");
      setChecking(false);
    }
  }

  return (
    <PageShell title="Join a room" backTo="/">
      <form onSubmit={handleSubmit} className="grid max-w-md gap-4">
        <Card className="grid gap-4">
          <label className="grid gap-2">
            <Label>Room code</Label>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="ABC123"
              className={`${INPUT_CLASS} display-serif text-5xl tracking-[0.2em] uppercase`}
            />
          </label>
          <NameField value={name} onChange={setName} />
        </Card>
        {error && (
          <p role="alert">
            <UrgentNote>{error}</UrgentNote>
          </p>
        )}
        <Button type="submit" disabled={checking} className="py-4 text-lg">
          {checking ? "Checking…" : "Join"}
        </Button>
      </form>
    </PageShell>
  );
}
