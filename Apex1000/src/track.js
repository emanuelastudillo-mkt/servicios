// Dibujo propio trazado a partir del mapa oficial F1 de Catalunya, variante de 14 curvas.
// Coordenadas esquemáticas. Longitud oficial; radios y elevación NO son un relevamiento topográfico.
export const TRACK = {id:'barcelona-14',name:'Barcelona-Catalunya',length:4657,corners:14,country:'España',layout:'GP · 14 curvas',sectorEnds:[.33,.68,1]};
// Cada curva cúbica parte del punto final anterior. Inicio en la línea de meta.
export const START=[935,397];
export const BEZIERS=[
  [760,465,475,574,321,635],
  [286,650,275,624,267,602],
  [252,561,231,570,177,570],
  [90,585,39,530,64,443],
  [73,409,109,371,147,351],
  [200,326,290,296,346,272],
  [393,250,433,296,405,348],
  [389,385,366,395,343,405],
  [300,422,251,443,219,456],
  [191,467,193,497,224,505],
  [291,522,369,544,421,527],
  [453,517,480,506,501,496],
  [537,479,511,454,507,428],
  [499,402,506,379,514,345],
  [525,302,530,264,545,232],
  [564,194,591,184,631,192],
  [742,210,934,237,1018,253],
  [1060,262,1074,237,1044,197],
  [1023,164,1004,151,970,151],
  [947,149,927,163,907,144],
  [875,124,883,72,925,62],
  [960,55,1018,54,1056,53],
  [1083,50,1113,72,1125,106],
  [1139,145,1151,182,1164,218],
  [1184,268,1164,296,1127,315],
  [1070,343,993,374,935,397],
];
export const CORNER_LABELS=[['1',294,659],['2',242,602],['3',45,528],['4',415,272],['5',169,477],['6',363,560],['7',550,468],['8',473,399],['9',560,166],['10',1080,260],['11',980,181],['12',861,121],['13',1084,29],['14',1197,281]];
export const PATH_D='M '+START.join(' ')+' '+BEZIERS.map(c=>'C '+c.join(' ')).join(' ')+' Z';
const raw=[{x:START[0],y:START[1]}];let prev=START;
for(const b of BEZIERS){for(let k=1;k<=16;k++){const t=k/16,u=1-t;raw.push({x:u**3*prev[0]+3*u*u*t*b[0]+3*u*t*t*b[2]+t**3*b[4],y:u**3*prev[1]+3*u*u*t*b[1]+3*u*t*t*b[3]+t**3*b[5]});}prev=b.slice(4);}
let length=0;raw[0].d=0;for(let i=1;i<raw.length;i++){length+=Math.hypot(raw[i].x-raw[i-1].x,raw[i].y-raw[i-1].y);raw[i].d=length;}
export function pointAt(f){const d=((f%1)+1)%1*length;let lo=0,hi=raw.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(raw[m].d<=d)lo=m;else hi=m;}const a=raw[lo],b=raw[hi],t=(d-a.d)/(b.d-a.d||1);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};}
const N=360;export const DS=TRACK.length/N;
export const NODES=Array.from({length:N},(_,i)=>{const p=pointAt(i/N),a=pointAt((i-2)/N),b=pointAt((i+2)/N);const ab=Math.hypot(p.x-a.x,p.y-a.y),bc=Math.hypot(b.x-p.x,b.y-p.y),ac=Math.hypot(b.x-a.x,b.y-a.y);const cross=Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x));const curv=2*cross/(ab*bc*ac||1)*length/TRACK.length;return {...p,distance:i*DS,fraction:i/N,curvature:curv,sector:i/N<.33?0:i/N<.68?1:2,overtake:i/N<.23||(i/N>.52&&i/N<.69)};});
