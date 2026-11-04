'use strict';
// Run against a local build or BASE_URL. Requires Playwright and its Chromium.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.BASE_URL||'http://127.0.0.1:8765/';
const out=process.env.QA_DIR||'/private/tmp/good-lawyer-qa';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const errors=[];
 const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));
 const click=async s=>{
  const target=/data-phone|data-order|data-ep-order/.test(s)?'phone':/data-desk|court-button|data-action="day"|data-witness|data-ep-|data-note-piece/.test(s)?'laptop':null;
  if(target&&await page.locator('#room-focus-bar').isVisible()&&(await page.evaluate(()=>OfficeRoom.diagnostics().focus))!==target)await page.locator(`#room-focus-bar [data-room-view="${target}"]`).click();
  await page.locator(s).click();
 };
 const text=s=>page.locator(s).innerText();
 const screenshot=async name=>{await page.evaluate(()=>{window.scrollTo(0,0);for(const id of ['desktop-content','phone-content'])document.getElementById(id)?.scrollTo(0,0);});return page.screenshot({path:path.join(out,name+'.png'),fullPage:true});};
 try {
  const response=await page.goto(base);assert.equal(response.status(),200);
  await page.locator('#menu').waitFor({state:'visible'});
  assert.equal(await page.locator('#workspace').isVisible(),false);
  assert.equal(await page.locator('[data-action="continue"]').isVisible(),false);
  await screenshot('menu-desktop');
  await click('[data-action="rules"]');assert.match(await text('#rules'),/очки|ОД/);
  await click('[data-action="new-game"]');await click('#room-shortcuts [data-room-view="laptop"]');
  assert.match(await text('#desktop-content'),/Касса в 20:08/);
  await click('[data-desk="plan"]');assert.match(await text('#desktop-content'),/нет активного дела/);
  await click('[data-desk="cases"]');await click('[data-offer="first-signature"]');
  assert.match(await text('#desktop-content'),/Предложение принято/);
  await click('[data-desk="plan"]');assert.match(await text('#desktop-content'),/день 6/);
  // Chapter 1 follows the episode script: two detective orders a day, then the witnesses.
  await click('[data-phone="chat"]');await click('[data-ep-order="cameras"]');await click('[data-ep-order="profile_waiter"]');
  assert.equal(await page.locator('[data-ep-order="search"]').isDisabled(),true);
  assert.match(await text('#case-strip'),/8\s*ОД/);
  await click('[data-desk="witness"]');await click('[data-witness="waiter"]');await click('[data-ep-interview="free"]');
  for(const q of ['duration','others'])await click(`[data-ep-ask="${q}"][data-witness-id="waiter"]`);
  assert.match(await text('.protocol'),/трёх и не больше пяти/);
  assert.equal(await page.locator('[data-ep-ask="duration"]').isDisabled(),true);
  await click('[data-action="day"]');assert.match(await text('#day-label'),/2/);assert.match(await text('#case-strip'),/6\s*ОД/);
  await click('[data-ep-order="search"]');
  await click('[data-phone="chat"]');await page.locator('#agent-select').selectOption('irina');await click('[data-ep-order="study_bus"]');
  await click('[data-action="day"]');assert.match(await text('#day-label'),/3/);
  await click('[data-desk="dossier"]');
  for(const i of [0,1,2,3,4,5,6,7])await click(`[data-note-piece="${i}"]`);
  assert.match(await text('.torn-note'),/Встречаемся в порту/);
  await click('[data-phone="chat"]');await click('[data-ep-order="deep_bus"]');
  for(let i=0;i<3;i++)await click('[data-action="day"]');
  assert.match(await text('#day-label'),/6/);
  await click('[data-desk="plan"]');assert.match(await text('#desktop-content'),/Хронология защиты/);
  assert.match(await text('.plan-estimate'),/70/);
  await screenshot('plan-desktop');
  await click('[data-phone="bank"]');assert.match(await text('.budget-card'),/18\s*000/);assert.match(await text('.balance'),/90\s*000/);
  await click('[data-action="menu"]');assert.equal(await page.locator('[data-action="continue"]').isVisible(),true);
  await click('[data-action="continue"]');assert.match(await text('#day-label'),/6/);
  await click('#court-button');await click('[data-court-answer="1"]');
  await page.waitForFunction(()=>document.querySelector('#court-video')?.duration>0);
  const duration=await page.locator('#court-video').evaluate(v=>v.duration);assert.ok(duration>=7.9&&duration<=8.1);
  if(await page.locator('[data-action="play"]').isVisible())await click('[data-action="play"]');
  assert.equal(await page.locator('.cinema').getAttribute('data-verdict'),'acquit');
  await page.waitForFunction(()=>/verdict-acquit\.mp4/.test(document.querySelector('#court-video')?.currentSrc||''),null,{timeout:14000});
  assert.match(await text('#film-title'),/Слово суда/);
  if(await page.locator('[data-action="play"]').isVisible())await click('[data-action="play"]');
  await page.locator('#film-quote').waitFor({state:'visible',timeout:9000});assert.match(await text('#film-quote'),/Подсудимый невиновен/);
  await page.locator('.result-hero').waitFor({state:'visible',timeout:12000});
  assert.match(await text('.result-hero'),/Защита сработала/);
  assert.match(await text('.result-finance'),/30\s*000/);
  assert.match(await text('.balance'),/120\s*000/);
  await screenshot('result-desktop');
  await click('[data-action="cases"]');assert.equal(await page.locator('.case-card').count(),2);
  await page.locator('[data-offer]').last().click();assert.match(await text('#desktop-content'),/Отказ/);
  await click('[data-desk="cases"]');await page.locator('[data-offer]').first().click();
  await click('[data-desk="witness"]');await click('[data-approach="pressure"]');await click('[data-question="events"]');
  assert.match(await text('.protocol'),/версию событий/);
  for(const width of [320,360,640,700,736,860,1024,1440]) {
   await page.setViewportSize({width,height:950});
   for(const desk of ['cases','dossier','witness','plan','career','news','mail']) {
    if(width<=700)await click('#room-focus-bar [data-room-view="laptop"]');
    await click(`[data-desk="${desk}"]`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`overflow ${width} ${desk}`);
   }
   if(width<=700)await click('#room-focus-bar [data-room-view="phone"]');
   for(const phone of ['chat','bank']){
    await click(`[data-phone="${phone}"]`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`overflow ${width} ${phone}`);
   }
  }
  await page.setViewportSize({width:390,height:844});
  await click('#room-focus-bar [data-room-view="phone"]');await screenshot('bank-mobile');
  await click('[data-phone="chat"]');await screenshot('phone-mobile');
  await click('#room-focus-bar [data-room-view="laptop"]');await click('[data-desk="witness"]');await screenshot('witness-mobile');
  await click('[data-action="menu"]');await screenshot('menu-mobile');
  await click('[data-action="continue"]');await page.reload();
  assert.equal(await page.locator('#menu').isVisible(),true);assert.equal(await page.locator('[data-action="continue"]').isVisible(),false);
  await click('[data-action="new-game"]');await click('#room-shortcuts [data-room-view="laptop"]');await click('[data-offer="first-signature"]');
  for(let i=0;i<5;i++)await click('[data-action="day"]');
  await click('#court-button');await click('[data-court-answer="0"]');
  await click('#overlay [data-action="menu"]');await click('[data-action="continue"]');
  assert.match(await text('#day-label'),/6/);assert.equal(await page.locator('.result-hero').count(),0);
  await click('#court-button');await click('[data-court-answer="0"]');assert.equal(await page.locator('.cinema').getAttribute('data-verdict'),'guilty');await click('[data-action="skip"]');
  assert.match(await text('.result-hero'),/Доводов не хватило/);assert.match(await text('.result-finance'),/12\s*000/);
  await click('[data-action="menu"]');await click('[data-action="new-game"]');await click('#room-shortcuts [data-room-view="laptop"]');
  assert.match(await text('#day-label'),/1/);assert.match(await text('#rep'),/8/);
  await click('[data-action="menu"]');await page.goto(new URL('scenario.html',base).href);assert.equal((await page.title()).length>0,true);
  await page.goBack();assert.equal(await page.locator('#menu').isVisible(),true);
  assert.equal(await page.locator('[data-action="continue"]').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: browser game loop, budgets, queue, witness, puzzle, plans, real 8s video, failure, reset/continue/back, and 8 responsive widths.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
