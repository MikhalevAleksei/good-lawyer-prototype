'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.BASE_URL||'http://127.0.0.1:8775/';
const out=process.env.QA_DIR||'/private/tmp/lawyer-archive-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  // Capture the instance only in this test response. Production exposes no mutation hook.
  await p.route('**/assets/game.js*',async route=>{
   const response=await route.fetch(),text=await response.text();
   const marker='const game=new Game(globalThis.GOOD_LAWYER_CASES);';assert.ok(text.includes(marker));
   await route.fulfill({response,body:text.replace(marker,marker+'globalThis.__archiveTestGame=game;')});
  });
  const settled=focus=>p.waitForFunction(f=>{const d=OfficeRoom.diagnostics();return d.focus===f&&!d.transitioning&&d.frames>0;},focus);
  const focus=async view=>{await p.locator(`#room-focus-bar [data-room-view="${view}"]`).click();await settled(view);};
  const shelfFits=()=>p.waitForFunction(()=>{const a=document.querySelector('#room-archive-shelves').getBoundingClientRect(),v=document.querySelector('#room-viewport').getBoundingClientRect();return a.width>150&&a.left>=v.left&&a.right<=v.right&&a.top>=v.top&&a.bottom<=v.bottom;});
  await p.goto(base);await p.locator('[data-action="new-game"]').click();await p.waitForFunction(()=>OfficeRoom.diagnostics().ready&&OfficeRoom.diagnostics().frames>0);
  const initial=await p.evaluate(()=>OfficeRoom.diagnostics().camera);
  await p.evaluate(()=>window.addEventListener('click',()=>{window.__archiveTransition=OfficeRoom.diagnostics().transitioning;}));
  // Click exposed geometry at the top of the cabinet, through the normal raycaster.
  const v=await p.locator('#room-viewport').boundingBox();let cabinetPoint=null;
  for(const [x,y] of [[.17,.12],[.19,.12],[.2,.15],[.16,.18]]){
   await p.mouse.move(v.x+v.width*x,v.y+v.height*y);
   if(await p.locator('[data-object="Bookshelf"]').evaluate(e=>e.classList.contains('is-visible'))){cabinetPoint={x:v.x+v.width*x,y:v.y+v.height*y};break;}
  }
  assert.ok(cabinetPoint,'cabinet has a visible clickable surface');
  await p.mouse.click(cabinetPoint.x,cabinetPoint.y);assert.equal(await p.evaluate(()=>window.__archiveTransition),true);
  await settled('archive');await shelfFits();
  const archiveCamera=await p.evaluate(()=>OfficeRoom.diagnostics().camera);
  assert.notDeepEqual(archiveCamera,initial);assert.ok(archiveCamera[0]<-4&&archiveCamera[2]<initial[2]-5,'camera approaches the actual cabinet');
  assert.equal(await p.locator('#room-archive-shelves [data-archive-id]').count(),0);
  assert.match(await p.locator('#room-archive-shelves').innerText(),/Первая папка/);
  assert.equal(await p.locator('#desktop-content').isVisible(),false);
  await p.screenshot({path:out+'/empty-desktop.png',fullPage:true});
  // Start a case from the empty archive; a real court result must create the first folder.
  await p.locator('.archive-empty [data-room-view="cases"]').click();await settled('laptop');
  await p.locator('[data-offer="first-signature"]').click();
  for(let i=0;i<4;i++)await p.locator('[data-action="day"]').click();
  await p.locator('#court-button').click();await p.locator('[data-court-answer="0"]').click();await p.locator('[data-action="skip"]').click();
  await settled('laptop');assert.equal(await p.evaluate(()=>__archiveTestGame.s.completed.length),1);
  const career=await p.evaluate(()=>JSON.stringify(__archiveTestGame.s));
  await focus('archive');await shelfFits();
  assert.equal(await p.locator('#room-archive-shelves [data-archive-id]').count(),1);
  const folder=p.locator('#room-archive-shelves [data-archive-id="first-signature"]');
  await folder.focus();await folder.press('Enter');
  assert.equal(await p.locator('#archive-document-title').innerText(),'Чужая подпись');
  assert.match(await p.locator('#room-archive-detail').innerText(),/Гонорар:.*12\s*000/);
  assert.equal(await p.evaluate(()=>document.activeElement.id),'archive-document-title');
  await p.screenshot({path:out+'/result-desktop.png',fullPage:true});
  await p.locator('.archive-document-body').evaluate(e=>e.scrollTop=180);
  const scroll=await p.locator('.archive-document-body').evaluate(e=>e.scrollTop);
  await p.locator('[data-action="menu"]').click();const frames=await p.evaluate(()=>OfficeRoom.diagnostics().frames);
  await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>OfficeRoom.diagnostics().frames),frames);
  await p.locator('[data-action="continue"]').click();await settled('archive');
  assert.equal(await p.locator('#room-archive-detail').isVisible(),true);
  assert.equal(await p.locator('.archive-document-body').evaluate(e=>e.scrollTop),scroll);
  await p.locator('[data-action="archive-close"]').click();assert.equal(await folder.evaluate(e=>e===document.activeElement),true);
  await focus('laptop');assert.match(await p.locator('#desktop-content').innerText(),/Итог заседания/i,'archive preserves the laptop program');
  await focus('archive');await p.keyboard.press('Escape');await settled(null);
  assert.ok((await p.evaluate(()=>OfficeRoom.diagnostics().camera)).every((n,i)=>Math.abs(n-initial[i])<.001));
  assert.equal(await p.evaluate(()=>JSON.stringify(__archiveTestGame.s)),career,'browsing folders never changes career resources or records');
  // Complete the rest through real engine actions to exercise ten unique stored results.
  await p.evaluate(()=>{
   const g=__archiveTestGame,check=r=>{if(!r?.ok)throw Error(g.s.notice);};
   while(!g.s.campaignComplete){
    const c=g.choices().find(c=>g.eligible(c));if(!c)throw Error('No reachable case');check(g.offer(c.id));
    const win=g.s.stage===2;
    if(win){check(g.order('documents'));check(g.order('observe'));check(g.chooseApproach('free'));for(const q of ['events','time','detail'])check(g.question(q));g.puzzleSelect(c.puzzle.answer);check(g.solvePuzzle());}
    while(!g.planOpen())g.nextDay();
    if(win){for(const id of ['documents','observe','witness','puzzle'])check(g.toggleMaterial(id));check(g.setLine(c.bestLine));}
    check(g.beginCourt());if(!g.chooseCourt(win?c.court.answer:(c.court.answer+1)%3)||!g.finishCourt())throw Error('Court failed');
   }
   OfficeRoom.setMotion(false);
  });
  await p.locator('#room-shortcuts [data-room-view="archive"]').click();await settled('archive');await shelfFits();
  assert.equal(await p.locator('#room-archive-shelves [data-archive-id]').count(),6);assert.equal(await p.locator('.archive-folder.won').count(),1);
  await p.screenshot({path:out+'/six-folders-desktop.png',fullPage:true});
  const ids=await p.locator('#room-archive-shelves [data-archive-id]').evaluateAll(es=>es.map(e=>e.dataset.archiveId));
  await p.locator('[data-archive-page="1"]').focus();await p.keyboard.press('Enter');
  assert.equal(await p.locator('#room-archive-shelves [data-archive-id]').count(),4);
  assert.equal(await p.locator('[data-archive-page="-1"]').evaluate(e=>e===document.activeElement),true,'page boundary retains keyboard focus');
  ids.push(...await p.locator('#room-archive-shelves [data-archive-id]').evaluateAll(es=>es.map(e=>e.dataset.archiveId)));
  assert.equal(new Set(ids).size,10,'every completed case is reachable');
  for(const width of [320,390,700,1024]){
   await p.setViewportSize({width,height:844});await shelfFits();
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'archive fits '+width);
   assert.equal(await p.locator('.archive-folder').evaluateAll(es=>es.every(e=>e.scrollHeight<=e.clientHeight+1)),true,'folder titles fit '+width);
   const last=p.locator('#room-archive-shelves [data-archive-id]').last(),title=await last.locator('strong').innerText();
   await last.click();assert.equal(await p.locator('#archive-document-title').innerText(),title);
   await p.locator('.archive-document-body').evaluate(e=>e.scrollTop=e.scrollHeight);
   assert.equal(await p.locator('#room-archive-detail [data-training]').isVisible(),true);
   if(width===390)await p.screenshot({path:out+'/result-mobile.png',fullPage:true});
   await p.locator('[data-action="archive-close"]').click();
   if(width===390)await p.screenshot({path:out+'/folders-mobile.png',fullPage:true});
  }
  // Training from a physical folder opens the actual dossier, and restores career on exit.
  const beforeTraining=await p.evaluate(()=>JSON.stringify(__archiveTestGame.s));
  await p.locator('#room-archive-shelves [data-archive-id]').last().click();await p.locator('#room-archive-detail [data-training]').click();await settled('laptop');
  assert.equal(await p.locator('#training-banner').isVisible(),true);assert.match(await p.locator('#desktop-content').innerText(),/Материалы дела/);
  await p.locator('#training-banner [data-action="leave-training"]').click();
  // leaveTraining only changes the notification, not career values.
  const afterTraining=await p.evaluate(()=>JSON.stringify(__archiveTestGame.s));const before=JSON.parse(beforeTraining),after=JSON.parse(afterTraining);delete before.notice;delete after.notice;assert.deepEqual(after,before);
  // A second click during flight must win, including when the cabinet is involved.
  await p.evaluate(()=>{OfficeRoom.setMotion(true);document.querySelector('#room-focus-bar [data-room-view="archive"]').click();document.querySelector('#room-focus-bar [data-room-view="phone"]').click();});await settled('phone');
  await focus('archive');await p.locator('#room-archive-shelves [data-archive-id]').last().click();
  const archivedTitle=await p.locator('#archive-document-title').innerText();
  const canLoseContext=await p.evaluate(()=>{const gl=document.querySelector('#room-webgl canvas').getContext('webgl2');window.__archiveContext=gl?.getExtension('WEBGL_lose_context');window.__archiveContext?.loseContext();return !!window.__archiveContext;});
  if(canLoseContext){
   await p.waitForFunction(()=>OfficeRoom.diagnostics().fallback);
   assert.equal(await p.locator('#desktop-content').isVisible(),true,'context loss opens the selected record in the fallback');
   assert.ok((await p.locator('#desktop-content').innerText()).includes(archivedTitle));
   await p.waitForTimeout(150);await p.evaluate(()=>window.__archiveContext.restoreContext());await p.waitForFunction(()=>!OfficeRoom.diagnostics().fallback);
   await p.locator('.room-return').click();await settled(null);
  }else{await p.locator('#room-focus-bar [data-action="room"]').click();await settled(null);}
  await p.locator('[data-action="menu"]').click();await p.locator('[data-action="new-game"]').click();
  await p.locator('#room-shortcuts [data-room-view="archive"]').click();await settled('archive');assert.equal(await p.locator('.archive-folder').count(),0);
  await p.reload();assert.equal(await p.locator('#menu').isVisible(),true);assert.equal(await p.locator('[data-action="continue"]').isVisible(),false);
  assert.deepEqual(errors,[]);
  const fallback=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).includes('webgl')?null:get.call(this,type,...args);};});
  await fallback.goto(base);await fallback.locator('[data-action="new-game"]').click();await fallback.waitForFunction(()=>OfficeRoom.diagnostics().fallback);
  await fallback.locator('#room-shortcuts [data-room-view="archive"]').click();assert.match(await fallback.locator('#desktop-content').innerText(),/История вашей практики/);assert.equal(await fallback.locator('#desktop-content').isVisible(),true);
  await fallback.close();console.log('PASS: physical cabinet click, smooth focus, real completed folders and results, ten-case pagination, keyboard, responsive archive, preserved career/device state, training, menu, reset, rapid switching and fallback.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
