// The "fair" price for a rating. Seed data follows this roughly, so price is
// a decent hint of quality. The exceptions (bargains and overpriced items)
// are what make the draft interesting: spotting them is the skill.
// Shared by the seed checks (server) and the Bargain Hunter achievement.
export function expectedPrice(rating: number): number {
  if (rating >= 95) return 10;
  if (rating >= 90) return 9;
  if (rating >= 85) return 8;
  if (rating >= 80) return 7;
  if (rating >= 75) return 6;
  if (rating >= 70) return 5;
  if (rating >= 65) return 4;
  if (rating >= 60) return 3;
  if (rating >= 55) return 2;
  return 1;
}
