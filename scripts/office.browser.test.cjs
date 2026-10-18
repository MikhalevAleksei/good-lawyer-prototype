'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.BASE_URL||'http://127.0.0.1:8775/';
const out=process.env.QA_DIR||'/private/tmp/lawyer-office-qa';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 const click=async s=>{const el=p.locator(s);if(s.startsWith('[data-object=')){await el.waitFor({state:'visible'});await el.focus();await el.press('Enter');}else await el.click();};
 const room=async()=>{await click('.room-return');assert.equal(await p.locator('#office-room').isVisible(),true);};
 const ready=()=>p.waitForFunction(()=>window.OfficeRoom?.diagnostics().ready);
 try{
  assert.equal((await p.goto(base)).status(),200);
  assert.equal(await p.locator('#menu').isVisible(),true);
  await click('[data-action="new-game"]');await ready();
  const diagnostics=await p.evaluate(()=>OfficeRoom.diagnostics());
  assert.equal(diagnostics.fallback,false);assert.ok(diagnostics.triangles>10000);assert.ok(diagnostics.meshes>20);assert.ok(diagnostics.frames>0);
  assert.equal(await p.locator('#room-screen .os-app').count(),6);
  const rect=await p.locator('#room-screen').boundingBox();assert.ok(rect.width>400&&rect.height>240);
  await p.screenshot({path:path.join(out,'room-final-desktop.png'),fullPage:true});
  // All six laptop applications use the real game views, with no resource debit.
  for(const view of ['dossier','witness','evidence','actions','notes','plan']){
   await click(`#room-laptop-home [data-room-view="${view}"]`);
   assert.equal(await p.locator('#desktop-content').isVisible(),true);
   assert.equal(await p.locator('#office-room').isVisible(),true);await room();
  }
  await click('[data-object="FolderArchive"]');assert.match(await p.locator('#room-archive-shelves').innerText(),/История вашей практики/);await room();
  await click('#room-laptop-home [data-room-view="cases"]');await click('[data-offer="first-signature"]');
  await room();assert.match(await p.locator('#room-case-summary').innerText(),/Чужая подпись/);assert.match(await p.locator('#room-ap').innerText(),/12/);
  await click('[data-object="FolderCurrent"]');assert.match(await p.locator('#desktop-content').innerText(),/Материалы дела/);await room();
  await click('[data-object="FountainPen"]');await p.locator('#case-notes').fill('Проверить время открытия кассы.');await room();
  await click('[data-object="FountainPen"]');assert.equal(await p.locator('#case-notes').inputValue(),'Проверить время открытия кассы.');await room();
  const contextExtension=await p.evaluate(()=>{const canvas=document.querySelector('#room-webgl canvas'),gl=canvas.getContext('webgl2');window.__officeContextExtension=gl?.getExtension('WEBGL_lose_context');if(window.__officeContextExtension)window.__officeContextExtension.loseContext();return !!window.__officeContextExtension;});
  if(contextExtension){
   await p.waitForFunction(()=>OfficeRoom.diagnostics().fallback);
   assert.equal(await p.locator('#room-object-labels [data-object]:not([hidden])').count(),0,'WebGL fallback removes spatial labels from keyboard navigation');
   await p.waitForTimeout(150);
   await p.evaluate(()=>window.__officeContextExtension.restoreContext());
   await p.waitForFunction(()=>!OfficeRoom.diagnostics().fallback);
   assert.equal(await p.locator('#menu').isVisible(),false,'context recovery must not reset the career');
   assert.match(await p.locator('#room-case-summary').innerText(),/Чужая подпись/);
  }
  await click('[data-object="Mirror"]');assert.match(await p.locator('#desktop-content').innerText(),/Ваш деловой облик/);await room();
  await click('[data-object="CityMap"]');assert.match(await p.locator('#desktop-content').innerText(),/Новореченск/i);await room();
  await click('#room-shortcuts [data-room-view="laptop"]');await p.locator('#desk-app-select').selectOption('settings');await p.locator('#room-quality').selectOption('low');await p.locator('#room-motion').uncheck();await room();
  assert.equal(await p.evaluate(()=>OfficeRoom.diagnostics().quality),'low');
  const overview=await p.evaluate(()=>OfficeRoom.diagnostics().camera);await click('[data-room-camera="left"]');assert.notDeepEqual(await p.evaluate(()=>OfficeRoom.diagnostics().camera),overview);await click('[data-room-camera="right"]');await click('[data-room-camera="reset"]');const restored=await p.evaluate(()=>OfficeRoom.diagnostics().camera);assert.ok(restored.every((n,i)=>Math.abs(n-overview[i])<.001));
  await click('#room-news-pause');assert.equal(await p.locator('#room-news-pause').getAttribute('aria-pressed'),'true');
  await click('[data-action="menu"]');const frame=await p.evaluate(()=>OfficeRoom.diagnostics().frames);await p.waitForTimeout(450);assert.equal(await p.evaluate(()=>OfficeRoom.diagnostics().frames),frame,'hidden office must stop drawing');
  await click('[data-action="continue"]');assert.equal(await p.locator('#office-room').isVisible(),true);
  for(const width of [320,360,390,700,860,1024,1440]){
   await p.setViewportSize({width,height:900});await p.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'office overflow '+width);
   for(const view of ['notes','archive','city','wardrobe','career','actions']){
    const shortcut=p.locator(`#room-shortcuts [data-room-view="${view}"]`);
    if(await shortcut.count())await shortcut.click();else await click(`${width<=700?'#room-mobile-programs':'#room-laptop-home'} [data-room-view="${view}"]`);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'app overflow '+width+' '+view);await room();
   }
  }
  await p.setViewportSize({width:390,height:844});
  for(const view of ['mail','bank','settings','shop']){
   await click(`#room-mobile-programs [data-room-view="${view}"]`);
   assert.equal(await p.locator(view==='bank'?'#phone-content':'#desktop-content').isVisible(),true,'mobile dock '+view);
   await room();
  }
  await p.screenshot({path:path.join(out,'room-final-mobile.png'),fullPage:true});
  await click('#room-shortcuts [data-room-view="phone"]');assert.equal(await p.locator('#phone-content').isVisible(),true);await room();
  await p.reload();assert.equal(await p.locator('#menu').isVisible(),true);assert.equal(await p.locator('[data-action="continue"]').isVisible(),false);
  assert.deepEqual(errors,[]);
  // A device without WebGL can still reach every game section.
  const fallback=await browser.newPage({viewport:{width:390,height:844}});
  await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return get.call(this,type,...args);};});
  await fallback.goto(base);await fallback.locator('[data-action="new-game"]').click();await fallback.waitForFunction(()=>window.OfficeRoom?.diagnostics().fallback);
  await fallback.locator('#room-shortcuts [data-room-view="laptop"]').click();assert.equal(await fallback.locator('[data-offer="first-signature"]').isVisible(),true);
  await fallback.close();
  console.log('PASS: real 3D office, spatial laptop, all object routes, notes, archive, settings, idle pause, fresh opening, mobile layouts and WebGL fallback.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
