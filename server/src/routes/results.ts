import { Router } from "express";
import { computeResults, localResultSchema, resultIdSchema, resultIdsQuerySchema, type SaveResultResponse } from "@budget-draft/shared";
import { parseOrThrow } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { findSavedGames, saveGameResult } from "../services/gameResults";
import { localResultToState } from "../services/localResults";

// POST /api/results: lets the browser store a finished local or bot game.
// These are saved with countsForLeaderboard = false (see saveGameResult).
export function resultsRouter(): Router {
  const router = Router();
  router.post("/", async (req, res) => {
    const submitted = parseOrThrow(localResultSchema, req.body);
    const state = localResultToState(submitted);
    const id = await saveGameResult(state, computeResults(state));
    const body: SaveResultResponse = { ok: true, id };
    res.status(201).json(body);
  });

  // GET /api/results?ids=a,b,c: this device's games for "My games" (up to 20).
  // Ids are unguessable, so knowing one is the only "login" needed to see it.
  router.get("/", async (req, res) => {
    const ids = parseOrThrow(resultIdsQuerySchema, req.query.ids);
    res.json(await findSavedGames(ids));
  });

  // GET /api/results/:id: one game, with the final teams.
  router.get("/:id", async (req, res) => {
    const id = parseOrThrow(resultIdSchema, req.params.id);
    const [game] = await findSavedGames([id]);
    if (!game) {
      throw new HttpError(404, "That game wasn't found");
    }
    res.json(game);
  });
  return router;
}
