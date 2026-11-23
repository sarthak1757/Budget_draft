import { getBidBlockReason, minimumBid, type AuctionState, type PublicPlayerState } from "@budget-draft/shared";
import { Label, PillButton, UrgentNote } from "./brand/primitives";
import { RollingNumber } from "./MotionBits";

// Quick-bid steps: one tap raises the high bid by this much.
export const QUICK_BID_STEPS = [1, 2, 5];

interface BidBarProps {
  auction: AuctionState;
  highBidderName: string | null;
  bidder: PublicPlayerState | undefined; // whose budget the buttons are checked against
  canAct: boolean;
  busy?: boolean;
  // Phones: the three bids and PASS share one row, to keep the bottom bar short.
  compact?: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}

// The auction version of the BUY/PASS bar. The turn label is drawn by the board.
export function BidBar({ auction, highBidderName, bidder, canAct, busy = false, compact = false, onBid, onPass }: BidBarProps) {
  const minimum = minimumBid(auction);

  // Why the smallest bid is blocked, shown under the buttons (e.g. the budget rule).
  let blockReason: string | null = null;
  if (bidder) {
    blockReason = getBidBlockReason(bidder, auction, minimum);
  }

  const passButton = (
    <PillButton
      variant="secondary"
      className={compact ? "px-2 py-3 text-base tracking-[0.12em]" : "py-3 text-lg tracking-[0.15em]"}
      disabled={!canAct || busy}
      onClick={onPass}
    >
      PASS
    </PillButton>
  );

  return (
    <div className="grid gap-3">
      <p className={`flex items-baseline justify-center gap-3 text-center ${compact ? "min-h-6" : "min-h-8"}`} aria-live="polite">
        {auction.highBidderId === null ? (
          <Label>No bids yet · opening bid ${minimum}</Label>
        ) : (
          <>
            <Label>High bid · {highBidderName}</Label>
            <span className={`display-serif inline-flex text-ivory ${compact ? "text-2xl" : "text-4xl"}`}>
              $<RollingNumber value={auction.highBid} />
            </span>
          </>
        )}
      </p>
      <div className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-3"}`}>
        {QUICK_BID_STEPS.map((step) => {
          // With no bids yet, "+$1" means "open at $1".
          const amount = auction.highBid + step;
          const blocked = bidder === undefined || getBidBlockReason(bidder, auction, amount) !== null;
          return (
            <PillButton
              key={step}
              className="grid gap-0 px-2 py-3 text-lg leading-tight"
              disabled={!canAct || busy || blocked}
              onClick={() => onBid(amount)}
              aria-label={`Bid $${amount}`}
            >
              ${amount}
              <span className="label-caps opacity-80">+${step}</span>
            </PillButton>
          );
        })}
        {compact && passButton}
      </div>
      {!compact && passButton}
      {canAct && blockReason !== null && (
        <p className="text-center">
          <UrgentNote>{blockReason}</UrgentNote>
        </p>
      )}
    </div>
  );
}
