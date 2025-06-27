// Polyglot Learner - Shared JavaScript for all languages
// Initialize app state
const appState = {
    currentLanguage: document.body.getAttribute('data-language') || 'ja',
    theme: localStorage.getItem('theme') || 'dark',
    soundsEnabled: localStorage.getItem('soundsEnabled') !== 'false',
    audioContext: null,
    sounds: {},
    isOnline: navigator.onLine,
    currentTtsSpeed: parseFloat(localStorage.getItem('ttsSpeed')) || 1.0,
    currentTtsUtterance: null,
    wordLookupCache: {},
    
    // Language-specific configurations
    languageConfigs: {
        ja: {
            ttsLang: 'ja-JP',
            dictionaryAPI: 'https://jisho.org/api/v1/search/words',
            translationAPI: 'https://api.mymemory.translated.net/get',
            resources: [
                { name: "NHK Easy News", url: "https://www3.nhk.or.jp/news/easy/" },
                { name: "Yahoo Japan News", url: "https://news.yahoo.co.jp/" }
            ]
        },
        es: {
            ttsLang: 'es-ES',
            dictionaryAPI: 'https://api.dictionaryapi.dev/api/v2/entries/es',
            translationAPI: 'https://api.mymemory.translated.net/get',
            resources: [
                { name: "BBC Mundo", url: "https://www.bbc.com/mundo" },
                { name: "El País", url: "https://elpais.com/" }
            ]
        }
    },
    
    // Initialize with default values
    init: function() {
        this.applyTheme();
        this.setupEventListeners();
        this.checkOnlineStatus();
    },
    
    // Apply saved theme
    applyTheme: function() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.textContent = this.theme === 'dark' ? '🌙' : '☀️';
        }
    },
    
    // Toggle theme
    toggleTheme: function() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', this.theme);
        this.applyTheme();
    },
    // Text input functionality
