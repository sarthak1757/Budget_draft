import { Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CHAT_MAX_LENGTH, type ChatMessage } from "@budget-draft/shared";
import { ICON_STROKE, INPUT_CLASS, Label } from "./brand/primitives";
import { Card, CardTitle } from "./ui";

interface LobbyChatProps {
  messages: ChatMessage[];
  playerId: string | null;
  onSend: (text: string) => Promise<boolean>;
}

// Small talk while everyone gets ready. Lobby only, never saved.
// The server checks the length and the one-per-second limit; this just
// mirrors the length so people see the limit before they hit it.
export function LobbyChat({ messages, playerId, onSend }: LobbyChatProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list !== null) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages.length]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (text.trim() === "" || sending) {
      return;
    }
    setSending(true);
    const sent = await onSend(text);
    setSending(false);
    if (sent) {
      setText("");
    }
  }

  const left = CHAT_MAX_LENGTH - text.length;

  return (
    <Card className="grid gap-4">
      <CardTitle>Chat</CardTitle>
      <ol ref={listRef} aria-label="Chat messages" aria-live="polite" className="grid max-h-48 gap-2 overflow-y-auto">
        {messages.length === 0 && <li className="text-sm text-mist">No messages yet. Say hi!</li>}
        {messages.map((message) => (
          <li key={message.id} className="text-[15px] leading-snug break-words">
            <Label className={message.playerId === playerId ? "text-gold" : "text-mist"}>{message.playerName}</Label>{" "}
            <span className="text-ivory">{message.text}</span>
          </li>
        ))}
      </ol>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder="Say something…"
          aria-label="Chat message"
          enterKeyHint="send"
          autoComplete="off"
          className={`${INPUT_CLASS} min-h-11 flex-1 text-base`}
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={sending || text.trim() === ""}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-ink transition disabled:opacity-40"
        >
          <Send size={18} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      </form>
      {left <= 20 && <p className="text-right text-xs text-mist">{left} characters left</p>}
    </Card>
  );
}
