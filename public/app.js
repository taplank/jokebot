const views = {
  submit: document.getElementById("view-submit"),
  vote: document.getElementById("view-vote"),
  results: document.getElementById("view-results"),
  admin: document.getElementById("view-admin"),
};

function showView(name) {
  Object.entries(views).forEach(([k, el]) => {
    if (k === name) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}

// Nav
document.getElementById("nav-submit").addEventListener("click", () => {
  showView("submit");
});

document.getElementById("nav-vote").addEventListener("click", () => {
  showView("vote");
  loadRandomBattle();
});

document.getElementById("nav-results").addEventListener("click", () => {
  showView("results");
  loadResults();
});

document.getElementById("nav-admin").addEventListener("click", () => {
  showView("admin");
  loadAdminStrategies();
});

// --- Submit flow ---

const loadQuestionBtn = document.getElementById("load-question-btn");
const currentQuestionEl = document.getElementById("current-question");
const questionIdInput = document.getElementById("question-id");
const submitForm = document.getElementById("submit-answer-form");
const submitMessage = document.getElementById("submit-message");

loadQuestionBtn.addEventListener("click", loadRandomQuestion);

async function loadRandomQuestion() {
  submitMessage.textContent = "";
  currentQuestionEl.textContent = "Loading question...";
  questionIdInput.value = "";

  try {
    const res = await fetch("/api/random-question");
    const data = await res.json();
    if (!res.ok) {
      currentQuestionEl.textContent =
        "Error loading question: " + (data.error || res.statusText);
      return;
    }
    questionIdInput.value = data.id;
    currentQuestionEl.textContent = data.text;
  } catch (err) {
    console.error(err);
    currentQuestionEl.textContent = "Network error loading question.";
  }
}

submitForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitMessage.textContent = "";

  const questionId = questionIdInput.value.trim();
  const answerText = document.getElementById("answer-input").value.trim();
  const userName = document.getElementById("username-input").value.trim();

  if (!questionId) {
    submitMessage.textContent = "Click 'Get a Question' first.";
    return;
  }
  if (!answerText) {
    submitMessage.textContent = "Write an answer first.";
    return;
  }

  submitMessage.textContent = "Submitting...";

  try {
    const res = await fetch("/api/submit-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, answerText, userName }),
    });
    const data = await res.json();
    if (!res.ok) {
      submitMessage.textContent =
        "Error: " + (data.error || res.statusText);
      return;
    }

    document.getElementById("answer-input").value = "";
    submitMessage.textContent =
      "Battle created! Go to the Vote tab to see how you (and the AIs) did.";
  } catch (err) {
    console.error(err);
    submitMessage.textContent = "Network error submitting answer.";
  }
});

// --- Vote flow ---

let currentBattle = null;
const voteQuestionEl = document.getElementById("vote-question");
const voteArea = document.getElementById("vote-area");
const voteMessage = document.getElementById("vote-message");
const revealBox = document.getElementById("reveal-box");
const nextBattleBtn = document.getElementById("next-battle-btn");

async function loadRandomBattle() {
  voteMessage.textContent = "";
  revealBox.classList.add("hidden");
  revealBox.innerHTML = "";
  nextBattleBtn.classList.add("hidden");
  voteArea.innerHTML = "<p>Loading a battle...</p>";
  voteQuestionEl.textContent = "";
  currentBattle = null;

  try {
    const res = await fetch("/api/random-battle");
    const data = await res.json();
    if (res.status === 404) {
      voteArea.innerHTML =
        "<p>No battles yet. Submit an answer in the first tab to create one!</p>";
      return;
    }
    if (!res.ok) {
      voteArea.innerHTML =
        "<p>Error: " + (data.error || res.statusText) + "</p>";
      return;
    }

    currentBattle = data;
    renderBattle(data);
  } catch (err) {
    console.error(err);
    voteArea.innerHTML = "<p>Network error loading battle.</p>";
  }
}

function renderBattle(battle) {
  voteQuestionEl.textContent = battle.questionText;
  const [a, b] = battle.answers;

  voteArea.innerHTML = `
    <div class="joke-card">
      <h3>Answer A</h3>
      <p>${escapeHtml(a.text)}</p>
      <button class="vote-btn" data-id="${a.id}">A is funnier</button>
    </div>
    <div class="joke-card">
      <h3>Answer B</h3>
      <p>${escapeHtml(b.text)}</p>
      <button class="vote-btn" data-id="${b.id}">B is funnier</button>
    </div>
  `;

  document.querySelectorAll(".vote-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      submitVote(battle.battleId, id);
    });
  });
}

