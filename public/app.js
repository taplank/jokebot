// Simple SPA-style view switching
const views = {
  submit: document.getElementById("view-submit"),
  vote: document.getElementById("view-vote"),
  results: document.getElementById("view-results"),
};

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    if (key === name) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}

// Navigation
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

// Submit form
const submitForm = document.getElementById("submit-form");
const submitMessage = document.getElementById("submit-message");

submitForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitMessage.textContent = "Submitting...";
  const prompt = document.getElementById("prompt-input").value.trim();
  const joke = document.getElementById("joke-input").value.trim();

  if (!prompt || !joke) {
    submitMessage.textContent = "Please fill out both fields.";
    return;
  }

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, joke_text: joke }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      submitMessage.textContent =
        "Error submitting joke: " + (err.error || res.statusText);
      return;
    }

    document.getElementById("prompt-input").value = "";
    document.getElementById("joke-input").value = "";
    submitMessage.textContent =
      "Battle created! Head to the Vote tab to see how it does.";
  } catch (err) {
    console.error(err);
    submitMessage.textContent = "Network error submitting joke.";
  }
});

// Voting logic
let currentBattle = null; // { battleId, jokes: [{id,text}, {id,text}] }

const voteArea = document.getElementById("vote-area");
const voteMessage = document.getElementById("vote-message");
const nextBattleBtn = document.getElementById("next-battle-btn");

async function loadRandomBattle() {
  voteMessage.textContent = "";
  nextBattleBtn.classList.add("hidden");
  voteArea.innerHTML = "<p>Loading a battle...</p>";
  currentBattle = null;

  try {
    const res = await fetch("/api/random-battle");
    if (res.status === 404) {
      voteArea.innerHTML =
        "<p>No battles available yet. Submit a joke to create one!</p>";
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      voteArea.innerHTML =
        "<p>Error loading battle: " + (err.error || res.statusText) + "</p>";
      return;
    }

    const data = await res.json();
    currentBattle = data;
    renderBattle(data);
  } catch (err) {
    console.error(err);
    voteArea.innerHTML = "<p>Network error loading battle.</p>";
  }
}

function renderBattle(battle) {
  const [jokeA, jokeB] = battle.jokes;
  voteArea.innerHTML = `
    <div class="joke-card">
      <h3>Joke A</h3>
      <p>${escapeHtml(jokeA.text)}</p>
      <button data-joke-id="${jokeA.id}" class="vote-btn">Joke A is funnier</button>
    </div>
    <div class="joke-card">
      <h3>Joke B</h3>
      <p>${escapeHtml(jokeB.text)}</p>
      <button data-joke-id="${jokeB.id}" class="vote-btn">Joke B is funnier</button>
    </div>
  `;

  document.querySelectorAll(".vote-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const winnerJokeId = btn.getAttribute("data-joke-id");
      submitVote(battle.battleId, winnerJokeId);
    });
  });
}

async function submitVote(battleId, winnerJokeId) {
  if (!battleId || !winnerJokeId) return;
  voteMessage.textContent = "Submitting vote...";

  try {
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ battleId, winnerJokeId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      voteMessage.textContent =
        "Error submitting vote: " + (err.error || res.statusText);
      return;
    }

    voteMessage.textContent = "Thanks for voting!";
    nextBattleBtn.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    voteMessage.textContent = "Network error submitting vote.";
  }
}

nextBattleBtn.addEventListener("click", () => {
  loadRandomBattle();
});

// Results
const resultsArea = document.getElementById("results-area");
document
  .getElementById("refresh-results-btn")
  .addEventListener("click", loadResults);

async function loadResults() {
  resultsArea.innerHTML = "<p>Loading results...</p>";

  try {
    const res = await fetch("/api/results");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      resultsArea.innerHTML =
        "<p>Error loading results: " + (err.error || res.statusText) + "</p>";
      return;
    }

    const data = await res.json();
    renderResults(data);
  } catch (err) {
    console.error(err);
    resultsArea.innerHTML = "<p>Network error loading results.</p>";
  }
}

function renderResults(data) {
  if (data.total_votes === 0) {
    resultsArea.innerHTML = "<p>No votes yet.</p>";
    return;
  }

  const overall = `
    <p>Total votes: <strong>${data.total_votes}</strong></p>
    <p>Human jokes win rate: <strong>${data.human_win_rate.toFixed(1)}%</strong></p>
  `;

  let perPrompt = "";
  if (data.per_prompt && data.per_prompt.length > 0) {
    perPrompt += `
      <h3>By Prompt</h3>
      <table>
        <thead>
          <tr>
            <th>Prompt</th>
            <th>Human win rate</th>
            <th>Votes</th>
          </tr>
        </thead>
        <tbody>
    `;
    data.per_prompt.forEach((row) => {
      perPrompt += `
        <tr>
          <td>${escapeHtml(row.prompt)}</td>
          <td>${row.human_win_rate.toFixed(1)}%</td>
          <td>${row.vote_count}</td>
        </tr>
      `;
    });
    perPrompt += "</tbody></table>";
  }

  resultsArea.innerHTML = overall + perPrompt;
}

// Avoid simple XSS in jokes
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Default view on load
showView("submit");
