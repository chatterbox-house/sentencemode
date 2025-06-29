// ==============================================
// Language Configuration and Constants
// ==============================================

const LANGUAGE_CONFIG = {
    'ja': {
        name: 'Japanese',
        code: 'ja',
        flag: '🇯🇵',
        sentenceEnders: ['。', '！', '？', '\n'],
        ttsLang: 'ja-JP',
        resources: [
            { name: 'NHK Easy News', url: 'https://www3.nhk.or.jp/news/easy/' },
            { name: 'Yahoo Japan News', url: 'https://news.yahoo.co.jp/' },
            { name: 'NHK News', url: 'https://www3.nhk.or.jp/news/' },
            { name: 'Asahi Shimbun', url: 'https://www.asahi.com/' }
        ]
    },
    'en': {
        name: 'English',
        code: 'en',
        flag: '🇬🇧',
        sentenceEnders: ['.', '!', '?', '\n'],
        ttsLang: 'en-US',
        resources: [
            { name: 'Tofugu', url: 'https://www.tofugu.com/' },
            { name: 'JapanesePod101', url: 'https://www.japanesepod101.com/' }
        ]
    }
};

const DB_NAME = 'JapaneseLearnerDB';
const DB_VERSION = 2;
const STORE_SENTENCES = 'sentences';
const STORE_VOCAB = 'vocabulary';
const STORE_TRANSLATIONS = 'translations';
const STORE_SETTINGS = 'settings';

// ==============================================
// Core Application State
// ==============================================

const state = {
    // UI State
    currentView: 'text-import',
    theme: localStorage.getItem('theme') || 'dark',
    soundsEnabled: localStorage.getItem('soundsEnabled') !== 'false',
    currentFont: localStorage.getItem('font') || 'system',
    currentFontSize: parseInt(localStorage.getItem('fontSize')) || 16,
    currentLineHeight: parseFloat(localStorage.getItem('lineHeight')) || 1.6,
    autoTranslate: localStorage.getItem('autoTranslate') === 'true',
    isOnline: navigator.onLine,
    uiLanguage: localStorage.getItem('uiLanguage') || 'en',
    
    // Content State
    sentences: [],
    currentSentenceIndex: 0,
    vocabWords: [],
    textHistory: [],
    bookmarks: JSON.parse(localStorage.getItem('bookmarks')) || [],
    
    // Review State
    reviewMode: null,
    reviewWords: [],
    currentReviewIndex: 0,
    reviewStats: { correct: 0, incorrect: 0 },
    currentHardWord: null,
    currentHardStreak: 0,
    
    // Audio
    audioContext: null,
    sounds: {},
    currentTtsUtterance: null,
    
    // Tracking
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
    newWordsToday: parseInt(localStorage.getItem('newWordsToday')) || 0,
    lastWordAddedDate: localStorage.getItem('lastWordAddedDate') || '',
    
    // Current working language
    sourceLanguage: 'ja',
    targetLanguage: 'en',
    
    // Caches
    wordLookupCache: {},
    selectedCards: [],
    lastDeleted: null
};

// ==============================================
// Database Operations
// ==============================================

async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Sentences store
            if (!db.objectStoreNames.contains(STORE_SENTENCES)) {
                const sentencesStore = db.createObjectStore(STORE_SENTENCES, { keyPath: 'id' });
                sentencesStore.createIndex('position', 'position', { unique: true });
                sentencesStore.createIndex('language', 'language', { unique: false });
            }
            
            // Vocabulary store
            if (!db.objectStoreNames.contains(STORE_VOCAB)) {
                const vocabStore = db.createObjectStore(STORE_VOCAB, { keyPath: 'id' });
                vocabStore.createIndex('bucket', 'bucket', { unique: false });
                vocabStore.createIndex('word', 'word', { unique: false });
                vocabStore.createIndex('language', 'language', { unique: false });
                vocabStore.createIndex('favorite', 'favorite', { unique: false });
            }
            
            // Translations store
            if (!db.objectStoreNames.contains(STORE_TRANSLATIONS)) {
                const translationsStore = db.createObjectStore(STORE_TRANSLATIONS, { keyPath: 'id' });
                translationsStore.createIndex('text', 'text', { unique: true });
                translationsStore.createIndex('languagePair', 'languagePair', { unique: false });
            }
            
            // Settings store
            if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                db.createObjectStore(STORE_SETTINGS, { keyPath: 'name' });
            }
        };
        
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function wipeAllData() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            [STORE_SENTENCES, STORE_VOCAB, STORE_TRANSLATIONS], 
            'readwrite'
        );
        
        transaction.objectStore(STORE_SENTENCES).clear();
        transaction.objectStore(STORE_VOCAB).clear();
        transaction.objectStore(STORE_TRANSLATIONS).clear();
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

async function addSentences(sentences) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES], 'readwrite');
        const store = transaction.objectStore(STORE_SENTENCES);
        
        store.clear().onsuccess = () => {
            sentences.forEach((sentence, index) => {
                sentence.position = index;
                sentence.language = state.sourceLanguage;
                store.add(sentence);
            });
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        };
    });
}

async function getAllSentences() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES], 'readonly');
        const store = transaction.objectStore(STORE_SENTENCES);
        const index = store.index('position');
        const request = index.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function updateSentence(sentence) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES], 'readwrite');
        const store = transaction.objectStore(STORE_SENTENCES);
        const request = store.put(sentence);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

