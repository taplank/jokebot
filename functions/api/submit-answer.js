// POST /api/submit-answer
// Body: { questionId, answerText, userName? }

const GEMINI_MODEL = "gemini-1.5-flash";
const STRATEGIES = ["gemini_v1", "qwen_v1"];

export async function onRequestPost(context) {
  const { env, request } = context;
  const db = env.DB;

  try {
    const body = await request.json();
    const questionId = (body.questionId || "").trim();
    const answerText = (body.answerText || "").trim();
    let userName = (body.userName || "").trim();

    if (!questionId || !answerText) {
      return json({ error: "Missing questionId or answerText" }, 400);
    }

    if (userName.length > 1) userName = userName[0];
    if (userName === "") userName = null;

    // Question exists?
    const qRes = await db
      .prepare("SELECT id, text FROM questions WHERE id = ?")
      .bind(questionId)
      .all();
    if (!qRes.results || qRes.results.length === 0) {
      return json({ error: "Question not found" }, 404);
    }
    const question = qRes.results[0];

    const now = Date.now();
    const humanId = crypto.randomUUID();

    // Insert human answer
    await db
      .prepare(
        `INSERT INTO answers
         (id, question_id, text, source, user_name, strategy, created_at)
         VALUES (?, ?, ?, 'human', ?, NULL, ?)`,
      )
      .bind(humanId, questionId, answerText, userName, now)
      .run();

    // Generate a couple of AI answers for this question (Gemini/Qwen via RL)
    await ensureStrategyRows(db);

    for (let i = 0; i < 2; i++) {
      const strategy = await pickStrategy(db);
      const aiText = await generateAiJoke(env, question.text, strategy);
      const aiSource = strategy.startsWith("gemini")
        ? "gemini"
        : "qwen";
      const aid = crypto.randomUUID();

      await db
        .prepare(
          `INSERT INTO answers
           (id, question_id, text, source, user_name, strategy, created_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        )
        .bind(aid, questionId, aiText, aiSource, strategy, now)
        .run();
    }

    // No need to create battles here; /random-battle will create them on demand
    return json({ ok: true });
  } catch (err) {
    console.error("submit-answer error", err);
    return json({ error: "Internal error" }, 500);
  }
}

async function generateAiJoke(env, questionText, strategy) {
  if (strategy.startsWith("gemini")) {
    return generateGeminiJoke(env, questionText);
  } else if (strategy.startsWith("qwen")) {
    return generateQwenJoke(env, questionText);
  } else {
    return `(Unknown strategy ${strategy}) Joke for: ${questionText}`;
  }
}

// --- Gemini ---

async function generateGeminiJoke(env, questionText) {
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return `(Gemini placeholder) Joke for: ${questionText}`;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "You are a stand-up comedian. " +
                "Write one short, clean, original joke answer to this prompt:\n\n" +
                questionText,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 80,
        temperature: 0.9,
      },
    }),
  });

  if (!resp.ok) {
    console.error("Gemini error", await resp.text());
    return `(Gemini failed) Backup joke for: ${questionText}`;
  }

  const data = await resp.json();
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("") || "(Gemini empty response)";
  return text.trim();
}

// --- Qwen via Ollama ---
// Local dev: run `ollama serve` and pull a model, e.g. `ollama run qwen2.5:1.5b`.
// Then set QWEN_OLLAMA_URL=http://127.0.0.1:11434/api/chat (or leave default).

async function generateQwenJoke(env, questionText) {
  const endpoint =
    env.QWEN_OLLAMA_URL ||
    process.env.QWEN_OLLAMA_URL ||
    "http://127.0.0.1:11434/api/chat";
  const model =
    env.QWEN_MODEL_NAME || process.env.QWEN_MODEL_NAME || "qwen2.5:1.5b";

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content:
              "You are a stand-up comedian. " +
              "Write one short, clean, original joke answer to this prompt:\n\n" +
              questionText,
          },
        ],
        stream: false,
      }),
    });

    if (!resp.ok) {
      console.error("Qwen/Ollama error", await resp.text());
      return `(Qwen failed) Backup joke for: ${questionText}`;
    }

    const data = await resp.json();
    const text = data.message?.content || "(Qwen empty response)";
    return text.trim();
  } catch (err) {
    console.error("Qwen/Ollama fetch error", err);
    return `(Qwen error) Backup joke for: ${questionText}`;
  }
}

// --- RL helpers: epsilon-greedy over strategies ---

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

async function pickStrategy(db) {
  const res = await db
    .prepare(
      `SELECT strategy, wins, uses
       FROM strategy_stats
       WHERE strategy IN (?, ?)`,
    )
    .bind(STRATEGIES[0], STRATEGIES[1])
    .all();

  const stats = {};
  for (const row of res.results || []) {
    stats[row.strategy] = {
      wins: row.wins || 0,
      uses: row.uses || 0,
    };
  }
  for (const s of STRATEGIES) {
    if (!stats[s]) stats[s] = { wins: 0, uses: 0 };
  }

  const epsilon = 0.2; // 20% explore
  if (Math.random() < epsilon) {
    // explore: random strategy
    return STRATEGIES[(Math.random() * STRATEGIES.length) | 0];
  }

  // exploit: highest empirical win-rate
  let best = STRATEGIES[0];
  let bestRate = -1;
  for (const s of STRATEGIES) {
    const { wins, uses } = stats[s];
    const rate = uses > 0 ? wins / uses : 0.5; // neutral prior
    if (rate > bestRate) {
      bestRate = rate;
      best = s;
    }
  }
  return best;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
