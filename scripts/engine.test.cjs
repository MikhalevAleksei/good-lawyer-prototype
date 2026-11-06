'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {Game} = require('../source/engine.js');

const questions = ['events','time','detail','conflict','source','certainty','review','confirm'];

function fixture(overrides = {}) {
  return {
    id:'fixture',step:1,rating:8,title:'Контрольное дело',client:'Клиент',
    objective:'Проверить алиби',days:5,ap:12,budget:30000,fee:60000,target:70,bestLine:'alibi',
    witness:{name:'Свидетель защиты',trait:'careful',account:'Видел клиента в другом месте.',
      guided:'Готов уточнить время.',detail:'Время подтверждено чеком.',contradiction:'Часы в здании отставали.'},
    materials:{
      initial:{title:'Рассказ клиента',text:'Клиент сообщает об алиби.'},
      rumor:{title:'Непроверенный слух',text:'Источник пересказывает чужие слова.'},
      documents:{title:'Чек',text:'Подтверждён чек с указанным временем.'},
      observe:{title:'Запись камеры',text:'Камера подтверждает перемещения.'},
      expert:{title:'Экспертиза',text:'Запись не изменялась.'}
    },
    judge:{prefers:'document'},puzzle:{answer:1,explanation:'Время на чеке объясняет расхождение.'},
    court:{answer:1},...overrides
  };
}

function accepted(overrides = {}) {
  const c=fixture(overrides), g=new Game([c]);
  g.s.stage=c.step;
  g.s.rep=Math.max(g.s.rep,c.rating);
  g.s.professional=Math.max(g.s.professional,g.requirement(c).professional);
  assert.equal(g.offer(c.id).ok,true);
  return g;
}

function finances(g) {
  return {
    money:g.s.money,ap:g.s.active.ap,budget:g.s.active.budget,invested:g.s.active.invested,
    pending:structuredClone(g.s.active.pending),transactions:structuredClone(g.s.transactions)
  };
}

function select(g, ids, line = g.definition.bestLine) {
  assert.equal(g.planOpen(),true);
  for(const id of ids) assert.equal(g.toggleMaterial(id).ok,true,id);
  assert.equal(g.setLine(line).ok,true);
}

function finish(g, choice = g.definition.court.answer) {
  if(g.suitWorn())assert.equal(g.buy('suit').ok,true,'a worn suit is replaced before court');
  assert.equal(g.beginCourt().ok,true);
  assert.equal(g.chooseCourt(choice),true);
  assert.equal(g.finishCourt(),true);
  return g.s.result;
}

// Chapter 1 is scripted: the minimal winning path from the episode screenplay.
function prepareEpisode(g) {
  for(const id of ['cameras','profile_waiter'])assert.equal(g.epOrder(id).ok,true,id);
  assert.equal(g.epInterview('waiter','free').ok,true);
  for(const q of ['duration','others'])assert.equal(g.epAsk('waiter',q).ok,true,q);
  g.nextDay();assert.equal(g.epOrder('study_bus').ok,true);
  g.nextDay();assert.equal(g.epOrder('deep_bus').ok,true);
  while(!g.planOpen())assert.equal(g.nextDay(),true);
}

function prepareGood(g) {
  if(g.definition.episode)return prepareEpisode(g);
  assert.equal(g.order('documents').ok,true);
  assert.equal(g.order('observe').ok,true);
  assert.equal(g.chooseApproach('free').ok,true);
  for(const q of ['events','time','detail']) assert.equal(g.question(q).ok,true);
  g.puzzleSelect(g.definition.puzzle.answer);
  assert.equal(g.solvePuzzle().ok,true);
  while(!g.planOpen()) assert.equal(g.nextDay(),true);
  select(g,['documents','observe','witness','puzzle']);
}

test('a client refusal explains the gate without spending resources or duplicating mail',()=>{
  const c=fixture({rating:40}),g=new Game([c]);
  const start=g.s.money;
  assert.equal(g.offer(c.id).ok,false);
  assert.equal(g.s.active,null);
  assert.equal(g.s.money,start);
  assert.match(g.s.mail[0].body,/40/);
  const count=g.s.mail.length;
  assert.equal(g.offer(c.id).ok,false);
  assert.equal(g.s.mail.length,count);
});

