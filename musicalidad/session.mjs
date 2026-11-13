import {CHROMATIC,MINOR_NAMES,TYPES,LETTERS,pitch,mod,spell} from './theory.mjs?v=1.2.0';

import {INSTRUMENTS,PATTERNS} from './performance.mjs?v=1.2.0';

export function transposeChord(c,from,to) {
  const degree=(LETTERS.indexOf(c.root[0])-LETTERS.indexOf(from[0])+7)%7;
  return {root:spell(to,mod(pitch(c.root)-pitch(from)),degree),type:c.type};
}

// Validate the whole saved value before replacing the current practice session.
export function normalizeSession(value) {
  const validChord=c=>c&&typeof c.root==='string'&&/^[A-G](?:#{1,2}|b{1,2})?$/.test(c.root)&&Object.hasOwn(TYPES,c.type);
  if(!value||!['major','minor'].includes(value.mode)||![...CHROMATIC,...MINOR_NAMES].includes(value.root)||!Array.isArray(value.sequence)||value.sequence.length>16||!value.sequence.every(validChord)||!Number.isInteger(value.capo)||value.capo<0||value.capo>7)throw Error('Invalid session');
  const tempo=Number(value.bpm);
  return {
    root:(value.mode==='major'?CHROMATIC:MINOR_NAMES)[pitch(value.root)],mode:value.mode,
    capo:value.capo,sequence:value.sequence.map(c=>({root:c.root,type:c.type})),
    bpm:Number.isFinite(tempo)?Math.min(180,Math.max(40,tempo)):80,
    pattern:Object.hasOwn(PATTERNS,value.pattern)?value.pattern:'strum',
    instrument:Object.hasOwn(INSTRUMENTS,value.instrument)?value.instrument:'steel'
  };
}
