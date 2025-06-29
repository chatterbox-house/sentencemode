// Initialize app state
const state = {
    // ... original state properties ...,
    
    // Add language configuration
    langConfig: window.appConfig.getLangConfig()
};

// Modify TTS function to use language config
function speakText(text) {
    // ... existing code ...
    utterance.lang = window.ttsLang || 'ja-JP'; // Use configured language
    // ... rest of the function ...
}

// Modify translation functions
async function translateText(text, sourceLang, targetLang) {
    // Generic translation function
    // ... implementation using sourceLang and targetLang ...
}

// Update text processing
async function processText() {
    const langConfig = state.langConfig;
    // Use langConfig.source and langConfig.target as needed
}

// Add navigation handler
document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', function() {
        // ... existing functionality ...
        
        // Special handling for home navigation
        if (this.getAttribute('data-view') === 'home') {
            window.location.href = 'index.html';
        }
    });
});

// ... rest of the original JavaScript ...

// Initialize with language config
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization ...
    
    // Apply language-specific settings
    if (window.applyLanguageConfig) {
        window.applyLanguageConfig(state.langConfig);
    }
});
