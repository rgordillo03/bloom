// ═══════════════════════════════════════════════════════════════
// PROMPTS — Different question banks per garden type
// ═══════════════════════════════════════════════════════════════

export const SOLO_QUESTIONS = [
  // Self-awareness
  { id: "s1", q: "How is your body feeling today, honestly?", cat: "awareness", icon: "🌿" },
  { id: "s2", q: "What's calling for your attention right now?", cat: "awareness", icon: "🌿" },
  { id: "s3", q: "What energy did you wake up with this morning?", cat: "awareness", icon: "🌿" },
  { id: "s4", q: "What's one boundary you want to honor more this week?", cat: "awareness", icon: "🌿" },
  { id: "s5", q: "What emotion has been visiting you most lately?", cat: "awareness", icon: "🌿" },
  // Gratitude
  { id: "sg1", q: "What's something you're proud of yourself for this week?", cat: "gratitude", icon: "🙏" },
  { id: "sg2", q: "What small thing brought you joy today?", cat: "gratitude", icon: "🙏" },
  { id: "sg3", q: "Who in your life are you grateful for right now?", cat: "gratitude", icon: "🙏" },
  { id: "sg4", q: "What did your past self do that today's you is thankful for?", cat: "gratitude", icon: "🙏" },
  { id: "sg5", q: "What about your life right now would your 10-year-old self find magical?", cat: "gratitude", icon: "🙏" },
  // Growth
  { id: "sgr1", q: "What's a lesson you're slowly learning?", cat: "growth", icon: "🌱" },
  { id: "sgr2", q: "What would you do today if you weren't afraid?", cat: "growth", icon: "🌱" },
  { id: "sgr3", q: "What pattern are you ready to release?", cat: "growth", icon: "🌱" },
  { id: "sgr4", q: "What does the most loving version of you do today?", cat: "growth", icon: "🌱" },
  { id: "sgr5", q: "Where are you growing right now, even if it hurts?", cat: "growth", icon: "🌱" },
  // Dreams
  { id: "sd1", q: "What's a dream you've been quietly nurturing?", cat: "dreams", icon: "✨" },
  { id: "sd2", q: "If today were perfect, what would the evening look like?", cat: "dreams", icon: "✨" },
  { id: "sd3", q: "What does your future self want you to know?", cat: "dreams", icon: "✨" },
  { id: "sd4", q: "What do you want more of in your life this season?", cat: "dreams", icon: "✨" },
  { id: "sd5", q: "What's something you'd love to learn just for joy?", cat: "dreams", icon: "✨" },
  // Reflection
  { id: "sr1", q: "What part of you needs more compassion today?", cat: "reflection", icon: "💫" },
  { id: "sr2", q: "What story have you been telling yourself lately — and is it true?", cat: "reflection", icon: "💫" },
  { id: "sr3", q: "What's something you've been avoiding feeling?", cat: "reflection", icon: "💫" },
  { id: "sr4", q: "When did you last feel truly at peace?", cat: "reflection", icon: "💫" },
  { id: "sr5", q: "What would 'rest' actually look like for you this week?", cat: "reflection", icon: "💫" },
];

export const COUPLE_QUESTIONS = [
  // Gratitude
  { id: "cg1", q: "What's one thing your partner did this week that made you smile?", cat: "gratitude", icon: "🙏" },
  { id: "cg2", q: "When did you last feel truly taken care of by your partner?", cat: "gratitude", icon: "🙏" },
  { id: "cg3", q: "What small daily thing does your partner do that makes life better?", cat: "gratitude", icon: "🙏" },
  { id: "cg4", q: "What quality in your partner are you most thankful for right now?", cat: "gratitude", icon: "🙏" },
  // Dreams
  { id: "cd1", q: "If you could travel anywhere together next month, where would it be?", cat: "dreams", icon: "✈️" },
  { id: "cd2", q: "Describe your perfect Sunday together, five years from now.", cat: "dreams", icon: "✈️" },
  { id: "cd3", q: "What's one adventure you want before the end of this year?", cat: "dreams", icon: "✈️" },
  { id: "cd4", q: "What's a skill you'd love to learn together?", cat: "dreams", icon: "✈️" },
  // Memories
  { id: "cm1", q: "What's a moment with your partner you replay in your mind often?", cat: "memories", icon: "📸" },
  { id: "cm2", q: "What was the first thing you noticed about your partner?", cat: "memories", icon: "📸" },
  { id: "cm3", q: "What's the hardest you've laughed together?", cat: "memories", icon: "📸" },
  { id: "cm4", q: "What trip or adventure brought you closest?", cat: "memories", icon: "📸" },
  // Playful
  { id: "cp1", q: "If your partner was a dessert, what would they be and why?", cat: "playful", icon: "🎲" },
  { id: "cp2", q: "What's your partner's most adorable habit?", cat: "playful", icon: "🎲" },
  { id: "cp3", q: "If your relationship was a movie genre, what would it be?", cat: "playful", icon: "🎲" },
  { id: "cp4", q: "What fictional couple reminds you most of you two?", cat: "playful", icon: "🎲" },
  // Deep
  { id: "cdp1", q: "What does feeling truly loved look like to you right now?", cat: "deep", icon: "💎" },
  { id: "cdp2", q: "How have you grown as a person since being in this relationship?", cat: "deep", icon: "💎" },
  { id: "cdp3", q: "What's one thing you wish you did more of as a couple?", cat: "deep", icon: "💎" },
  { id: "cdp4", q: "What does 'home' mean to you in the context of your relationship?", cat: "deep", icon: "💎" },
  // Needs
  { id: "cn1", q: "What's one way your partner could support you better this week?", cat: "needs", icon: "🤝" },
  { id: "cn2", q: "When do you feel most connected to your partner?", cat: "needs", icon: "🤝" },
  { id: "cn3", q: "What kind of date night would recharge you right now?", cat: "needs", icon: "🤝" },
  { id: "cn4", q: "How are you feeling about 'us' today, honestly?", cat: "needs", icon: "🤝" },
];

