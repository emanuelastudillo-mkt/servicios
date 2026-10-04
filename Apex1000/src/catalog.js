export const VERSION = '0.1.0';
export const ENGINE_VERSION = 'apex-physics-1';
export const CARS = [
  {id:'atlas', name:'Atlas A01', tag:'Equilibrio', color:'#d7fb68', power:715000, mass:798, aero:1, drag:1, mechanical:1, tyreCare:1, description:'Una plataforma estable para aprender. Buen equilibrio entre recta, curva y desgaste.', ratings:[83,83,84,82]},
  {id:'veloce', name:'Veloce V12', tag:'Potencia', color:'#ff876a', power:757000, mass:803, aero:.96, drag:1.015, mechanical:.98, tyreCare:.91, description:'Motor de gran potencia. Gana en las rectas, pero exige más a los neumáticos.', ratings:[97,76,78,69]},
  {id:'aero', name:'Aero AR7', tag:'Aerodinámica', color:'#73caff', power:690000, mass:800, aero:1.105, drag:1.035, mechanical:.985, tyreCare:.97, description:'Fuerte en curvas rápidas. Su carga extra tiene un costo en velocidad punta.', ratings:[75,98,80,79]},
  {id:'enduro', name:'Enduro E4', tag:'Consistencia', color:'#ccadff', power:694000, mass:801, aero:.985, drag:.985, mechanical:1.035, tyreCare:1.2, description:'Agarre mecánico y degradación contenida. Pensado para construir una buena tanda.', ratings:[76,79,96,98]},
];
export const TYRES = {
  soft:{name:'Blando', short:'B',color:'#ff6575',grip:1.04,wear:1.32,optimum:96},
  medium:{name:'Medio',short:'M',color:'#f2d262',grip:1,wear:1,optimum:94},
  hard:{name:'Duro',short:'D',color:'#e1e6e9',grip:.975,wear:.77,optimum:92},
};
export const DEFAULT_SETUP = {frontWing:26,rearWing:29,frontSpring:9,rearSpring:8,rideHeight:34,brakeBias:56,differential:55,pressure:23.5,engineMode:'normal',pace:'balanced',compound:'medium',fuel:35};
export const CONTROLS = [
  {key:'frontWing',name:'Alerón delantero',min:8,max:40,step:1,unit:'°',group:'Aerodinámica',help:'Más ángulo agrega carga y resistencia. El equilibrio con el alerón trasero cambia la respuesta en curva.'},
  {key:'rearWing',name:'Alerón trasero',min:8,max:40,step:1,unit:'°',group:'Aerodinámica',help:'Más carga trasera estabiliza el auto y mejora el agarre rápido, a costa de velocidad en recta.'},
  {key:'rideHeight',name:'Altura del chasis',min:24,max:50,step:1,unit:'mm',group:'Aerodinámica',help:'Una altura baja mejora el piso hasta cierto punto. Demasiado baja y con suspensión blanda causa pérdidas por contacto con el suelo.'},
  {key:'frontSpring',name:'Rigidez delantera',min:3,max:15,step:1,unit:'',group:'Chasis',help:'Más rigidez sostiene la plataforma aerodinámica. En exceso reduce agarre mecánico y aumenta subviraje.'},
  {key:'rearSpring',name:'Rigidez trasera',min:3,max:15,step:1,unit:'',group:'Chasis',help:'Una trasera blanda ayuda a traccionar; demasiado blanda compromete el piso. Más rigidez favorece la rotación.'},
  {key:'differential',name:'Bloqueo del diferencial',min:30,max:85,step:5,unit:'%',group:'Chasis',help:'Más bloqueo ayuda a transmitir potencia hasta un límite. Un bloqueo excesivo perjudica la salida de curvas lentas y castiga las gomas.'},
  {key:'brakeBias',name:'Reparto de frenos delante',min:50,max:64,step:.5,unit:'%',group:'Frenos y neumáticos',help:'El reparto óptimo depende del balance aerodinámico. Los extremos reducen la frenada y aumentan bloqueos y desgaste.'},
  {key:'pressure',name:'Presión en frío',min:21,max:28,step:.5,unit:'psi',group:'Frenos y neumáticos',help:'La presión modifica el agarre, el calentamiento y la resistencia a la rodadura. La ventana ideal cambia con la temperatura.'},
];
export const ENGINE_MODES = {eco:{name:'Ahorro',power:.955,fuel:.89,heat:-3},normal:{name:'Normal',power:1,fuel:1,heat:0},attack:{name:'Ataque',power:1.025,fuel:1.08,heat:3}};
export const PACES = {save:{name:'Conservar',grip:.97,wear:.75,heat:-5,risk:.001},balanced:{name:'Equilibrado',grip:1,wear:1,heat:0,risk:.003},push:{name:'Exigir',grip:1.015,wear:1.25,heat:4,risk:.009}};
export const PRESETS = {
  balanced:{label:'Equilibrada',values:{...DEFAULT_SETUP}},
  speed:{label:'Baja carga',values:{...DEFAULT_SETUP,frontWing:15,rearWing:18}},
  grip:{label:'Alta carga',values:{...DEFAULT_SETUP,frontWing:35,rearWing:38}},
  endurance:{label:'Tanda larga',values:{...DEFAULT_SETUP,frontSpring:8,rearSpring:7,pace:'save',engineMode:'eco',compound:'hard'}},
};
export function normalizeSetup(raw={}) {
  const s={...DEFAULT_SETUP};
  for(const c of CONTROLS) {const n=Number(raw[c.key]);if(Number.isFinite(n))s[c.key]=Math.max(c.min,Math.min(c.max,Math.round(n/c.step)*c.step));}
  for(const [key,dict] of [['compound',TYRES],['engineMode',ENGINE_MODES],['pace',PACES]])if(Object.hasOwn(dict,raw[key]))s[key]=raw[key];
  const f=Number(raw.fuel);if(Number.isFinite(f))s.fuel=Math.max(3,Math.min(110,f));
  return s;
}
