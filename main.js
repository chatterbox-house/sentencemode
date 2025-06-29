// SentenceMODE - Multi-language Learning Platform
// main.js - Complete Shared JavaScript Implementation

/* ========================
   APPLICATION STATE & CONFIG
   ======================== */
const state = {
    currentView: 'text-import',
    translatedText: '',
    sentences: [],
    currentSentenceIndex: 0,
    vocabWords: [],
    reviewMode: null,
    reviewWords: [],
    currentReviewIndex: 0,
    reviewStats: { correct: 0, incorrect: 0 },
    theme: localStorage.getItem('theme') || 'dark',
    soundsEnabled: localStorage.getItem('soundsEnabled') !== 'false',
    audioContext: null,
    sounds: {},
    currentHardWord: null,
    currentHardStreak: 0,
    textHistory: [],
    isOnline: navigator.onLine,
    debounceTimer: null,
    uiLanguage: localStorage.getItem('uiLanguage') || 'en',
    newWordsToday: parseInt(localStorage.getItem('newWordsToday')) || 0,
    lastWordAddedDate: localStorage.getItem('lastWordAddedDate') || '',
    currentFont: localStorage.getItem('font') || 'system',
    currentFontSize: parseInt(localStorage.getItem('fontSize')) || 16,
    currentLineHeight: parseFloat(localStorage.getItem('lineHeight')) || 1.6,
    autoTranslate: localStorage.getItem('autoTranslate') === 'true',
    currentLanguage: document.body.getAttribute('data-language') || 'ja',

    readingStats: JSON.parse(localStorage.getItem('readingStats')) || {
        streak: 0,
        lastActiveDate: '',
        wordsLearned: 0,
        timeSpent: 0,
        dailyWords: 0,
        dailyTime: 0,
        dailySentences: 0
    },

    currentSessionStart: null,
    selectedCards: [],
    currentTtsUtterance: null,
    wordLookupCache: {},
    bookmarks: JSON.parse(localStorage.getItem('bookmarks')) || []
};

const languageConfig = {
    ja: {
        ttsLang: 'ja-JP',
        dictionaryAPI: 'https://jisho.org/api/v1/search/words',
        placeholderText: '例: 猫が寝ている。犬が走っている。...',
        importTitle: 'Import Japanese Text',
        translateTo: 'Translate to Japanese',
        resourceLinks: [
            { name: 'NHK Easy News', url: 'https://www3.nhk.or.jp/news/easy/' },
            { name: 'Yahoo Japan News', url: 'https://news.yahoo.co.jp/' },
            { name: 'NHK News', url: 'https://www3.nhk.or.jp/news/' },
            { name: 'Asahi Shimbun', url: 'https://www.asahi.com/' }
        ],
        sentenceEndings: ['。', '！', '？', '\n']
    },
    es: {
        ttsLang: 'es-ES',
        dictionaryAPI: 'https://api.dictionaryapi.dev/api/v2/entries/es',
        placeholderText: 'Ejemplo: El gato está durmiendo. El perro está corriendo...',
        importTitle: 'Import Spanish Text',
        translateTo: 'Translate to Spanish',
        resourceLinks: [
            { name: 'BBC Mundo', url: 'https://www.bbc.com/mundo' },
            { name: 'El País', url: 'https://elpais.com/' },
            { name: 'CNN Español', url: 'https://cnnespanol.cnn.com/' },
            { name: 'DW Español', url: 'https://www.dw.com/es/' }
        ],
        sentenceEndings: ['.', '¡', '¿', '\n']
    }
};

/* ========================
   CORE FUNCTIONALITY
   ======================== */

// Initialize the application
async function initApp() {
    try {
        // Initialize database
        db = await openDatabase();
        
        // Apply UI settings
        applyUISettings();
        
        // Initialize language-specific UI
        initLanguageUI();
        
        // Load existing sentences
        state.sentences = await getAllSentences();
        
        if (state.sentences.length > 0) {
            switchToReviewView();
        }
        
        // Update vocabulary counts
        await updateBucketCounts();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initialize audio system
        initAudio();
        
        // Set online status
        updateOnlineStatus();
        
        // Pre-warm TTS
        warmTTS();

    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize app', 'error');
        attemptRecovery();
    }
}

function applyUISettings() {
    document.documentElement.setAttribute('data-theme', state.theme);
    document.documentElement.setAttribute('data-font', state.currentFont);
    document.documentElement.style.setProperty('--font-size', `${state.currentFontSize}px`);
    document.documentElement.style.setProperty('--line-height', state.currentLineHeight);
    document.getElementById('sound-toggle').textContent = state.soundsEnabled ? '🔊' : '🔇';
    document.getElementById('theme-toggle').textContent = state.theme === 'dark' ? '🌙' : '☀️';
}

function initLanguageUI() {
    const config = languageConfig[state.currentLanguage];
    
    // Update text elements
    document.getElementById('text-input').placeholder = config.placeholderText;
    document.querySelector('#import-container h2').textContent = config.importTitle;
    document.querySelector('#translate-container h2').textContent = config.translateTo;
    
    // Update resource links
    const resourcesContainer = document.querySelector('.resources-list');
    resourcesContainer.innerHTML = '';
    config.resourceLinks.forEach(link => {
        const linkElement = document.createElement('a');
        linkElement.className = 'resource-link';
        linkElement.href = link.url;
        linkElement.target = '_blank';
        linkElement.rel = 'noopener';
        linkElement.textContent = link.name;
        resourcesContainer.appendChild(linkElement);
    });
}

