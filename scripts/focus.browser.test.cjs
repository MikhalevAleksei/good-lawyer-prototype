'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.BASE_URL||'http://127.0.0.1:8775/';
const out=process.env.QA_DIR||'/private/tmp/lawyer-focus-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({headless:true});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base);await p.locator('[data-action="new-game"]').click();
  await p.waitForFunction(()=>OfficeRoom.diagnostics().ready&&OfficeRoom.diagnostics().frames>0);
  const settled=focus=>p.waitForFunction(f=>{const d=OfficeRoom.diagnostics();return d.focus===f&&!d.transitioning;},focus);
  const initial=await p.evaluate(()=>OfficeRoom.diagnostics().camera);
  const screenOffset=()=>p.evaluate(()=>{const r=document.querySelector('#room-screen').getBoundingClientRect(),v=document.querySelector('#room-viewport').getBoundingClientRect();return [r.x-v.x,r.y-v.y,r.width,r.height];});
  const initialScreen=await screenOffset();
  await p.evaluate(()=>window.addEventListener('click',()=>{window.lastTransition=OfficeRoom.diagnostics().transitioning;}));
  // Click the physical laptop screen, not a separate navigation page.
  await p.locator('#room-laptop-home .os-top').click();
  assert.equal(await p.evaluate(()=>window.lastTransition),true,'camera starts an animation');
  await settled('laptop');
  assert.notDeepEqual(await p.evaluate(()=>OfficeRoom.diagnostics().camera),initial);
  assert.equal(await p.locator('#room-screen #desktop-content').isVisible(),true);
  assert.equal(await p.locator('.stage').isVisible(),false);
  await p.locator('[data-offer="first-signature"]').click();
  await p.locator('[data-desk="dossier"]').click();
  await p.locator('#desktop-content').evaluate(e=>e.scrollTop=210);
  const scroll=await p.locator('#desktop-content').evaluate(e=>e.scrollTop);
  await p.locator('#room-focus-bar [data-action="room"]').click();await settled(null);
  const returnedScreen=await screenOffset();assert.ok(returnedScreen.every((n,i)=>Math.abs(n-initialScreen[i])<1),'screen remains anchored after scrolling and return');
  await p.locator('#room-shortcuts [data-room-view="laptop"]').click();await settled('laptop');
  assert.match(await p.locator('#desktop-content').innerText(),/Материалы дела/);
  assert.equal(await p.locator('#desktop-content').evaluate(e=>e.scrollTop),scroll,'return keeps document position');
  await p.screenshot({path:out+'/laptop.png',fullPage:true});
  await p.keyboard.press('Escape');await settled(null);
  await p.locator('.phone-wake').click();await settled('phone');
  assert.equal(await p.locator('#room-phone-screen #phone-content').isVisible(),true);
  await p.locator('[data-order="observe"]').click();
  await p.locator('[data-phone="bank"]').click();assert.match(await p.locator('.budget-card').innerText(),/8\s*000/);
  await p.screenshot({path:out+'/phone.png',fullPage:true});
  // A second selection interrupts the flight and arrives at the latest device.
  await p.evaluate(()=>{document.querySelector('#room-focus-bar [data-room-view="laptop"]').click();document.querySelector('#room-focus-bar [data-room-view="phone"]').click();});
  await settled('phone');
  await p.locator('[data-action="menu"]').click();const frames=await p.evaluate(()=>OfficeRoom.diagnostics().frames);
  await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>OfficeRoom.diagnostics().frames),frames);
  await p.locator('[data-action="continue"]').click();await settled('phone');
  for(const width of [320,390,700,1024]){
   await p.setViewportSize({width,height:844});
   for(const device of ['laptop','phone']){
    await p.locator(`#room-focus-bar [data-room-view="${device}"]`).click();await settled(device);
    const rect=await p.locator(device==='phone'?'#room-phone-screen':'#room-laptop-workspace').boundingBox();
    assert.ok(rect.x>=-2&&rect.x+rect.width<=width+2,'working surface fits '+width+' '+device);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.equal(await p.locator(device==='phone'?'#phone-content':'#desktop-content').isVisible(),true);
   }
  }
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:out+'/phone-mobile.png',fullPage:true});
  await p.locator('#room-focus-bar [data-room-view="laptop"]').click();await settled('laptop');await p.screenshot({path:out+'/laptop-mobile.png',fullPage:true});
  await p.keyboard.press('Escape');await settled(null);assert.equal(await p.locator('#room-shortcuts').isVisible(),true);
  assert.deepEqual(errors,[]);
  const reduced=await b.newPage({reducedMotion:'reduce'});await reduced.goto(base);await reduced.locator('[data-action="new-game"]').click();await reduced.waitForFunction(()=>OfficeRoom.diagnostics().ready&&OfficeRoom.diagnostics().frames>0);
  await reduced.locator('#room-shortcuts [data-room-view="laptop"]').click();assert.equal(await reduced.evaluate(()=>OfficeRoom.diagnostics().transitioning),false);
  await reduced.close();console.log('PASS: animated device focus, live physical screens, scrolling and state retention, rapid switching, return/Escape, responsive focus and reduced motion.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
