import { useEffect, useRef, useState } from "react";
import { HOW_TO_PLAY_CARDS } from "../lib/howToPlay";
import { useHelpStore } from "../store/helpStore";
import { ChromeBlob, type ChromeShape } from "./brand/ChromeBlob";
import { ICON_STROKE } from "./brand/primitives";
import { Sheet } from "./Sheet";
import { Button } from "./ui";

const BLOB_SHAPES: ChromeShape[] = ["ring", "pebble", "ribbon", "ring"];

// The 4 how-to-play cards, one at a time: a bottom sheet on phones,
// a centred dialog on wider screens.
export function HowToPlay() {
  const open = useHelpStore((store) => store.open);
  const hide = useHelpStore((store) => store.hide);
  const [index, setIndex] = useState(0);
  const nextButton = useRef<HTMLButtonElement>(null);

  // Start from the first card each time, with focus on Next.
  // (The sheet handles Esc and keeps focus inside.)
  useEffect(() => {
    if (!open) {
      return;
    }
    setIndex(0);
    nextButton.current?.focus();
  }, [open]);

  const card = HOW_TO_PLAY_CARDS[index];
  if (!card) {
    return null;
  }
  const isLast = index === HOW_TO_PLAY_CARDS.length - 1;
  const { Icon } = card;

  function next() {
    if (isLast) {
      hide();
    } else {
      setIndex(index + 1);
    }
  }

  return (
    <Sheet open={open} onClose={hide} title={`How to play · ${index + 1} / ${HOW_TO_PLAY_CARDS.length}`} className="isolate overflow-hidden">
      <div className="relative text-center">
        {/* A different chrome shape for each card, behind the text. */}
        <ChromeBlob
          shape={BLOB_SHAPES[index % BLOB_SHAPES.length] ?? "ring"}
          className="absolute -top-16 -right-14 -z-10 w-40 opacity-90"
        />
        <Icon size={40} strokeWidth={ICON_STROKE} className="mx-auto mt-4 text-gold" aria-hidden />
        <h2 id="how-to-play-title" className="display-serif mt-4 text-5xl text-ivory">
          {card.title}
        </h2>
        <p className="mt-4 text-mist">{card.text}</p>

        <div className="my-6 flex justify-center gap-2" aria-hidden>
          {HOW_TO_PLAY_CARDS.map((shown, dot) => (
            <span key={shown.title} className={`h-px w-8 ${dot === index ? "bg-ivory" : "bg-mist/15"}`} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          {index === 0 ? (
            <Button variant="ghost" onClick={hide}>
              Skip
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setIndex(index - 1)}>
              Back
            </Button>
          )}
          <Button ref={nextButton} onClick={next}>
            {isLast ? "Let's play" : "Next"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