function switchToReviewView() {
    document.querySelector('.nav-btn[data-view="text-import"]').classList.remove('active');
    document.querySelector('.nav-btn[data-view="vocab-review"]').classList.add('active');
    showView('vocab-review-view');
}

function warmTTS() {
    if ('speechSynthesis' in window) {
        speechSynthesis.getVoices();
    }
}

function updateOnlineStatus() {
    state.isOnline = navigator.onLine;
    document.getElementById('offline-warning').style.display = state.isOnline ? 'none' : 'block';
}

function attemptRecovery() {
    try {
        if (db) db.close();
        
        const req = indexedDB.deleteDatabase('SentenceMODE_DB');
        req.onsuccess = () => window.location.reload();
        req.onerror = () => showToast('Critical error. Please refresh.', 'error');
        req.onblocked = () => window.location.reload();
    } catch (e) {
        console.error('Recovery failed:', e);
    }
}

/* ========================
   DATABASE OPERATIONS
   ======================== */
const DB_NAME = 'SentenceMODE_DB';
const DB_VERSION = 2;
const STORE_SENTENCES = 'sentences';
const STORE_VOCAB = 'vocabulary';
const STORE_TRANSLATIONS = 'translations';
let db;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(STORE_SENTENCES)) {
                const store = db.createObjectStore(STORE_SENTENCES, { keyPath: 'id' });
                store.createIndex('position', 'position', { unique: true });
                store.createIndex('language', 'language', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(STORE_VOCAB)) {
                const store = db.createObjectStore(STORE_VOCAB, { keyPath: 'id' });
                store.createIndex('bucket', 'bucket', { unique: false });
                store.createIndex('word', 'word', { unique: false });
                store.createIndex('language', 'language', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(STORE_TRANSLATIONS)) {
                const store = db.createObjectStore(STORE_TRANSLATIONS, { keyPath: 'id' });
                store.createIndex('text', 'text', { unique: true });
            }
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function addSentences(sentences) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES], 'readwrite');
        const store = transaction.objectStore(STORE_SENTENCES);
        
        store.clear().onsuccess = () => {
            sentences.forEach((sentence, index) => {
                sentence.position = index;
                sentence.language = state.currentLanguage;
                store.add(sentence);
            });
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        };
    });
}

function getAllSentences() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES], 'readonly');
        const store = transaction.objectStore(STORE_SENTENCES);
        const request = store.getAll();
        
        request.onsuccess = () => {
            resolve(request.result.filter(s => s.language === state.currentLanguage));
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

function updateSentence(sentence) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES], 'readwrite');
        const store = transaction.objectStore(STORE_SENTENCES);
        const request = store.put(sentence);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

function addVocabWord(word) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readwrite');
        const store = transaction.objectStore(STORE_VOCAB);
        
        // Add language tag
        word.language = state.currentLanguage;
        
        // Check if word exists
        const index = store.index('word');
        const request = index.get(word.word);
        
        request.onsuccess = () => {
            if (request.result) {
                reject(new Error('Word already exists'));
            } else {
                updateWordStats();
                store.add(word).onsuccess = () => resolve();
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

function updateWordStats() {
    const today = new Date().toDateString();
    if (state.lastWordAddedDate !== today) {
        state.newWordsToday = 0;
        state.lastWordAddedDate = today;
    }
    state.newWordsToday++;
    state.readingStats.wordsLearned++;
    state.readingStats.dailyWords++;
    
    localStorage.setItem('newWordsToday', state.newWordsToday.toString());
    localStorage.setItem('lastWordAddedDate', state.lastWordAddedDate);
    localStorage.setItem('readingStats', JSON.stringify(state.readingStats));
}

function getVocabByBucket(bucket) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readonly');
        const store = transaction.objectStore(STORE_VOCAB);
        const index = store.index('bucket');
        const request = index.getAll(IDBKeyRange.only(bucket));
        
        request.onsuccess = () => {
            resolve(request.result.filter(w => w.language === state.currentLanguage));
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

function updateVocabWord(word) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readwrite');
        const store = transaction.objectStore(STORE_VOCAB);
        const request = store.put(word);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

function countVocabByBucket() {
    return new Promise((resolve, reject) => {
        const buckets = ['new', 'easy', 'medium', 'hard'];
        const counts = {};
        let completed = 0;
        
        buckets.forEach(bucket => {
            const transaction = db.transaction([STORE_VOCAB], 'readonly');
            const store = transaction.objectStore(STORE_VOCAB);
            const index = store.index('bucket');
            
            const request = index.count(IDBKeyRange.only(bucket));
            request.onsuccess = () => {
                counts[bucket] = request.result;
                if (++completed === buckets.length) resolve(counts);
            };
            request.onerror = (event) => reject(event.target.error);
        });
    });
}

function wipeAllData() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES, STORE_VOCAB, STORE_TRANSLATIONS], 'readwrite');
        
        transaction.objectStore(STORE_SENTENCES).clear();
        transaction.objectStore(STORE_VOCAB).clear();
        transaction.objectStore(STORE_TRANSLATIONS).clear();
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

/* ========================
   TEXT PROCESSING
   ======================== */

function splitSentences(text) {
    const endings = languageConfig[state.currentLanguage].sentenceEndings;
    const splitRegex = new RegExp(`(?<=[${endings.map(e => escapeRegExp(e)).join('')}])`);
    
    return text.split(splitRegex)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectLanguage(text) {
    const japaneseChars = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/;
    const spanishChars = /[áéíóúñÁÉÍÓÚÑ]/;
    
    if (japaneseChars.test(text)) return 'ja';
    if (spanishChars.test(text)) return 'es';
    return 'en';
}

/* ========================
   AUDIO & TTS
   ======================== */

function initAudio() {
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Correct sound
        state.sounds.correct = createSound(880, 'triangle', 0.3, 1760);
        // Incorrect sound
        state.sounds.incorrect = createSound(220, 'sawtooth', 0.5, 110);
        // Complete sound
        state.sounds.complete = createChordSound([523.25, 587.33, 659.25, 698.46, 783.99, 880]);
        // Flip sound
        state.sounds.flip = createSound(440, 'square', 0.3, 880, 0.1);
        
    } catch (e) {
        console.warn('Audio init failed:', e);
        state.soundsEnabled = false;
    }
}

function createSound(freq, type, duration, endFreq = null, rampTime = 0.1) {
    return () => {
        const osc = state.audioContext.createOscillator();
        const gain = state.audioContext.createGain();
        
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = 0.5;
        
        osc.connect(gain);
        gain.connect(state.audioContext.destination);
        
        osc.start();
        
        if (endFreq) {
            osc.frequency.exponentialRampToValueAtTime(endFreq, state.audioContext.currentTime + rampTime);
        }
        
        gain.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + duration);
        osc.stop(state.audioContext.currentTime + duration);
    };
}

