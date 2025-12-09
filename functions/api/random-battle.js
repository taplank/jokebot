// GET /api/random-battle
// Returns: { battleId, jokes: [{ id, text }, { id, text }] }

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  try {
    // Pick a random battle
    const battlesResult = await db
      .prepare(`SELECT id, human_joke_id, llm_joke_id FROM battles ORDER BY RANDOM() LIMIT 1`)
      .all();

    if (!battlesResult.results || battlesResult.results.length === 0) {
      return jsonResponse({ error: "No battles" }, 404);
    }

    const battle = battlesResult.results[0];

    // Fetch both jokes
    const jokesResult = await db
      .prepare(
        `SELECT id, text FROM jokes WHERE id IN (?, ?)`
      )
      .bind(battle.human_joke_id, battle.llm_joke_id)
      .all();

    const jokes = jokesResult.results || [];
    if (jokes.length !== 2) {
      return jsonResponse({ error: "Battle data incomplete" }, 500);
    }

    // Randomize order so user can't see which is which
    shuffleArray(jokes);

    return jsonResponse({
      battleId: battle.id,
      jokes: jokes.map((j) => ({ id: j.id, text: j.text })),
    });
  } catch (err) {
    console.error("random-battle error", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
