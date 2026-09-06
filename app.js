const state = {
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

function renderLesson() {
  lessonMeta.textContent = `${state.lesson.subject} / ${state.lesson.grade}`;
  lessonTitle.textContent = state.lesson.title;

  wordList.innerHTML = "";
  state.lesson.words.forEach((word, index) => {
    const button = document.createElement("button");
    button.className = "word-button";
    button.type = "button";
    button.innerHTML = `<strong>${word}</strong><span>${index + 1}</span>`;
    button.addEventListener("click", () => speak(word));
    wordList.append(button);
  });

  bookImages.innerHTML = "";
  state.lesson.images.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = encodeURI(src);
    img.alt = `${state.lesson.title} 課本圖片 ${index + 1}`;
    bookImages.append(img);
  });
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
  state.lesson = window.LESSONS.find((lesson) => lesson.id === id) || window.LESSONS[0];
  renderLesson();
  startBtn.textContent = "開始測驗";
  nextBtn.disabled = true;
  questionWord.textContent = "按「開始測驗」";
  choices.innerHTML = "";
  feedback.textContent = "";
  progressText.textContent = "";
  correctCount.textContent = "0";
  totalCount.textContent = String(state.lesson.words.length);
}

window.LESSONS.forEach((lesson) => {
  const option = document.createElement("option");
  option.value = lesson.id;
  option.textContent = lesson.title;
  lessonSelect.append(option);
});

lessonSelect.addEventListener("change", () => selectLesson(lessonSelect.value));
speakAllBtn.addEventListener("click", () => speak(state.lesson.words.join("，")));
speakCurrentBtn.addEventListener("click", () => {
  const currentWord = state.queue[state.index];
  if (currentWord) speak(currentWord);
});
orderModeBtn.addEventListener("click", () => setMode("order"));
randomModeBtn.addEventListener("click", () => setMode("random"));
startBtn.addEventListener("click", startQuiz);
nextBtn.addEventListener("click", nextQuestion);

selectLesson(window.LESSONS[0].id);
