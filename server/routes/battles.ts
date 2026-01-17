import { Hono } from "@hono/hono";
import { BattleManager } from "../battle_manager.ts";
import type {
  CreateBattleRequest,
  ChoiceRequest,
  BattleResponse,
  BattleStateResponse,
  ErrorResponse,
} from "../types.ts";

export function createBattleRoutes(battleManager: BattleManager) {
  const app = new Hono();

  // Create a new battle
  app.post("/", async (c) => {
    try {
      const body = await c.req.json<CreateBattleRequest>().catch(() => ({}));
      const seed = body.seed;

      const result = await battleManager.createBattle(seed);

      const response: BattleResponse = {
        battleId: result.battle_id,
        turn: result.turn,
        log: result.log,
        request: result.request,
        ended: result.ended,
        winner: result.winner,
      };

      return c.json(response, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json<ErrorResponse>({ error: message }, 500);
    }
  });

  // Make a choice in an existing battle
  app.post("/:battleId/choice", async (c) => {
    try {
      const battleId = c.req.param("battleId");

      if (!battleManager.hasBattle(battleId)) {
        return c.json<ErrorResponse>({ error: "Battle not found" }, 404);
      }

      const body = await c.req.json<ChoiceRequest>();
      if (!body.choice) {
        return c.json<ErrorResponse>({ error: "Missing 'choice' in request body" }, 400);
      }

      const result = await battleManager.makeChoice(battleId, body.choice);

      if (!result.ok) {
        return c.json<ErrorResponse>({ error: result.error ?? "Unknown error" }, 400);
      }

      const response: BattleResponse = {
        battleId,
        turn: result.turn,
        log: result.log,
        request: result.request,
        ended: result.ended,
        winner: result.winner,
      };

      return c.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json<ErrorResponse>({ error: message }, 500);
    }
  });

  // Get battle state
  app.get("/:battleId", async (c) => {
    try {
      const battleId = c.req.param("battleId");

      if (!battleManager.hasBattle(battleId)) {
        return c.json<ErrorResponse>({ error: "Battle not found" }, 404);
      }

      const result = await battleManager.getState(battleId);

      if (!result.ok) {
        return c.json<ErrorResponse>({ error: "Failed to get state" }, 500);
      }

      const response: BattleStateResponse = {
        battleId,
        turn: result.turn,
        started: result.started,
        ended: result.ended,
        winner: result.winner,
        player: {
          pokemon: result.p1_pokemon,
        },
        opponent: {
          pokemon: result.p2_pokemon,
        },
      };

      return c.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json<ErrorResponse>({ error: message }, 500);
    }
  });

  // Delete/forfeit a battle
  app.delete("/:battleId", async (c) => {
    try {
      const battleId = c.req.param("battleId");

      if (!battleManager.hasBattle(battleId)) {
        return c.json<ErrorResponse>({ error: "Battle not found" }, 404);
      }

      await battleManager.cleanupBattle(battleId);

      return c.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return c.json<ErrorResponse>({ error: message }, 500);
    }
  });

  return app;
}
