/*
 * main.js
 *
 * Entry point for the IB Economics SL revision game.
 * The game uses Phaser 3 to manage scenes and basic game logic.
 * Questions are loaded from a JSON file. User input is gathered via
 * simple HTML elements overlaid on the game canvas. At the end of a
 * session, a summary of performance is presented.
 */

// The dimensions of the Phaser game. These can be adjusted to suit
// different screen sizes; Phaser will automatically scale.
const GAME_WIDTH = 900;
const GAME_HEIGHT = 600;

// Global storage for question data. This is filled in BootScene by
// fetching the external JSON file. Each property (diagram, calculation,
// essay, case, flash) contains an array of questions.
let QUESTIONS = {};

// Global storage for the current session results. This object
// accumulates user answers, timings and scores. It is reset when a new
// session starts and passed to the summary scene.
let Session = {
  mode: null,
  level: 1,
  startTime: 0,
  endTime: 0,
  questions: [],
  answers: [],
  correct: [],
  times: [],
  keywordsFound: []
};

// Utility: shuffle an array (Fisher–Yates). Used to randomize question order.
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// BootScene – loads question data and transitions to the MenuScene. A
// simple loading animation could be added here if desired.
class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }
  preload() {
    // This scene does not perform asynchronous loading. All question data
    // is embedded in data/questions.js as the global variable
    // window.QUESTION_DATA. Additional assets could be loaded here.
  }
  create() {
    // Assign the embedded QUESTION_DATA to the global QUESTIONS object.
    if (typeof window.QUESTION_DATA === 'undefined') {
      console.error('QUESTION_DATA is not defined. Ensure that data/questions.js is loaded in index.html.');
      this.add.text(50, 50, 'Error loading questions data', { fontSize: '20px', fill: '#ff0000' });
      return;
    }
    QUESTIONS = window.QUESTION_DATA;
    // Proceed to menu
    this.scene.start('MenuScene');
  }
}

// MenuScene – displays mode options and level selection. When a mode is
// chosen, the corresponding scene is started with the selected level.
class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }
  create() {
    const scene = this;
    this.add.text(GAME_WIDTH / 2, 60, 'IB Economics SL Revision Game', { fontSize: '32px', color: '#1e3a8a' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 100, 'Select a mode and difficulty level', { fontSize: '18px', color: '#333' }).setOrigin(0.5);

    // Mode buttons
    const modes = [
      { key: 'diagram', label: 'Diagram Mode' },
      { key: 'calculation', label: 'Calculation Mode' },
      { key: 'essay', label: 'Essay Mode' },
      { key: 'case', label: 'Case Study Mode' },
      { key: 'flash', label: 'Flashcard Mode' },
      // New lesson mode introduces a guided lesson based on external notes
      { key: 'lesson', label: 'Lesson Mode' }
    ];

    const startY = 150;
    modes.forEach((mode, idx) => {
      const y = startY + idx * 50;
      const button = this.add.text(GAME_WIDTH / 2, y, mode.label, { fontSize: '20px', backgroundColor: '#1976d2', color: '#ffffff', padding: 10 })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => button.setBackgroundColor('#145a9e'))
        .on('pointerout', () => button.setBackgroundColor('#1976d2'))
        .on('pointerdown', () => this.showLevelSelection(mode.key));
    });

    // If bookmarks exist in localStorage, display a button to review them.  This
    // button appears below the mode selection buttons.  It navigates to the
    // BookmarkReviewScene.
    let bookmarksExist = false;
    try {
      const stored = JSON.parse(localStorage.getItem('ib_econ_bookmarks')) || [];
      bookmarksExist = stored.length > 0;
    } catch (e) {
      bookmarksExist = false;
    }
    if (bookmarksExist) {
      const reviewBtnY = startY + modes.length * 50 + 30;
      const reviewBtn = this.add.text(GAME_WIDTH / 2, reviewBtnY, 'Review Bookmarks', {
        fontSize: '20px', backgroundColor: '#ffa000', color: '#ffffff', padding: 10
      }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => reviewBtn.setBackgroundColor('#cc7a00'))
        .on('pointerout', () => reviewBtn.setBackgroundColor('#ffa000'))
        .on('pointerdown', () => {
          this.scene.start('BookmarkReviewScene');
        });
    }

    // Info about existing progress (stored in localStorage). This
    // encourages replay by reminding players of their level. Only show if
    // progress exists.
    const progress = localStorage.getItem('ib_econ_progress');
    if (progress) {
      const info = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, 'Saved progress found. Your previous best results will be used for adaptive difficulty.', { fontSize: '14px', color: '#555' }).setOrigin(0.5);
    }
  }
  // Display a simple overlay for level selection. Once a level is
  // selected, start the appropriate scene.
  showLevelSelection(modeKey) {
    // For Lesson Mode, we bypass level selection and start the lesson directly.
    if (modeKey === 'lesson') {
      // Reset session for lesson mode (not used but keep structure consistent)
      Session = {
        mode: 'lesson',
        level: 1,
        startTime: Date.now(),
        endTime: 0,
        questions: [],
        answers: [],
        correct: [],
        times: [],
        keywordsFound: []
      };
      // Start the LessonScene immediately
      this.scene.start('lesson');
      return;
    }
    const scene = this;
    // Remove existing level overlay if present
    if (this.levelOverlay) {
      this.levelOverlay.destroy();
    }
    const overlay = this.add.container(0, 0);
    this.levelOverlay = overlay;
    const bg = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setOrigin(0);
    overlay.add(bg);
    const panelWidth = 400;
    const panelHeight = 250;
    const panelX = (GAME_WIDTH - panelWidth) / 2;
    const panelY = (GAME_HEIGHT - panelHeight) / 2;
    const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0xffffff).setOrigin(0);
    overlay.add(panel);
    const title = this.add.text(panelX + panelWidth / 2, panelY + 40, 'Select Difficulty Level', { fontSize: '22px', color: '#1e3a8a' }).setOrigin(0.5);
    overlay.add(title);
    const levels = [1, 2, 3];
    levels.forEach((lvl, idx) => {
      const btn = this.add.text(panelX + panelWidth / 2, panelY + 90 + idx * 40, 'Level ' + lvl, { fontSize: '20px', backgroundColor: '#1976d2', color: '#ffffff', padding: 8 })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => btn.setBackgroundColor('#145a9e'))
        .on('pointerout', () => btn.setBackgroundColor('#1976d2'))
        .on('pointerdown', () => {
          // Start session
          Session = {
            mode: modeKey,
            level: lvl,
            startTime: Date.now(),
            endTime: 0,
            questions: [],
            answers: [],
            correct: [],
            times: [],
            keywordsFound: []
          };
          overlay.destroy();
          // Determine which scene to start based on modeKey
          // Start the appropriate scene based on the mode key.  Each
          // question scene's constructor explicitly sets its own key
          // (e.g. 'diagram', 'calculation', etc.).  Using these
          // lowercase keys here avoids mismatches that previously
          // prevented the scenes from loading and resulted in blank
          // screens when selecting a level.
          switch (modeKey) {
            case 'diagram':
              scene.scene.start('diagram');
              break;
            case 'calculation':
              scene.scene.start('calculation');
              break;
            case 'essay':
              scene.scene.start('essay');
              break;
            case 'case':
              scene.scene.start('case');
              break;
            case 'flash':
              scene.scene.start('flash');
              break;
            default:
              // Fallback to summary if unknown key
              scene.scene.start('SummaryScene');
              break;
          }
        });
      overlay.add(btn);
    });
    // Cancel button
    const cancelBtn = this.add.text(panelX + panelWidth / 2, panelY + panelHeight - 30, 'Cancel', { fontSize: '18px', color: '#1976d2' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => overlay.destroy());
    overlay.add(cancelBtn);
  }
}

