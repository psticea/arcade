import type { DifficultyTier } from './game/difficulty.ts'
import type { GameLanguage } from './game/wordManager.ts'

interface UiCopy {
  start: {
    subtitle: string
    languageLegend: string
    difficultyLegend: string
    difficultyHint: string
    instructions: string[]
    startButton: string
  }
  language: Record<GameLanguage, string>
  difficulty: Record<DifficultyTier, string>
  hud: {
    score: string
    combo: string
    level: string
    max: string
    progressLabel: string
    livesRemaining: (lives: number) => string
  }
  input: {
    label: string
    placeholder: string
  }
  game: {
    targetPrompt: string
    target: (word: string) => string
    missed: (count: number, scorePenalty: number) => string
    points: (points: number) => string
  }
  results: {
    gameOver: string
    newPersonalBest: string
    finalScore: string
    best: string
    wordsTyped: string
    wordsMissed: string
    maxCombo: string
    accuracy: string
    typingSpeed: string
    timeSurvived: string
    playAgain: string
    changeSettings: string
  }
}

const copy: Record<GameLanguage, UiCopy> = {
  english: {
    start: {
      subtitle: 'Type the falling words before they reach the bottom',
      languageLegend: 'Game language',
      difficultyLegend: 'Starting difficulty',
      difficultyHint: 'The pace increases every 10 seconds, up to Level 13',
      instructions: [
        'Words fall from the top - type them to destroy',
        'The pace picks up every 10 seconds',
        'Build combos for bonus points',
        '3 lives - miss a word and lose one',
      ],
      startButton: 'PRESS ENTER TO START',
    },
    language: { english: 'English', romanian: 'Romanian' },
    difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' },
    hud: {
      score: 'SCORE',
      combo: 'COMBO',
      level: 'LEVEL',
      max: 'MAX',
      progressLabel: 'Progress to next level',
      livesRemaining: (lives) => `${lives} lives remaining`,
    },
    input: {
      label: 'Word input',
      placeholder: 'Type the falling words...',
    },
    game: {
      targetPrompt: 'TYPE TO TARGET THE LOWEST MATCHING WORD',
      target: (word) => `TARGET ${word}`,
      missed: (count, scorePenalty) => (
        `${count} MISSED / -${count} ${count === 1 ? 'LIFE' : 'LIVES'} / -${scorePenalty} PTS`
      ),
      points: (points) => `+${points} PTS`,
    },
    results: {
      gameOver: 'GAME OVER',
      newPersonalBest: 'NEW PERSONAL BEST',
      finalScore: 'FINAL SCORE',
      best: 'Best',
      wordsTyped: 'Words Typed',
      wordsMissed: 'Words Missed',
      maxCombo: 'Max Combo',
      accuracy: 'Accuracy',
      typingSpeed: 'Typing Speed',
      timeSurvived: 'Time Survived',
      playAgain: 'PLAY AGAIN',
      changeSettings: 'CHANGE SETTINGS',
    },
  },
  romanian: {
    start: {
      subtitle: 'Scrie cuvintele care cad înainte să ajungă jos',
      languageLegend: 'Limba jocului',
      difficultyLegend: 'Dificultatea de start',
      difficultyHint: 'Ritmul crește la fiecare 10 secunde, până la Nivelul 13',
      instructions: [
        'Cuvintele cad de sus - scrie-le pentru a le distruge',
        'Ritmul crește la fiecare 10 secunde',
        'Construiește combo-uri pentru puncte bonus',
        '3 vieți - ratezi un cuvânt și pierzi una',
      ],
      startButton: 'APASĂ ENTER PENTRU START',
    },
    language: { english: 'Engleză', romanian: 'Română' },
    difficulty: { easy: 'Ușor', medium: 'Mediu', hard: 'Greu', expert: 'Expert' },
    hud: {
      score: 'SCOR',
      combo: 'COMBO',
      level: 'NIVEL',
      max: 'MAXIM',
      progressLabel: 'Progres până la nivelul următor',
      livesRemaining: (lives) => `${lives} vieți rămase`,
    },
    input: {
      label: 'Cuvânt introdus',
      placeholder: 'Scrie cuvintele care cad...',
    },
    game: {
      targetPrompt: 'SCRIE PENTRU A ALEGE CUVÂNTUL CEL MAI DE JOS',
      target: (word) => `ȚINTĂ ${word}`,
      missed: (count, scorePenalty) => (
        `${count} RATATE / -${count} ${count === 1 ? 'VIAȚĂ' : 'VIEȚI'} / -${scorePenalty} PCT`
      ),
      points: (points) => `+${points} PCT`,
    },
    results: {
      gameOver: 'JOC ÎNCHEIAT',
      newPersonalBest: 'RECORD PERSONAL NOU',
      finalScore: 'SCOR FINAL',
      best: 'Record',
      wordsTyped: 'Cuvinte scrise',
      wordsMissed: 'Cuvinte ratate',
      maxCombo: 'Combo maxim',
      accuracy: 'Precizie',
      typingSpeed: 'Viteză de scriere',
      timeSurvived: 'Timp rezistat',
      playAgain: 'JOACĂ DIN NOU',
      changeSettings: 'SCHIMBĂ SETĂRILE',
    },
  },
}

export function getUiCopy(language: GameLanguage): UiCopy {
  return copy[language]
}