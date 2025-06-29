/**
 * General utility functions for JapLearner app
 * @module utilities
 */

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 * @param {Array} array - The array to shuffle
 * @returns {Array} The shuffled array (same reference)
 */
export function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

/**
 * Generates a RFC4122 compliant UUID v4
 * @returns {string} Generated UUID
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Shows a toast notification
 * @param {string} message - The message to display
 * @param {string} [type=''] - Type of toast ('success', 'error', etc.)
 * @param {number} [duration=3000] - How long to show the toast in ms
 */
export function showToast(message, type = '', duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast';
    
    if (type) {
        toast.classList.add(type);
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

/**
 * Simple language detection based on character ranges
 * @param {string} text - Text to analyze
 * @returns {string} Detected language code ('ja' or 'en')
 */
export function detectLanguage(text) {
    const japaneseChars = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/;
    return japaneseChars.test(text) ? 'ja' : 'en';
}

/**
 * Splits text into sentences using Japanese punctuation
 * @param {string} text - The text to split
 * @returns {string[]} Array of sentences
 */
export function splitSentences(text) {
    const roughSentences = text.split(/(?<=[。！？\n])/);
    const sentences = [];
    
    roughSentences.forEach(roughSentence => {
        const trimmed = roughSentence.trim();
        if (trimmed.length === 0) return;
        
        if (trimmed.includes('。') || trimmed.includes('！') || trimmed.includes('？')) {
            const subSentences = trimmed.split(/(?<=[。！？])/);
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

/**
 * Synchronizes scroll position between two columns
 * @param {Event} e - Scroll event
 */
export function syncScroll(e) {
    const scrolledColumn = e.target;
    const otherColumn = scrolledColumn === document.getElementById('left-column') 
        ? document.getElementById('right-column') 
        : document.getElementById('left-column');
    
    otherColumn.removeEventListener('scroll', syncScroll);
    otherColumn.scrollTop = scrolledColumn.scrollTop;
    setTimeout(() => {
        otherColumn.addEventListener('scroll', syncScroll);
    }, 10);
}

/**
 * Toggles header visibility in review mode
 */
export function toggleHeaderVisibility() {
    const header = document.querySelector('header');
    const hideHeaderBtn = document.getElementById('hide-header-btn');
    
    if (header.classList.contains('hidden')) {
        header.classList.remove('hidden');
        hideHeaderBtn.textContent = '↑';
    } else {
        header.classList.add('hidden');
        hideHeaderBtn.textContent = '↓';
    }
}

/**
 * Creates a word card DOM element for matching game
 * @param {Object} word - Word data object
 * @returns {HTMLElement} Created card element
 */
export function createWordCard(word) {
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
    
    card.appendChild(content);
    
    const streakIndicator = document.createElement('div');
    streakIndicator.className = 'streak-indicator';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'streak-progress';
    progressBar.style.width = `${(word.streak || 0) * 33.33}%`;
    
    streakIndicator.appendChild(progressBar);
    card.appendChild(streakIndicator);
    
    return card;
}

/**
 * Debounces a function to limit execution rate
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}
