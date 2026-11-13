import {midiNotes,arpeggioIndex} from './theory.mjs?v=1.2.0';
import {INSTRUMENTS,PATTERNS,grooveTiming,performanceChord} from './performance.mjs?v=1.2.0';

export class GuitarAudio {
 constructor(onStatus=()=>{}){this.onStatus=onStatus;this.buffers=new Map();this.banks=new Map();this.sources=new Set();this.voices=new Map();this.volume=.65;this.instrument='steel';}
 connect(ctx){
  this.ctx=ctx;this.master=ctx.createGain();this.master.gain.value=this.volume*.6;
  this.limiter=ctx.createDynamicsCompressor();this.limiter.threshold.value=-8;this.limiter.knee.value=4;this.limiter.ratio.value=12;this.limiter.attack.value=.003;this.limiter.release.value=.12;
  this.master.connect(this.limiter);this.limiter.connect(ctx.destination);
 }
 setInstrument(id){if(!Object.hasOwn(INSTRUMENTS,id))throw Error('Unknown guitar');this.stop();this.instrument=id;this.buffers=new Map();this.onStatus(INSTRUMENTS[id].name+' seleccionada');}
 async loadBank(bank){
  if(!this.banks.has(bank)){
   const pending=fetch('./assets/'+bank+'.json').then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.json();}).then(async data=>{
    const decoded=new Map();await Promise.all(Object.entries(data).map(async([midi,b64])=>{const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));decoded.set(+midi,await this.ctx.decodeAudioData(bytes.buffer));}));return decoded;
   }).catch(e=>{this.banks.delete(bank);throw e;});this.banks.set(bank,pending);
  }
  return this.banks.get(bank);
 }
 async ready(){
  if(!this.ctx)this.connect(new (window.AudioContext||window.webkitAudioContext)());
  if(this.ctx.state!=='running')await this.ctx.resume();
  while(true){const id=this.instrument,profile=INSTRUMENTS[id];
   this.onStatus('Cargando '+profile.name.toLowerCase()+'…');
   try{const bank=await this.loadBank(profile.bank);if(id!==this.instrument)continue;this.buffers=bank;this.onStatus(profile.name+' lista');return;}
   catch(e){if(id!==this.instrument)continue;this.onStatus('No se pudo cargar esta guitarra. Volvé a intentarlo.');throw e;}
  }
 }
 setVolume(v){this.volume=v;if(this.master)this.master.gain.setTargetAtTime(v*.6,this.ctx.currentTime,.02);}
 track(source,nodes,gain,start,end){this.sources.add(source);this.voices.set(source,{gain,start,end});source.onended=()=>{this.sources.delete(source);this.voices.delete(source);source.disconnect();nodes.forEach(n=>n.disconnect());};}
 note(midi,when=this.ctx.currentTime,duration=2.2,velocity=.8,muted=false){
  if(!this.buffers.size)return;
  const key=this.buffers.has(midi)?midi:[...this.buffers.keys()].reduce((a,b)=>Math.abs(b-midi)<Math.abs(a-midi)?b:a);
  const profile=INSTRUMENTS[this.instrument],source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),filter=this.ctx.createBiquadFilter(),shelf=this.ctx.createBiquadFilter();
  source.buffer=this.buffers.get(key);source.playbackRate.value=2**((midi-key)/12);filter.type='lowpass';filter.frequency.value=muted?Math.min(1000,profile.cutoff):profile.cutoff;filter.Q.value=.5;shelf.type='highshelf';shelf.frequency.value=2000;shelf.gain.value=profile.shelf||0;
  const level=velocity*profile.gain,release=muted?.025:.12;duration=Math.max(.04,duration);
  gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(level,when+.004);gain.gain.setValueAtTime(level,when+Math.max(.01,duration-release));gain.gain.linearRampToValueAtTime(0,when+duration);
  source.connect(filter);filter.connect(shelf);shelf.connect(gain);gain.connect(this.master);this.track(source,[gain,filter,shelf],gain,when,when+duration);source.start(when);source.stop(when+duration+.01);
 }
 chord(c,variant=0,capo=0,when=this.ctx.currentTime,style='strum',duration=2.5,options={}){
  let notes=midiNotes(c,variant,capo);const up=style==='up';if(up)notes=notes.slice(-4).reverse();const spread=options.muted?.006:style==='arpeggio'?.18:c.type==='5'?.012:.024;
  notes.forEach((n,i)=>this.note(n,when+i*spread,duration,options.velocity??(up?.43:.58),!!options.muted));
 }
 choke(when){for(const [source,v] of this.voices){if(v.start<when&&v.end>when){v.gain.gain.cancelScheduledValues(when);v.gain.gain.setTargetAtTime(0,when,.008);source.stop(when+.04);}}}
 percussion(when){
  this.choke(when);if(!this.noise){this.noise=this.ctx.createBuffer(1,Math.ceil(this.ctx.sampleRate*.09),this.ctx.sampleRate);const wave=this.noise.getChannelData(0);let seed=7451;for(let i=0;i<wave.length;i++){seed=(1664525*seed+1013904223)>>>0;wave[i]=(seed/4294967296*2-1)*Math.exp(-i/(this.ctx.sampleRate*.018));}}
  const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),gain=this.ctx.createGain();source.buffer=this.noise;filter.type='bandpass';filter.frequency.value=1600;filter.Q.value=.6;gain.gain.setValueAtTime(.2,when);gain.gain.exponentialRampToValueAtTime(.0001,when+.08);source.connect(filter);filter.connect(gain);gain.connect(this.master);this.track(source,[filter,gain],gain,when,when+.09);source.start(when);source.stop(when+.09);
 }
 playStep(c,id,step,bpm,capo,when){
  const p=PATTERNS[id],{unit}=grooveTiming(id,bpm),code=p.strokes[step],played=performanceChord(c,id),accent=step===0?1:step%p.subdivisions===0?.88:.7;
  if(code==='.')return;
  if(code==='X'){this.percussion(when);return;}
  if(code==='N'){const notes=midiNotes(played,0,capo);this.note(notes[arpeggioIndex(step,notes.length)],when,unit*1.8,.8*accent);return;}
  const muted=code==='M',duration=muted?Math.min(.14,unit*.66):p.short?unit*.5:Math.min(2,unit*1.65);
  this.chord(played,0,capo,when,code==='U'?'up':'strum',duration,{muted,velocity:(p.soft?.46:code==='U'?.45:.65)*accent});
 }
 click(when,accent=false){const osc=this.ctx.createOscillator(),g=this.ctx.createGain();osc.frequency.value=accent?1200:850;g.gain.setValueAtTime(.12,when);g.gain.exponentialRampToValueAtTime(.0001,when+.045);osc.connect(g);g.connect(this.master);this.track(osc,[g],g,when,when+.05);osc.start(when);osc.stop(when+.05);}
 stop(){for(const s of this.sources){try{s.stop();}catch{}}this.sources.clear();this.voices.clear();}
}
