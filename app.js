// Add at top of file:
let scrollListeners = new WeakMap();

function cleanupScrollListeners() {
    // WeakMap automatically cleans up when elements are removed
    scrollListeners = new WeakMap();
}

function addScrollListener(element, handler) {
    if (!scrollListeners.has(element)) {
        scrollListeners.set(element, handler);
        element.addEventListener('scroll', handler);
    }
}
// RSS Feed functionality
document.querySelectorAll('.rss-feed').forEach(feed => {
    feed.addEventListener('click', (e) => {
        // Only handle RSS if the element has a data-url attribute
        if (feed.hasAttribute('data-url')) {
            e.preventDefault();
            loadRSSFeed(feed);
        }
        // Special case for NHK News link
        else if (feed.href.includes('nhk.or.jp')) {
            e.preventDefault();
            const nhkFeed = document.createElement('div');
            nhkFeed.setAttribute('data-url', 'https://www3.nhk.or.jp/rss/news/cat0.xml');
            nhkFeed.setAttribute('data-name', 'NHK News');
            loadRSSFeed(nhkFeed);
        }
        // Otherwise it's a direct link and will navigate normally
    });
});

document.getElementById('close-rss-results').addEventListener('click', () => {
    document.getElementById('rss-results-container').style.display = 'none';
});




