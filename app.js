import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const STORAGE_KEY = "chinese-word-quiz-lessons-v3";
const LEGACY_STORAGE_KEYS = ["chinese-word-quiz-lessons-v2", "chinese-word-quiz-lessons-v1"];
const DB_NAME = "chinese-word-quiz-db";
const DB_VERSION = 1;
const LESSON_STORE = "lessons";
const firebaseConfig = {
  apiKey: "AIzaSyAztDiOzjisW2fwcDxsoGEyYIBY-Krl2aw",
  authDomain: "elementary-study-quiz.firebaseapp.com",
  projectId: "elementary-study-quiz",
  storageBucket: "elementary-study-quiz.firebasestorage.app",
  messagingSenderId: "239157703959",
  appId: "1:239157703959:web:4478067964d3c000db3352",
  measurementId: "G-V7F92M9XN7"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const provider = new GoogleAuthProvider();
const firestore = getFirestore(firebaseApp);

const state = {
  lessons: [],
  lesson: null,
  mode: "order",
  queue: [],
  index: 0,
  correct: 0,
  answered: false,
  dictationTimer: null,
  dictationRunning: false,
  dictationWords: [],
  dictationIndex: 0,
  dictationPlayMode: "manual",
  dictationCurrentItem: null,
  dictationActiveIndex: -1,
  dictationPlayedIndexes: new Set(),
  recognizing: false,
  user: null,
  syncTimer: null,
  loadingCloud: false
};

const authStatus = document.querySelector("#authStatus");
const syncStatus = document.querySelector("#syncStatus");
const signInBtn = document.querySelector("#signInBtn");
const signOutBtn = document.querySelector("#signOutBtn");
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
const recognizeCurrentBtn = document.querySelector("#recognizeCurrentBtn");
const ocrText = document.querySelector("#ocrText");
const currentLessonForm = document.querySelector("#currentLessonForm");
const lessonTitleInput = document.querySelector("#lessonTitleInput");
const lessonGradeInput = document.querySelector("#lessonGradeInput");
const lessonImagesInput = document.querySelector("#lessonImagesInput");
const deleteLessonBtn = document.querySelector("#deleteLessonBtn");
const lessonForm = document.querySelector("#lessonForm");
const newLessonTitleInput = document.querySelector("#newLessonTitleInput");
const newLessonGradeInput = document.querySelector("#newLessonGradeInput");
const newLessonImagesInput = document.querySelector("#newLessonImagesInput");
const createLessonOcrBtn = document.querySelector("#createLessonOcrBtn");
const lessonStatus = document.querySelector("#lessonStatus");
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
const dictationSequenceSelect = document.querySelector("#dictationSequenceSelect");
const dictationPlayModeSelect = document.querySelector("#dictationPlayModeSelect");
const dictationDelayInput = document.querySelector("#dictationDelayInput");
const startDictationBtn = document.querySelector("#startDictationBtn");
const repeatDictationBtn = document.querySelector("#repeatDictationBtn");
const nextDictationBtn = document.querySelector("#nextDictationBtn");
const stopDictationBtn = document.querySelector("#stopDictationBtn");
const dictationStatus = document.querySelector("#dictationStatus");

function cloneLesson(lesson) {
  return {
    id: lesson.id,
    subject: lesson.subject || "國文",
    grade: lesson.grade || "2年級",
    title: lesson.title,
    images: Array.isArray(lesson.images) ? [...lesson.images] : [],
    words: Array.isArray(lesson.words) ? [...lesson.words] : [],
    custom: Boolean(lesson.custom)
  };
}

function cloneLessons(lessons) {
  return lessons.map(cloneLesson);
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

function openLessonDatabase() {
  if (!("indexedDB" in window)) return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LESSON_STORE)) {
        db.createObjectStore(LESSON_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readDatabaseLessons() {
  const db = await openLessonDatabase();
  if (!db) return [];

  return new Promise((resolve) => {
    const transaction = db.transaction(LESSON_STORE, "readonly");
    const request = transaction.objectStore(LESSON_STORE).getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => resolve([]);
  });
}

async function writeDatabaseLessons(lessons) {
  const savedLessons = lessons.map(cloneLesson);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLessons));
  } catch {
    lessonStatus.textContent = "資料已暫存在這次畫面，但瀏覽器備份空間不足。";
  }

  const db = await openLessonDatabase();
  if (!db) return;

  await new Promise((resolve) => {
    const transaction = db.transaction(LESSON_STORE, "readwrite");
    const store = transaction.objectStore(LESSON_STORE);
    store.clear();
    savedLessons.forEach((lesson) => store.put(lesson));
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
  });
}