// Base class for question scenes. Subclasses can override the
// createQuestionUI and handleSubmit methods. This class manages the
// sequence of questions, timing and navigation. It assumes that
// Session.mode and Session.level are set by MenuScene.
class QuestionScene extends Phaser.Scene {
  constructor(key) {
    super(key);
    this.modeKey = key;
    this.currentIndex = 0;
    // Initialize an array to keep track of Phaser text objects for each question. These
    // objects will be destroyed when moving to the next question to prevent stacking.
    this.textObjects = [];
  }
  create() {
    // Filter questions by mode and level. Default to all questions if
    // none match the level (useful for demonstration). The slice() call
    // makes a copy to avoid mutating the original array.
    const allQuestions = QUESTIONS[this.modeKey] || [];
    const filtered = allQuestions.filter(q => q.level === Session.level || q.level < Session.level);
    // Fallback: if no questions match at the selected level, use all
    // questions. This prevents the game from crashing and allows testing
    // with incomplete data sets.
    this.questions = filtered.length > 0 ? shuffleArray(filtered.slice()) : shuffleArray(allQuestions.slice());
    Session.questions = this.questions;
    // Title and instructions
    this.add.text(GAME_WIDTH / 2, 40, this.getTitle(), { fontSize: '26px', color: '#1e3a8a' }).setOrigin(0.5);

    // Create a progress bar and text to show question progress.  The bar
    // will be updated on each question.  We avoid destroying it when
    // cleaning up individual questions.
    const totalQuestions = this.questions ? this.questions.length : 1;
    const barX = 50;
    const barY = 70;
    const barWidth = GAME_WIDTH - 100;
    const barHeight = 15;
    // Background rectangle for the progress bar
    this.progressBarBg = this.add.rectangle(barX, barY, barWidth, barHeight, 0xdfe6f0).setOrigin(0, 0.5);
    // Fill rectangle that will be scaled according to progress
    this.progressBarFill = this.add.rectangle(barX, barY, 0, barHeight, 0x1976d2).setOrigin(0, 0.5);
    // Text showing current question out of total
    this.progressText = this.add.text(barX + barWidth, barY, '', { fontSize: '14px', color: '#333' }).setOrigin(1, 0.5);

    // Create a persistent bookmark toggle icon in the top‑right corner.  The star
    // displays filled (★) when the current question is bookmarked, and empty (☆) otherwise.
    // Only create this icon once to persist across questions within a session.  It will
    // update its state in updateBookmarkIcon() each time a new question is shown.
    if (!this.bookmarkIcon) {
      this.bookmarkIcon = this.add.text(GAME_WIDTH - 40, 10, '☆', {
        fontSize: '28px',
        color: '#f6c343', // golden yellow colour for bookmark
        fontFamily: 'Arial'
      }).setOrigin(0.5, 0);
      this.bookmarkIcon.setInteractive({ useHandCursor: true });
      this.bookmarkIcon.on('pointerdown', () => {
        this.toggleBookmark();
      });
    }
    // Add a persistent back button in the top‑left corner for all question scenes. When clicked
    // it returns immediately to the main menu. We do not include this button in the textObjects
    // array so it persists across questions and is not destroyed by cleanup().
    if (!this.backButton) {
      this.backButton = this.add.text(20, 10, 'Back to Menu', {
        fontSize: '18px',
        backgroundColor: '#1976d2',
        color: '#ffffff',
        padding: { left: 8, right: 8, top: 4, bottom: 4 }
      }).setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.backButton.setBackgroundColor('#145a9e'))
        .on('pointerout', () => this.backButton.setBackgroundColor('#1976d2'))
        .on('pointerdown', () => {
          // Immediately return to menu
          this.scene.start('MenuScene');
        });
    }
    // Create the first question UI
    this.currentIndex = 0;
    this.createQuestionUI(this.questions[this.currentIndex]);
    // Update bookmark icon for the first question if bookmark support is enabled
    if (this.bookmarkIcon) {
      this.updateBookmarkIcon();
    }
  }

  // Toggle bookmark for the current question.  Bookmarks are stored in
  // localStorage under 'ib_econ_bookmarks' as an array of question IDs.
  toggleBookmark() {
    const q = this.questions[this.currentIndex];
    if (!q || !q.id) return;
    const key = 'ib_econ_bookmarks';
    let bookmarks;
    try {
      bookmarks = JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      bookmarks = [];
    }
    const idx = bookmarks.indexOf(q.id);
    if (idx >= 0) {
      // Remove bookmark
      bookmarks.splice(idx, 1);
    } else {
      bookmarks.push(q.id);
    }
    localStorage.setItem(key, JSON.stringify(bookmarks));
    this.updateBookmarkIcon();
  }

  // Update the bookmark icon appearance based on whether the current question
  // is bookmarked.  The icon appears filled (★) when bookmarked and empty (☆) otherwise.
  updateBookmarkIcon() {
    if (!this.bookmarkIcon) return;
    const q = this.questions[this.currentIndex];
    if (!q || !q.id) {
      this.bookmarkIcon.setText('☆');
      return;
    }
    let bookmarks;
    try {
      bookmarks = JSON.parse(localStorage.getItem('ib_econ_bookmarks')) || [];
    } catch (e) {
      bookmarks = [];
    }
    const isBookmarked = bookmarks.indexOf(q.id) >= 0;
    this.bookmarkIcon.setText(isBookmarked ? '★' : '☆');
  }

  // Update the progress bar based on the current index and total questions.
  updateProgressBar() {
    const total = this.questions.length;
    // Avoid division by zero
    const ratio = total > 0 ? (this.currentIndex) / total : 0;
    const barWidth = GAME_WIDTH - 100;
    if (this.progressBarFill) {
      this.progressBarFill.width = barWidth * ratio;
    }
    if (this.progressText) {
      // Display current question number (1‑based) and total
      const currentNumber = Math.min(this.currentIndex + 1, total);
      this.progressText.setText(`${currentNumber}/${total}`);
    }
  }
  // Derived scenes must implement this to display a question and
  // collect user input. It should call this.handleSubmit() when the
  // player finishes answering.
  createQuestionUI(question) {}
  // Derived scenes should implement evaluation logic for a given
  // question and userAnswer. It should return an object with fields
  // { correct: boolean, info: any }. The default implementation
  // returns false for all answers.
  evaluateAnswer(question, userAnswer) {
    return { correct: false, info: null };
  }
  // Remove any existing UI elements (for example, DOM elements) before
  // drawing a new question. Subclasses may override if they add
  // additional cleanup.
  cleanup() {
    if (this.domContainer) {
      this.domContainer.destroy();
      this.domContainer = null;
    }
    // Destroy any Phaser text objects created for the previous question
    if (this.textObjects && this.textObjects.length > 0) {
      this.textObjects.forEach(obj => {
        if (obj && obj.destroy) obj.destroy();
      });
      this.textObjects = [];
    }
  }
  // Called when the user submits an answer. It stores the answer,
  // evaluation result and timing. If more questions remain, it moves to
  // the next question; otherwise it finishes the session.
  handleSubmit(userAnswer) {
    const question = this.questions[this.currentIndex];
    // Evaluate answer
    const result = this.evaluateAnswer(question, userAnswer);
    Session.answers.push(userAnswer);
    Session.correct.push(result.correct);
    Session.keywordsFound.push(result.keywordsFound || []);
    // Record time spent on this question
    const now = Date.now();
    const elapsed = now - (Session.lastTimestamp || Session.startTime);
    Session.times.push(elapsed);
    Session.lastTimestamp = now;
    // Move to next question or finish
    this.currentIndex++;
    if (this.currentIndex < this.questions.length) {
      this.cleanup();
      this.createQuestionUI(this.questions[this.currentIndex]);
    } else {
      Session.endTime = Date.now();
      // Save progress for adaptive difficulty
      localStorage.setItem('ib_econ_progress', JSON.stringify({ mode: Session.mode, level: Session.level, correct: Session.correct }));
      this.scene.start('SummaryScene');
    }
  }
  // Helper to return a title based on mode. Subclasses may override.
  getTitle() {
    switch (this.modeKey) {
      case 'diagram': return 'Diagram Mode';
      case 'calculation': return 'Calculation Mode';
      case 'essay': return 'Essay Mode';
      case 'case': return 'Case Study Mode';
      case 'flash': return 'Flashcard Mode';
      default: return 'Question Mode';
    }
  }
}