function setupTextInput() {
    const textInput = document.getElementById('text-input');
    const charCount = document.getElementById('char-count');
    
    if (textInput && charCount) {
        textInput.addEventListener('input', () => {
            charCount.textContent = textInput.value.length;
        });
    }
}
// Paste button functionality
document.getElementById('paste-btn')?.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('text-input').value = text;
        document.getElementById('char-count').textContent = text.length;
    } catch (err) {
        appState.showToast('Failed to paste from clipboard', 'error');
    }
});
// Add this to your DOMContentLoaded event:
document.addEventListener('DOMContentLoaded', function() {
    appState.init();
    setupButtonFunctionality();
    setupTextInput();
    
    if (typeof initLanguageApp === 'function') {
        initLanguageApp();
    }
});
    // Initialize audio
    initAudio: function() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Correct answer sound
            this.sounds.correct = () => {
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                osc.type = 'triangle';
                osc.frequency.value = 880;
                gain.gain.value = 0.5;
                
                osc.connect(gain);
                gain.connect(this.audioContext.destination);
                
                osc.start();
                osc.frequency.exponentialRampToValueAtTime(1760, this.audioContext.currentTime + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
                osc.stop(this.audioContext.currentTime + 0.3);
            };
            
            // Incorrect answer sound
            this.sounds.incorrect = () => {
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                osc.type = 'sawtooth';
                osc.frequency.value = 220;
                gain.gain.value = 0.5;
                
                osc.connect(gain);
                gain.connect(this.audioContext.destination);
                
                osc.start();
                osc.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + 0.3);
                gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
                osc.stop(this.audioContext.currentTime + 0.5);
            };
        } catch (e) {
            console.warn('Audio initialization failed:', e);
            this.soundsEnabled = false;
        }
    },
    
    // Play sound if enabled
    playSound: function(name) {
        if (this.soundsEnabled && this.sounds[name]) {
            try {
                this.sounds[name]();
            } catch (e) {
                console.warn('Sound playback failed:', e);
            }
        }
    },
    
    // Toggle sound on/off
    toggleSounds: function() {
        this.soundsEnabled = !this.soundsEnabled;
        localStorage.setItem('soundsEnabled', this.soundsEnabled);
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.textContent = this.soundsEnabled ? '🔊' : '🔇';
        }
        this.showToast(`Sounds ${this.soundsEnabled ? 'enabled' : 'disabled'}`);
    },
    
    // Text-to-speech functionality
    speakText: function(text, rate = null) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.languageConfigs[this.currentLanguage].ttsLang;
            utterance.rate = rate || this.currentTtsSpeed;
            
            this.currentTtsUtterance = utterance;
            
            if (speechSynthesis.getVoices().length === 0) {
                speechSynthesis.onvoiceschanged = () => {
                    const voices = speechSynthesis.getVoices();
                    const voice = voices.find(v => 
                        v.lang === this.languageConfigs[this.currentLanguage].ttsLang || 
                        v.lang.startsWith(this.currentLanguage)
                    );
                    
                    if (voice) {
                        utterance.voice = voice;
                    }
                    
                    speechSynthesis.speak(utterance);
                };
                speechSynthesis.getVoices();
            } else {
                const voices = speechSynthesis.getVoices();
                const voice = voices.find(v => 
                    v.lang === this.languageConfigs[this.currentLanguage].ttsLang || 
                    v.lang.startsWith(this.currentLanguage)
                );
                
                if (voice) {
                    utterance.voice = voice;
                }
                
                speechSynthesis.speak(utterance);
            }
        }
    },
    
    // Toast notification
    showToast: function(message, type = '') {
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
        }, 3000);
    },
    
    // Check online status
    checkOnlineStatus: function() {
        const offlineWarning = document.getElementById('offline-warning');
        if (offlineWarning) {
            offlineWarning.style.display = this.isOnline ? 'none' : 'block';
        }
    },
    
    // Setup event listeners
    setupEventListeners: function() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // Sound toggle
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => this.toggleSounds());
        }
        
        // Online/offline detection
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.checkOnlineStatus();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.checkOnlineStatus();
        });
    },
    
    // Helper function to generate UUID
    generateUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    
    // Helper function to shuffle array
    shuffleArray: function(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
};
// Button functionality setup
function setupButtonFunctionality() {
    // Settings panel toggle
    const settingsBtn = document.getElementById('settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsOverlay = document.getElementById('settings-overlay');

    if (settingsBtn && settingsPanel) {
        settingsBtn.addEventListener('click', () => {
            settingsPanel.classList.add('open');
            settingsOverlay.classList.add('open');
        });

        closeSettingsBtn.addEventListener('click', () => {
            settingsPanel.classList.remove('open');
            settingsOverlay.classList.remove('open');
        });

        settingsOverlay.addEventListener('click', () => {
            settingsPanel.classList.remove('open');
            settingsOverlay.classList.remove('open');
        });
    }

    // View switching
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            switchView(view);
        });
    });

    // Mode toggle
    const modeToggleBtns = document.querySelectorAll('.mode-toggle-btn');
    modeToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            toggleMode(mode);
        });
    });
}

function switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // Show selected view
    document.getElementById(`${viewId}-view`).classList.add('active');

    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.nav-btn[data-view="${viewId}"]`).classList.add('active');
}

function toggleMode(mode) {
    const importContainer = document.getElementById('import-container');
    const translateContainer = document.getElementById('translate-container');
    const modeBtns = document.querySelectorAll('.mode-toggle-btn');

    modeBtns.forEach(btn => {
        btn.classList.remove('active');
    });

    if (mode === 'import') {
        importContainer.style.display = 'block';
        translateContainer.style.display = 'none';
        document.querySelector('.mode-toggle-btn[data-mode="import"]').classList.add('active');
    } else {
        importContainer.style.display = 'none';
        translateContainer.style.display = 'block';
        document.querySelector('.mode-toggle-btn[data-mode="translate"]').classList.add('active');
    }
}

// Initialize button functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    appState.init();
    setupButtonFunctionality();
    
    // Language-specific initialization
    if (typeof initLanguageApp === 'function') {
        initLanguageApp();
    }
});
// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    appState.init();
    
    // Language-specific initialization
    if (typeof initLanguageApp === 'function') {
        initLanguageApp();
    }
});

// Export for use in language-specific files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = appState;
} else {
    window.appState = appState;
}