test('a new game clears refusal history so the new career receives its own answer',()=>{
  const c=fixture({rating:40}),g=new Game([c]);
  g.offer(c.id);g.reset();
  const initialMail=g.s.mail.length;
  assert.equal(g.offer(c.id).ok,false);
  assert.equal(g.s.mail.length,initialMail+1);
  assert.match(g.s.mail[0].title,/Отказ/);
});

test('agents complete assignments in the background, exactly once, with independent slots',()=>{
  const g=accepted();
  assert.equal(g.order('documents').ok,true);
  assert.equal(g.order('observe').ok,true);
  const afterStart=finances(g);
  assert.equal(g.order('expert').ok,false,'Irina is already busy');
  assert.equal(g.order('profile').ok,false,'Mark is already busy');
  assert.equal(g.order('documents').ok,false,'same order cannot be started twice');
  assert.deepEqual(finances(g),afterStart);
  assert.equal(g.s.active.materials.some(m=>m.id==='documents'),false);
  assert.equal(g.s.active.materials.some(m=>m.id==='observe'),false);
  g.nextDay();
  assert.equal(g.s.active.materials.filter(m=>m.id==='documents').length,1);
  assert.equal(g.s.active.materials.some(m=>m.id==='observe'),false);
  g.nextDay();
  assert.equal(g.s.active.materials.filter(m=>m.id==='observe').length,1);
  const afterComplete=finances(g);
  assert.equal(g.order('documents').ok,false);
  g.completeTasks();
  assert.deepEqual(finances(g),afterComplete);
  assert.equal(g.s.active.materials.filter(m=>m.id==='documents').length,1);
});

test('expense overflow uses the client budget first and requires a personal funding choice',()=>{
  const g=accepted({budget:5000});
  assert.deepEqual(g.quote('observe'),{cost:8000,client:5000,personal:3000,days:2});
  const before=finances(g);
  assert.equal(g.order('observe').ok,false);
  assert.deepEqual(finances(g),before);
  g.s.active.personalFunding=true;
  assert.equal(g.order('observe').ok,true);
  assert.equal(g.s.active.budget,0);
  assert.equal(g.s.money,before.money-3000);
  assert.equal(g.s.active.invested,3000);
  assert.equal(g.s.transactions.filter(t=>t.account==='client'&&t.amount===-5000).length,1);
  assert.equal(g.s.transactions.filter(t=>t.account==='personal'&&t.amount===-3000).length,1);
});

test('insufficient money or AP never causes partial debit',()=>{
  const g=accepted({budget:5000});
  g.s.active.personalFunding=true;g.s.money=2999;
  let before=finances(g);
  assert.equal(g.order('observe').ok,false);
  assert.deepEqual(finances(g),before);
  g.s.money=90000;g.s.active.ap=1;
  before=finances(g);
  assert.equal(g.order('observe').ok,false);
  assert.deepEqual(finances(g),before);
});

test('fixed AP do not regenerate and zero AP still permits pending work and a defence plan',()=>{
  const g=accepted();
  assert.equal(g.order('documents').ok,true);
  assert.equal(g.order('observe').ok,true);
  assert.equal(g.chooseApproach('free').ok,true);
  g.nextDay();
  assert.equal(g.s.active.ap,8,'a new day does not restore fixed AP');
  for(const q of questions) assert.equal(g.question(q).ok,true,q);
  assert.equal(g.s.active.ap,0);
  assert.equal(g.s.active.questions.length,8);
  assert.equal(g.planOpen(),true);
  const snapshot=finances(g);
  assert.equal(g.question('events').ok,false);
  assert.equal(g.order('expert').ok,false);
  assert.deepEqual(finances(g),snapshot);
  assert.equal(g.nextDay(),true);
  assert.equal(g.s.active.materials.some(m=>m.id==='observe'),true);
  select(g,['documents','observe','witness']);
  assert.equal(finish(g).won,true);
});

