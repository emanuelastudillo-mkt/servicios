import {midiNotes} from './theory.mjs?v=1.1.1';
// FluidR3 acoustic steel samples. See credits in fuentes.html.
export class GuitarAudio {
 constructor(onStatus=()=>{}){this.onStatus=onStatus;this.buffers=new Map();this.sources=new Set();this.generation=0;this.volume=.65;}
 async ready(){
  if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.volume*.6;this.master.connect(this.ctx.destination);}
  if(this.ctx.state!=='running')await this.ctx.resume();
  if(!this.loading){this.onStatus('Cargando guitarra…');this.loading=fetch('./assets/guitar.json').then(r=>{if(!r.ok)throw Error('audio');return r.json();}).then(async data=>{
   await Promise.all(Object.entries(data).map(async([midi,b64])=>{const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));this.buffers.set(Number(midi),await this.ctx.decodeAudioData(bytes.buffer));}));this.onStatus('Guitarra lista');
  }).catch(e=>{this.loading=null;this.onStatus('No se cargó el sonido. Revisá la conexión y volvé a tocar.');throw e;});}
  await this.loading;
 }
 setVolume(v){this.volume=v;if(this.master)this.master.gain.setTargetAtTime(v*.6,this.ctx.currentTime,.02);}
 note(midi,when=this.ctx.currentTime,duration=2.2,velocity=.8){
  if(!this.buffers.size)return;
  const key=this.buffers.has(midi)?midi:[...this.buffers.keys()].reduce((a,b)=>Math.abs(b-midi)<Math.abs(a-midi)?b:a);
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=this.buffers.get(key);source.playbackRate.value=2**((midi-key)/12);
  gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(velocity,when+.006);gain.gain.setValueAtTime(velocity,when+Math.max(.02,duration-.12));gain.gain.linearRampToValueAtTime(0,when+duration);
  source.connect(gain);gain.connect(this.master);this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};source.start(when);source.stop(when+duration+.01);
 }
 chord(c,variant=0,capo=0,when=this.ctx.currentTime,style='strum',duration=2.5){
  const notes=midiNotes(c,variant,capo);notes.forEach((n,i)=>this.note(n,when+i*(style==='arpeggio'?.18:.024),duration,.58));
 }
 click(when,accent=false){const osc=this.ctx.createOscillator(),g=this.ctx.createGain();osc.frequency.value=accent?1200:850;g.gain.setValueAtTime(.12,when);g.gain.exponentialRampToValueAtTime(.0001,when+.045);osc.connect(g);g.connect(this.master);this.sources.add(osc);osc.onended=()=>{this.sources.delete(osc);osc.disconnect();g.disconnect();};osc.start(when);osc.stop(when+.05);}
 stop(){this.generation++;for(const s of this.sources){try{s.stop();}catch{}}this.sources.clear();}
}
