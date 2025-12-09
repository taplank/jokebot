// GET /api/random-battle
// -> { battleId, questionText, answers: [{ id, text }] }

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  try {
    // Random question with at least 2 answers
    const qRes = await db
      .prepare(
        `SELECT q.id, q.text
         FROM questions q
         JOIN answers a ON a.question_id = q.id
         GROUP BY q.id
         HAVING COUNT(a.id) >= 2
         ORDER BY RANDOM()
         LIMIT 1`,
      )
      .all();

    if (!qRes.results || qRes.results.length === 0) {
      return json({ error: "No battles yet" }, 404);
    }

    const question = qRes.results[0];

    // All answers for that question
    const aRes = await db
      .prepare(
        `SELECT id, text, source, user_name, strategy
         FROM answers
         WHERE question_id = ?`,
      )
      .bind(question.id)
      .all();

    const answers = aRes.results || [];
    if (answers.length < 2) {
      return json({ error: "Not enough answers for a battle" }, 404);
    }

    shuffle(answers);
    const a1 = answers[0];
    let a2 = answers[1];

    // Ensure distinct answers
    if (a2.id === a1.id && answers.length > 2) {
      a2 = answers[2];
    }

    const now = Date.now();
    const battleId = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO battles
         (id, question_id, answer1_id, answer2_id, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(battleId, question.id, a1.id, a2.id, now)
      .run();

    const displayAnswers = [a1, a2];
    shuffle(displayAnswers); // randomize A/B order on screen

    return json({
      battleId,
      questionText: question.text,
      answers: displayAnswers.map((a) => ({
        id: a.id,
        text: a.text,
      })),
    });
  } catch (err) {
    console.error("random-battle error", err);
    return json({ error: "Internal error" }, 500);
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