test('reviewing a witness requires the new document and does not charge for a blocked question',()=>{
  const g=accepted();
  assert.equal(g.chooseApproach('guided').ok,true);
  const ap=g.s.active.ap;
  assert.equal(g.question('review').ok,false);
  assert.equal(g.s.active.ap,ap);
  assert.equal(g.s.active.questions.length,0);
  g.order('documents');g.nextDay();
  assert.equal(g.question('review').ok,true);
  assert.match(g.s.active.protocol.at(-1).a,/сверки/);
  assert.equal(g.s.active.materials.filter(m=>m.id==='witness').length,1);
});

test('pressure on a nervous witness makes a harmful protocol and creates career risk',()=>{
  const c=fixture(),g=accepted({witness:{...c.witness,trait:'nervous'}});
  assert.equal(g.chooseApproach('pressure').ok,true);
  assert.equal(g.question('events').ok,true);
  const witness=g.s.active.materials.find(m=>m.id==='witness');
  assert.equal(witness.risky,true);
  assert.ok(witness.power<0);
  assert.match(witness.text,/давлении/);
  assert.ok(g.s.heat>0);
  assert.ok(g.s.shadow>0);
});

test('the optional puzzle preserves a choice and grants its material at most once',()=>{
  const g=accepted();
  g.puzzleSelect(1);
  assert.equal(g.s.active.puzzleChoice,1);
  assert.equal(g.solvePuzzle().ok,true);
  const ap=g.s.active.ap;
  assert.equal(g.solvePuzzle().ok,false);
  assert.equal(g.s.active.ap,ap);
  assert.equal(g.s.active.materials.filter(m=>m.id==='puzzle').length,1);
  const wrong=accepted();wrong.puzzleSelect(0);wrong.solvePuzzle();
  assert.equal(wrong.s.active.materials.some(m=>m.id==='puzzle'),false);
  assert.equal(wrong.s.active.puzzleAttempted,true);
});

test('the plan opens one day before court and changing it does not consume AP',()=>{
  const g=accepted(),ap=g.s.active.ap;
  assert.equal(g.toggleMaterial('initial').ok,false);
  assert.equal(g.setLine('alibi').ok,false);
  assert.equal(g.beginCourt().ok,false);
  while(g.s.day<g.s.active.deadline-2) g.nextDay();
  assert.equal(g.planOpen(),false);
  g.nextDay();
  assert.equal(g.planOpen(),true);
  select(g,['initial']);
  assert.equal(g.s.active.ap,ap);
  assert.equal(g.beginCourt().ok,true);
  assert.equal(g.nextDay(),false,'court cannot advance the calendar underneath its choice');
  g.cancelCourt();
  assert.equal(g.s.active.phase,'prepare');
  assert.deepEqual(g.plan(),['initial']);
});

test('the chosen materials, line and sequence matter rather than raw collected evidence',()=>{
  const g=accepted();
  g.order('documents');g.nextDay();g.chooseApproach('guided');g.question('events');
  while(!g.planOpen())g.nextDay();
  select(g,['initial','documents','witness']);
  const ordered=g.assessment();
  g.move('witness',-1);
  const reversed=g.assessment();
  assert.equal(ordered.score-reversed.score,7,'document before witness is worth 7 more points');
  g.setLine('motive');
  assert.equal(reversed.score-g.assessment().score,16,'the wrong line loses its bonus and incurs a penalty');
  g.setLine('alibi');g.toggleMaterial('rumor');
  assert.equal(g.assessment().score,reversed.score-18,'collecting a rumor does not make it beneficial');
  const auto=accepted();auto.order('documents');auto.nextDay();
  assert.deepEqual(auto.plan(),['initial','rumor','documents'],'automatic plan follows acquisition order');
});

test('a coherent legal strategy wins while an unprepared automatic plan loses',()=>{
  const good=accepted();prepareGood(good);
  const goodResult=finish(good);
  assert.equal(goodResult.won,true);
  assert.ok(goodResult.rows.some(r=>r.label.includes('хронологию')));
  assert.equal(good.s.shadow,0);
  const bad=accepted();while(!bad.planOpen())bad.nextDay();
  const badResult=finish(bad,0);
  assert.equal(badResult.won,false);
  assert.ok(goodResult.score>badResult.score);
});