async function addVocabWord(word) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readwrite');
        const store = transaction.objectStore(STORE_VOCAB);
        
        // Check if word already exists for this language
        const wordIndex = store.index('word');
        const request = wordIndex.getAll(IDBKeyRange.only(word.word));
        
        request.onsuccess = () => {
            const existingWords = request.result || [];
            const alreadyExists = existingWords.some(w => w.language === word.language);
            
            if (alreadyExists) {
                reject(new Error('Word already exists in vocabulary'));
            } else {
                // Track new words added today
                const today = new Date().toDateString();
                if (state.lastWordAddedDate !== today) {
                    state.newWordsToday = 0;
                    state.lastWordAddedDate = today;
                }
                state.newWordsToday++;
                localStorage.setItem('newWordsToday', state.newWordsToday.toString());
                localStorage.setItem('lastWordAddedDate', state.lastWordAddedDate);
                
                // Update reading stats
                state.readingStats.wordsLearned++;
                state.readingStats.dailyWords++;
                localStorage.setItem('readingStats', JSON.stringify(state.readingStats));
                updateStatsDisplay();
                
                const addRequest = store.add(word);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = (event) => reject(event.target.error);
            }
        };
        
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getVocabByBucket(bucket) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readonly');
        const store = transaction.objectStore(STORE_VOCAB);
        const index = store.index('bucket');
        const request = index.getAll(IDBKeyRange.only(bucket));
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function updateVocabWord(word) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readwrite');
        const store = transaction.objectStore(STORE_VOCAB);
        const request = store.put(word);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

async function countVocabByBucket() {
    return new Promise((resolve, reject) => {
        const buckets = ['new', 'easy', 'medium', 'hard'];
        const counts = {};
        
        const transaction = db.transaction([STORE_VOCAB], 'readonly');
        const store = transaction.objectStore(STORE_VOCAB);
        const index = store.index('bucket');
        
        let completed = 0;
        
        buckets.forEach(bucket => {
            const request = index.count(IDBKeyRange.only(bucket));
            
            request.onsuccess = () => {
                counts[bucket] = request.result;
                completed++;
                
                if (completed === buckets.length) {
                    resolve(counts);
                }
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    });
}

async function getCachedTranslation(text, sourceLang, targetLang) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_TRANSLATIONS], 'readonly');
        const store = transaction.objectStore(STORE_TRANSLATIONS);
        const index = store.index('text');
        const request = index.get(`${sourceLang}|${targetLang}|${text}`);
        
        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result.translatedText);
            } else {
                resolve(null);
            }
        };
        
        request.onerror = (event) => reject(event.target.error);
    });
}

async function cacheTranslation(text, sourceLang, targetLang, translatedText) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_TRANSLATIONS], 'readwrite');
        const store = transaction.objectStore(STORE_TRANSLATIONS);
        
        const translation = {
            id: generateUUID(),
            text: `${sourceLang}|${targetLang}|${text}`,
            languagePair: `${sourceLang}-${targetLang}`,
            translatedText: translatedText,
            timestamp: new Date().getTime()
        };
        
        const request = store.add(translation);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

// ==============================================
// Language Processing Functions
// ==============================================

function detectLanguage(text) {
    // Simple heuristic to detect Japanese text
    const japaneseChars = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/;
    return japaneseChars.test(text) ? 'ja' : 'en';
}

function splitSentences(text, language = 'ja') {
    const config = LANGUAGE_CONFIG[language];
    if (!config) return [text];
    
    const roughSentences = text.split(new RegExp(`(?<=[${config.sentenceEnders.join('')}])`));
    const sentences = [];
    
    roughSentences.forEach(roughSentence => {
        const trimmed = roughSentence.trim();
        if (trimmed.length === 0) return;
        
        if (config.sentenceEnders.some(ender => trimmed.includes(ender))) {
            const subSentences = trimmed.split(new RegExp(`(?<=[${config.sentenceEnders.join('')}])`));
            subSentences.forEach(sub => {
                const subTrimmed = sub.trim();
                if (subTrimmed.length > 0) sentences.push(subTrimmed);
            });
        } else {
            sentences.push(trimmed);
        }
    });
    
    return sentences;
}

