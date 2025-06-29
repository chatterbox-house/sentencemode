/**
 * Database module for Japanese Learner app
 * Handles all IndexedDB operations for sentences, vocabulary and translations
 */

const DB_NAME = 'JapaneseLearnerDB';
const DB_VERSION = 2;
const STORE_SENTENCES = 'sentences';
const STORE_VOCAB = 'vocabulary';
const STORE_TRANSLATIONS = 'translations';

let db;

/**
 * Opens or creates the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(STORE_SENTENCES)) {
                const sentencesStore = db.createObjectStore(STORE_SENTENCES, { keyPath: 'id' });
                sentencesStore.createIndex('position', 'position', { unique: true });
            }
            
            if (!db.objectStoreNames.contains(STORE_VOCAB)) {
                const vocabStore = db.createObjectStore(STORE_VOCAB, { keyPath: 'id' });
                vocabStore.createIndex('bucket', 'bucket', { unique: false });
                vocabStore.createIndex('word', 'word', { unique: true });
                vocabStore.createIndex('favorite', 'favorite', { unique: false });
            } else {
                const vocabStore = event.target.transaction.objectStore(STORE_VOCAB);
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
            db = event.target.result;
            resolve(db);
        };
        
        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

/**
 * Wipes all data from the database
 * @returns {Promise<void>}
 */
export async function wipeAllData() {
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

/**
 * Adds multiple sentences to the database
 * @param {Array} sentences - Array of sentence objects
 * @returns {Promise<void>}
 */
export async function addSentences(sentences) {
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

/**
 * Retrieves all sentences from the database
 * @returns {Promise<Array>}
 */
export async function getAllSentences() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES], 'readonly');
        const store = transaction.objectStore(STORE_SENTENCES);
        const index = store.index('position');
        const request = index.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Updates a single sentence in the database
 * @param {Object} sentence - Sentence object to update
 * @returns {Promise<void>}
 */
export async function updateSentence(sentence) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SENTENCES], 'readwrite');
        const store = transaction.objectStore(STORE_SENTENCES);
        const request = store.put(sentence);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Adds a vocabulary word to the database
 * @param {Object} word - Word object to add
 * @returns {Promise<void>}
 */
export async function addVocabWord(word) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readwrite');
        const store = transaction.objectStore(STORE_VOCAB);
        
        // Check if word already exists
        const wordIndex = store.index('word');
        const request = wordIndex.get(word.word);
        
        request.onsuccess = () => {
            if (request.result) {
                reject(new Error('Word already exists in vocabulary'));
            } else {
                const addRequest = store.add(word);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = (event) => reject(event.target.error);
            }
        };
        
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Gets vocabulary words by bucket (difficulty level)
 * @param {string} bucket - 'new', 'easy', 'medium', or 'hard'
 * @returns {Promise<Array>}
 */
export async function getVocabByBucket(bucket) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readonly');
        const store = transaction.objectStore(STORE_VOCAB);
        const index = store.index('bucket');
        const request = index.getAll(IDBKeyRange.only(bucket));
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Updates a vocabulary word in the database
 * @param {Object} word - Word object to update
 * @returns {Promise<void>}
 */
export async function updateVocabWord(word) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_VOCAB], 'readwrite');
        const store = transaction.objectStore(STORE_VOCAB);
        const request = store.put(word);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}

/**
 * Counts vocabulary words by bucket
 * @returns {Promise<Object>} Object with counts for each bucket
 */
export async function countVocabByBucket() {
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

/**
 * Gets a cached translation from the database
 * @param {string} text - Original text
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @returns {Promise<string|null>}
 */
export async function getCachedTranslation(text, sourceLang, targetLang) {
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

/**
 * Caches a translation in the database
 * @param {string} text - Original text
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @param {string} translatedText - Translated text
 * @returns {Promise<void>}
 */
export async function cacheTranslation(text, sourceLang, targetLang, translatedText) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_TRANSLATIONS], 'readwrite');
        const store = transaction.objectStore(STORE_TRANSLATIONS);
        
        const translation = {
            id: generateUUID(),
            text: `${sourceLang}|${targetLang}|${text}`,
            translatedText: translatedText,
            timestamp: new Date().getTime()
        };
        
        const request = store.add(translation);
        
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}