async function loadRSSFeed(feedElement) {
    if (!feedElement || !feedElement.hasAttribute('data-url')) return;
    
    const feedUrl = feedElement.getAttribute('data-url');
    const feedName = feedElement.getAttribute('data-name');
    
    try {
        // Show loading state
        const spinner = feedElement.querySelector('.loading-spinner');
        if (spinner) spinner.style.display = 'inline-block';
        if (feedElement.style) feedElement.style.opacity = '0.7';
        
        document.getElementById('rss-feed-name').textContent = `(${feedName})`;
        document.getElementById('rss-results-list').innerHTML = '';
        document.getElementById('rss-results-container').style.display = 'block';
        
        // Try multiple CORS proxies if first one fails
const proxyUrls = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://proxy.cors.sh/?'
];
        
        let xmlText = '';
        let lastError = null;
        
    // Modified proxy handling
    for (const proxyUrl of proxyUrls) {
        try {
            const proxyToUse = proxyUrl.includes('?') 
                ? `${proxyUrl}${encodeURIComponent(feedUrl)}`
                : `${proxyUrl}${encodeURIComponent(feedUrl)}`;
                
            const response = await fetch(proxyToUse, {
                headers: proxyUrl.includes('cors.sh') ? {
                    'x-cors-api-key': 'temp_0a3b1c2d3e4f5g6h7i8j9k0l1m2n3o4p'
                } : {}
            });
            
            if (!response.ok) throw new Error(`Proxy ${proxyUrl} returned status ${response.status}`);
            
            xmlText = await response.text();
            if (xmlText) break; // Success - exit loop
        } catch (error) {
            lastError = error;
            console.log(`Proxy ${proxyUrl} failed, trying next`);
            continue;
        }
    }
        
        if (!xmlText) {
            throw lastError || new Error('All proxy attempts failed');
        }
        
        // Parse the XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
// Extract articles and convert to array
const items = Array.from(xmlDoc.querySelectorAll('item'));
if (items.length === 0) throw new Error('No articles found in feed');

// Sort items by date (newest first)
items.sort((a, b) => {
    const dateA = new Date(a.querySelector('pubDate')?.textContent || 
                 a.querySelector('date')?.textContent || 0);
    const dateB = new Date(b.querySelector('pubDate')?.textContent || 
                 b.querySelector('date')?.textContent || 0);
    return dateB - dateA;
});

// Display articles
const resultsList = document.getElementById('rss-results-list');
resultsList.innerHTML = '';

items.slice(0, 10).forEach((item) => {  // Still limit to 10 articles
            
            const title = item.querySelector('title')?.textContent || 'No title';
            let description = item.querySelector('description')?.textContent || '';
            
            // Clean up description (remove HTML tags)
            description = description.replace(/<[^>]*>/g, '');
            
            const link = item.querySelector('link')?.textContent || '#';
            
            const articleDiv = document.createElement('div');
            articleDiv.className = 'resource-link';
            articleDiv.style.alignItems = 'flex-start';
            articleDiv.style.flexDirection = 'column';
            articleDiv.style.padding = '1rem';
            articleDiv.style.marginBottom = '0.5rem';
            
     // Try to extract date from the item (different RSS feeds have different date formats)
let pubDate = '';
if (item.querySelector('pubDate')) {
    pubDate = item.querySelector('pubDate').textContent;
} else if (item.querySelector('date')) {
    pubDate = item.querySelector('date').textContent;
} else if (item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'date').length > 0) {
    pubDate = item.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'date')[0].textContent;
}

// Format the date if found
let formattedDate = '';
if (pubDate) {
    try {
        const dateObj = new Date(pubDate);
        formattedDate = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    } catch (e) {
        console.log('Could not parse date:', pubDate);
    }
}

articleDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem;">
        <div style="font-weight: bold;">${title}</div>
        ${formattedDate ? `<div style="font-size: 0.8rem; color: var(--text-secondary);">${formattedDate}</div>` : ''}
    </div>
    <div style="color: var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.9rem;">
        ${description.substring(0, 150)}${description.length > 150 ? '...' : ''}
    </div>
    <div style="display: flex; gap: 0.5rem;">
        <button class="btn import-article-btn" 
                style="padding: 0.3rem 0.6rem; font-size: 0.8rem;"
                data-title="${escapeHtml(title)}" 
                data-content="${escapeHtml(description)}">
            Import Text
        </button>
        <a href="${link}" class="btn" 
           style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background-color: var(--accent);"
           target="_blank" rel="noopener">
            Read Full Article
        </a>
    </div>
`;
            
            resultsList.appendChild(articleDiv);
        });
        
        // Add event listeners to import buttons
        document.querySelectorAll('.import-article-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const title = e.target.getAttribute('data-title');
                const content = e.target.getAttribute('data-content');
                
                document.getElementById('text-input').value = `${title}\n\n${content}`;
                document.getElementById('char-count').textContent = `${title}\n\n${content}`.length;
                document.getElementById('rss-results-container').style.display = 'none';
                
                showToast('Article imported! Click "Process Text" to continue.', 'success');
                document.getElementById('text-input').scrollIntoView({ behavior: 'smooth' });
            });
        });
        
    } catch (error) {
        console.error('Error loading RSS feed:', error);
        showToast(`Failed to load ${feedName}. Please try again later.`, 'error');
        document.getElementById('rss-results-list').innerHTML = `
            <div style="padding: 1rem; color: var(--text-secondary); text-align: center;">
                Could not load articles. Please try again later.
            </div>
        `;
    } finally {
        if (feedElement) {
            const spinner = feedElement.querySelector('.loading-spinner');
            if (spinner) spinner.style.display = 'none';
            if (feedElement.style) feedElement.style.opacity = '1';
        }
    }
}
// Remove fetchWithFallback and fetchWithProxy and use this single function:
async function fetchWithProxy(url, options = {}) {
    const proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://proxy.cors.sh/?',
        'https://corsproxy.io/?'
    ];
    
    for (const proxy of proxies) {
        try {
            const proxyUrl = proxy.includes('?') 
                ? `${proxy}${encodeURIComponent(url)}`
                : `${proxy}${encodeURIComponent(url)}`;
                
            const response = await fetch(proxyUrl, {
                ...options,
                headers: proxy.includes('cors.sh') ? {
                    'x-cors-api-key': 'temp_0a3b1c2d3e4f5g6h7i8j9k0l1m2n3o4p',
                    ...options.headers
                } : options.headers
            });
            
            if (!response.ok) continue;
            return await response.text();
        } catch (e) {
            console.log(`Proxy ${proxy} failed, trying next`);
            continue;
        }
    }
    throw new Error('All proxy attempts failed');
}
async function tryFetchMethods(url) {
    // First try direct fetch
    try {
        const result = await tryDirectFetch(url);
        if (result) return result;
    } catch (e) {
        console.log('Direct fetch failed:', e);
    }
    
    // Then try with proxy
    try {
        const result = await fetchWithProxy(url);
        if (result) return result;
    } catch (e) {
        console.log('Proxy fetch failed:', e);
    }
    
    return null;
}

async function tryDirectFetch(url) {
    // Try direct fetch first with no-cors mode
    try {
        const response = await fetch(url, {
            mode: 'no-cors',
            headers: {
                'Accept': 'application/xml'
            }
        });
        if (!response.ok) throw new Error('Direct fetch failed');
        return await response.text();
    } catch (error) {
        console.log('Direct fetch failed, trying other methods');
        throw error;
    }
}

async function tryCorsProxy(url) {
    // Try CORS Anywhere proxy with updated URL
    const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('CORS proxy fetch failed');
        const data = await response.json();
        return data.contents;
    } catch (error) {
        console.log('CORS proxy failed, trying next method');
        throw error;
    }
}

async function tryAllOriginsProxy(url) {
    // Try AllOrigins proxy as fallback
    const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('AllOrigins proxy fetch failed');
    const data = await response.json();
    return data.contents;
}

function escapeHtml(text) {
    // Helper function to escape HTML for safe attribute insertion
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function cleanJapaneseText(text) {

    text = text.replace(/\([^)]*\)/g, '');
    // Remove any remaining extra spaces
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}
async function importUrlContent(url) {
    try {
        showToast('Fetching content...', 'info');
        
        // Use a proxy to avoid CORS issues
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error('Failed to fetch content');
        
        let html = await response.text();
        
        // Create a temporary DOM element to parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Remove script and style elements
        const scripts = doc.querySelectorAll('script, style, noscript, iframe, img');
        scripts.forEach(el => el.remove());
        
        // Get text content from main content areas
        let text = '';
        const contentSelectors = ['article', 'main', '.post-content', '.entry-content', 'body'];
        
        for (const selector of contentSelectors) {
            const element = doc.querySelector(selector);
            if (element) {
                text = element.textContent;
                break;
            }
        }
        
        // Fallback to body if no specific content found
        if (!text) {
            text = doc.body.textContent;
        }
        
        // Clean up the text
        text = text.replace(/\s+/g, ' ').trim();
        
        if (!text) throw new Error('No text content found');
        
        // Put the text in the input field and scroll to it
        const textInput = document.getElementById('text-input');
        textInput.value = text;
        document.getElementById('char-count').textContent = text.length;
        textInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        textInput.focus();
        
        // Switch to import view but don't process automatically
        showView('text-import-view');
        showToast('Content loaded! Review and click "Process Text" to continue', 'success');
        
    } catch (error) {
        console.error('Import error:', error);
        showToast('Failed to import: ' + error.message, 'error');
    }
}
async function getFeedWithFallback(url, feedName) {
    try {
        // First try with CORS proxy
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error('Failed to fetch feed');
        
        return await response.text();
    } catch (error) {
        console.log(`Primary feed ${feedName} failed, trying alternatives...`);
        
        // Define alternative URLs for each feed
        const alternatives = {
            'NHK Easy News': [
                'https://www.nhk.or.jp/r-news/rss.html',
                'https://www3.nhk.or.jp/rss/news/cat0.xml'
            ],
            'NHK News': [
                'https://www3.nhk.or.jp/rss/news/cat0.xml',
                'https://www.nhk.or.jp/r-news/rss.html'
            ],
            'Asahi Shimbun': [
                'https://www.asahi.com/rss/asahi/newsheadlines.rdf',
                'https://www.asahi.com/rss/'
            ],
            'Yahoo Japan News': [
                'https://news.yahoo.co.jp/rss/topics/top-picks.xml',
                'https://news.yahoo.co.jp/rss/topics/domestic.xml'
            ],
            'BBC Japan': [
                'https://www.bbc.com/japanese/index.xml',
                'https://feeds.bbci.co.uk/japanese/rss.xml'
            ]
        };

       // Try alternatives with CORS proxy
        for (const altUrl of alternatives[feedName] || []) {
            try {
                if (altUrl !== url) { // Don't retry the same URL
                    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(altUrl);
                    const response = await fetch(proxyUrl);
                    
                    if (response.ok) {
                        return await response.text();
                    }
                }
            } catch (e) {
                console.log(`Alternative ${feedName} URL failed:`, altUrl, e);
            }
        }
        
        throw new Error(`All ${feedName} feed attempts failed`);
    }
}
// App state
const state = {
 wordLookupCache: {},
    maxCacheSize: 100,
hasProcessedText: false,
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
    theme: localStorage.getItem('theme_ja') || 'dark',
    soundsEnabled: localStorage.getItem('soundsEnabled_ja') !== 'false',
    audioContext: null,
    sounds: {},
    currentHardWord: null,
    currentHardStreak: 0,
    textHistory: [],
    isOnline: navigator.onLine,
    debounceTimer: null,
    uiLanguage: localStorage.getItem('uiLanguage_ja') || 'en',
    newWordsToday: parseInt(localStorage.getItem('newWordsToday_ja')) || 0,
    lastWordAddedDate: localStorage.getItem('lastWordAddedDate_ja') || '',
languageUsage: JSON.parse(localStorage.getItem('languageUsage')) || {},


    currentFont: localStorage.getItem('font_ja') || 'system',
    currentFontSize: parseInt(localStorage.getItem('fontSize_ja')) || 16,
    currentLineHeight: parseFloat(localStorage.getItem('lineHeight_ja')) || 1.6,
    autoTranslate: localStorage.getItem('autoTranslate_ja') === 'true',

readingStats: JSON.parse(localStorage.getItem('readingStats_ja')) || {
    streak: 0,
    lastActiveDate: '',
    wordsLearned: 0,
    timeSpent: 0,
    dailyWords: 0,
    dailyTime: 0,
    dailySentences: 0  // <-- Add this line
},
currentSessionStart: null,
selectedCards: [],
currentTtsUtterance: null,
bookmarks: JSON.parse(localStorage.getItem('bookmarks_ja')) || [],
lastSentencePosition: JSON.parse(localStorage.getItem('lastSentencePosition_ja')) || 0,
    savedUrls: JSON.parse(localStorage.getItem('savedUrls_ja')) || [
        {id: '1', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-1.html', title: 'Chapter 1', date: new Date().toISOString()},
        {id: '2', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-2.html', title: 'Chapter 2', date: new Date().toISOString()},
        {id: '3', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-3.html', title: 'Chapter 3', date: new Date().toISOString()},
        {id: '4', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-4.html', title: 'Chapter 4', date: new Date().toISOString()},
        {id: '5', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-5.html', title: 'Chapter 5', date: new Date().toISOString()},
        {id: '6', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-6.html', title: 'Chapter 6', date: new Date().toISOString()},
        {id: '7', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-7.html', title: 'Chapter 7', date: new Date().toISOString()},
        {id: '8', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-8.html', title: 'Chapter 8', date: new Date().toISOString()},
        {id: '9', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-9.html', title: 'Chapter 9', date: new Date().toISOString()},
        {id: '10', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-10.html', title: 'Chapter 10', date: new Date().toISOString()},
        {id: '11', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-11.html', title: 'Chapter 11', date: new Date().toISOString()},
        {id: '12', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-12.html', title: 'Chapter 12', date: new Date().toISOString()},
        {id: '13', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-13.html', title: 'Chapter 13', date: new Date().toISOString()},
        {id: '14', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-14.html', title: 'Chapter 14', date: new Date().toISOString()},
        {id: '15', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-15.html', title: 'Chapter 15', date: new Date().toISOString()},
        {id: '16', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-16.html', title: 'Chapter 16', date: new Date().toISOString()},
        {id: '17', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-17.html', title: 'Chapter 17', date: new Date().toISOString()},
        {id: '18', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-18.html', title: 'Chapter 18', date: new Date().toISOString()},
        {id: '19', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-19.html', title: 'Chapter 19', date: new Date().toISOString()},
        {id: '20', url: 'https://aijapanesetext.blogspot.com/2025/06/chapter-20.html', title: 'Chapter 20', date: new Date().toISOString()}
    ]
};

// Initialize database when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        db = await openDatabase();
        updateVocabTabCounter();
    } catch (error) {
        console.error('Failed to initialize database:', error);
        
        // Fallback to localStorage if IndexedDB fails
        try {
            const backup = localStorage.getItem('vocab_backup');
            if (backup) {
                state.vocabWords = JSON.parse(backup);
                updateBucketCounts();
                showToast('Loaded vocabulary from backup', 'warning');
            }
        } catch (fallbackError) {
            console.error('Fallback failed:', fallbackError);
        }
    }
});

// Add this function
function createDailyBackup() {
    try {
        // Only backup once per day
        const today = new Date().toDateString();
        const lastBackupDate = localStorage.getItem('lastBackupDate');
        
        if (lastBackupDate !== today) {
            getAllVocabWords().then(words => {
                localStorage.setItem('vocab_backup', JSON.stringify(words));
                localStorage.setItem('lastBackupDate', today);
            });
        }
    } catch (error) {
        console.error('Backup failed:', error);
    }
}

// Call this in initApp
async function initApp() {
    // ... existing code ...
    createDailyBackup(); // Add this line
    // ... existing code ...
}

// Also add to addVocabWord after successful addition:
async function addVocabWord(word) {
    return new Promise((resolve, reject) => {
        try {
            if (!db) {
                throw new Error('Database not initialized');
            }
            
            const transaction = db.transaction([STORE_VOCAB], 'readwrite');
            const store = transaction.objectStore(STORE_VOCAB);
            const wordIndex = store.index('word');
            const request = wordIndex.get(word.word);
            
            request.onsuccess = () => {
                if (request.result) {
                    reject(new Error('Word already exists in vocabulary'));
                } else {
                    const addRequest = store.add(word);
                    addRequest.onsuccess = async () => {
                        // Add backup after successful addition
                        const words = await getAllVocabWords();
                        localStorage.setItem('vocab_backup', JSON.stringify(words));
                        resolve();
                    };
                    addRequest.onerror = (event) => reject(event.target.error);
                }
            };
            request.onerror = (event) => reject(event.target.error);
        } catch (error) {
            console.error('Add vocab word error:', error);
            reject(error);
        }
    });
}

// Initialize audio context and sounds
function initAudio() {
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Correct answer sound (Japanese "correct" bell)
        state.sounds.correct = () => {
            const osc = state.audioContext.createOscillator();
            const gain = state.audioContext.createGain();
            osc.type = 'triangle';
            osc.frequency.value = 880;
            gain.gain.value = 0.5;
            
            osc.connect(gain);
            gain.connect(state.audioContext.destination);
            
            osc.start();
            osc.frequency.exponentialRampToValueAtTime(1760, state.audioContext.currentTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 0.3);
            osc.stop(state.audioContext.currentTime + 0.3);
        };
        
        // Incorrect answer sound (Japanese "wrong" buzzer)
        state.sounds.incorrect = () => {
            const osc = state.audioContext.createOscillator();
            const gain = state.audioContext.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = 220;
            gain.gain.value = 0.5;
            
            osc.connect(gain);
            gain.connect(state.audioContext.destination);
            
            osc.start();
            osc.frequency.exponentialRampToValueAtTime(110, state.audioContext.currentTime + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 0.5);
            osc.stop(state.audioContext.currentTime + 0.5);
        };
        
        // Round complete sound (Japanese "congratulations" flourish)
        state.sounds.complete = () => {
            const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880];
            const gain = state.audioContext.createGain();
            gain.gain.value = 0.5;
            gain.connect(state.audioContext.destination);
            
            notes.forEach((freq, i) => {
                const osc = state.audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = freq;
                osc.connect(gain);
                
                osc.start(state.audioContext.currentTime + i * 0.1);
                osc.stop(state.audioContext.currentTime + i * 0.1 + 0.3);
            });
        };
        
        // Card flip sound
        state.sounds.flip = () => {
            const osc = state.audioContext.createOscillator();
            const gain = state.audioContext.createGain();
            osc.type = 'square';
            osc.frequency.value = 440;
            gain.gain.value = 0.3;
            
            osc.connect(gain);
            gain.connect(state.audioContext.destination);
            
            osc.start();
            osc.frequency.exponentialRampToValueAtTime(880, state.audioContext.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 0.1);
            osc.stop(state.audioContext.currentTime + 0.1);
        };
    } catch (e) {
        console.warn('Audio initialization failed:', e);
        state.soundsEnabled = false;
    }
}

// Play sound if enabled
function playSound(name) {
    if (state.soundsEnabled && state.sounds[name]) {
        try {
            state.sounds[name]();
        } catch (e) {
            console.warn('Sound playback failed:', e);
        }
    }
}

// Toggle sound on/off
function toggleSounds() {
    state.soundsEnabled = !state.soundsEnabled;
    localStorage.setItem('soundsEnabled_ja', state.soundsEnabled);
    document.getElementById('sound-toggle').textContent = state.soundsEnabled ? '🔊' : '🔇';
    showToast(`Sounds ${state.soundsEnabled ? 'enabled' : 'disabled'}`);
}
function addToWordCache(word, translation) {
    // Clean up cache if too large
    const keys = Object.keys(state.wordLookupCache);
    if (keys.length >= state.maxCacheSize) {
        // Remove oldest 20% of entries
        const toRemove = keys.slice(0, Math.floor(keys.length * 0.2));
        toRemove.forEach(key => delete state.wordLookupCache[key]);
    }
    
    state.wordLookupCache[word] = {
        translation,
        timestamp: Date.now()
    };
}

function getFromWordCache(word) {
    const entry = state.wordLookupCache[word];
    if (entry && (Date.now() - entry.timestamp < 3600000)) { // 1 hour cache
        return entry.translation;
    }
    delete state.wordLookupCache[word];
    return null;
}
function toggleBookmark() {
    if (state.sentences.length === 0) return;
    
    const currentSentence = state.sentences[state.currentSentenceIndex];
    const index = state.bookmarks.findIndex(b => b.id === currentSentence.id);
    
    if (index === -1) {
        // Add to bookmarks
        state.bookmarks.push({
            id: currentSentence.id,
            sentence: currentSentence.original,
            translation: currentSentence.cached_translation || '',
            date: new Date().toISOString()
        });
        const favoriteBtn = document.getElementById('favorite-sentence-btn');
if (favoriteBtn) {
    favoriteBtn.classList.add('active');
}
        showToast('Added to bookmarks!', 'success');
    } else {
        // Remove from bookmarks
        state.bookmarks.splice(index, 1);
        document.getElementById('favorite-sentence-btn').classList.remove('active');
        showToast('Removed from bookmarks', 'error');
    }
    
    localStorage.setItem('bookmarks_ja', JSON.stringify(state.bookmarks));
    renderBookmarks();
}
function renderBookmarks() {
    const container = document.getElementById('bookmarks-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Load both bookmarks and history if not loaded
    const savedBookmarks = localStorage.getItem('bookmarks_ja');
    const savedHistory = localStorage.getItem('textHistory_ja');
    
    if (savedBookmarks) {
        state.bookmarks = JSON.parse(savedBookmarks);
    }
    if (savedHistory) {
        state.textHistory = JSON.parse(savedHistory);
    }
    
    if (state.bookmarks.length === 0 && state.textHistory.length === 0) {
        container.innerHTML = `
            <p style="padding: 1rem; color: var(--text-secondary);">
                No saved content yet. Import text to start reading.
            </p>
        `;
        return;
    }
    
    // Show bookmarks first
    if (state.bookmarks.length > 0) {
        const bookmarksHeader = document.createElement('h3');
        bookmarksHeader.textContent = 'Bookmarked Sentences';
        bookmarksHeader.style.margin = '1rem 0 0.5rem 0';
        bookmarksHeader.style.color = 'var(--highlight)';
        container.appendChild(bookmarksHeader);
        
        const sortedBookmarks = [...state.bookmarks].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        sortedBookmarks.forEach(bookmark => {
            const item = document.createElement('div');
            item.className = 'resource-link';
            item.style.alignItems = 'center';
            item.style.padding = '0.8rem';
            
            // Use title if available, otherwise create one from content
let displayText = bookmark.title || '';
if (!displayText && bookmark.sentence) {
    // Get first 2-3 words as title
    const words = bookmark.sentence.split(/\s+/).slice(0, 3);
    displayText = words.join(' ');
    if (bookmark.sentence.length > displayText.length) {
        displayText += '...';
    }
}
            
            item.innerHTML = `
                <span style="flex: 1;">${displayText}</span>
                <span style="font-size: 0.8rem; color: var(--text-secondary); margin-right: 0.5rem;">
                    ${new Date(bookmark.date).toLocaleDateString()}
                </span>
                <button class="nav-btn" 
                        style="background-color: var(--danger); padding: 0.3rem;"
                        data-bookmark-id="${bookmark.id}"
                        aria-label="Remove bookmark">
                    ✕
                </button>
            `;
            container.appendChild(item);
        });
    }
    
    // Then show reading history
    if (state.textHistory.length > 0) {
        const historyHeader = document.createElement('h3');
        historyHeader.textContent = 'Reading History';
        historyHeader.style.margin = '1rem 0 0.5rem 0';
        historyHeader.style.color = 'var(--highlight)';
        container.appendChild(historyHeader);
        
        // Filter out expired items (older than 24 hours)
        const now = new Date();
        state.textHistory = state.textHistory.filter(item => {
            const itemDate = new Date(item.timestamp);
            return (now - itemDate) < (24 * 60 * 60 * 1000); // 24 hours
        });
        
        state.textHistory.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'resource-link';
            historyItem.style.marginBottom = '0.5rem';
            historyItem.style.alignItems = 'center';
            
            const progressBar = document.createElement('div');
            progressBar.style.width = '100%';
            progressBar.style.height = '4px';
            progressBar.style.backgroundColor = 'var(--secondary)';
            progressBar.style.borderRadius = '2px';
            progressBar.style.marginTop = '0.5rem';
            
            const progressFill = document.createElement('div');
            progressFill.style.height = '100%';
            progressFill.style.width = `${item.progress || 0}%`;
            progressFill.style.backgroundColor = 'var(--highlight)';
            progressFill.style.borderRadius = '2px';
            progressBar.appendChild(progressFill);
            
            historyItem.innerHTML = `
                <span style="flex: 1;">${item.title}</span>
                <span style="font-size: 0.8rem; color: var(--text-secondary); margin-right: 0.5rem;">
                    ${Math.round(item.progress || 0)}%
                </span>
                <button class="nav-btn" style="padding: 0.2rem 0.5rem;" 
                    data-history-index="${index}" aria-label="Load text">Load</button>
                <button class="nav-btn" style="background-color: var(--danger); padding: 0.2rem 0.5rem;" 
                    data-history-index="${index}" aria-label="Delete text">✕</button>
            `;
            
            historyItem.appendChild(progressBar);
            container.appendChild(historyItem);
        });
    }

    // Add these event listeners
document.getElementById('import-all-btn').addEventListener('click', importAllSentences);
    // Add event listeners
    container.querySelectorAll('[data-bookmark-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-bookmark-id');
            state.bookmarks = state.bookmarks.filter(b => b.id !== id);
            localStorage.setItem('bookmarks_ja', JSON.stringify(state.bookmarks));
            renderBookmarks();
            showToast('Bookmark removed', 'success');
            e.stopPropagation();
        });
    });
    
    container.querySelectorAll('[data-history-index]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.historyIndex);
            if (e.target.textContent === 'Load') {
                loadHistoryItem(index);
            } else {
                deleteHistoryItem(index);
            }
        });
    });
}
function saveCustomUrl() {
    const urlInput = document.getElementById('custom-url-input');
    const url = urlInput.value.trim();
    
    if (!url) {
        showToast('Please enter a URL', 'error');
        return;
    }
    
    // Basic URL validation
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showToast('Please enter a valid URL (include http:// or https://)', 'error');
        return;
    }
    
    // Create a title from the URL or prompt for one
    const title = prompt("Enter a title for this URL (or leave blank to use domain name):", 
                        new URL(url).hostname.replace('www.', ''));
    
    if (title === null) return; // User cancelled
    
    const urlObj = {
        id: generateUUID(),
        url: url,
        title: title || new URL(url).hostname.replace('www.', ''),
        date: new Date().toISOString()
    };
    
    state.savedUrls.unshift(urlObj);
    localStorage.setItem('savedUrls_ja', JSON.stringify(state.savedUrls));
    urlInput.value = '';
    renderSavedUrls();
    showToast('URL saved to library!', 'success');
}

function renderSavedUrls() {
    const container = document.querySelector('#bookmarks-list');
    container.innerHTML = '';
    
    if (state.savedUrls.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">No saved URLs yet</p>';
        return;
    }
    
    state.savedUrls.forEach(url => {
        const item = document.createElement('div');
        item.className = 'resource-link';
        item.style.alignItems = 'center';
        
        item.innerHTML = `
            <span style="flex: 1;">${url.title}</span>
            <span style="font-size: 0.8rem; color: var(--text-secondary); margin-right: 0.5rem;">
                ${new Date(url.date).toLocaleDateString()}
            </span>
            <button class="nav-btn" style="background-color: var(--highlight); padding: 0.3rem 0.6rem;" 
                data-url="${url.url}" aria-label="Import URL">Import</button>
            <button class="nav-btn" style="background-color: var(--danger); padding: 0.3rem 0.6rem;" 
                data-url-id="${url.id}" aria-label="Delete URL">✕</button>
        `;
        
        container.appendChild(item);
    });
 
    // Add event listeners to delete buttons
    container.querySelectorAll('[data-url-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-url-id');
            deleteSavedUrl(id);
            e.stopPropagation();
        });
    });
}

function deleteSavedUrl(id) {
    state.savedUrls = state.savedUrls.filter(url => url.id !== id);
    localStorage.setItem('savedUrls_ja', JSON.stringify(state.savedUrls));
    renderSavedUrls();
    showToast('URL removed', 'success');
}

function clearSavedUrls() {
    state.savedUrls = [];
    localStorage.removeItem('savedUrls_ja');
    renderSavedUrls();
    showToast('All saved URLs cleared', 'success');
}
function clearBookmarks() {
    state.bookmarks = [];
    localStorage.setItem('bookmarks_ja', JSON.stringify(state.bookmarks));
    renderBookmarks();
    showToast('All bookmarks cleared', 'success');
}
// Toast notification
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast';
    
    // Only add class if type is not empty
    if (type) {
        toast.classList.add(type);
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

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

// Initialize settings panel
console.log('Initializing settings panel');
console.log('Settings button:', document.getElementById('settings-btn'));
console.log('Settings panel:', document.getElementById('settings-panel'));
function initSettingsPanel() {
    // Set initial values

    elements.autoTranslateToggle.checked = state.autoTranslate;
    elements.fontSelect.value = state.currentFont;
    elements.fontSizeRange.value = state.currentFontSize;
    elements.lineHeightRange.value = state.currentLineHeight;
    elements.themeSelect.value = state.theme;
    
    // Update stats display
    updateStatsDisplay();
    // Streak reminder
if (state.readingStats.streak > 3 && state.readingStats.lastActiveDate !== new Date().toDateString()) {
  showToast(`🔥 Don't break your ${state.readingStats.streak}-day streak!`, 'warning');
}
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
        localStorage.setItem('autoTranslate_ja', state.autoTranslate);
        if (state.autoTranslate && state.currentView === 'reading-view' && state.sentences.length > 0) {
            translateCurrentSentence();
        }
    });
    
    elements.fontSelect.addEventListener('change', (e) => {
        state.currentFont = e.target.value;
        localStorage.setItem('font_ja', state.currentFont);
        document.documentElement.setAttribute('data-font', state.currentFont);
    });
    