function createChordSound(frequencies) {
    return () => {
        const gain = state.audioContext.createGain();
        gain.gain.value = 0.5;
        gain.connect(state.audioContext.destination);
        
        frequencies.forEach((freq, i) => {
            const osc = state.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.connect(gain);
            osc.start(state.audioContext.currentTime + i * 0.1);
            osc.stop(state.audioContext.currentTime + i * 0.1 + 0.3);
        });
    };
}

function playSound(name) {
    if (state.soundsEnabled && state.sounds[name]) {
        try {
            state.sounds[name]();
        } catch (e) {
            console.warn('Sound error:', e);
        }
    }
}

function toggleSounds() {
    state.soundsEnabled = !state.soundsEnabled;
    localStorage.setItem('soundsEnabled', state.soundsEnabled);
    document.getElementById('sound-toggle').textContent = state.soundsEnabled ? '🔊' : '🔇';
    showToast(`Sounds ${state.soundsEnabled ? 'enabled' : 'disabled'}`);
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = languageConfig[state.currentLanguage].ttsLang;
        state.currentTtsUtterance = utterance;
        
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            setVoice(utterance, voices);
        } else {
            speechSynthesis.onvoiceschanged = () => {
                setVoice(utterance, speechSynthesis.getVoices());
            };
        }
        
        speechSynthesis.speak(utterance);
    }
}

function setVoice(utterance, voices) {
    const targetVoice = voices.find(v => 
        v.lang === languageConfig[state.currentLanguage].ttsLang || 
        v.lang.startsWith(state.currentLanguage)
    );
    if (targetVoice) utterance.voice = targetVoice;
}

function pauseTTS() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.pause();
    }
}

function resumeTTS() {
    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
    }
}

/* ========================
   UI MANAGEMENT
   ======================== */

function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.add('active');
        state.currentView = viewId;
        
        if (viewId === 'reading-view') {
            startReadingSession();
        } else {
            endReadingSession();
        }
    }
}

function updateBucketCounts() {
    return countVocabByBucket().then(counts => {
        Object.entries(counts).forEach(([bucket, count]) => {
            const element = document.getElementById(`${bucket}-count`);
            if (element) element.textContent = count;
            
            const manageElement = document.getElementById(`manage-${bucket}-count`);
            if (manageElement) manageElement.textContent = count;
        });
        
        updateReviewButton();
    });
}

function updateReviewButton() {
    const btn = document.getElementById('start-review');
    if (!btn) return;
    
    if (state.reviewMode) {
        const count = parseInt(document.getElementById(`${state.reviewMode}-count`).textContent);
        btn.disabled = count === 0;
        btn.textContent = count > 0 ? `Review ${state.reviewMode} words` : 'No words to review';
    } else {
        btn.disabled = true;
        btn.textContent = 'Select a difficulty to start';
    }
}

function displaySentence() {
    if (state.sentences.length === 0) {
        document.getElementById('sentence-display').textContent = 'No sentences available.';
        document.getElementById('translation-display').style.display = 'none';
        document.getElementById('sentence-counter').textContent = 'Sentence 0/0';
        return;
    }
    
    const sentence = state.sentences[state.currentSentenceIndex];
    const display = document.getElementById('sentence-display');
    display.textContent = sentence.original;
    display.classList.add('current-sentence');
    
    document.getElementById('word-selection-box').style.display = 'none';
    document.getElementById('sentence-counter').textContent = 
        `Sentence ${state.currentSentenceIndex + 1}/${state.sentences.length}`;
    document.getElementById('jump-input').value = state.currentSentenceIndex + 1;
    
    updateTranslationDisplay(sentence);
    updateFavoriteButton(sentence);
    preloadAdjacentSentences();
}

function updateTranslationDisplay(sentence) {
    const translationDisplay = document.getElementById('translation-display');
    translationDisplay.style.display = 'none';
    
    if (sentence.cached_translation) {
        translationDisplay.textContent = sentence.cached_translation;
        if (state.autoTranslate) {
            translationDisplay.style.display = 'block';
        }
    }
}

