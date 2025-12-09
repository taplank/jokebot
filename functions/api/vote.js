// POST /api/vote
// Body: { battleId: string, winnerJokeId: string }

export async function onRequestPost(context) {
  const { env } = context;
  const db = env.DB;
  const { request } = context;

  try {
    const body = await request.json();
    const battleId = body.battleId;
    const winnerJokeId = body.winnerJokeId;

    if (!battleId || !winnerJokeId) {
      return jsonResponse({ error: "Missing battleId or winnerJokeId" }, 400);
    }

    // Verify battle exists
    const battleResult = await db
      .prepare(`SELECT id FROM battles WHERE id = ?`)
      .bind(battleId)
      .all();

    if (!battleResult.results || battleResult.results.length === 0) {
      return jsonResponse({ error: "Battle not found" }, 404);
    }

    // Find winner joke and whether it's human
    const jokeResult = await db
      .prepare(`SELECT is_human FROM jokes WHERE id = ?`)
      .bind(winnerJokeId)
      .all();

    if (!jokeResult.results || jokeResult.results.length === 0) {
      return jsonResponse({ error: "Winner joke not found" }, 404);
    }

    const isHuman = jokeResult.results[0].is_human === 1;

    const voteId = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO votes (id, battle_id, winner_joke_id, human_is_winner, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(voteId, battleId, winnerJokeId, isHuman ? 1 : 0, now)
      .run();

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("vote error", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