elements.fontSizeRange.addEventListener('input', (e) => {
    state.currentFontSize = e.target.value;
    localStorage.setItem('fontSize_ja', state.currentFontSize);
    document.documentElement.style.setProperty('--font-size', `${state.currentFontSize}px`);
    
    // Force redraw of cards if in matching game
    if (state.currentView === 'review-mode-view' && state.reviewMode && state.reviewMode !== 'hard') {
        setupMatchingGame();
    }
});
    
    elements.lineHeightRange.addEventListener('input', (e) => {
        state.currentLineHeight = e.target.value;
        localStorage.setItem('lineHeight_ja', state.currentLineHeight);
        document.documentElement.style.setProperty('--line-height', state.currentLineHeight);
    });
    
    elements.themeSelect.addEventListener('change', (e) => {
        state.theme = e.target.value;
        localStorage.setItem('theme_ja', state.theme);
        document.documentElement.setAttribute('data-theme', state.theme);
        elements.themeToggle.textContent = state.theme === 'dark' ? '🌙' : '☀️';
    });
    
    
    // Jump to sentence
    elements.jumpBtn.addEventListener('click', () => {
        const sentenceNum = parseInt(elements.jumpInput.value);
        if (sentenceNum > 0 && sentenceNum <= state.sentences.length) {
            state.currentSentenceIndex = sentenceNum - 1;
            displaySentence();
        }
    });
    
    elements.jumpInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.jumpBtn.click();
        }
    });
}

// Update stats display
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
        localStorage.setItem('readingStats_ja', JSON.stringify(state.readingStats));
    }
    
    elements.streakCount.textContent = state.readingStats.streak;
    elements.wordsLearnedCount.textContent = state.readingStats.wordsLearned;
    elements.timeSpentCount.textContent = `${Math.floor(state.readingStats.timeSpent / 60)} min`;
    elements.dailyStreak.textContent = state.readingStats.streak;
    elements.dailyWordsLearned.textContent = state.readingStats.dailyWords;
    elements.dailyTimeSpent.textContent = `${Math.floor(state.readingStats.dailyTime / 60)} min`;
}

// Track reading time
function startReadingSession() {
    if (!state.currentSessionStart) {
        state.currentSessionStart = new Date();
    }
}
function addWordClickHandlers() {
    // Clear previous click handlers
    elements.sentenceDisplay.onclick = null;
    
    // Add new click handler for word lookup
    elements.sentenceDisplay.onclick = (e) => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText.length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            // Show tooltip with word lookup
            showWordTooltip(selectedText, rect.left, rect.top - 30);
        }
    };
}
function endReadingSession() {
    if (state.currentSessionStart) {
        const now = new Date();
        const timeSpent = (now - state.currentSessionStart) / 1000; // in seconds
        state.readingStats.timeSpent += timeSpent;
        state.readingStats.dailyTime += timeSpent;
        state.currentSessionStart = null;
        localStorage.setItem('readingStats_ja', JSON.stringify(state.readingStats));
        updateStatsDisplay();
    }
}



// Database operations

// Initialize IndexedDB
const DB_NAME = 'JapaneseLearnerDB_ja';
const DB_VERSION = 3; // Updated version for new schema
const STORE_SENTENCES = 'sentences';
const STORE_VOCAB = 'vocabulary';
const STORE_TRANSLATIONS = 'translations';

let db;
async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains(STORE_SENTENCES)) {
                const sentencesStore = db.createObjectStore(STORE_SENTENCES, { keyPath: 'id' });
                sentencesStore.createIndex('position', 'position', { unique: true });
            } else {
                // Handle upgrades for sentences store if needed
                const sentencesStore = event.target.transaction.objectStore(STORE_SENTENCES);
                if (!sentencesStore.indexNames.contains('position')) {
                    sentencesStore.createIndex('position', 'position', { unique: true });
                }
            }
            
            if (!db.objectStoreNames.contains(STORE_VOCAB)) {
                const vocabStore = db.createObjectStore(STORE_VOCAB, { keyPath: 'id' });
                vocabStore.createIndex('bucket', 'bucket', { unique: false });
                vocabStore.createIndex('word', 'word', { unique: true });
                vocabStore.createIndex('favorite', 'favorite', { unique: false });
            } else {
                const vocabStore = event.target.transaction.objectStore(STORE_VOCAB);
                if (!vocabStore.indexNames.contains('bucket')) {
                    vocabStore.createIndex('bucket', 'bucket', { unique: false });
                }
                if (!vocabStore.indexNames.contains('word')) {
                    vocabStore.createIndex('word', 'word', { unique: true });
                }
                if (!vocabStore.indexNames.contains('favorite')) {
                    vocabStore.createIndex('favorite', 'favorite', { unique: false });
                }
            }
            
            if (!db.objectStoreNames.contains(STORE_TRANSLATIONS)) {
                const translationsStore = db.createObjectStore(STORE_TRANSLATIONS, { keyPath: 'id' });
                translationsStore.createIndex('text', 'text', { unique: true });
            }
        };
        
        request.onsuccess = (event) => {
            const db = event.target.result;
            
            // Add error handling for database operations
            db.onerror = (event) => {
                console.error('Database error:', event.target.error);
            };
            
            resolve(db);
        };
        
        request.onerror = (event) => {
            console.error('Failed to open database:', event.target.error);
            reject(event.target.error);
        };
        
        request.onblocked = (event) => {
            console.warn('Database access blocked - likely due to version change');
            // Try to close any existing connections and reopen
            if (db) {
                db.close();
                setTimeout(() => openDatabase().then(resolve).catch(reject), 500);
            } else {
                reject(new Error('Database access blocked'));
            }
        };
    });
}
// NEW CODE (add this function):
async function verifyDatabaseIntegrity() {
    try {
        if (!db) {
            db = await openDatabase();
        }
        
        // Check if all object stores exist
        const stores = [STORE_SENTENCES, STORE_VOCAB, STORE_TRANSLATIONS];
        const missingStores = stores.filter(store => !db.objectStoreNames.contains(store));
        
        if (missingStores.length > 0) {
            console.warn('Missing object stores:', missingStores);
            // Force a database upgrade by incrementing version
            const oldVersion = db.version;
            db.close();
            DB_VERSION = oldVersion + 1;
            db = await openDatabase();
        }
        
        return true;
    } catch (error) {
        console.error('Database integrity check failed:', error);
        return false;
    }
}
function getAllVocabWords() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readonly');
        const store = transaction.objectStore(STORE_VOCAB);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}
function renderVocabList(words) {
    const container = document.getElementById('vocab-list');
    container.innerHTML = '';
    
    if (!words || words.length === 0) {
        container.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">No vocabulary words yet</p>';
        return;
    }
    
    // Sort by bucket (new > easy > medium > hard) then alphabetically
    const bucketOrder = { 'new': 0, 'easy': 1, 'medium': 2, 'hard': 3 };
    words.sort((a, b) => {
        if (bucketOrder[a.bucket] !== bucketOrder[b.bucket]) {
            return bucketOrder[a.bucket] - bucketOrder[b.bucket];
        }
        return a.word.localeCompare(b.word);
    });
    
    words.forEach(word => {
        const item = document.createElement('div');
        item.className = 'resource-link';
        item.style.alignItems = 'center';
        item.style.padding = '0.8rem';
        item.style.marginBottom = '0.5rem';
        
        item.innerHTML = `
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: bold; font-size: 1.1rem;">${word.word}</div>
                <div style="color: var(--text-secondary); margin-top: 0.3rem;">${word.translation}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.8rem; color: var(--text-secondary);">
                    ${word.bucket}
                </span>
                <button class="nav-btn" style="background-color: var(--danger); padding: 0.3rem 0.6rem;" 
                    data-word-id="${word.id}" aria-label="Delete word">✕</button>
            </div>
        `;
        
        container.appendChild(item);
    });
    
    // Add event listeners to delete buttons
    container.querySelectorAll('[data-word-id]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-word-id');
            try {
                await deleteVocabWord(id);
                showToast('Word deleted', 'success');
                
                // Refresh the list
                const words = await getAllVocabWords();
                renderVocabList(words);
                
                // Update counts everywhere
                updateBucketCounts();
                const counts = await countVocabByBucket();
                document.getElementById('manage-new-count').textContent = counts.new || 0;
                document.getElementById('manage-easy-count').textContent = counts.easy || 0;
                document.getElementById('manage-medium-count').textContent = counts.medium || 0;
                document.getElementById('manage-hard-count').textContent = counts.hard || 0;
            } catch (error) {
                console.error('Error deleting word:', error);
                showToast('Failed to delete word', 'error');
            }
        });
    });
}
function wipeAllData() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES, STORE_VOCAB, STORE_TRANSLATIONS], 'readwrite');
        const sentencesStore = transaction.objectStore(STORE_SENTENCES);
        const vocabStore = transaction.objectStore(STORE_VOCAB);
        const translationsStore = transaction.objectStore(STORE_TRANSLATIONS);
        
        sentencesStore.clear();
        vocabStore.clear();
        translationsStore.clear();
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

function showWipeConfirmation() {
    const dialog = document.getElementById('wipe-confirmation');
    dialog.style.display = 'flex';
    setTimeout(() => dialog.classList.add('show'), 10);
}

function hideWipeConfirmation() {
    const dialog = document.getElementById('wipe-confirmation');
    dialog.classList.remove('show');
    setTimeout(() => dialog.style.display = 'none', 300);
}

function showHistoryView() {
    // Load history from localStorage
    const savedHistory = localStorage.getItem('textHistory_ja');
    if (savedHistory) {
        state.textHistory = JSON.parse(savedHistory);
    }
    
    // Filter out expired items (older than 24 hours)
    const now = new Date();
    state.textHistory = state.textHistory.filter(item => {
        const itemDate = new Date(item.timestamp);
        return (now - itemDate) < (24 * 60 * 60 * 1000); // 24 hours
    });
    
    // Display history
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    
    if (state.textHistory.length === 0) {
        historyList.innerHTML = '<p>No recent texts found</p>';
    } else {
        state.textHistory.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'resource-link';
            historyItem.style.marginBottom = '0.5rem';
            
let preview = item.title || item.text.split(/\s+/).slice(0, 3).join(' ');
if (item.text.length > preview.length) {
    preview += '...';
}          
historyItem.innerHTML = `
    <span style="flex: 1;">${preview}</span>
    <span style="font-size: 0.8rem; color: var(--text-secondary); margin-right: 0.5rem;">
        ${new Date(item.timestamp).toLocaleDateString()}
    </span>
    <button class="nav-btn" style="padding: 0.3rem 0.6rem;" 
        data-history-index="${index}" aria-label="Load text">Load</button>
    <button class="nav-btn" style="background-color: var(--danger); padding: 0.3rem 0.6rem;" 
        data-history-index="${index}" aria-label="Delete text">✕</button>
`;
            
            historyList.appendChild(historyItem);
        });
        
        // Add event listeners to the new buttons
        document.querySelectorAll('[data-history-index]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.historyIndex);
                if (e.target.textContent === 'Load') {
                    loadHistoryItem(index);
                } else {
                    deleteHistoryItem(index);
                }
            });
        });
    }
    
    showView('history-view');
}

function loadHistoryItem(index) {
    const item = state.textHistory[index];
    elements.textInput.value = item.text;
    elements.charCount.textContent = item.text.length;
    showView('text-import-view');
    showToast(`"${item.title}" loaded from history`);
}

function deleteHistoryItem(index) {
    state.textHistory.splice(index, 1);
    localStorage.setItem('textHistory_ja', JSON.stringify(state.textHistory));
    showHistoryView();
    showToast('History item deleted');
}

function clearHistory() {
    state.textHistory = [];
    localStorage.removeItem('textHistory_ja');
    showHistoryView();
    showToast('History cleared');
}