test('court result, fee and returned budget are applied exactly once',()=>{
  const g=accepted();prepareGood(g);
  const before=g.s.money,returned=g.s.active.budget;
  const result=finish(g);
  assert.equal(g.s.money,before+60000);
  assert.equal(result.returned,returned);
  assert.equal(g.s.completed.length,1);
  assert.equal(g.s.stage,2);
  assert.equal(g.s.transactions.filter(t=>t.name==='Остаток бюджета возвращён клиенту').length,1);
  const stable=structuredClone(g.s);
  assert.equal(g.finishCourt(),false);
  assert.equal(g.chooseCourt(1),false);
  assert.equal(g.beginCourt().ok,false);
  assert.deepEqual({...g.s,notice:stable.notice},stable);
});

test('a task due on the hearing date arrives before the case can become overdue',()=>{
  const g=accepted();
  while(g.s.day<g.s.active.deadline-1)g.nextDay();
  assert.equal(g.order('documents').ok,true);
  assert.equal(g.order('observe').ok,false,'a two-day assignment would miss court');
  g.nextDay();
  assert.equal(g.s.day,g.s.active.deadline);
  assert.equal(g.s.active.materials.some(m=>m.id==='documents'),true);
  assert.equal(g.preparing(),false,'no new preparation on hearing day');
  assert.equal(g.planOpen(),true);
  assert.equal(g.beginCourt().ok,true,'the hearing is still available on its date');
});

test('one next-day action advances exactly one day when a hearing is missed',()=>{
  const g=accepted();
  while(g.s.day<g.s.active.deadline)g.nextDay();
  const day=g.s.day;
  g.nextDay();
  assert.equal(g.s.day,day+1);
  assert.equal(g.s.active,null);
  assert.equal(g.s.result.late,true);
  assert.equal(g.s.result.won,false);
  assert.equal(g.s.result.fee,24000);
  assert.equal(g.s.stage,2);
});

test('postponement grants time once with a real fee and judge cost, without new AP',()=>{
  const g=accepted({step:4});
  const {deadline,fee,ap}=g.s.active;
  assert.equal(g.postpone().ok,true);
  assert.equal(g.s.active.deadline,deadline+2);
  assert.equal(g.s.active.fee,Math.round(fee*.8));
  assert.equal(g.s.active.ap,ap);
  assert.ok(g.assessment().rows.some(r=>r.value===-4));
  assert.equal(g.postpone().ok,false);
  assert.equal(g.s.active.deadline,deadline+2);
  assert.equal(accepted().postpone().ok,false,'intro case has no postponement');
});

test('investigation evidence and the attention of the authorities do not cool, defense is paid once and pressure can end the career',()=>{
  const defended=accepted();
  defended.illegal(22);defended.illegal(32);
  assert.ok(defended.s.investigation);
  const evidence=defended.s.investigation.evidence,heat=defended.s.heat;
  defended.nextDay();
  assert.equal(defended.s.investigation.evidence,evidence);
  assert.equal(defended.s.heat,heat,'the attention of the authorities only grows by itself');
  const money=defended.s.money;
  assert.equal(defended.defend().ok,true);
  assert.equal(defended.s.money,money-25000);
  assert.equal(defended.s.investigation.evidence,evidence-25);
  assert.equal(defended.defend().ok,false);
  defended.nextDay();
  assert.equal(defended.s.investigation,null);
  assert.equal(defended.s.ending,null);
  const prison=accepted();prison.illegal(22);prison.illegal(32);prison.illegal(22);
  while(!prison.s.ending)prison.nextDay();
  assert.equal(prison.s.ending,'prison');
  assert.equal(prison.order('documents').ok,false);
  assert.equal(prison.nextDay(),false);
});