function updateFavoriteButton(sentence) {
    const btn = document.getElementById('favorite-sentence-btn');
    if (btn) {
        btn.classList.toggle('active', state.bookmarks.some(b => b.id === sentence.id));
    }
}

function preloadAdjacentSentences() {
    [state.currentSentenceIndex - 1, state.currentSentenceIndex + 1].forEach(idx => {
        if (idx >= 0 && idx < state.sentences.length) {
            const sentence = state.sentences[idx];
            if (!sentence.cached_translation && !sentence.user_translation) {
                translateSentence(sentence.original, elements.translationLang.value)
                    .then(translation => {
                        sentence.cached_translation = translation;
                    });
            }
        }
    });
}

function translateCurrentSentence() {
    if (state.sentences.length === 0) return;
    
    const display = document.getElementById('translation-display');
    display.style.display = 'block';
    display.textContent = "Translating...";
    
    translateSentence(
        state.sentences[state.currentSentenceIndex].original,
        elements.translationLang.value
    ).then(translation => {
        display.textContent = translation;
        state.sentences[state.currentSentenceIndex].cached_translation = translation;
        addCopyButton(display, translation);
    });
}

function addCopyButton(element, text) {
    if (!document.getElementById('copy-translation-btn')) {
        const btn = document.createElement('button');
        btn.id = 'copy-translation-btn';
        btn.className = 'copy-translation';
        btn.textContent = 'Copy';
        btn.onclick = () => {
            navigator.clipboard.writeText(text);
            showToast('Translation copied!', 'success');
        };
        element.appendChild(btn);
    }
}

function showWordTooltip(word, x, y) {
    if (state.wordLookupCache[word]) {
        displayTooltip(state.wordLookupCache[word], x, y);
        return;
    }
    
    const transaction = db.transaction([STORE_VOCAB], 'readonly');
    const store = transaction.objectStore(STORE_VOCAB);
    const index = store.index('word');
    const request = index.get(word);
    
    request.onsuccess = () => {
        if (request.result) {
            cacheAndDisplayTooltip(word, request.result.translation, x, y);
        } else {
            lookupWordInDictionary(word)
                .then(translation => translation && cacheAndDisplayTooltip(word, translation, x, y));
        }
    };
}

function cacheAndDisplayTooltip(word, translation, x, y) {
    state.wordLookupCache[word] = translation;
    displayTooltip(translation, x, y);
}

function displayTooltip(text, x, y) {
    const tooltip = document.getElementById('word-tooltip');
    tooltip.textContent = text;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.classList.add('show');
    
    setTimeout(() => tooltip.classList.remove('show'), 2000);
}

async function lookupWordInDictionary(word) {
    try {
        const apiUrl = `${languageConfig[state.currentLanguage].dictionaryAPI}?keyword=${encodeURIComponent(word)}`;
        const response = await fetchWithFallback(apiUrl);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            return data.data[0].senses[0]?.english_definitions?.join(', ') || 'No definition found';
        }
        return null;
    } catch (error) {
        console.error('Dictionary error:', error);
        return null;
    }
}

async function fetchWithFallback(url) {
    try {
        const direct = await fetch(url);
        if (direct.ok) return direct;
        throw new Error('Direct fetch failed');
    } catch {
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        return await fetch(proxyUrl + encodeURIComponent(url));
    }
}

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast';
    if (type) toast.classList.add(type);
    toast.classList.add('show');
    
    setTimeout(() => toast.classList.remove('show'), 3000);
}

/* ========================
   VOCABULARY REVIEW
   ======================== */

function startReview(bucket) {
    state.reviewMode = bucket;
    getVocabByBucket(bucket).then(words => {
        if (words.length === 0) {
            showToast('No words to review in this category!', 'error');
            return;
        }
        
        state.reviewWords = shuffleArray(words);
        state.currentReviewIndex = 0;
        state.reviewStats = { correct: 0, incorrect: 0 };
        state.currentHardStreak = 0;
        
        showView('review-mode-view');
        bucket === 'hard' ? setupHardMode() : setupMatchingGame();
    });
}

function setupMatchingGame() {
    document.querySelector('header').classList.add('hidden');
    document.getElementById('hide-header-btn').classList.add('visible').textContent = '↓';
    
    const wordsToShow = state.reviewWords.slice(state.currentReviewIndex, state.currentReviewIndex + 5);
    state.currentRoundWords = wordsToShow;
    
    document.getElementById('matching-game-container').style.display = 'flex';
    document.getElementById('hard-mode-container').style.display = 'none';
    
    if (wordsToShow.length === 0) {
        showToast('No words to review!', 'error');
        return;
    }
    
    const isJapaneseStyle = state.reviewMode === 'new' || state.reviewMode === 'easy';
    const leftColumn = document.getElementById('left-column');
    const rightColumn = document.getElementById('right-column');
    
    leftColumn.innerHTML = '';
    rightColumn.innerHTML = '';
    
    const englishCards = shuffleArray([...wordsToShow]).map(createEnglishCard);
    const japaneseCards = shuffleArray([...wordsToShow]).map(createJapaneseCard);
    
    if (isJapaneseStyle) {
        englishCards.forEach(card => leftColumn.appendChild(card));
        japaneseCards.forEach(card => rightColumn.appendChild(card));
    } else {
        japaneseCards.forEach(card => leftColumn.appendChild(card));
        englishCards.forEach(card => rightColumn.appendChild(card));
    }
    
    setupScrollSync();
}

