export const mod = n => ((n % 12) + 12) % 12;
export const TUNING = [40, 45, 50, 55, 59, 64];
export const LETTERS = ['C','D','E','F','G','A','B'];
const NATURAL = [0,2,4,5,7,9,11];
const SOLFEGE = {C:'Do',D:'Re',E:'Mi',F:'Fa',G:'Sol',A:'La',B:'Si'};
export const CHROMATIC = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
export const MINOR_NAMES = ['C','C#','D','Eb','E','F','F#','G','G#','A','Bb','B'];
export const SCALES = {
 major: {name:'Mayor', steps:[0,2,4,5,7,9,11], degrees:[0,1,2,3,4,5,6], hint:'El mapa de la familia mayor. Las notas del acorde que está sonando son buenos lugares para descansar.'},
 minor: {name:'Menor natural',steps:[0,2,3,5,7,8,10],degrees:[0,1,2,3,4,5,6],hint:'El mapa de la familia menor. Si usás el acorde de regreso V7, su tercera cambia una nota de este mapa.'},
 pentMajor: {name:'Pentatónica mayor · 5 notas',steps:[0,2,4,7,9],degrees:[0,1,2,4,5],hint:'Cinco notas para empezar a inventar melodías. Probá frases cortas y dejá silencios.'},
 pentMinor: {name:'Pentatónica menor · 5 notas',steps:[0,3,5,7,10],degrees:[0,2,3,4,6],hint:'Un punto de partida para melodías en menor. En blues también se usa sobre acordes mayores: ese roce es parte del estilo.'},
 blues: {name:'Blues · 6 notas',steps:[0,3,5,6,7,10],degrees:[0,2,3,4,4,6],hint:'La nota extra, la quinta rebajada, suele funcionar como paso. Probá atravesarla y descansar en una nota del acorde.'},
 harmonic: {name:'Menor armónica',steps:[0,2,3,5,7,8,11],degrees:[0,1,2,3,4,5,6],hint:'Eleva una nota de la menor natural. En La menor aparece Sol♯: es la nota que hace que Mi7 empuje hacia La menor.'},
 dorian:{name:'Dórico',steps:[0,2,3,5,7,9,10],degrees:[0,1,2,3,4,5,6],hint:'Comparalo con menor natural: la sexta sube. Probá La menor → Re mayor con La como centro.'},
 phrygian:{name:'Frigio',steps:[0,1,3,5,7,8,10],degrees:[0,1,2,3,4,5,6],hint:'Comparalo con menor natural: la segunda baja. No todo el flamenco usa una única escala frigia.'},
 lydian:{name:'Lidio',steps:[0,2,4,6,7,9,11],degrees:[0,1,2,3,4,5,6],hint:'Comparalo con mayor: la cuarta sube. Sostené la nota de casa para escuchar ese color.'},
 mixolydian:{name:'Mixolidio',steps:[0,2,4,5,7,9,10],degrees:[0,1,2,3,4,5,6],hint:'Comparalo con mayor: la séptima baja. Puede acompañar un acorde 7, según el contexto.'},
 locrian:{name:'Locrio',steps:[0,1,3,5,6,8,10],degrees:[0,1,2,3,4,5,6],hint:'Tiene quinta rebajada y un centro menos estable. Es una exploración avanzada; empezá por mayor o pentatónica.'}
};
export const TYPES = {
 '':{name:'Mayor',steps:[0,4,7],degrees:[0,2,4],formula:'1 · 3 · 5'},
 m:{name:'Menor',steps:[0,3,7],degrees:[0,2,4],formula:'1 · ♭3 · 5'},
 '7':{name:'Séptima',steps:[0,4,7,10],degrees:[0,2,4,6],formula:'1 · 3 · 5 · ♭7'},
 maj7:{name:'Séptima mayor',steps:[0,4,7,11],degrees:[0,2,4,6],formula:'1 · 3 · 5 · 7'},
 m7:{name:'Menor séptima',steps:[0,3,7,10],degrees:[0,2,4,6],formula:'1 · ♭3 · 5 · ♭7'},
 sus2:{name:'Suspendido 2',steps:[0,2,7],degrees:[0,1,4],formula:'1 · 2 · 5'},
 sus4:{name:'Suspendido 4',steps:[0,5,7],degrees:[0,3,4],formula:'1 · 4 · 5'},
 dim:{name:'Disminuido',steps:[0,3,6],degrees:[0,2,4],formula:'1 · ♭3 · ♭5'},
 dim7:{name:'Disminuido séptima',steps:[0,3,6,9],degrees:[0,2,4,6],formula:'1 · ♭3 · ♭5 · 𝄫7'},
 m7b5:{name:'Semidisminuido',steps:[0,3,6,10],degrees:[0,2,4,6],formula:'1 · ♭3 · ♭5 · ♭7'},
 add9:{name:'Mayor con novena',steps:[0,4,7,2],degrees:[0,2,4,1],formula:'1 · 3 · 5 · 9'}
};
export function pitch(name) {return mod(NATURAL[LETTERS.indexOf(name[0])] + [...name.slice(1)].reduce((n,c)=>n+(c==='#'?1:c==='b'?-1:0),0));}
export const pretty = n => n.replaceAll('b','♭').replaceAll('#','♯');
export const spanish = n => SOLFEGE[n[0]] + pretty(n.slice(1));
export function spell(root, offset, degree) {
 const li=(LETTERS.indexOf(root[0])+degree)%7;
 let diff=mod(pitch(root)+offset-NATURAL[li]); if(diff>6) diff-=12;
 return LETTERS[li]+(diff>=0?'#'.repeat(diff):'b'.repeat(-diff));
}
export function scaleNotes(root,kind) {const s=SCALES[kind];return s.steps.map((v,i)=>spell(root,v,s.degrees[i]));}
export function chord(root,type='') {return {root,type};}
export const chordId=c=>c.root+c.type;
export const chordLabel=c=>pretty(c.root)+c.type.replace('dim','°').replace('b','♭');
export const chordSpanish=c=>spanish(c.root)+(c.type==='m'?' menor':c.type===''?' mayor':' '+TYPES[c.type].name.toLowerCase());
export function chordNotes(c) {const t=TYPES[c.type];return t.steps.map((v,i)=>spell(c.root,v,t.degrees[i]));}
export function family(root,mode) {
 const types=mode==='major'?['','m','m','','','m','dim']:['m','dim','','m','m','',''];
 return scaleNotes(root,mode).map((r,i)=>({...chord(r,types[i]),degree:i}));
}
export function dominant(root,mode) {return chord(scaleNotes(root,mode)[4],'7');}
export function suggestions(root,mode,current) {
 const fam=family(root,mode),id=chordId(current),same=c=>chordId(c)===id;
 const d=fam.findIndex(same);const dom=dominant(root,mode);
 let result;
 if(same(dom)||d===4||d===6&&mode==='major') result=[[fam[0],'Volvé a casa','Un cierre claro para la frase.'],[fam[mode==='major'?5:5],'Seguí la historia','Una llegada menos esperada.'],[fam[3],'Abrí otra vuelta','Mantené el movimiento.']];
 else if(d===1||d===3) result=[[dom,'Prepará el regreso','La séptima agrega tensión antes de volver.'],[fam[0],'Volvé con suavidad','Probá cómo descansa la frase.'],[fam[mode==='major'?5:6],'Cambiá el color','Otra salida dentro de la familia.']];
 else result=[[fam[3],'Abrí el sonido','Alejate un poco del punto de partida.'],[dom,'Buscá movimiento','Dejá el regreso a casa preparado.'],[fam[mode==='major'?5:5],'Cambiá el color','Escuchá un contraste dentro de la familia.']];
 return result.filter(([c])=>!same(c)).map(([c,title,why])=>({c,title,why}));
}
// Frets run from the sixth (low E) string to the first. -1 means muted.
const OPEN={
 C:[-1,3,2,0,1,0],D:[-1,-1,0,2,3,2],E:[0,2,2,1,0,0],G:[3,2,0,0,0,3],A:[-1,0,2,2,2,0],
 Am:[-1,0,2,2,1,0],Dm:[-1,-1,0,2,3,1],Em:[0,2,2,0,0,0],
 C7:[-1,3,2,3,1,0],D7:[-1,-1,0,2,1,2],E7:[0,2,0,1,0,0],G7:[3,2,0,0,0,1],A7:[-1,0,2,0,2,0],B7:[-1,2,1,2,0,2],
 Cmaj7:[-1,3,2,0,0,0],Dmaj7:[-1,-1,0,2,2,2],Emaj7:[0,2,1,1,0,0],Gmaj7:[3,2,0,0,0,2],Amaj7:[-1,0,2,1,2,0],
 Am7:[-1,0,2,0,1,0],Dm7:[-1,-1,0,2,1,1],Em7:[0,2,0,0,0,0],
 Asus2:[-1,0,2,2,0,0],Dsus2:[-1,-1,0,2,3,0],Asus4:[-1,0,2,2,3,0],Dsus4:[-1,-1,0,2,3,3],Esus4:[0,2,2,2,0,0],
 Cadd9:[-1,3,2,0,3,0],Gadd9:[3,0,0,2,0,3]
};
const A_SHAPES={ '':[-1,0,2,2,2,0],m:[-1,0,2,2,1,0],'7':[-1,0,2,0,2,0],maj7:[-1,0,2,1,2,0],m7:[-1,0,2,0,1,0],sus2:[-1,0,2,2,0,0],sus4:[-1,0,2,2,3,0],dim:[-1,0,1,2,1,-1],dim7:[-1,0,1,2,1,2],m7b5:[-1,0,1,0,1,-1],add9:[-1,0,2,4,2,0]};
const E_SHAPES={ '':[0,2,2,1,0,0],m:[0,2,2,0,0,0],'7':[0,2,0,1,0,0],m7:[0,2,0,0,0,0],sus4:[0,2,2,2,0,0]};
export function voicings(c) {
 const list=[];const openKey=Object.keys(OPEN).find(k=>{const m=k.match(/^([A-G][b#]?)(.*)$/);return pitch(m[1])===pitch(c.root)&&m[2]===c.type;});
 if(openKey) list.push({frets:OPEN[openKey],label:openKey==='C7'?'Abierta · sin quinta':'Posición abierta',barre:null});
 for(const [base,shapes] of [[9,A_SHAPES],[4,E_SHAPES]]){
  if(!shapes[c.type])continue;const shift=mod(pitch(c.root)-base);const frets=shapes[c.type].map(f=>f<0?-1:f+shift);
  if(!list.some(v=>v.frets.join()===frets.join()))list.push({frets,label:shift?'Posición móvil · traste '+shift:'Posición abierta',barre:shift?{fret:shift,from:base===9?1:0,to:5}:null});
 }
 return list.sort((a,b)=>Number(!!a.barre)-Number(!!b.barre)||Math.max(...a.frets)-Math.max(...b.frets));
}
export function midiNotes(c,variant=0,capo=0) {return voicings(c)[variant%voicings(c).length].frets.flatMap((f,i)=>f<0?[]:[TUNING[i]+f+capo]);}
export function rhythm(pattern,bpm){const subdivisions=pattern==='six'?3:pattern==='arpeggio'?2:1;return {steps:pattern==='six'?6:pattern==='arpeggio'?8:4,subdivisions,unit:60/bpm/subdivisions};}
export function arpeggioIndex(step,noteCount){const cycle=2*(noteCount-1),p=step%cycle;return p<noteCount?p:cycle-p;}
export function presets(root,mode) {
 const f=family(root,mode),v=dominant(root,mode);
 return mode==='major'?[{name:'Pop acústico',chords:[f[0],f[4],f[5],f[3]]},{name:'Una vuelta clásica',chords:[f[0],f[5],f[3],v]},{name:'Camino a casa',chords:[f[1],v,f[0],f[0]]},{name:'Blues · 12 compases',chords:[chord(f[0].root,'7'),chord(f[0].root,'7'),chord(f[0].root,'7'),chord(f[0].root,'7'),chord(f[3].root,'7'),chord(f[3].root,'7'),chord(f[0].root,'7'),chord(f[0].root,'7'),v,chord(f[3].root,'7'),chord(f[0].root,'7'),v]}]:[{name:'Menor con regreso',chords:[f[0],f[3],v,f[0]]},{name:'Vuelta acústica',chords:[f[0],f[5],f[2],f[6]]},{name:'Descenso andaluz',chords:[f[0],f[6],f[5],v]}];
}