// Database operations
function deleteVocabWord(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readwrite');
        const store = transaction.objectStore(STORE_VOCAB);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
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
        const index = store.index('position');
        const request = index.getAll();
        
        request.onsuccess = () => resolve(request.result);
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

function getVocabByBucket(bucket) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readonly');
        const store = transaction.objectStore(STORE_VOCAB);
        const index = store.index('bucket');
        const request = index.getAll(IDBKeyRange.only(bucket));
        
        request.onsuccess = () => resolve(request.result);
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

// Text processing
function splitSentences(text) {
    const SPLIT_REGEX = /(?<=[。！？\n]|[\u3002\uff01\uff1f])/;
    const sentences = text.split(SPLIT_REGEX)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    
    // Further split long sentences
    return sentences.flatMap(sentence => {
        if (sentence.length > 100) {
            return sentence.split(/(?<=[、,])/).map(s => s.trim()).filter(s => s);
        }
        return sentence;
    });
}

function detectLanguage(text) {
    // Simple heuristic to detect Japanese text
    const japaneseChars = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/;
    return japaneseChars.test(text) ? 'ja' : 'en';
}


async function translateToJapanese(text, sourceLang) {
    try {
        // Check cache first
        const cachedTranslation = await getCachedTranslation(text, sourceLang, 'ja');
        if (cachedTranslation) {
            return cachedTranslation;
        }

        if (!state.isOnline) {
            throw new Error('Offline - translation not available');
        }

        const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|ja`
        );

        if (!response.ok) throw new Error('Translation failed');

        const data = await response.json();
        if (data.responseData && data.responseData.translatedText) {
            const translatedText = data.responseData.translatedText;
            // Cache the translation
            await cacheTranslation(text, sourceLang, 'ja', translatedText);
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
        const index = store.index('text');
        
        // Use get() instead of getAll() to get just one match
        const request = index.get(`${sourceLang}|${targetLang}|${text}`);
        
        request.onsuccess = () => {
            if (request.result) {
                // Check if translation is recent (within 30 days)
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                if (request.result.timestamp > thirtyDaysAgo) {
                    resolve(request.result.translatedText);
                } else {
                    // Translation is too old - delete it
                    const deleteTransaction = db.transaction([STORE_TRANSLATIONS], 'readwrite');
                    const deleteStore = deleteTransaction.objectStore(STORE_TRANSLATIONS);
                    deleteStore.delete(request.result.id);
                    resolve(null);
                }
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
        
        // First check if translation already exists
        const index = store.index('text');
        const request = index.get(`${sourceLang}|${targetLang}|${text}`);
        
        request.onsuccess = () => {
            if (request.result) {
                // Translation exists - update it
                const existing = request.result;
                existing.translatedText = translatedText;
                existing.timestamp = new Date().getTime();
                
                const updateRequest = store.put(existing);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = (event) => reject(event.target.error);
            } else {
                // New translation - add it
                const translation = {
                    id: generateUUID(),
                    text: `${sourceLang}|${targetLang}|${text}`,
                    translatedText: translatedText,
                    timestamp: new Date().getTime()
                };
                
                const addRequest = store.add(translation);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = (event) => reject(event.target.error);
            }
        };
        
        request.onerror = (event) => reject(event.target.error);
    });
}

function toggleTranslationMode(showTranslate) {
    const importContainer = document.getElementById('import-container');
    const translateContainer = document.getElementById('translate-container');
    
    if (showTranslate) {
        importContainer.style.display = 'none';
        translateContainer.style.display = 'block';
        document.querySelector('.mode-toggle-btn[data-mode="import"]').classList.remove('active');
        document.querySelector('.mode-toggle-btn[data-mode="translate"]').classList.add('active');
    } else {
        importContainer.style.display = 'block';
        translateContainer.style.display = 'none';
        document.querySelector('.mode-toggle-btn[data-mode="import"]').classList.add('active');
        document.querySelector('.mode-toggle-btn[data-mode="translate"]').classList.remove('active');
    }
}

async function translateSentence(sentence) {
    try {
        const currentSentence = state.sentences[state.currentSentenceIndex];
        if (currentSentence.user_translation) {
            return currentSentence.user_translation;
        }

        // Check cache first
        const targetLang = elements.translationLang.value;
        const cachedTranslation = await getCachedTranslation(sentence, 'ja', targetLang);
        if (cachedTranslation) {
            return cachedTranslation;
        }

        if (!state.isOnline) {
            throw new Error('Offline - translation not available');
        }

        const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sentence)}&langpair=ja|${targetLang}`
        );

        if (!response.ok) throw new Error('Translation failed');

        const data = await response.json();
        if (data.responseData && data.responseData.translatedText) {
            const translatedText = data.responseData.translatedText;
            // Cache the translation
            await cacheTranslation(sentence, 'ja', targetLang, translatedText);
            return translatedText;
        } else {
            throw new Error('No translation found');
        }
    } catch (error) {
        console.error('Translation error:', error);
        return "Translation unavailable";
    }
}

// Show/hide tutorial elements based on first visit
const firstVisit = localStorage.getItem('firstVisit_ja') === null;
if (firstVisit) {
    document.getElementById('quick-start-guide').style.display = 'block';
    document.getElementById('hero-section').style.display = 'block';
    localStorage.setItem('firstVisit_ja', 'false');
} else {
    document.getElementById('quick-start-guide').style.display = 'none';
    document.getElementById('hero-section').style.display = 'none';
}
// TTS functionality
function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
           
        state.currentTtsUtterance = utterance;
        
        if (speechSynthesis.getVoices().length === 0) {
            speechSynthesis.onvoiceschanged = () => {
                const voices = speechSynthesis.getVoices();
                const japaneseVoice = voices.find(voice => 
                    voice.lang === 'ja-JP' || voice.lang.startsWith('ja')
                );
                
                if (japaneseVoice) {
                    utterance.voice = japaneseVoice;
                }
                
                speechSynthesis.speak(utterance);
            };
            // Force voices to load
            speechSynthesis.getVoices();
        } else {
            const voices = speechSynthesis.getVoices();
            const japaneseVoice = voices.find(voice => 
                voice.lang === 'ja-JP' || voice.lang.startsWith('ja')
            );
            
            if (japaneseVoice) {
                utterance.voice = japaneseVoice;
            }
            
            speechSynthesis.speak(utterance);
        }
    }
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

