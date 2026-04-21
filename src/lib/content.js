// Daily questions — deterministic by date so both partners get the same one
export const QUESTIONS = [
  { id: "g1", q: "What's one thing your partner did this week that made you smile?", cat: "gratitude", icon: "🙏" },
  { id: "g2", q: "What's something about your partner you're grateful for today?", cat: "gratitude", icon: "🙏" },
  { id: "g3", q: "When did you last feel truly taken care of by your partner?", cat: "gratitude", icon: "🙏" },
  { id: "g4", q: "What small daily thing does your partner do that makes life better?", cat: "gratitude", icon: "🙏" },
  { id: "g5", q: "What quality in your partner are you most thankful for right now?", cat: "gratitude", icon: "🙏" },
  { id: "d1", q: "If you could travel anywhere together next month, where would it be?", cat: "dreams", icon: "✈️" },
  { id: "d2", q: "What's a skill you'd love to learn together?", cat: "dreams", icon: "✈️" },
  { id: "d3", q: "Describe your perfect Sunday together, five years from now.", cat: "dreams", icon: "✈️" },
  { id: "d4", q: "What's one adventure you want before the end of this year?", cat: "dreams", icon: "✈️" },
  { id: "d5", q: "If money was no object, what would your dream home look like?", cat: "dreams", icon: "✈️" },
  { id: "m1", q: "What's a moment with your partner you replay in your mind often?", cat: "memories", icon: "📸" },
  { id: "m2", q: "What was the first thing you noticed about your partner?", cat: "memories", icon: "📸" },
  { id: "m3", q: "What's the hardest you've laughed together?", cat: "memories", icon: "📸" },
  { id: "m4", q: "What trip or adventure brought you closest?", cat: "memories", icon: "📸" },
  { id: "m5", q: "What's a song that reminds you of a special moment together?", cat: "memories", icon: "📸" },
  { id: "p1", q: "If your partner was a dessert, what would they be and why?", cat: "playful", icon: "🎲" },
  { id: "p2", q: "What's your partner's most adorable habit?", cat: "playful", icon: "🎲" },
  { id: "p3", q: "If your relationship was a movie genre, what would it be?", cat: "playful", icon: "🎲" },
  { id: "p4", q: "What's one thing your partner does that always makes you laugh?", cat: "playful", icon: "🎲" },
  { id: "p5", q: "What fictional couple reminds you most of you two?", cat: "playful", icon: "🎲" },
  { id: "dp1", q: "What does feeling truly loved look like to you right now?", cat: "deep", icon: "💎" },
  { id: "dp2", q: "What's something you've never told your partner but want to?", cat: "deep", icon: "💎" },
  { id: "dp3", q: "How have you grown as a person since being in this relationship?", cat: "deep", icon: "💎" },
  { id: "dp4", q: "What's one thing you wish you did more of as a couple?", cat: "deep", icon: "💎" },
  { id: "dp5", q: "What does 'home' mean to you in the context of your relationship?", cat: "deep", icon: "💎" },
  { id: "n1", q: "What's one way your partner could support you better this week?", cat: "needs", icon: "🤝" },
  { id: "n2", q: "When do you feel most connected to your partner?", cat: "needs", icon: "🤝" },
  { id: "n3", q: "What kind of date night would recharge you right now?", cat: "needs", icon: "🤝" },
  { id: "n4", q: "Is there something on your mind you'd like to talk about together?", cat: "needs", icon: "🤝" },
  { id: "n5", q: "How are you feeling about 'us' today, honestly?", cat: "needs", icon: "🤝" },
];

export const INSPIRATIONS = [
  { text: "The best thing to hold onto in life is each other.", author: "Audrey Hepburn" },
  { text: "A flower does not think of competing with the flower next to it. It just blooms.", author: "Zen Shin" },
  { text: "Being deeply loved gives you strength, while loving deeply gives you courage.", author: "Lao Tzu" },
  { text: "The present moment is filled with joy. If you are attentive, you will see it.", author: "Thich Nhat Hanh" },
  { text: "Between stimulus and response there is a space. In that space is our power.", author: "Viktor Frankl" },
  { text: "She remembered who she was and the game changed.", author: "Lalah Delia" },
  { text: "Not all storms come to disrupt your life — some come to clear your path.", author: "Paulo Coelho" },
  { text: "The wound is the place where the light enters you.", author: "Rumi" },
  { text: "Be patient with yourself. Nothing in nature blooms all year.", author: "Unknown" },
  { text: "Nature does not hurry, yet everything is accomplished.", author: "Lao Tzu" },
  { text: "The privilege of a lifetime is to become who you truly are.", author: "Carl Jung" },
  { text: "Inhale the future, exhale the past.", author: "Unknown" },
  { text: "What if I fall? Oh, but my darling — what if you fly?", author: "Erin Hanson" },
  { text: "The lotus flower blooms most beautifully from the deepest mud.", author: "Buddhist Proverb" },
  { text: "Yoga begins right where I am — not where I was yesterday.", author: "Unknown" },
];

// Deterministic daily content — both partners see the same thing
export function getTodayContent() {
  const day = Math.floor(Date.now() / 86400000);
  return {
    question: QUESTIONS[day % QUESTIONS.length],
    inspiration: INSPIRATIONS[day % INSPIRATIONS.length],
  };
}

export function todayDateStr() {
  return new Date().toISOString().split('T')[0];
}
