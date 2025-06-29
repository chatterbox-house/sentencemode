/**
 * Vocabulary Review System
 * Handles all vocabulary review functionality including:
 * - Matching game for new/easy/medium words
 * - Hard mode for difficult words
 * - Bucket progression system
 * - Streak tracking
 */

class ReviewSystem {
  constructor(db, state, elements) {
    this.db = db;
    this.state = state;
    this.elements = elements;
    this.selectedCards = [];
    this.currentRoundWords = [];
    this.currentHardStreak = 0;
  }

  /**
   * Starts a review session for a specific bucket
   * @param {string} bucket - 'new', 'easy', 'medium', or 'hard'
   */
  async startReview(bucket) {
    this.state.reviewMode = bucket;
    this.state.reviewWords = await this.getVocabByBucket(bucket);
    
    if (this.state.reviewWords.length === 0) {
      this.showToast('No words to review in this category!', 'error');
      return;
    }
    
    this.state.reviewWords = this.shuffleArray(this.state.reviewWords);
    this.state.currentReviewIndex = 0;
    this.state.reviewStats = { correct: 0, incorrect: 0 };
    this.currentHardStreak = 0;
    
    if (bucket === 'hard') {
      this.setupHardMode();
    } else {
      this.setupMatchingGame();
    }
  }

  /**
   * Sets up the matching game UI and cards
   */
  setupMatchingGame() {
    // Clear previous cards
    this.elements.leftColumn.innerHTML = '';
    this.elements.rightColumn.innerHTML = '';
    
    // Get words for this round (max 5)
    const wordsToShow = this.state.reviewWords.slice(
      this.state.currentReviewIndex, 
      this.state.currentReviewIndex + 5
    );
    this.currentRoundWords = wordsToShow;

    if (wordsToShow.length === 0) {
      this.showToast('No words to review!', 'error');
      return;
    }

    if (this.state.reviewMode === 'new' || this.state.reviewMode === 'easy') {
      this.createMatchingGameCards(wordsToShow, 'english', 'japanese');
    } else { // medium mode
      this.createMatchingGameCards(wordsToShow, 'japanese', 'english');
    }
    
    this.updateProgressDisplay();
  }

  /**
   * Creates cards for matching game
   * @param {Array} words - Words to create cards for
   * @param {string} leftType - Type for left column cards
   * @param {string} rightType - Type for right column cards
   */
  createMatchingGameCards(words, leftType, rightType) {
    // Left column cards
    const leftCards = this.shuffleArray([...words]).map(word => ({
      id: word.id,
      type: leftType,
      text: leftType === 'english' ? word.translation : word.word,
      streak: word.streak || 0
    }));
    
    // Right column cards
    const rightCards = this.shuffleArray([...words]).map(word => ({
      id: word.id,
      type: rightType,
      text: rightType === 'english' ? word.translation : word.word,
      streak: word.streak || 0
    }));
    
    // Add cards to columns
    leftCards.forEach(word => {
      const card = this.createWordCard(word);
      this.elements.leftColumn.appendChild(card);
    });
    
    rightCards.forEach(word => {
      const card = this.createWordCard(word);
      this.elements.rightColumn.appendChild(card);
    });
  }

  /**
   * Creates a word card element
   * @param {Object} word - Word data
   * @returns {HTMLElement} Card element
   */
  createWordCard(word) {
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
    
    // Add streak indicator
    const streakIndicator = document.createElement('div');
    streakIndicator.className = 'streak-indicator';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'streak-progress';
    progressBar.style.width = `${(word.streak || 0) * 33.33}%`;
    
    streakIndicator.appendChild(progressBar);
    card.appendChild(streakIndicator);
    
    card.addEventListener('click', () => this.handleCardClick(card, word.type));
    
    return card;
  }

