/**
 * Generates memorable, high-entropy slug phrases similar to Claude Code / Docker containers / GitHub
 * Format: [uuid]-[adjective]-[gerund-or-noun]-[entity]
 */

const ADJECTIVES = [
  'cosmic', 'quantum', 'velvet', 'luminous', 'silent', 'golden', 'stellar', 'mystic',
  'radiant', 'whispering', 'emerald', 'astral', 'serene', 'vibrant', 'crimson', 'sonic',
  'neural', 'harmonic', 'celestial', 'magnetic', 'prismatic', 'infinite', 'ember', 'fluent'
];

const VERBS_OR_MODS = [
  'pondering', 'synthesizing', 'resonating', 'whispering', 'transmitting', 'pulsing',
  'weaving', 'harmonizing', 'drifting', 'crafting', 'streaming', 'humming', 'echoing',
  'tuning', 'sparking', 'shimmering', 'vibrating', 'flowing', 'gliding', 'composing'
];

const NOUNS = [
  'phoenix', 'cascade', 'monolith', 'voyager', 'nebula', 'horizon', 'solstice', 'aurora',
  'beacon', 'echo', 'zenith', 'pulse', 'waveform', 'melody', 'strata', 'oracle',
  'cipher', 'vanguard', 'quarry', 'odyssey', 'matrix', 'crystal', 'tempo', 'symphony'
];

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function generateSessionName(): { uuid: string; slug: string; fullSessionId: string } {
  const uuid = generateUUID();
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const verb = VERBS_OR_MODS[Math.floor(Math.random() * VERBS_OR_MODS.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];

  const slug = `${adj}-${verb}-${noun}`;
  const fullSessionId = `${uuid}-${slug}`;

  return {
    uuid,
    slug,
    fullSessionId,
  };
}