test('the defender spends the hearing day only with an explicit missed-hearing report',()=>{
  const openProbe=g=>{g.nextDay();g.nextDay();g.nextDay();g.illegal(22);g.illegal(32);assert.ok(g.s.investigation);};
  const early=accepted();openProbe(early);
  assert.match(early.defend().message,/Прошёл один день\.$/);
  assert.ok(early.s.active,'a defender before the hearing keeps the case');
  const g=accepted();openProbe(g);
  while(g.s.day<g.s.active.deadline)g.nextDay();
  const reply=g.defend();
  assert.equal(reply.ok,true);
  assert.equal(g.s.active,null);
  assert.equal(g.s.result.late,true);
  assert.match(reply.message,/Слушание пропущено, дело проиграно\./);
  assert.equal(g.s.notice,reply.message);
});

test('leaving the courtroom returns to preparation with a fresh notice',()=>{
  const g=accepted();
  while(!g.planOpen())g.nextDay();
  assert.equal(g.beginCourt().ok,true);
  assert.equal(g.chooseCourt(1),true);
  g.cancelCourt();
  assert.equal(g.s.active.phase,'prepare');
  assert.equal(g.s.active.courtChoice,null);
  assert.match(g.s.notice,/вернулись к подготовке/);
});

test('a training result cannot change any saved career resources or records',()=>{
  const g=accepted();prepareGood(g);finish(g);
  g.s.campaignComplete=true;g.s.stage=11;
  g.s.money=123456;g.s.debt=7000;g.s.rep=52;g.s.professional=49;
  g.s.shadow=16;g.s.heat=21;g.s.office=1;g.s.assistant=true;g.s.suit=true;g.s.wear=55;
  const career=structuredClone(g.s);
  assert.equal(g.training('fixture').ok,true);
  assert.equal(g.s.training,true);
  assert.equal(g.buy('suit').ok,false);
  prepareGood(g);finish(g);
  assert.equal(g.s.result.training,true);
  g.leaveTraining();
  assert.deepEqual({...g.s,notice:career.notice},career);
  assert.equal(g.career,null);
});

test('pro bono cases have no client budget or fee and support reputation at personal expense',()=>{
  const c=fixture(),g=new Game([c]);
  g.s.heat=20;
  assert.equal(g.offer(c.id,true).ok,true);
  assert.equal(g.s.active.budget,0);
  assert.equal(g.s.active.fee,0);
  assert.equal(g.s.active.personalFunding,true);
  const money=g.s.money;
  prepareGood(g);const result=finish(g);
  assert.equal(result.won,true);
  assert.equal(result.fee,0);
  assert.equal(result.repGain,14,'7 for the win, 5 for pro bono, 2 for a fresh suit');
  assert.equal(g.s.money,money-14000);
  assert.equal(g.s.heat,8,'pro bono work is the only thing that lowers the attention of the authorities');
});

test('weekly bills keep cash nonnegative and expose debt which can be repaid',()=>{
  const g=new Game([fixture()]);g.s.money=1000;g.s.day=7;
  g.nextDay();
  assert.equal(g.s.money,0);
  assert.equal(g.s.debt,2000);
  assert.ok(g.s.mail.some(m=>m.title==='Задолженность по расходам'));
  g.s.money=3500;g.payDebt();
  assert.equal(g.s.debt,0);
  assert.equal(g.s.money,1500);
});

test('office and expert assistant purchases use personal money; the assistant makes expert work cheaper and faster',()=>{
  const g=accepted();g.s.completed=[{id:'previous-one'},{id:'previous-two'}];
  const budget=g.s.active.budget,money=g.s.money;
  assert.equal(g.buy('assistant').ok,false,'an assistant requires office space');
  assert.equal(g.buy('office').ok,true);
  assert.equal(g.buy('assistant').ok,true);
  assert.equal(g.s.money,money-48000);
  assert.equal(g.s.active.budget,budget,'client money cannot buy office equipment or staff');
  assert.equal(g.weeklyCost(),12000);
  const ap=g.s.active.ap;
  assert.equal(g.order('documents').ok,true);
  assert.equal(g.s.active.ap,ap-1,'2 AP without the assistant, 1 AP with it');
  assert.equal(g.order('expert').ok,false,'the expert still works on one task at a time');
  assert.ok(g.s.active.pending.every(t=>t.due===g.s.day+1));
  g.nextDay();
  assert.equal(g.s.active.materials.some(m=>m.id==='documents'),true);
  const left=g.s.active.ap;assert.equal(g.order('expert').ok,true);
  assert.equal(g.s.active.ap,left-2,'3 AP without the assistant, 2 AP with it');
  assert.ok(g.s.active.pending.some(t=>t.key==='expert'&&t.due===g.s.day+1),'and a day faster');
});