// DiagramScene – player reads a scenario, draws a diagram on paper (optional),
// writes an explanation and then views the correct diagram and solution.
class DiagramScene extends QuestionScene {
  constructor() {
    super('diagram');
  }
  createQuestionUI(question) {
    // Update progress bar for this question
    this.updateProgressBar();
    // Reset text objects array for this question
    this.textObjects = [];
    const yStart = 100;
    // Show context
    const contextText = this.add.text(50, yStart, 'Context: ' + question.context, {
      fontSize: '18px',
      color: '#000000',
      wordWrap: { width: GAME_WIDTH - 100 }
    });
    this.textObjects.push(contextText);
    // Prompt
    const promptY = contextText.y + contextText.height + 10;
    const promptText = this.add.text(50, promptY, 'Task: ' + question.prompt, {
      fontSize: '18px',
      color: '#000000',
      wordWrap: { width: GAME_WIDTH - 100 }
    });
    this.textObjects.push(promptText);
    // Create a DOM container for input, feedback, interactive builder and solution.
    // We increase the maxHeight to allow space for the interactive builder while keeping
    // the "Next" button visible.  The container is scrollable so that users can
    // scroll through the solution and builder content without losing navigation controls.
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.marginTop = '10px';
    container.style.maxHeight = '360px';
    container.style.overflowY = 'auto';
    // Input area for explanation
    const textarea = document.createElement('textarea');
    textarea.className = 'ui-textarea';
    textarea.placeholder = 'Write your explanation here...';
    container.appendChild(textarea);
    // Feedback paragraph – shows correct/incorrect after answer submission
    const feedback = document.createElement('p');
    feedback.style.display = 'none';
    feedback.style.fontWeight = 'bold';
    feedback.style.marginTop = '5px';
    container.appendChild(feedback);
    // Button to reveal solution. When clicked, show expected diagram and explanation.
    const revealBtn = document.createElement('button');
    revealBtn.className = 'ui-button';
    revealBtn.textContent = 'Show Solution';
    container.appendChild(revealBtn);
    // Solution output area – hidden until reveal. Limit its height to keep next button visible.
    const solutionDiv = document.createElement('div');
    solutionDiv.style.marginTop = '10px';
    solutionDiv.style.padding = '10px';
    solutionDiv.style.border = '1px solid #ccc';
    solutionDiv.style.display = 'none';
    solutionDiv.style.maxHeight = '180px';
    solutionDiv.style.overflowY = 'auto';
    container.appendChild(solutionDiv);

    // Interactive diagram builder (optional).  Provide a toolbox of elements and a drop
    // area where users can drag and drop components to assemble a diagram.  Upon
    // evaluation, we compare the placed elements against a set of expected elements
    // inferred from the expectedDiagram text.  Feedback is shown indicating missing
    // or extraneous parts.  This builder does not affect scoring of the written
    // explanation but offers a hands‑on way to practice constructing diagrams.
    const builderHeading = document.createElement('h4');
    builderHeading.textContent = 'Interactive Diagram Builder (optional)';
    builderHeading.style.marginTop = '15px';
    builderHeading.style.fontSize = '16px';
    container.appendChild(builderHeading);

    const builderWrapper = document.createElement('div');
    builderWrapper.style.display = 'flex';
    builderWrapper.style.alignItems = 'flex-start';
    builderWrapper.style.gap = '10px';
    builderWrapper.style.marginTop = '5px';
    // Toolbox containing draggable items
    const toolbox = document.createElement('div');
    toolbox.style.border = '1px solid #ccc';
    toolbox.style.padding = '5px';
    toolbox.style.backgroundColor = '#f7f7f7';
    toolbox.style.width = '30%';
    const toolboxTitle = document.createElement('p');
    toolboxTitle.textContent = 'Toolbox:';
    toolboxTitle.style.fontWeight = 'bold';
    toolbox.appendChild(toolboxTitle);
    const toolItems = ['Axis', 'Demand Curve', 'Supply Curve', 'Shift Demand Right', 'Shift Supply Right'];
    toolItems.forEach(item => {
      const elem = document.createElement('div');
      elem.textContent = item;
      elem.style.border = '1px solid #888';
      elem.style.padding = '4px';
      elem.style.marginBottom = '4px';
      elem.style.backgroundColor = '#ffffff';
      elem.style.cursor = 'grab';
      elem.setAttribute('draggable', 'true');
      elem.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/plain', item);
      });
      toolbox.appendChild(elem);
    });
    builderWrapper.appendChild(toolbox);
    // Drop area where users place diagram components
    const dropArea = document.createElement('div');
    dropArea.style.border = '1px dashed #888';
    dropArea.style.minHeight = '150px';
    dropArea.style.flexGrow = '1';
    dropArea.style.position = 'relative';
    dropArea.style.padding = '4px';
    dropArea.addEventListener('dragover', (ev) => {
      ev.preventDefault();
    });
    // Track which elements are placed for evaluation
    const placedElements = [];
    dropArea.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const type = ev.dataTransfer.getData('text/plain');
      if (!type) return;
      // Create a small label representing the dropped element
      const label = document.createElement('div');
      label.textContent = type;
      label.style.position = 'absolute';
      // Offset placement relative to drop area coordinates
      const rect = dropArea.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      label.style.left = (x - 30) + 'px';
      label.style.top = (y - 10) + 'px';
      label.style.padding = '2px 4px';
      label.style.border = '1px solid #ccc';
      label.style.backgroundColor = '#e0f7fa';
      label.style.fontSize = '12px';
      label.style.cursor = 'move';
      dropArea.appendChild(label);
      placedElements.push(type);
    });
    builderWrapper.appendChild(dropArea);
    // Evaluation area beneath the drop area
    const evalControls = document.createElement('div');
    evalControls.style.display = 'flex';
    evalControls.style.flexDirection = 'column';
    evalControls.style.marginTop = '10px';
    const evalBtn = document.createElement('button');
    evalBtn.className = 'ui-button';
    evalBtn.textContent = 'Check Diagram';
    evalControls.appendChild(evalBtn);
    const evalFeedback = document.createElement('p');
    evalFeedback.style.display = 'none';
    evalFeedback.style.fontWeight = 'bold';
    evalFeedback.style.marginTop = '5px';
    evalControls.appendChild(evalFeedback);
    evalBtn.addEventListener('click', () => {
      // Derive expected elements from the expectedDiagram text
      const expected = [];
      const ed = (question.expectedDiagram || '').toLowerCase();
      // Basic heuristics to infer required components
      if (ed.includes('demand')) expected.push('Demand Curve');
      if (ed.includes('supply')) expected.push('Supply Curve');
      if (ed.includes('ad')) expected.push('Demand Curve');
      if (ed.includes('as')) expected.push('Supply Curve');
      if (ed.includes('ppc') || ed.includes('production possibility')) expected.push('PPC');
      if (ed.includes('lorenz')) expected.push('Lorenz Curve');
      // Always include axis for most diagrams
      expected.unshift('Axis');
      // Remove duplicates
      const uniqueExpected = [...new Set(expected)];
      // Check placed elements
      const uniquePlaced = [...new Set(placedElements)];
      const missing = uniqueExpected.filter(e => !uniquePlaced.includes(e));
      evalFeedback.style.display = 'block';
      if (missing.length === 0) {
        evalFeedback.textContent = 'Great job! You have included all key components.';
        evalFeedback.style.color = '#008000';
      } else {
        evalFeedback.textContent = 'Missing components: ' + missing.join(', ');
        evalFeedback.style.color = '#d32f2f';
      }
    });
    builderWrapper.appendChild(evalControls);
    container.appendChild(builderWrapper);
    // Next button (placed outside solution area to stay visible)
    const nextBtn = document.createElement('button');
    nextBtn.className = 'ui-button';
    nextBtn.textContent = this.currentIndex === this.questions.length - 1 ? 'Finish Session' : 'Next Question';
    container.appendChild(nextBtn);
    // Event handlers
    revealBtn.addEventListener('click', () => {
      // Show expected diagram and explanation
      solutionDiv.style.display = 'block';
      // Clear any existing content
      solutionDiv.innerHTML = '';
      // Insert explanation text
      const p = document.createElement('p');
      p.textContent = 'Expected Diagram: ' + question.expectedDiagram;
      solutionDiv.appendChild(p);
      const exp = document.createElement('p');
      exp.textContent = 'Explanation: ' + question.solutionExplanation;
      solutionDiv.appendChild(exp);
      // Draw a simple placeholder diagram using Chart.js
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 250;
      solutionDiv.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const data = {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [
          {
            label: 'Initial Curve',
            data: [3, 2.5, 2, 1.8],
            borderColor: 'rgba(100, 181, 246, 1)',
            backgroundColor: 'rgba(100, 181, 246, 0.2)',
            fill: false
          },
          {
            label: 'Shifted Curve',
            data: [4.5, 3.5, 3, 2.8],
            borderColor: 'rgba(220, 20, 60, 1)',
            backgroundColor: 'rgba(220, 20, 60, 0.2)',
            fill: false
          }
        ]
      };
      new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
          plugins: { legend: { display: true } },
          scales: {
            x: { title: { display: true, text: 'Quantity' } },
            y: { title: { display: true, text: 'Price' } }
          }
        }
      });
    });
    nextBtn.addEventListener('click', () => {
      const answer = textarea.value.trim();
      // Evaluate the answer before submitting
      const result = this.evaluateAnswer(question, answer);
      // Show feedback
      feedback.style.display = 'block';
      if (result.correct) {
        feedback.textContent = 'Correct!';
        feedback.style.color = '#008000';
      } else {
        // Show which keywords were missing for diagrams
        const missing = question.keywords.filter(kw => !(result.keywordsFound || []).includes(kw));
        feedback.textContent = 'Incorrect. Missing keywords: ' + missing.join(', ');
        feedback.style.color = '#d32f2f';
      }
      // Delay slightly before moving to next question so the user can read feedback
      setTimeout(() => {
        this.handleSubmit(answer);
      }, 800);
    });
    // Use Phaser DOMElement to integrate the container into the scene
    this.domContainer = this.add.dom(GAME_WIDTH / 2, GAME_HEIGHT - 200, container);
  }
  evaluateAnswer(question, userAnswer) {
    // Basic keyword matching. Score is true if at least half of the keywords are present.
    const text = userAnswer.toLowerCase();
    let matched = [];
    let count = 0;
    question.keywords.forEach(kw => {
      const k = kw.toLowerCase();
      if (text.includes(k)) {
        count++;
        matched.push(kw);
      }
    });
    const correct = count >= Math.ceil(question.keywords.length / 2);
    return { correct: correct, keywordsFound: matched };
  }
}

