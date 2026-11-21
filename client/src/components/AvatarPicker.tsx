import { AVATAR_IDS, type AvatarId } from "@budget-draft/shared";
import { AVATAR_LOOKS } from "../lib/avatars";

interface AvatarPickerProps {
  value: AvatarId | undefined;
  disabled?: boolean;
  onChange: (avatar: AvatarId) => void;
}

// 12 avatars in two rows of six. 44px targets still fit a 360px phone.
export function AvatarPicker({ value, disabled = false, onChange }: AvatarPickerProps) {
  return (
    <div role="radiogroup" aria-label="Avatar" className="grid grid-cols-6 justify-items-center gap-2">
      {AVATAR_IDS.map((id) => {
        const look = AVATAR_LOOKS[id];
        const Icon = look.icon;
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={look.label}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={`grid size-11 place-items-center rounded-full transition disabled:opacity-50 ${look.className} ${selected ? "outline-2 outline-offset-2 outline-gold" : "opacity-80 hover:opacity-100"}`}
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