// View management
function showView(viewId) {
// Track language usage
if (!state.languageUsage['japanese']) {
    state.languageUsage['japanese'] = 0;
}
state.languageUsage['japanese']++;
localStorage.setItem('languageUsage', JSON.stringify(state.languageUsage));

// Update recent languages list
let recentLangs = JSON.parse(localStorage.getItem('recentLanguages')) || [];
recentLangs = recentLangs.filter(lang => lang !== 'Japanese');
recentLangs.unshift('Japanese');
if (recentLangs.length > 3) recentLangs.pop();
localStorage.setItem('recentLanguages', JSON.stringify(recentLangs));
    Object.values(elements.views).forEach(view => {
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
    }
}

function updateBucketCounts() {
    countVocabByBucket().then(counts => {
        Object.entries(counts).forEach(([bucket, count]) => {
            if (elements.bucketCounts[bucket]) {
                elements.bucketCounts[bucket].textContent = count;
            }
            if (document.getElementById(`manage-${bucket}-count`)) {
                document.getElementById(`manage-${bucket}-count`).textContent = count;
            }
        });
        
        const selectedBucket = state.reviewMode;
        if (selectedBucket && counts[selectedBucket] > 0) {
            elements.startReviewBtn.disabled = false;
            elements.startReviewBtn.textContent = `Review ${selectedBucket} words`;
        } else {
            elements.startReviewBtn.disabled = true;
            elements.startReviewBtn.textContent = 'Select a difficulty to start';
        }
    });
}

function displaySentence() {
    // Save current position to localStorage
    localStorage.setItem('lastSentencePosition_ja', JSON.stringify(state.currentSentenceIndex));
    
    if (state.sentences.length === 0) {
        elements.sentenceDisplay.textContent = 'No sentences available.';
        if (elements.translationDisplay) {
            elements.translationDisplay.style.display = 'none';
        }
        document.getElementById('sentence-counter').textContent = 'Sentence 0/0';
        return;
    }
    
    const sentence = state.sentences[state.currentSentenceIndex];
    elements.sentenceDisplay.textContent = sentence.original;


    
    elements.sentenceDisplay.classList.add('current-sentence');
    elements.wordSelectionBox.style.display = 'none';
    
    document.getElementById('sentence-counter').textContent = 
        `Sentence ${state.currentSentenceIndex + 1}/${state.sentences.length}`;
    
    // Update jump input
    elements.jumpInput.value = state.currentSentenceIndex + 1;
    
    if (elements.translationDisplay) {
        elements.translationDisplay.style.display = 'none';
        
        if (sentence.cached_translation) {
            elements.translationDisplay.textContent = sentence.cached_translation;
            if (state.autoTranslate) {
                elements.translationDisplay.style.display = 'block';
            }
        }
    }
    
    // Pre-load next and previous sentences
    preloadAdjacentSentences();
    
    // Add click handlers for word lookup
    addWordClickHandlers();
    
    // Safely update favorite button state if it exists
    const favoriteBtn = document.getElementById('favorite-sentence-btn');
    if (favoriteBtn) {
        if (state.bookmarks.some(b => b.id === sentence.id)) {
            favoriteBtn.classList.add('active');
        } else {
            favoriteBtn.classList.remove('active');
        }
    }
}
function preloadAdjacentSentences() {
    // Pre-load next sentence translation if not already loaded
    if (state.currentSentenceIndex < state.sentences.length - 1) {
        const nextSentence = state.sentences[state.currentSentenceIndex + 1];
        if (!nextSentence.cached_translation && !nextSentence.user_translation) {
            translateSentence(nextSentence.original).then(translation => {
                state.sentences[state.currentSentenceIndex + 1].cached_translation = translation;
            });
        }
    }
    
    // Pre-load previous sentence translation if not already loaded
    if (state.currentSentenceIndex > 0) {
        const prevSentence = state.sentences[state.currentSentenceIndex - 1];
        if (!prevSentence.cached_translation && !prevSentence.user_translation) {
            translateSentence(prevSentence.original).then(translation => {
                state.sentences[state.currentSentenceIndex - 1].cached_translation = translation;
            });
        }
    }
}
function showWordTooltip(word, x, y) {
    // Check cache first
    if (state.wordLookupCache[word]) {
        displayTooltipWithOptions(state.wordLookupCache[word], word, x, y);
        return;
    }
    
    // Try to find the word in vocabulary
    const transaction = db.transaction([STORE_VOCAB], 'readonly');
    const store = transaction.objectStore(STORE_VOCAB);
    const index = store.index('word');
    const request = index.get(word);
    
    request.onsuccess = () => {
        if (request.result) {
            const translation = request.result.translation;
            state.wordLookupCache[word] = translation;
            displayTooltipWithOptions(translation, word, x, y);
        } else {
            // If not found in vocabulary, try dictionary API
            lookupWordInDictionary(word).then(translation => {
                if (translation) {
                    state.wordLookupCache[word] = translation;
                    displayTooltipWithOptions(translation, word, x, y);
                } else {
                    displayTooltipWithOptions('No translation found', word, x, y);
                }
            });
        }
    };
}

function displayTooltipWithOptions(text, word, x, y) {
    const tooltip = document.getElementById('word-tooltip');
    tooltip.innerHTML = `
        <div style="padding: 0.5rem; max-width: 200px;">
            <div style="margin-bottom: 0.5rem; font-weight: bold;">${text}</div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="tooltip-btn" data-action="lookup" style="flex: 1; padding: 0.3rem; background: var(--accent); border: none; border-radius: 4px; color: white; cursor: pointer;">Dictionary</button>
                <button class="tooltip-btn" data-action="translate" style="flex: 1; padding: 0.3rem; background: var(--highlight); border: none; border-radius: 4px; color: white; cursor: pointer;">Translate</button>
            </div>
        </div>
    `;
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y - 60}px`; // Position above cursor
    tooltip.classList.add('show');
    
    // Add event listeners to buttons
    tooltip.querySelector('[data-action="lookup"]').addEventListener('click', () => {
        elements.selectedWord.textContent = word;
        elements.wordSelectionBox.style.display = 'block';
        tooltip.classList.remove('show');
    });
    
    tooltip.querySelector('[data-action="translate"]').addEventListener('click', async () => {
        try {
            const translation = await translateSentence(word);
            showToast(`Translation: ${translation}`, 'success');
        } catch (error) {
            showToast('Translation failed', 'error');
        }
        tooltip.classList.remove('show');
    });
    
    // Close tooltip when clicking outside
    setTimeout(() => {
        const closeTooltip = (e) => {
            if (!tooltip.contains(e.target)) {
                tooltip.classList.remove('show');
                document.removeEventListener('click', closeTooltip);
            }
        };
        document.addEventListener('click', closeTooltip);
    }, 100);
}

function displayTooltip(text, x, y) {
    elements.wordTooltip.textContent = text;
    elements.wordTooltip.style.left = `${x}px`;
    elements.wordTooltip.style.top = `${y}px`;
    elements.wordTooltip.classList.add('show');
    
    setTimeout(() => {
        elements.wordTooltip.classList.remove('show');
    }, 2000);
}

// Basic Japanese-English dictionary (you can expand this list)
const localDictionary = {
    "気象庁": "Japan Meteorological Agency",
    "天気": "weather",
    "雨": "rain",
    "晴れ": "sunny",
    "雪": "snow",
    "風": "wind",
    "雲": "cloud",
    "雷": "thunder",
    "地震": "earthquake",
    "台風": "typhoon",
    "気温": "temperature",
    "湿度": "humidity",
    "予報": "forecast",
    "警報": "warning",
    "注意報": "advisory",
    "猫": "cat",
    "犬": "dog",
    "本": "book",
    "水": "water",
    "食べ物": "food",
    "学校": "school",
    "先生": "teacher",
    "学生": "student",
    "日本語": "Japanese language",
    "英語": "English",
    "ありがとう": "thank you",
    "こんにちは": "hello",
    "さようなら": "goodbye"
};

// 1. MAIN DICTIONARY LOOKUP FUNCTION
async function lookupWordInDictionary(word) {
    // First try local dictionary
    if (localDictionary[word]) {
        return {
            source: 'local',
            result: localDictionary[word],
            word: word
        };
    }

    // Then try Wiktionary if online
    if (state.isOnline) {
        try {
            const result = await tryWiktionaryAPI(word);
            if (result) return result;
        } catch (e) {
            console.log('Wiktionary failed:', e);
        }
    }

    // Final fallback
    return {
        source: 'none',
        result: 'No definition found',
        word: word
    };
}

// 2. WIKTIONARY API IMPLEMENTATION
// 2. WIKTIONARY API IMPLEMENTATION (updated to remove links)
async function tryWiktionaryAPI(word) {
    try {
        // First try English Wiktionary (has more Japanese entries)
        let response = await fetch(
            `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'Api-User-Agent': 'YourApp/1.0 (your@email.com)'
                }
            }
        );

        // If not found, try Japanese Wiktionary
        if (response.status === 404) {
            response = await fetch(
                `https://ja.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Api-User-Agent': 'YourApp/1.0 (your@email.com)'
                    }
                }
            );
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        // Parse Japanese definitions
        if (data.ja) {
            const definitions = [];
            
            // Extract all English definitions
            for (const entry of data.ja) {
                if (entry.definitions) {
                    for (const def of entry.definitions) {
                        // Remove any HTML tags (including links) from definitions
                        const cleanDef = def.definition.replace(/<[^>]*>/g, '');
                        definitions.push(cleanDef);
                    }
                }
            }

            if (definitions.length > 0) {
                return {
                    source: 'wiktionary',
                    result: definitions.join('; '),
                    word: word
                };
            }
        }

        // Fallback to English definitions if no Japanese found
        if (data.en) {
            const definitions = [];
            
            for (const entry of data.en) {
                if (entry.definitions) {
                    for (const def of entry.definitions) {
                        if (typeof def === 'string') {
                            // Remove any HTML tags from English definitions too
                            const cleanDef = def.replace(/<[^>]*>/g, '');
                            definitions.push(cleanDef);
                        }
                    }
                }
            }

            if (definitions.length > 0) {
                return {
                    source: 'wiktionary-en',
                    result: definitions.join('; '),
                    word: word
                };
            }
        }

        throw new Error('No definitions found');
    } catch (e) {
        console.log('Wiktionary API error:', e);
        throw e;
    }
}

// 3. UI INTEGRATION (same as before)
document.getElementById('lookup-word').addEventListener('click', async () => {
    const word = document.getElementById('selected-word').textContent;
    if (!word) {
        showToast('No word selected', 'error');
        return;
    }

    try {
        document.getElementById('lookup-word').innerHTML = 'Searching...';
        const entriesContainer = document.getElementById('dictionary-entries');
        entriesContainer.innerHTML = '';

        const { source, result, word: displayWord } = await lookupWordInDictionary(word);
        
        const entryDiv = document.createElement('div');
        entryDiv.className = 'dictionary-entry';
        entryDiv.innerHTML = `
            <strong>${displayWord}</strong><br>
            ${result}<br>
            <small>Source: ${source}</small>
        `;
        
        entryDiv.addEventListener('click', () => {
            document.getElementById('vocab-translation').value = result;
            document.getElementById('dictionary-results').style.display = 'none';
        });
        
        entriesContainer.appendChild(entryDiv);
        document.getElementById('dictionary-results').style.display = 'block';
        
        showToast(`Definition found (${source})`, 'success');
    } catch (error) {
        console.error('Dictionary error:', error);
        showToast('Dictionary lookup failed', 'error');
    } finally {
        document.getElementById('lookup-word').innerHTML = 'Lookup in Dictionary';
    }
});


function translateCurrentSentence() {
    if (state.sentences.length === 0 || !elements.translationDisplay) return;
    
    const sentence = state.sentences[state.currentSentenceIndex].original;
    elements.translationDisplay.style.display = 'block';
    elements.translationDisplay.textContent = "Translating...";
    
    translateSentence(sentence).then(translation => {
        elements.translationDisplay.textContent = translation;
        state.sentences[state.currentSentenceIndex].cached_translation = translation;
        
        // Add copy button
        if (!document.getElementById('copy-translation-btn')) {
            const copyBtn = document.createElement('button');
            copyBtn.id = 'copy-translation-btn';
            copyBtn.className = 'copy-translation';
            copyBtn.textContent = 'Copy';
            copyBtn.setAttribute('aria-label', 'Copy translation');
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(translation);
                showToast('Translation copied!', 'success');
// Check for milestones
if (state.readingStats.wordsLearned === 100) {
  showToast('🎉 100 Words Learned!', 'success');
}
            });
            elements.translationDisplay.appendChild(copyBtn);
        }
    });
}

// Vocabulary review functions
async function startReview(bucket) {
    // Clear any previous review elements
    elements.reviewQuestion.innerHTML = '';
    elements.leftColumn.innerHTML = '';
    elements.rightColumn.innerHTML = '';
    elements.reviewQuestion.style.display = 'none';
    elements.matchingGameContainer.style.display = 'none';
    elements.hardModeContainer.style.display = 'none';
    
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
function exitReview() {
    // Clear all review elements
    if (elements.reviewQuestion) elements.reviewQuestion.innerHTML = '';
    if (elements.leftColumn) elements.leftColumn.innerHTML = '';
    if (elements.rightColumn) elements.rightColumn.innerHTML = '';
    if (elements.reviewQuestion) elements.reviewQuestion.style.display = 'none';
    if (elements.matchingGameContainer) elements.matchingGameContainer.style.display = 'none';
    if (elements.hardModeContainer) elements.hardModeContainer.style.display = 'none';
    
// Show header when exiting review
const header = document.querySelector('header');
if (header) header.classList.remove('hidden');
    
    state.currentHardStreak = 0; // Reset streak when exiting
    showView('vocab-review-view');
}

// Update event listeners to use the new exitReview function
if (elements.exitReviewBtn) {
    elements.exitReviewBtn.addEventListener('click', exitReview);
}

const exitHardBtn = document.getElementById('exit-hard-btn');
if (exitHardBtn) {
    exitHardBtn.addEventListener('click', exitReview);
}

function setupMatchingGame() {
    // Clean up previous listeners
    cleanupScrollListeners();
    // Clear any previous content
    elements.reviewQuestion.innerHTML = '';
    elements.leftColumn.innerHTML = '';
    elements.rightColumn.innerHTML = '';
    elements.reviewQuestion.style.display = 'none';
    elements.hardModeContainer.style.display = 'none';
    
    // Get words for this round (max 5)
    let wordsToShow = state.reviewWords.slice(state.currentReviewIndex, state.currentReviewIndex + 5);
    
    // Ensure we always show 5 pairs (10 cards) if available
    if (wordsToShow.length < 5 && state.reviewWords.length >= 5) {
        // If we have fewer than 5 words but more available, take from beginning
        const remainingWords = 5 - wordsToShow.length;
        wordsToShow = wordsToShow.concat(state.reviewWords.slice(0, remainingWords));
    }
    
    state.currentRoundWords = wordsToShow;

    // Show matching game container and shuffle button
    elements.shuffleCardsBtn.style.display = 'block';
    elements.matchingGameContainer.style.display = 'flex';
    elements.hardModeContainer.style.display = 'none';

    if (wordsToShow.length === 0) {
        showToast('No words to review!', 'error');
        return;
    }

    if (state.reviewMode === 'new' || state.reviewMode === 'easy') {
        // English cards on left (translations)
        const englishCards = shuffleArray([...wordsToShow]).map(word => ({
            id: word.id,
            type: 'english',
            text: word.translation,
            streak: word.streak || 0
        }));
        
        // Japanese cards on right (words)
        const japaneseCards = shuffleArray([...wordsToShow]).map(word => ({
            id: word.id,
            type: 'japanese',
            text: word.word,
            streak: word.streak || 0
        }));
        
        // Add cards to columns
        englishCards.forEach(word => {
            const card = createWordCard(word);
            elements.leftColumn.appendChild(card);
        });
        
        japaneseCards.forEach(word => {
            const card = createWordCard(word);
            elements.rightColumn.appendChild(card);
        });
        
    } else { // medium mode
        // Japanese cards on left (words)
        const japaneseCards = shuffleArray([...wordsToShow]).map(word => ({
            id: word.id,
            type: 'japanese',
            text: word.word,
            streak: word.streak || 0
        }));
        
        // English cards on right (translations)
        const englishCards = shuffleArray([...wordsToShow]).map(word => ({
            id: word.id,
            type: 'english',
            text: word.translation,
            streak: word.streak || 0
        }));
        
        // Add cards to columns
        japaneseCards.forEach(word => {
            const card = createWordCard(word);
            elements.leftColumn.appendChild(card);
        });
        
        englishCards.forEach(word => {
            const card = createWordCard(word);
            elements.rightColumn.appendChild(card);
        });
    }
    
       // Update progress
    updateReviewProgress();
    updateProgressDisplay();
    
 const leftHandler = () => syncScroll({target: elements.leftColumn});
    const rightHandler = () => syncScroll({target: elements.rightColumn});
    
    elements.leftColumn.addEventListener('scroll', leftHandler);
    elements.rightColumn.addEventListener('scroll', rightHandler);
    
    // Store references for cleanup
    scrollListeners.push(
        {element: elements.leftColumn, handler: leftHandler},
        {element: elements.rightColumn, handler: rightHandler}
    );
}

function updateReviewProgress() {
    if (!state.reviewWords || state.reviewWords.length === 0) return;
    
    const total = state.reviewWords.length;
    const remaining = total - state.currentReviewIndex;
    
    const progressElement = document.getElementById('review-progress');
    if (progressElement) {
        progressElement.textContent = `${total - remaining}/${total}`;
        
        // Add visual indicator when nearing completion
        if (remaining <= 3) {
            progressElement.style.color = 'var(--highlight)';
            progressElement.style.fontWeight = 'bold';
        } else {
            progressElement.style.color = 'var(--text-secondary)';
            progressElement.style.fontWeight = 'normal';
        }
    }
}

// Call this function whenever you update state.currentReviewIndex
// For example, in startReview(), setupMatchingGame(), handleHardModeResponse(), etc.
// New function to add
function syncScroll(e) {
    // Determine which column was scrolled
    const scrolledColumn = e.target;
    const otherColumn = scrolledColumn === elements.leftColumn ? elements.rightColumn : elements.leftColumn;
    
    // Remove the event listener temporarily to prevent infinite loop
    otherColumn.removeEventListener('scroll', syncScroll);
    
    // Sync the scroll position
    otherColumn.scrollTop = scrolledColumn.scrollTop;
    
    // Re-add the event listener
    setTimeout(() => {
        otherColumn.addEventListener('scroll', syncScroll);
    }, 10);


}

function updateProgressDisplay() {
    // Empty function or remove calls to it
    // Or keep minimal logic if needed elsewhere:
    state.currentProgress = (state.currentReviewIndex / state.reviewWords.length) * 100;
}

function createWordCard(word) {
    const card = document.createElement('div');
    card.className = 'word-card';
    card.dataset.id = word.id;
    card.dataset.type = word.type;
    card.dataset.streak = word.streak || 0;
    
    // Add length attribute for Japanese words
    if (word.type === 'japanese') {
        card.dataset.length = word.text.length;
    }

    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = word.text;
    card.appendChild(content);
    
    // Adjust font size based on text length (for Japanese)
    if (word.type === 'japanese') {
        if (word.text.length > 6) { // Longer phrases get smaller font
            content.style.fontSize = '0.9em';
        } else if (word.text.length > 3) { // Medium length
            content.style.fontSize = '1em';
        } else { // Short kanji
            content.style.fontSize = '1.2em';
        }
    }
    
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
        
        if ((word.type === 'japanese' && state.reviewMode === 'medium') ||
            (word.type === 'english' && (state.reviewMode === 'new' || state.reviewMode === 'easy'))) {
                const matchingWord = state.reviewWords.find(w => w.id === word.id);
                if (matchingWord) {
                    speakText(matchingWord.word);
                }
            }
        
        selectCard(this, word.type);
    });
    
    return card;
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
            
            // Check if word should move to next bucket
            if (matchedWord.streak >= 3) {
                moveWordToNextBucket(matchedWord).then(() => {
                    // Update UI after moving bucket
                    updateBucketCounts();
                    
                    // Update streak display to show reset streak
                    leftCard.dataset.streak = 0;
                    rightCard.dataset.streak = 0;
                    leftCard.title = `Streak: 0/3`;
                    rightCard.title = `Streak: 0/3`;
                    
                    const leftProgress = leftCard.querySelector('.streak-progress');
                    const rightProgress = rightCard.querySelector('.streak-progress');
                    if (leftProgress && rightProgress) {
                        leftProgress.style.width = `0%`;
                        rightProgress.style.width = `0%`;
                    }
                    
                    showToast('Correct! Word moved to next bucket', 'success');
                });
            } else {
                // Just update streak display
                updateVocabWord(state.reviewWords[wordIndex]).then(() => {
                    leftCard.dataset.streak = matchedWord.streak;
                    rightCard.dataset.streak = matchedWord.streak;
                    leftCard.title = `Streak: ${matchedWord.streak}/3`;
                    rightCard.title = `Streak: ${matchedWord.streak}/3`;
                    
                    const leftProgress = leftCard.querySelector('.streak-progress');
                    const rightProgress = rightCard.querySelector('.streak-progress');
                    if (leftProgress && rightProgress) {
                        leftProgress.style.width = `${matchedWord.streak * 33.33}%`;
                        rightProgress.style.width = `${matchedWord.streak * 33.33}%`;
                    }
                    
                    showToast(`Correct! Need ${3 - matchedWord.streak} more correct answers to move up`, 'success');
                });
            }
        }
        
        selectedLeftCard = null;
        selectedRightCard = null;
        
        // Check if all cards are matched
        checkRoundCompletion();
    } 
else {
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
    return new Promise((resolve, reject) => {
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
        updateVocabWord(word)
            .then(() => resolve())
            .catch(error => reject(error));
    });
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
            // Review complete - show header and return to vocab review
            setTimeout(() => {
                document.querySelector('header').classList.remove('hidden');
               
                showView('vocab-review-view');
                updateBucketCounts();
                showToast('Review completed!', 'success');
            }, 1500);
        }
    }
}

function setupHardMode() {
    // Hide matching game and show hard mode buttons
elements.shuffleCardsBtn.style.display = 'none';
elements.matchingGameContainer.style.display = 'none';
elements.hardModeContainer.style.display = 'flex';
    
    // Check if review is complete
    if (state.currentReviewIndex >= state.reviewWords.length) {
        elements.reviewQuestion.textContent = "Review complete!";
        elements.hardModeContainer.style.display = 'none';
        return;
    }
    
    // Get current word
    state.currentHardWord = state.reviewWords[state.currentReviewIndex];
    
    // Clear previous content
    elements.reviewQuestion.innerHTML = '';
    
    // Create container for the word and translation
    const container = document.createElement('div');
    container.style.textAlign = 'center';
    container.style.padding = '1rem';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    
    // Display Japanese word with play button
    const wordContainer = document.createElement('div');
    wordContainer.style.display = 'flex';
    wordContainer.style.alignItems = 'center';
    wordContainer.style.marginBottom = '1.5rem';
    
const japaneseWord = document.createElement('div');
const wordText = state.currentHardWord.word;
japaneseWord.textContent = wordText;

// Calculate length and kanji-only status
const hasHiragana = /[\u3040-\u309F]/.test(wordText);
const hasKatakana = /[\u30A0-\u30FF]/.test(wordText);
const isKanjiOnly = !hasHiragana && !hasKatakana;
const length = wordText.length;

// Set data attributes for CSS to use
japaneseWord.dataset.length = Math.min(length, 10); // Cap at 10
japaneseWord.dataset.kanjiOnly = isKanjiOnly;

japaneseWord.style.fontWeight = 'bold';
    
    // Add play button
    const playButton = document.createElement('button');
    playButton.innerHTML = '🔊';
    playButton.style.marginLeft = '1rem';
    playButton.style.background = 'none';
    playButton.style.border = 'none';
    playButton.style.fontSize = '1.5rem';
    playButton.style.cursor = 'pointer';
    playButton.title = 'Play pronunciation';
    playButton.addEventListener('click', () => {
        speakText(state.currentHardWord.word);
    });
    
    wordContainer.appendChild(japaneseWord);
    wordContainer.appendChild(playButton);
    
    // Display translation (hidden by default)
    const translation = document.createElement('div');
    translation.textContent = state.currentHardWord.translation;
    translation.style.fontSize = '1.5rem';
    translation.style.color = 'var(--text-secondary)';
    translation.style.marginBottom = '1.5rem';
    translation.style.display = 'none';
    
    // Show translation button
    const showTranslationBtn = document.createElement('button');
    showTranslationBtn.textContent = 'Show Translation';
    showTranslationBtn.className = 'btn';
    showTranslationBtn.style.marginBottom = '1rem';
    showTranslationBtn.style.backgroundColor = 'var(--accent)';
    showTranslationBtn.addEventListener('click', () => {
        translation.style.display = 'block';
        showTranslationBtn.style.display = 'none';
    });
    
    // Add elements to container
    container.appendChild(wordContainer);
    container.appendChild(showTranslationBtn);
    container.appendChild(translation);
    
    // Add container to review question
    elements.reviewQuestion.appendChild(container);
    
    // Make sure review question is visible
    elements.reviewQuestion.style.display = 'flex';
    
    // Update progress display
updateReviewProgress();
    const progressText = `Word ${state.currentReviewIndex + 1}/${state.reviewWords.length}`;
    document.getElementById('sentence-counter').textContent = progressText;
    document.getElementById('sentence-counter').style.display = 'block';
    
    // Set up hard mode buttons
    elements.knewItBtn.textContent = 'I Know This';
    elements.didntKnowBtn.textContent = "Don't Know";
    elements.skipBtn.textContent = 'Skip';
    elements.hardModeContainer.style.display = 'flex';
}
// Track selected cards
let selectedLeftCard = null;
let selectedRightCard = null;

function selectCard(cardElement, cardType) {
    if (cardElement.classList.contains('correct')) {
        return;
    }

    if (cardElement.classList.contains('incorrect')) {
        cardElement.classList.remove('incorrect');
    }

    // Determine if card is in left or right column
    const isLeftColumn = cardElement.parentElement === elements.leftColumn;
    
    if (isLeftColumn) {
        if (selectedLeftCard) {
            selectedLeftCard.classList.remove('selected');
        }
        selectedLeftCard = cardElement;
    } else {
        if (selectedRightCard) {
            selectedRightCard.classList.remove('selected');
        }
        selectedRightCard = cardElement;
    }

    cardElement.classList.add('selected');

    if (selectedLeftCard && selectedRightCard) {
        checkMatch(selectedLeftCard, selectedRightCard);
    }
}


function handleHardModeResponse(knewIt) {
    if (!state.currentHardWord) return;
    
    if (knewIt) {
        // If user knows the word, delete it (retire it)
        const transaction = db.transaction([STORE_VOCAB], 'readwrite');
        const store = transaction.objectStore(STORE_VOCAB);
        store.delete(state.currentHardWord.id);
        
        showToast('Word retired! Great job!', 'success');
    } else {
        // If user doesn't know the word, move it back to "new" bucket
        state.currentHardWord.bucket = 'new';
        state.currentHardWord.streak = 0; // Reset streak
        updateVocabWord(state.currentHardWord);
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
    localStorage.setItem('theme_ja', state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
    elements.themeToggle.textContent = state.theme === 'dark' ? '🌙' : '☀️';
}

// Check clipboard for text to paste

// Function to update vocab tab counter
async function updateVocabTabCounter() {
    try {
        // Initialize DB if not already done
        if (!db) {
            db = await openDatabase();
        }
        const counts = await countVocabByBucket();
        const newWords = counts.new || 0;
        const counter = document.getElementById('new-words-count');
        const vocabTabText = document.getElementById('vocab-tab-text');
        
        if (counter && vocabTabText) {
            if (newWords > 0) {
                counter.textContent = newWords;
                counter.style.display = 'inline-flex';
                vocabTabText.textContent = 'Vocab';
            } else {
                counter.style.display = 'none';
                vocabTabText.textContent = 'Vocab';
            }
        }
    } catch (error) {
        console.error('Error updating vocab counter:', error);
    }
}

// Call this whenever vocab changes (add these calls):
// After adding a new word (in the addVocabWord function):
updateVocabTabCounter();

// After deleting words (in your delete functions):
updateVocabTabCounter();

// On page load:
document.addEventListener('DOMContentLoaded', updateVocabTabCounter);

function setupEventListeners() {
// Back to review button in manage view
document.getElementById('back-to-review-btn').addEventListener('click', () => {
    showView('vocab-review-view');
    updateBucketCounts();
});
// Manage Vocabulary button
document.getElementById('manage-vocab-btn').addEventListener('click', async () => {
    try {
        // Show loading state
        const button = document.getElementById('manage-vocab-btn');
        button.innerHTML = 'Loading... <span class="loading-spinner"></span>';
        
        // Load all vocabulary words
        const allWords = await getAllVocabWords();
        renderVocabList(allWords);
        
        // Update bucket counts in manage view
        const counts = await countVocabByBucket();
        document.getElementById('manage-new-count').textContent = counts.new || 0;
        document.getElementById('manage-easy-count').textContent = counts.easy || 0;
        document.getElementById('manage-medium-count').textContent = counts.medium || 0;
        document.getElementById('manage-hard-count').textContent = counts.hard || 0;
        
        showView('manage-vocab-view');
    } catch (error) {
        console.error('Error loading vocabulary:', error);
        showToast('Failed to load vocabulary', 'error');
    } finally {
        const button = document.getElementById('manage-vocab-btn');
        button.innerHTML = 'Manage Vocabulary';
    }
});
// Handle Import button clicks
document.getElementById('bookmarks-list').addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-url')) {
        const url = e.target.getAttribute('data-url');
        importUrlContent(url);
        // Switch to text import view
        showView('text-import-view');
    }
});

// 1. First declare modal variables
const tutorialModal = document.getElementById('tutorial-modal');
  const closeModal = document.getElementById('close-modal');
  const tutorialSteps = document.querySelectorAll('.tutorial-step');
  const indicators = document.querySelectorAll('.indicator');
  const prevBtn = document.querySelector('.tutorial-prev');
  const nextBtn = document.querySelector('.tutorial-next');
  let currentStep = 0;

  function showStep(stepIndex) {
    tutorialSteps.forEach((step, index) => {
      step.classList.toggle('active', index === stepIndex);
    });
    
    indicators.forEach((indicator, index) => {
      indicator.classList.toggle('active', index === stepIndex);
    });
    
    prevBtn.disabled = stepIndex === 0;
    nextBtn.disabled = stepIndex === tutorialSteps.length - 1;
  }

  // 2. Then add all other event listeners
  document.getElementById('how-it-works-btn').addEventListener('click', () => {
    tutorialModal.classList.add('active');
    showStep(currentStep);
  });
// Translate section: Paste button
document.getElementById('paste-btn').addEventListener('click', async () => {
    try {
        // Check permission first
        const permission = await navigator.permissions.query({name: 'clipboard-read'});
        if (permission.state === 'denied') {
            showToast('Please enable clipboard permissions in your browser settings', 'error');
            return;
        }
        
        const text = await navigator.clipboard.readText();
        if (!text) {
            showToast('No text found in clipboard', 'error');
            return;
        }
        
        // Sanitize text
        const sanitizedText = text.replace(/<[^>]*>?/gm, '');
        elements.textInput.value = sanitizedText;
        elements.charCount.textContent = sanitizedText.length;
        
    } catch (err) {
        console.log('Failed to paste:', err);
        showToast('Paste failed. Please try again or paste manually.', 'error');
    }
});// Add this near other event listener setups

// Translate section: Voice input button
document.getElementById('voice-input-btn-translate').addEventListener('click', function() {
    const lang = navigator.language || 'en-US';
    startVoiceInput(lang, 'translate-input', this);
});

// Translate section: Clear text button
document.getElementById('clear-text-translate').addEventListener('click', function() {
    document.getElementById('translate-input').value = '';
    document.getElementById('translate-char-count').textContent = '0';
    showToast('Text cleared', 'success');
});

// Translate section: View History button
document.getElementById('show-history-btn-translate').addEventListener('click', showHistoryView);
// Favorite button
document.getElementById('favorite-sentence-btn').addEventListener('click', toggleBookmark);

// Clear bookmarks button
document.getElementById('clear-bookmarks-btn').addEventListener('click', clearBookmarks);

// Bookmark removal
document.getElementById('bookmarks-list').addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-bookmark-id')) {
        const id = e.target.getAttribute('data-bookmark-id');
        state.bookmarks = state.bookmarks.filter(b => b.id !== id);
        localStorage.setItem('bookmarks_ja', JSON.stringify(state.bookmarks));
        renderBookmarks();
const undoId = generateUUID();
showToast(`Bookmark removed <button onclick="undoDelete('${undoId}')" style="margin-left: 10px; background: none; border: none; color: var(--highlight); text-decoration: underline; cursor: pointer;">Undo</button>`, 'success');

// Store the deleted item temporarily
state.lastDeleted = { id: id, item: state.bookmarks.find(b => b.id === id) };
setTimeout(() => delete state.lastDeleted, 5000); // Clear after 5 sec
    }
});
// URL saving
document.getElementById('save-url-btn').addEventListener('click', saveCustomUrl);
document.getElementById('custom-url-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveCustomUrl();
});

// Clear URLs button
document.getElementById('clear-bookmarks-btn').addEventListener('click', clearSavedUrls);

// Load saved URLs when library view is shown
document.querySelector('.nav-btn[data-view="bookmarks-view"]').addEventListener('click', () => {
    showView('bookmarks-view');
    renderSavedUrls();
});
// Close modal when clicking outside
tutorialModal.addEventListener('click', (e) => {
  if (e.target === tutorialModal) {
    tutorialModal.classList.remove('active');
  }
});
async function startVoiceInput(lang, targetId, buttonElement) {
    try {
        if (!('webkitSpeechRecognition' in window)) {
            showToast('Voice input not supported in your browser', 'error');
            return;
        }

        const originalButtonContent = buttonElement.innerHTML;
        buttonElement.innerHTML = '🔴 Listening...';
        
        const recognition = new webkitSpeechRecognition();
        recognition.lang = lang;
        recognition.interimResults = false;
        
        recognition.onstart = () => {
            showToast('Listening...', 'info');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            document.getElementById(targetId).value = transcript;
            
            // Update character count
            const charCountElement = targetId === 'text-input' ? 
                document.getElementById('char-count') : 
                document.getElementById('translate-char-count');
            charCountElement.textContent = transcript.length;
            
            showToast('Speech recognized!', 'success');
        };

        recognition.onerror = (event) => {
            let errorMessage = 'Voice input error';
            switch(event.error) {
                case 'not-allowed':
                    errorMessage = 'Microphone access denied. Please allow microphone access.';
                    break;
                case 'no-speech':
                    errorMessage = 'No speech detected. Try again.';
                    break;
                case 'audio-capture':
                    errorMessage = 'Audio capture error. Check your microphone.';
                    break;
                case 'network':
                    errorMessage = 'Network error occurred. Check your connection.';
                    break;
                default:
                    errorMessage = `Voice input error: ${event.error}`;
            }
            showToast(errorMessage, 'error');
            buttonElement.innerHTML = originalButtonContent;
        };

        recognition.onend = () => {
            buttonElement.innerHTML = originalButtonContent;
        };

        recognition.start();
    } catch (error) {
        console.error('Voice input error:', error);
        showToast('Voice input failed. Please ensure you\'re on HTTPS and have granted microphone permissions.', 'error');
        buttonElement.innerHTML = originalButtonContent;
    }
}
    // Initialize settings panel
    initSettingsPanel();
// Initialize view based on initial content
const initialText = elements.textInput.value.trim();
if (initialText.length > 0) {
    const detectedLang = detectLanguage(initialText);
    toggleTranslationMode(detectedLang !== 'ja');
}
// Voice input button
document.getElementById('voice-input-btn').addEventListener('click', function() {
    startVoiceInput('ja-JP', 'text-input', this);
});
  
    // How to use toggle
    elements.howToUseToggle.addEventListener('click', () => {
        elements.howToUseContent.classList.toggle('show');
        elements.howToUseToggle.querySelector('span:last-child').textContent = 
            elements.howToUseContent.classList.contains('show') ? '▲' : '▼';
    });

document.querySelectorAll('.mode-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        toggleTranslationMode(btn.dataset.mode === 'translate');
    });
});



    // History buttons
document.getElementById('show-history-btn').addEventListener('click', showHistoryView);

// Add this new function to hide history after loading
function loadHistoryItem(index) {
    const item = state.textHistory[index];
    elements.textInput.value = item.text;
    elements.charCount.textContent = item.text.length;
    showView('text-import-view');
    document.getElementById('history-view').style.display = 'none'; // Add this line
    showToast('Text loaded from history');
}
    document.getElementById('back-to-import-btn').addEventListener('click', () => showView('text-import-view'));
    document.getElementById('clear-history-btn').addEventListener('click', clearHistory);
    
    // Wipe data button
    document.getElementById('wipe-data-btn').addEventListener('click', showWipeConfirmation);

    // Confirmation dialog buttons
    document.getElementById('confirm-wipe').addEventListener('click', async () => {
        hideWipeConfirmation();
        try {
            await wipeAllData();
            state.sentences = [];
            state.vocabWords = [];
            state.newWordsToday = 0;
            localStorage.setItem('newWordsToday_ja', '0');
            await updateBucketCounts();
            showToast('All data has been deleted', 'success');
            document.querySelector('.nav-btn[data-view="text-import"]').classList.add('active');
            document.querySelector('.nav-btn[data-view="vocab-review"]').classList.remove('active');
            showView('text-import-view');
        } catch (error) {
            console.error('Error wiping data:', error);
            showToast('Failed to delete data', 'error');
        }
    });

    document.getElementById('cancel-wipe').addEventListener('click', hideWipeConfirmation);

    // Clear text button
    elements.clearTextBtn.addEventListener('click', () => {
state.hasProcessedText = false;
        elements.textInput.value = '';
        elements.charCount.textContent = '0';
        showToast('Text cleared', 'success');
    });

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.view === 'home') {
            window.location.href = 'index.html';
            return;
        }
        
        // Update all nav buttons
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Always show the requested view - no automatic switching
        showView(btn.dataset.view + '-view');
    });
});    // Text import
    elements.textInput.addEventListener('input', () => {
        const text = elements.textInput.value;
        elements.charCount.textContent = text.length;
        
        // Auto-detect language
        if (text.trim().length > 0) {
            const detectedLang = detectLanguage(text);
            if (detectedLang === 'ja') {
    toggleTranslationMode(false); // Show import view
} else {
    toggleTranslationMode(true); // Show translate view
}
        }
    });

    // Translate input
    document.getElementById('translate-input').addEventListener('input', () => {
        const text = document.getElementById('translate-input').value;
        document.getElementById('translate-char-count').textContent = text.length;
    });


// Paste button
document.getElementById('paste-btn').addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        // Rest of the code remains the same
        if (text) {
            elements.textInput.value = text;
            elements.charCount.textContent = text.length;
            
            // Auto-detect language
            const detectedLang = detectLanguage(text);
            if (detectedLang === 'ja') {
                document.querySelector('.mode-toggle-btn[data-mode="import"]').click();
            } else {
                document.querySelector('.mode-toggle-btn[data-mode="translate"]').click();
            }
        }
    } catch (err) {
        console.log('Failed to paste:', err);
        showToast('Paste failed. Please try again.', 'error');
    }
});


// Open modal
document.getElementById('how-it-works-btn').addEventListener('click', () => {
  tutorialModal.classList.add('active');
  showStep(currentStep);
});

// Close modal
closeModal.addEventListener('click', () => {
  tutorialModal.classList.remove('active');
});

// Navigation
prevBtn.addEventListener('click', () => {
  if (currentStep > 0) {
    currentStep--;
    showStep(currentStep);
  }
});

nextBtn.addEventListener('click', () => {
  if (currentStep < tutorialSteps.length - 1) {
    currentStep++;
    showStep(currentStep);
  }
});

// Indicator clicks
indicators.forEach((indicator, index) => {
  indicator.addEventListener('click', () => {
    currentStep = index;
    showStep(currentStep);
  });
});

function showStep(stepIndex) {
  tutorialSteps.forEach((step, index) => {
    step.classList.toggle('active', index === stepIndex);
  });
  
  indicators.forEach((indicator, index) => {
    indicator.classList.toggle('active', index === stepIndex);
  });
  
  prevBtn.disabled = stepIndex === 0;
  nextBtn.disabled = stepIndex === tutorialSteps.length - 1;
}

// Demo text button
document.getElementById('try-demo-btn').addEventListener('click', () => {
  const demoText = `日本の文化は世界的に有名です。寿司やアニメ、桜などが特に人気があります。
東京は日本の首都で、多くの観光客が訪れます。日本語を学ぶことは楽しいですよ！`;
  
  elements.textInput.value = demoText;
  elements.charCount.textContent = demoText.length;
  showToast('Demo text loaded! Click "Process Text" to start', 'success');
});

// Process text button event listener
elements.processTextBtn.addEventListener('click', async () => {
        const text = elements.textInput.value.trim();
        if (text.length === 0) {
            showToast('Please enter some text', 'error');
            return;
        }
        
// Save to history with title and progress
const title = prompt("Give this text a title (or leave blank for automatic title):", text.substring(0, 20) + (text.length > 20 ? "..." : ""));
const textTitle = title || text.substring(0, 20) + (text.length > 20 ? "..." : "");
state.textHistory.unshift({
    text: text,
    title: textTitle,
    timestamp: new Date().toISOString(),
    progress: 0 // Starts at 0% progress
});

// Also save to bookmarks with the actual text content
state.bookmarks.unshift({
    id: generateUUID(),
    sentence: text, // Store the actual text content
    translation: "",
    date: new Date().toISOString(),
    title: textTitle // Also store the title for display
});
localStorage.setItem('bookmarks_ja', JSON.stringify(state.bookmarks));
        
        if (state.textHistory.length > 10) {
            state.textHistory = state.textHistory.slice(0, 10);
        }
        
        localStorage.setItem('textHistory_ja', JSON.stringify(state.textHistory));
                    
        if (text.length > 5000) {
            showToast('Text exceeds 5000 characters', 'error');
            return;
        }
        
        const sentences = splitSentences(text);
        
        if (sentences.length === 0) {
            showToast('No sentences found in text', 'error');
            return;
        }
        
        const sentenceObjects = sentences.map((sentence, index) => ({
            id: generateUUID(),
            original: sentence,
            user_translation: '',
            position: index
        }));
        
        try {
            elements.processTextBtn.innerHTML = '<span>Processing...</span><span class="loading-spinner"></span>';
            await addSentences(sentenceObjects);
state.hasProcessedText = true;
                    state.sentences = await getAllSentences();
const savedPosition = JSON.parse(localStorage.getItem('lastSentencePosition_ja')) || 0;
state.currentSentenceIndex = Math.min(savedPosition, state.sentences.length - 1);
            
showView('reading-view');
            displaySentence();
            showToast(`Processed ${sentences.length} sentences!`, 'success');
        } catch (error) {
            console.error('Error saving sentences:', error);
            showToast('Error processing text', 'error');
        } finally {
            elements.processTextBtn.innerHTML = '<span>Process Text</span>';
        }
    });

document.getElementById('translate-to-japanese').addEventListener('click', async function() {
    const text = document.getElementById('translate-input').value.trim();
    if (text.length === 0) {
        showToast('Please enter some text to translate', 'error');
        return;
    }

    try {
        const button = this;
        button.innerHTML = '<span>Translating...</span><span class="loading-spinner"></span>';
        button.disabled = true;
        
        showToast('Translating...', 'info');
        
        const sourceLang = detectLanguage(text) || 'en';
        const translatedText = await translateToJapanese(text, sourceLang);
        
        if (translatedText) {
        const textInput = document.getElementById('text-input');
        textInput.value = translatedText;
        document.getElementById('char-count').textContent = translatedText.length;
        showView('text-import-view');
        textInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        textInput.focus();
            
            showToast('Translation complete! Review and click "Process Text" to continue', 'success');
            
            const importButton = document.querySelector('.mode-toggle-btn[data-mode="import"]');
            if (importButton) {
                importButton.click();
            }
        } else {
            showToast('Translation failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Translation error:', error);
        showToast('Translation failed: ' + error.message, 'error');
    } finally {
        const button = document.getElementById('translate-to-japanese');
        button.innerHTML = '<span>Translate to Japanese</span>';
        button.disabled = false;
    }
});
    elements.prevSentenceBtn.addEventListener('click', () => {
        if (state.currentSentenceIndex > 0) {
            state.currentSentenceIndex--;
            elements.sentenceDisplay.classList.remove('current-sentence');
            displaySentence();
        }
    });

    elements.translateBtn.addEventListener('click', translateCurrentSentence);

    elements.nextSentenceBtn.addEventListener('click', () => {
        if (state.currentSentenceIndex < state.sentences.length - 1) {
            state.currentSentenceIndex++;
            elements.sentenceDisplay.classList.remove('current-sentence');
            displaySentence();
        }
    });
    
    elements.ttsButton.addEventListener('click', () => {
        if (state.sentences.length > 0) {
            const sentence = state.sentences[state.currentSentenceIndex].original;
            speakText(sentence);
        }
    });

    // Add this at the top with your other element declarations
elements.playSelectedWord = document.getElementById('play-selected-word');

// Then update the event listeners
elements.sentenceDisplay.addEventListener('mouseup', handleTextSelection);
elements.sentenceDisplay.addEventListener('touchend', handleTextSelection);
elements.playSelectedWord.addEventListener('click', () => {
    const word = elements.selectedWord.textContent;
    if (word) {
        speakText(word);
    }
});

function handleTextSelection() {
    const selection = window.getSelection().toString().trim();
    
    if (selection.length > 0) {
        elements.selectedWord.textContent = selection;
        elements.vocabTranslation.value = '';
        elements.wordSelectionBox.style.display = 'block';
        elements.vocabTranslation.focus();
        
        // Show/hide TTS button based on selection
        elements.playSelectedWord.style.display = selection ? 'block' : 'none';
        
        if (window.innerWidth <= 600) {
            elements.wordSelectionBox.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

document.getElementById('lookup-word').addEventListener('click', async () => {
    const word = document.getElementById('selected-word').textContent;
    if (!word) {
        showToast('No word selected', 'error');
        return;
    }

    try {
        document.getElementById('lookup-word').innerHTML = 'Searching...';
        
        const entriesContainer = document.getElementById('dictionary-entries');
        entriesContainer.innerHTML = '';

        if (localDictionary[word]) {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'dictionary-entry';
            entryDiv.innerHTML = `<strong>${word}</strong><br>${localDictionary[word]}`;
            entryDiv.addEventListener('click', () => {
                document.getElementById('vocab-translation').value = localDictionary[word];
                document.getElementById('dictionary-results').style.display = 'none';
            });
            entriesContainer.appendChild(entryDiv);
            document.getElementById('dictionary-results').style.display = 'block';
            return;
        }

        if (state.isOnline) {
            const apiUrl = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            
            let response;
            try {
                response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
                if (!response.ok) throw new Error('API request failed');
            } catch (error) {
                console.error('Dictionary lookup error:', error);
                showToast('Dictionary lookup failed. Try again later.', 'error');
                return;
            }

            const data = await response.json();

            if (data.data && data.data.length > 0) {
                data.data.slice(0, 5).forEach(entry => {
                    const entryDiv = document.createElement('div');
                    entryDiv.className = 'dictionary-entry';
                    
                    entryDiv.innerHTML = `
                        <strong>${entry.japanese[0]?.word || entry.japanese[0]?.reading || word}</strong><br>
                        ${entry.senses[0]?.english_definitions?.join(', ') || 'No definition found'}
                    `;
                    
                    entryDiv.addEventListener('click', () => {
                        document.getElementById('vocab-translation').value = 
                            entry.senses[0]?.english_definitions[0] || 'No definition found';
                        document.getElementById('dictionary-results').style.display = 'none';
                    });
                    
                    entriesContainer.appendChild(entryDiv);
                });
                document.getElementById('dictionary-results').style.display = 'block';
            } else {
                showToast('No dictionary results found', 'error');
            }
        } else {
            showToast('No local definition found (offline)', 'error');
        }
    } catch (error) {
        console.error('Dictionary error:', error);
        showToast('Dictionary lookup failed. Try again later.', 'error');
    } finally {
        document.getElementById('lookup-word').innerHTML = 'Lookup in Dictionary';
    }
});

    elements.addToVocabBtn.addEventListener('click', async () => {
        const word = elements.selectedWord.textContent;
        const translation = elements.vocabTranslation.value.trim();
        
        if (!translation) {
            showToast('Please enter a translation', 'error');
            return;
        }
        
        const newWord = {
            id: generateUUID(),
            word: word,
            translation: translation,
            sentence_id: state.sentences[state.currentSentenceIndex].id,
            bucket: 'new',
            streak: 0,
            consecutiveMisses: 0,
            favorite: false
        };
        
        try {
            await addVocabWord(newWord);
            showToast(`"${word}" added to vocabulary!`, 'success');
            elements.wordSelectionBox.style.display = 'none';
            updateBucketCounts();
        } catch (error) {
            if (error.message === 'Word already exists in vocabulary') {
                showToast(`"${word}" is already in your vocabulary!`, 'error');
            } else {
                showToast('Error adding word', 'error');
                console.error(error);
            }
        }
    });

document.querySelectorAll('.bucket-card').forEach(card => {
    card.addEventListener('click', () => {
        elements.reviewQuestion.innerHTML = '';
        elements.leftColumn.innerHTML = '';
        elements.rightColumn.innerHTML = '';
        elements.reviewQuestion.style.display = 'none';
        elements.matchingGameContainer.style.display = 'none';
        elements.hardModeContainer.style.display = 'none';
        
        document.querySelectorAll('.bucket-card').forEach(c => {
            c.style.opacity = '1';
            c.style.transform = 'scale(1)';
        });
        
        card.style.opacity = '0.9';
        card.style.transform = 'scale(0.98)';
        state.reviewMode = card.dataset.bucket;
        
        elements.startReviewBtn.disabled = false;
        elements.startReviewBtn.textContent = `Review ${card.dataset.bucket} words`;
    });
});
    
    elements.startReviewBtn.addEventListener('click', () => {
        if (state.reviewMode) {
            startReview(state.reviewMode);
        }
    });
if (elements.exitReviewBtn) {
    elements.exitReviewBtn.addEventListener('click', () => {
        // Show header when exiting review
        const header = document.querySelector('header');
        
        if (header) header.classList.remove('hidden');
        if (hideHeaderBtn) hideHeaderBtn.classList.remove('visible');
        
        state.currentHardStreak = 0; // Reset streak when exiting
        showView('vocab-review-view');
    });
}

const exitHardBtn = document.getElementById('exit-hard-btn');
if (exitHardBtn) {
    exitHardBtn.addEventListener('click', () => {
        const header = document.querySelector('header');

        
        if (header) header.classList.remove('hidden');
        if (hideHeaderBtn) hideHeaderBtn.classList.remove('visible');
        
        state.currentHardStreak = 0; // Reset streak when exiting
        showView('vocab-review-view');
    });
}

    elements.knewItBtn.addEventListener('click', () => {
        handleHardModeResponse(true);
    });

    elements.didntKnowBtn.addEventListener('click', () => {
        handleHardModeResponse(false);
    });

    elements.skipBtn.addEventListener('click', () => {
        state.currentReviewIndex++;
        if (state.currentReviewIndex < state.reviewWords.length) {
            setupHardMode();
        } else {
            showView('vocab-review-view');
            updateBucketCounts();
        }
    });

    elements.shuffleCardsBtn.addEventListener('click', () => {
        if (state.reviewMode && state.reviewMode !== 'hard') {
            setupMatchingGame();
        }
    });

    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.soundToggle.addEventListener('click', toggleSounds);

document.addEventListener('keydown', (e) => {
    if (state.currentView === 'reading-view') {
        if (e.key === 'ArrowLeft') {
            elements.prevSentenceBtn.click();
        } else if (e.key === 'ArrowRight') {
            elements.nextSentenceBtn.click();
        } else if (e.key === ' ') {
            if (state.currentTtsUtterance && window.speechSynthesis.speaking) {
                if (window.speechSynthesis.paused) {
                    resumeTTS();
                } else {
                    pauseTTS();
                }
            } else {
                elements.ttsButton.click();
            }
            e.preventDefault(); // Prevent scrolling
        } else if (e.key === 't' || e.key === 'T') {
            elements.floatingTranslationToggle.click();
} else if (e.key === 'f' || e.key === 'F') {
    document.getElementById('favorite-sentence-btn').click();
}
    } 
    
if (state.currentView === 'review-mode-view' && state.reviewMode === 'hard') {
        if (e.key === 'Enter') {
            elements.knewItBtn.click();
        } else if (e.key === 'Escape') {
            elements.didntKnowBtn.click();
        } else if (e.key === ' ') {
            elements.skipBtn.click();
            e.preventDefault();
        }
    }
    
    if (document.activeElement === elements.vocabTranslation && e.key === 'Enter') {
        elements.addToVocabBtn.click();
    }
});

    window.addEventListener('online', () => {
        state.isOnline = true;
        elements.offlineWarning.style.display = 'none';
    });

    window.addEventListener('offline', () => {
        state.isOnline = false;
        elements.offlineWarning.style.display = 'block';
    });
}

async function initApp() {
    try {
        // First verify database integrity
        const dbValid = await verifyDatabaseIntegrity();
        if (!dbValid) {
            throw new Error('Database integrity check failed');
        }
        
        // Load initial data
        state.sentences = await getAllSentences();
        await updateBucketCounts();
        
        // Set up UI
        document.querySelector('.nav-btn[data-view="text-import"]').classList.add('active');
        document.querySelector('.nav-btn[data-view="vocab-review"]').classList.remove('active');
        showView('text-import-view');
        
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
        
        // Initialize audio
        initAudio();
        elements.soundToggle.textContent = state.soundsEnabled ? '🔊' : '🔇';
        
        // Set up TTS if available
        if ('speechSynthesis' in window) {
            speechSynthesis.getVoices();
        }
        
        // Check network status
        state.isOnline = navigator.onLine;
        elements.offlineWarning.style.display = state.isOnline ? 'none' : 'block';
        
        // Set up event listeners
        setupEventListeners();
        
        // Add periodic data sync to localStorage as backup
        setInterval(async () => {
            try {
                const vocab = await getAllVocabWords();
                localStorage.setItem('vocab_backup', JSON.stringify(vocab));
            } catch (error) {
                console.error('Failed to backup vocab:', error);
            }
        }, 60000); // Backup every minute
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize app', 'error');
        
        try {
            // Try to recover by deleting and recreating the database
            if (db) {
                db.close();
            }
            
            await new Promise((resolve, reject) => {
                const req = indexedDB.deleteDatabase(DB_NAME);
                req.onsuccess = () => {
                    console.log('Database deleted successfully');
                    resolve();
                };
                req.onerror = (event) => {
                    console.error('Error deleting database:', event.target.error);
                    reject(event.target.error);
                };
                req.onblocked = () => {
                    console.warn('Database deletion blocked - refreshing page');
                    window.location.reload();
                };
            });
            
            // Try to restore from localStorage backup if available
            const backup = localStorage.getItem('vocab_backup');
            if (backup) {
                try {
                    const vocab = JSON.parse(backup);
                    db = await openDatabase();
                    const tx = db.transaction(STORE_VOCAB, 'readwrite');
                    const store = tx.objectStore(STORE_VOCAB);
                    await Promise.all(vocab.map(word => store.put(word)));
                    showToast('Restored vocabulary from backup', 'success');
                } catch (restoreError) {
                    console.error('Failed to restore backup:', restoreError);
                }
            }
            
            window.location.reload();
        } catch (recoveryError) {
            console.error('Recovery failed:', recoveryError);
            showToast('Failed to initialize app. Please refresh the page.', 'error');
        }
    }
}
async function backupVocabToLocalStorage() {
    try {
        const vocab = await getAllVocabWords();
        localStorage.setItem('vocab_backup', JSON.stringify(vocab));
        console.log('Vocab backed up to localStorage');
        return true;
    } catch (error) {
        console.error('Failed to backup vocab:', error);
        return false;
    }
}

async function restoreVocabFromLocalStorage() {
    try {
        const backup = localStorage.getItem('vocab_backup');
        if (!backup) return false;
        
        const vocab = JSON.parse(backup);
        if (!Array.isArray(vocab)) return false;
        
        const tx = db.transaction(STORE_VOCAB, 'readwrite');
        const store = tx.objectStore(STORE_VOCAB);
        
        await Promise.all(vocab.map(word => {
            return new Promise((resolve, reject) => {
                const request = store.put(word);
                request.onsuccess = resolve;
                request.onerror = reject;
            });
        }));
        
        console.log(`Restored ${vocab.length} words from backup`);
        return true;
    } catch (error) {
        console.error('Failed to restore vocab:', error);
        return false;
    }
}
// Translate word button
document.getElementById('translate-word').addEventListener('click', async function() {
    const word = document.getElementById('selected-word').textContent;
    if (!word) {
        showToast('No word selected', 'error');
        return;
    }

    try {
        const button = this;
        button.innerHTML = '<span>Translating...</span><span class="loading-spinner"></span>';
        button.disabled = true;
        
        showToast('Translating...', 'info');
        
        // Use the existing translateSentence function
        const translation = await translateSentence(word);
        
        if (translation) {
            document.getElementById('vocab-translation').value = translation;
            showToast('Translation complete!', 'success');
        } else {
            showToast('Translation failed', 'error');
        }
    } catch (error) {
        console.error('Translation error:', error);
        showToast('Translation failed: ' + error.message, 'error');
    } finally {
        const button = document.getElementById('translate-word');
        button.innerHTML = '<span>Translate</span>';
        button.disabled = false;
    }
});
function getFirstChar(word) {
    if (!word || typeof word !== 'string' || word.length === 0) {
        return 'a'; // default fallback
    }
    
    const firstChar = word[0].toLowerCase();
    
    if (!/[a-z]/.test(firstChar)) {
        return 'a';
    }
    
    return firstChar;
}
document.getElementById('search-sentences-btn').addEventListener('click', searchSentences);
async function searchSentences() {
    const searchBtn = document.getElementById('search-sentences-btn');
    const statusElement = document.getElementById('sentence-search-status');
    
    try {
        searchBtn.disabled = true;
        searchBtn.innerHTML = 'Searching... <span class="loading-spinner"></span>';
        statusElement.textContent = 'Searching...';
        
        const searchInput = document.getElementById('sentence-search-input').value.trim();
        if (!searchInput) {
            showToast('Please enter a word to search', 'error');
            return;
        }

        const resultsContainer = document.getElementById('sentence-results');
        const resultsList = document.getElementById('sentence-results-list');
        
        resultsList.innerHTML = '';
        resultsContainer.style.display = 'none';
        
        let sentences = await searchWithFallbacks(searchInput);
        
        if (sentences.length === 0) {
            statusElement.textContent = 'No sentences found containing this word.';
            document.getElementById('sentence-count').textContent = '0';
            return;
        }
        
        document.getElementById('sentence-count').textContent = sentences.length;
        displaySentenceResults(sentences);
        resultsContainer.style.display = 'block';
        statusElement.textContent = `Found ${sentences.length} sentence(s) containing "${searchInput}"`;
        
    } catch (error) {
        console.error('Sentence search error:', error);
        statusElement.textContent = 'Error searching for sentences. Please try again.';
        showToast('Search failed: ' + error.message, 'error');
    } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = 'Search';
    }
}

async function searchWithFallbacks(word) {
    let sentences = searchLocalSentences(word);
    if (sentences.length > 0) return sentences;
    
    try {
        const tatoebaResults = await searchTatoeba(word);
        if (tatoebaResults.length > 0) return tatoebaResults;
    } catch (e) {
        console.log('Tatoeba search failed:', e);
    }
    
    try {
        const tanakaResults = await searchTanakaCorpus(word);
        if (tanakaResults.length > 0) return tanakaResults;
    } catch (e) {
        console.log('Tanaka Corpus search failed:', e);
    }
    
    try {
        return await searchJishoSentences(word);
    } catch (e) {
        console.log('Jisho search failed:', e);
        return [];
    }
}

function searchLocalSentences(word) {
    const localDatabase = {
        "政府": [
            {
                japanese: "政府は新しい政策を発表しました。",
                english: "The government announced a new policy."
            },
            {
                japanese: "政府の決定に反対するデモが行われた。",
                english: "A protest was held against the government's decision."
            }
        ],
        "専門家": [
            {
                japanese: "専門家によると、この現象は珍しいそうです。",
                english: "According to experts, this phenomenon is rare."
            }
        ]
    };
    return localDatabase[word] || [];
}

async function searchTatoeba(word) {
    const proxyUrl = 'https://api.allorigins.win/get?url=';
    const tatoebaUrl = `https://tatoeba.org/en/api_v0/search?from=jpn&to=eng&query=${encodeURIComponent(word)}&trans_to=eng&trans_link=direct&sort=relevance`;
    
    const response = await fetch(proxyUrl + encodeURIComponent(tatoebaUrl));
    const data = await response.json();
    
    if (data.contents) {
        const jsonData = JSON.parse(data.contents);
        if (jsonData.results) {
            return jsonData.results.map(item => ({
                japanese: cleanJapaneseText(item.text),
                english: item.translations[0]?.text || ''
            }));
        }
    }
    return [];
}

async function searchTanakaCorpus(word) {
    const firstChar = getFirstChar(word);
    const tanakaUrl = `https://www.manythings.org/japanese/sentences/data/${firstChar}/${encodeURIComponent(word)}.json`;
    const response = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(tanakaUrl));
    
    const data = await response.json();
    if (data.contents) {
        const jsonData = JSON.parse(data.contents);
        if (Array.isArray(jsonData)) {
            return jsonData.map(item => ({
                japanese: cleanJapaneseText(item.japanese),
                english: item.english
            }));
        }
    }
    return [];
}

