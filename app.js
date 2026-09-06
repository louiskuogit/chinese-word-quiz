const STORAGE_KEY = "chinese-word-quiz-lessons-v2";
const LEGACY_STORAGE_KEYS = ["chinese-word-quiz-lessons-v1"];

const state = {
  lessons: [],
  lesson: null,
  mode: "order",
  queue: [],
  index: 0,
  correct: 0,
  answered: false
};

const lessonSelect = document.querySelector("#lessonSelect");
const lessonMeta = document.querySelector("#lessonMeta");
const lessonTitle = document.querySelector("#lessonTitle");
const wordList = document.querySelector("#wordList");
const manageList = document.querySelector("#manageList");
const wordForm = document.querySelector("#wordForm");
const wordInput = document.querySelector("#wordInput");
const editIndexInput = document.querySelector("#editIndexInput");
const saveWordBtn = document.querySelector("#saveWordBtn");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const resetWordsBtn = document.querySelector("#resetWordsBtn");
const bookImages = document.querySelector("#bookImages");
const speakAllBtn = document.querySelector("#speakAllBtn");
const speakCurrentBtn = document.querySelector("#speakCurrentBtn");
const orderModeBtn = document.querySelector("#orderModeBtn");
const randomModeBtn = document.querySelector("#randomModeBtn");
const startBtn = document.querySelector("#startBtn");
const nextBtn = document.querySelector("#nextBtn");
const progressText = document.querySelector("#progressText");
const questionWord = document.querySelector("#questionWord");
const choices = document.querySelector("#choices");
const feedback = document.querySelector("#feedback");
const correctCount = document.querySelector("#correctCount");
const totalCount = document.querySelector("#totalCount");
const dictationList = document.querySelector("#dictationList");
const dictationOrderBtn = document.querySelector("#dictationOrderBtn");
const dictationRandomBtn = document.querySelector("#dictationRandomBtn");
const stopDictationBtn = document.querySelector("#stopDictationBtn");
const dictationStatus = document.querySelector("#dictationStatus");

function cloneLessons(lessons) {
  return lessons.map((lesson) => ({
    ...lesson,
    images: [...lesson.images],
    words: [...lesson.words]
  }));
}

function readSavedLessons(key) {
  const stored = window.localStorage.getItem(key);
  if (!stored) return [];

  try {
    const savedLessons = JSON.parse(stored);
    return Array.isArray(savedLessons) ? savedLessons : [];
  } catch {
    return [];
  }
}

function normalizeWords(words, baseWords) {
  const normalized = [];
  words.forEach((word) => {
    const fixed = word === "新學年" ? "學年" : word;
    if (fixed && !normalized.includes(fixed)) normalized.push(fixed);
  });

  baseWords.forEach((word) => {
    if (!normalized.includes(word)) normalized.push(word);
  });

  return normalized;
}

function pickSavedWords(lesson, savedSources) {
  const candidates = savedSources
    .map((source) => source.find((item) => item.id === lesson.id))
    .filter((item) => item && Array.isArray(item.words));

  if (candidates.length === 0) return lesson.words;

  const best = candidates.reduce((currentBest, candidate) => {
    if (!currentBest) return candidate;
    return candidate.words.length > currentBest.words.length ? candidate : currentBest;
  }, null);

  return normalizeWords(best.words, lesson.words);
}

function loadLessons() {
  const baseLessons = cloneLessons(window.LESSONS);
  const savedSources = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].map(readSavedLessons);

  return baseLessons.map((lesson) => ({
    ...lesson,
    words: pickSavedWords(lesson, savedSources)
  }));
}

