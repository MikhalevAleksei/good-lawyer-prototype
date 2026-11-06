/* Deterministic campaign rules. Shared by the browser and the regression tests. */
(function () {
  'use strict';
  const ORDERS = {
    documents: {label:'Проверить документы',agent:'irina',cost:6000,ap:2,days:1,kind:'document'},
    observe: {label:'Проверить перемещения',agent:'mark',cost:8000,ap:2,days:2,kind:'physical'},
    expert: {label:'Независимая экспертиза',agent:'irina',cost:12000,ap:3,days:2,kind:'document'},
    profile: {label:'Краткая справка о свидетеле',agent:'mark',cost:3000,ap:1,days:1},
    profileFull: {label:'Подробная справка',agent:'mark',cost:5000,ap:2,days:2},
    bribe: {label:'Подкупить свидетеля',agent:'mark',cost:18000,ap:2,days:1,heat:22,kind:'witness'},
    intimidate: {label:'Запугать свидетеля',agent:'mark',cost:12000,ap:2,days:1,heat:32,kind:'witness'},
    forge: {label:'Заказать подложный документ',agent:'contact',cost:14000,ap:2,days:1,heat:26,kind:'document'}
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = value => Math.max(0,Math.min(100,value));
  const fresh = () => ({
    version:3,day:1,name:'Александр Ветров',rep:8,professional:5,shadow:0,heat:0,money:90000,debt:0,
    stage:1,wins:0,completed:[],active:null,ending:null,campaignComplete:false,training:false,
    office:0,assistant:false,suit:true,wear:0,illegalDays:[],investigation:null,
    transactions:[{day:1,account:'personal',name:'Стартовый капитал',amount:90000}],
    mail:[{day:1,from:'Секретарь',title:'Первое дело в пригороде',body:'Анна Лукина ищет защитника. Изучите её историю, отправьте предложение и начните подготовку. Дни меняются только по вашей команде.'}],
    news:[],chats:{mark:[],irina:[],contact:[]},unread:1,result:null,notice:'Выберите первое дело и предложите клиенту защиту.'
  });
  class Game {
    constructor(cases) { this.cases=cases; this.s=fresh(); this.career=null; }
    reset() { this.s=fresh(); this.career=null; this.lastRefusal=null; }
    get definition() { return this.s.active && this.cases.find(c=>c.id===this.s.active.id); }
    say(message,ok=true) { this.s.notice=message; return {ok,message}; }
    mail(from,title,body) { this.s.mail.unshift({day:this.s.day,from,title,body}); this.s.unread++; }
    log(account,name,amount) { this.s.transactions.unshift({day:this.s.day,account,name,amount}); }
    personal(name,amount) { this.s.money+=amount; this.log('personal',name,amount); }
    choices() { return this.cases.filter(c=>c.step===this.s.stage); }
    requirement(c) {
      const pair=this.cases.filter(x=>x.step===c.step);
      if(pair.length<2)return {rep:c.rating,professional:5+(c.step-1)*2};
      return pair[0]===c?{rep:0,professional:5+(c.step-1)*2}:{rep:c.rating,professional:0};
    }
    eligible(c) { const r=this.requirement(c); return this.s.rep>=r.rep && this.s.professional>=r.professional; }
    offer(id,probono=false) {
      const c=this.cases.find(x=>x.id===id);
      if(!c||this.s.active||this.s.ending||this.s.campaignComplete||c.step!==this.s.stage) return this.say('Это дело сейчас недоступно.',false);
      const clinicReferral=probono&&c.id===this.choices()[0]?.id;
      if(!this.eligible(c)&&!clinicReferral) {
        const r=this.requirement(c);
        const key=id+':'+this.s.rep+':'+this.s.professional;
        if(this.lastRefusal!==key) { const need=[r.rep?`известностью не ниже ${r.rep} (у вас ${this.s.rep})`:'',r.professional?`профессионализмом не ниже ${r.professional} (у вас ${this.s.professional})`:''].filter(Boolean).join(' и ');this.mail(c.client,'Отказ: «'+c.title+'»',`Мне нужен адвокат с ${need}. Возьмите другое дело этой главы.`); this.lastRefusal=key; }
        return this.say('Пришёл отказ клиента. Причина указана в почте.',false);
      }
      this.startCase(c,probono);
      this.mail(c.client,'Предложение принято',`Доверяю вам дело «${c.title}». ${c.objective} Слушание — день ${this.s.active.deadline}. ${probono?'Вы согласились работать без гонорара и за свой счёт.':'Бюджет на расходы отделён от вашего гонорара.'}`);
      return this.say('Клиент согласился. Откройте досье и запустите первое поручение.');
    }
    startCase(c,probono=false) {
      this.s.active={id:c.id,accepted:this.s.day,deadline:this.s.day+c.days,ap:c.ap,apMax:c.ap,
        budget:probono?0:c.budget,initialBudget:probono?0:c.budget,fee:probono?0:c.fee,probono,
        personalFunding:probono,invested:0,pending:[],done:[],materials:[],selection:[],manualPlan:false,line:'',
        approach:null,questions:[],protocol:[],profile:0,puzzleChoice:null,puzzleSolved:false,puzzleAttempted:false,
        postponed:false,phase:'prepare',courtChoice:null};
      this.s.result=null;
      this.addMaterial('initial','document',8,c.materials.initial.title,c.materials.initial.text,'Клиент');
      if(c.episode){this.s.active.ep={done:[],pending:[],facts:[],today:{day:this.s.day,mark:0,irina:0},witnesses:{},coordinated:[],noteFound:false,noteRestored:false,penalty:0};this.s.chats.irina.push({day:this.s.day,mine:false,text:'Жду улики для изучения.'});}
      else this.addMaterial('rumor','witness',-18,c.materials.rumor.title,c.materials.rumor.text,'Непроверенное сообщение',true);
      if(!probono) this.log('client','Получен бюджет: '+c.title,c.budget);
    }
    preparing() { const a=this.s.active; return !!a && a.phase==='prepare' && this.s.day<a.deadline && !this.s.ending; }
    planOpen() { const a=this.s.active; return !!a&&(this.s.day>=a.deadline-1||a.ap===0); }
    canSpend(ap) { return this.preparing()&&this.s.active.ap>=ap; }
    orderAp(o) { return o.agent==='irina'&&this.s.assistant?Math.max(1,o.ap-1):o.ap; }
    quote(key) {
      const o=ORDERS[key],a=this.s.active;
      if(!o||!a) return null;
      const cost=o.cost,client=Math.min(a.budget,cost),personal=cost-client;
      return {cost,client,personal,days:Math.max(1,o.days-(this.s.assistant&&o.agent==='irina'?1:0))};
    }
    orderBlock(key) {
      const a=this.s.active,o=ORDERS[key];
      if(!a||!o) return 'Сначала примите дело';
      if(a.ep) return 'В этом деле — свои поручения';
      if(!this.preparing()) return 'Подготовка завершена';
      if(a.done.includes(key)||a.pending.some(t=>t.key===key)) return 'Поручение уже выдано';
      if(a.ap<this.orderAp(o)) return 'Недостаточно ОД';
      if(a.pending.some(t=>ORDERS[t.key].agent===o.agent)) return 'Исполнитель занят';
      if(o.agent==='contact'&&this.s.stage<3&&!this.s.training) return 'Контакт появится в главе 3';
      const q=this.quote(key);
      if(this.s.day+q.days>a.deadline) return 'Не успеет к заседанию';
      if(q.personal&&!a.personalFunding) return 'Нужно разрешить личные вложения в банке';
      if(q.personal>this.s.money) return 'Не хватает личных средств';
      return '';
    }
    order(key) {
      const blocked=this.orderBlock(key); if(blocked) return this.say(blocked,false);
      const a=this.s.active,o=ORDERS[key],q=this.quote(key);
      a.ap-=this.orderAp(o);a.budget-=q.client;a.invested+=q.personal;
      if(q.client) this.log('client',o.label,-q.client);
      if(q.personal) this.personal(o.label,-q.personal);
      a.pending.push({key,due:this.s.day+q.days,started:this.s.day});
      this.s.chats[o.agent].push({day:this.s.day,mine:true,text:o.label+`. Срок: день ${this.s.day+q.days}.`});
      if(o.heat) this.illegal(o.heat);
      return this.say(`Поручение принято. Ответ придёт в день ${this.s.day+q.days}; пока можно поговорить со свидетелем.`);
    }
    addMaterial(id,kind,power,title,text,source,risky=false) {
      const a=this.s.active;if(!a||a.materials.some(m=>m.id===id)) return;
      a.materials.push({id,kind,power,title,text,source,risky,day:this.s.day});
    }
    completeTasks() {
      const a=this.s.active,c=this.definition;if(!a)return;
      if(a.ep){const due=a.ep.pending.filter(t=>t.due<=this.s.day);a.ep.pending=a.ep.pending.filter(t=>t.due>this.s.day);for(const t of due)this.epFinish(c.episode.orders.find(o=>o.id===t.id));if(due.length)this.say(`Готово поручений: ${due.length}. Результаты в досье, ответы — в телефоне.`);return;}
      const due=a.pending.filter(t=>t.due<=this.s.day);a.pending=a.pending.filter(t=>t.due>this.s.day);
      for(const t of due) {
        const o=ORDERS[t.key];a.done.push(t.key);let text;
        if(t.key==='profile'||t.key==='profileFull') {
          a.profile=Math.max(a.profile,t.key==='profile'?1:2);
          const traits={careful:'Внимателен к точности. Лучше дать рассказать своими словами.',nervous:'Тревожен. Спокойные уточнения помогают; давление приведёт к признанию вмешательства.',stubborn:'Независим. Попытка навязать показания вызовет отказ.'};
          text=`${c.witness.name}: ${traits[c.witness.trait]}${a.profile===2?' Важная деталь: '+c.witness.detail:''}`;
          a.protocol.push({q:o.label,a:text});
        } else if(['documents','observe','expert'].includes(t.key)) {
          const m=c.materials[t.key];text=m.text;
          this.addMaterial(t.key,o.kind,t.key==='observe'?16:t.key==='documents'?18:20,m.title,m.text,o.agent==='mark'?'Марк Волков':'Ирина Лебедева');
        } else {
          text=t.key==='forge'?'Получен спорный документ. При проверке происхождения он будет исключён.':t.key==='bribe'?'Свидетель изменил позицию. Его показания уязвимы при проверке.':'Свидетель подал жалобу на давление. Угроза не стала доказательством невиновности.';
          this.addMaterial(t.key,o.kind,t.key==='intimidate'?-10:12,o.label+': результат',text,'Закрытый контакт',true);
        }
        this.s.chats[o.agent].push({day:this.s.day,mine:false,text});
        this.mail(o.agent==='mark'?'Марк Волков':o.agent==='irina'?'Ирина Лебедева':'Закрытый контакт','Готово: '+o.label,text);
      }
      if(due.length) this.say(`Готово поручений: ${due.length}. Новые материалы в досье, ответы — в телефоне.`);
    }
    chooseApproach(approach) {
      const a=this.s.active;
      if(!this.canSpend(1)||a.ep||a.approach||!['free','guided','pressure'].includes(approach)) return this.say('Начать эту беседу сейчас нельзя.',false);
      a.approach=approach;
      if(approach==='pressure') this.illegal(14);
      a.protocol.push({q:'Начало беседы',a:approach==='free'?this.definition.witness.account:approach==='guided'?this.definition.witness.guided:'Вы предложили свидетелю согласовать удобную версию событий. Это создаёт риск для защиты.'});
      return this.say('Подход выбран. Каждый новый вопрос стоит 1 ОД; максимум восемь.');
    }
    question(key) {
      const a=this.s.active,c=this.definition;
      const labels={events:'Что вы видели лично?',time:'Когда это произошло?',detail:'Что подтверждает ваши слова?',conflict:'Как объяснить противоречие?',source:'Откуда вы это знаете?',certainty:'В чём вы не уверены?',review:'Сверить рассказ с новым документом',confirm:'Готовы повторить это в суде?'};
      if(!labels[key]||!this.canSpend(1)||a.ep||!a.approach||a.questions.includes(key)||a.questions.length>=8) return this.say('Вопрос недоступен или уже задан.',false);
      if(key==='review'&&!a.materials.some(m=>m.id==='documents'))return this.say('Сначала получите проверенный документ.',false);
      a.ap--;a.questions.push(key);
      const w=c.witness;
      const answer=key==='events'?w.account:key==='conflict'?w.contradiction:key==='certainty'?'Только о том, что видел лично. Чужие предположения подтверждать не буду.':key==='review'?w.detail+' После сверки уточняю предыдущий рассказ.':key==='confirm'?'Готов рассказать суду то, что помню. За чужие слова не ручаюсь.':w.detail;
      a.protocol.push({q:labels[key],a:answer});
      const weak=a.approach==='pressure';
      let power=Math.min(22,10+a.questions.length*3+(key==='review'?3:0));
      if(a.approach==='free'&&w.trait==='careful')power+=2;
      if(weak)power=w.trait==='stubborn'?-20:w.trait==='nervous'?-14:6;
      let material=a.materials.find(m=>m.id==='witness');
      if(!material){this.addMaterial('witness','witness',power,'Протокол: '+w.name,answer,'Беседа защиты',weak);material=a.materials.find(m=>m.id==='witness');}
      material.power=power;material.text=weak?(w.trait==='stubborn'?'Свидетель отказался выступать после попытки давления.':w.trait==='nervous'?'Свидетель готов сообщить суду о давлении.':'Свидетель согласовал показания; их надёжность снижена.'):answer;
      return this.say('Ответ сохранён в протоколе и досье. Осталось ОД: '+a.ap+'.');
    }
    puzzleSelect(index) {if(this.s.active&&!this.s.active.puzzleAttempted&&Number.isInteger(index)&&index>=0&&index<3)this.s.active.puzzleChoice=index;}
    solvePuzzle() {
      const a=this.s.active,c=this.definition;
      if(!this.canSpend(1)||a.puzzleAttempted||a.puzzleChoice===null)return this.say('Выберите ответ. Для анализа нужен 1 ОД.',false);
      a.ap--;a.puzzleAttempted=true;a.puzzleSolved=a.puzzleChoice===c.puzzle.answer;
      if(a.puzzleSolved)this.addMaterial('puzzle','document',6,'Заметка: найденная несостыковка',c.puzzle.explanation,'Личный анализ');
      return this.say((a.puzzleSolved?'Верно. Заметка добавлена в досье. ':'Бонус не получен. ')+c.puzzle.explanation);
    }
    toggleMaterial(id) {
      const a=this.s.active;if(!a||!this.planOpen()||a.phase!=='prepare'||!a.materials.some(m=>m.id===id))return this.say('План пока недоступен.',false);
      a.manualPlan=true;
      if(a.selection.includes(id))a.selection=a.selection.filter(x=>x!==id);
      else {if(a.selection.length===4)return this.say('В плане максимум четыре материала. Уберите один перед добавлением.',false);a.selection.push(id);}
      return this.say('План обновлён. Порядок можно изменить стрелками.');
    }
    setLine(line) {const a=this.s.active;if(a&&a.phase==='prepare'&&this.planOpen()&&['alibi','procedure','motive'].includes(line)){a.line=line;return this.say('Линия защиты выбрана.');}return this.say('План пока недоступен.',false);}
    move(id,delta) {const a=this.s.active;if(!a||!this.planOpen()||a.phase!=='prepare')return;const i=a.selection.indexOf(id),j=i+delta;if(i<0||j<0||j>=a.selection.length)return;[a.selection[i],a.selection[j]]=[a.selection[j],a.selection[i]];}
    plan() {const a=this.s.active;return a?(a.manualPlan?a.selection:a.materials.slice(0,4).map(m=>m.id)):[];}
    assessment(choice=null) {
      const a=this.s.active,c=this.definition;if(!a)return null;
      if(a.ep)return this.epAssessment(choice);
      const selected=this.plan().map(id=>a.materials.find(m=>m.id===id));
      const rows=[{label:'Базовая позиция клиента',value:8}];
      selected.forEach(m=>rows.push({label:m.title,value:m.power}));
      const line=a.line||'alibi';
      rows.push({label:line===c.bestLine?'Линия соответствует фактам':'Линия не объясняет ключевой факт',value:line===c.bestLine?10:-6});
      if(selected.some(m=>m.id==='documents')&&selected.some(m=>m.id==='observe'))rows.push({label:'Документ подтверждает хронологию',value:6});
      const doc=selected.findIndex(m=>m.id==='documents'),witness=selected.findIndex(m=>m.id==='witness');
      if(doc>=0&&witness>=0)rows.push({label:doc<witness?'Сначала факт, затем свидетель':'Свидетель выступает до подтверждения',value:doc<witness?4:-3});
      if(selected.some(m=>m.kind===c.judge.prefers&&!m.risky))rows.push({label:'Предпочтение судьи',value:3});
      if(a.postponed)rows.push({label:'Недовольство судьи переносом',value:-4});
      if(choice!==null)rows.push({label:choice===c.court.answer?'Точная реакция в суде':'Неубедительный ответ суду',value:choice===c.court.answer?8:-8});
      if(choice!==null&&selected.some(m=>m.id==='forge'))rows.push({label:'Подложный документ исключён',value:-28});
      const score=clamp(rows.reduce((sum,r)=>sum+r.value,0));
      return {score,target:c.target,won:score>=c.target,rows,selected:selected.map(m=>m.title),manual:a.manualPlan,line};
    }
    postpone() {
      const a=this.s.active;if(!a||a.phase!=='prepare'||a.postponed||this.definition.step<4||this.s.day>a.deadline||this.s.ending)return this.say('Перенос недоступен.',false);
      a.postponed=true;a.deadline+=2;a.fee=Math.round(a.fee*.8);
      this.mail('Канцелярия суда','Перенос согласован',`Новая дата: день ${a.deadline}. Гонорар уменьшен на 20%, итог защиты получит штраф 4 балла. Запас ОД не восстановлен.`);
      return this.say('Заседание перенесено на два дня. Повторный перенос невозможен.');
    }
    suitBonus() { return this.s.wear<45; }
    suitWorn() { return this.s.wear>=75&&!this.s.training; }
    beginCourt() {
      const a=this.s.active;if(!a||!this.planOpen()||a.phase!=='prepare'||this.s.ending)return this.say('Суд доступен после открытия плана.',false);
      if(this.suitWorn())return this.say(`Костюм изношен на ${this.s.wear}%: в таком виде в суд идти нельзя. Купите новый у зеркала.`,false);
      a.phase='court';a.courtChoice=null;return this.say('Судья задаёт вопрос по вашей защите.');
    }
    chooseCourt(index) {const a=this.s.active;if(!a||a.phase!=='court'||a.courtChoice!==null||!Number.isInteger(index)||index<0||index>2)return false;a.courtChoice=index;return true;}
    cancelCourt() {const a=this.s.active;if(a&&a.phase==='court'){a.phase='prepare';a.courtChoice=null;this.say('Вы вернулись к подготовке. Заседание можно начать снова.');}}
    finishCourt() {const a=this.s.active;if(!a||a.phase!=='court'||a.courtChoice===null)return false;this.resolve(false);return true;}
    resolve(late) {
      const a=this.s.active,c=this.definition;if(!a)return;
      const report=this.assessment(a.courtChoice),won=!late&&report.won;
      const suitBonus=!late&&this.suitBonus(),fee=Math.round(a.fee*(won?1:.4)),repGain=(won?7:3)+(a.probono?5:0)+(suitBonus?2:0),professionalGain=(won?6:2)+(suitBonus?1:0);
      if(a.budget)this.log('client','Остаток бюджета возвращён клиенту',-a.budget);
      this.personal('Гонорар: '+c.title,fee);
      this.s.rep=clamp(this.s.rep+repGain);this.s.professional=clamp(this.s.professional+professionalGain);this.s.wins+=won?1:0;
      if(a.probono)this.s.heat=Math.max(0,this.s.heat-12);
      if(!late)this.s.wear=Math.min(100,this.s.wear+15);
      const result={...report,id:c.id,title:c.title,won,late,fee,repGain,professionalGain,invested:a.invested,returned:a.budget,training:this.s.training,day:this.s.day,suitBonus};
      this.s.completed.push(result);this.s.result=result;this.s.active=null;
      this.mail(c.client,won?'Защита сработала':'Дело завершено',`${late?'Слушание пропущено.':won?'Задача защиты выполнена.':'Доводов оказалось недостаточно.'} Начислен гонорар ${fee.toLocaleString('ru-RU')} кр. Неиспользованный бюджет возвращён.`);
      this.s.news.unshift({day:this.s.day,title:(won?'Успех защиты: ':'Вердикт: ')+c.title,body:late?'Адвокат пропустил заседание.':c.objective+' Результат: '+(won?'цель достигнута.':'цель не достигнута.')});
      const bonus=a.ep&&c.episode.bonus;
      if(bonus&&won&&bonus.facts.every(id=>a.ep.facts.includes(id))){result.bonus=true;this.mail(bonus.mail.from,bonus.mail.title,bonus.mail.body);this.s.news.unshift({day:this.s.day,title:bonus.news.title,body:bonus.news.body});}
      if(!this.s.training) {this.s.stage++;if(this.s.stage>10)this.s.campaignComplete=true;}
      if(!late)this.advanceDay();
      this.say(won?'Дело выиграно. Разбор результата доступен на ноутбуке.':late?'Вы пропустили слушание. Дело проиграно.':'Дело проиграно. Разбор покажет, каких доводов не хватило.');
    }
    // Scripted cases (case.episode) describe their own orders, witnesses and facts.
    epToday() {const a=this.s.active;if(a.ep.today.day!==this.s.day)a.ep.today={day:this.s.day,mark:0,irina:0};return a.ep.today;}
    epWitness(id) {return this.definition?.episode?.witnesses.find(w=>w.id===id);}
    epFact(id) {const a=this.s.active;if(id&&!a.ep.facts.includes(id))a.ep.facts.push(id);}
    epOrderBlock(id) {
      const a=this.s.active,ep=this.definition?.episode,o=ep?.orders.find(x=>x.id===id);
      if(!a?.ep||!o)return 'Поручение недоступно';
      if(!this.preparing())return 'Подготовка завершена';
      if(a.ep.done.includes(id))return 'Уже выполнено';
      if(a.ep.pending.some(t=>t.id===id))return 'Поручение уже выдано';
      const missing=(o.requires||[]).find(r=>!a.ep.done.includes(r));
      if(missing)return 'Сначала: '+ep.orders.find(x=>x.id===missing).label.toLowerCase();
      if(a.ap<this.orderAp(o))return 'Недостаточно ОД';
      if((!ep.perDayAgent||o.agent===ep.perDayAgent)&&this.epToday()[o.agent]>=ep.perDay)return 'Сегодня уже '+ep.perDay+' поручения '+(o.agent==='mark'?'детективу':'этому исполнителю');
      if(this.s.day+o.days>a.deadline)return 'Не успеет к заседанию';
      return '';
    }
    epOrder(id) {
      const blocked=this.epOrderBlock(id);if(blocked)return this.say(blocked,false);
      const a=this.s.active,o=this.definition.episode.orders.find(x=>x.id===id);
      a.ap-=this.orderAp(o);this.epToday()[o.agent]++;
      this.s.chats[o.agent].push({day:this.s.day,mine:true,text:o.label+(o.days?`. Срок: день ${this.s.day+o.days}.`:'. Нужно сегодня.')});
      if(!o.days){this.epFinish(o);return this.say('Готово: '+o.label.toLowerCase()+'. Результат в досье.');}
      a.ep.pending.push({id,due:this.s.day+o.days,started:this.s.day});
      return this.say(`Поручение принято. Ответ придёт в день ${this.s.day+o.days}.`);
    }
    epFinish(o) {
      const a=this.s.active;a.ep.done.push(o.id);this.epFact(o.fact);if(o.note)a.ep.noteFound=true;
      this.s.chats[o.agent].push({day:this.s.day,mine:false,text:o.result});
      this.mail(o.agent==='mark'?'Марк Волков':'Ирина Лебедева','Готово: '+o.label,o.result);
    }
    epInterview(id,mode) {
      const a=this.s.active,w=this.epWitness(id),st=a?.ep?.witnesses[id],cost=mode==='free'?2:0;
      if(!w||!this.preparing()||!['free','ask'].includes(mode)||st?.mode)return this.say('Этот допрос сейчас недоступен.',false);
      if(a.ap<cost)return this.say('Недостаточно ОД.',false);
      a.ap-=cost;
      const record=a.ep.witnesses[id]=st||{mode:null,asked:[],log:[],port:false};
      record.mode=mode;record.log.push({q:w[mode].prompt,a:mode==='free'?w.free.answer:'Хорошо, спрашивайте.'});
      return this.say(mode==='free'?'Свидетель рассказал о событиях. Уточняющий вопрос — 1 ОД.':'Свидетель готов отвечать. Каждый вопрос — 1 ОД.');
    }
    epAsk(id,qid) {
      const a=this.s.active,w=this.epWitness(id),st=a?.ep?.witnesses[id];
      const q=st?.mode&&w[st.mode].questions.find(x=>x.id===qid);
      if(!q||!this.preparing()||st.asked.includes(qid))return this.say('Вопрос недоступен или уже задан.',false);
      if(a.ap<1)return this.say('Недостаточно ОД.',false);
      a.ap--;st.asked.push(qid);st.log.push({q:q.q,a:q.a});this.epFact(q.fact);
      return this.say('Ответ записан в протокол. Осталось ОД: '+a.ap+'.');
    }
    epPort(id) {
      const a=this.s.active,w=this.epWitness(id),st=a?.ep?.witnesses[id];
      if(!w||!st?.mode||!a.ep.noteRestored||st.port||!this.preparing())return this.say('Этот вопрос сейчас недоступен.',false);
      if(a.ap<1)return this.say('Недостаточно ОД.',false);
      a.ap--;st.port=true;st.log.push({q:'Вы бываете в районе Старого порта?',a:w.port.a});this.epFact(w.port.fact);
      return this.say('Ответ записан в протокол.');
    }
    epCoordinate(id) {
      const a=this.s.active,ep=this.definition?.episode,w=this.epWitness(id);
      if(!w||!a?.ep||!this.preparing()||a.ep.coordinated.includes(id)||!a.ep.witnesses[id]?.mode)return this.say('Это предложение сейчас недоступно.',false);
      if(a.ap<ep.coordinateAp)return this.say('Недостаточно ОД.',false);
      a.ap-=ep.coordinateAp;a.ep.coordinated.push(id);this.illegal(ep.coordinateHeat);a.ep.penalty+=w.coordinatePenalty||0;
      const record=a.ep.witnesses[id]=a.ep.witnesses[id]||{mode:null,asked:[],log:[],port:false};
      record.log.push({q:'Давайте согласуем ваши показания в суде.',a:w.coordinate});
      return this.say('Свидетель отказался. Попытка согласовать показания повышает внимание властей.',false);
    }
    restoreNote(order) {
      const a=this.s.active,note=this.definition?.episode?.note;
      if(!note||!a?.ep||!a.ep.noteFound||a.ep.noteRestored||!this.preparing()||!Array.isArray(order))return this.say('Записку сейчас не собрать.',false);
      const norm=t=>t.toLowerCase().replace(/[^а-яёa-z0-9]/g,'');
      if(norm(order.map(i=>note.pieces[i]||'').join(''))!==norm(note.text))return this.say('Текст пока не складывается.',false);
      a.ep.noteRestored=true;a.ap+=note.ap;this.epFact(note.fact);
      return this.say(`Записка восстановлена: «${note.text}». +${note.ap} ОД.`);
    }
    epScore() {const a=this.s.active,ep=this.definition.episode;return a.ep.facts.reduce((sum,id)=>sum+ep.facts[id].weight,0);}
    epAssessment(choice=null) {
      const a=this.s.active,c=this.definition,ep=c.episode,rows=a.ep.facts.map(id=>({label:ep.facts[id].title,value:ep.facts[id].weight}));
      const missing=ep.required.filter(id=>!a.ep.facts.includes(id));
      for(const id of missing)rows.push({label:'Не доказано: '+ep.facts[id].title.charAt(0).toLowerCase()+ep.facts[id].title.slice(1),value:0});
      if(a.ep.penalty)rows.push({label:'Свидетель сообщит суду о попытке согласовать показания',value:-a.ep.penalty});
      if(choice!==null&&choice!==c.court.answer)rows.push({label:'Неубедительный ответ суду',value:-10});
      const score=clamp(rows.reduce((sum,r)=>sum+r.value,0));
      return {score,target:c.target,won:score>=c.target&&!missing.length,rows,selected:a.ep.facts.map(id=>ep.facts[id].title),manual:true,line:c.bestLine,missing};
    }
    illegal(base) {
      const recent=this.s.illegalDays.filter(day=>this.s.day-day<10).length,delta=base+8*recent;
      this.s.illegalDays.push(this.s.day);this.s.heat=clamp(this.s.heat+delta);this.s.shadow=clamp(this.s.shadow+10);
      if(this.s.investigation)this.s.investigation.evidence=clamp(this.s.investigation.evidence+delta);
      else if(this.s.heat>=50) {this.s.investigation={evidence:this.s.heat,due:this.s.day+3,defended:false};this.mail('Следственный отдел','Расследование против адвоката','Повторяющиеся жалобы стали основанием проверки. Новое вмешательство усилит обвинение; простое ожидание не уничтожит собранные улики.');}
    }
    defend() {
      const p=this.s.investigation;
      if(!p||p.defended||this.s.money<25000||this.s.ending)return this.say('Независимая защита недоступна.',false);
      const a=this.s.active;
      this.personal('Независимый защитник',-25000);p.defended=true;p.evidence=Math.max(0,p.evidence-25);
      this.advanceDay();
      const missed=!!a&&this.s.active!==a&&!!this.s.result?.late;
      return this.say('Защитник проверил материалы: сила обвинения −25. Прошёл один день.'+(missed?' Слушание пропущено, дело проиграно.':''));
    }
    settleProbe() {
      const p=this.s.investigation;if(!p||this.s.day<p.due)return;
      this.s.investigation=null;
      if(p.evidence>=75) {this.s.ending='prison';this.mail('Суд','Практика закрыта','Вмешательство в показания доказано. Назначено тюремное заключение.');}
      else {if(p.evidence>=50){this.bill('Штраф по проверке',35000);this.s.rep=Math.max(0,this.s.rep-8);}this.mail('Следственный отдел',p.evidence>=50?'Назначен штраф':'Проверка закрыта',`Сила обвинения: ${p.evidence}/100. История прежних действий остаётся в материалах.`);}
    }
    weeklyCost() {return 3000+(this.s.office?4000:0)+(this.s.assistant?5000:0);}
    bill(label,amount) {const paid=Math.min(this.s.money,amount);if(paid)this.personal(label,-paid);if(paid<amount){this.s.debt+=amount-paid;this.mail('Банк','Задолженность по расходам',`${label}: не оплачено ${(amount-paid).toLocaleString('ru-RU')} кр. Долг можно погасить после поступления гонорара.`);}}
    advanceDay() {
      if(this.s.ending)return;
      this.s.day++;
      this.completeTasks();
      if(this.s.active?.ep&&this.s.day<=this.s.active.deadline)this.s.active.ap+=this.definition.episode.apPerDay;
      if((this.s.day-1)%7===0)this.bill('Аренда и персонал за неделю',this.weeklyCost());
      this.settleProbe();
      const a=this.s.active;
      if(a&&this.s.day>a.deadline&&!this.s.ending)this.resolve(true);
    }
    nextDay() {if(this.s.ending||this.s.active?.phase==='court')return false;this.say('Наступил следующий игровой день.');this.advanceDay();return true;}
    buy(item) {
      if(this.s.training||this.s.ending)return this.say('Управление карьерой сейчас недоступно.',false);
      const prices={office:30000,assistant:18000,suit:12000};
      const price=prices[item];
      if(!price||(item==='office'&&this.s.office)||(item==='assistant'&&this.s.assistant)||(item==='suit'&&this.s.wear===0))return this.say('Уже приобретено или не требуется.',false);
      if(item==='office'&&this.s.completed.length<2)return this.say('Офис доступен после двух дел.',false);
      if(item==='assistant'&&!this.s.office)return this.say('Для помощника нужен офис.',false);
      if(this.s.money<price||(this.s.debt&&item!=='suit'))return this.say(item==='suit'?'Не хватает личных средств.':'Нужны личные средства без задолженности.',false);
      this.personal({office:'Открытие офиса',assistant:'Наём помощника эксперта',suit:'Новый деловой костюм'}[item],-price);
      if(item==='office')this.s.office=1;else if(item==='assistant')this.s.assistant=true;else {this.s.suit=true;this.s.wear=0;}
      return this.say('Покупка оплачена с личного счёта. Расходы обновлены в банке.');
    }
    payDebt() {const amount=Math.min(this.s.money,this.s.debt);if(amount){this.personal('Погашение задолженности',-amount);this.s.debt-=amount;}return this.say(this.s.debt?'Остаток долга: '+this.s.debt+' кр.':'Задолженность погашена.');}
    training(id) {
      if(!this.s.campaignComplete||this.s.active||this.s.investigation||this.s.training||this.s.ending||!this.s.completed.some(c=>c.id===id))return this.say('Повтор доступен после кампании и завершения расследования.',false);
      const c=this.cases.find(c=>c.id===id);this.career=clone(this.s);this.s=fresh();this.s.training=true;this.s.stage=c.step;this.startCase(c);return this.say('Тренировка: её расходы и результат не изменят карьеру.');
    }
    leaveTraining() {if(!this.career)return;this.s=this.career;this.career=null;this.say('Вы вернулись в карьеру. Ресурсы остались прежними.');}
  }
  const api={Game,ORDERS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else globalThis.GoodLawyer=api;
})();
