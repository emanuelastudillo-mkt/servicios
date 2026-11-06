import fs from 'node:fs/promises';

const expected=JSON.parse(await fs.readFile(new URL('../data.json',import.meta.url),'utf8'));
const domain=(await fs.readFile(new URL('../CNAME',import.meta.url),'utf8')).trim();
if(domain!=='emanuelmkt.com.ar')throw new Error('El dominio no coincide con la web configurada.');
let lastError;
for(let attempt=0;attempt<24;attempt++){
  try{
    const response=await fetch(`https://${domain}/data.json?sync=${encodeURIComponent(expected.checkedAt)}&attempt=${attempt}`,{signal:AbortSignal.timeout(15000),cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const actual=await response.json();
    if(actual.checkedAt===expected.checkedAt&&JSON.stringify(actual.services)===JSON.stringify(expected.services)&&JSON.stringify(actual.codes)===JSON.stringify(expected.codes)){
      console.log('Publicación verificada: '+expected.services.length+' servicios y '+expected.codes.length+' códigos en https://'+domain+'/');process.exit(0);
    }
    lastError=new Error('El hosting todavía muestra la versión anterior.');
  }catch(error){lastError=error;}
  if(attempt<23)await new Promise(resolve=>setTimeout(resolve,15000));
}
throw new Error('No se pudo confirmar la publicación: '+lastError.message);