// CalculationScene – player performs numerical calculations. Data is
// presented, user enters an answer. Feedback is given at the end of
// session; the scene stores user answers for later comparison.
class CalculationScene extends QuestionScene {
  constructor() {
    super('calculation');
  }
  createQuestionUI(question) {
    // Update progress bar
    this.updateProgressBar();
    // Reset text objects array for this question
    this.textObjects = [];
    const yStart = 120;
    // Prompt text
    const prompt = this.add.text(50, yStart, question.prompt, {
      fontSize: '18px',
      color: '#000000',
      wordWrap: { width: GAME_WIDTH - 100 }
    });
    this.textObjects.push(prompt);
    // Additional data display if needed. We'll show key data values for clarity.
    const dataText = this.add.text(50, yStart + prompt.height + 10, 'Data: ' + JSON.stringify(question.data), {
      fontSize: '16px',
      color: '#000000'
    });
    this.textObjects.push(dataText);
    // DOM for user input, feedback and controls
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.marginTop = '10px';
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'ui-input';
    input.placeholder = 'Enter your answer';
    container.appendChild(input);
    // Feedback element
    const feedback = document.createElement('p');
    feedback.style.display = 'none';
    feedback.style.fontWeight = 'bold';
    container.appendChild(feedback);
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'ui-button';
    nextBtn.textContent = this.currentIndex === this.questions.length - 1 ? 'Finish Session' : 'Next Question';
    container.appendChild(nextBtn);
    nextBtn.addEventListener('click', () => {
      const value = input.value.trim();
      // Evaluate answer
      const result = this.evaluateAnswer(question, value);
      feedback.style.display = 'block';
      if (result.correct) {
        feedback.textContent = 'Correct!';
        feedback.style.color = '#008000';
      } else {
        feedback.textContent = 'Incorrect. Correct answer: ' + question.answer;
        feedback.style.color = '#d32f2f';
      }
      setTimeout(() => {
        this.handleSubmit(value);
      }, 800);
    });
    this.domContainer = this.add.dom(GAME_WIDTH / 2, GAME_HEIGHT - 160, container);
  }
  evaluateAnswer(question, userAnswer) {
    // Convert user answer to number if possible
    const userVal = parseFloat(userAnswer);
    const correctVal = parseFloat(question.answer);
    // Accept answers within a tolerance of 1% for rounding errors
    const tolerance = Math.abs(correctVal) * 0.01;
    const correct = Math.abs(userVal - correctVal) <= tolerance;
    return { correct: correct };
  }
}

// EssayScene – "3 Bullets and a Chain" game. Players map out answers
// to IB‑style essay questions by producing three analytical points and
// a reasoning chain for each one.
class EssayScene extends QuestionScene {
  constructor() {
    super('essay');
  }
  createQuestionUI(question) {
    // Update progress bar
    this.updateProgressBar();
    this.textObjects = [];
    const yStart = 110;
    // Display command term and topic
    const header = this.add.text(50, yStart, `Command Term: ${question.commandTerm}\nTopic: ${question.topic}`, {
      fontSize: '18px',
      color: '#000000'
    });
    this.textObjects.push(header);
    const contextY = header.y + header.height + 10;
    const contextStr = question.context ? 'Context: ' + question.context : '';
    const contextText = this.add.text(50, contextY, contextStr, {
      fontSize: '16px',
      color: '#000000',
      wordWrap: { width: GAME_WIDTH - 100 }
    });
    this.textObjects.push(contextText);
    const promptY = contextText.y + contextText.height + 10;
    const promptText = this.add.text(50, promptY, 'Question: ' + question.prompt, {
      fontSize: '18px',
      color: '#000000',
      wordWrap: { width: GAME_WIDTH - 100 }
    });
    this.textObjects.push(promptText);
    // Container for interactive elements
    const container = document.createElement('div');
    container.className = 'essay-container';

    // Step 1 – Draw the question card
    const step1 = document.createElement('p');
    step1.textContent = 'Step 1 – Draw the Question Card (1 minute): read once and identify the command term and focus.';
    container.appendChild(step1);

    // Step 2 – Three bullet headlines
    const step2 = document.createElement('p');
    step2.textContent = 'Step 2 – The "3 Bullets" Rule (2 minutes)';
    container.appendChild(step2);
    const bullets = [];
    for (let i = 0; i < 3; i++) {
      const b = document.createElement('input');
      b.className = 'ui-input';
      b.placeholder = `Bullet ${i + 1} headline...`;
      container.appendChild(b);
      bullets.push(b);
    }

    // Step 3 – Build the chain
    const step3 = document.createElement('p');
    step3.textContent = 'Step 3 – Build the Chain (6 minutes)';
    container.appendChild(step3);
    const chains = [];
    bullets.forEach((_, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'chain-group';
      const title = document.createElement('p');
      title.textContent = `Bullet ${i + 1}`;
      title.style.flex = '1 1 100%';
      wrap.appendChild(title);
      const labels = ['Theory', 'Analysis', 'Example', 'Evaluation'];
      const chain = {};
      labels.forEach(l => {
        const input = document.createElement('input');
        input.className = 'ui-input';
        input.placeholder = `${l}...`;
        wrap.appendChild(input);
        chain[l.toLowerCase()] = input;
      });
      container.appendChild(wrap);
      chains.push(chain);
    });

    // Step 4 – Skeleton
    const step4 = document.createElement('p');
    step4.textContent = 'Step 4 – One‑Minute Skeleton (1 minute)';
    container.appendChild(step4);
    const skeleton = document.createElement('textarea');
    skeleton.className = 'ui-textarea';
    skeleton.placeholder = 'Outline intro, bullets and judgment...';
    container.appendChild(skeleton);
    const wordCount = document.createElement('p');
    wordCount.className = 'word-count';
    wordCount.textContent = 'Word count: 0';
    container.appendChild(wordCount);
    const updateSkeleton = () => {
      skeleton.style.height = 'auto';
      skeleton.style.height = skeleton.scrollHeight + 'px';
      const words = skeleton.value.trim().split(/\s+/).filter(Boolean);
      wordCount.textContent = `Word count: ${words.length}`;
    };
    skeleton.addEventListener('input', updateSkeleton);
    updateSkeleton();

    // Step 5 – Reverse Marker prompts
    const step5 = document.createElement('div');
    step5.innerHTML = '<p>Step 5 – Bonus Round: Reverse Marker (3 minutes)</p><ul>' +
      '<li>Does every paragraph link back to the question?</li>' +
      '<li>Are my examples short and integrated, not storytelling?</li>' +
      '<li>Is my evaluation relevant, or just filler?</li></ul>';
    container.appendChild(step5);

    const feedback = document.createElement('p');
    feedback.style.display = 'none';
    feedback.style.fontWeight = 'bold';
    container.appendChild(feedback);
    const nextBtn = document.createElement('button');
    nextBtn.className = 'ui-button';
    nextBtn.textContent = this.currentIndex === this.questions.length - 1 ? 'Finish Session' : 'Next Question';
    const clearBtn = document.createElement('button');
    clearBtn.className = 'ui-button';
    clearBtn.textContent = 'Clear All';
    clearBtn.addEventListener('click', () => {
      bullets.forEach(b => b.value = '');
      chains.forEach(c => {
        Object.values(c).forEach(input => input.value = '');
      });
      skeleton.value = '';
      updateSkeleton();
    });
    const buttonRow = document.createElement('div');
    buttonRow.className = 'button-row';
    buttonRow.appendChild(clearBtn);
    buttonRow.appendChild(nextBtn);
    container.appendChild(buttonRow);
    nextBtn.addEventListener('click', () => {
      const response = {
        bullets: bullets.map(b => b.value.trim()),
        chains: chains.map(c => ({
          theory: c.theory.value.trim(),
          analysis: c.analysis.value.trim(),
          example: c.example.value.trim(),
          evaluation: c.evaluation.value.trim()
        })),
        skeleton: skeleton.value.trim()
      };
      const result = this.evaluateAnswer(response);
      feedback.style.display = 'block';
      if (result.correct) {
        feedback.textContent = 'Great! You completed the chain.';
        feedback.style.color = '#008000';
        setTimeout(() => {
          this.handleSubmit(response);
        }, 800);
      } else {
        feedback.textContent = 'Please complete all fields before continuing.';
        feedback.style.color = '#d32f2f';
      }
    });
    const formY = promptText.y + promptText.height + 20;
    this.domContainer = this.add.dom(GAME_WIDTH / 2, formY, container);
    this.domContainer.setOrigin(0.5, 0);
  }
  evaluateAnswer(response) {
    // Ensure all bullet headlines, chain links, and skeleton are filled in
    const bulletsFilled = response.bullets.every(b => b !== '');
    const chainsFilled = response.chains.every(c => c.theory && c.analysis && c.example && c.evaluation);
    const skeletonFilled = response.skeleton !== '';
    return { correct: bulletsFilled && chainsFilled && skeletonFilled };
  }
  getTitle() {
    return '3 Bullets and a Chain – Essay Mode';
  }
}

