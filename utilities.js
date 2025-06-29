/**
 * General utility functions for Japanese Learning App
 * @module utilities
 */

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 * @param {Array} array - The array to shuffle
 * @returns {Array} The shuffled array (original array is modified)
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
 * Generates a v4 UUID
 * @returns {string} A random UUID
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
 * @param {HTMLElement} [toastElement] - Optional toast element
 */
export function showToast(message, type = '', toastElement) {
    if (!toastElement) {
        toastElement = document.getElementById('toast');
        if (!toastElement) return;
    }

    toastElement.textContent = message;
    toastElement.className = 'toast';
    
    if (type) {
        toastElement.classList.add(type);
    }
    
    toastElement.classList.add('show');
    
    setTimeout(() => {
        toastElement.classList.remove('show');
    }, 3000);
}

/**
 * Detects if text contains Japanese characters
 * @param {string} text - The text to analyze
 * @returns {string} 'ja' if Japanese detected, 'en' otherwise
 */
export function detectLanguage(text) {
    const japaneseChars = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/;
    return japaneseChars.test(text) ? 'ja' : 'en';
}

/**
 * Splits text into Japanese sentences
 * @param {string} text - The text to split
 * @returns {Array<string>} Array of sentences
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
 * Creates a DOM element for a vocabulary card
 * @param {Object} word - Word data object
 * @param {string} word.id - Word ID
 * @param {string} word.type - 'english' or 'japanese'
 * @param {string} word.text - The word text
 * @param {number} word.streak - Current streak count
 * @returns {HTMLElement} The created card element
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
 * Synchronizes scroll between two elements
 * @param {HTMLElement} element1 - First element
 * @param {HTMLElement} element2 - Second element
 */
export function setupScrollSync(element1, element2) {
    const syncScroll = (e) => {
        const scrolledColumn = e.target;
        const otherColumn = scrolledColumn === element1 ? element2 : element1;
        
        otherColumn.removeEventListener('scroll', syncScroll);
        otherColumn.scrollTop = scrolledColumn.scrollTop;
        setTimeout(() => {
            otherColumn.addEventListener('scroll', syncScroll);
        }, 10);
    };

    element1.addEventListener('scroll', syncScroll);
    element2.addEventListener('scroll', syncScroll);
}

/**
 * Debounces a function to limit execution rate
 * @param {Function} func - The function to debounce
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