async function submitVote(battleId, winnerAnswerId) {
  if (!battleId || !winnerAnswerId) return;
  voteMessage.textContent = "Submitting vote...";

  try {
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ battleId, winnerAnswerId }),
    });
    const data = await res.json();
    if (!res.ok) {
      voteMessage.textContent =
        "Error: " + (data.error || res.statusText);
      return;
    }

    voteMessage.textContent = "Thanks for voting!";
    showReveal(data);
    nextBattleBtn.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    voteMessage.textContent = "Network error submitting vote.";
  }
}

function showReveal(data) {
  revealBox.classList.remove("hidden");
  revealBox.innerHTML = `
    <p><strong>Prompt:</strong> ${escapeHtml(data.questionText || "")}</p>
    <p><strong>Winner:</strong> ${escapeHtml(
      data.winner.text,
    )} <em>(${escapeHtml(data.winner.label)})</em></p>
    <p><strong>Loser:</strong> ${escapeHtml(
      data.loser.text,
    )} <em>(${escapeHtml(data.loser.label)})</em></p>
    <p style="font-size:0.85rem;margin-top:0.5rem;">
      (Labels: User letters = humans; GEMINI & QWEN = AI.)
    </p>
  `;
}

nextBattleBtn.addEventListener("click", loadRandomBattle);

// --- Results ---

const resultsArea = document.getElementById("results-area");
document
  .getElementById("refresh-results-btn")
  .addEventListener("click", loadResults);

async function loadResults() {
  resultsArea.innerHTML = "<p>Loading results...</p>";
  try {
    const res = await fetch("/api/results");
    const data = await res.json();
    if (!res.ok) {
      resultsArea.innerHTML =
        "<p>Error: " + (data.error || res.statusText) + "</p>";
      return;
    }

    if (data.total_votes === 0) {
      resultsArea.innerHTML = "<p>No votes yet.</p>";
      return;
    }

    resultsArea.innerHTML = `
      <p>Total votes: <strong>${data.total_votes}</strong></p>
      <ul>
        <li>Humans win: <strong>${data.human_win_rate.toFixed(1)}%</strong></li>
        <li>Gemini wins: <strong>${data.gemini_win_rate.toFixed(1)}%</strong></li>
        <li>Qwen wins: <strong>${data.qwen_win_rate.toFixed(1)}%</strong></li>
      </ul>
    `;
  } catch (err) {
    console.error(err);
    resultsArea.innerHTML = "<p>Network error loading results.</p>";
  }
}

// --- Admin ---

const adminArea = document.getElementById("admin-strategy-area");
document
  .getElementById("refresh-admin-btn")
  .addEventListener("click", loadAdminStrategies);

async function loadAdminStrategies() {
  adminArea.innerHTML = "<p>Loading strategy stats...</p>";
  try {
    const res = await fetch("/api/admin-strategies");
    const data = await res.json();
    if (!res.ok) {
      adminArea.innerHTML =
        "<p>Error: " + (data.error || res.statusText) + "</p>";
      return;
    }

    const rows = data.strategies || [];
    const totals = data.totals || {};

    if (rows.length === 0) {
      adminArea.innerHTML = "<p>No strategy stats yet.</p>";
      return;
    }

    let html = `
      <p>Total votes recorded: <strong>${totals.total_votes || 0}</strong></p>
      <table class="admin-table">
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Uses</th>
            <th>Wins</th>
            <th>Win rate</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const s of rows) {
      html += `
        <tr>
          <td>${escapeHtml(s.strategy)}</td>
          <td>${s.uses}</td>
          <td>${s.wins}</td>
          <td>${s.win_rate.toFixed(1)}%</td>
        </tr>
      `;
    }

    html += `
        </tbody>
      </table>
      <p style="font-size:0.85rem;margin-top:0.5rem;">
        human_wins: ${totals.human_wins || 0},
        gemini_wins: ${totals.gemini_wins || 0},
        qwen_wins: ${totals.qwen_wins || 0}
      </p>
    `;

    adminArea.innerHTML = html;
  } catch (err) {
    console.error(err);
    adminArea.innerHTML = "<p>Network error loading admin stats.</p>";
  }
}

// Utility
function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Default view
showView("submit");
loadRandomQuestion();
