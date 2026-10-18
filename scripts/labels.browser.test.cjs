'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.BASE_URL||'http://127.0.0.1:8775/';
const out=process.env.QA_DIR||'/private/tmp/lawyer-labels-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base);await p.locator('[data-action="new-game"]').click();
  await p.waitForFunction(()=>OfficeRoom.diagnostics().ready&&OfficeRoom.diagnostics().frames>0);
  await p.mouse.move(5,5);
  assert.equal(await p.locator('#room-object-labels [data-object="Desk"],#room-object-labels [data-object="BankersLamp"],#room-object-labels [data-object="Cactus"]').count(),0,'decorative props have no tooltip or keyboard stop');
  assert.equal(await p.locator('#room-object-labels .room-object-label').evaluateAll(es=>es.every(e=>e.matches('button[data-room-view]'))),true,'every tooltip leads to a game action');
  assert.equal(await p.locator('.room-object-label.is-visible').count(),0,'overview has no permanent object captions');
  await p.screenshot({path:out+'/overview.png',fullPage:true});
  await p.locator('#room-laptop-home .os-top').hover();
  await p.waitForFunction(()=>document.querySelector('[data-object="Laptop"]').classList.contains('is-visible'));
  assert.equal(await p.locator('.room-object-label.is-visible').count(),1,'only the hovered object has a caption');
  await p.screenshot({path:out+'/laptop-tooltip.png',fullPage:true});
  await p.mouse.move(5,5);
  await p.waitForFunction(()=>!document.querySelector('.room-object-label.is-visible'));
  // Raycast the visible props themselves; popup text does not intercept clicks.
  const viewport=await p.locator('#room-viewport').boundingBox();
  for(const [name,x,y] of [['lamp',.12,.48],['cactus',.83,.46],['desk',.15,.84]]){
   await p.mouse.move(viewport.x+viewport.width*x,viewport.y+viewport.height*y);
   assert.equal(await p.locator('.room-object-label.is-visible').count(),0,name+' hover has no tooltip');
   assert.equal(await p.locator('#room-hint').innerText(),'Выберите предмет, чтобы начать работу');
   await p.mouse.click(viewport.x+viewport.width*x,viewport.y+viewport.height*y);
   assert.equal(await p.evaluate(()=>OfficeRoom.diagnostics().focus),null,name+' click keeps the overview');
  }
  await p.mouse.move(viewport.x+viewport.width*.85,viewport.y+viewport.height*.21);
  await p.waitForFunction(()=>document.querySelector('[data-object="CityMap"]').classList.contains('is-visible'));
  await p.mouse.click(viewport.x+viewport.width*.85,viewport.y+viewport.height*.21);
  assert.match(await p.locator('#desktop-content').innerText(),/Новореченск/i);
  await p.keyboard.press('Escape');await p.locator('[data-object="FountainPen"]').waitFor({state:'visible'});
  await p.mouse.move(5,5);
  // Keyboard selection reveals the object caption and Enter keeps its original action.
  const pen=p.locator('[data-object="FountainPen"]');await pen.focus();
  assert.equal(await pen.evaluate(e=>e.classList.contains('is-visible')),true);
  await pen.press('Enter');assert.match(await p.locator('#desktop-content').innerText(),/Блокнот ждёт первое дело/);
  assert.equal(await p.locator('.room-object-label.is-visible').count(),0,'camera focus hides all object captions');
  await p.keyboard.press('Escape');await p.locator('[data-object="FountainPen"]').waitFor({state:'visible'});
  const archive=p.locator('[data-object="Bookshelf"]');await archive.focus();
  assert.equal(await archive.evaluate(e=>e.classList.contains('is-visible')),true);
  await archive.press('Enter');assert.match(await p.locator('#room-archive-shelves').innerText(),/История вашей практики/);
  await p.keyboard.press('Escape');await p.locator('[data-object="FountainPen"]').waitFor({state:'visible'});
  await p.locator('[data-object="CityMap"]').focus();await p.keyboard.press('Tab');
  assert.equal(await p.locator('.room-object-label.is-visible').count(),1,'focus moves the single caption');
  await p.locator('[data-action="menu"]').click();await p.locator('[data-action="continue"]').click();
  assert.equal(await p.locator('.room-object-label.is-visible').count(),0,'menu clears stale captions');
  for(const width of [320,390,700,1024]){
   await p.setViewportSize({width,height:844});await p.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1);
   await p.locator('[data-object="FountainPen"]').focus();
   const r=await p.locator('[data-object="FountainPen"]').boundingBox();
   assert.ok(r.x>=0&&r.x+r.width<=width+1,'popup stays within viewport '+width);
   await p.locator('[data-object="FountainPen"]').press('Enter');assert.match(await p.locator('#desktop-content').innerText(),/Блокнот ждёт первое дело/);
   await p.keyboard.press('Escape');await p.locator('[data-object="FountainPen"]').waitFor({state:'visible'});
  }
  const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  touch.on('pageerror',e=>errors.push(e.message));
  await touch.goto(base);await touch.locator('[data-action="new-game"]').tap();
  await touch.waitForFunction(()=>OfficeRoom.diagnostics().ready&&OfficeRoom.diagnostics().frames>0);
  // Tap the broad, exposed left drawer; the label anchor sits above the object.
  const deskPoint=await touch.locator('#room-viewport').evaluate(e=>{
   const r=e.getBoundingClientRect();return {x:r.x+r.width*.15,y:r.y+r.height*.8};
  });
  await touch.touchscreen.tap(deskPoint.x,deskPoint.y);
  assert.equal(await touch.locator('.room-object-label.is-visible').count(),0,'decorative touch does not show a tooltip');
  await touch.screenshot({path:out+'/touch-no-tooltip.png',fullPage:true});
  assert.equal(await touch.evaluate(()=>OfficeRoom.diagnostics().focus),null,'decorative touch does not change device or game state');
  await touch.close();assert.deepEqual(errors,[]);console.log('PASS: hidden overview labels, pointer and keyboard popups, original object actions, focus/menu cleanup, responsive bounds and no decorative captions or keyboard stops.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
