// GET /api/random-question
// -> { id, text }

const QUESTION_SEEDS = [
  {
    text: "What’s the worst thing to scream on a trampoline while your parents are watching Seinfeld in the house?",
    humanAnswers: [
      "Huh, was my leg always bent like that?",
    ],
  },
  {
    text: "What’s the nerdiest thing you could say on a first date?",
    humanAnswers: [
      "Our compatibility score is O(1).",
    ],
  },
  {
    text: "What’s the worst possible name for a study group?",
    humanAnswers: [
      "Math Study Group",
    ],
  },
  {
    text: "What’s an absolutely cursed way to start a college essay?",
    humanAnswers: [
      "It all started when I opened ChatGPT.",
      "When I was in middle school, I was always much shorter than most adults.",
    ],
  },
  {
    text: "What should be illegal to Google at 3 a.m.?",
    humanAnswers: [
      "how to commit crimes (illegal at not 3 a.m too)",
      "how to make a script that automatically performs actions on a website"
    ],
  },
  {
    text: "What’s 2+2?",
    humanAnswers: [
      "™",
      "Erm actually, it's 4",
      "Capitalism."
    ],
  },
  {
    text: "How was the moon landing faked?",
    humanAnswers: [
      "It wasn't you conspiracy theorist",
      "According to Bordino et al, repeated exposure to post-RGB light patterns can inhibit System 2 actions in the brain, allowing it to receive input without undergoing additional checks. Then, a -240Hz signal was broadcasted, tricking anyone who heard it into believing they watched a video of the moon landing",
    ],
  },
  {
    text: "What’s something you should never say to your doctor after you're born?",
    humanAnswers: [
      "...",
      "*screams* FIRE!",
      "What's up gamers, welcome back to another speedrun of Homo Sapiens -- we're trying to go for a sub 30 second time today", 
    ],
  },
  {
    text: "What is the most suspicious thing to bring to an airport",
    humanAnswers: [
      "A lawyer.",
    ],
  },
  {
    text: "What would your mom say if they saw your search history right now?",
    humanAnswers: [
      "",
    ],
  },
];

export async function onRequestGet(context) {
  const { env } = context;
  const db = env.DB;

  try {
    // Seed DB once on first call
    const countRes = await db
      .prepare("SELECT COUNT(*) AS c FROM questions")
      .all();
    const count = countRes.results?.[0]?.c || 0;

    if (count === 0) {
      const now = Date.now();
      const batch = db.batch();

      for (const q of QUESTION_SEEDS) {
        const qid = crypto.randomUUID();
        batch
          .prepare(
            "INSERT INTO questions (id, text, mode) VALUES (?, ?, 'quiplash')",
          )
          .bind(qid, q.text);

        for (const ans of q.humanAnswers) {
          const aid = crypto.randomUUID();
          batch
            .prepare(
              `INSERT INTO answers
               (id, question_id, text, source, user_name, strategy, created_at)
               VALUES (?, ?, ?, 'human', 'A', NULL, ?)`,
            )
            .bind(aid, qid, ans, now);
        }
      }

      await batch.commit();
    }

    const qRes = await db
      .prepare("SELECT id, text FROM questions ORDER BY RANDOM() LIMIT 1")
      .all();

    if (!qRes.results || qRes.results.length === 0) {
      return json({ error: "No questions available" }, 500);
    }

    const question = qRes.results[0];
    return json({ id: question.id, text: question.text });
  } catch (err) {
    console.error("random-question error", err);
    return json({ error: "Internal error" }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