async function searchJishoSentences(word) {
    const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}%20%23sentences`);
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
        return data.data.slice(0, 5).map(item => ({
            japanese: cleanJapaneseText(item.japanese[0]?.word || ''),
            english: item.senses[0]?.english_definitions?.join(', ') || ''
        }));
    }
    return [];
}

function displaySentenceResults(sentences) {
    const resultsList = document.getElementById('sentence-results-list');
    
    sentences.forEach(sentence => {
        const item = document.createElement('div');
        item.className = 'sentence-result-item';
        
        item.innerHTML = `
            <div class="sentence-japanese">${sentence.japanese}</div>
            <div class="sentence-english">${sentence.english}</div>
            <div class="sentence-actions">
                <button class="copy-sentence-btn" data-japanese="${sentence.japanese}" 
                        data-english="${sentence.english}">
                    📋 Copy
                </button>
                <button class="use-sentence-btn" data-japanese="${sentence.japanese}">
                    ✏️ Use in Reader
                </button>
            </div>
        `;
        
        resultsList.appendChild(item);
    });
    
    resultsList.querySelectorAll('.copy-sentence-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const japanese = e.target.getAttribute('data-japanese');
            const english = e.target.getAttribute('data-english');
            navigator.clipboard.writeText(`${japanese}\n${english}`);
            showToast('Sentence copied to clipboard!', 'success');
        });
    });
    
    resultsList.querySelectorAll('.use-sentence-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const japanese = e.target.getAttribute('data-japanese');
            document.getElementById('text-input').value = japanese;
            document.getElementById('char-count').textContent = japanese.length;
            showView('text-import-view');
            document.getElementById('text-input').focus();
            showToast('Sentence loaded into reader. Click "Process Text" to continue.', 'success');
        });
    });
}

function getFirstChar(word) {
    return word[0].toLowerCase().match(/[a-z]/) ? word[0].toLowerCase() : 'a';
}

function cleanJapaneseText(text) {
    if (!text) return '';
    
    text = text.replace(/[（\(][^）\)]+[）\)]/g, ''); // (furigana)
    text = text.replace(/[［\[].[^］\]]+[］\]]/g, ''); // [furigana]
    text = text.replace(/【[^】]+】/g, ''); // 【furigana】
    
    text = text.replace(/<rt>.*?<\/rt>/g, '');
    text = text.replace(/<rp>.*?<\/rp>/g, '');
    
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
}

async function searchJishoSentences(word) {
    try {
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const jishoUrl = `https://jisho.org/search/${encodeURIComponent(word)}%20%23sentences`;
        
        const response = await fetch(proxyUrl + encodeURIComponent(jishoUrl));
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const sentences = [];
        const sentenceElements = doc.querySelectorAll('.sentence_content');
        
        sentenceElements.forEach(el => {
            const japanese = el.querySelector('.japanese_sentence')?.textContent?.trim();
            const english = el.querySelector('.english_sentence')?.textContent?.trim();
            
            if (japanese && english) {
                sentences.push({ japanese, english });
            }
        });
        
        return sentences.slice(0, 10); // Return max 10 sentences
        
    } catch (error) {
        console.error('Jisho search error:', error);
        return [];
    }
}