async function translateText(text, sourceLang, targetLang) {
    try {
        // Check cache first
        const cachedTranslation = await getCachedTranslation(text, sourceLang, targetLang);
        if (cachedTranslation) return cachedTranslation;

        if (!state.isOnline) {
            throw new Error('Offline - translation not available');
        }

        const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`
        );

        if (!response.ok) throw new Error('Translation failed');

        const data = await response.json();
        if (data.responseData?.translatedText) {
            await cacheTranslation(text, sourceLang, targetLang, data.responseData.translatedText);
            return data.responseData.translatedText;
        }
        
        throw new Error('No translation found');
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
}

async function lookupWordInDictionary(word, language = 'ja') {
    try {
        let apiUrl;
        if (language === 'ja') {
            apiUrl = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
        } else {
            // For other languages, we might use a different dictionary API
            apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
        }
        
        let response;
        try {
            response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Direct API failed');
        } catch (directError) {
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
            if (!response.ok) throw new Error('API request failed');
        }

        const data = await response.json();
        
        if (language === 'ja') {
            if (data.data?.length > 0) {
                return data.data[0].senses[0]?.english_definitions?.join(', ') || 'No definition found';
            }
        } else {
            if (Array.isArray(data) && data.length > 0) {
                return data[0].meanings?.[0]?.definitions?.[0]?.definition || 'No definition found';
            }
        }
        
        return null;
    } catch (error) {
        console.error('Dictionary lookup error:', error);
        return null;
    }
}

// ==============================================
// UI/View Management
// ==============================================

function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.add('active');
        state.currentView = viewId;
        
        // Start/end reading session tracking
        if (viewId === 'reading-view') {
            startReadingSession();
        } else {
            endReadingSession();
        }
        
        // Special handling for specific views
        if (viewId === 'bookmarks-view') {
            renderBookmarks();
        } else if (viewId === 'history-view') {
            showHistoryView();
        }
    }
}

function updateBucketCounts() {
    countVocabByBucket().then(counts => {
        Object.entries(counts).forEach(([bucket, count]) => {
            const countElement = document.getElementById(`${bucket}-count`);
            const manageCountElement = document.getElementById(`manage-${bucket}-count`);
            
            if (countElement) countElement.textContent = count;
            if (manageCountElement) manageCountElement.textContent = count;
        });
        
        const selectedBucket = state.reviewMode;
        const startReviewBtn = document.getElementById('start-review');
        
        if (startReviewBtn) {
            if (selectedBucket && counts[selectedBucket] > 0) {
                startReviewBtn.disabled = false;
                startReviewBtn.textContent = `Review ${selectedBucket} words`;
            } else {
                startReviewBtn.disabled = true;
                startReviewBtn.textContent = 'Select a difficulty to start';
            }
        }
    }).catch(error => {
        console.error('Error updating bucket counts:', error);
    });
}

function displaySentence() {
    const sentenceDisplay = document.getElementById('sentence-display');
    const translationDisplay = document.getElementById('translation-display');
    const sentenceCounter = document.getElementById('sentence-counter');
    const jumpInput = document.getElementById('jump-input');
    const favoriteBtn = document.getElementById('favorite-sentence-btn');
    
    if (state.sentences.length === 0) {
        if (sentenceDisplay) sentenceDisplay.textContent = 'No sentences available.';
        if (translationDisplay) translationDisplay.style.display = 'none';
        if (sentenceCounter) sentenceCounter.textContent = 'Sentence 0/0';
        return;
    }
    
    const sentence = state.sentences[state.currentSentenceIndex];
    if (sentenceDisplay) {
        sentenceDisplay.textContent = sentence.original;
        sentenceDisplay.classList.add('current-sentence');
    }
    
    if (document.getElementById('word-selection-box')) {
        document.getElementById('word-selection-box').style.display = 'none';
    }
    
    if (sentenceCounter) {
        sentenceCounter.textContent = `Sentence ${state.currentSentenceIndex + 1}/${state.sentences.length}`;
    }
    
    if (jumpInput) {
        jumpInput.value = state.currentSentenceIndex + 1;
    }
    
    if (translationDisplay) {
        translationDisplay.style.display = 'none';
        
        if (sentence.cached_translation) {
            translationDisplay.textContent = sentence.cached_translation;
            if (state.autoTranslate) {
                translationDisplay.style.display = 'block';
            }
        }
    }
    
    // Update favorite button state
    if (favoriteBtn) {
        if (state.bookmarks.some(b => b.id === sentence.id)) {
            favoriteBtn.classList.add('active');
        } else {
            favoriteBtn.classList.remove('active');
        }
    }
    
    // Pre-load adjacent sentences
    preloadAdjacentSentences();
    
    // Add click handlers for word lookup
    addWordClickHandlers();
}

function preloadAdjacentSentences() {
    // Pre-load next sentence translation if not already loaded
    if (state.currentSentenceIndex < state.sentences.length - 1) {
        const nextSentence = state.sentences[state.currentSentenceIndex + 1];
        if (!nextSentence.cached_translation && !nextSentence.user_translation) {
            translateCurrentSentence(nextSentence.original).then(translation => {
                state.sentences[state.currentSentenceIndex + 1].cached_translation = translation;
            });
        }
    }
    
    // Pre-load previous sentence translation if not already loaded
    if (state.currentSentenceIndex > 0) {
        const prevSentence = state.sentences[state.currentSentenceIndex - 1];
        if (!prevSentence.cached_translation && !prevSentence.user_translation) {
            translateCurrentSentence(prevSentence.original).then(translation => {
                state.sentences[state.currentSentenceIndex - 1].cached_translation = translation;
            });
        }
    }
}

function addWordClickHandlers() {
    const sentenceDisplay = document.getElementById('sentence-display');
    if (!sentenceDisplay) return;
    
    // Clear previous click handlers
    sentenceDisplay.onclick = null;
    
    // Add new click handler for word lookup
    sentenceDisplay.onclick = (e) => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText.length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            showWordTooltip(selectedText, rect.left, rect.top - 30);
        }
    };
}

function showWordTooltip(word, x, y) {
    const wordTooltip = document.getElementById('word-tooltip');
    if (!wordTooltip) return;
    
    // Check cache first
    if (state.wordLookupCache[word]) {
        displayTooltip(state.wordLookupCache[word], x, y);
        return;
    }
    
    // Try to find the word in vocabulary
    const transaction = db.transaction([STORE_VOCAB], 'readonly');
    const store = transaction.objectStore(STORE_VOCAB);
    const index = store.index('word');
    const request = index.getAll(IDBKeyRange.only(word));
    
    request.onsuccess = () => {
        const vocabWords = request.result || [];
        const matchingWord = vocabWords.find(w => w.language === state.sourceLanguage);
        
        if (matchingWord) {
            state.wordLookupCache[word] = matchingWord.translation;
            displayTooltip(matchingWord.translation, x, y);
        } else {
            // If not found in vocabulary, try dictionary API
            lookupWordInDictionary(word, state.sourceLanguage).then(translation => {
                if (translation) {
                    state.wordLookupCache[word] = translation;
                    displayTooltip(translation, x, y);
                } else {
                    displayTooltip('No translation found', x, y);
                }
            });
        }
    };
}

function displayTooltip(text, x, y) {
    const wordTooltip = document.getElementById('word-tooltip');
    if (!wordTooltip) return;
    
    wordTooltip.textContent = text;
    wordTooltip.style.left = `${x}px`;
    wordTooltip.style.top = `${y}px`;
    wordTooltip.classList.add('show');
    
    setTimeout(() => {
        wordTooltip.classList.remove('show');
    }, 2000);
}

function translateCurrentSentence() {
    const translationDisplay = document.getElementById('translation-display');
    if (!translationDisplay || state.sentences.length === 0) return;
    
    const sentence = state.sentences[state.currentSentenceIndex].original;
    translationDisplay.style.display = 'block';
    translationDisplay.textContent = "Translating...";
    
    translateText(sentence, state.sourceLanguage, state.targetLanguage)
        .then(translation => {
            translationDisplay.textContent = translation;
            state.sentences[state.currentSentenceIndex].cached_translation = translation;
            
            // Add copy button if it doesn't exist
            if (!document.getElementById('copy-translation-btn')) {
                const copyBtn = document.createElement('button');
                copyBtn.id = 'copy-translation-btn';
                copyBtn.className = 'copy-translation';
                copyBtn.textContent = 'Copy';
                copyBtn.setAttribute('aria-label', 'Copy translation');
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(translation);
                    showToast('Translation copied!', 'success');
                });
                translationDisplay.appendChild(copyBtn);
            }
        })
        .catch(error => {
            console.error('Translation error:', error);
            translationDisplay.textContent = "Translation unavailable";
        });
}

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = 'toast';
    
    if (type) toast.classList.add(type);
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function updateStatsDisplay() {
    // Update streak
    const today = new Date().toDateString();
    if (state.readingStats.lastActiveDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (state.readingStats.lastActiveDate === yesterday.toDateString()) {
            state.readingStats.streak++;
        } else if (state.readingStats.lastActiveDate !== today) {
            state.readingStats.streak = 0;
        }
        
        state.readingStats.lastActiveDate = today;
        state.readingStats.dailyWords = 0;
        state.readingStats.dailyTime = 0;
        localStorage.setItem('readingStats', JSON.stringify(state.readingStats));
    }
    
    // Update UI elements
    const streakCount = document.getElementById('streak-count');
    const wordsLearnedCount = document.getElementById('words-learned-count');
    const timeSpentCount = document.getElementById('time-spent-count');
    const dailyStreak = document.getElementById('daily-streak');
    const dailyWordsLearned = document.getElementById('daily-words-learned');
    const dailyTimeSpent = document.getElementById('daily-time-spent');
    
    if (streakCount) streakCount.textContent = state.readingStats.streak;
    if (wordsLearnedCount) wordsLearnedCount.textContent = state.readingStats.wordsLearned;
    if (timeSpentCount) timeSpentCount.textContent = `${Math.floor(state.readingStats.timeSpent / 60)} min`;
    if (dailyStreak) dailyStreak.textContent = state.readingStats.streak;
    if (dailyWordsLearned) dailyWordsLearned.textContent = state.readingStats.dailyWords;
    if (dailyTimeSpent) dailyTimeSpent.textContent = `${Math.floor(state.readingStats.dailyTime / 60)} min`;
    
    // Streak reminder
    if (state.readingStats.streak > 3 && state.readingStats.lastActiveDate !== new Date().toDateString()) {
        showToast(`🔥 Don't break your ${state.readingStats.streak}-day streak!`, 'warning');
    }
}