test('new game resets career, pending work and training state',()=>{
  const g=accepted();g.order('documents');g.illegal(32);g.s.name='Другое имя';
  g.reset();
  assert.deepEqual(g.s,new Game([fixture()]).s);
  assert.equal(g.career,null);
});

const casesPath=path.join(__dirname,'../source/cases.js');
test('real campaign has 19 playable scenarios and both branches are winnable',()=>{
  const imported=require(casesPath);
  const cases=Array.isArray(imported)?imported:imported.CASES||imported.cases;
  assert.ok(Array.isArray(cases),'cases.js must export scenario data for regression checks');
  assert.equal(cases.length,19);
  assert.equal(new Set(cases.map(c=>c.id)).size,19);
  for(let stage=1;stage<=10;stage++)assert.equal(cases.filter(c=>c.step===stage).length,stage===1?1:2);
  for(const c of cases){
    const g=new Game(cases);g.s.stage=c.step;g.s.rep=100;g.s.professional=100;
    assert.equal(g.offer(c.id).ok,true,c.id);
    g.s.active.personalFunding=true;
    prepareGood(g);
    assert.equal(finish(g).won,true,c.id+' must have a viable legal defense');
  }
  for(const preferSecond of [false,true]){
    const g=new Game(cases);
    while(!g.s.campaignComplete){
      const choices=g.choices();
      const c=choices[preferSecond?choices.length-1:0];
      assert.ok(g.eligible(c),'the chosen campaign branch must be reachable: '+c.id);
      // One early pro bono success supplies the extra reputation needed for the demanding branch.
      assert.equal(g.offer(c.id,preferSecond&&g.s.stage===1).ok,true,c.id);g.s.active.personalFunding=true;
      prepareGood(g);assert.equal(finish(g).won,true,c.id);
    }
    assert.equal(g.s.completed.length,10);
    assert.equal(g.s.ending,null);
  }
});

test('real campaign remains reachable after every early case is lost',()=>{
  const imported=require(casesPath),cases=Array.isArray(imported)?imported:imported.CASES||imported.cases;
  const g=new Game(cases);
  while(!g.s.campaignComplete){
    const c=g.choices().find(c=>g.eligible(c));
    assert.ok(c,'at least one offer must remain accessible at stage '+g.s.stage);
    assert.equal(g.offer(c.id).ok,true);
    while(!g.planOpen())g.nextDay();
    assert.equal(finish(g,(c.court.answer+1)%3).won,false);
  }
  assert.equal(g.s.completed.length,10);
});

