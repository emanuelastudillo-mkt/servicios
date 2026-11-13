export const INSTRUMENTS={
 steel:{name:'Acústica · acero',bank:'guitar',cutoff:11000,gain:1,hint:'Cuerdas de acero, con brillo y cuerpo. Probá pop, balada o arpegios.'},
 criolla:{name:'Criolla · nylon cálido',bank:'guitar-nylon',cutoff:2800,gain:1.3,hint:'Nylon suave y redondo. Ideal para acompañar con calma o arpegiar.'},
 spanish:{name:'Española · nylon brillante',bank:'guitar-nylon',cutoff:11000,gain:1.2,shelf:4,hint:'Un color más brillante de la misma base de nylon. Probá el rasgueo con golpe apagado.'},
 clean:{name:'Eléctrica · limpia',bank:'guitar-clean',cutoff:10000,gain:1,hint:'Sonido limpio. Se escuchan bien las notas de acordes, arpegios y contratiempos.'},
 crunch:{name:'Eléctrica · crunch',bank:'guitar-crunch',cutoff:6500,gain:.7,hint:'Saturación moderada. Probá quintas abiertas o un machaque suave.'},
 distortion:{name:'Eléctrica · distorsión',bank:'guitar-distortion',cutoff:5800,gain:.55,hint:'Más saturación y sostén. Empezá con quintas y bajá la velocidad para practicar.'}
};
// One cell per subdivision: D/U = strum, X = muted percussive stroke,
// M = palm-muted downstroke, N = arpeggio note, . = intentional rest.
export const PATTERNS={
 strum:{name:'Rasgueo simple · 4/4',subdivisions:1,beats:4,strokes:'DDDD',hint:'Un golpe hacia abajo en cada pulso.'},
 pop:{name:'Pop · abajo y arriba',subdivisions:2,beats:4,strokes:'D.DU.UDU',hint:'Abajo · abajo-arriba · arriba-abajo-arriba. La mano sigue moviéndose durante los silencios.'},
 ballad:{name:'Balada · suave',subdivisions:2,beats:4,strokes:'D..UD.DU',hint:'Dejá respirar los acordes. Los golpes hacia arriba son más livianos.',soft:true},
 muted:{name:'Rasgueo con golpe apagado',subdivisions:2,beats:4,strokes:'D.XU.UDU',hint:'La cruz es un golpe sobre cuerdas apagadas. Escuchá el contraste entre acorde y percusión.'},
 offbeat:{name:'Contratiempo · corto',subdivisions:2,beats:4,strokes:'.U.U.U.U',hint:'Los golpes entran entre los pulsos. Activá el metrónomo para ubicarte.',short:true},
 waltz:{name:'Valseado · 3/4',subdivisions:1,beats:3,strokes:'DDD',hint:'Contá uno-dos-tres. El primer golpe tiene más peso.'},
 arpeggio:{name:'Arpegio · 4/4',subdivisions:2,beats:4,strokes:'NNNNNNNN',hint:'Una cuerda por vez, subiendo y bajando por las cuerdas que suenan.'},
 six:{name:'Arpegio · 6/8',subdivisions:3,beats:2,strokes:'NNNNNN',hint:'Dos pulsos grandes, de tres notas cada uno. BPM cuenta esos dos pulsos.'},
 powerRock:{name:'Quintas · rock abierto',subdivisions:2,beats:4,strokes:'D.DUD.DU',power:true,hint:'Fundamental, quinta justa y octava: más abierto, sin tercera.'},
 powerMute:{name:'Quintas · machaque',subdivisions:2,beats:4,strokes:'MMMMMMMM',power:true,hint:'Ocho golpes cortos hacia abajo. Apoyá suavemente el canto de la mano cerca del puente.'},
 powerGallop:{name:'Quintas · galope',subdivisions:4,beats:4,strokes:'M.MMM.MMM.MMM.MM',power:true,hint:'Cada pulso: una corchea y dos semicorcheas. Empezá lento; no son tres golpes iguales.'}
};
export function grooveTiming(id,bpm){const p=PATTERNS[id]||PATTERNS.strum;return {steps:p.strokes.length,subdivisions:p.subdivisions,unit:60/bpm/p.subdivisions,beats:p.beats};}
export function performanceChord(c,id){return PATTERNS[id]?.power?{root:c.root,type:'5'}:{root:c.root,type:c.type};}
export function strokeLabel(code){return {D:'Abajo',U:'Arriba',X:'Golpe apagado',M:'Abajo con palm mute',N:'Una nota','.':'Silencio'}[code];}