// ==============================================
// Vocabulary Review Functions
// ==============================================

async function startReview(bucket) {
    state.reviewMode = bucket;
    state.reviewWords = await getVocabByBucket(bucket);
    
    if (state.reviewWords.length === 0) {
        showToast('No words to review in this category!', 'error');
        return;
    }
    
    state.reviewWords = shuffleArray(state.reviewWords);
    state.currentReviewIndex = 0;
    state.reviewStats = { correct: 0, incorrect: 0 };
    state.currentHardStreak = 0;
    
    showView('review-mode-view');
    
    if (bucket === 'hard') {
        setupHardMode();
    } else {
        setupMatchingGame();
    }
}

function setupMatchingGame() {
    const header = document.querySelector('header');
    const hideHeaderBtn = document.getElementById('hide-header-btn');
    const leftColumn = document.getElementById('left-column');
    const rightColumn = document.getElementById('right-column');
    const matchingGameContainer = document.getElementById('matching-game-container');
    const hardModeContainer = document.getElementById('hard-mode-container');
    
    if (!leftColumn || !rightColumn || !matchingGameContainer || !hardModeContainer) return;
    
    // Hide header when matching game starts
    if (header) header.classList.add('hidden');
    if (hideHeaderBtn) {
        hideHeaderBtn.classList.add('visible');
        hideHeaderBtn.textContent = '↓';
    }
    
    // Clear previous cards
    leftColumn.innerHTML = '';
    rightColumn.innerHTML = '';
    
    // Get words for this round (max 5)
    const wordsToShow = state.reviewWords.slice(state.currentReviewIndex, state.currentReviewIndex + 5);
    state.currentRoundWords = wordsToShow;
    
    // Show matching game container
    matchingGameContainer.style.display = 'flex';
    hardModeContainer.style.display = 'none';
    
    if (wordsToShow.length === 0) {
        showToast('No words to review!', 'error');
        return;
    }
    
    if (state.reviewMode === 'new' || state.reviewMode === 'easy') {
        // Target language cards on left (translations)
        const translationCards = shuffleArray([...wordsToShow]).map(word => ({
            id: word.id,
            type: 'translation',
            text: word.translation,
            streak: word.streak || 0
        }));
        
        // Source language cards on right (words)
        const wordCards = shuffleArray([...wordsToShow]).map(word => ({
            id: word.id,
            type: 'word',
            text: word.word,
            streak: word.streak || 0
        }));
        
        // Add cards to columns
        translationCards.forEach(word => {
            const card = createWordCard(word);
            leftColumn.appendChild(card);
        });
        
        wordCards.forEach(word => {
            const card = createWordCard(word);
            rightColumn.appendChild(card);
        });
    } else { // medium mode
        // Source language cards on left (words)
        const wordCards = shuffleArray([...wordsToShow]).map(word => ({
            id: word.id,
            type: 'word',
            text: word.word,
            streak: word.streak || 0
        }));
        
        // Target language cards on right (translations)
        const translationCards = shuffleArray([...wordsToShow]).map(word => ({
            id: word.id,
            type: 'translation',
            text: word.translation,
            streak: word.streak || 0
        }));
        
        // Add cards to columns
        wordCards.forEach(word => {
            const card = createWordCard(word);
            leftColumn.appendChild(card);
        });
        
        translationCards.forEach(word => {
            const card = createWordCard(word);
            rightColumn.appendChild(card);
        });
    }
    
    // Update progress
    updateProgressDisplay();
}