  /**
   * Handles card selection and matching logic
   * @param {HTMLElement} cardElement - Clicked card
   * @param {string} cardType - Type of card ('english' or 'japanese')
   */
  handleCardClick(cardElement, cardType) {
    if (cardElement.classList.contains('correct')) return;

    // Determine if card is in left or right column
    const isLeftColumn = cardElement.parentElement === this.elements.leftColumn;
    
    if (isLeftColumn) {
      if (this.selectedCards[0]) {
        this.selectedCards[0].classList.remove('selected');
      }
      this.selectedCards[0] = cardElement;
    } else {
      if (this.selectedCards[1]) {
        this.selectedCards[1].classList.remove('selected');
      }
      this.selectedCards[1] = cardElement;
    }

    cardElement.classList.add('selected');

    if (this.selectedCards[0] && this.selectedCards[1]) {
      this.checkMatch(this.selectedCards[0], this.selectedCards[1]);
    }
  }

  /**
   * Checks if two selected cards match
   * @param {HTMLElement} leftCard - Left column card
   * @param {HTMLElement} rightCard - Right column card
   */
  checkMatch(leftCard, rightCard) {
    const leftId = leftCard.dataset.id;
    const rightId = rightCard.dataset.id;
    
    if (leftId === rightId) {
      this.handleCorrectMatch(leftCard, rightCard, leftId);
    } else {
      this.handleIncorrectMatch(leftCard, rightCard);
    }
  }

  /**
   * Handles correct match logic
   */
  handleCorrectMatch(leftCard, rightCard, wordId) {
    leftCard.classList.remove('selected');
    leftCard.classList.add('correct');
    rightCard.classList.remove('selected');
    rightCard.classList.add('correct');
    
    this.state.reviewStats.correct++;
    this.playSound('correct');
    
    // Find the matched word
    const matchedWord = this.currentRoundWords.find(w => w.id === wordId);
    const wordIndex = this.state.reviewWords.findIndex(w => w.id === wordId);
    
    if (matchedWord && wordIndex !== -1) {
      this.updateWordStreak(matchedWord, wordIndex, leftCard, rightCard);
    }
    
    this.selectedCards = [];
    this.checkRoundCompletion();
  }

  /**
   * Updates streak count for a word
   */
  async updateWordStreak(word, wordIndex, leftCard, rightCard) {
    // Update streak count
    word.streak = (word.streak || 0) + 1;
    this.state.reviewWords[wordIndex].streak = word.streak;
    
    await this.updateVocabWord(this.state.reviewWords[wordIndex]);
    
    // Update streak display
    leftCard.dataset.streak = word.streak;
    rightCard.dataset.streak = word.streak;
    
    const leftProgress = leftCard.querySelector('.streak-progress');
    const rightProgress = rightCard.querySelector('.streak-progress');
    if (leftProgress && rightProgress) {
      leftProgress.style.width = `${word.streak * 33.33}%`;
      rightProgress.style.width = `${word.streak * 33.33}%`;
    }
    
    // Show feedback
    const neededForNext = 3 - word.streak;
    if (neededForNext > 0) {
      this.showToast(`Correct! Need ${neededForNext} more correct answers to move up`, 'success');
    } else {
      this.showToast('Correct! Word will move to next bucket', 'success');
      this.moveWordToNextBucket(word);
    }
  }

  /**
   * Handles incorrect match logic
   */
  handleIncorrectMatch(leftCard, rightCard) {
    leftCard.classList.remove('selected');
    leftCard.classList.add('incorrect');
    rightCard.classList.remove('selected');
    rightCard.classList.add('incorrect');
    
    this.state.reviewStats.incorrect++;
    this.playSound('incorrect');
    this.showToast('Try again!', 'error');
    
    setTimeout(() => {
      leftCard.classList.remove('incorrect');
      rightCard.classList.remove('incorrect');
      this.selectedCards = [];
    }, 1000);
  }

  /**
   * Moves word to next difficulty bucket
   * @param {Object} word - Word to move
   */
  moveWordToNextBucket(word) {
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
    this.updateVocabWord(word);
  }