window.addEventListener('DOMContentLoaded', initApp);
let touchStartX = 0;

function handleTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX;
}
document.getElementById('import-all-btn').addEventListener('click', importAllSentences);

function importAllSentences() {
    const sentenceItems = document.querySelectorAll('.sentence-result-item');
    const sentencesToImport = [];
    
    sentenceItems.forEach(item => {
        const japanese = item.querySelector('.sentence-japanese').textContent;
        sentencesToImport.push(japanese);
    });

    if (sentencesToImport.length === 0) {
        showToast('No sentences to import', 'error');
        return;
    }

    const combinedText = sentencesToImport.join('\n\n');
    document.getElementById('text-input').value = combinedText;
    document.getElementById('char-count').textContent = combinedText.length;
    showToast(`Imported ${sentencesToImport.length} sentences!`, 'success');
}
function importSentences() {
    const sentenceItems = document.querySelectorAll('.sentence-result-item');
    const totalCount = sentenceItems.length;
    
    if (totalCount === 0) {
        showToast('No sentences to import', 'error');
        return;
    }

    const sentencesToImport = [];
    for (let i = 0; i < totalCount; i++) {
        const japanese = sentenceItems[i].querySelector('.sentence-japanese').textContent;
        sentencesToImport.push(japanese);
    }

    const combinedText = sentencesToImport.join('\n\n');
    
    document.getElementById('text-input').value = combinedText;
    document.getElementById('char-count').textContent = combinedText.length;
    
    showToast(`Imported ${totalCount} ${totalCount === 1 ? 'sentence' : 'sentences'}!`, 'success');
}
function handleTouchEnd(e) {
  const touchEndX = e.changedTouches[0].screenX;
  if (touchEndX < touchStartX - 50) { // Swipe left = next
    document.getElementById('next-sentence').click();
  } else if (touchEndX > touchStartX + 50) { // Swipe right = previous
    document.getElementById('prev-sentence').click();
  }
}
function undoDelete(id) {
  if (state.lastDeleted && state.lastDeleted.id === id) {
    state.bookmarks.push(state.lastDeleted.item);
    localStorage.setItem('bookmarks_ja', JSON.stringify(state.bookmarks));
    renderBookmarks();
    showToast('Bookmark restored!', 'success');
  }
}