export const GROUP_QUESTIONS = [
  // Connection
  { id: "gc1", q: "Who in this group are you grateful for today and why?", cat: "connection", icon: "🤝" },
  { id: "gc2", q: "What's something you appreciate about each person here?", cat: "connection", icon: "🤝" },
  { id: "gc3", q: "What inside joke from this group still makes you laugh?", cat: "connection", icon: "🤝" },
  { id: "gc4", q: "When did this group last make you feel truly understood?", cat: "connection", icon: "🤝" },
  // Memories
  { id: "gm1", q: "What's a memory with this group you'll never forget?", cat: "memories", icon: "📸" },
  { id: "gm2", q: "What was the funniest moment we've shared together?", cat: "memories", icon: "📸" },
  { id: "gm3", q: "What's the most spontaneous thing we've done together?", cat: "memories", icon: "📸" },
  { id: "gm4", q: "What tradition have we started without realizing it?", cat: "memories", icon: "📸" },
  // Plans
  { id: "gp1", q: "What's something fun we should plan together soon?", cat: "plans", icon: "✨" },
  { id: "gp2", q: "If we could all go on a trip together, where would you choose?", cat: "plans", icon: "✨" },
  { id: "gp3", q: "What's one thing we should do more often?", cat: "plans", icon: "✨" },
  { id: "gp4", q: "What's a tradition you'd love us to start?", cat: "plans", icon: "✨" },
  // Light & Fun
  { id: "gl1", q: "If our group was a band, what would we be called?", cat: "playful", icon: "🎲" },
  { id: "gl2", q: "What movie genre best describes our group dynamic?", cat: "playful", icon: "🎲" },
  { id: "gl3", q: "If we were each a season, who'd be which?", cat: "playful", icon: "🎲" },
  { id: "gl4", q: "What's the most chaotic group chat moment we've had?", cat: "playful", icon: "🎲" },
  // Updates
  { id: "gu1", q: "What's a small win from your week worth celebrating?", cat: "updates", icon: "🌱" },
  { id: "gu2", q: "What's been on your mind lately you'd want this group to know?", cat: "updates", icon: "🌱" },
  { id: "gu3", q: "What's something exciting happening in your life right now?", cat: "updates", icon: "🌱" },
  { id: "gu4", q: "How can this group support you this week?", cat: "updates", icon: "🌱" },
];

// ═══════════════════════════════════════════════════════════════
// INSPIRATIONS — universal across all garden types
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export function questionsFor(gardenType) {
  if (gardenType === 'solo') return SOLO_QUESTIONS;
  if (gardenType === 'couple') return COUPLE_QUESTIONS;
  if (gardenType === 'group') return GROUP_QUESTIONS;
  return SOLO_QUESTIONS;
}

export function getTodayContent(gardenType) {
  const day = Math.floor(Date.now() / 86400000);
  const questions = questionsFor(gardenType);
  return {
    question: questions[day % questions.length],
    inspiration: INSPIRATIONS[day % INSPIRATIONS.length],
  };
}

export function todayDateStr() {
  return new Date().toISOString().split('T')[0];
}

export const GARDEN_TYPES = {
  solo: { icon: '🧘', label: 'Solo', color: '#8B9E7E', desc: 'Your private space for reflection' },
  couple: { icon: '💑', label: 'Couple', color: '#C17F59', desc: 'Deepen your bond with your partner' },
  group: { icon: '🤝', label: 'Group', color: '#C9A96E', desc: 'Family, friends, or chosen family' },
};