function createEnglishCard(word) {
    return createWordCard({
        id: word.id,
        type: 'english',
        text: word.translation,
        streak: word.streak || 0
    });
}

function createJapaneseCard(word) {
    return createWordCard({
        id: word.id,
        type: 'japanese',
        text: word.word,
        streak: word.streak || 0
    });
}

function createWordCard(word) {
    const card = document.createElement('div');
    card.className = 'word-card';
    card.dataset.id = word.id;
    card.dataset.type = word.type;
    card.dataset.streak = word.streak || 0;
    
    const content = document.createElement('div');
    content.style.flex = '1';
    content.style.display = 'flex';
    content.style.alignItems = 'center';
    content.style.justifyContent = 'center';
    content.style.width = '100%';
    content.style.padding = '10px';
    content.style.wordBreak = 'break-word';
    content.textContent = word.text;
    
    const streakIndicator = document.createElement('div');
    streakIndicator.className = 'streak-indicator';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'streak-progress';
    progressBar.style.width = `${(word.streak || 0) * 33.33}%`;
    
    card.appendChild(content);
    streakIndicator.appendChild(progressBar);
    card.appendChild(streakIndicator);
    
    card.addEventListener('click', () => handleCardClick(card, word));
    
    return card;
}

function handleCardClick(card, word) {
    playSound('flip');
    
    if ((word.type === 'japanese' && state.reviewMode === 'medium') ||
        (word.type === 'english' && (state.reviewMode === 'new' || state.reviewMode === 'easy'))) {
        speakText(state.reviewWords.find(w => w.id === word.id).word);
    }
    
    selectCard(card);
}

let selectedLeftCard = null;
let selectedRightCard = null;

function selectCard(card) {
    if (card.classList.contains('correct')) return;
    
    card.classList.remove('incorrect');
    card.classList.add('selected');
    
    const isLeft = card.parentElement.id === 'left-column';
    
    if (isLeft) {
        if (selectedLeftCard) selectedLeftCard.classList.remove('selected');
        selectedLeftCard = card;
    } else {
        if (selectedRightCard) selectedRightCard.classList.remove('selected');
        selectedRightCard = card;
    }
    
    if (selectedLeftCard && selectedRightCard) {
        checkMatch(selectedLeftCard, selectedRightCard);
    }
}

function checkMatch(leftCard, rightCard) {
    if (leftCard.dataset.id === rightCard.dataset.id) {
        handleCorrectMatch(leftCard, rightCard);
    } else {
        handleIncorrectMatch(leftCard, rightCard);
    }
}

function handleCorrectMatch(leftCard, rightCard) {
    leftCard.classList.remove('selected');
    rightCard.classList.remove('selected');
    leftCard.classList.add('correct');
    rightCard.classList.add('correct');
    
    state.reviewStats.correct++;
    playSound('correct');
    
    const matchedWord = state.currentRoundWords.find(w => w.id === leftCard.dataset.id);
    if (matchedWord) {
        updateWordStreak(matchedWord, leftCard, rightCard);
    }
    
    selectedLeftCard = null;
    selectedRightCard = null;
    checkRoundCompletion();
}

function updateWordStreak(word, leftCard, rightCard) {
    word.streak = (word.streak || 0) + 1;
    const wordIndex = state.reviewWords.findIndex(w => w.id === word.id);
    if (wordIndex !== -1) state.reviewWords[wordIndex].streak = word.streak;
    
    updateVocabWord(word).then(() => {
        leftCard.dataset.streak = word.streak;
        rightCard.dataset.streak = word.streak;
        
        [leftCard, rightCard].forEach(card => {
            const progress = card.querySelector('.streak-progress');
            if (progress) progress.style.width = `${word.streak * 33.33}%`;
        });
        
        const needed = 3 - word.streak;
        showToast(needed > 0 
            ? `Correct! Need ${needed} more to move up` 
            : 'Correct! Word will move up', 'success');
        
        if (word.streak >= 3) {
            moveWordToNextBucket(word);
        }
    });
}

function moveWordToNextBucket(word) {
    if (word.bucket === 'new') word.bucket = 'easy';
    else if (word.bucket === 'easy') word.bucket = 'medium';
    else if (word.bucket === 'medium') word.bucket = 'hard';
    
    word.streak = 0;
    updateVocabWord(word);
}

function handleIncorrectMatch(leftCard, rightCard) {
    leftCard.classList.remove('selected');
    rightCard.classList.remove('selected');
    leftCard.classList.add('incorrect');
    rightCard.classList.add('incorrect');
    
    state.reviewStats.incorrect++;
    playSound('incorrect');
    showToast('Try again!', 'error');
    
    setTimeout(() => {
        leftCard.classList.remove('incorrect');
        rightCard.classList.remove('incorrect');
        selectedLeftCard = null;
        selectedRightCard = null;
    }, 1000);
}

function checkRoundCompletion() {
    const allCards = document.querySelectorAll('.word-card');
    const matchedCards = document.querySelectorAll('.word-card.correct');
    
    if (matchedCards.length === allCards.length) {
        playSound('complete');
        state.currentReviewIndex += 5;
        
        setTimeout(() => {
            if (state.currentReviewIndex < state.reviewWords.length) {
                setupMatchingGame();
            } else {
                showView('vocab-review-view');
                updateBucketCounts();
            }
        }, 1500);
    }
}