function saveLessons() {
  const savedLessons = state.lessons.map((lesson) => ({
    id: lesson.id,
    words: lesson.words
  }));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLessons));
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    feedback.textContent = "這個瀏覽器不支援語音朗讀。";
    feedback.className = "feedback bad";
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = 0.78;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}
function speakForDictation(text, onEnd) {
  if (!("speechSynthesis" in window)) {
    dictationStatus.textContent = "這個瀏覽器不支援語音朗讀。";
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = 0.72;
  utterance.pitch = 1;
  utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

function stopDictation() {
  state.dictationRunning = false;
  if (state.dictationTimer) window.clearTimeout(state.dictationTimer);
  state.dictationTimer = null;
  window.speechSynthesis.cancel();
  dictationStatus.textContent = "已停止";
}

function startDictation(mode) {
  if (state.lesson.words.length === 0) {
    dictationStatus.textContent = "請先新增生詞。";
    return;
  }

  window.speechSynthesis.cancel();
  if (state.dictationTimer) window.clearTimeout(state.dictationTimer);

  const words = mode === "random" ? shuffle(state.lesson.words) : [...state.lesson.words];
  state.dictationRunning = true;
  let currentIndex = 0;

  function speakNext() {
    if (!state.dictationRunning) return;
    if (currentIndex >= words.length) {
      state.dictationRunning = false;
      state.dictationTimer = null;
      dictationStatus.textContent = `聽寫完成，共 ${words.length} 個生詞。`;
      return;
    }

    const word = words[currentIndex];
    dictationStatus.textContent = `正在唸第 ${currentIndex + 1} / ${words.length} 個`;
    currentIndex += 1;
    speakForDictation(word, () => {
      state.dictationTimer = window.setTimeout(speakNext, 2200);
    });
  }

  speakNext();
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sampleChoices(answer) {
  const otherWords = shuffle(state.lesson.words.filter((word) => word !== answer));
  return shuffle([answer, ...otherWords.slice(0, 3)]);
}

function setMode(mode) {
  state.mode = mode;
  orderModeBtn.classList.toggle("active", mode === "order");
  randomModeBtn.classList.toggle("active", mode === "random");
}

function resetQuizView() {
  startBtn.textContent = "開始測驗";
  nextBtn.disabled = true;
  questionWord.textContent = "按「開始測驗」";
  choices.innerHTML = "";
  feedback.textContent = "";
  feedback.className = "feedback";
  progressText.textContent = "";
  correctCount.textContent = "0";
  totalCount.textContent = String(state.lesson.words.length);
  state.queue = [];
  state.index = 0;
  state.correct = 0;
  state.answered = false;
}

function renderWordList() {
  wordList.innerHTML = "";
  state.lesson.words.forEach((word, index) => {
    const button = document.createElement("button");
    button.className = "word-button";
    button.type = "button";
    button.innerHTML = `<strong>${word}</strong><span>${index + 1}</span>`;
    button.addEventListener("click", () => speak(word));
    wordList.append(button);
  });
}
function renderDictationList() {
  dictationList.innerHTML = "";
  state.lesson.words.forEach((word, index) => {
    const item = document.createElement("button");
    item.className = "dictation-word";
    item.type = "button";
    item.textContent = `${index + 1}. ${word}`;
    item.addEventListener("click", () => speak(word));
    dictationList.append(item);
  });
}

function renderManageList() {
  manageList.innerHTML = "";
  state.lesson.words.forEach((word, index) => {
    const item = document.createElement("div");
    item.className = "manage-item";

    const label = document.createElement("span");
    label.textContent = `${index + 1}. ${word}`;

    const controls = document.createElement("div");
    controls.className = "manage-controls";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.textContent = "上";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => moveWord(index, -1));

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.textContent = "下";
    downBtn.disabled = index === state.lesson.words.length - 1;
    downBtn.addEventListener("click", () => moveWord(index, 1));

    const speakBtn = document.createElement("button");
    speakBtn.type = "button";
    speakBtn.textContent = "唸";
    speakBtn.addEventListener("click", () => speak(word));

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "改";
    editBtn.addEventListener("click", () => startEditWord(index));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "刪";
    deleteBtn.addEventListener("click", () => deleteWord(index));

    controls.append(upBtn, downBtn, speakBtn, editBtn, deleteBtn);
    item.append(label, controls);
    manageList.append(item);
  });
}

function renderImages() {
  bookImages.innerHTML = "";
  state.lesson.images.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = encodeURI(src);
    img.alt = `${state.lesson.title} 課本圖片 ${index + 1}`;
    bookImages.append(img);
  });
}

function renderLesson() {
  lessonMeta.textContent = `${state.lesson.subject} / ${state.lesson.grade}`;
  lessonTitle.textContent = state.lesson.title;
  renderWordList();
  renderManageList();
  renderImages();
}

function refreshAfterWordsChanged() {
  saveLessons();
  renderWordList();
  renderManageList();
  resetQuizView();
}

function startEditWord(index) {
  wordInput.value = state.lesson.words[index];
  editIndexInput.value = String(index);
  saveWordBtn.textContent = "儲存";
  cancelEditBtn.hidden = false;
  wordInput.focus();
}

function cancelEdit() {
  wordForm.reset();
  editIndexInput.value = "";
  saveWordBtn.textContent = "新增";
  cancelEditBtn.hidden = true;
}

