// Logika quiz "tunjuk struktur". State di memori saja.
(() => {
  const $ = (id) => document.getElementById(id);
  const el = {
    region: $("region-select"),
    viewer: $("viewer"),
    layers: $("layers"),
    status: $("status"),
    question: $("question"),
    index: $("q-index"),
    score: $("score"),
    prompt: $("prompt"),
    feedback: $("feedback"),
    explain: $("explain"),
    next: $("next-btn"),
    summary: $("summary"),
    summaryScore: $("summary-score"),
    summaryList: $("summary-list"),
    restart: $("restart-btn")
  };

  let bank = [];
  let state = null;   // { regionKey, questions, idx, score, wrong: [], solved, busy }
  let wrongTimer = null;

  // --- UI statis ---

  for (const [key, region] of Object.entries(REGIONS)) {
    el.region.add(new Option(region.label, key));
  }
  el.region.value = DEFAULT_REGION;

  const layerBoxes = Object.entries(LAYERS).map(([prefix, label]) => {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = prefix;
    box.checked = true;
    const lab = document.createElement("label");
    lab.append(box, " ", label);
    el.layers.appendChild(lab);
    box.addEventListener("change", applyLayers);
    return box;
  });

  const checkedLayers = () => layerBoxes.filter((b) => b.checked).map((b) => b.value);

  // Panggung soal: daftar `visible` (prefix dan/atau nama object). Tanpa `visible` = semua layer.
  const stageOf = (q) => (q && q.visible && q.visible.length ? q.visible : Object.keys(LAYERS));

  function setLayers(stage) {
    for (const box of layerBoxes) box.checked = stage.some((e) => e.startsWith(box.value));
  }

  // Panggung soal aktif disaring layer yang dicentang. Layer tercentang yang tidak punya
  // entri di panggung ditampilkan utuh lewat prefix-nya.
  function applyLayers() {
    const stage = stageOf(state && state.questions[state.idx]);
    const shown = checkedLayers().flatMap((p) => {
      const own = stage.filter((e) => e.startsWith(p));
      return own.length ? own : [p];
    });
    return Viewer.showOnly(shown);
  }

  function setStatus(text, isError = false) {
    el.status.textContent = text;
    el.status.classList.toggle("error", isError);
    el.status.hidden = !text;
  }

  // --- Alur quiz ---

  async function startRegion(regionKey, load = () => Viewer.loadRegion(regionKey)) {
    clearTimeout(wrongTimer);
    state = null;
    el.question.hidden = true;
    el.summary.hidden = true;
    setStatus("Memuat model...");
    el.region.disabled = true;
    try {
      await load();
    } catch (err) {
      setStatus(`Gagal memuat model: ${err.message}`, true);
      el.region.disabled = false;
      return;
    }
    el.region.disabled = false;
    if (el.region.value !== regionKey) return; // region diganti saat loading

    const questions = bank.filter((q) => q.region === regionKey);
    for (const q of questions) {
      const names = [...q.answer, ...(q.visible || []).filter((e) => !e.endsWith("_"))];
      for (const name of names) {
        if (!Viewer.hasNode(name)) console.warn(`[quiz] ${q.id}: node "${name}" tidak ada di model`);
      }
    }
    if (!questions.length) {
      setStatus("Belum ada soal untuk region ini.");
      return;
    }
    state = { regionKey, questions, idx: 0, score: 0, wrong: questions.map(() => 0), solved: false, busy: false };
    setStatus("");
    showQuestion();
  }

  async function showQuestion() {
    const q = state.questions[state.idx];
    state.solved = false;
    clearTimeout(wrongTimer);
    await Viewer.clearHighlight();

    setLayers(stageOf(q));
    await applyLayers();

    el.index.textContent = `Soal ${state.idx + 1}/${state.questions.length}`;
    el.score.textContent = state.score;
    el.prompt.textContent = q.prompt;
    el.feedback.textContent = "Klik struktur pada model.";
    el.feedback.className = "feedback";
    el.explain.hidden = true;
    el.next.hidden = true;
    el.summary.hidden = true;
    el.question.hidden = false;
  }

  async function handleClick(nodeName) {
    if (!state || state.solved || state.busy) return;
    const q = state.questions[state.idx];
    state.busy = true;
    clearTimeout(wrongTimer);
    await Viewer.clearHighlight();

    // Benar kalau node yang diklik cocok dengan salah satu anggota answer
    // (mis. caput longum atau caput breve untuk m. biceps brachii).
    if (q.answer.some((name) => Viewer.matches(nodeName, name))) {
      state.solved = true;
      if (state.wrong[state.idx] === 0) state.score++;
      await Promise.all(q.answer.map((name) => Viewer.highlight(name, HIGHLIGHT.correct)));
      el.score.textContent = state.score;
      el.feedback.textContent = "Benar.";
      el.feedback.className = "feedback correct";
      el.explain.textContent = q.explain || "";
      el.explain.hidden = !q.explain;
      el.next.hidden = false;
      el.next.textContent = state.idx + 1 < state.questions.length ? "Lanjut" : "Lihat hasil";
      el.next.focus();
    } else {
      state.wrong[state.idx]++;
      await Viewer.highlight(nodeName, HIGHLIGHT.wrong);
      el.feedback.textContent = "Salah, coba lagi.";
      el.feedback.className = "feedback wrong";
      wrongTimer = setTimeout(() => {
        if (state && !state.solved) Viewer.clearHighlight();
      }, HIGHLIGHT.wrongMs);
    }
    state.busy = false;
  }

  async function next() {
    state.idx++;
    if (state.idx < state.questions.length) {
      showQuestion();
      return;
    }
    await Viewer.clearHighlight();
    el.question.hidden = true;
    el.summaryScore.textContent =
      `Benar di percobaan pertama: ${state.score}/${state.questions.length}`;
    el.summaryList.replaceChildren(
      ...state.questions.map((q, i) => {
        const li = document.createElement("li");
        li.textContent = `${q.prompt} — ${state.wrong[i] ? `${state.wrong[i]}x salah` : "langsung benar"}`;
        return li;
      })
    );
    el.summary.hidden = false;
  }

  function restart() {
    state.idx = 0;
    state.score = 0;
    state.wrong = state.questions.map(() => 0);
    showQuestion();
  }

  // --- Wiring ---

  Viewer.onNodeClick(handleClick);
  el.next.addEventListener("click", next);
  el.restart.addEventListener("click", restart);
  el.region.addEventListener("change", () => startRegion(el.region.value));

  // Region pertama lewat Viewer.init (set container); berikutnya lewat Viewer.loadRegion.
  const first = REGIONS[DEFAULT_REGION];

  fetch("questions.json")
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data) => {
      bank = data;
      return startRegion(DEFAULT_REGION, () =>
        Viewer.init(el.viewer, first.modelUid)
      );
    })
    .catch((err) => setStatus(`Gagal memuat soal: ${err.message}`, true));
})();
