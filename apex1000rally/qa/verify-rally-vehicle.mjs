import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SOLUTION,SAVE_KEY,newTraining,startPreparation,advanceTraining,commitStage} from '../tutorial/engine.js';
import {TEAMS} from '../tutorial/viewer-model.js';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/Emanuel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const report={screens:[],colors:[],errors:[],apiRequests:[],offline:false};
fs.mkdirSync('qa/rally-vehicle',{recursive:true});
const s=newTraining();startPreparation(s,structuredClone(SOLUTION));advanceTraining(s,300);commitStage(s,{driver:0,pace:'steady',fuel:40,repairs:'all',rest:'full'});advanceTraining(s,150);s.paused=true;
const hash=b=>createHash('sha256').update(b).digest('hex');
try{
for(const width of process.env.NO_SW?[1440]:[1440,390,320]){
 const ctx=await browser.newContext({viewport:{width,height:width===1440?1050:900},hasTouch:width<650,serviceWorkers:process.env.NO_SW?'block':'allow'});
 await ctx.addInitScript(({key,state})=>{if(!localStorage.getItem('qa-seeded')){localStorage.setItem(key,JSON.stringify(state));localStorage.setItem('qa-seeded','1');}},{key:SAVE_KEY,state:s});
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 ctx.on('request',r=>{if(r.url().includes('/api/')||r.url().includes('workers.dev'))report.apiRequests.push(r.url());});
 page.on('console',m=>{if(['error','warning'].includes(m.type()))console.log(m.type(),m.text().slice(0,220));});
 await page.goto('http://127.0.0.1:4188/tutorial/');
 await page.locator('.terrain-host[data-ready=true]').waitFor();assert.equal(await page.locator('.terrain-host').getAttribute('data-vehicle-model'),'trail-r4');
 await page.locator('[data-viewer=vehicle]').click();await page.locator('.vehicle-stage[data-ready=true]').waitFor();await page.waitForTimeout(500);
 const canvas=page.locator('.vehicle-canvas');await page.locator('.vehicle-dialog').screenshot({path:`qa/rally-vehicle/model-${width}.png`});
 if(width===1440){
  const hashes=[];
  for(const team of TEAMS){await page.locator('.vehicle-color').selectOption(team.id);await page.waitForTimeout(80);hashes.push(hash(await canvas.screenshot()));await page.locator('.vehicle-dialog').screenshot({path:`qa/rally-vehicle/${team.id}.png`});report.colors.push({id:team.id,color:team.color});}
  assert.equal(new Set(hashes).size,TEAMS.length,'Los seis colores deben producir seis imágenes distintas');
 }
 const before=hash(await canvas.screenshot()),b=await canvas.boundingBox();
 await page.mouse.move(b.x+b.width*.5,b.y+b.height*.55);await page.mouse.down();await page.mouse.move(b.x+b.width*.5+90,b.y+b.height*.55+20,{steps:12});await page.mouse.up();await page.waitForTimeout(900);assert.notEqual(hash(await canvas.screenshot()),before);
 await page.locator('.vehicle-dialog').screenshot({path:`qa/rally-vehicle/rear-${width}.png`});
 await page.waitForTimeout(700);const frames=await page.locator('.vehicle-stage').getAttribute('data-frames');await page.waitForTimeout(600);assert.equal(await page.locator('.vehicle-stage').getAttribute('data-frames'),frames,'La vista cercana sigue dibujando en reposo');
 assert.ok(await page.locator('.vehicle-close').isVisible());assert.ok(await page.locator('.vehicle-color').isVisible());
 await page.keyboard.press('Escape');assert.equal(await page.locator('.vehicle-dialog').evaluate(el=>el.open),false);await canvas.waitFor({state:'detached'});assert.equal(await canvas.count(),0);
 assert.ok(await page.locator('[data-viewer=vehicle]').evaluate(el=>document.activeElement===el));
 for(let i=0;i<3;i++){await page.locator('[data-viewer=vehicle]').click();await page.locator('.vehicle-stage[data-ready=true]').waitFor();await page.locator('.vehicle-close').click();await canvas.waitFor({state:'detached'});assert.equal(await canvas.count(),0);}
 if(width===1440&&!process.env.NO_SW){await page.waitForFunction(()=>document.querySelector('#storage-note').textContent.includes('listo para reabrirse'));await ctx.setOffline(true);await page.reload();await page.locator('.terrain-host[data-ready=true]').waitFor();assert.equal(await page.locator('.terrain-host').getAttribute('data-vehicle-model'),'trail-r4');await page.locator('[data-viewer=vehicle]').click();await page.locator('.vehicle-stage[data-ready=true]').waitFor();report.offline=true;await page.locator('.vehicle-close').click();}
 const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);assert.equal(after.elapsed,s.elapsed);assert.equal(after.km,s.km);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const metrics=await page.locator('.terrain-host').evaluate(el=>({triangles:+el.dataset.triangles,drawCalls:+el.dataset.drawCalls}));
 report.screens.push({width,...metrics,idleFrames:0});console.log('OK',width);await ctx.close();
}
assert.deepEqual(report.errors,[]);assert.deepEqual(report.apiRequests,[]);fs.writeFileSync('qa/rally-vehicle-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){fs.writeFileSync('qa/rally-vehicle-failure.json',JSON.stringify(report,null,2));throw error;}
finally{await browser.close();}
