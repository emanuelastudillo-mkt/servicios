import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SOLUTION,SAVE_KEY,newTraining,startPreparation,advanceTraining,commitStage} from '../tutorial/engine.js';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/Emanuel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const url='http://127.0.0.1:4188/tutorial/';
const report={screens:[],offline:false,fallback:false,errors:[],apiRequests:[]};
fs.mkdirSync('qa/tutorial-terrain',{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const s=newTraining();startPreparation(s,structuredClone(SOLUTION));advanceTraining(s,300);commitStage(s,{driver:0,pace:'steady',fuel:40,repairs:'all',rest:'full'});advanceTraining(s,150);s.paused=true;
const ready=async page=>{try{await page.locator('.terrain-host[data-ready=true]').waitFor();await page.waitForFunction(()=>Number(document.querySelector('.terrain-host')?.dataset.frames)>0);}catch(error){console.log(await page.locator('#race-viewer').evaluate(el=>({hidden:el.hidden,html:el.innerHTML.slice(-900),map:el.querySelector('.viewer-map-box')?.dataset,loading:el.querySelector('.terrain-host')?.innerHTML.slice(0,200)})));throw error;}};
try{
 for(const width of [1440,390,320]){
  const ctx=await browser.newContext({viewport:{width,height:width===1440?1100:900},hasTouch:width<650});
  await ctx.addInitScript(({key,state})=>{if(!localStorage.getItem('qa-seeded')){localStorage.setItem(key,JSON.stringify(state));localStorage.setItem('qa-seeded','1');}},{key:SAVE_KEY,state:s});
  ctx.on('request',r=>{if(r.url().includes('/api/')||r.url().includes('workers.dev'))report.apiRequests.push(r.url());});
  const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(['warning','error'].includes(m.type()))console.log(m.type(),m.text().slice(0,300));});
  await page.goto(url);await ready(page);await page.locator('.viewer-map-box').scrollIntoViewIfNeeded();
  const initial=await page.locator('.terrain-host').evaluate(el=>({triangles:+el.dataset.triangles,drawCalls:+el.dataset.drawCalls}));
  await page.locator('#race-viewer').screenshot({path:`qa/tutorial-terrain/follow-${width}.png`});
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);
  await page.locator('[data-viewer=fit]').click();await page.waitForTimeout(700);
  assert.equal(await page.locator('[data-viewer=follow]').getAttribute('aria-pressed'),'false');
  const canvas=page.locator('.terrain-canvas'),box=await canvas.boundingBox();
  const old=hash(await canvas.screenshot());
  await page.mouse.move(box.x+box.width*.6,box.y+box.height*.2);await page.mouse.down();await page.mouse.move(box.x+box.width*.6+50,box.y+box.height*.2+30,{steps:10});await page.mouse.up();await page.waitForTimeout(600);
  assert.notEqual(hash(await canvas.screenshot()),old);
  const zoom=await page.locator('#viewer-zoom').innerText();await page.locator('[data-viewer=in]').click();await page.waitForTimeout(400);assert.notEqual(await page.locator('#viewer-zoom').innerText(),zoom);
  await page.locator('#viewer-team').selectOption('faro');await page.waitForTimeout(300);
  assert.match(await page.locator('.terrain-view-label').innerText(),/Faro/);assert.match(await page.locator('#viewer-team-name').innerText(),/Faro/);
  await page.locator('[data-viewer=follow]').click();assert.equal(await page.locator('[data-viewer=follow]').getAttribute('aria-pressed'),'false');
  await page.locator('[data-viewer=fit]').click();await page.waitForTimeout(450);
  await page.locator('.terrain-city:visible').first().click();assert.match(await page.locator('.terrain-view-label').innerText(),/Sector/);
  await page.locator('.terrain-quality').selectOption('low');await page.waitForTimeout(200);
  assert.ok(await page.locator('.terrain-host').evaluate((el,n)=>+el.dataset.triangles<n,initial.triangles));
  await page.locator('.terrain-quality').selectOption('auto');
  await page.locator('.terrain-relief').fill('1.4');await page.locator('.terrain-relief').dispatchEvent('change');
  await page.locator('[data-viewer=fit]').click();await page.waitForTimeout(900);
  await page.locator('#race-viewer').screenshot({path:`qa/tutorial-terrain/overview-${width}.png`});
  const frames=await page.locator('.terrain-host').getAttribute('data-frames');await page.waitForTimeout(650);
  assert.equal(await page.locator('.terrain-host').getAttribute('data-frames'),frames,'El tutorial pausado sigue dibujando');
  if(width<650){
   await canvas.scrollIntoViewIfNeeded();
   const p=await canvas.evaluate(el=>{const b=el.getBoundingClientRect();for(const ry of [.16,.28,.4,.5]){const x=b.x+b.width*.25,y=b.y+b.height*ry,x2=b.x+b.width*.65;if([x-20,x,x2,x2+20].every(xx=>document.elementFromPoint(xx,y)===el))return{x,y,x2};}throw Error('Sin zona de pinza');});
   const cdp=await ctx.newCDPSession(page),z=await page.locator('#viewer-zoom').innerText();
   const points=d=>[{x:p.x-d,y:p.y,id:1},{x:p.x2+d,y:p.y,id:2}];
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(0)});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(20)});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(500);
   assert.notEqual(await page.locator('#viewer-zoom').innerText(),z);
  }
  await page.locator('[data-viewer=fullscreen]').click();await page.waitForTimeout(500);assert.ok(await canvas.isVisible());
  await page.screenshot({path:`qa/tutorial-terrain/fullscreen-${width}.png`});
  await page.locator('[data-viewer=fullscreen]').click();
  const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);assert.equal(after.km,saved.km);assert.equal(after.elapsed,saved.elapsed);
  await page.locator('[data-viewer=depth]').click();assert.equal(await canvas.count(),0);assert.ok(await page.locator('#training-map').isVisible());
  await page.reload();assert.equal(await page.locator('.terrain-host').count(),0);await page.locator('[data-viewer=depth]').click();await ready(page);
  if(width===1440){
   await page.waitForFunction(()=>document.querySelector('#storage-note').textContent.includes('listo para reabrirse'));
   await ctx.setOffline(true);await page.reload();await ready(page);await page.locator('[data-viewer=fit]').click();
   await page.locator('#race-viewer').screenshot({path:'qa/tutorial-terrain/offline.png'});report.offline=true;
   await ctx.setOffline(false);
   const elapsed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).elapsed,SAVE_KEY);
   await page.locator('[data-viewer=pause]').click();await page.locator('#viewer-speed-control').selectOption('10');await page.waitForTimeout(1300);await page.locator('[data-viewer=pause]').click();
   const current=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).elapsed,SAVE_KEY);assert.ok(current>elapsed,'La simulación no avanzó');
   report.liveProgress=true;
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  report.screens.push({width,...initial,idleFrames:0});console.log('OK',width);await ctx.close();
 }
 const ctx=await browser.newContext({serviceWorkers:'block'}),page=await ctx.newPage();
 await page.addInitScript(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:SAVE_KEY,state:s});
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return /webgl/.test(type)?null:get.call(this,type,...rest);};});
 await page.goto(url);
 await page.waitForFunction(()=>document.querySelector('.viewer-map-box')?.dataset.terrain3d==='false');assert.ok(await page.locator('#training-map').isVisible());report.fallback=true;await ctx.close();
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.apiRequests,[]);
 fs.writeFileSync('qa/tutorial-terrain-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){fs.writeFileSync('qa/tutorial-terrain-failure.json',JSON.stringify(report,null,2));throw error;}
finally{await browser.close();}