function saveWord(event) {
  event.preventDefault();
  const word = wordInput.value.trim();
  if (!word) return;

  const editIndex = editIndexInput.value;
  if (editIndex === "") {
    state.lesson.words.push(word);
  } else {
    state.lesson.words[Number(editIndex)] = word;
  }

  cancelEdit();
  refreshAfterWordsChanged();
}

function deleteWord(index) {
  state.lesson.words.splice(index, 1);
  cancelEdit();
  refreshAfterWordsChanged();
}

function moveWord(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.lesson.words.length) return;

  const [word] = state.lesson.words.splice(index, 1);
  state.lesson.words.splice(targetIndex, 0, word);
  cancelEdit();
  refreshAfterWordsChanged();
}

function resetWords() {
  const original = window.LESSONS.find((lesson) => lesson.id === state.lesson.id);
  if (!original) return;
  state.lesson.words = [...original.words];
  cancelEdit();
  refreshAfterWordsChanged();
}

function renderQuestion() {
  const answer = state.queue[state.index];
  state.answered = false;
  nextBtn.disabled = true;
  feedback.textContent = "";
  feedback.className = "feedback";
  progressText.textContent = `第 ${state.index + 1} / ${state.queue.length} 題`;
  questionWord.textContent = "請聽語音";
  choices.innerHTML = "";

  sampleChoices(answer).forEach((word) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.textContent = word;
    button.addEventListener("click", () => answerQuestion(button, word, answer));
    choices.append(button);
  });

  window.setTimeout(() => speak(answer), 250);
}

function answerQuestion(button, selected, answer) {
  if (state.answered) return;

  state.answered = true;
  const isCorrect = selected === answer;
  if (isCorrect) state.correct += 1;

  [...choices.children].forEach((choice) => {
    choice.disabled = true;
    if (choice.textContent === answer) choice.classList.add("correct");
  });

  if (!isCorrect) button.classList.add("wrong");
  feedback.textContent = isCorrect ? "答對了" : `答案是「${answer}」`;
  feedback.className = `feedback ${isCorrect ? "good" : "bad"}`;
  questionWord.textContent = answer;
  correctCount.textContent = state.correct;
  nextBtn.disabled = false;
}

function startQuiz() {
  if (state.lesson.words.length === 0) {
    feedback.textContent = "請先新增圈詞。";
    feedback.className = "feedback bad";
    return;
  }

  state.queue = state.mode === "random" ? shuffle(state.lesson.words) : [...state.lesson.words];
  state.index = 0;
  state.correct = 0;
  state.answered = false;
  correctCount.textContent = "0";
  totalCount.textContent = String(state.queue.length);
  startBtn.textContent = "重新開始";
  renderQuestion();
}

function nextQuestion() {
  if (state.index + 1 >= state.queue.length) {
    progressText.textContent = "測驗完成";
    questionWord.textContent = `${state.correct} / ${state.queue.length}`;
    choices.innerHTML = "";
    feedback.textContent = "可以重新開始再練一次。";
    feedback.className = "feedback good";
    nextBtn.disabled = true;
    return;
  }

  state.index += 1;
  renderQuestion();
}

function selectLesson(id) {
  state.lesson = state.lessons.find((lesson) => lesson.id === id) || state.lessons[0];
  renderLesson();
  cancelEdit();
  resetQuizView();
}

state.lessons = loadLessons();
saveLessons();
state.lessons.forEach((lesson) => {
  const option = document.createElement("option");
  option.value = lesson.id;
  option.textContent = lesson.title;
  lessonSelect.append(option);
});

lessonSelect.addEventListener("change", () => selectLesson(lessonSelect.value));
wordForm.addEventListener("submit", saveWord);
cancelEditBtn.addEventListener("click", cancelEdit);
resetWordsBtn.addEventListener("click", resetWords);
dictationOrderBtn.addEventListener("click", () => startDictation("order"));
dictationRandomBtn.addEventListener("click", () => startDictation("random"));
stopDictationBtn.addEventListener("click", stopDictation);
speakAllBtn.addEventListener("click", () => speak(state.lesson.words.join("，")));
speakCurrentBtn.addEventListener("click", () => {
  const currentWord = state.queue[state.index];
  if (currentWord) speak(currentWord);
});
orderModeBtn.addEventListener("click", () => setMode("order"));
randomModeBtn.addEventListener("click", () => setMode("random"));
startBtn.addEventListener("click", startQuiz);
nextBtn.addEventListener("click", nextQuestion);

selectLesson(state.lessons[0].id);









