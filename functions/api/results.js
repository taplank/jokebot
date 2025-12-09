// GET /api/results
// -> { total_votes, human_win_rate, gemini_win_rate, qwen_win_rate }

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  try {
    const res = await db
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

    const row = res.results?.[0] || {
      total_votes: 0,
      human_wins: 0,
      gemini_wins: 0,
      qwen_wins: 0,
    };

    const total = row.total_votes || 0;
    const rate = (wins) => (total > 0 ? (wins * 100.0) / total : 0);

    return json({
      total_votes: total,
      human_win_rate: rate(row.human_wins || 0),
      gemini_win_rate: rate(row.gemini_wins || 0),
      qwen_win_rate: rate(row.qwen_wins || 0),
    });
  } catch (err) {
    console.error("results error", err);
    return json({ error: "Internal error" }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