function createWordCard(word) {
    const card = document.createElement('div');
    card.className = 'word-card';
    card.dataset.id = word.id;
    card.dataset.type = word.type;
    card.dataset.streak = word.streak || 0;
    
    // Create content container
    const content = document.createElement('div');
    content.style.flex = '1';
    content.style.display = 'flex';
    content.style.alignItems = 'center';
    content.style.justifyContent = 'center';
    content.style.width = '100%';
    content.style.padding = '10px';
    content.style.wordBreak = 'break-word';
    content.textContent = word.text;
    
    card.appendChild(content);
    
    // Add streak indicator
    const streakIndicator = document.createElement('div');
    streakIndicator.className = 'streak-indicator';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'streak-progress';
    progressBar.style.width = `${(word.streak || 0) * 33.33}%`;
    
    streakIndicator.appendChild(progressBar);
    card.appendChild(streakIndicator);
    
    card.addEventListener('click', function() {
        playSound('flip');
        
        // Speak the word if it's in the source language
        if (word.type === 'word') {
            const matchingWord = state.reviewWords.find(w => w.id === word.id);
            if (matchingWord) {
                speakText(matchingWord.word, state.sourceLanguage);
            }
        }
        
        selectCard(this, word.type);
    });
    
    return card;
}

// Track selected cards
let selectedLeftCard = null;
let selectedRightCard = null;

function selectCard(cardElement, cardType) {
    if (cardElement.classList.contains('correct')) return;
    if (cardElement.classList.contains('incorrect')) {
        cardElement.classList.remove('incorrect');
    }
    
    // Determine if card is in left or right column
    const isLeftColumn = cardElement.parentElement.id === 'left-column';
    
    if (isLeftColumn) {
        if (selectedLeftCard) selectedLeftCard.classList.remove('selected');
        selectedLeftCard = cardElement;
    } else {
        if (selectedRightCard) selectedRightCard.classList.remove('selected');
        selectedRightCard = cardElement;
    }
    
    cardElement.classList.add('selected');
    
    if (selectedLeftCard && selectedRightCard) {
        checkMatch(selectedLeftCard, selectedRightCard);
    }
}