function normalizeWords(words, baseWords = []) {
  const normalized = [];
  words.forEach((word) => {
    const fixed = String(word || "").trim() === "新學年" ? "學年" : String(word || "").trim();
    if (fixed && !normalized.includes(fixed)) normalized.push(fixed);
  });

  baseWords.forEach((word) => {
    if (word && !normalized.includes(word)) normalized.push(word);
  });

  return normalized;
}

function pickSavedLesson(lesson, savedSources) {
  const candidates = savedSources
    .map((source) => source.find((item) => item.id === lesson.id))
    .filter((item) => item && Array.isArray(item.words));

  if (candidates.length === 0) return lesson;

  const best = candidates.reduce((currentBest, candidate) => {
    if (!currentBest) return candidate;
    return candidate.words.length > currentBest.words.length ? candidate : currentBest;
  }, null);

  return {
    ...lesson,
    title: best.title || lesson.title,
    grade: best.grade || lesson.grade,
    subject: best.subject || lesson.subject,
    images: Array.isArray(best.images) && best.images.length ? [...best.images] : lesson.images,
    words: normalizeWords(best.words, lesson.words),
    custom: Boolean(best.custom || lesson.custom)
  };
}

function normalizeSavedCustomLesson(rawLesson) {
  const lesson = cloneLesson(rawLesson);
  if (!lesson.id || !lesson.title) return null;
  lesson.words = normalizeWords(lesson.words);
  lesson.custom = true;
  return lesson;
}

function mergeLessonSources(savedSources) {
  const baseLessons = cloneLessons(window.LESSONS);
  const baseIds = new Set(baseLessons.map((lesson) => lesson.id));
  const mergedLessons = baseLessons.map((lesson) => pickSavedLesson(lesson, savedSources));

  savedSources.forEach((source) => {
    source.forEach((rawLesson) => {
      if (!rawLesson || baseIds.has(rawLesson.id) || mergedLessons.some((lesson) => lesson.id === rawLesson.id)) return;
      const customLesson = normalizeSavedCustomLesson(rawLesson);
      if (customLesson) mergedLessons.push(customLesson);
    });
  });

  return mergedLessons;
}

async function loadLessons() {
  const dbLessons = await readDatabaseLessons();
  const savedSources = [dbLessons, ...[STORAGE_KEY, ...LEGACY_STORAGE_KEYS].map(readSavedLessons)].filter((source) => source.length);
  return mergeLessonSources(savedSources);
}

function saveLessons() {
  writeDatabaseLessons(state.lessons);
  scheduleCloudSave();
}
function getCloudLessonsRef() {
  if (!state.user) return null;
  return doc(firestore, "users", state.user.uid, "study", "lessons");
}

function setSyncStatus(message, tone = "") {
  syncStatus.textContent = message;
  syncStatus.className = tone;
}

function renderAuthState() {
  const signedIn = Boolean(state.user);
  authStatus.textContent = signedIn ? state.user.email : "尚未登入";
  signInBtn.hidden = signedIn;
  signOutBtn.hidden = !signedIn;
  setSyncStatus(signedIn ? "雲端同步已啟用" : "本機資料", signedIn ? "good" : "");
}

