// POST /api/submit
// Body: { prompt: string, joke_text: string }

export async function onRequestPost(context) {
  const { env } = context;
  const db = env.DB;
  const { request } = context;

  try {
    const body = await request.json();
    const prompt = (body.prompt || "").trim();
    const jokeText = (body.joke_text || "").trim();

    if (!prompt || !jokeText) {
      return jsonResponse({ error: "Missing prompt or joke_text" }, 400);
    }

    const uuidHuman = crypto.randomUUID();
    const uuidLlm = crypto.randomUUID();
    const battleId = crypto.randomUUID();

    // Insert human joke
    await db
      .prepare(
        `INSERT INTO jokes (id, prompt, text, is_human) VALUES (?, ?, ?, 1)`
      )
      .bind(uuidHuman, prompt, jokeText)
      .run();

    // Generate LLM joke
    const llmText = await generateLlmJoke(env, prompt);

    // Insert LLM joke
    await db
      .prepare(
        `INSERT INTO jokes (id, prompt, text, is_human) VALUES (?, ?, ?, 0)`
      )
      .bind(uuidLlm, prompt, llmText)
      .run();

    // Create battle
    await db
      .prepare(
        `INSERT INTO battles (id, human_joke_id, llm_joke_id) VALUES (?, ?, ?)`
      )
      .bind(battleId, uuidHuman, uuidLlm)
      .run();

    return jsonResponse({ ok: true, battle_id: battleId });
  } catch (err) {
    console.error("submit error", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Very simple LLM client stub.
// Wire this up to your provider (e.g. OpenAI) using an API key in env.OPENAI_API_KEY.
async function generateLlmJoke(env, prompt) {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    // Fallback if you don't want to configure an LLM yet
    return `(LLM placeholder) Here's a lame joke about: ${prompt}`;
  }

  // Example for OpenAI's chat completions endpoint.
  // Adjust model name / URL / payload as needed.
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a stand-up comedian. Respond with a single joke.",
        },
        {
          role: "user",
          content: `Tell a short, funny joke based on this prompt: "${prompt}"`,
        },
      ],
      max_tokens: 80,
    }),
  });

  if (!response.ok) {
    console.error("LLM error", await response.text());
    return `(LLM failed) Backup joke about: ${prompt}`;
  }

  const data = await response.json();
  const content =
    data.choices?.[0]?.message?.content ||
    `(LLM empty response) Backup joke about: ${prompt}`;
  return content.trim();
}
