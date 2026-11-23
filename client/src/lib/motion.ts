import type { Transition } from "motion/react";

// Every duration, easing, spring and stagger the app's animations use, in one
// place. Components import these instead of writing their own numbers.
//
// CSS-only effects follow the same numbers: button presses use Tailwind's
// default 150ms transition (= GAME_MOMENT.press), and CSS keyframes that need
// a duration get it from here through an inline animation-duration.
//
// Rules:
// - Animate only transform and opacity, so cheap phones stay smooth.
// - Game moments take 150–400ms and never block input or the turn timer.
// - With "reduce motion" on, <MotionConfig reducedMotion="user"> (main.tsx)
//   drops the movement and keeps the fades. Hand-rolled effects (coin
//   flight, confetti, tilt) check useReducedMotion() and skip themselves.

// Seconds. Game moments: things that happen during a turn.
export const GAME_MOMENT = {
  press: 0.15, // the small nudge when a card is passed along
  bump: 0.2, // price badge and odometer on a new high bid
  fade: 0.25, // a card fading away, the timer pulse settling
  slot: 0.3, // a bought item settling into its slot
  shake: 0.3, // a mystery item wobbling before it settles
  flip: 0.35, // a new item sliding off the deck and turning over
  coin: 0.4, // the price flying from a budget to the slot
  split: 0.4, // Veto: the card's two halves falling apart
} as const;

// Seconds. Everything outside a turn: pages, sheets, results.
export const DURATION = {
  exit: 0.12, // a page or row leaving: quick, so the next one isn't kept waiting
  enter: 0.25, // a page, toast or lobby row arriving
  modal: 0.22, // a dialog scaling in on wide screens
  countUp: 0.9, // results scores counting up from 0
  banner: 1.3, // how long "Your turn" stays on screen
  glowPulse: 1.2, // one breath of the high bidder's glow
  letterRise: 0.5, // one letter of the home title rising into place
  shimmer: 1.4, // one sweep of the loading skeleton's shine
} as const;

// Milliseconds, for timers that aren't motion transitions.
export const CONFETTI_MS = 1500;

// Seconds: when each part of the results screen starts, so they arrive in order:
// the winner, then the team cards, then their slots, then the badges.
export const RESULTS_DELAY = {
  cards: 0.25, // first team card
  perCard: 0.08, // each later card
  slots: 0.45, // first slot of a card (after the card itself)
  badges: 0.9, // first achievement badge
} as const;

// Seconds between items in a staggered list.
export const STAGGER = {
  row: 0.05, // leaderboard rows
  slot: 0.07, // results: one team slot after another
  badge: 0.12, // achievement badges
  letter: 0.045, // the home title, letter by letter
} as const;

// Cubic-bezier curves.
export const EASE = {
  out: [0.2, 0.8, 0.2, 1],
  in: [0.4, 0, 1, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

// Springs for things the finger moved: sheets and pops.
export const SPRING = {
  sheet: { type: "spring", stiffness: 420, damping: 40, mass: 0.9 },
  pop: { type: "spring", stiffness: 520, damping: 22 },
  parallax: { stiffness: 60, damping: 18, mass: 0.6 }, // for useSpring (no type field)
} as const;

// Distances in px, so "slide in" means the same everywhere.
export const DISTANCE = {
  page: 14,
  row: 10,
  banner: 24,
  deck: 28,
  parallax: 14, // how far the home blob drifts toward the mouse
} as const;

// Ready-made transitions.
export const enterTransition: Transition = { duration: DURATION.enter, ease: EASE.out };
export const exitTransition: Transition = { duration: DURATION.exit, ease: EASE.in };

export function gameTransition(duration: number, delay = 0): Transition {
  return { duration, delay, ease: EASE.out };
}