function setupHardMode() {
    document.getElementById('matching-game-container').style.display = 'none';
    document.getElementById('hard-mode-container').style.display = 'flex';
    
    if (state.currentReviewIndex >= state.reviewWords.length) {
        document.getElementById('review-question').textContent = "Review complete!";
        document.getElementById('hard-mode-container').style.display = 'none';
        return;
    }
    
    state.currentHardWord = state.reviewWords[state.currentReviewIndex];
    displayHardModeQuestion();
}

function displayHardModeQuestion() {
    const questionDiv = document.createElement('div');
    questionDiv.style.textAlign = 'center';
    
    const wordElement = document.createElement('div');
    wordElement.textContent = state.currentHardWord.word;
    wordElement.style.fontSize = '2rem';
    wordElement.style.marginBottom = '1rem';
    
    const streakElement = document.createElement('div');
    streakElement.textContent = `Streak: ${state.currentHardWord.streak || 0}/3`;
    streakElement.style.fontSize = '0.9rem';
    streakElement.style.color = 'var(--text-secondary)';
    
    const progressBar = document.createElement('div');
    progressBar.style.height = '4px';
    progressBar.style.width = '100%';
    progressBar.style.backgroundColor = 'var(--secondary)';
    progressBar.style.borderRadius = '2px';
    progressBar.style.margin = '0.5rem auto';
    
    const progressFill = document.createElement('div');
    progressFill.style.height = '100%';
    progressFill.style.width = `${(state.currentHardWord.streak || 0) * 33.33}%`;
    progressFill.style.backgroundColor = 'var(--highlight)';
    progressFill.style.borderRadius = '2px';
    
    progressBar.appendChild(progressFill);
    questionDiv.appendChild(wordElement);
    questionDiv.appendChild(streakElement);
    questionDiv.appendChild(progressBar);
    
    const container = document.getElementById('review-question');
    container.innerHTML = '';
    container.appendChild(questionDiv);
}

function handleHardModeResponse(knewIt) {
    if (!state.currentHardWord) return;
    
    if (knewIt) {
        state.currentHardStreak++;
        
        if (state.currentHardStreak >= 3) {
            // Retire word
            const transaction = db.transaction([STORE_VOCAB], 'readwrite');
            transaction.objectStore(STORE_VOCAB).delete(state.currentHardWord.id);
            showToast('Word retired!', 'success');
        } else {
            // Move to easier bucket
            if (state.currentHardWord.bucket === 'hard') state.currentHardWord.bucket = 'medium';
            else if (state.currentHardWord.bucket === 'medium') state.currentHardWord.bucket = 'easy';
            else if (state.currentHardWord.bucket === 'easy') state.currentHardWord.bucket = 'new';
            
            updateVocabWord(state.currentHardWord);
            showToast('Word moved to easier bucket', 'success');
        }
    } else {
        state.currentHardStreak = 0;
        state.currentHardWord.bucket = 'new';
        updateVocabWord(state.currentHardWord);
        showToast('Word moved back to new words', 'error');
    }
    
    state.currentReviewIndex++;
    if (state.currentReviewIndex < state.reviewWords.length) {
        setupHardMode();
    } else {
        showView('vocab-review-view');
        updateBucketCounts();
    }
}

function setupScrollSync() {
    const leftColumn = document.getElementById('left-column');
    const rightColumn = document.getElementById('right-column');
    
    leftColumn.addEventListener('scroll', () => syncScroll(leftColumn, rightColumn));
    rightColumn.addEventListener('scroll', () => syncScroll(rightColumn, leftColumn));
}

function syncScroll(scrolledElement, otherElement) {
    otherElement.removeEventListener('scroll', syncScroll);
    otherElement.scrollTop = scrolledElement.scrollTop;
    setTimeout(() => {
        otherElement.addEventListener('scroll', syncScroll);
    }, 10);
}

/* ========================
   UTILITY FUNCTIONS
   ======================== */
    function closeSettings() {
        document.getElementById('settings-panel').classList.remove('open');
        document.getElementById('settings-overlay').classList.remove('open');
    }
    
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showView(btn.dataset.view + '-view');
            
            if (btn.dataset.view === 'bookmarks') {
                renderBookmarks();
            }
        });
    });
    
    // Text input
    document.getElementById('text-input').addEventListener('input', updateCharCount);
    document.getElementById('translate-input').addEventListener('input', updateTranslateCharCount);
    
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
    document.getElementById('theme-toggle').textContent = state.theme === 'dark' ? '🌙' : '☀️';
}

function toggleHeaderVisibility() {
    const header = document.querySelector('header');
    const btn = document.getElementById('hide-header-btn');
    
    if (header.classList.contains('hidden')) {
        header.classList.remove('hidden');
        btn.textContent = '↑';
    } else {
        header.classList.add('hidden');
        btn.textContent = '↓';
    }
}

function startReadingSession() {
    if (!state.currentSessionStart) {
        state.currentSessionStart = new Date();
    }
}

function endReadingSession() {
    if (state.currentSessionStart) {
        const now = new Date();
        const timeSpent = (now - state.currentSessionStart) / 1000;
        state.readingStats.timeSpent += timeSpent;
        state.readingStats.dailyTime += timeSpent;
        state.currentSessionStart = null;
        localStorage.setItem('readingStats', JSON.stringify(state.readingStats));
    }
}

/* ========================
   EVENT LISTENERS SETUP
   ======================== */

function setupEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    
    // Sound toggle
    document.getElementById('sound-toggle').addEventListener('click', toggleSounds);
    
// Settings panel
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.add('open');
    document.getElementById('settings-overlay').classList.add('open');
});

