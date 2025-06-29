/**
 * Main application module - Core state management and initialization
 */

// App state
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

// DOM Elements
const elements = {
    views: {
        textImport: document.getElementById('text-import-view'),
        reading: document.getElementById('reading-view'),
        vocabReview: document.getElementById('vocab-review-view'),
        reviewMode: document.getElementById('review-mode-view')
    },
    textInput: document.getElementById('text-input'),
    charCount: document.getElementById('char-count'),
    processTextBtn: document.getElementById('process-text'),
    clearTextBtn: document.getElementById('clear-text'),
    sentenceDisplay: document.getElementById('sentence-display'),
    prevSentenceBtn: document.getElementById('prev-sentence'),
    nextSentenceBtn: document.getElementById('next-sentence'),
    ttsButton: document.getElementById('tts-button'),
    wordSelectionBox: document.getElementById('word-selection-box'),
    selectedWord: document.getElementById('selected-word'),
    vocabTranslation: document.getElementById('vocab-translation'),
    addToVocabBtn: document.getElementById('add-to-vocab'),
    translationDisplay: document.getElementById('translation-display'),
    translateBtn: document.getElementById('translate-btn'),
    translationLang: document.getElementById('translation-lang'),
    bucketCounts: {
        new: document.getElementById('new-count'),
        easy: document.getElementById('easy-count'),
        medium: document.getElementById('medium-count'),
        hard: document.getElementById('hard-count')
    },
    startReviewBtn: document.getElementById('start-review'),
    reviewQuestion: document.getElementById('review-question'),
    exitReviewBtn: document.getElementById('exit-review'),
    toast: document.getElementById('toast'),
    themeToggle: document.getElementById('theme-toggle'),
    soundToggle: document.getElementById('sound-toggle'),
    matchingGameContainer: document.getElementById('matching-game-container'),
    leftColumn: document.getElementById('left-column'),
    rightColumn: document.getElementById('right-column'),
    hardModeContainer: document.getElementById('hard-mode-container'),
    knewItBtn: document.getElementById('knew-it-btn'),
    didntKnowBtn: document.getElementById('didnt-know-btn'),
    skipBtn: document.getElementById('skip-btn'),
    shuffleCardsBtn: document.getElementById('shuffle-cards'),
    voiceInputBtn: document.createElement('button'),
    offlineWarning: document.getElementById('offline-warning'),
    howToUseToggle: document.getElementById('how-to-use-toggle'),
    howToUseContent: document.getElementById('how-to-use-content'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsPanel: document.getElementById('settings-panel'),
    settingsOverlay: document.getElementById('settings-overlay'),
    closeSettings: document.getElementById('close-settings'),
    autoTranslateToggle: document.getElementById('auto-translate-toggle'),
    fontSelect: document.getElementById('font-select'),
    fontSizeRange: document.getElementById('font-size-range'),
    lineHeightRange: document.getElementById('line-height-range'),
    themeSelect: document.getElementById('theme-select'),
    streakCount: document.getElementById('streak-count'),
    wordsLearnedCount: document.getElementById('words-learned-count'),
    timeSpentCount: document.getElementById('time-spent-count'),
    viewProgressBtn: document.getElementById('view-progress-btn'),
    ttsSpeedControl: document.getElementById('tts-speed-control'),
    jumpInput: document.getElementById('jump-input'),
    jumpBtn: document.getElementById('jump-btn'),
    wordTooltip: document.getElementById('word-tooltip'),
    dailyStreak: document.getElementById('daily-streak'),
    dailyWordsLearned: document.getElementById('daily-words-learned'),
    dailyTimeSpent: document.getElementById('daily-time-spent')
};

/**
 * Initialize the main application
 */
async function initApp() {
    try {
        // Apply theme and settings
        document.documentElement.setAttribute('data-theme', state.theme);
        document.documentElement.setAttribute('data-font', state.currentFont);
        document.documentElement.style.setProperty('--font-size', `${state.currentFontSize}px`);
        document.documentElement.style.setProperty('--line-height', state.currentLineHeight);
        elements.themeToggle.textContent = state.theme === 'dark' ? '🌙' : '☀️';
        elements.themeSelect.value = state.theme;
        elements.fontSelect.value = state.currentFont;
        elements.fontSizeRange.value = state.currentFontSize;
        elements.lineHeightRange.value = state.currentLineHeight;

        // Set initial online status
        state.isOnline = navigator.onLine;
        elements.offlineWarning.style.display = state.isOnline ? 'none' : 'block';

        // Initialize settings panel
        initSettingsPanel();
        
        // Setup event listeners
        setupEventListeners();

        // Update stats display
        updateStatsDisplay();

        // Pre-warm TTS
        if ('speechSynthesis' in window) {
            speechSynthesis.getVoices();
        }

    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize app', 'error');
    }
}

/**
 * Initialize settings panel
 */
function initSettingsPanel() {
    // Set initial values
    elements.autoTranslateToggle.checked = state.autoTranslate;
    elements.fontSelect.value = state.currentFont;
    elements.fontSizeRange.value = state.currentFontSize;
    elements.lineHeightRange.value = state.currentLineHeight;
    elements.themeSelect.value = state.theme;
    
    // Update stats display
    updateStatsDisplay();

    // Set up event listeners
    elements.settingsBtn.addEventListener('click', () => {
        elements.settingsPanel.classList.add('open');
        elements.settingsOverlay.classList.add('open');
    });
    
    elements.closeSettings.addEventListener('click', () => {
        elements.settingsPanel.classList.remove('open');
        elements.settingsOverlay.classList.remove('open');
    });
    
    elements.settingsOverlay.addEventListener('click', () => {
        elements.settingsPanel.classList.remove('open');
        elements.settingsOverlay.classList.remove('open');
    });
    
    elements.autoTranslateToggle.addEventListener('change', (e) => {
        state.autoTranslate = e.target.checked;
        localStorage.setItem('autoTranslate', state.autoTranslate);
        if (state.autoTranslate && state.currentView === 'reading-view' && state.sentences.length > 0) {
            translateCurrentSentence();
        }
    });
    
    elements.fontSelect.addEventListener('change', (e) => {
        state.currentFont = e.target.value;
        localStorage.setItem('font', state.currentFont);
        document.documentElement.setAttribute('data-font', state.currentFont);
    });
    
    elements.fontSizeRange.addEventListener('input', (e) => {
        state.currentFontSize = e.target.value;
        localStorage.setItem('fontSize', state.currentFontSize);
        document.documentElement.style.setProperty('--font-size', `${state.currentFontSize}px`);
    });
    
    elements.lineHeightRange.addEventListener('input', (e) => {
        state.currentLineHeight = e.target.value;
        localStorage.setItem('lineHeight', state.currentLineHeight);
        document.documentElement.style.setProperty('--line-height', state.currentLineHeight);
    });
    
    elements.themeSelect.addEventListener('change', (e) => {
        state.theme = e.target.value;
        localStorage.setItem('theme', state.theme);
        document.documentElement.setAttribute('data-theme', state.theme);
        elements.themeToggle.textContent = state.theme === 'dark' ? '🌙' : '☀️';
    });
}

/**
 * Update stats display
 */
function updateStatsDisplay() {
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
    
    elements.streakCount.textContent = state.readingStats.streak;
    elements.wordsLearnedCount.textContent = state.readingStats.wordsLearned;
    elements.timeSpentCount.textContent = `${Math.floor(state.readingStats.timeSpent / 60)} min`;
    elements.dailyStreak.textContent = state.readingStats.streak;
    elements.dailyWordsLearned.textContent = state.readingStats.dailyWords;
    elements.dailyTimeSpent.textContent = `${Math.floor(state.readingStats.dailyTime / 60)} min`;
}

/**
 * Show toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, error, etc.)
 */
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast';
    
    if (type) {
        toast.classList.add(type);
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Show a specific view
 * @param {string} viewId - The ID of the view to show
 */
function showView(viewId) {
    Object.values(elements.views).forEach(view => {
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

/**
 * Start tracking reading session time
 */
function startReadingSession() {
    if (!state.currentSessionStart) {
        state.currentSessionStart = new Date();
    }
}

/**
 * End tracking reading session time and update stats
 */
function endReadingSession() {
    if (state.currentSessionStart) {
        const now = new Date();
        const timeSpent = (now - state.currentSessionStart) / 1000;
        state.readingStats.timeSpent += timeSpent;
        state.readingStats.dailyTime += timeSpent;
        state.currentSessionStart = null;
        localStorage.setItem('readingStats', JSON.stringify(state.readingStats));
        updateStatsDisplay();
    }
}

// Initialize the app when DOM is loaded
window.addEventListener('DOMContentLoaded', initApp);
