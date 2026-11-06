import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseCSV,parseAmount,createDataset,updateSitemap,sync} from './sync-google-sheets.mjs';

const headers=['Nombre','Acciones','Costo','Requisitos','Presupuesto minimo mensual','Presupuesto maximo mensual','Estado'];
const csv=rows=>rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
const services=csv([headers,['Campaña de Alcance','Contenido con "comillas", y una\nsegunda línea','$30.000','Tener campaña activa','$70.000','$300.000','Disponible'],['Auditoría','Revisar resultados','$40.000','-','-','-','Disponible'],['Web','Preparar catálogo','$120.000','Contenidos','-','-','No disponible']]);
const codes=csv([['Codigo','Descuento aplicado'],['PROMO','10%'],['FIJO','$5.000']]);
const previous={updatedAt:'2026-01-01T00:00:00Z',services:[{id:'identificador-existente',title:'Campaña de Alcance',category:'Meta Ads',kind:'normal'}],codes:[]};
const date=new Date('2026-09-06T10:17:00Z');

test('CSV preserves quoted commas, quotes, multiline values and trailing empty cells',()=>{
  const parsed=parseCSV(services);assert.equal(parsed.length,4);assert.equal(parsed[1][1],'Contenido con "comillas", y una\nsegunda línea');
  assert.deepEqual(parseCSV('\uFEFFa,b,c\r\n1,"two,three",\r\n'),[['a','b','c'],['1','two,three','']]);
  assert.throws(()=>parseCSV('a,b\n"unfinished'),/incompleto/);
  assert.throws(()=>parseCSV('<html>Login</html>'),/HTML/);
});
test('Argentine money and placeholders are interpreted without changing magnitude',()=>{
  for(const [input,expected] of [['$30.000',30000],['1.000.000',1000000],['ARS $1.234,50',1234.5],['30000.50',30000.5],['0',0]])assert.equal(parseAmount(input),expected);
  assert.equal(parseAmount('-',{optional:true}),0);
  for(const input of ['','-','-300','#REF!','12abc','1.2.3','1,2,3'])assert.throws(()=>parseAmount(input));
});
test('Available tasks retain IDs; unavailable tasks are kept outside the selectable list',()=>{
  const {dataset}=createDataset(services,codes,previous,date);
  assert.equal(dataset.services.length,2);assert.equal(dataset.inactiveServices.length,1);
  assert.equal(dataset.services[0].id,'identificador-existente');assert.equal(dataset.services[0].costo,30000);
  assert.equal(dataset.services[0].presupuestoMinimo,70000);assert.equal(dataset.services[1].kind,'auditoria');
  assert.equal(dataset.codes[0].value,10);assert.equal(dataset.codes[1].type,'fixed');assert.equal(dataset.codes[1].value,5000);
  assert.equal(dataset.checkedAt,date.toISOString());
});
test('Fractional percentages, empty coupon list and all unavailable services are explicit cases',()=>{
  const decimalCodes=csv([['Codigo','Descuento aplicado'],['DIEZ','0,1']]);
  assert.equal(createDataset(services,decimalCodes,previous,date).dataset.codes[0].value,10);
  assert.equal(createDataset(services,'Codigo,Descuento aplicado',previous,date).dataset.codes.length,0);
  const inactive=services.replaceAll('"Disponible"','"No disponible"');
  assert.equal(createDataset(inactive,codes,previous,date).dataset.services.length,0);
  assert.equal(createDataset(inactive,codes,previous,date).dataset.inactiveServices.length,3);
});
test('Malformed headers, states, amounts, duplicate rows and invalid budgets abort',()=>{
  assert.throws(()=>createDataset('Nombre,Costo',codes,previous,date),/columna/);
  assert.throws(()=>createDataset(csv([headers]),codes,previous,date),/No hay filas/);
  assert.throws(()=>createDataset(services.replace('"Disponible"','"Quizás"'),codes,previous,date),/Estado/);
  assert.throws(()=>createDataset(services.replace('$30.000','#REF!'),codes,previous,date),/inválido/);
  assert.throws(()=>createDataset(services.replace('$300.000','$50.000'),codes,previous,date),/menor/);
  assert.throws(()=>createDataset(services, codes+'\n"PROMO","20%"',previous,date),/duplicado/);
  assert.throws(()=>createDataset(services,codes.replace('10%','150%'),previous,date),/100%/);
});
test('Unchanged content keeps updatedAt while recording the successful daily check',()=>{
  const first=createDataset(services,codes,previous,date);
  const next=createDataset(services,codes,first.dataset,new Date('2026-09-07T10:17:00Z'));
  assert.equal(next.contentChanged,false);assert.equal(next.visibleChanged,false);
  assert.equal(next.dataset.updatedAt,first.dataset.updatedAt);assert.notEqual(next.dataset.checkedAt,first.dataset.checkedAt);
  const reactivated=createDataset(services.replace('"No disponible"','"Disponible"'),codes,first.dataset,date);
  assert.equal(reactivated.dataset.services[2].id,first.dataset.inactiveServices[0].id);
});
test('Sitemap updates only the public homepage entry',()=>{
  const xml='<urlset><url><loc>https://emanuelmkt.com.ar/</loc><lastmod>2026-01-01</lastmod></url></urlset>';
  assert.ok(updateSitemap(xml,'2026-09-06').includes('<lastmod>2026-09-06</lastmod>'));
  assert.throws(()=>updateSitemap('<urlset/>','2026-09-06'),/portada/);
});
test('A rejected sheet leaves both files intact; valid sync writes matching content',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'emanuel-sheets-test-'));
  const original=JSON.stringify(previous),xml='<urlset><url><loc>https://emanuelmkt.com.ar/</loc><lastmod>2026-01-01</lastmod></url></urlset>';
  await fs.writeFile(path.join(directory,'data.json'),original);await fs.writeFile(path.join(directory,'sitemap.xml'),xml);
  const mock=(bad=false)=>async url=>new Response(url.endsWith('gid=0')?services:bad?'Wrong,headers':codes,{status:200,headers:{'Content-Type':'text/csv'}});
  await assert.rejects(()=>sync({directory,now:date,fetchFn:mock(true)}));
  assert.equal(await fs.readFile(path.join(directory,'data.json'),'utf8'),original);assert.equal(await fs.readFile(path.join(directory,'sitemap.xml'),'utf8'),xml);
  await sync({directory,now:date,fetchFn:mock(),dryRun:true});assert.equal(await fs.readFile(path.join(directory,'data.json'),'utf8'),original);
  await sync({directory,now:date,fetchFn:mock()});
  const result=JSON.parse(await fs.readFile(path.join(directory,'data.json'),'utf8'));assert.equal(result.services.length,2);assert.equal(result.codes.length,2);
});
