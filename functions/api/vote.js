// POST /api/vote
// Body: { battleId, winnerAnswerId }
// -> { ok, questionText, winner: {...}, loser: {...} }

const STRATEGIES = ["gemini_v1", "qwen_v1"];

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;

  try {
    const body = await request.json();
    const battleId = (body.battleId || "").trim();
    const winnerAnswerId = (body.winnerAnswerId || "").trim();

    if (!battleId || !winnerAnswerId) {
      return json({ error: "Missing battleId or winnerAnswerId" }, 400);
    }

    // Get battle + question
    const bRes = await db
      .prepare(
        `SELECT b.id, b.question_id, q.text AS question_text,
                b.answer1_id, b.answer2_id
         FROM battles b
         JOIN questions q ON q.id = b.question_id
         WHERE b.id = ?`,
      )
      .bind(battleId)
      .all();

    if (!bRes.results || bRes.results.length === 0) {
      return json({ error: "Battle not found" }, 404);
    }
    const battle = bRes.results[0];

    // Get both answers
    const aRes = await db
      .prepare(
        `SELECT id, text, source, user_name, strategy
         FROM answers
         WHERE id IN (?, ?)`,
      )
      .bind(battle.answer1_id, battle.answer2_id)
      .all();

    if (!aRes.results || aRes.results.length !== 2) {
      return json({ error: "Answers missing" }, 500);
    }

    const ans1 = aRes.results[0];
    const ans2 = aRes.results[1];

    const winner =
      ans1.id === winnerAnswerId
        ? ans1
        : ans2.id === winnerAnswerId
        ? ans2
        : null;
    const loser =
      winner && winner.id === ans1.id
        ? ans2
        : winner && winner.id === ans2.id
        ? ans1
        : null;

    if (!winner || !loser) {
      return json({ error: "Winner not in this battle" }, 400);
    }

    const voteId = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO votes
         (id, battle_id, winner_answer_id, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(voteId, battleId, winnerAnswerId, now)
      .run();

    // RL update: AI strategies
    await ensureStrategyRows(db);

    const answers = [ans1, ans2];
    for (const a of answers) {
      if (a.source === "human" || !a.strategy) continue;
      // uses++
      await db
        .prepare(
          `UPDATE strategy_stats
           SET uses = uses + 1
           WHERE strategy = ?`,
        )
        .bind(a.strategy)
        .run();
    }

    if (winner.source !== "human" && winner.strategy) {
      await db
        .prepare(
          `UPDATE strategy_stats
           SET wins = wins + 1
           WHERE strategy = ?`,
        )
        .bind(winner.strategy)
        .run();
    }

    return json({
      ok: true,
      questionText: battle.question_text,
      winner: formatAnswerForReveal(winner),
      loser: formatAnswerForReveal(loser),
    });
  } catch (err) {
    console.error("vote error", err);
    return json({ error: "Internal error" }, 500);
  }
}

function formatAnswerForReveal(a) {
  let label;
  if (a.source === "human") {
    label = a.user_name ? a.user_name : "User";
  } else if (a.source === "gemini") {
    label = "GEMINI";
  } else if (a.source === "qwen") {
    label = "QWEN";
  } else {
    label = a.source.toUpperCase();
  }

  return {
    id: a.id,
    text: a.text,
    source: a.source,
    label,
  };
}

async function ensureStrategyRows(db) {
  const batch = db.batch();
  for (const s of STRATEGIES) {
    batch
      .prepare(
        `INSERT OR IGNORE INTO strategy_stats (strategy, wins, uses)
         VALUES (?, 0, 0)`,
      )
      .bind(s);
  }
  await batch.commit();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
