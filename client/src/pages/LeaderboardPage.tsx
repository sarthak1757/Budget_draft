import { motion } from "motion/react";
import type { LeaderboardEntry } from "@budget-draft/shared";
import { Avatar } from "../components/Avatar";
import { ArrowLink, Label } from "../components/brand/primitives";
import { ErrorBox, PageShell, Spinner } from "../components/ui";
import { apiRequest } from "../lib/api";
import { DISTANCE, enterTransition, STAGGER } from "../lib/motion";
import { useAsync } from "../lib/useAsync";

function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  return apiRequest<LeaderboardEntry[]>("/api/leaderboard");
}

export function LeaderboardPage() {
  const leaderboard = useAsync(fetchLeaderboard, []);

  return (
    <PageShell title="Leaderboard" backTo="/">
      <p className="mb-8 max-w-2xl text-mist">
        Online games only. A win means the best stats score in that game (ties share the win). Best is the top score in
        a Classic game with no extras, so scores are compared fairly.
      </p>
      {leaderboard.status === "loading" && <Spinner label="Loading leaderboard…" />}
      {leaderboard.status === "error" && <ErrorBox message={leaderboard.message} onRetry={leaderboard.retry} />}
      {leaderboard.status === "ready" && leaderboard.data.length === 0 && (
        <div className="grid justify-items-start gap-5 border-y border-mist/15 py-10">
          <p className="display-serif text-5xl text-ivory">No online games yet.</p>
          <ArrowLink to="/new/online">Start an online room</ArrowLink>
        </div>
      )}
      {leaderboard.status === "ready" && leaderboard.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left">
            <thead>
              <tr className="border-b border-mist/15">
                <th className="py-3 pr-3 font-normal"><Label>#</Label></th>
                <th className="px-3 py-3 font-normal"><Label>Player</Label></th>
                <th className="px-3 py-3 text-right font-normal"><Label>Wins</Label></th>
                <th className="px-3 py-3 text-right font-normal"><Label>Games</Label></th>
                <th className="py-3 pl-3 text-right font-normal"><Label>Best</Label></th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.data.map((entry, index) => (
                <motion.tr
                  key={entry.name}
                  className="border-b border-mist/15"
                  initial={{ opacity: 0, y: DISTANCE.row }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...enterTransition, delay: index * STAGGER.row }}
                >
                  <td className="py-4 pr-3">
                    <Label className={index === 0 ? "text-ivory" : "text-mist/80"}>{String(index + 1).padStart(2, "0")}</Label>
                  </td>
                  <td className="px-3 py-4">
                    <span className="flex items-center gap-3">
                      <Avatar name={entry.name} size="sm" />
                      <span className="display-serif text-2xl text-ivory sm:text-3xl">{entry.name}</span>
                    </span>
                  </td>
                  <td className="display-serif px-3 py-4 text-right text-3xl text-ivory tabular-nums">{entry.wins}</td>
                  <td className="px-3 py-4 text-right text-mist tabular-nums">{entry.gamesPlayed}</td>
                  <td className="py-4 pl-3 text-right text-mist tabular-nums">{entry.bestScore ?? "—"}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