document.getElementById('close-settings').addEventListener('click', closeSettings);
document.getElementById('settings-overlay').addEventListener('click', closeSettings);
    
    function updateCharCount() {
        document.getElementById('char-count').textContent = document.getElementById('text-input').value.length;
    }
    
    function updateTranslateCharCount() {
        document.getElementById('translate-char-count').textContent = 
            document.getElementById('translate-input').value.length;
    }
    
    // Process text
    document.getElementById('process-text').addEventListener('click', processText);
    
    async function processText() {
        const text = document.getElementById('text-input').value.trim();
        if (!text) {
            showToast('Please enter some text', 'error');
            return;
        }
        
        try {
            const button = document.getElementById('process-text');
            button.innerHTML = 'Processing...';
            button.disabled = true;
            
            const sentences = splitSentences(text).map((sentence, index) => ({
                id: generateUUID(),
                original: sentence,
                position: index,
                language: state.currentLanguage
            }));
            
            await addSentences(sentences);
            state.sentences = await getAllSentences();
            state.currentSentenceIndex = 0;
            
            saveToHistory(text);
            showView('reading-view');
            displaySentence();
            showToast(`Processed ${sentences.length} sentences!`, 'success');
            
        } catch (error) {
            console.error('Error:', error);
            showToast('Error processing text', 'error');
        } finally {
            const button = document.getElementById('process-text');
            button.innerHTML = 'Process Text';
            button.disabled = false;
        }
    }
    
    function saveToHistory(text) {
        const title = prompt("Title for this text:", text.substring(0, 20) + (text.length > 20 ? "..." : ""));
        state.textHistory.unshift({
            text: text,
            title: title || text.substring(0, 20) + (text.length > 20 ? "..." : ""),
            timestamp: new Date().toISOString(),
            progress: 0
        });
        
        if (state.textHistory.length > 10) {
            state.textHistory = state.textHistory.slice(0, 10);
        }
        
        localStorage.setItem('textHistory', JSON.stringify(state.textHistory));
    }
    
    // Reading view controls
    document.getElementById('prev-sentence').addEventListener('click', () => {
        if (state.currentSentenceIndex > 0) {
            state.currentSentenceIndex--;
            document.getElementById('sentence-display').classList.remove('current-sentence');
            displaySentence();
        }
    });
    
    document.getElementById('next-sentence').addEventListener('click', () => {
        if (state.currentSentenceIndex < state.sentences.length - 1) {
            state.currentSentenceIndex++;
            document.getElementById('sentence-display').classList.remove('current-sentence');
            displaySentence();
        }
    });
    
    document.getElementById('translate-btn').addEventListener('click', translateCurrentSentence);
    document.getElementById('tts-button').addEventListener('click', () => {
        if (state.sentences.length > 0) {
            speakText(state.sentences[state.currentSentenceIndex].original);
        }
    });
    
    // Word selection
    document.getElementById('sentence-display').addEventListener('mouseup', handleTextSelection);
    document.getElementById('sentence-display').addEventListener('touchend', handleTextSelection);
    
    function handleTextSelection() {
        const selection = window.getSelection().toString().trim();
        if (selection) {
            document.getElementById('selected-word').textContent = selection;
            document.getElementById('vocab-translation').value = '';
            document.getElementById('word-selection-box').style.display = 'block';
            document.getElementById('vocab-translation').focus();
            
            if (window.innerWidth <= 600) {
                document.getElementById('word-selection-box').scrollIntoView({ behavior: 'smooth' });
            }
        }
    }
    
    // Vocabulary management
    document.getElementById('add-to-vocab').addEventListener('click', async () => {
        const word = document.getElementById('selected-word').textContent;
        const translation = document.getElementById('vocab-translation').value.trim();
        
        if (!translation) {
            showToast('Please enter a translation', 'error');
            return;
        }
        
        try {
            await addVocabWord({
                id: generateUUID(),
                word: word,
                translation: translation,
                bucket: 'new',
                streak: 0,
                language: state.currentLanguage
            });
            
            showToast(`"${word}" added to vocabulary!`, 'success');
            document.getElementById('word-selection-box').style.display = 'none';
            await updateBucketCounts();
            
        } catch (error) {
            showToast(error.message === 'Word already exists' 
                ? `"${word}" is already in your vocabulary!` 
                : 'Error adding word', 'error');
        }
    });
    
    // Review mode
    document.querySelectorAll('.bucket-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.bucket-card').forEach(c => {
                c.style.opacity = '1';
                c.style.transform = 'scale(1)';
            });
            
            card.style.opacity = '0.9';
            card.style.transform = 'scale(0.98)';
            state.reviewMode = card.dataset.bucket;
            updateReviewButton();
        });
    });
    
    document.getElementById('start-review').addEventListener('click', () => {
        if (state.reviewMode) {
            startReview(state.reviewMode);
        }
    });
    
    // Hard mode buttons
    document.getElementById('knew-it-btn').addEventListener('click', () => handleHardModeResponse(true));
    document.getElementById('didnt-know-btn').addEventListener('click', () => handleHardModeResponse(false));
    document.getElementById('skip-btn').addEventListener('click', () => {
        state.currentReviewIndex++;
        if (state.currentReviewIndex < state.reviewWords.length) {
            setupHardMode();
        } else {
            showView('vocab-review-view');
            updateBucketCounts();
        }
    });
    
    // Exit review
    document.getElementById('exit-review').addEventListener('click', () => {
        document.querySelector('header').classList.remove('hidden');
        document.getElementById('hide-header-btn').classList.remove('visible');
        showView('vocab-review-view');
    });
    
    // Shuffle cards
    document.getElementById('shuffle-cards').addEventListener('click', () => {
        if (state.reviewMode && state.reviewMode !== 'hard') {
            setupMatchingGame();
        }
    });
    
    // Jump to sentence
    document.getElementById('jump-btn').addEventListener('click', jumpToSentence);
    document.getElementById('jump-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') jumpToSentence();
    });
    
    function jumpToSentence() {
        const num = parseInt(document.getElementById('jump-input').value);
        if (num > 0 && num <= state.sentences.length) {
            state.currentSentenceIndex = num - 1;
            document.getElementById('sentence-display').classList.remove('current-sentence');
            displaySentence();
        }
    }
    
    // Favorite button
    document.getElementById('favorite-sentence-btn').addEventListener('click', toggleBookmark);
    
    function toggleBookmark() {
        if (state.sentences.length === 0) return;
        
        const sentence = state.sentences[state.currentSentenceIndex];
        const index = state.bookmarks.findIndex(b => b.id === sentence.id);
        
        if (index === -1) {
            // Add to bookmarks
            state.bookmarks.push({
                id: sentence.id,
                sentence: sentence.original,
                translation: sentence.cached_translation || '',
                date: new Date().toISOString()
            });
            document.getElementById('favorite-sentence-btn').classList.add('active');
            showToast('Added to bookmarks!', 'success');
        } else {
            // Remove from bookmarks
            state.bookmarks.splice(index, 1);
            document.getElementById('favorite-sentence-btn').classList.remove('active');
            showToast('Removed from bookmarks', 'error');
        }
        
        localStorage.setItem('bookmarks', JSON.stringify(state.bookmarks));
    }
    
    // Clear bookmarks
    document.getElementById('clear-bookmarks-btn').addEventListener('click', () => {
        state.bookmarks = [];
        localStorage.setItem('bookmarks', JSON.stringify(state.bookmarks));
        renderBookmarks();
        showToast('All bookmarks cleared', 'success');
    });
    
    // Wipe data
    document.getElementById('wipe-data-btn').addEventListener('click', () => {
        document.getElementById('wipe-confirmation').style.display = 'flex';
    });
    
    document.getElementById('confirm-wipe').addEventListener('click', async () => {
        try {
            await wipeAllData();
            state.sentences = [];
            state.vocabWords = [];
            state.newWordsToday = 0;
            localStorage.setItem('newWordsToday', '0');
            await updateBucketCounts();
            showToast('All data has been deleted', 'success');
            showView('text-import-view');
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to delete data', 'error');
        } finally {
            document.getElementById('wipe-confirmation').style.display = 'none';
        }
    });
    
    document.getElementById('cancel-wipe').addEventListener('click', () => {
        document.getElementById('wipe-confirmation').style.display = 'none';
    });
    
    // Online/offline detection
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (state.currentView === 'reading-view') {
            if (e.key === 'ArrowLeft') document.getElementById('prev-sentence').click();
            else if (e.key === 'ArrowRight') document.getElementById('next-sentence').click();
            else if (e.key === ' ') {
                if (state.currentTtsUtterance && window.speechSynthesis.speaking) {
                    window.speechSynthesis.paused ? resumeTTS() : pauseTTS();
                } else {
                    document.getElementById('tts-button').click();
                }
                e.preventDefault();
            } else if (e.key === 't') {
                document.getElementById('translate-btn').click();
            } else if (e.key === 'f') {
                document.getElementById('favorite-sentence-btn').click();
            }
        }
        
        if (state.currentView === 'review-mode-view' && state.reviewMode === 'hard') {
            if (e.key === 'Enter') document.getElementById('knew-it-btn').click();
            else if (e.key === 'Escape') document.getElementById('didnt-know-btn').click();
            else if (e.key === ' ') {
                document.getElementById('skip-btn').click();
                e.preventDefault();
            }
        }
        
        if (document.activeElement === document.getElementById('vocab-translation') && e.key === 'Enter') {
            document.getElementById('add-to-vocab').click();
        }
    });
}

