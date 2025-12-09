// GET /api/admin-strategies
// -> { strategies: [{ strategy, wins, uses, win_rate }], totals: {...} }

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  try {
    // Strategy stats (Gemini vs Qwen)
    const sRes = await db
      .prepare(
        `SELECT strategy, wins, uses
         FROM strategy_stats
         ORDER BY strategy`,
      )
      .all();

    const strategies = (sRes.results || []).map((row) => {
      const wins = row.wins || 0;
      const uses = row.uses || 0;
      const winRate = uses > 0 ? (wins * 100.0) / uses : 0;
      return {
        strategy: row.strategy,
        wins,
        uses,
        win_rate: winRate,
      };
    });

    // Overall human vs AI win counts (from votes)
    const vRes = await db
      .prepare(
        `SELECT
           COUNT(*) AS total_votes,
           SUM(CASE WHEN a.source = 'human' THEN 1 ELSE 0 END) AS human_wins,
           SUM(CASE WHEN a.source = 'gemini' THEN 1 ELSE 0 END) AS gemini_wins,
           SUM(CASE WHEN a.source = 'qwen' THEN 1 ELSE 0 END) AS qwen_wins
         FROM votes v
         JOIN answers a ON v.winner_answer_id = a.id`,
      )
      .all();

    const row = vRes.results?.[0] || {};
    const totalVotes = row.total_votes || 0;

    return json({
      strategies,
      totals: {
        total_votes: totalVotes,
        human_wins: row.human_wins || 0,
        gemini_wins: row.gemini_wins || 0,
        qwen_wins: row.qwen_wins || 0,
      },
    });
  } catch (err) {
    console.error("admin-strategies error", err);
    return json({ error: "Internal error" }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