function checkMatch(leftCard, rightCard) {
    const leftId = leftCard.dataset.id;
    const rightId = rightCard.dataset.id;
    
    if (leftId === rightId) {
        leftCard.classList.remove('selected');
        leftCard.classList.add('correct');
        rightCard.classList.remove('selected');
        rightCard.classList.add('correct');
        
        state.reviewStats.correct++;
        playSound('correct');
        
        // Find the matched word
        const matchedWord = state.currentRoundWords.find(w => w.id === leftId);
        const wordIndex = state.reviewWords.findIndex(w => w.id === leftId);
        
        if (matchedWord && wordIndex !== -1) {
            // Update streak count
            matchedWord.streak = (matchedWord.streak || 0) + 1;
            state.reviewWords[wordIndex].streak = matchedWord.streak;
            
            // Persist the streak to database
            updateVocabWord(state.reviewWords[wordIndex]).then(() => {
                // Update streak display
                leftCard.dataset.streak = matchedWord.streak;
                rightCard.dataset.streak = matchedWord.streak;
                
                const leftProgress = leftCard.querySelector('.streak-progress');
                const rightProgress = rightCard.querySelector('.streak-progress');
                if (leftProgress && rightProgress) {
                    leftProgress.style.width = `${matchedWord.streak * 33.33}%`;
                    rightProgress.style.width = `${matchedWord.streak * 33.33}%`;
                }
                
                // Show feedback
                const neededForNext = 3 - matchedWord.streak;
                if (neededForNext > 0) {
                    showToast(`Correct! Need ${neededForNext} more correct answers to move up`, 'success');
                } else {
                    showToast('Correct! Word will move to next bucket', 'success');
                    moveWordToNextBucket(matchedWord);
                }
            });
        }
        
        selectedLeftCard = null;
        selectedRightCard = null;
        
        // Check if all cards are matched
        checkRoundCompletion();
    } else {
        // Incorrect match
        leftCard.classList.remove('selected');
        leftCard.classList.add('incorrect');
        rightCard.classList.remove('selected');
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
}

function moveWordToNextBucket(word) {
    if (word.bucket === 'new') {
        word.bucket = 'easy';
    } else if (word.bucket === 'easy') {
        word.bucket = 'medium';
    } else if (word.bucket === 'medium') {
        word.bucket = 'hard';
    }
    
    // Reset streak after moving
    word.streak = 0;
    
    // Update in database
    updateVocabWord(word);
}

function checkRoundCompletion() {
    const allCards = document.querySelectorAll('.word-card');
    const matchedCards = document.querySelectorAll('.word-card.correct');
    
    if (matchedCards.length === allCards.length) {
        playSound('complete');
        
        // Move to next set of words
        state.currentReviewIndex += 5;
        if (state.currentReviewIndex < state.reviewWords.length) {
            setTimeout(() => {
                setupMatchingGame();
            }, 1500);
        } else {
            // Review complete
            setTimeout(() => {
                showView('vocab-review-view');
                updateBucketCounts();
            }, 1500);
        }
    }
}

function setupHardMode() {
    const matchingGameContainer = document.getElementById('matching-game-container');
    const hardModeContainer = document.getElementById('hard-mode-container');
    const reviewQuestion = document.getElementById('review-question');
    
    matchingGameContainer.style.display = 'none';
    hardModeContainer.style.display = 'flex';
    
    if (state.currentReviewIndex >= state.reviewWords.length) {
        reviewQuestion.textContent = "Review complete!";
        hardModeContainer.style.display = 'none';
        return;
    }
    
    state.currentHardWord = state.reviewWords[state.currentReviewIndex];
    
    // Create question with streak indicator
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
    
    reviewQuestion.innerHTML = '';
    reviewQuestion.appendChild(questionDiv);
    
    // Update progress
    const progressText = document.getElementById('progress-text');
    const progressFill = document.getElementById('progress-fill');
    if (progressText && progressFill) {
        progressText.textContent = `Word ${state.currentReviewIndex + 1}/${state.reviewWords.length}`;
        progressFill.style.width = `${((state.currentReviewIndex + 1) / state.reviewWords.length) * 100}%`;
    }
}

function handleHardModeResponse(knewIt) {
    if (!state.currentHardWord) return;
    
    const word = state.currentHardWord;
    
    if (knewIt) {
        // Increase streak
        word.streak = (word.streak || 0) + 1;
        state.currentHardStreak++;
        
        if (word.streak >= 3) {
            // Move to next bucket or retire
            if (word.bucket === 'hard') {
                // Retire the word (remove from vocabulary)
                const transaction = db.transaction([STORE_VOCAB], 'readwrite');
                const store = transaction.objectStore(STORE_VOCAB);
                store.delete(word.id);
                
                showToast('Word retired!', 'success');
            } else {
                // Move to next bucket
                word.bucket = getNextBucket(word.bucket);
                word.streak = 0; // Reset streak after moving
                updateVocabWord(word);
                showToast('Word moved to next bucket!', 'success');
            }
        } else {
            // Just update streak
            updateVocabWord(word);
            showToast('Correct! Keep going!', 'success');
        }
    } else {
        // Incorrect answer - move back to new words
        word.streak = 0;
        word.bucket = 'new';
        updateVocabWord(word);
        showToast('Word moved back to new words', 'error');
    }
    
    // Move to next word
    state.currentReviewIndex++;
    if (state.currentReviewIndex < state.reviewWords.length) {
        setupHardMode();
    } else {
        // Review complete
        showView('vocab-review-view');
        updateBucketCounts();
    }
}

function getNextBucket(currentBucket) {
    const bucketOrder = ['new', 'easy', 'medium', 'hard'];
    const currentIndex = bucketOrder.indexOf(currentBucket);
    return bucketOrder[Math.min(currentIndex + 1, bucketOrder.length - 1)];
}

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

// Language configuration
const LANGUAGES = {
    ja: {
        name: 'Japanese',
        code: 'ja',
        direction: 'ltr',
        ttsLang: 'ja-JP',
        sentenceEndings: /[。！？\n]/,
        resources: [
            { name: 'NHK Easy News', url: 'https://www3.nhk.or.jp/news/easy/' },
            { name: 'Yahoo Japan News', url: 'https://news.yahoo.co.jp/' }
        ]
    },
    en: {
        name: 'English',
        code: 'en',
        direction: 'ltr',
        ttsLang: 'en-US',
        sentenceEndings: /[.!?\n]/,
        resources: [
            { name: 'Tatoeba Sentences', url: 'https://tatoeba.org/en' }
        ]
    }
    // Add more languages as needed
};

// Core application state
const state = {
    currentView: 'text-import',
    translatedText: '',
    sentences: [],
    currentSentenceIndex: 0,
    vocabWords: [],
    reviewMode: null,
    reviewWords: [],
    currentReviewIndex: 0,
    reviewStats: {
        correct: 0,
        incorrect: 0
    },
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
    sourceLanguage: 'en', // Default source language for translation
    targetLanguage: 'ja', // Default target language
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

// Database configuration
const DB_NAME = 'LanguageLearnerDB';
const DB_VERSION = 3; // Updated version for language support
const STORE_SENTENCES = 'sentences';
const STORE_VOCAB = 'vocabulary';
const STORE_TRANSLATIONS = 'translations';
const STORE_SETTINGS = 'settings';

let db;

// Initialize IndexedDB
async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(STORE_SENTENCES)) {
                const sentencesStore = db.createObjectStore(STORE_SENTENCES, { keyPath: 'id' });
                sentencesStore.createIndex('position', 'position', { unique: true });
                sentencesStore.createIndex('language', 'language', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(STORE_VOCAB)) {
                const vocabStore = db.createObjectStore(STORE_VOCAB, { keyPath: 'id' });
                vocabStore.createIndex('bucket', 'bucket', { unique: false });
                vocabStore.createIndex('word', 'word', { unique: false }); // No longer unique for multiple languages
                vocabStore.createIndex('language', 'language', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(STORE_TRANSLATIONS)) {
                const translationsStore = db.createObjectStore(STORE_TRANSLATIONS, { keyPath: 'id' });
                translationsStore.createIndex('text', 'text', { unique: false });
                translationsStore.createIndex('languagePair', 'languagePair', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                db.createObjectStore(STORE_SETTINGS, { keyPath: 'name' });
            }
        };
        
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Database operations
async function addSentences(sentences, language) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES], 'readwrite');
        const store = transaction.objectStore(STORE_SENTENCES);
        
        store.clear().onsuccess = () => {
            sentences.forEach((sentence, index) => {
                sentence.position = index;
                sentence.language = language;
                store.add(sentence);
            });
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        };
    });
}