function renderBookmarks() {
    const container = document.getElementById('bookmarks-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (state.bookmarks.length === 0) {
        container.innerHTML = '<p>No bookmarks yet</p>';
        return;
    }
    
    state.bookmarks.forEach(bookmark => {
        const item = document.createElement('div');
        item.className = 'resource-link';
        
        const preview = bookmark.sentence.substring(0, 30) + 
                       (bookmark.sentence.length > 30 ? '...' : '');
        
        item.innerHTML = `
            <span style="flex: 1;">${preview}</span>
            <span style="font-size: 0.8rem; color: var(--text-secondary); margin-right: 0.5rem;">
                ${new Date(bookmark.date).toLocaleDateString()}
            </span>
            <button class="nav-btn" style="background-color: var(--danger); padding: 0.3rem 0.6rem;" 
                data-bookmark-id="${bookmark.id}">✕</button>
        `;
        
        container.appendChild(item);
    });
    
    // Add click handlers to delete buttons
    container.querySelectorAll('[data-bookmark-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-bookmark-id');
            state.bookmarks = state.bookmarks.filter(b => b.id !== id);
            localStorage.setItem('bookmarks', JSON.stringify(state.bookmarks));
            renderBookmarks();
            showToast('Bookmark removed', 'success');
        });
    });
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
