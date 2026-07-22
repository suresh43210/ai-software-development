/* ==========================================================================
   Modern Tic Tac Toe - Logic & Game Engine
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Game State
  let board = Array(9).fill(null);
  let currentPlayer = 'X';
  let gameMode = 'ai'; // 'ai' or 'pvp'
  let aiDifficulty = 'impossible'; // 'impossible' or 'easy'
  let gameActive = true;
  let soundMuted = false;
  let scores = { X: 0, O: 0, ties: 0 };

  // DOM Elements
  const cells = document.querySelectorAll('.cell');
  const boardElement = document.getElementById('board');
  const statusText = document.getElementById('status-text');
  const statusBanner = document.getElementById('status-banner');
  const scoreXEl = document.getElementById('score-x');
  const scoreOEl = document.getElementById('score-o');
  const scoreTiesEl = document.getElementById('score-ties');
  const labelXEl = document.getElementById('label-x');
  const labelOEl = document.getElementById('label-o');

  const modeAiBtn = document.getElementById('mode-ai');
  const modePvpBtn = document.getElementById('mode-pvp');
  const aiDifficultyWrapper = document.getElementById('ai-difficulty-wrapper');
  const difficultySelect = document.getElementById('difficulty-select');

  const restartBtn = document.getElementById('restart-btn');
  const resetScoresBtn = document.getElementById('reset-scores-btn');
  const soundToggleBtn = document.getElementById('sound-toggle');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');

  const strikeLine = document.getElementById('strike-line');

  // Winning combinations and SVG strike line mapping (300x300 viewBox)
  const WINNING_COMBOS = [
    { combo: [0, 1, 2], line: { x1: 20, y1: 50, x2: 280, y2: 50 } },   // Row 1
    { combo: [3, 4, 5], line: { x1: 20, y1: 150, x2: 280, y2: 150 } }, // Row 2
    { combo: [6, 7, 8], line: { x1: 20, y1: 250, x2: 280, y2: 250 } }, // Row 3
    { combo: [0, 3, 6], line: { x1: 50, y1: 20, x2: 50, y2: 280 } },   // Col 1
    { combo: [1, 4, 7], line: { x1: 150, y1: 20, x2: 150, y2: 280 } }, // Col 2
    { combo: [2, 5, 8], line: { x1: 250, y1: 20, x2: 250, y2: 280 } }, // Col 3
    { combo: [0, 4, 8], line: { x1: 30, y1: 30, x2: 270, y2: 270 } },   // Diag 1
    { combo: [2, 4, 6], line: { x1: 270, y1: 30, x2: 30, y2: 270 } }    // Diag 2
  ];

  // SVG Symbol Templates
  const SVG_X = `
    <svg class="cell-symbol symbol-x" viewBox="0 0 100 100">
      <path d="M 20 20 L 80 80 M 80 20 L 20 80" />
    </svg>
  `;

  const SVG_O = `
    <svg class="cell-symbol symbol-o" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="32" />
    </svg>
  `;

  // ==========================================================================
  // Web Audio API Sound Synthesizer
  // ==========================================================================
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
  }

  function playTone(freq, duration, type = 'sine', delay = 0) {
    if (soundMuted) return;
    initAudio();
    if (!audioCtx) return;

    setTimeout(() => {
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } catch (e) {
        // Ignore audio playback errors
      }
    }, delay);
  }

  function playMoveSound(player) {
    if (player === 'X') {
      playTone(523.25, 0.1, 'sine'); // C5
    } else {
      playTone(659.25, 0.1, 'sine'); // E5
    }
  }

  function playWinSound() {
    playTone(523.25, 0.15, 'triangle', 0);   // C5
    playTone(659.25, 0.15, 'triangle', 120); // E5
    playTone(783.99, 0.15, 'triangle', 240); // G5
    playTone(1046.50, 0.3, 'triangle', 360); // C6
  }

  function playTieSound() {
    playTone(400, 0.15, 'sawtooth', 0);
    playTone(300, 0.25, 'sawtooth', 150);
  }

  function playClickSound() {
    playTone(800, 0.05, 'sine');
  }

  // ==========================================================================
  // Core Game Logic
  // ==========================================================================

  function handleCellClick(e) {
    const cell = e.target.closest('.cell');
    if (!cell) return;

    const index = parseInt(cell.getAttribute('data-index'), 10);

    if (board[index] !== null || !gameActive) return;
    if (gameMode === 'ai' && currentPlayer !== 'X') return;

    makeMove(index, currentPlayer);

    if (gameActive && gameMode === 'ai' && currentPlayer === 'O') {
      updateStatusDisplay("AI is thinking...");
      setTimeout(() => {
        makeAiMove();
      }, 400);
    }
  }

  function makeMove(index, player) {
    board[index] = player;
    const cell = cells[index];
    cell.innerHTML = player === 'X' ? SVG_X : SVG_O;
    cell.classList.add('taken');
    cell.setAttribute('aria-label', `Cell ${index + 1}, taken by ${player}`);

    playMoveSound(player);

    const winResult = checkWin(board);

    if (winResult) {
      handleGameOver(winResult);
    } else if (board.every(cell => cell !== null)) {
      handleGameOver({ winner: 'tie' });
    } else {
      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      updateTurnBoardClass();
      updateStatusDisplay();
    }
  }

  function checkWin(boardState) {
    for (const winCombo of WINNING_COMBOS) {
      const [a, b, c] = winCombo.combo;
      if (
        boardState[a] &&
        boardState[a] === boardState[b] &&
        boardState[a] === boardState[c]
      ) {
        return {
          winner: boardState[a],
          combo: winCombo.combo,
          line: winCombo.line
        };
      }
    }
    return null;
  }

  function handleGameOver(result) {
    gameActive = false;

    if (result.winner === 'tie') {
      scores.ties++;
      scoreTiesEl.textContent = scores.ties;
      statusBanner.className = 'status-banner tie';
      statusText.textContent = "It's a Tie! 🤝";
      playTieSound();
    } else {
      const winner = result.winner;
      scores[winner]++;
      if (winner === 'X') scoreXEl.textContent = scores.X;
      if (winner === 'O') scoreOEl.textContent = scores.O;

      // Highlight winning cells
      result.combo.forEach(idx => {
        cells[idx].classList.add('winning-cell', winner === 'X' ? 'x-cell' : 'o-cell');
      });

      // Draw SVG strike line
      drawStrikeLine(result.line);

      // Status text
      statusBanner.className = `status-banner winner-${winner.toLowerCase()}`;
      if (gameMode === 'ai') {
        statusText.textContent = winner === 'X' ? "You Won! 🎉" : "AI Won! 🤖";
      } else {
        statusText.textContent = `Player ${winner} Wins! 🎉`;
      }

      playWinSound();
    }
  }

  function drawStrikeLine(lineCoords) {
    const { x1, y1, x2, y2 } = lineCoords;
    const pathLength = Math.hypot(x2 - x1, y2 - y1);

    strikeLine.setAttribute('x1', x1);
    strikeLine.setAttribute('y1', y1);
    strikeLine.setAttribute('x2', x2);
    strikeLine.setAttribute('y2', y2);

    strikeLine.style.strokeDasharray = pathLength;
    strikeLine.style.strokeDashoffset = pathLength;
    strikeLine.getBoundingClientRect(); // Trigger reflow for animation
    strikeLine.style.strokeDashoffset = '0';
  }

  function clearStrikeLine() {
    strikeLine.setAttribute('x1', '0');
    strikeLine.setAttribute('y1', '0');
    strikeLine.setAttribute('x2', '0');
    strikeLine.setAttribute('y2', '0');
    strikeLine.style.strokeDasharray = 'none';
    strikeLine.style.strokeDashoffset = '0';
  }

  // ==========================================================================
  // AI Engine (Minimax for Unbeatable & Random for Easy)
  // ==========================================================================

  function makeAiMove() {
    if (!gameActive) return;

    let targetIndex;

    if (aiDifficulty === 'easy') {
      targetIndex = getRandomEmptyIndex();
    } else {
      targetIndex = getBestMinimaxMove();
    }

    if (targetIndex !== undefined && targetIndex !== null) {
      makeMove(targetIndex, 'O');
    }
  }

  function getRandomEmptyIndex() {
    const emptyIndices = board
      .map((val, idx) => (val === null ? idx : null))
      .filter(val => val !== null);

    if (emptyIndices.length === 0) return null;
    return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
  }

  function getBestMinimaxMove() {
    let bestScore = -Infinity;
    let bestMove = null;

    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'O';
        let score = minimax(board, 0, false);
        board[i] = null;

        if (score > bestScore) {
          bestScore = score;
          bestMove = i;
        }
      }
    }

    return bestMove;
  }

  function minimax(boardState, depth, isMaximizing) {
    const winResult = checkWin(boardState);

    if (winResult) {
      if (winResult.winner === 'O') return 10 - depth;
      if (winResult.winner === 'X') return depth - 10;
    }

    if (boardState.every(cell => cell !== null)) {
      return 0; // Tie
    }

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (boardState[i] === null) {
          boardState[i] = 'O';
          let score = minimax(boardState, depth + 1, false);
          boardState[i] = null;
          maxScore = Math.max(score, maxScore);
        }
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (boardState[i] === null) {
          boardState[i] = 'X';
          let score = minimax(boardState, depth + 1, true);
          boardState[i] = null;
          minScore = Math.min(score, minScore);
        }
      }
      return minScore;
    }
  }

  // ==========================================================================
  // UI & Event Handlers
  // ==========================================================================

  function updateStatusDisplay(customMessage = null) {
    if (!gameActive && !customMessage) return;

    statusBanner.className = 'status-banner';

    if (customMessage) {
      statusText.textContent = customMessage;
      return;
    }

    if (gameMode === 'ai') {
      statusText.textContent = currentPlayer === 'X' ? "Your Turn (X)" : "AI's Turn (O)";
    } else {
      statusText.textContent = `Player ${currentPlayer}'s Turn`;
    }
  }

  function updateTurnBoardClass() {
    boardElement.classList.remove('turn-x', 'turn-o');
    boardElement.classList.add(`turn-${currentPlayer.toLowerCase()}`);
  }

  function resetBoard() {
    board = Array(9).fill(null);
    currentPlayer = 'X';
    gameActive = true;

    cells.forEach((cell, index) => {
      cell.innerHTML = '';
      cell.className = 'cell';
      cell.setAttribute('aria-label', `Cell ${index + 1}`);
    });

    clearStrikeLine();
    updateTurnBoardClass();
    updateStatusDisplay();
  }

  function resetScores() {
    scores = { X: 0, O: 0, ties: 0 };
    scoreXEl.textContent = '0';
    scoreOEl.textContent = '0';
    scoreTiesEl.textContent = '0';
    resetBoard();
  }

  function setGameMode(mode) {
    if (gameMode === mode) return;

    gameMode = mode;
    playClickSound();

    if (mode === 'ai') {
      modeAiBtn.classList.add('active');
      modeAiBtn.setAttribute('aria-checked', 'true');
      modePvpBtn.classList.remove('active');
      modePvpBtn.setAttribute('aria-checked', 'false');
      aiDifficultyWrapper.classList.remove('hidden');

      labelXEl.textContent = "PLAYER (X)";
      labelOEl.textContent = "AI (O)";
    } else {
      modePvpBtn.classList.add('active');
      modePvpBtn.setAttribute('aria-checked', 'true');
      modeAiBtn.classList.remove('active');
      modeAiBtn.setAttribute('aria-checked', 'false');
      aiDifficultyWrapper.classList.add('hidden');

      labelXEl.textContent = "PLAYER (X)";
      labelOEl.textContent = "PLAYER (O)";
    }

    resetScores();
  }

  // Event Listeners
  cells.forEach(cell => {
    cell.addEventListener('click', handleCellClick);
  });

  restartBtn.addEventListener('click', () => {
    playClickSound();
    resetBoard();
  });

  resetScoresBtn.addEventListener('click', () => {
    playClickSound();
    resetScores();
  });

  modeAiBtn.addEventListener('click', () => setGameMode('ai'));
  modePvpBtn.addEventListener('click', () => setGameMode('pvp'));

  difficultySelect.addEventListener('change', (e) => {
    playClickSound();
    aiDifficulty = e.target.value;
    resetBoard();
  });

  soundToggleBtn.addEventListener('click', () => {
    soundMuted = !soundMuted;
    if (soundMuted) {
      soundIconOn.classList.add('hidden');
      soundIconOff.classList.remove('hidden');
    } else {
      soundIconOff.classList.add('hidden');
      soundIconOn.classList.remove('hidden');
      playClickSound();
    }
  });

  // Initialization
  resetBoard();
});
