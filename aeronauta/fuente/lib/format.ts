export const money=(n:number,compact=true)=>'US$ '+(compact&&Math.abs(n)>=1e6?(n/1e6).toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})+' M':Math.round(n).toLocaleString('es-AR'));
export const number=(n:number)=>Math.round(n).toLocaleString('es-AR');
export const percent=(n:number)=>Math.round(n*100)+'%';