async function readCloudLessons() {
  const ref = getCloudLessonsRef();
  if (!ref) return [];
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return [];
  const data = snapshot.data();
  return Array.isArray(data.lessons) ? data.lessons : [];
}

async function writeCloudLessons(force = false) {
  if (!state.user || (state.loadingCloud && !force)) return;
  const ref = getCloudLessonsRef();
  if (!ref) return;

  try {
    setSyncStatus("同步中...");
    await setDoc(ref, {
      lessons: state.lessons.map(cloneLesson),
      schemaVersion: 1,
      updatedAt: serverTimestamp()
    });
    setSyncStatus("已同步到雲端", "good");
  } catch (error) {
    setSyncStatus("雲端同步失敗，已保留本機備份", "bad");
    console.error(error);
  }
}

function scheduleCloudSave() {
  if (!state.user || state.loadingCloud) return;
  if (state.syncTimer) window.clearTimeout(state.syncTimer);
  setSyncStatus("等待同步...");
  state.syncTimer = window.setTimeout(() => writeCloudLessons(), 500);
}

function renderLoadedLessons(preferredLessonId) {
  renderLessonOptions();
  const nextLesson = state.lessons.find((lesson) => lesson.id === preferredLessonId) || state.lessons[0];
  if (nextLesson) selectLesson(nextLesson.id);
}

async function syncFromCloud() {
  if (!state.user) return;
  const preferredLessonId = state.lesson ? state.lesson.id : "";
  state.loadingCloud = true;
  setSyncStatus("讀取雲端資料...");

  try {
    const cloudLessons = await readCloudLessons();
    const localLessons = state.lessons.length ? cloneLessons(state.lessons) : await loadLessons();
    state.lessons = cloudLessons.length ? mergeLessonSources([cloudLessons, localLessons]) : localLessons;
    await writeDatabaseLessons(state.lessons);
    renderLoadedLessons(preferredLessonId);
    state.loadingCloud = false;
    if (cloudLessons.length) {
      setSyncStatus("已載入雲端資料", "good");
    } else {
      await writeCloudLessons(true);
    }
  } catch (error) {
    state.loadingCloud = false;
    setSyncStatus("雲端讀取失敗，先使用本機資料", "bad");
    console.error(error);
  }
}

async function signInWithGoogle() {
  try {
    signInBtn.disabled = true;
    setSyncStatus("登入中...");
    await signInWithPopup(auth, provider);
  } catch (error) {
    setSyncStatus("登入失敗，請確認 Firebase 已啟用 Google 登入", "bad");
    console.error(error);
  } finally {
    signInBtn.disabled = false;
  }
}

