/**
 * Language Manager for Japanese Learning App
 * Handles all language-specific processing including:
 * - Sentence segmentation
 * - Translation services
 * - Dictionary lookups
 * - Language detection
 */

class LanguageManager {
  constructor(db, state) {
    this.db = db;
    this.state = state;
    this.wordLookupCache = {};
    this.translationStore = 'translations';
  }

  /**
   * Split text into sentences using Japanese-specific rules
   * @param {string} text - Input text to split
   * @returns {string[]} Array of sentences
   */
  splitSentences(text) {
    if (!text) return [];
    
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
   * Detect if text is Japanese
   * @param {string} text - Text to analyze
   * @returns {string} 'ja' for Japanese, 'en' for others
   */
  detectLanguage(text) {
    const japaneseChars = /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF]/;
    return japaneseChars.test(text) ? 'ja' : 'en';
  }

  /**
   * Translate text to Japanese
   * @param {string} text - Source text
   * @param {string} sourceLang - Source language code
   * @returns {Promise<string>} Translated text
   */
  async translateToJapanese(text, sourceLang) {
    try {
      // Check cache first
      const cached = await this.getCachedTranslation(text, sourceLang, 'ja');
      if (cached) return cached;

      if (!this.state.isOnline) {
        throw new Error('Offline - translation not available');
      }

      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|ja`
      );

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      if (data.responseData?.translatedText) {
        await this.cacheTranslation(text, sourceLang, 'ja', data.responseData.translatedText);
        return data.responseData.translatedText;
      }
      throw new Error('No translation found');
    } catch (error) {
      console.error('Translation error:', error);
      return "Translation failed. Please try again.";
    }
  }

  /**
   * Translate Japanese sentence to target language
   * @param {string} sentence - Japanese text
   * @param {string} targetLang - Target language code
   * @returns {Promise<string>} Translated text
   */
  async translateSentence(sentence, targetLang) {
    try {
      // Check cache first
      const cached = await this.getCachedTranslation(sentence, 'ja', targetLang);
      if (cached) return cached;

      if (!this.state.isOnline) {
        throw new Error('Offline - translation not available');
      }

      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sentence)}&langpair=ja|${targetLang}`
      );

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      if (data.responseData?.translatedText) {
        await this.cacheTranslation(sentence, 'ja', targetLang, data.responseData.translatedText);
        return data.responseData.translatedText;
      }
      throw new Error('No translation found');
    } catch (error) {
      console.error('Translation error:', error);
      return "Translation unavailable";
    }
  }

  /**
   * Lookup word in dictionary
   * @param {string} word - Word to lookup
   * @returns {Promise<string|null>} Definition or null if not found
   */
  async lookupWord(word) {
    if (this.wordLookupCache[word]) {
      return this.wordLookupCache[word];
    }

    try {
      const apiUrl = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
      
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
      if (data.data?.length > 0) {
        const definition = data.data[0].senses[0]?.english_definitions?.join(', ') || null;
        if (definition) this.wordLookupCache[word] = definition;
        return definition;
      }
      return null;
    } catch (error) {
      console.error('Dictionary lookup error:', error);
      return null;
    }
  }

  // Helper methods for translation caching
  async getCachedTranslation(text, sourceLang, targetLang) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.translationStore], 'readonly');
      const store = transaction.objectStore(this.translationStore);
      const index = store.index('text');
      const request = index.get(`${sourceLang}|${targetLang}|${text}`);
      
      request.onsuccess = () => resolve(request.result?.translatedText || null);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async cacheTranslation(text, sourceLang, targetLang, translatedText) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.translationStore], 'readwrite');
      const store = transaction.objectStore(this.translationStore);
      
      const translation = {
        id: this.generateUUID(),
        text: `${sourceLang}|${targetLang}|${text}`,
        translatedText,
        timestamp: Date.now()
      };
      
      const request = store.add(translation);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export default LanguageManager;