async function getAllSentences(language) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES], 'readonly');
        const store = transaction.objectStore(STORE_SENTENCES);
        const index = store.index('position');
        const request = index.getAll();
        
        request.onsuccess = () => {
            if (language) {
                resolve(request.result.filter(s => s.language === language));
            } else {
                resolve(request.result);
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

async function addVocabWord(word) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readwrite');
        const store = transaction.objectStore(STORE_VOCAB);
        
        // Check if word already exists for this language
        const wordIndex = store.index('word');
        const request = wordIndex.getAll(IDBKeyRange.only(word.word));
        
        request.onsuccess = () => {
            const existingWords = request.result;
            const alreadyExists = existingWords.some(w => 
                w.word === word.word && w.language === word.language);
            
            if (alreadyExists) {
                reject(new Error('Word already exists in vocabulary for this language'));
            } else {
                // Track new words added today
                const today = new Date().toDateString();
                if (state.lastWordAddedDate !== today) {
                    state.newWordsToday = 0;
                    state.lastWordAddedDate = today;
                }
                state.newWordsToday++;
                localStorage.setItem('newWordsToday', state.newWordsToday.toString());
                localStorage.setItem('lastWordAddedDate', state.lastWordAddedDate);
                
                // Update reading stats
                state.readingStats.wordsLearned++;
                state.readingStats.dailyWords++;
                localStorage.setItem('readingStats', JSON.stringify(state.readingStats));
                updateStatsDisplay();
                
                const addRequest = store.add(word);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = (event) => reject(event.target.error);
            }
        };
        
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getVocabByBucket(bucket, language) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readonly');
        const store = transaction.objectStore(STORE_VOCAB);
        const bucketIndex = store.index('bucket');
        const request = bucketIndex.getAll(IDBKeyRange.only(bucket));
        
        request.onsuccess = () => {
            if (language) {
                resolve(request.result.filter(w => w.language === language));
            } else {
                resolve(request.result);
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

// Language detection
function detectLanguage(text) {
    // Check for Japanese characters
    const japaneseChars = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/;
    if (japaneseChars.test(text)) return 'ja';
    
    // Check for English (basic check)
    const englishChars = /^[a-zA-Z0-9\s.,!?'"-]+$/;
    if (englishChars.test(text)) return 'en';
    
    // Default to English if unknown
    return 'en';
}

// Text processing
function splitSentences(text, language) {
    const langConfig = LANGUAGES[language] || LANGUAGES.en;
    const sentenceEndings = langConfig.sentenceEndings;
    
    const roughSentences = text.split(new RegExp(`(?<=${sentenceEndings.source})`));
    const sentences = [];
    
    roughSentences.forEach(roughSentence => {
        const trimmed = roughSentence.trim();
        if (trimmed.length === 0) return;
        
        // Handle cases where multiple sentence endings might be in one "rough" sentence
        if (new RegExp(sentenceEndings).test(trimmed)) {
            const subSentences = trimmed.split(new RegExp(`(?<=${sentenceEndings.source})`));
            subSentences.forEach(sub => {
                const subTrimmed = sub.trim();
                if (subTrimmed.length > 0) sentences.push(subTrimmed);
            });
        } else {
            sentences.push(trimmed);
        }
    });
    
    return sentences;
}

// Translation functions
async function translateText(text, sourceLang, targetLang) {
    try {
        // Check cache first
        const cached = await getCachedTranslation(text, sourceLang, targetLang);
        if (cached) return cached;
        
        if (!state.isOnline) {
            throw new Error('Offline - translation not available');
        }
        
        // Use translation API
        const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`
        );
        
        if (!response.ok) throw new Error('Translation failed');
        
        const data = await response.json();
        if (data.responseData && data.responseData.translatedText) {
            const translatedText = data.responseData.translatedText;
            await cacheTranslation(text, sourceLang, targetLang, translatedText);
            return translatedText;
        } else {
            throw new Error('No translation found');
        }
    } catch (error) {
        console.error('Translation error:', error);
        return "Translation failed. Please try again.";
    }
}

async function getCachedTranslation(text, sourceLang, targetLang) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_TRANSLATIONS], 'readonly');
        const store = transaction.objectStore(STORE_TRANSLATIONS);
        const index = store.index('languagePair');
        const request = index.get(`${sourceLang}|${targetLang}|${text}`);
        
        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result.translatedText);
            } else {
                resolve(null);
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
}

async function cacheTranslation(text, sourceLang, targetLang, translatedText) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_TRANSLATIONS], 'readwrite');
        const store = transaction.objectStore(STORE_TRANSLATIONS);
        
        const translation = {
            id: generateUUID(),
            text: text,
            translatedText: translatedText,
            languagePair: `${sourceLang}|${targetLang}|${text}`,
            timestamp: new Date().getTime()
        };
        
        const request = store.add(translation);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

// UI Management
function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.add('active');
        state.currentView = viewId.replace('-view', '');
        
        // Start/end reading session tracking
        if (viewId === 'reading-view') {
            startReadingSession();
        } else {
            endReadingSession();
        }
        
        // Language-specific UI updates
        updateLanguageUI();
    }
}

function updateLanguageUI() {
    // Update UI elements based on current language settings
    const langSelectors = document.querySelectorAll('.lang-selector');
    langSelectors.forEach(selector => {
        if (selector.id === 'source-lang') {
            selector.value = state.sourceLanguage;
        } else if (selector.id === 'target-lang') {
            selector.value = state.targetLanguage;
        }
    });
    
    // Update placeholders and labels
    const textInput = document.getElementById('text-input');
    if (textInput) {
        textInput.placeholder = LANGUAGES[state.targetLanguage]?.inputPlaceholder || 'Enter text...';
    }
    
    // Update resource links
    updateResourceLinks();
}

function updateResourceLinks() {
    const resourcesContainer = document.querySelector('.resources-list');
    if (!resourcesContainer) return;
    
    resourcesContainer.innerHTML = '';
    const currentLang = state.targetLanguage;
    const langResources = LANGUAGES[currentLang]?.resources || [];
    
    langResources.forEach(resource => {
        const link = document.createElement('a');
        link.href = resource.url;
        link.className = 'resource-link';
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = resource.name;
        resourcesContainer.appendChild(link);
    });
}

// Initialization
async function initApp() {
    try {
        // Initialize database
        db = await openDatabase();
        
        // Load settings
        await loadSettings();
        
        // Initialize audio
        initAudio();
        
        // Set up event listeners
        setupEventListeners();
        
        // Apply theme and settings
        applySettings();
        
        // Check online status
        updateOnlineStatus();
        
        // Load any existing sentences
        state.sentences = await getAllSentences(state.targetLanguage);
        if (state.sentences.length > 0) {
            showView('reading-view');
        }
        
        // Update UI
        updateBucketCounts();
        updateLanguageUI();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize app', 'error');
    }
}

// Event listeners
function setupEventListeners() {
    // Language selection
    document.querySelectorAll('.lang-selector').forEach(selector => {
        selector.addEventListener('change', (e) => {
            if (selector.id === 'source-lang') {
                state.sourceLanguage = e.target.value;
            } else if (selector.id === 'target-lang') {
                state.targetLanguage = e.target.value;
            }
            localStorage.setItem('languageSettings', JSON.stringify({
                source: state.sourceLanguage,
                target: state.targetLanguage
            }));
            updateLanguageUI();
        });
    });
    
    // Add all other event listeners from the original code
    // (paste, voice input, navigation buttons, etc.)
    // ...
}

// Start the app
window.addEventListener('DOMContentLoaded', initApp);
