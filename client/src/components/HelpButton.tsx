import { CircleHelp } from "lucide-react";
import { useHelpStore } from "../store/helpStore";
import { ICON_STROKE } from "./brand/primitives";

// The "?" in the header.
export function HelpButton() {
  const show = useHelpStore((store) => store.show);
  return (
    <button
      type="button"
      onClick={show}
      aria-label="How to play"
      title="How to play"
      className="grid size-11 place-items-center rounded-full text-mist ring-1 ring-mist/60 hover:bg-ink-hover"
    >
      <CircleHelp size={16} strokeWidth={ICON_STROKE} aria-hidden />
    </button>
  );
}