test('a fine closes the fame-gated case, while the professional case and the legal clinic stay open',()=>{
  const imported=require(casesPath),cases=Array.isArray(imported)?imported:imported.CASES||imported.cases;
  const g=new Game(cases),first=cases.find(c=>c.step===1);
  assert.equal(g.offer(first.id).ok,true);
  assert.equal(g.epCoordinate('admin').ok,false,'coordinating testimony is offered only after an interview');assert.equal(g.s.heat,0);
  for(const id of ['admin','waiter','driver']){assert.equal(g.epInterview(id,'ask').ok,true);assert.equal(g.epCoordinate(id).ok,false,'witnesses refuse to coordinate');}
  assert.ok(g.s.investigation,'three attempts to coordinate testimony open an investigation');
  while(!g.planOpen()&&!g.s.ending)g.nextDay();
  if(!g.s.ending)finish(g,(first.court.answer+1)%3);
  assert.ok(g.s.mail.some(m=>m.title==='Назначен штраф'));
  assert.equal(g.s.ending,null);
  const next=g.choices().sort((a,b)=>a.rating-b.rating);
  assert.equal(g.eligible(next.at(-1)),false,'the reputation penalty blocks the fame-gated case');
  assert.equal(g.requirement(next[0]).rep,0,'the first case of a chapter asks only for professionalism');
  assert.equal(g.offer(next.at(-1).id,true).ok,false,'pro bono does not unlock the prestigious branch');
  assert.equal(g.offer(next[0].id,true).ok,true,'the legal clinic offers a path to recover reputation');
  assert.equal(g.s.active.budget,0);
  assert.equal(g.s.active.fee,0);
  assert.equal(g.s.active.personalFunding,true);
  prepareGood(g);
  assert.equal(finish(g).won,true);
  assert.equal(g.choices().some(c=>g.eligible(c)),true,'the next chapter stays reachable');
});

test('the court reply changes the score of a well-prepared standard defence',()=>{
  const g=accepted();
  prepareGood(g);
  const good=g.assessment(g.definition.court.answer);
  const bad=g.assessment((g.definition.court.answer+1)%3);
  assert.ok(good.score>bad.score,'the scale must leave room for the courtroom answer');
});

test('chapter 1 follows the episode script: daily AP, two orders a day, same-day follow-ups and the torn note',()=>{
  const imported=require(casesPath),cases=Array.isArray(imported)?imported:imported.CASES||imported.cases;
  const g=new Game(cases),c=cases.find(x=>x.step===1);
  assert.equal(g.offer(c.id).ok,true);
  const a=g.s.active;
  assert.equal(a.deadline,7,'six days of preparation, the hearing on day 7');assert.equal(a.ap,20);
  assert.equal(g.order('documents').ok,false,'generic orders are closed in the scripted case');
  assert.equal(g.epOrder('cameras').ok,true);assert.equal(g.epOrder('search').ok,true);
  assert.match(g.epOrderBlock('profile_admin'),/2 поручения/,'two orders a day for the detective');
  assert.match(g.epOrderBlock('study_bus'),/Сначала/,'the expert needs the recordings first');
  g.nextDay();
  assert.equal(a.ap,20-4+1,'each new day restores 1 AP');
  assert.equal(a.ep.noteFound,true);
  assert.equal(g.restoreNote([1,0,2,3,4,5,6,7]).ok,false,'a wrong order does not restore the note');
  assert.equal(g.restoreNote([0,1,2,3,8,4,5,6,7]).ok,true,'blank scraps are ignored');
  assert.equal(a.ap,19,'the restored note gives 2 AP');assert.ok(a.ep.facts.includes('note'));
  assert.equal(g.epOrder('profile_admin').ok,true);g.nextDay();
  const before=a.ap;assert.equal(g.epOrder('extra_admin').ok,true);
  assert.equal(a.ap,before-1);assert.ok(a.ep.facts.includes('admin_flats'),'follow-ups arrive the same day');
  assert.equal(g.epInterview('admin','ask').ok,true);assert.equal(g.epInterview('admin','free').ok,false,'one interview type per witness');
  assert.equal(g.epAsk('admin','keys').ok,true);assert.equal(g.epPort('admin').ok,true);
  assert.ok(['admin_lock','admin_port'].every(id=>a.ep.facts.includes(id)));
  assert.equal(g.epCoordinate('driver').ok,false,'no coordination before an interview');
});