// CaseStudyScene – simplified paper 2 mode. Presents a scenario with data
// and sub‑questions. The user responds to each part. At the end of the
// session, answers are evaluated qualitatively by keyword presence.
class CaseStudyScene extends QuestionScene {
  constructor() {
    super('case');
  }
  // Override cleanup to destroy case text container as well
  cleanup() {
    // Call base cleanup to destroy domContainer and text objects
    super.cleanup();
    // Destroy case text DOM element if it exists
    if (this.caseDom) {
      this.caseDom.destroy();
      this.caseDom = null;
    }
    // Destroy subContainer wrapper if defined
    if (this.caseWrapper) {
      this.caseWrapper.destroy();
      this.caseWrapper = null;
    }
  }
  createQuestionUI(question) {
    // Update progress bar
    this.updateProgressBar();
    // Reset text objects array for this question
    this.textObjects = [];
    // Create a wrapper that uses flexbox to position the case text at the top
    // and the answer area at the bottom without overlap.  The wrapper will
    // occupy a large portion of the available vertical space and allow the
    // case text to scroll independently of the input area.
    const wrapper = document.createElement('div');
    wrapper.style.width = '90%';
    wrapper.style.margin = '0 auto';
    wrapper.style.marginTop = '10px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    // Increase height and enable scrolling so the entire case study and questions can be
    // scrolled if necessary.  This prevents the next button from being pushed offscreen.
    wrapper.style.height = '420px';
    wrapper.style.overflowY = 'auto';
    // Case content div (scrollable)
    const caseContent = document.createElement('div');
    caseContent.style.flex = '1';
    caseContent.style.overflowY = 'auto';
    // Context paragraph
    const ctxP = document.createElement('p');
    ctxP.style.fontSize = '18px';
    ctxP.style.fontWeight = 'bold';
    ctxP.textContent = 'Context: ' + question.context;
    caseContent.appendChild(ctxP);
    // Background paragraph
    const bgP = document.createElement('p');
    bgP.style.fontSize = '16px';
    bgP.textContent = 'Background: ' + question.backgroundText;
    caseContent.appendChild(bgP);
    // Table if present
    if (question.table && question.table.length > 0) {
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      const headerRow = document.createElement('tr');
      const keys = Object.keys(question.table[0]);
      keys.forEach(k => {
        const th = document.createElement('th');
        th.textContent = k.charAt(0).toUpperCase() + k.slice(1);
        th.style.border = '1px solid #ccc';
        th.style.padding = '4px';
        th.style.background = '#e7eef5';
        headerRow.appendChild(th);
      });
      table.appendChild(headerRow);
      question.table.forEach(row => {
        const tr = document.createElement('tr');
        keys.forEach(k => {
          const td = document.createElement('td');
          td.textContent = row[k];
          td.style.border = '1px solid #ccc';
          td.style.padding = '4px';
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
      caseContent.appendChild(table);
    }
    wrapper.appendChild(caseContent);
    // Subcontainer for questions and answers.  We will fill this in
    // createSubQuestionUI().  Use flex: none to keep it sized to its content.
    const subDiv = document.createElement('div');
    subDiv.style.flex = 'none';
    subDiv.style.marginTop = '10px';
    wrapper.appendChild(subDiv);
    // Save references for later
    this.subContainer = subDiv;
    // Add the wrapper to the scene.  Save as caseWrapper so we can destroy it.
    this.caseWrapper = this.add.dom(GAME_WIDTH / 2, 110, wrapper);
    this.caseWrapper.setOrigin(0.5, 0);
    // Prepare to ask each sub‑question in sequence
    this.subIndex = 0;
    this.question = question;
    this.createSubQuestionUI();
  }
  createSubQuestionUI() {
    // Clear existing subContainer contents
    if (this.subContainer) {
      this.subContainer.innerHTML = '';
    }
    const subQ = this.question.subQuestions[this.subIndex];
    // Create prompt
    const prompt = document.createElement('p');
    prompt.textContent = 'Q' + (this.subIndex + 1) + ': ' + subQ.prompt;
    this.subContainer.appendChild(prompt);
    // Textarea for answer
    const textarea = document.createElement('textarea');
    textarea.className = 'ui-textarea';
    textarea.placeholder = 'Your answer...';
    this.subContainer.appendChild(textarea);
    // Feedback element for this sub‑question
    const feedback = document.createElement('p');
    feedback.style.display = 'none';
    feedback.style.fontWeight = 'bold';
    this.subContainer.appendChild(feedback);
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'ui-button';
    nextBtn.textContent = this.subIndex === this.question.subQuestions.length - 1 ? 'Submit Case Study' : 'Next Part';
    this.subContainer.appendChild(nextBtn);
    nextBtn.addEventListener('click', () => {
      const answer = textarea.value.trim();
      // Save answer for this subquestion. Store as part of current question answer list
      if (!Session.answers[this.currentIndex]) {
        Session.answers[this.currentIndex] = [];
      }
      Session.answers[this.currentIndex][this.subIndex] = answer;
      // Evaluate answer based on keyword overlap
      const keywords = subQ.answer.toLowerCase().split(/\W+/);
      const userWords = answer.toLowerCase().split(/\W+/);
      const matches = keywords.filter(k => userWords.includes(k));
      if (!Session.keywordsFound[this.currentIndex]) {
        Session.keywordsFound[this.currentIndex] = [];
      }
      Session.keywordsFound[this.currentIndex][this.subIndex] = matches;
      // Provide immediate feedback: at least one match means correct
      feedback.style.display = 'block';
      if (matches.length > 0) {
        feedback.textContent = 'Correct!';
        feedback.style.color = '#008000';
      } else {
        feedback.textContent = 'Incorrect. A sample correct answer: ' + subQ.answer;
        feedback.style.color = '#d32f2f';
      }
      // After a short delay, proceed to next subquestion or next case
      setTimeout(() => {
        this.subIndex++;
        if (this.subIndex < this.question.subQuestions.length) {
          this.createSubQuestionUI();
        } else {
          // All sub‑questions answered; record time and go to next question or summary
          const now = Date.now();
          const elapsed = now - (Session.lastTimestamp || Session.startTime);
          Session.times.push(elapsed);
          Session.lastTimestamp = now;
          this.currentIndex++;
          if (this.currentIndex < this.questions.length) {
            this.cleanup();
            this.createQuestionUI(this.questions[this.currentIndex]);
          } else {
            Session.endTime = Date.now();
            this.scene.start('SummaryScene');
          }
        }
      }, 800);
    });
    // We no longer use Phaser DOM for subquestions; they are part of the wrapper's HTML.
    // However, for compatibility we reset domContainer to null here.
    this.domContainer = null;
  }
  evaluateAnswer() {
    // Marking is done per sub‑question; overall correctness is not used here.
    return { correct: false };
  }
  getTitle() {
    return 'Paper 2 – Case Study Mode';
  }
}

// FlashcardScene – timed short questions. This implementation
// sequentially displays Q/A and collects responses. Timing and
// scoring are recorded. A more sophisticated implementation could
// randomise question order and implement a timer countdown.
class FlashcardScene extends QuestionScene {
  constructor() {
    super('flash');
  }
  createQuestionUI(question) {
    // Update progress bar
    this.updateProgressBar();
    // Reset text objects array for this question
    this.textObjects = [];
    const yStart = 180;
    const title = this.add.text(50, yStart, 'Flashcard Question:', {
      fontSize: '20px',
      color: '#000000'
    });
    this.textObjects.push(title);
    const qText = this.add.text(50, yStart + 40, question.question, {
      fontSize: '18px',
      color: '#000000',
      wordWrap: { width: GAME_WIDTH - 100 }
    });
    this.textObjects.push(qText);
    // Input
    const container = document.createElement('div');
    container.style.width = '100%';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ui-input';
    input.placeholder = 'Answer';
    container.appendChild(input);
    // Feedback element
    const feedback = document.createElement('p');
    feedback.style.display = 'none';
    feedback.style.fontWeight = 'bold';
    container.appendChild(feedback);
    const nextBtn = document.createElement('button');
    nextBtn.className = 'ui-button';
    nextBtn.textContent = this.currentIndex === this.questions.length - 1 ? 'Finish Session' : 'Next';
    container.appendChild(nextBtn);
    nextBtn.addEventListener('click', () => {
      const ans = input.value.trim();
      const result = this.evaluateAnswer(question, ans);
      feedback.style.display = 'block';
      if (result.correct) {
        feedback.textContent = 'Correct!';
        feedback.style.color = '#008000';
      } else {
        feedback.textContent = 'Incorrect. Correct answer: ' + question.answer;
        feedback.style.color = '#d32f2f';
      }
      setTimeout(() => {
        this.handleSubmit(ans);
      }, 800);
    });
    this.domContainer = this.add.dom(GAME_WIDTH / 2, GAME_HEIGHT - 160, container);
  }
  evaluateAnswer(question, userAnswer) {
    const correct = userAnswer.trim().toLowerCase() === question.answer.toLowerCase();
    return { correct: correct };
  }
  getTitle() {
    return 'Flashcard Mode';
  }
}

// LessonScene – guided lesson mode. Displays sequential sections loaded from
// window.LESSON_DATA with navigation, a progress bar and micro‑quizzes.
class LessonScene extends Phaser.Scene {
  constructor() {
    super('lesson');
  }
  init() {
    // Load lessons data
    this.lessons = Array.isArray(window.LESSON_DATA) ? window.LESSON_DATA : [];
    // Load progress index from storage or start at 0
    const savedIdx = parseInt(localStorage.getItem('lesson_progress') || '0');
    this.currentIndex = isNaN(savedIdx) ? 0 : Math.min(savedIdx, this.lessons.length - 1);
    // Load array of correct quiz answers from storage (array of booleans). This
    // array stores results for each quiz encountered. If the length is less than
    // the number of quizzes completed, we pad it with false entries.
    try {
      this.correctAnswers = JSON.parse(localStorage.getItem('lesson_correct') || '[]');
      if (!Array.isArray(this.correctAnswers)) this.correctAnswers = [];
    } catch (e) {
      this.correctAnswers = [];
    }
  }
  create() {
    // Back to menu button
    const backBtn = this.add.text(20, 10, 'Back to Menu', {
      fontSize: '18px',
      backgroundColor: '#1976d2',
      color: '#ffffff',
      padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setInteractive({ useHandCursor: true })
      .on('pointerover', () => backBtn.setBackgroundColor('#145a9e'))
      .on('pointerout', () => backBtn.setBackgroundColor('#1976d2'))
      .on('pointerdown', () => {
        // Save current progress before leaving
        localStorage.setItem('lesson_progress', this.currentIndex.toString());
        localStorage.setItem('lesson_correct', JSON.stringify(this.correctAnswers));
        this.scene.start('MenuScene');
      });
    // Title
    this.titleText = this.add.text(GAME_WIDTH / 2, 20, 'Lesson Mode', {
      fontSize: '26px',
      color: '#1e3a8a'
    }).setOrigin(0.5, 0);
    // Progress bar background
    const barWidth = 600;
    const barHeight = 14;
    const barX = (GAME_WIDTH - barWidth) / 2;
    const barY = 60;
    this.progressBg = this.add.rectangle(barX, barY, barWidth, barHeight, 0xcccccc).setOrigin(0, 0.5);
    this.progressFill = this.add.rectangle(barX, barY, 0, barHeight, 0x1976d2).setOrigin(0, 0.5);
    this.progressText = this.add.text(GAME_WIDTH / 2, barY + 20, '', {
      fontSize: '14px',
      color: '#333'
    }).setOrigin(0.5, 0);
    // Container for lesson content
    this.domContainer = null;
    // Render the current item
    this.renderCurrent();
  }
  updateProgressDisplay() {
    const total = this.lessons.length;
    const index = this.currentIndex;
    const pct = total > 0 ? index / total : 0;
    const barWidth = 600;
    this.progressFill.width = barWidth * pct;
    this.progressText.setText(`Section ${index + 1} / ${total}  (${Math.round(pct * 100)}%)`);
  }
  renderCurrent() {
    // Clear previous DOM container if exists
    if (this.domContainer) {
      this.domContainer.destroy();
      this.domContainer = null;
    }
    // Update progress bar and text
    this.updateProgressDisplay();
    const total = this.lessons.length;
    if (this.currentIndex >= total) {
      // Completed all sections: go to summary
      localStorage.setItem('lesson_progress', this.currentIndex.toString());
      localStorage.setItem('lesson_correct', JSON.stringify(this.correctAnswers));
      this.scene.start('LessonSummaryScene');
      return;
    }
    const item = this.lessons[this.currentIndex];
    // Create wrapper container
    const wrapper = document.createElement('div');
    wrapper.style.width = '90%';
    wrapper.style.margin = '0 auto';
    wrapper.style.marginTop = '80px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'stretch';
    // Content area (scrollable)
    const contentDiv = document.createElement('div');
    contentDiv.style.flex = '1';
    contentDiv.style.overflowY = 'auto';
    contentDiv.style.maxHeight = '350px';
    contentDiv.style.padding = '10px';
    contentDiv.style.border = '1px solid #ddd';
    contentDiv.style.background = '#fff';
    if (item.type === 'lesson') {
      // Lesson card: show title and content
      const titleEl = document.createElement('h3');
      titleEl.style.fontSize = '20px';
      titleEl.style.color = '#1e3a8a';
      titleEl.textContent = item.title;
      contentDiv.appendChild(titleEl);
      const para = document.createElement('p');
      para.style.fontSize = '16px';
      para.style.color = '#333';
      para.style.whiteSpace = 'pre-wrap';
      para.textContent = item.content;
      contentDiv.appendChild(para);
    } else if (item.type === 'quiz') {
      // Quiz card
      const promptEl = document.createElement('p');
      promptEl.style.fontSize = '18px';
      promptEl.style.fontWeight = 'bold';
      promptEl.textContent = item.prompt;
      contentDiv.appendChild(promptEl);
      // Input box
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Enter your answer...';
      input.className = 'ui-input';
      input.style.marginTop = '10px';
      contentDiv.appendChild(input);
      // Feedback element
      const feedback = document.createElement('p');
      feedback.style.display = 'none';
      feedback.style.fontWeight = 'bold';
      contentDiv.appendChild(feedback);
      // Check answer button
      const checkBtn = document.createElement('button');
      checkBtn.className = 'ui-button';
      checkBtn.textContent = 'Check Answer';
      checkBtn.style.marginTop = '10px';
      contentDiv.appendChild(checkBtn);
      // Track whether this quiz has been answered
      let answered = false;
      checkBtn.addEventListener('click', () => {
        if (answered) return;
        const ans = input.value.trim().toLowerCase();
        const keywords = item.keywords || [];
        const correct = keywords.some(k => ans.includes(k.toLowerCase()));
        answered = true;
        feedback.style.display = 'block';
        if (correct) {
          feedback.textContent = 'Correct!';
          feedback.style.color = '#008000';
        } else {
          feedback.textContent = 'Not quite. ' + (item.explanation || 'Key concepts include: ' + keywords.join(', '));
          feedback.style.color = '#d32f2f';
        }
        // Save result
        this.correctAnswers[this.correctAnswers.length] = correct;
        localStorage.setItem('lesson_correct', JSON.stringify(this.correctAnswers));
      });
    }
    wrapper.appendChild(contentDiv);
    // Navigation area
    const navDiv = document.createElement('div');
    navDiv.style.display = 'flex';
    navDiv.style.justifyContent = 'space-between';
    navDiv.style.marginTop = '10px';
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'ui-button';
    prevBtn.textContent = 'Back';
    prevBtn.disabled = this.currentIndex === 0;
    prevBtn.addEventListener('click', () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        localStorage.setItem('lesson_progress', this.currentIndex.toString());
        this.renderCurrent();
      }
    });
    navDiv.appendChild(prevBtn);
    // Next or Finish button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'ui-button';
    nextBtn.textContent = this.currentIndex === total - 1 ? 'Finish' : 'Next';
    nextBtn.addEventListener('click', () => {
      // If this is a quiz and not answered, auto-mark as incorrect
      const current = this.lessons[this.currentIndex];
      if (current.type === 'quiz') {
        const alreadyCounted = this.correctAnswers.length >= this.lessons.filter(i => i.type === 'quiz' && this.lessons.indexOf(i) < this.currentIndex).length + 1;
        if (!alreadyCounted) {
          // Record false if user skipped checking answer
          this.correctAnswers[this.correctAnswers.length] = false;
          localStorage.setItem('lesson_correct', JSON.stringify(this.correctAnswers));
        }
      }
      this.currentIndex++;
      localStorage.setItem('lesson_progress', this.currentIndex.toString());
      this.renderCurrent();
    });
    navDiv.appendChild(nextBtn);
    wrapper.appendChild(navDiv);
    // Add wrapper to the scene
    this.domContainer = this.add.dom(GAME_WIDTH / 2, 0, wrapper);
    this.domContainer.setOrigin(0.5, 0);
  }
}

// LessonSummaryScene – displays the results of the lesson, including
// number of sections completed and quiz performance. Offers options to
// restart or return to menu.
class LessonSummaryScene extends Phaser.Scene {
  constructor() {
    super('LessonSummaryScene');
  }
  create() {
    // Title
    this.add.text(GAME_WIDTH / 2, 40, 'Lesson Summary', { fontSize: '30px', color: '#1e3a8a' }).setOrigin(0.5);
    // Back to menu button
    const backBtn = this.add.text(20, 10, 'Back to Menu', {
      fontSize: '18px', backgroundColor: '#1976d2', color: '#ffffff', padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setInteractive({ useHandCursor: true })
      .on('pointerover', () => backBtn.setBackgroundColor('#145a9e'))
      .on('pointerout', () => backBtn.setBackgroundColor('#1976d2'))
      .on('pointerdown', () => {
        this.scene.start('MenuScene');
      });
    // Retrieve lesson data and quiz performance
    const lessons = Array.isArray(window.LESSON_DATA) ? window.LESSON_DATA : [];
    const totalSections = lessons.length;
    const totalQuizzes = lessons.filter(item => item.type === 'quiz').length;
    let correctAnswers = [];
    try {
      correctAnswers = JSON.parse(localStorage.getItem('lesson_correct') || '[]');
      if (!Array.isArray(correctAnswers)) correctAnswers = [];
    } catch (e) {
      correctAnswers = [];
    }
    const correctCount = correctAnswers.reduce((acc, val) => acc + (val ? 1 : 0), 0);
    // Stats text
    let stats = `Sections completed: ${totalSections}\n`;
    stats += `Quizzes answered: ${totalQuizzes}\n`;
    stats += `Correct quiz answers: ${correctCount}\n`;
    stats += `Accuracy: ${totalQuizzes > 0 ? Math.round((correctCount / totalQuizzes) * 100) : 0}%`;
    this.add.text(60, 100, stats, { fontSize: '18px', color: '#333' });
    // Button to restart the lesson from the beginning
    const restartBtn = this.add.text(GAME_WIDTH / 2, 220, 'Restart Lesson', {
      fontSize: '20px', backgroundColor: '#1976d2', color: '#ffffff', padding: { left: 12, right: 12, top: 6, bottom: 6 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', () => restartBtn.setBackgroundColor('#145a9e'))
      .on('pointerout', () => restartBtn.setBackgroundColor('#1976d2'))
      .on('pointerdown', () => {
        localStorage.setItem('lesson_progress', '0');
        localStorage.setItem('lesson_correct', '[]');
        this.scene.start('lesson');
      });
    // Button to review wrong answers – show sections where quiz was answered incorrectly
    const reviewBtn = this.add.text(GAME_WIDTH / 2, 260, 'Review Wrong Answers', {
      fontSize: '20px', backgroundColor: '#ffa000', color: '#ffffff', padding: { left: 12, right: 12, top: 6, bottom: 6 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', () => reviewBtn.setBackgroundColor('#cc7a00'))
      .on('pointerout', () => reviewBtn.setBackgroundColor('#ffa000'))
      .on('pointerdown', () => {
        // build list of indices of quizzes answered incorrectly
        const wrongIndexes = [];
        let quizCounter = 0;
        for (let i = 0; i < lessons.length; i++) {
          if (lessons[i].type === 'quiz') {
            const correct = correctAnswers[quizCounter] || false;
            if (!correct) {
              wrongIndexes.push(i);
            }
            quizCounter++;
          }
        }
        if (wrongIndexes.length === 0) {
          alert('No wrong answers to review – great job!');
          return;
        }
        // Save wrong indexes to localStorage and start lesson at first wrong one
        localStorage.setItem('lesson_review_indexes', JSON.stringify(wrongIndexes));
        // Use LessonScene to iterate through wrong answers. Set special mode? We'll reuse lesson
        this.scene.start('lessonReview');
      });
  }
}

// LessonReviewScene – shows only the lessons/quizzes that were answered incorrectly.
class LessonReviewScene extends Phaser.Scene {
  constructor() {
    super('lessonReview');
  }
  init() {
    // Load wrong indexes from storage
    try {
      this.reviewIndexes = JSON.parse(localStorage.getItem('lesson_review_indexes') || '[]');
    } catch (e) {
      this.reviewIndexes = [];
    }
    this.lessons = Array.isArray(window.LESSON_DATA) ? window.LESSON_DATA : [];
    this.correctAnswers = [];
    this.currentReviewPos = 0;
  }
  create() {
    // Title
    this.add.text(GAME_WIDTH / 2, 20, 'Review Wrong Answers', { fontSize: '26px', color: '#1e3a8a' }).setOrigin(0.5);
    // Back to summary button
    const backBtn = this.add.text(20, 10, 'Back', {
      fontSize: '18px', backgroundColor: '#1976d2', color: '#ffffff', padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setInteractive({ useHandCursor: true })
      .on('pointerover', () => backBtn.setBackgroundColor('#145a9e'))
      .on('pointerout', () => backBtn.setBackgroundColor('#1976d2'))
      .on('pointerdown', () => {
        this.scene.start('LessonSummaryScene');
      });
    // Progress bar for review
    const barWidth = 600;
    const barHeight = 14;
    const barX = (GAME_WIDTH - barWidth) / 2;
    const barY = 60;
    this.progressBg = this.add.rectangle(barX, barY, barWidth, barHeight, 0xcccccc).setOrigin(0, 0.5);
    this.progressFill = this.add.rectangle(barX, barY, 0, barHeight, 0x1976d2).setOrigin(0, 0.5);
    this.progressText = this.add.text(GAME_WIDTH / 2, barY + 20, '', { fontSize: '14px', color: '#333' }).setOrigin(0.5, 0);
    this.domContainer = null;
    this.renderCurrent();
  }
  updateProgress() {
    const total = this.reviewIndexes.length;
    const idx = this.currentReviewPos;
    const pct = total > 0 ? idx / total : 0;
    const barWidth = 600;
    this.progressFill.width = barWidth * pct;
    this.progressText.setText(`Item ${idx + 1} / ${total} (${Math.round(pct * 100)}%)`);
  }
  renderCurrent() {
    if (this.domContainer) {
      this.domContainer.destroy();
      this.domContainer = null;
    }
    this.updateProgress();
    if (this.currentReviewPos >= this.reviewIndexes.length) {
      // Done reviewing
      this.scene.start('LessonSummaryScene');
      return;
    }
    const lessonIndex = this.reviewIndexes[this.currentReviewPos];
    const item = this.lessons[lessonIndex];
    // Create wrapper for content
    const wrapper = document.createElement('div');
    wrapper.style.width = '90%';
    wrapper.style.margin = '0 auto';
    wrapper.style.marginTop = '80px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'stretch';
    const contentDiv = document.createElement('div');
    contentDiv.style.flex = '1';
    contentDiv.style.overflowY = 'auto';
    contentDiv.style.maxHeight = '350px';
    contentDiv.style.padding = '10px';
    contentDiv.style.border = '1px solid #ddd';
    contentDiv.style.background = '#fff';
    if (item.type === 'lesson') {
      const titleEl = document.createElement('h3');
      titleEl.style.fontSize = '20px';
      titleEl.style.color = '#1e3a8a';
      titleEl.textContent = item.title;
      contentDiv.appendChild(titleEl);
      const para = document.createElement('p');
      para.style.fontSize = '16px';
      para.style.color = '#333';
      para.style.whiteSpace = 'pre-wrap';
      para.textContent = item.content;
      contentDiv.appendChild(para);
    } else if (item.type === 'quiz') {
      const promptEl = document.createElement('p');
      promptEl.style.fontSize = '18px';
      promptEl.style.fontWeight = 'bold';
      promptEl.textContent = item.prompt;
      contentDiv.appendChild(promptEl);
      const explanation = document.createElement('p');
      explanation.style.fontSize = '16px';
      explanation.style.color = '#333';
      explanation.style.marginTop = '10px';
      explanation.textContent = 'Explanation: ' + (item.explanation || 'Key concepts include: ' + (item.keywords || []).join(', '));
      contentDiv.appendChild(explanation);
    }
    wrapper.appendChild(contentDiv);
    // Navigation buttons: previous (Back) and next
    const navDiv = document.createElement('div');
    navDiv.style.display = 'flex';
    navDiv.style.justifyContent = 'space-between';
    navDiv.style.marginTop = '10px';
    const backBtnDom = document.createElement('button');
    backBtnDom.className = 'ui-button';
    backBtnDom.textContent = 'Back';
    backBtnDom.disabled = this.currentReviewPos === 0;
    backBtnDom.addEventListener('click', () => {
      if (this.currentReviewPos > 0) {
        this.currentReviewPos--;
        this.renderCurrent();
      }
    });
    navDiv.appendChild(backBtnDom);
    const nextBtnDom = document.createElement('button');
    nextBtnDom.className = 'ui-button';
    nextBtnDom.textContent = this.currentReviewPos === this.reviewIndexes.length - 1 ? 'Finish' : 'Next';
    nextBtnDom.addEventListener('click', () => {
      this.currentReviewPos++;
      this.renderCurrent();
    });
    navDiv.appendChild(nextBtnDom);
    wrapper.appendChild(navDiv);
    this.domContainer = this.add.dom(GAME_WIDTH / 2, 0, wrapper);
    this.domContainer.setOrigin(0.5, 0);
  }
}

// SummaryScene – displays a report of the session. Includes accuracy by
// topic, most common errors, time per question and suggested areas for
// targeted revision. This simple implementation focuses on accuracy and
// time; enhancements could include interactive charts.
class SummaryScene extends Phaser.Scene {
  constructor() {
    super('SummaryScene');
  }
  create() {
    this.add.text(GAME_WIDTH / 2, 40, 'Session Summary', { fontSize: '30px', color: '#1e3a8a' }).setOrigin(0.5);

    // Back to menu button on summary screen (top left)
    const backBtn = this.add.text(20, 10, 'Back to Menu', {
      fontSize: '18px',
      backgroundColor: '#1976d2',
      color: '#ffffff',
      padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setInteractive({ useHandCursor: true })
      .on('pointerover', () => backBtn.setBackgroundColor('#145a9e'))
      .on('pointerout', () => backBtn.setBackgroundColor('#1976d2'))
      .on('pointerdown', () => {
        this.scene.start('MenuScene');
      });
    // Calculate total correct answers and total time
    const totalQ = Session.questions.length;
    let correctCount = 0;
    Session.correct.forEach(c => { if (Array.isArray(c)) return; if (c) correctCount++; });
    // For case study, each sub‑question is not counted in correct array. We'll count matches length > 0.
    if (Session.mode === 'case') {
      correctCount = 0;
      Session.keywordsFound.forEach(arr => {
        if (Array.isArray(arr)) {
          arr.forEach(subArr => { if (subArr && subArr.length > 0) correctCount++; });
        }
      });
    }
    const totalTime = Session.endTime - Session.startTime;
    const timeSeconds = (totalTime / 1000).toFixed(1);
    // Display overall stats
    const statsText = `Mode: ${Session.mode}\nDifficulty level: ${Session.level}\nQuestions attempted: ${totalQ}\nCorrect responses: ${correctCount}\nTotal time: ${timeSeconds} s`;
    this.add.text(60, 90, statsText, { fontSize: '18px', color: '#333' });
    // Display suggestions based on incorrect answers or missing keywords
    let suggestions = [];
    if (Session.mode === 'diagram' || Session.mode === 'essay') {
      Session.questions.forEach((q, idx) => {
        const missed = q.keywords.filter(kw => !Session.keywordsFound[idx] || !Session.keywordsFound[idx].includes(kw));
        if (missed.length > 0) {
          suggestions.push(`Question ${idx + 1} (${q.topic}): review concepts – missing keywords: ${missed.join(', ')}`);
        }
      });
    }
    if (Session.mode === 'calculation') {
      Session.questions.forEach((q, idx) => {
        const ans = parseFloat(Session.answers[idx]);
        const correct = parseFloat(q.answer);
        if (isNaN(ans) || Math.abs(ans - correct) > Math.abs(correct) * 0.01) {
          suggestions.push(`Question ${idx + 1} (${q.topic}): practise the calculation steps shown in the solution.`);
        }
      });
    }
    if (Session.mode === 'case') {
      Session.questions.forEach((q, idx) => {
        q.subQuestions.forEach((sq, subIdx) => {
          const matches = Session.keywordsFound[idx][subIdx] || [];
          if (matches.length === 0) {
            suggestions.push(`Case Q${idx + 1} Part ${subIdx + 1}: revisit this topic – answer may lack key elements.`);
          }
        });
      });
    }
    if (Session.mode === 'flash') {
      Session.questions.forEach((q, idx) => {
        if (!Session.correct[idx]) {
          suggestions.push(`Flashcard ${idx + 1} (${q.topic}): review this definition.`);
        }
      });
    }
    const sugY = 200;
    this.add.text(60, sugY, 'Suggested revision areas:', { fontSize: '20px', color: '#1e3a8a' });
    if (suggestions.length === 0) {
      this.add.text(60, sugY + 30, 'Great job! You answered all questions correctly or included all keywords.', { fontSize: '16px', color: '#008000' });
    } else {
      suggestions.forEach((line, idx) => {
        this.add.text(60, sugY + 30 + idx * 20, '- ' + line, { fontSize: '16px', color: '#d32f2f' });
      });
    }
    // Button to return to main menu
    const menuBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, 'Back to Menu', { fontSize: '20px', backgroundColor: '#1976d2', color: '#fff', padding: 10 })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', function () { this.setBackgroundColor('#145a9e'); })
      .on('pointerout', function () { this.setBackgroundColor('#1976d2'); })
      .on('pointerdown', () => {
        this.scene.start('MenuScene');
      });
  }
}

// BookmarkReviewScene – allows users to review questions they have bookmarked.  It
// aggregates bookmarked questions across all modes, presents the prompt and
// solution or mark scheme, and lets the user remove bookmarks or move on to
// the next bookmarked question.  If no bookmarks exist, it displays a
// message and provides a button to return to the menu.
class BookmarkReviewScene extends Phaser.Scene {
  constructor() {
    super('BookmarkReviewScene');
  }
  create() {
    // Add back button
    const back = this.add.text(20, 10, 'Back to Menu', {
      fontSize: '18px', backgroundColor: '#1976d2', color: '#fff', padding: { left: 8, right: 8, top: 4, bottom: 4 }
    }).setInteractive({ useHandCursor: true })
      .on('pointerover', () => back.setBackgroundColor('#145a9e'))
      .on('pointerout', () => back.setBackgroundColor('#1976d2'))
      .on('pointerdown', () => {
        this.scene.start('MenuScene');
      });
    this.add.text(GAME_WIDTH / 2, 40, 'Review Bookmarked Questions', { fontSize: '28px', color: '#1e3a8a' }).setOrigin(0.5);
    // Retrieve bookmarked IDs
    let bookmarks;
    try {
      bookmarks = JSON.parse(localStorage.getItem('ib_econ_bookmarks')) || [];
    } catch (e) {
      bookmarks = [];
    }
    // Flatten all questions into a map by ID for quick lookup
    const allMap = {};
    for (const mode in QUESTIONS) {
      (QUESTIONS[mode] || []).forEach(q => {
        if (q.id) allMap[q.id] = q;
      });
    }
    // Filter existing bookmarked IDs to those present in the dataset
    this.bookmarkedQuestions = bookmarks.map(id => allMap[id]).filter(Boolean);
    this.index = 0;
    if (this.bookmarkedQuestions.length === 0) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'No bookmarks found.', { fontSize: '20px', color: '#333' }).setOrigin(0.5);
      return;
    }
    // Show the first bookmarked question
    this.showCurrent();
  }
  showCurrent() {
    // Cleanup existing content
    if (this.domContainer) {
      this.domContainer.destroy();
      this.domContainer = null;
    }
    // Display current question details and solution
    const q = this.bookmarkedQuestions[this.index];
    const container = document.createElement('div');
    container.style.width = '90%';
    container.style.margin = '0 auto';
    container.style.maxHeight = '400px';
    container.style.overflowY = 'auto';
    // Title
    const title = document.createElement('p');
    title.style.fontSize = '18px';
    title.style.fontWeight = 'bold';
    title.textContent = `Question ${this.index + 1} of ${this.bookmarkedQuestions.length}`;
    container.appendChild(title);
    // Show prompt and context differently depending on type
    const mode = q.mode || (function () {
      // attempt to guess mode based on properties
      if (q.subQuestions) return 'case';
      if (q.calculation) return 'calculation';
      if (q.commandTerm) return 'essay';
      if (q.expectedDiagram) return 'diagram';
      if (q.flash) return 'flash';
      return '';
    })();
    // Basic display of question details
    const prompt = document.createElement('p');
    prompt.style.fontSize = '16px';
    prompt.style.fontWeight = 'bold';
    prompt.textContent = `Mode: ${mode}`;
    container.appendChild(prompt);
    const ctx = document.createElement('p');
    ctx.style.fontSize = '16px';
    ctx.textContent = q.context ? 'Context: ' + q.context : '';
    if (ctx.textContent) container.appendChild(ctx);
    const questionP = document.createElement('p');
    questionP.style.fontSize = '16px';
    if (mode === 'case') {
      questionP.textContent = q.backgroundText ? 'Background: ' + q.backgroundText : '';
      container.appendChild(questionP);
      // Provide a list of subquestions and answers
      q.subQuestions.forEach((sq, idx) => {
        const sp = document.createElement('p');
        sp.style.marginLeft = '10px';
        sp.innerHTML = `<strong>Q${idx + 1}:</strong> ${sq.prompt}<br/><em>Answer:</em> ${sq.answer}`;
        container.appendChild(sp);
      });
    } else if (mode === 'calculation') {
      questionP.textContent = q.prompt;
      container.appendChild(questionP);
      const sol = document.createElement('p');
      sol.style.marginLeft = '10px';
      sol.innerHTML = `<em>Correct answer:</em> ${q.answer}`;
      container.appendChild(sol);
    } else if (mode === 'essay') {
      questionP.textContent = q.prompt;
      container.appendChild(questionP);
      const sol = document.createElement('p');
      sol.style.marginLeft = '10px';
      sol.innerHTML = `<em>Sample outline:</em> ${Array.isArray(q.solutionOutline) ? q.solutionOutline.join('; ') : ''}`;
      container.appendChild(sol);
    } else if (mode === 'diagram') {
      questionP.textContent = q.prompt;
      container.appendChild(questionP);
      const sol = document.createElement('p');
      sol.style.marginLeft = '10px';
      sol.innerHTML = `<em>Expected Diagram:</em> ${q.expectedDiagram}<br/><em>Explanation:</em> ${q.solutionExplanation}`;
      container.appendChild(sol);
    } else if (mode === 'flash') {
      questionP.textContent = q.prompt;
      container.appendChild(questionP);
      const sol = document.createElement('p');
      sol.style.marginLeft = '10px';
      sol.innerHTML = `<em>Answer:</em> ${q.answer}`;
      container.appendChild(sol);
    } else {
      questionP.textContent = q.prompt;
      container.appendChild(questionP);
    }
    // Buttons: remove bookmark and next
    const btnWrapper = document.createElement('div');
    btnWrapper.style.display = 'flex';
    btnWrapper.style.justifyContent = 'space-between';
    btnWrapper.style.marginTop = '10px';
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'ui-button';
    removeBtn.textContent = 'Remove Bookmark';
    removeBtn.addEventListener('click', () => {
      // Remove from localStorage
      let list;
      try {
        list = JSON.parse(localStorage.getItem('ib_econ_bookmarks')) || [];
      } catch (e) {
        list = [];
      }
      const idx = list.indexOf(q.id);
      if (idx >= 0) {
        list.splice(idx, 1);
        localStorage.setItem('ib_econ_bookmarks', JSON.stringify(list));
      }
      // Remove from local copy and update view
      this.bookmarkedQuestions.splice(this.index, 1);
      if (this.bookmarkedQuestions.length === 0) {
        this.scene.restart();
      } else if (this.index >= this.bookmarkedQuestions.length) {
        this.index = this.bookmarkedQuestions.length - 1;
        this.showCurrent();
      } else {
        this.showCurrent();
      }
    });
    btnWrapper.appendChild(removeBtn);
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'ui-button';
    nextBtn.textContent = this.index < this.bookmarkedQuestions.length - 1 ? 'Next Bookmark' : 'Done';
    nextBtn.addEventListener('click', () => {
      if (this.index < this.bookmarkedQuestions.length - 1) {
        this.index++;
        this.showCurrent();
      } else {
        // Return to menu when done reviewing
        this.scene.start('MenuScene');
      }
    });
    btnWrapper.appendChild(nextBtn);
    container.appendChild(btnWrapper);
    this.domContainer = this.add.dom(GAME_WIDTH / 2, 100, container);
    this.domContainer.setOrigin(0.5, 0);
  }
}

// Configuration for the Phaser game. We enable the DOM plugin to
// integrate HTML elements seamlessly. The parent div is 'game-container'.
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  dom: {
    createContainer: true
  },
  scene: [BootScene, MenuScene, DiagramScene, CalculationScene, EssayScene, CaseStudyScene, FlashcardScene, LessonScene, LessonSummaryScene, LessonReviewScene, SummaryScene, BookmarkReviewScene],
  backgroundColor: '#f0f3f8'
};

// Start the game when the DOM has loaded. This ensures that the
// container element exists.
window.addEventListener('load', () => {
  new Phaser.Game(config);
});