async function signOutCloud() {
  await signOut(auth);
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

function setDictationButtons() {
  const canAdvance = state.dictationRunning && state.dictationCurrentItem && state.dictationIndex < state.dictationWords.length;
  repeatDictationBtn.disabled = !state.dictationRunning || !state.dictationCurrentItem;
  nextDictationBtn.disabled = !canAdvance;
}

function getDictationDelayMs() {
  const seconds = Number(dictationDelayInput.value);
  const safeSeconds = Number.isFinite(seconds) ? Math.min(Math.max(seconds, 1), 30) : 3;
  dictationDelayInput.value = String(safeSeconds);
  return safeSeconds * 1000;
}

function applyDictationHighlight(element, index) {
  element.classList.toggle("is-reading", state.dictationActiveIndex === index);
  element.classList.toggle("is-played", state.dictationPlayedIndexes.has(index) && state.dictationActiveIndex !== index);
}

function updateDictationHighlights() {
  document.querySelectorAll("[data-word-index]").forEach((element) => {
    applyDictationHighlight(element, Number(element.dataset.wordIndex));
  });
}

function resetDictationHighlights() {
  state.dictationCurrentItem = null;
  state.dictationCurrentWord = "";
  state.dictationActiveIndex = -1;
  state.dictationPlayedIndexes.clear();
  updateDictationHighlights();
}

function markDictationSpoken(item) {
  if (!item) return;
  state.dictationPlayedIndexes.add(item.index);
  state.dictationActiveIndex = -1;
  updateDictationHighlights();
}

function markCurrentDictationAsPlayed() {
  if (!state.dictationCurrentItem) return;
  markDictationSpoken(state.dictationCurrentItem);
}

function repeatCurrentDictationWord() {
  if (!state.dictationRunning || !state.dictationCurrentItem) return;
  window.speechSynthesis.cancel();
  if (state.dictationTimer) window.clearTimeout(state.dictationTimer);
  state.dictationTimer = null;
  state.dictationPlayMode = "manual";
  dictationPlayModeSelect.value = "manual";
  state.dictationActiveIndex = state.dictationCurrentItem.index;
  updateDictationHighlights();
  dictationStatus.textContent = `正在重唸：${state.dictationCurrentItem.word}`;
  setDictationButtons();

  speakForDictation(state.dictationCurrentItem.word, () => {
    if (!state.dictationRunning || !state.dictationCurrentItem) return;
    markDictationSpoken(state.dictationCurrentItem);
    if (state.dictationIndex >= state.dictationWords.length) {
      finishDictation();
      return;
    }
    dictationStatus.textContent = "已重唸目前圈詞。按「下一個」才會繼續。";
    setDictationButtons();
  });
}

function finishDictation() {
  state.dictationRunning = false;
  state.dictationTimer = null;
  dictationStatus.textContent = `聽寫完成，共 ${state.dictationWords.length} 個生詞。`;
  resetDictationHighlights();
  setDictationButtons();
}

function stopDictation() {
  state.dictationRunning = false;
  if (state.dictationTimer) window.clearTimeout(state.dictationTimer);
  state.dictationTimer = null;
  window.speechSynthesis.cancel();
  dictationStatus.textContent = "已停止";
  resetDictationHighlights();
  setDictationButtons();
}

function speakCurrentDictationWord() {
  if (!state.dictationRunning) return;
  markCurrentDictationAsPlayed();
  if (state.dictationIndex >= state.dictationWords.length) {
    finishDictation();
    return;
  }

  window.speechSynthesis.cancel();
  if (state.dictationTimer) window.clearTimeout(state.dictationTimer);
  state.dictationTimer = null;

  const displayIndex = state.dictationIndex + 1;
  const item = state.dictationWords[state.dictationIndex];
  state.dictationCurrentItem = item;
  state.dictationCurrentWord = item.word;
  state.dictationActiveIndex = item.index;
  state.dictationIndex += 1;
  updateDictationHighlights();
  dictationStatus.textContent = `正在唸第 ${displayIndex} / ${state.dictationWords.length} 個：${item.word}`;
  setDictationButtons();

  speakForDictation(item.word, () => {
    if (!state.dictationRunning) return;
    markDictationSpoken(item);
    if (state.dictationPlayMode === "auto") {
      state.dictationTimer = window.setTimeout(speakCurrentDictationWord, getDictationDelayMs());
      return;
    }

    if (state.dictationIndex >= state.dictationWords.length) {
      finishDictation();
    } else {
      dictationStatus.textContent = `已唸完第 ${displayIndex} 個。可按「重唸目前」，或按「下一個」繼續。`;
      setDictationButtons();
    }
  });
}

function startDictation() {
  if (state.lesson.words.length === 0) {
    dictationStatus.textContent = "請先新增生詞。";
    return;
  }

  const sequence = dictationSequenceSelect.value;
  state.dictationPlayMode = dictationPlayModeSelect.value;
  state.dictationWords = state.lesson.words.map((word, index) => ({ word, index }));
  if (sequence === "random") state.dictationWords = shuffle(state.dictationWords);
  state.dictationIndex = 0;
  state.dictationRunning = true;
  resetDictationHighlights();
  state.dictationRunning = true;
  setDictationButtons();
  speakCurrentDictationWord();
}
function nextDictationWord() {
  if (!state.dictationRunning) return;
  state.dictationPlayMode = "manual";
  dictationPlayModeSelect.value = "manual";
  speakCurrentDictationWord();
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

function renderLessonOptions() {
  const selectedId = state.lesson ? state.lesson.id : "";
  lessonSelect.innerHTML = "";
  state.lessons.forEach((lesson) => {
    const option = document.createElement("option");
    option.value = lesson.id;
    option.textContent = lesson.title;
    lessonSelect.append(option);
  });
  if (selectedId) lessonSelect.value = selectedId;
}

function renderWordList() {
  wordList.innerHTML = "";
  state.lesson.words.forEach((word, index) => {
    const button = document.createElement("button");
    button.className = "word-button";
    button.type = "button";
    button.dataset.wordIndex = String(index);
    applyDictationHighlight(button, index);
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
    item.dataset.wordIndex = String(index);
    applyDictationHighlight(item, index);
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
    img.src = src.startsWith("data:") ? src : encodeURI(src);
    img.alt = `${state.lesson.title} 課本圖片 ${index + 1}`;
    bookImages.append(img);
  });
}

function renderCurrentLessonForm() {
  if (!state.lesson || !lessonTitleInput || !lessonGradeInput) return;
  lessonTitleInput.value = state.lesson.title || "";
  lessonGradeInput.value = state.lesson.grade || "";
  if (lessonImagesInput) lessonImagesInput.value = "";
  if (deleteLessonBtn) deleteLessonBtn.disabled = state.lessons.length <= 1;
}

async function saveCurrentLesson(event) {
  event.preventDefault();
  const title = lessonTitleInput.value.trim();
  const grade = lessonGradeInput.value.trim() || "2年級";
  if (!title) {
    lessonStatus.textContent = "請輸入課別名稱。";
    return;
  }

  state.lesson.title = title;
  state.lesson.grade = grade;
  const files = lessonImagesInput ? [...lessonImagesInput.files] : [];
  if (files.length) state.lesson.images = await Promise.all(files.map(fileToDataUrl));

  saveLessons();
  renderLessonOptions();
  lessonSelect.value = state.lesson.id;
  renderLesson();
  resetQuizView();
  lessonStatus.textContent = "已儲存目前課別，新增、刪除、修改都已生效。";
}

function deleteCurrentLesson() {
  if (state.lessons.length <= 1) {
    lessonStatus.textContent = "至少要保留一課。";
    return;
  }

  const deletedIndex = state.lessons.findIndex((lesson) => lesson.id === state.lesson.id);
  state.lessons.splice(deletedIndex, 1);
  saveLessons();
  renderLessonOptions();
  const nextLesson = state.lessons[Math.max(0, deletedIndex - 1)] || state.lessons[0];
  selectLesson(nextLesson.id);
  lessonStatus.textContent = "已刪除課別。";
}
function renderLesson() {
  lessonMeta.textContent = `${state.lesson.subject} / ${state.lesson.grade}`;
  lessonTitle.textContent = state.lesson.title;
  renderWordList();
  renderDictationList();
  renderManageList();
  renderImages();
  renderCurrentLessonForm();
}

function refreshAfterWordsChanged() {
  stopDictation();
  saveLessons();
  renderWordList();
  renderDictationList();
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
    if (!state.lesson.words.includes(word)) state.lesson.words.push(word);
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractCandidateWords(text) {
  const matches = text.match(/[\u3400-\u9fff]{2,6}/g) || [];
  return normalizeWords(matches.filter((word) => word.length >= 2));
}

function appendWords(words) {
  const beforeCount = state.lesson.words.length;
  words.forEach((word) => {
    if (!state.lesson.words.includes(word)) state.lesson.words.push(word);
  });
  refreshAfterWordsChanged();
  return state.lesson.words.length - beforeCount;
}

async function recognizeImagesForLesson(lesson) {
  if (state.recognizing) return;
  if (!window.Tesseract) {
    lessonStatus.textContent = "OCR 載入失敗，請確認網路可連到 CDN 後重新整理。";
    return;
  }
  if (!lesson.images.length) {
    lessonStatus.textContent = "這一課沒有圖片可辨識。";
    return;
  }

  state.recognizing = true;
  recognizeCurrentBtn.disabled = true;
  createLessonOcrBtn.disabled = true;
  lessonStatus.textContent = "正在辨識圖片文字，第一次會比較久。";
  ocrText.value = "";

  const chunks = [];
  try {
    for (let index = 0; index < lesson.images.length; index += 1) {
      lessonStatus.textContent = `正在辨識第 ${index + 1} / ${lesson.images.length} 張圖片...`;
      const result = await window.Tesseract.recognize(lesson.images[index], "chi_tra+eng");
      chunks.push(result.data.text || "");
    }

    const text = chunks.join("\n").trim();
    const candidates = extractCandidateWords(text);
    ocrText.value = text || "沒有辨識到文字。";
    const added = appendWords(candidates);
    lessonStatus.textContent = `辨識完成，已加入 ${added} 個候選詞；請在「管理圈詞」刪除、修改、排序。`;
  } catch {
    lessonStatus.textContent = "辨識失敗，請換清楚一點的圖片或稍後再試。";
  } finally {
    state.recognizing = false;
    recognizeCurrentBtn.disabled = false;
    createLessonOcrBtn.disabled = false;
  }
}

async function createLesson(shouldRecognize) {
  const title = newLessonTitleInput.value.trim();
  const grade = newLessonGradeInput.value.trim() || "2年級";
  const files = [...newLessonImagesInput.files];
  if (!title || files.length === 0) {
    lessonStatus.textContent = "請輸入課別名稱並選擇圖片。";
    return;
  }

  lessonStatus.textContent = "正在讀取圖片...";
  const images = await Promise.all(files.map(fileToDataUrl));
  const lesson = {
    id: `custom-${Date.now()}`,
    subject: "國文",
    grade,
    title,
    images,
    words: [],
    custom: true
  };

  state.lessons.push(lesson);
  state.lesson = lesson;
  renderLessonOptions();
  lessonSelect.value = lesson.id;
  renderLesson();
  resetQuizView();
  saveLessons();
  lessonForm.reset();
  newLessonGradeInput.value = grade;
  lessonStatus.textContent = "已新增課別，可以手動新增圈詞。";

  if (shouldRecognize) await recognizeImagesForLesson(lesson);
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
  if (state.lesson) stopDictation();
  state.lesson = state.lessons.find((lesson) => lesson.id === id) || state.lessons[0];
  lessonSelect.value = state.lesson.id;
  ocrText.value = "";
  lessonStatus.textContent = "";
  renderLesson();
  cancelEdit();
  resetQuizView();
}

signInBtn.addEventListener("click", signInWithGoogle);
signOutBtn.addEventListener("click", signOutCloud);
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  renderAuthState();
  if (user) await syncFromCloud();
});

lessonSelect.addEventListener("change", () => selectLesson(lessonSelect.value));
currentLessonForm.addEventListener("submit", saveCurrentLesson);
deleteLessonBtn.addEventListener("click", deleteCurrentLesson);
wordForm.addEventListener("submit", saveWord);
cancelEditBtn.addEventListener("click", cancelEdit);
resetWordsBtn.addEventListener("click", resetWords);
recognizeCurrentBtn.addEventListener("click", () => recognizeImagesForLesson(state.lesson));
lessonForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createLesson(false);
});
createLessonOcrBtn.addEventListener("click", () => createLesson(true));
startDictationBtn.addEventListener("click", startDictation);
repeatDictationBtn.addEventListener("click", repeatCurrentDictationWord);
nextDictationBtn.addEventListener("click", nextDictationWord);
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

async function init() {
  renderAuthState();
  state.lessons = await loadLessons();
  saveLessons();
  renderLoadedLessons(state.lessons[0] ? state.lessons[0].id : "");
}

init();



