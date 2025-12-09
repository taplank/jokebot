// GET /api/results
// Returns:
// {
//   total_votes: number,
//   human_win_rate: number,
//   per_prompt: [{ prompt, human_win_rate, vote_count }]
// }

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  try {
    // Overall stats
    const aggResult = await db
      .prepare(
        `SELECT 
           COUNT(*) AS total_votes,
           SUM(human_is_winner) AS human_wins
         FROM votes`
      )
      .all();

    const aggRow = aggResult.results?.[0] || {
      total_votes: 0,
      human_wins: 0,
    };
    const totalVotes = aggRow.total_votes || 0;
    const humanWins = aggRow.human_wins || 0;

    let humanWinRate = 0;
    if (totalVotes > 0) {
      humanWinRate = (humanWins * 100.0) / totalVotes;
    }

    // Per-prompt stats
    const perPromptResult = await db
      .prepare(
        `SELECT 
           j.prompt AS prompt,
           COUNT(v.id) AS vote_count,
           SUM(v.human_is_winner) AS human_wins
         FROM votes v
         JOIN battles b ON v.battle_id = b.id
         JOIN jokes j ON b.human_joke_id = j.id
         GROUP BY j.prompt
         ORDER BY vote_count DESC
         LIMIT 50`
      )
      .all();

    const perPrompt = (perPromptResult.results || []).map((row) => {
      const votes = row.vote_count || 0;
      const wins = row.human_wins || 0;
      const rate = votes > 0 ? (wins * 100.0) / votes : 0;
      return {
        prompt: row.prompt,
        vote_count: votes,
        human_win_rate: rate,
      };
    });

    return jsonResponse({
      total_votes: totalVotes,
      human_win_rate: humanWinRate,
      per_prompt: perPrompt,
    });
  } catch (err) {
    console.error("results error", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