  /**
   * Checks if current round is complete
   */
  checkRoundCompletion() {
    const allCards = document.querySelectorAll('.word-card');
    const matchedCards = document.querySelectorAll('.word-card.correct');
    
    if (matchedCards.length === allCards.length) {
      this.playSound('complete');
      
      // Move to next set of words
      this.state.currentReviewIndex += 5;
      if (this.state.currentReviewIndex < this.state.reviewWords.length) {
        setTimeout(() => {
          this.setupMatchingGame();
        }, 1500);
      } else {
        // Review complete
        setTimeout(() => {
          this.showView('vocab-review-view');
          this.updateBucketCounts();
        }, 1500);
      }
    }
  }

  /**
   * Sets up hard mode review
   */
  setupHardMode() {
    if (this.state.currentReviewIndex >= this.state.reviewWords.length) {
      this.elements.reviewQuestion.textContent = "Review complete!";
      this.elements.hardModeContainer.style.display = 'none';
      return;
    }
    
    this.state.currentHardWord = this.state.reviewWords[this.state.currentReviewIndex];
    
    // Create question with streak indicator
    const questionDiv = document.createElement('div');
    questionDiv.style.textAlign = 'center';
    
    const wordElement = document.createElement('div');
    wordElement.textContent = this.state.currentHardWord.word;
    wordElement.style.fontSize = '2rem';
    wordElement.style.marginBottom = '1rem';
    
    const streakElement = document.createElement('div');
    streakElement.textContent = `Streak: ${this.state.currentHardWord.streak || 0}/3`;
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
    progressFill.style.width = `${(this.state.currentHardWord.streak || 0) * 33.33}%`;
    progressFill.style.backgroundColor = 'var(--highlight)';
    progressFill.style.borderRadius = '2px';
    
    progressBar.appendChild(progressFill);
    questionDiv.appendChild(wordElement);
    questionDiv.appendChild(streakElement);
    questionDiv.appendChild(progressBar);
    
    this.elements.reviewQuestion.innerHTML = '';
    this.elements.reviewQuestion.appendChild(questionDiv);
  }

  /**
   * Handles hard mode response
   * @param {boolean} knewIt - Whether user knew the word
   */
  handleHardModeResponse(knewIt) {
    if (!this.state.currentHardWord) return;
    
    if (knewIt) {
      this.currentHardStreak++;
      
      if (this.currentHardStreak >= 3) {
        // Remove word from vocabulary (retired)
        this.deleteVocabWord(this.state.currentHardWord.id);
        this.showToast('Word retired!', 'success');
      } else {
        // Move to next bucket
        this.moveWordToEasierBucket(this.state.currentHardWord);
        this.showToast('Word moved to easier bucket', 'success');
      }
    } else {
      this.currentHardStreak = 0;
      this.state.currentHardWord.bucket = 'new';
      this.updateVocabWord(this.state.currentHardWord);
      this.showToast('Word moved back to new words', 'error');
    }
    
    // Move to next word
    this.state.currentReviewIndex++;
    if (this.state.currentReviewIndex < this.state.reviewWords.length) {
      this.setupHardMode();
    } else {
      // Review complete
      this.showView('vocab-review-view');
      this.updateBucketCounts();
    }
  }

  /**
   * Moves word to easier bucket
   * @param {Object} word - Word to move
   */
  moveWordToEasierBucket(word) {
    if (word.bucket === 'hard') {
      word.bucket = 'medium';
    } else if (word.bucket === 'medium') {
      word.bucket = 'easy';
    } else if (word.bucket === 'easy') {
      word.bucket = 'new';
    }
    
    this.updateVocabWord(word);
  }

  // Helper methods would be imported from utilities
  shuffleArray(array) { /*...*/ }
  showToast(message, type) { /*...*/ }
  playSound(name) { /*...*/ }
  showView(viewId) { /*...*/ }
  updateBucketCounts() { /*...*/ }
  
  // Database methods would be imported from database
  getVocabByBucket(bucket) { /*...*/ }
  updateVocabWord(word) { /*...*/ }
  deleteVocabWord(id) { /*...*/ }
}

export default ReviewSystem;