test('the suit wears 15% per case, gives career points below 45% and blocks court at 75%',()=>{
  const g=accepted();assert.equal(g.s.wear,0);
  prepareGood(g);const first=finish(g);
  assert.equal(first.suitBonus,true);assert.equal(first.repGain,7+2);assert.equal(first.professionalGain,6+1);assert.equal(g.s.wear,15);
  g.s.wear=45;assert.equal(g.suitBonus(),false,'no bonus from 45% wear');
  g.s.wear=75;assert.equal(g.suitWorn(),true);
  const c=fixture({id:'second'}),h=new Game([c]);h.s.wear=75;assert.equal(h.offer(c.id).ok,true);prepareGood(h);
  assert.equal(h.beginCourt().ok,false,'a worn suit cannot go to court');assert.match(h.s.notice,/75%/);
  h.s.money=12000;h.s.debt=5000;assert.equal(h.buy('suit').ok,true,'a new suit can be bought even with debt');
  assert.equal(h.s.wear,0);assert.equal(h.s.money,0);assert.equal(h.buy('suit').ok,false,'a fresh suit needs no replacement');
  assert.equal(h.beginCourt().ok,true);
});

test('the two cases of a chapter ask for different characteristics',()=>{
  const imported=require(casesPath),cases=Array.isArray(imported)?imported:imported.CASES||imported.cases,g=new Game(cases);
  for(let step=2;step<=10;step++){
    const [first,second]=cases.filter(c=>c.step===step);
    const a=g.requirement(first),b=g.requirement(second);
    assert.ok(a.professional>0&&a.rep===0,'first case: professionalism '+first.id);
    assert.ok(b.rep>0&&b.professional===0,'second case: fame '+second.id);
  }
});

test('chapter 1 is won only with the waiter testimony and the corrected bus clock',()=>{
  const imported=require(casesPath),cases=Array.isArray(imported)?imported:imported.CASES||imported.cases,c=cases.find(x=>x.step===1);
  const minimal=new Game(cases);minimal.offer(c.id);prepareEpisode(minimal);
  assert.equal(minimal.epScore(),60);const won=finish(minimal);assert.equal(won.won,true);assert.equal(won.score,60);
  const wrong=new Game(cases);wrong.offer(c.id);prepareEpisode(wrong);assert.equal(finish(wrong,(c.court.answer+1)%3).won,false,'a wrong court answer costs 10%');
  const noWaiter=new Game(cases);noWaiter.offer(c.id);
  for(const id of ['cameras','profile_admin'])noWaiter.epOrder(id);noWaiter.nextDay();
  for(const id of ['search','profile_waiter'])noWaiter.epOrder(id);noWaiter.epOrder('study_bus');noWaiter.nextDay();
  noWaiter.restoreNote([0,1,2,3,4,5,6,7]);noWaiter.epOrder('deep_bus');noWaiter.epOrder('extra_admin');
  noWaiter.epInterview('admin','ask');noWaiter.epAsk('admin','keys');noWaiter.epPort('admin');
  while(!noWaiter.planOpen())noWaiter.nextDay();
  const lost=finish(noWaiter);assert.ok(lost.score>=60,'enough points without the key testimony');assert.equal(lost.won,false,'the waiter testimony is required');
});

test('the full chapter 1 investigation reaches 100% and opens a check against the administrator',()=>{
  const imported=require(casesPath),cases=Array.isArray(imported)?imported:imported.CASES||imported.cases,c=cases.find(x=>x.step===1);
  const g=new Game(cases);g.offer(c.id);
  for(const id of ['cameras','profile_waiter'])assert.equal(g.epOrder(id).ok,true,id);
  assert.equal(g.epInterview('waiter','free').ok,true);for(const q of ['duration','others'])g.epAsk('waiter',q);
  g.nextDay();for(const id of ['search','profile_admin'])assert.equal(g.epOrder(id).ok,true,id);assert.equal(g.epOrder('study_bus').ok,true);
  g.nextDay();assert.equal(g.restoreNote([0,1,2,3,4,5,6,7]).ok,true);
  for(const id of ['extra_admin','deep_bus'])assert.equal(g.epOrder(id).ok,true,id);
  assert.equal(g.epInterview('admin','ask').ok,true);for(const q of ['keys'])assert.equal(g.epAsk('admin',q).ok,true);assert.equal(g.epPort('admin').ok,true);
  while(!g.planOpen())g.nextDay();
  assert.equal(g.epScore(),100);const r=finish(g);assert.equal(r.won,true);assert.equal(r.bonus,true);
  assert.ok(g.s.mail.some(m=>m.title==='Проверка администратора клуба'));
});
