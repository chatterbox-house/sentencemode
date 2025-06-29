// Initialize language configuration
document.addEventListener('DOMContentLoaded', () => {
    // Get saved language config or set defaults
    const langConfig = JSON.parse(localStorage.getItem('langConfig')) || {
        source: 'en',
        target: 'ja'
    };
    
    // Apply language configuration to UI
    applyLanguageConfig(langConfig);
});

function applyLanguageConfig(config) {
    // Update UI elements based on language
    const languageName = config.target === 'ja' ? 'Japanese' : 
                         config.target === 'es' ? 'Spanish' : 'Language';
    
    // Update page title
    document.title = `LangLearner - ${languageName} Learning`;
    
    // Update UI text elements
    updateTextElements(config);
    
    // Configure TTS
    window.ttsLang = config.target === 'ja' ? 'ja-JP' : 
                     config.target === 'es' ? 'es-ES' : 'en-US';
    
    // Store config in global state
    if (window.appState) {
        window.appState.langConfig = config;
    }
}

function updateTextElements(config) {
    // Example of updating UI text
    const elementsToUpdate = {
        'import-title': `Import ${config.target === 'ja' ? 'Japanese' : 'Spanish'} Text`,
        'translate-title': `Translate to ${config.target === 'ja' ? 'Japanese' : 'Spanish'}`,
        'process-text': config.target === 'ja' ? 'Process Japanese Text' : 'Process Spanish Text'
    };
    
    Object.keys(elementsToUpdate).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = elementsToUpdate[id];
        }
    });
}

// Add to main.js state
window.appConfig = {
    getLangConfig: () => JSON.parse(localStorage.getItem('langConfig')) || {source: 'en', target: 'ja'}
};
