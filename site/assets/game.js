/* View and controls; career rules live in engine.js, authored stories in cases.js. */
(() => {
  'use strict';
  const {Game,ORDERS}=globalThis.GoodLawyer;
  const game=new Game(globalThis.GOOD_LAWYER_CASES);
  const root=document.getElementById('good-lawyer'), $=s=>root.querySelector(s);
  const assetScript=document.currentScript,portrait=assetScript.dataset.portrait,videoSource=assetScript.dataset.video;
  // Judge Mironova's verdict clips (HeyGen): played after the defence film, chosen by the court outcome.
  const verdicts={
    acquit:{src:assetScript.dataset.verdictAcquit,length:3.29,quoteAt:2.08,quote:'Подсудимый невиновен.',label:'Судья объявляет: подсудимый невиновен'},
    guilty:{src:assetScript.dataset.verdictGuilty,length:3.03,quoteAt:2.02,quote:'Подсудимый виновен.',label:'Судья объявляет: подсудимый виновен'}
  };
  const clock=t=>{t=Math.max(0,Math.floor(t));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');};
  const plural=(n,one,few,many)=>{const d=n%10,h=n%100;return d===1&&h!==11?one:d>=2&&d<=4&&(h<12||h>14)?few:many;};
  const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' кр.';
  const btn=(text,action,cls='secondary',disabled=false)=>`<button class="${cls}" data-action="${action}" ${disabled?'disabled':''}>${text}</button>`;
  const names={mark:'Марк Волков',irina:'Ирина Лебедева',contact:'Закрытый контакт'};
  const roles={mark:'Частный детектив',irina:'Эксперт',contact:'Теневые поручения'};
  const districtArt={'Пригород':'suburb','Старый порт':'port','Речной район':'river','Деловой квартал':'business','Правительственный холм':'hill'};
  const art=c=>'assets/images/district-'+(districtArt[c?.district]||'hill')+'.jpg';
  const artPos=c=>['50% 55%','28% 50%','72% 50%','50% 35%','38% 65%','62% 40%'][Number(String(c?.no||0).replace(/\D/g,''))%6];
  const stars=c=>{const n=Math.max(1,Math.min(5,Math.ceil(c.rating/16)));return `<span class="stars" aria-label="Рейтинг дела ${n} из 5">${'★'.repeat(n)}<i>${'★'.repeat(5-n)}</i></span>`;};
  const lines={alibi:'Алиби',procedure:'Ошибка в материалах',motive:'Иная версия событий'};
  const kinds={document:'Документ',witness:'Показания',physical:'Вещественное'};
  const questions={events:'Что вы видели лично?',time:'Когда это произошло?',detail:'Что подтверждает ваши слова?',conflict:'Как объяснить противоречие?',source:'Откуда вы это знаете?',certainty:'В чём вы не уверены?',review:'Сверить с новым документом',confirm:'Готовы повторить в суде?'};
  let ui={desk:'overview',phone:'chat',agent:'mark',device:'laptop',allTransactions:false,room:true,focus:null,district:null,witness:null,noteLine:[]},started=false,screen='menu',movieToken=0,finishMovie=null;
  function empty(title='Пока нет активного дела',body='Выберите дело и отправьте предложение клиенту на вкладке «Дела».') {return `<div class="empty"><span class="eyebrow">Ваша практика</span><h3>${title}</h3><p>${body}</p>${btn('Выбрать дело →','cases','primary')}</div>`;}
  function steps() {return `<div class="step-list" aria-label="Прогресс кампании">${Array.from({length:10},(_,i)=>`<span class="step-dot ${i+1<game.s.stage?'done':i+1===game.s.stage?'current':''}" title="Глава ${i+1}">${i+1<game.s.stage?'✓':i+1}</span>`).join('')}</div>`;}
  function tutorial() {
    const a=game.s.active,c=game.definition;if(!a||c.step!==1)return '';
    if(a.ep){const text=!a.ep.done.length&&!a.ep.pending.length?'Клиент утверждает, что невиновна. Докажите её невиновность. Поручения — в телефоне; детективу — не больше двух в день.':!Object.values(a.ep.witnesses).some(w=>w.mode)?'Справка о свидетеле может подсказать, какую тактику допроса лучше выбрать: дать человеку рассказать самому или задавать вопросы. Но решение остаётся за Вами. Допросы — на вкладке «Свидетель».':!game.planOpen()?'Каждый новый день даёт +'+c.episode.apPerDay+' ОД. За день до суда откроется подготовка к заседанию.':'Подготовка к заседанию открыта. Когда будете готовы, идите в суд.';return `<div class="hint"><strong>Первое дело / </strong>${text}</div>`;}
    const text=!a.pending.length&&!a.done.length?'Начните с поручений: Ирина проверит документы, Марк — перемещения. Пока они работают, поговорите со свидетелем.':!a.questions.length?'Поручения в работе. На вкладке «Свидетель» выберите спокойный подход и задайте несколько вопросов.':!game.planOpen()?'Новые ответы и документы появятся после перехода дня. За день до суда откроется план защиты.':'План открыт. Включите проверенные документы, запись перемещений и протокол свидетеля. Поставьте документ перед показаниями.';
    return `<div class="hint"><strong>Первое дело / </strong>${text}</div>`;
  }
  function caseCard(c) {
    const r=game.requirement(c),accessible=game.eligible(c);
    return `<article class="case-card ${c.step===1?'tutorial':''}"><img class="case-art" src="${art(c)}" style="object-position:${artPos(c)}" alt="" loading="lazy"><div><div class="case-id"><span class="eyebrow">Дело № ${safe(c.no)} / ${safe(c.district)}</span><span class="tag ${accessible?'green':''}">${accessible?'Доступно':r.rep>game.s.rep?'Нужна известность':'Нужен профессионализм'}</span></div><h3>${safe(c.title)}</h3><p class="case-type"><span class="tag">${safe(c.type)}</span>${stars(c)}</p><p>${safe(c.story)}</p><p class="goal">Клиент: ${safe(c.client)}<br>Задача: ${safe(c.objective)}</p><dl><div><dt>Гонорар за успех</dt><dd>${money(c.fee)}</dd></div><div><dt>Бюджет клиента</dt><dd>${money(c.budget)}</dd></div><div><dt>Подготовка</dt><dd>${c.ap} ОД · ${c.days} ${plural(c.days,'день','дня','дней')}</dd></div><div><dt>Требования</dt><dd>${[r.rep?'Известность '+r.rep:'',r.professional?'Профессионализм '+r.professional:''].filter(Boolean).join(' · ')||'Нет'}</dd></div></dl><div class="case-actions"><button class="primary" data-offer="${c.id}">Предложить защиту →</button><button class="text-button" data-probono="${c.id}">Помочь бесплатно · за свой счёт</button>${!accessible&&c.id===game.choices()[0]?.id?'<p class="small">Юридическая клиника направит это дело бесплатно, даже если профессионализма пока не хватает.</p>':''}</div></div></article>`;
  }
  // The overview mirrors a working day: the case that matters now, the city, the queue and the mail.
  function overviewView() {
    const s=game.s,a=s.active,c=game.definition,offers=a||s.campaignComplete||s.ending?[]:game.choices(),lead=c||offers[0];
    const hero=lead?`<article class="ov-hero"><img src="${art(lead)}" style="object-position:${artPos(lead)}" alt=""><div class="ov-hero-text"><span class="tag red">${a?(s.day>=a.deadline?'Заседание сегодня':'Главное сегодня'):s.stage===1?'Первое дело':'Новое предложение'}</span><h3>${safe(lead.title)}</h3><p>${safe(a?lead.objective:lead.story)}</p><button class="ov-more" data-action="${a?'dossier':'cases'}">${a?'Открыть досье':'Читать дальше'} →</button></div></article>`
      :s.ending?`<article class="ov-hero"><img src="assets/images/district-hill.jpg" alt=""><div class="ov-hero-text"><span class="tag red">Практика закрыта</span><h3>Теперь вы — подзащитный</h3><p>Следствие доказало вмешательство в показания.</p></div></article>`:`<article class="ov-hero"><img src="assets/images/district-hill.jpg" alt=""><div class="ov-hero-text"><span class="tag">Кампания завершена</span><h3>Город знает ваше имя</h3><p>Выиграно ${s.wins} из ${s.completed.length} дел. Разборы и тренировки — в архиве.</p><button class="ov-more" data-room-view="archive">Открыть архив →</button></div></article>`;
    const queue=(a?[c]:offers).map(x=>`<div class="ov-case"><img src="${art(x)}" style="object-position:${artPos(x)}" alt="" loading="lazy"><div class="ov-case-title"><strong>${safe(x.title)}</strong><small>${safe(x.type)} · ${safe(x.district)}</small></div><div class="ov-case-rating"><small>Рейтинг дела</small>${stars(x)}</div><div class="ov-case-fee"><small>Гонорар</small><b>${money(a?a.fee:x.fee)}</b></div>${a?'<button class="secondary" data-room-view="plan">План защиты</button>':`<button class="secondary" data-offer="${x.id}">Предложить защиту</button>`}</div>`).join('')||'<p class="hint">Новых предложений нет.</p>';
    const mail=s.mail.slice(0,2).map(m=>`<div class="ov-mail-item"><small>${safe(m.from)} · день ${m.day}</small><strong>${safe(m.title)}</strong><p>${safe(m.body.length>96?m.body.slice(0,94)+'…':m.body)}</p></div>`).join('');
    return `<div class="overview"><div class="ov-top">${hero}<section class="ov-map"><span class="eyebrow">Влияние в городе</span>${cityMap({compact:true})}</section></div><div class="ov-bottom"><section class="ov-queue"><div class="ov-head"><span class="eyebrow">${a?'Дело в работе':'Предстоящие дела'}</span><button class="text-button" data-room-view="cases">Все дела →</button></div>${queue}</section><section class="ov-mail"><div class="ov-head"><span class="eyebrow">Почта</span><button class="text-button" data-room-view="mail">Все письма →</button></div>${mail}</section></div></div>`;
  }
  function casesView() {
    const s=game.s,a=s.active,c=game.definition;
    if(a)return `<div class="eyebrow">В работе / № ${safe(c.no)} / ${safe(c.type)}</div><h2 class="section-title">${safe(c.title)}</h2><p class="section-lead">${safe(c.story)}</p>${tutorial()}<div class="profile"><span class="eyebrow">Рассказ клиента · ${safe(c.client)}</span><h3>«Мне нужна ваша защита»</h3><p>${safe(c.objective)}</p><p style="margin-top:10px">${a.probono?'Бесплатная помощь: расходы на вас.':`Гонорар ${money(a.fee)}; при неудаче — 40%.`} Слушание: день ${a.deadline}. ${a.ep?'Сейчас '+a.ap+' ОД, каждый новый день +'+c.episode.apPerDay+'.':'Запас на всё дело: '+a.apMax+' ОД.'}</p></div>${tasksView()}<div class="choices">${btn('Открыть материалы дела →','dossier','primary')}${btn('Подготовить свидетеля →','witness')}${btn('Открыть поручения на телефоне →','phone')}</div>${steps()}`;
    if(s.campaignComplete)return `<div class="eyebrow">Кампания завершена / Северный берег</div><h2 class="section-title">Город знает ваше имя.</h2><p class="section-lead">Вы прошли десять глав и стали городским адвокатом. Выиграно ${s.wins} из ${s.completed.length} дел. Теперь можно проверить другой подход к завершённому делу: тренировка не изменит ресурсы карьеры.</p>${s.investigation?'<div class="hint warning">Расследование ещё продолжается. Дождитесь решения перед тренировкой.</div>':''}${steps()}<div class="section-head" style="margin-top:24px"><h3>Архив дел</h3><span class="tag">Тренировочные повторы</span></div><div class="materials">${s.completed.map(r=>`<article class="material"><div class="material-top"><h3>${safe(r.title)}</h3><span class="tag">${r.won?'Успех':'Неудача'} · ${r.score}%</span></div><button class="text-button" data-training="${r.id}" ${s.investigation?'disabled':''}>Переиграть без изменения карьеры →</button></article>`).join('')}</div><p class="section-lead" style="margin-top:22px">В этой версии доступна первая кампания. Продолжение, свободная игра и совместные дела описаны в плане развития.</p>`;
    return `<div class="eyebrow">Северный берег / глава ${s.stage} из 10</div><h2 class="section-title">${s.stage===1?'Первое дело. Ваше имя.':'Какое дело станет вашим?'}</h2><p class="section-lead">${s.stage===1?'В пригороде вас ещё почти не знают. Начните с небольшого дела: выслушайте клиента и соберите защиту.':'Выберите одно из двух дел. Второй путь останется для нового прохождения. Клиент ответит на предложение в почте.'}</p><div class="case-grid">${game.choices().map(caseCard).join('')}</div>${s.result?btn('Разбор предыдущего дела →','result','text-button'):''}${steps()}`;
  }
  function tasksView() {const a=game.s.active;if(a?.ep)return epTasks();if(!a?.pending.length)return '';return `<div class="section-head"><h3>Поручения в работе</h3><span class="tag">${a.pending.length}</span></div><div class="task-list">${a.pending.map(t=>`<div class="task"><div>${ORDERS[t.key].label}<small>${names[ORDERS[t.key].agent]} · ответ в день ${t.due}</small></div><span class="tag">${t.due-game.s.day} дн.</span></div>`).join('')}</div>`;}
  function materialCard(m,inPlan=false) {const a=game.s.active,selected=a.selection.includes(m.id);return `<article class="material ${m.risky?'risky':''} ${inPlan&&selected?'selected':''}"><div class="material-top"><h3>${safe(m.title)}</h3><span class="tag ${m.risky?'red':''}">${m.risky?'Спорный источник':kinds[m.kind]}</span></div><p>${safe(m.text)}</p><p><small>${safe(m.source)} · день ${m.day}</small></p>${inPlan?`<button class="${selected?'primary':'secondary'}" data-material="${m.id}" aria-pressed="${selected}">${selected?'✓ В плане · убрать':'+ Включить в план'}</button>`:''}</article>`;}
  function dossierView() {const a=game.s.active,c=game.definition;if(!a)return empty();return `<div class="eyebrow">Досье / ${safe(c.client)}</div><h2 class="section-title">Материалы дела</h2><p class="section-lead">${safe(c.objective)} В суд попадут только материалы плана. Не каждое найденное утверждение надёжно.</p>${tutorial()}${tasksView()}<div class="materials">${a.materials.map(m=>materialCard(m)).join('')}</div><section class="puzzle"><span class="eyebrow">Блокнот / необязательный анализ</span><h3>Найти несостыковку</h3><p>${safe(c.puzzle.prompt)}</p>${a.puzzleAttempted?`<div class="hint ${a.puzzleSolved?'':'warning'}">${a.puzzleSolved?'Верно. Заметка добавлена в досье.':'Ответ не подтвердился. Бонус не получен.'}<br>${safe(c.puzzle.explanation)}</div>`:`<div class="choices">${c.puzzle.options.map((o,i)=>`<button class="option" data-puzzle="${i}" aria-pressed="${a.puzzleChoice===i}" ${!game.canSpend(1)?'disabled':''}><span class="letter">${i+1}</span>${safe(o)}</button>`).join('')}</div><div class="choice-footer">${btn('Проверить · 1 ОД','solve','secondary',!game.canSpend(1)||a.puzzleChoice===null)}</div><p class="small" style="margin-top:12px">Одна попытка. Можно переключать вкладки: выбранный ответ сохранится.</p>`}</section>${btn('Перейти к плану защиты →','plan','text-button')}`;}
  function witnessView() {
    const a=game.s.active,c=game.definition;if(!a)return empty();const witnessMaterial=a.materials.find(m=>m.id==='witness');const trait={careful:'Внимательный. Лучше свободный рассказ, затем проверка фактов.',nervous:'Тревожный. Спокойные вопросы помогают; давление может обернуться жалобой.',stubborn:'Независимый. Навязывание версии приведёт к отказу выступать.'};
    return `<div class="eyebrow">Подготовка показаний</div><h2 class="section-title">Свидетель защиты</h2><p class="section-lead">Подход меняет надёжность показаний. Сначала можно поручить Марку собрать справку о человеке.</p><div class="profile"><span class="eyebrow">Приглашён защитой</span><h3>${safe(c.witness.name)}</h3><p>${a.profile?safe(trait[c.witness.trait]):'Справка ещё не получена. Вы знаете только рассказ клиента.'}</p>${a.profile===2?`<p style="margin-top:10px">${safe(c.witness.detail)}</p>`:''}</div>${witnessMaterial?.risky?`<div class="hint warning">${safe(witnessMaterial.text)}</div>`:''}${!a.approach?`<div class="approaches"><button class="approach" data-approach="free" ${!game.canSpend(1)?'disabled':''}><strong>Расскажите своими словами</strong><small>Точные воспоминания. Меньше контроля над версией.</small></button><button class="approach" data-approach="guided" ${!game.canSpend(1)?'disabled':''}><strong>Ответьте на мои вопросы</strong><small>Уточнить детали и сопоставить их с материалами.</small></button><button class="approach risky" data-approach="pressure" ${!game.canSpend(1)?'disabled':''}><strong>Согласуем удобные показания</strong><small>Теневой метод. Риск отказа или признания давления; внимание властей растёт.</small></button></div>`:`<div class="section-head"><h3>Вопросы · ${a.questions.length} / 8</h3><span class="tag">По 1 ОД</span></div><div class="hint">Подход: ${a.approach==='free'?'свободный рассказ':a.approach==='guided'?'направляющие вопросы':'давление'}. Протокол обновляется после каждого нового ответа.</div><div class="question-grid">${Object.entries(questions).map(([key,label])=>`<button data-question="${key}" ${!game.canSpend(1)||a.questions.includes(key)||(key==='review'&&!a.done.includes('documents'))?'disabled':''}>${a.questions.includes(key)?'✓ ':''}${label}</button>`).join('')}</div>`}<div class="protocol"><div class="section-head"><h3>Протокол беседы</h3></div>${a.protocol.length?a.protocol.map(p=>`<article class="protocol-item"><strong>${safe(p.q)}</strong><p>${safe(p.a)}</p></article>`).join(''):'<p class="section-lead">Здесь сохранятся ответы и справки детектива.</p>'}</div><div class="hint warning" style="margin-top:20px">Свидетеля обвинения заранее опрашивать нельзя. Его показания рассматриваются только на заседании.</div>`;
  }
  function planView() {
    const a=game.s.active,c=game.definition;if(!a)return empty();
    if(!game.planOpen())return `<div class="eyebrow">Судебное заседание / день ${a.deadline}</div><h2 class="section-title">Сначала — подготовка.</h2><p class="section-lead">План откроется в день ${a.deadline-1}, за сутки до суда, или раньше при нуле ОД. До этого собирайте материалы и готовьте свидетеля.</p>${tasksView()}${btn('Открыть досье →','dossier','primary')}${c.step>=4&&!a.postponed?`<div class="hint" style="margin-top:20px">Один перенос: +2 дня, −20% гонорара и −4 балла к итогу. ОД не восстанавливаются.<br>${btn('Перенести заседание','postpone','text-button')}</div>`:''}`;
    const assessment=game.assessment(),plan=game.plan();
    return `<div class="eyebrow">Подготовка к заседанию</div><h2 class="section-title">Ваша линия защиты</h2>${suitWarning()}<p class="section-lead">Судья ${safe(c.judge.name)}. ${safe(c.judge.hint)} ${a.pending.length?'Часть поручений ещё в работе: если пойти в суд сейчас, их материалы не будут учтены.':''}</p><div class="plan-lines">${Object.entries(lines).map(([key,label])=>`<button data-line="${key}" aria-pressed="${a.line===key}">${label}</button>`).join('')}</div>${!a.line?'<div class="hint warning">Линия не выбрана: по умолчанию адвокат заявит алиби.</div>':''}<div class="section-head"><h3>Порядок выступления</h3><span class="tag">${plan.length} / 4 материала</span></div>${!a.manualPlan?'<div class="hint warning">План не составлен. Суд получит первые четыре материала в порядке поступления — включая непроверенные. Выберите карточки ниже, чтобы собрать свою защиту.</div>':''}<div class="plan-order">${plan.length?plan.map((id,i)=>{const m=a.materials.find(m=>m.id===id);return `<div class="plan-row"><span>0${i+1}</span><span>${safe(m.title)}</span>${a.manualPlan?`<button data-up="${id}" aria-label="Поднять ${safe(m.title)}" ${i===0?'disabled':''}>↑</button><button data-down="${id}" aria-label="Опустить ${safe(m.title)}" ${i===plan.length-1?'disabled':''}>↓</button>`:''}</div>`;}).join(''):'<p class="section-lead">Вы пока не выбрали ни одного материала.</p>'}</div><div class="plan-estimate"><div><span class="eyebrow" style="color:#c7d2b8">Оценка плана</span><p>Для успеха нужно ${c.target}.<br>Ответ в суде и проверка спорных материалов изменят итог.</p></div><strong>${assessment.score}<span style="font:12px Arial"> / 100</span></strong></div><div class="materials">${a.materials.map(m=>materialCard(m,true)).join('')}</div>${a.postponed?'<p class="section-lead" style="margin-top:20px">Перенос уже использован. Итог защиты получит штраф 4 балла.</p>':c.step>=4?`<div class="hint" style="margin-top:20px">Перенос: +2 дня, −20% гонорара, −4 балла к итогу. Один раз за дело.<br>${btn('Перенести заседание','postpone','text-button')}</div>`:''}`;
  }
  function careerView() {
    const s=game.s,status=s.campaignComplete?'Городской адвокат':'Начинающий адвокат';
    return `<div class="eyebrow">Карьера / ${status}</div><h2 class="section-title">Имя, которое вы строите.</h2><p class="section-lead">Известность привлекает клиентов, профессионализм подтверждает опыт. Теневая репутация отражает методы. Внимание властей копится и снижается только бесплатной защитой.</p><label class="eyebrow" for="name-input">Ваше имя</label><form id="name-form" class="name-form"><input id="name-input" maxlength="40" value="${safe(s.name)}" required aria-label="Имя адвоката"><button class="secondary" type="submit">Сохранить</button></form><div class="career-stats"><div><b>${s.wins}/${s.completed.length}</b><span>Выиграно дел</span></div><div><b>${s.shadow}</b><span>Теневая репутация</span></div><div><b>${s.wear}%</b><span>Износ костюма</span></div></div><div class="section-head"><h3>Районы Новореченска</h3></div><div class="map">${['Пригород','Старый порт','Речной район','Деловой квартал','Холм'].map((label,i)=>`<div class="district ${s.stage>=1+i*2?'open':''}">${label}<br><small>Глава ${1+i*2}</small></div>`).join('')}</div><div class="career-grid"><article class="career-card"><h3>Свой офис</h3><p>Место для помощника. Открытие — 30 000 кр.; аренда дороже на 4 000 кр. в неделю. Доступен после двух дел.</p>${btn(s.office?'Офис открыт':'Открыть офис','buy-office','secondary',!!s.office||s.completed.length<2||s.training)}</article><article class="career-card"><h3>Помощник эксперта</h3><p>Каждое поручение Ирине на 1 ОД дешевле и на день быстрее. Наём — 18 000 кр.; зарплата — 5 000 кр. в неделю.</p>${btn(s.assistant?'В штате':'Нанять помощника','buy-assistant','secondary',s.assistant||!s.office||s.training)}</article><article class="career-card"><h3>Деловой костюм</h3><p>Каждое дело изнашивает костюм на 15%. Пока износ меньше 45%, костюм даёт +2 известности и +1 профессионализма за дело. При износе 75% в суд в нём идти нельзя.</p><p>Износ: ${s.wear}%</p>${btn('Новый костюм · 12 000 кр.','buy-suit','secondary',s.wear===0||s.training)}</article><article class="career-card"><h3>Содержание практики</h3><p>Следующее списание: день ${nextBill()}. Всего ${money(game.weeklyCost())} за семь игровых дней. Расходы видны в банке.</p>${btn('Открыть банк →','bank','secondary')}</article></div><div class="hint">В этой кампании вы ведёте одно дело. Персонал расширяет очередь поручений. Другие города, несколько дел одновременно и коллегии — следующие этапы.</div>`;
  }
  function newsView() {return `<div class="eyebrow">Городская хроника</div><h2 class="section-title">Что происходит за окном.</h2>${game.s.news.map(n=>`<article class="news"><small>ДЕНЬ ${n.day} / ВАША ПРАКТИКА</small><h3>${safe(n.title)}</h3><p>${safe(n.body)}</p></article>`).join('')}<article class="news"><small>ГОРОД / РАССЛЕДОВАНИЕ</small><h3>Чей берег — Северный?</h3><p>Название холдинга всё чаще появляется в спорах пригорода и порта. Отдельные дела могут оказаться частями одной истории.</p></article><article class="news"><small>ОБЩЕСТВО / ЮРИДИЧЕСКАЯ КЛИНИКА</small><h3>Помощь тем, кто не может заплатить</h3><p>Бесплатная защита повышает известность и снижает внимание властей. Все расходы адвокат оплачивает сам. Собранные улики действующего расследования сохраняются.</p></article>`;}
  function mailView() {return `<div class="eyebrow">Входящие / ${game.s.mail.length} ${plural(game.s.mail.length,'письмо','письма','писем')}</div><h2 class="section-title">Почта практики</h2>${game.s.active?btn('Открыть активное досье →','dossier','primary'):btn('Выбрать следующее дело →','cases','primary')}${game.s.mail.map(m=>`<article class="mail"><small>${safe(m.from)} / ДЕНЬ ${m.day}</small><h3>${safe(m.title)}</h3><p>${safe(m.body)}</p></article>`).join('')}`;}
  function resultView(r=game.s.result,showActions=true) {
    if(!r)return empty('Результатов пока нет','Первый разбор появится после заседания.');
    return `<div class="eyebrow">${r.training?'Тренировочный ':''}Итог заседания</div><div class="result-hero ${r.won?'':'fail'}"><div><h2 class="section-title">${r.late?'Слушание пропущено.':r.won?'Защита сработала.':'Доводов не хватило.'}</h2><p class="section-lead" style="margin:0">${safe(r.title)}</p></div><div><span class="result-score">${r.score}%</span><small>Цель: ${r.target}%</small></div></div>${r.late?'<div class="hint warning">Дело проиграно из-за пропуска заседания независимо от качества подготовки.</div>':''}<div class="section-head"><h3>Из чего сложился результат</h3></div>${r.rows.map(row=>`<div class="result-row"><span>${safe(row.label)}</span><b class="${row.value<0?'negative':''}">${row.value>0?'+':''}${row.value}</b></div>`).join('')}<div class="result-finance">Гонорар: <strong>${money(r.fee)}</strong><br>Известность +${r.repGain} · профессионализм +${r.professionalGain}${r.suitBonus?' (костюм: +2 и +1)':''}<br>Личные вложения: ${money(r.invested)}<br>Возвращено клиенту: ${money(r.returned)}${r.training?'<br><strong>Все изменения относятся только к тренировке. Карьера сохранена.</strong>':''}</div>${showActions?(r.training?btn('Вернуться в карьеру →','leave-training','primary'):btn(game.s.campaignComplete?'Открыть итоги кампании →':'Следующая глава →','cases','primary')):''}`;
  }
  function nextBill(){return 1+7*(Math.floor((game.s.day-1)/7)+1);}
  const initials={mark:'МВ',irina:'ИЛ',contact:'••'};
  const orderIcons={documents:'dossier',observe:'eye',expert:'evidence',profile:'witness',profileFull:'witness',bribe:'coins',intimidate:'warning',forge:'notes'};
  function phoneView() {
    const s=game.s,a=s.active;
    if(ui.phone==='bank')return `<div class="bank"><span class="eyebrow">Личный расчётный счёт</span><div class="balance">${money(s.money)}</div><div class="bank-card">КАПИТАЛ / ЧАСТНАЯ ПРАКТИКА<span>•••• 0418 &nbsp; Новореченский банк</span></div>${a?`<div class="budget-card"><span class="eyebrow">Бюджет клиента / отдельно</span><b>${money(a.budget)}</b><p>Получено ${money(a.initialBudget)}. Остаток после суда вернётся клиенту. Личные вложения: ${money(a.invested)}.</p><label class="funding"><input id="personal-funding" type="checkbox" ${a.personalFunding?'checked':''}><span>Разрешить оплату сверх бюджета с личного счёта</span></label><p>Перед поручением показано, сколько спишется с каждого счёта.</p></div>`:''}<div class="bill-info">Расходы за неделю: ${money(game.weeklyCost())}<br>Аренда ${money(s.office?7000:3000)} · персонал ${money(s.assistant?5000:0)}<br>Следующее списание: день ${nextBill()}${s.debt?`<br><strong>Задолженность: ${money(s.debt)}</strong><br>${btn('Погасить долг','debt','text-button',!s.money)}`:''}</div><div class="section-head"><span class="eyebrow">История операций</span></div>${(ui.allTransactions?s.transactions:s.transactions.slice(0,8)).map(t=>`<div class="transaction"><div>${safe(t.name)}<small>День ${t.day} · ${t.account==='personal'?'Личный счёт':'Бюджет клиента'}</small></div><span class="${t.amount<0?'out':''}">${t.amount>0?'+':''}${money(t.amount)}</span></div>`).join('')}${s.transactions.length>8?btn(ui.allTransactions?'Свернуть историю':'Все операции','transactions','transactions-toggle'):''}</div>`;
    const contacts=['mark','irina',...(s.stage>=3||s.training?['contact']:[])];
    if(!contacts.includes(ui.agent))ui.agent='mark';
    const busyOf=k=>a?.pending.filter(t=>ORDERS[t.key].agent===k).length||0;
    if(ui.phone==='contacts')return `<div class="contact-list">${contacts.map(k=>{const last=s.chats[k].slice(-1)[0],busy=busyOf(k);return `<button class="contact-row" data-agent="${k}"><span class="avatar">${initials[k]}</span><span class="contact-copy"><strong>${names[k]}</strong><small>${busy?'В работе: '+busy:roles[k]}</small>${last?`<em>${safe(last.text)}</em>`:''}</span><b aria-hidden="true">›</b></button>`;}).join('')}</div><p class="phone-tip">Исполнители работают параллельно вашей подготовке. Результат приходит при смене дня.</p>`;
    const agent=ui.agent,busy=busyOf(agent),chat=s.chats[agent].slice(-4);
    const orders=Object.entries(ORDERS).filter(([,o])=>o.agent===agent);
    return `<div class="chat-head"><button class="chat-back" data-phone="contacts" aria-label="Все контакты">‹</button><span class="avatar">${initials[agent]}</span><div class="contact-copy"><select id="agent-select" aria-label="Исполнитель">${contacts.map(k=>`<option value="${k}" ${agent===k?'selected':''}>${names[k]}</option>`).join('')}</select><small>${busy?`В работе: ${busy}`:roles[agent]+(agent==='irina'&&s.assistant?' + помощник':'')}</small></div></div><div class="chat">${chat.length?chat.map(m=>`<div class="bubble ${m.mine?'mine':''}">${safe(m.text)}<small>${m.mine?'Вы':'Получено'} · день ${m.day}</small></div>`).join(''):`<div class="bubble">${a?'Готов принять поручение. Результаты появятся после перехода дня.':'Сначала заключите договор с клиентом. Затем сможем начать работу.'}<small>${names[agent]}</small></div>`}</div><div class="orders"><div class="eyebrow">Варианты действий${a?' · дело № '+safe(game.definition.no):''}</div>${a?.ep?epOrderList(agent):orders.map(([key,o])=>{const q=game.quote(key),blocked=game.orderBlock(key);return `<button class="order ${o.heat?'illegal':''}" data-order="${key}" ${blocked?'disabled':''}><span class="order-icon">${roomIcon(orderIcons[key])}</span><span class="order-text"><strong>${o.label}</strong><small>${money(o.cost)} · ${game.orderAp(o)} ОД · ${q?q.days:o.days} дн.${q&&q.personal?' · ваши '+money(q.personal):''}</small>${blocked?`<small class="order-block">${safe(blocked)}</small>`:''}</span>${o.heat?`<span class="risk-pill">Внимание +${o.heat}</span>`:''}</button>`;}).join('')}${a?.ep&&!game.definition.episode.orders.some(o=>o.agent===agent)?'<p class="phone-tip">В этом деле поручений этому исполнителю нет.</p>':''}</div><div class="phone-balance"><div class="phone-balance-head"><span>Счёт</span><b>${money(s.money)}</b></div>${s.transactions.slice(0,3).map(t=>`<div class="transaction"><div>${safe(t.name)}<small>День ${t.day}</small></div><span class="${t.amount<0?'out':''}">${t.amount>0?'+':''}${money(t.amount)}</span></div>`).join('')}<button class="text-button" data-action="bank">Финансы и бюджет дела →</button></div><p class="phone-tip">${a?.ap===0?'ОД закончились. Дождитесь запущенных поручений, составьте план и идите в суд.':'Поручения идут параллельно вашей подготовке. У каждого исполнителя своя очередь.'}</p>`;
  }
  let roomSettings={quality:'auto',motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,newsPaused:false},caseNotes={},archivedId=null,archivePage=0,archiveRenderKey=null,pendingArchiveFocus=false;
  const roomIcons={
    cases:'M5 7h14v14H5z M8 3v7 M16 3v7 M5 12h14',dossier:'M3 7h7l2 3h9v10H3z M3 7V4h7l2 3',witness:'M8 10a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 22v-2a8 8 0 0 1 16 0v2',evidence:'M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M15 15l7 7 M7 9h6 M10 6v6',actions:'M4 5h16v14H4z M8 2v6 M16 2v6 M8 12l3 3l5-5',notes:'M4 3h14v18H4z M8 7h6 M8 11h5 M8 15h4 M19 5l3 3-6 6-3 1 1-3z',plan:'M3 5h7v5H3z M14 15h7v5h-7z M6 10v8h8 M17 3v7 M14 7l3 3 3-3',mail:'M3 5h18v14H3z M3 6l9 7 9-7',bank:'M3 8l9-6 9 6z M5 10v9 M10 10v9 M15 10v9 M20 10v9 M2 22h20',settings:'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M10 2h4l1 4 3-1 3 4-3 3 3 3-3 4-3-1-1 4h-4l-1-4-3 1-3-4 3-3-3-3 3-4 3 1z',shop:'M4 8h16l-1 13H5z M8 8V6a4 4 0 0 1 8 0v2',archive:'M3 3h18v5H3z M5 8v13h14V8 M9 12h6',city:'M3 5l6-3 6 3 6-3v17l-6 3-6-3-6 3z M9 2v17 M15 5v17',wardrobe:'M9 3l3 2 3-2 6 4-3 5-2-1v11H8V11l-2 1-3-5z',chat:'M3 3h18v14H9l-6 5z M7 7h10 M7 11h7',career:'M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M4 22v-3a8 8 0 0 1 16 0v3',overview:'M12 3v17 M6 21h12 M4 7h16 M7 7l-3 7a3 3 0 0 0 6 0z M17 7l-3 7a3 3 0 0 0 6 0z',news:'M4 5h13v15H4z M17 8h3v10a2 2 0 0 1-2 2 M7 9h7 M7 13h7 M7 16h4',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',coins:'M4 7a8 3 0 1 0 16 0a8 3 0 1 0-16 0 M4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7 M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',warning:'M12 3l10 18H2z M12 10v5 M12 18v1',map:'M3 5l6-3 6 3 6-3v17l-6 3-6-3-6 3z M9 2v17 M15 5v17'};
  function roomIcon(key){key=({laptop:'cases',phone:'chat'})[key]||key;return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${roomIcons[key]||roomIcons.dossier}"/></svg>`;}
  const laptopSurface=$('.laptop'),phoneSurface=$('.phone-inner');
  for(const b of root.querySelectorAll('.desk-nav [data-desk]'))b.insertAdjacentHTML('afterbegin',roomIcon(b.dataset.desk));
  for(const b of root.querySelectorAll('.phone-nav [data-phone]'))b.insertAdjacentHTML('afterbegin',roomIcon({chat:'chat',contacts:'witness',bank:'bank'}[b.dataset.phone]));
  const laptopHome=laptopSurface.parentElement,phoneHome=phoneSurface.parentElement;
  let viewScroll={},lastDeskKey=null,lastPhoneKey=null;
  function spatialAvailable(){return !!globalThis.OfficeRoom&&!globalThis.OfficeRoom.diagnostics().fallback;}
  function selectDevice(device){ui.device=device;ui.focus=device;ui.room=spatialAvailable();}
  function openRoomView(view){
    if(view==='room'){ui.room=true;ui.focus=null;return;}
    if(view==='laptop'||view==='phone'){selectDevice(view);return;}
    if(view==='archive'){archivedId=null;navigate('archive');return;}
    if(view==='city'||view==='map'){if(spatialAvailable()&&globalThis.OfficeRoom.diagnostics().map){ui.room=true;ui.focus='map';}else navigate('city');return;}
    if(view==='chat'||view==='bank'){ui.phone=view;selectDevice('phone');}
    else {navigate(view);if(view==='actions')ui.phone='chat';}
  }
  function syncDeviceSurfaces(){
    const embedded=ui.room&&spatialAvailable();
    const laptopParent=embedded?$('#room-laptop-workspace'):laptopHome;
    const phoneParent=embedded?$('#room-phone-workspace'):phoneHome;
    if(laptopSurface.parentElement!==laptopParent)laptopParent.append(laptopSurface);
    if(phoneSurface.parentElement!==phoneParent)phoneParent.append(phoneSurface);
    $('#room-laptop-home').hidden=embedded&&ui.focus==='laptop';
    $('#room-laptop-workspace').hidden=!embedded||ui.focus!=='laptop';
    $('#room-phone-workspace').hidden=!embedded||ui.focus!=='phone';
    $('.phone-wake').hidden=embedded&&ui.focus==='phone';
    $('#room-focus-bar').hidden=!ui.room||!ui.focus;
    $('#room-focus-title').textContent=({phone:'Личная линия',laptop:'Рабочий ноутбук',archive:'Архив завершённых дел',map:'Карта Новореченска'}[ui.focus]||'Кабинет')+' · день '+game.s.day+(game.s.active?' · '+game.s.active.ap+' ОД':'');
    for(const button of $('#room-focus-bar').querySelectorAll('[data-room-view]'))button.setAttribute('aria-pressed',String(button.dataset.roomView===ui.focus));
    globalThis.OfficeRoom?.setFocus(ui.room?ui.focus:null);
  }
  window.addEventListener('office:unavailable',()=>{
    if(ui.room&&ui.focus){
      if(ui.focus==='archive'){ui.desk=archivedId?'archiveDetail':'archive';ui.device='laptop';ui.focus='laptop';}
      if(ui.focus==='map'){ui.desk='city';ui.device='laptop';ui.focus='laptop';}
      ui.room=false;render();
    }
  });
  function renderRoom(){
    const s=game.s,a=s.active,c=game.definition;
    $('#room-day').textContent=s.day;$('#room-rep').textContent=s.rep;$('#room-ap').textContent=a?(a.ep?a.ap+' ОД':a.ap+' / '+a.apMax):'—';$('#room-money').textContent=money(s.money);
    $('#room-case-summary').textContent=c?`Дело № ${c.no} · ${c.title} · заседание в день ${a.deadline}`:s.campaignComplete?'Северный берег завершён. Дела и ваша история — в архиве.':'Каждое дело начинается за этим столом.';
    const tiles=[['dossier','Досье','Документы клиента'],['witness','Свидетели','Беседы и показания'],['evidence','Улики','Собранные материалы'],['actions','Поручения','Работа исполнителей'],['notes','Блокнот','Заметки и анализ'],['plan','План защиты','Ваша позиция в суде']];
    const lead=c||(!s.campaignComplete&&!s.ending?game.choices()[0]:null);
    $('#room-laptop-home').innerHTML=`<div class="os-top"><span class="os-seal">ХА</span><span class="os-brand">Хороший адвокат</span><span class="os-stat">Известность <b>${s.rep}</b></span><span class="os-stat">Счёт <b>${money(s.money)}</b></span><span class="os-stat ${s.heat>=50?'hot':''}">Внимание <b>${s.heat}%</b></span></div><div class="os-body"><div class="os-apps">${tiles.map(([key,title,sub])=>`<button data-room-view="${key}" class="os-app">${roomIcon(key)}<strong>${title}</strong><span>${sub}</span></button>`).join('')}</div><button class="os-current" data-room-view="cases">${lead?`<img src="${art(lead)}" style="object-position:${artPos(lead)}" alt="">`:''}<span>${c?(a.deadline<=s.day?'ЗАСЕДАНИЕ СЕГОДНЯ':'ГЛАВНОЕ СЕГОДНЯ · ДЕЛО № '+safe(c.no)):lead?'НОВОЕ ДЕЛО · '+safe(lead.district).toUpperCase():'СЕВЕРНЫЙ БЕРЕГ'}</span><strong>${lead?safe(lead.title):'Архив вашей практики'}</strong><em>${lead?safe(c?c.objective:lead.story):'Кампания завершена. Разборы и тренировки ждут в архиве.'}</em><b>↗</b></button></div><nav class="os-dock" aria-label="Программы ноутбука">${[['mail','Почта'+(s.unread?' · '+s.unread:'')],['bank','Финансы'],['settings','Настройки'],['shop','Магазин']].map(([key,title])=>`<button data-room-view="${key}">${roomIcon(key)}<span>${title}</span></button>`).join('')}</nav><div class="os-bottom"><span><i>Справедливость — не идеал. Это работа.</i></span><span>День ${s.day}${a?' · '+a.ap+' ОД':''}</span><button data-room-day="true" ${!a&&!s.investigation?'disabled':''}>${a&&s.day>=a.deadline?'Срок суда истекает':'Следующий день'} →</button></div>`;
    $('#room-mobile-programs').innerHTML=tiles.map(([key,title,sub])=>`<button data-room-view="${key}">${roomIcon(key)}<strong>${title}</strong></button>`).join('')+`<div class="room-mobile-dock">${[['mail','Почта'],['bank','Финансы'],['settings','Настройки'],['shop','Магазин']].map(([key,title])=>`<button data-room-view="${key}">${roomIcon(key)}<strong>${title}</strong></button>`).join('')}</div>`;
    $('#room-shortcuts').innerHTML=[['laptop','Ноутбук','Дела и подготовка'],['dossier','Папка дела','Текущие материалы'],['archive','Архив','История практики'],['phone','Телефон','Связь с детективами'],['notes','Перьевая ручка','Ваш блокнот'],['wardrobe','Зеркало','Одежда и имидж'],['career','Профиль','Развитие практики'],['city','Карта города','Влияние и районы']].map(([key,title,sub])=>`<button data-room-view="${key}">${roomIcon(key)}<span><strong>${title}</strong><small>${sub}</small></span><b>↗</b></button>`).join('');
    if(!$('#room-object-labels').childElementCount){
      const labels=[['Laptop','laptop','Ноутбук · дела и подготовка'],['Bookshelf','archive','Архивный шкаф · история практики'],['Phone','phone','Телефон · переписка и банк'],['Mirror','wardrobe','Зеркало · деловой имидж'],['CityMap','city','Карта Новореченска · влияние'],['Lawyer','career','Профиль адвоката'],['FolderCurrent','dossier','Папка текущего дела'],['FolderArchive','archive','Архив завершённых дел'],['FountainPen','notes','Перьевая ручка · блокнот']];
      $('#room-object-labels').innerHTML=labels.map(([object,view,title])=>`<button class="room-object-label" data-object="${object}" data-room-view="${view}" hidden><span aria-hidden="true"></span>${title}</button>`).join('');
    }
    const news=s.news.slice(0,3).map(n=>n.title).join('   /   ')||'Холдинг «Северный берег» расширяет влияние в городе.   /   Юридическая клиника ищет защитников для жителей пригорода.';
    $('#room-news-text').textContent=news;$('#room-news-text').style.animationPlayState=roomSettings.newsPaused||!roomSettings.motion?'paused':'running';$('#room-news-pause').setAttribute('aria-pressed',String(roomSettings.newsPaused));$('#room-news-pause').textContent=roomSettings.newsPaused?'▶':'Ⅱ';$('#room-news-pause').setAttribute('aria-label',roomSettings.newsPaused?'Продолжить бегущую строку':'Приостановить бегущую строку');
    $('#room-alert').hidden=!s.investigation;
    if(s.investigation)$('#room-alert').innerHTML=`<strong>Расследование против вас.</strong> Сила обвинения ${s.investigation.evidence}/100. Решение в день ${s.investigation.due}. <button data-room-view="cases">Открыть материалы →</button>`;
    root.dataset.roomMotion=String(roomSettings.motion);
    globalThis.OfficeRoom?.mount({viewport:$('#room-viewport'),canvasHost:$('#room-webgl'),cssHost:$('#room-css3d'),screenElement:$('#room-screen'),phoneElement:$('#room-phone-screen'),archiveElement:$('#room-archive-shelves'),mapElement:$('#room-map-screen'),onOpen:view=>{if(screen==='game'&&$('#overlay').hidden){openRoomView(view);render();}},quality:roomSettings.quality});
    globalThis.OfficeRoom?.sync();
  }
  function evidenceView(){const a=game.s.active;if(!a)return empty();const materials=a.materials.filter(m=>m.id!=='witness');return `<div class="eyebrow">Дело № ${safe(game.definition.no)} / Улики</div><h2 class="section-title">Что подтверждено фактами.</h2><p class="section-lead">Проверяйте источник и связь с задачей клиента. Неподтверждённое сообщение может ослабить защиту. Для суда выберите материалы в плане.</p>${tasksView()}<div class="materials">${materials.map(m=>materialCard(m)).join('')}</div>${btn('Открыть план защиты →','plan','primary')}`;}
  function actionsView(){const a=game.s.active;if(!a)return empty();return `<div class="eyebrow">Фоновая работа / ${a.ap} ОД</div><h2 class="section-title">Следственные действия</h2><p class="section-lead">Исполнители работают параллельно вашей подготовке. Поручения расходуют ОД и бюджет; результат приходит в назначенный игровой день.</p>${tasksView()}<div class="room-action-grid">${Object.entries(ORDERS).filter(([,o])=>o.agent!=='contact'||game.s.stage>=3||game.s.training).map(([key,o])=>{const q=game.quote(key),blocked=game.orderBlock(key);return `<article class="material ${o.heat?'risky':''}"><div class="material-top"><h3>${o.label}</h3><span class="tag ${o.heat?'red':''}">${o.heat?'Незаконно':'Законно'}</span></div><p>${names[o.agent]} · ${money(o.cost)} · ${o.ap} ОД · ${q.days} дн.<br>Бюджет клиента ${money(q.client)}; ваши средства ${money(q.personal)}.</p><button class="secondary" data-order="${key}" ${blocked?'disabled':''}>${blocked||'Дать поручение →'}</button></article>`;}).join('')}</div>${btn('Открыть переписку →','phone','text-button')}`;}
  function notesView(){const a=game.s.active;if(!a)return empty('Блокнот ждёт первое дело','Примите дело: здесь можно будет записать свою версию событий и проверить несостыковку.');const c=game.definition,key=(game.s.training?'training:':'career:')+a.id;return `<div class="eyebrow">Личный блокнот / ${safe(c.client)}</div><h2 class="section-title">Мысли, которые стоит сохранить.</h2><p class="section-lead">Заметки не тратят ОД. Они остаются в текущей сессии при переходах между кабинетом и разделами.</p><label class="room-field-label" for="case-notes">Ваши заметки по делу</label><textarea id="case-notes" data-note-key="${key}" rows="7" maxlength="4000" placeholder="Версия событий, вопросы свидетелю, порядок выступления…">${safe(caseNotes[key]||'')}</textarea><p id="notes-state" class="section-lead">Сохраняется в этой сессии.</p><section class="puzzle"><span class="eyebrow">Анализ / необязательный бонус</span><h3>Найти несостыковку</h3><p>${safe(c.puzzle.prompt)}</p>${a.puzzleAttempted?`<div class="hint ${a.puzzleSolved?'':'warning'}">${a.puzzleSolved?'Заметка добавлена в досье.':'Бонус не получен.'}<br>${safe(c.puzzle.explanation)}</div>`:`<div class="choices">${c.puzzle.options.map((answer,i)=>`<button class="option" data-puzzle="${i}" aria-pressed="${a.puzzleChoice===i}" ${!game.canSpend(1)?'disabled':''}>${safe(answer)}</button>`).join('')}</div>${btn('Проверить · 1 ОД','solve','secondary',a.puzzleChoice===null||!game.canSpend(1))}`}</section>`;}
  function archiveView(){const s=game.s;return `<div class="eyebrow">Архив / ${s.completed.length} дел</div><h2 class="section-title">История вашей практики.</h2><p class="section-lead">Здесь хранятся результаты процессов. После завершения кампании доступны тренировочные повторы без изменения карьерных ресурсов.</p>${s.completed.length?`<div class="materials">${s.completed.map(r=>`<article class="material"><div class="material-top"><h3>${safe(r.title)}</h3><span class="tag ${r.won?'green':'red'}">${r.won?'Успех':'Неудача'} · ${r.score}%</span></div><p>День ${r.day} · гонорар ${money(r.fee)}</p><button class="secondary" data-archive-id="${r.id}">Разбор заседания →</button>${s.campaignComplete?`<button class="text-button" data-training="${r.id}" ${s.investigation?'disabled':''}>Переиграть без изменения карьеры →</button>`:''}</article>`).join('')}</div>`:'<div class="hint">Первая папка появится после завершения дела.</div>'}${btn('К доступным делам →','cases','primary')}`;}
  function renderArchive(){
    const s=game.s,visible=ui.room&&ui.focus==='archive'&&spatialAvailable();
    const shelves=$('#room-archive-shelves'),controls=$('#room-archive-controls'),detail=$('#room-archive-detail');
    const pages=Math.max(1,Math.ceil(s.completed.length/6));archivePage=Math.max(0,Math.min(pages-1,archivePage));
    const record=s.completed.find(r=>r.id===archivedId);
    shelves.hidden=controls.hidden=!visible;detail.hidden=!visible||!record;
    shelves.inert=controls.inert=!!record;
    $('#room-viewport').dataset.archiveOpen=String(visible&&!!record);
    const key=JSON.stringify([s.completed,archivePage,record?.id,s.campaignComplete,!!s.investigation]);
    if(key===archiveRenderKey)return;
    archiveRenderKey=key;
    const entries=s.completed.slice(archivePage*6,archivePage*6+6);
    shelves.innerHTML=entries.length?`<div class="archive-folder-grid">${entries.map((r,i)=>`<button class="archive-folder ${r.won?'won':'lost'}" data-archive-id="${safe(r.id)}" aria-label="Открыть дело: ${safe(r.title)}. ${r.won?'Успех':'Неудача'}, ${r.score}%"><span class="archive-folder-number">ДЕЛО / ${String(archivePage*6+i+1).padStart(2,'0')}</span><strong>${safe(r.title)}</strong><span class="archive-folder-outcome">${r.won?'Успех':'Неудача'} · ${r.score}%</span><span class="archive-folder-day">День ${r.day} <b aria-hidden="true">↗</b></span></button>`).join('')}</div>`:`<div class="archive-empty"><span class="archive-empty-icon" aria-hidden="true">${roomIcon('archive')}</span><h2>История вашей практики</h2><p>Первая папка появится здесь после завершения дела.</p><button class="secondary" data-room-view="cases">К доступным делам →</button></div>`;
    controls.innerHTML=`<div class="archive-caption"><strong>Архив практики</strong><span>${s.completed.length?`Завершено дел: ${s.completed.length}. Выберите папку.`:'Здесь будут храниться завершённые дела.'}</span></div>${pages>1?`<nav class="archive-pages" aria-label="Страницы архива"><button data-archive-page="-1" ${archivePage===0?'disabled':''} aria-label="Предыдущие папки">←</button><span role="status">${archivePage+1} / ${pages}</span><button data-archive-page="1" ${archivePage===pages-1?'disabled':''} aria-label="Следующие папки">→</button></nav>`:''}`;
    detail.innerHTML=record?`<header class="archive-document-header"><div><span class="eyebrow">Архив · день ${record.day}</span><h2 id="archive-document-title" tabindex="-1">${safe(record.title)}</h2></div><button class="secondary" data-action="archive-close">← К папкам</button></header><div class="archive-document-body" tabindex="0" aria-label="Разбор завершённого дела">${resultView(record,false)}${s.campaignComplete?`<button class="secondary" data-training="${safe(record.id)}" ${s.investigation?'disabled':''}>Переиграть без изменения карьеры →</button>`:''}</div>`:'';
  }
  window.addEventListener('office:focusend',e=>{
    if(e.detail.device==='archive'&&pendingArchiveFocus&&screen==='game'){
      pendingArchiveFocus=false;($('#room-archive-shelves button')||$('#room-focus-bar [data-room-view="archive"]'))?.focus({preventScroll:true});
    }
  });
  function archivedView(){const record=game.s.completed.find(r=>r.id===archivedId);return record?`<button class="text-button" data-room-view="archive">← Вернуться в архив</button>${resultView(record)}`:archiveView();}
  const DISTRICTS=[
    {key:'suburb',name:'Пригород',from:1,desc:'Первые клиенты, тихие дворы и дела, о которых пишут только в домовом чате.',poly:'58,72 330,46 374,214 304,340 66,302',label:[188,186],slots:[[120,126],[262,112],[142,258],[262,262]]},
    {key:'port',name:'Старый порт',from:3,desc:'Склады, контейнеры и первые следы, ведущие к холдингу «Северный берег».',poly:'452,430 622,392 842,352 900,470 772,590 522,574',label:[676,482],slots:[[560,456],[716,428],[800,494],[640,540]]},
    {key:'river',name:'Речной район',from:5,desc:'Набережные и редакции. Здесь люди знают слишком много.',poly:'334,216 520,190 568,360 452,428 304,340',label:[440,300],slots:[[400,252],[484,240],[380,350],[504,352]]},
    {key:'business',name:'Деловой квартал',from:7,desc:'Деньги, документы и репутация. Ошибка в подписи стоит миллионы.',poly:'542,160 802,128 846,330 612,384 570,330',label:[702,252],slots:[[620,208],[748,190],[652,326],[786,302]]},
    {key:'hill',name:'Правительственный холм',from:9,desc:'Суд, архивы и кабинеты. Последние звенья истории.',poly:'560,34 922,34 882,118 550,152',label:[734,86],slots:[[616,80],[826,70],[700,124],[880,96]]}];
  const STREETS='M0 120L1000 70M0 236L1000 196M0 398L1000 352M0 520L1000 470M120 0L170 620M262 0L300 620M600 0L640 620M760 0L800 620M900 0L950 620M40 40L480 600M520 20L980 440';
  function districtState(d){const s=game.s,c=game.definition,chapter=s.campaignComplete?11:s.stage;if(chapter<d.from&&!s.completed.some(r=>game.cases.find(x=>x.id===r.id)?.district===d.name))return 'locked';if(c?c.district===d.name:!s.campaignComplete&&chapter>=d.from&&chapter<d.from+2)return 'current';return 'open';}
  function cityMap({compact=false,tall=false}={}) {
    // The wall frame is taller than the laptop panel: the same districts get more water and land around them.
    const s=game.s,c=game.definition,byDistrict={},vy=tall?-140:0,vh=tall?900:620,gid='map-glow-'+(compact?'c':tall?'t':'f');
    for(const r of s.completed){const name=game.cases.find(x=>x.id===r.id)?.district;(byDistrict[name]=byDistrict[name]||[]).push(r);}
    const shapes=DISTRICTS.map(d=>`<polygon class="map-zone ${districtState(d)} ${ui.district===d.key?'selected':''}" points="${d.poly}"/>`).join('');
    const marks=DISTRICTS.map(d=>(byDistrict[d.name]||[]).slice(0,4).map((r,i)=>`<circle class="map-mark ${r.won?'won':'lost'}" cx="${d.slots[i][0]}" cy="${d.slots[i][1]}" r="${compact?10:9}"><title>${safe(r.title)}: ${r.won?'успех':'неудача'}</title></circle>`).join('')).join('');
    const now=c&&DISTRICTS.find(d=>d.name===c.district);
    const pin=now?`<g class="map-now"><circle cx="${now.label[0]}" cy="${now.label[1]-34}" r="20" class="map-now-pulse"/><circle cx="${now.label[0]}" cy="${now.label[1]-34}" r="8" class="map-now-dot"/></g>`:'';
    const buttons=DISTRICTS.map(d=>`<button class="map-district ${districtState(d)} ${ui.district===d.key?'selected':''}" data-district="${d.key}" style="left:${d.label[0]/10}%;top:${(d.label[1]-vy)/vh*100}%" aria-label="${d.name}${districtState(d)==='locked'?', откроется с главы '+d.from:''}">${d.name}${compact?'':`<small>${districtState(d)==='locked'?'с главы '+d.from:'главы '+d.from+'–'+(d.from+1)}</small>`}</button>`).join('');
    return `<div class="city-map ${compact?'compact':''}" style="aspect-ratio:1000/${vh}"><svg viewBox="0 ${vy} 1000 ${vh}" role="img" aria-label="Карта районов Новореченска"><defs><radialGradient id="${gid}" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#16302b"/><stop offset="1" stop-color="#08100e"/></radialGradient></defs><rect y="${vy}" width="1000" height="${vh}" fill="url(#${gid})"/><path class="map-streets" d="${STREETS}"/><path class="map-bay" d="M1000 430C930 470 880 540 800 620L780 ${vy+vh}H1000Z"/><path class="map-river" d="M380 ${vy}L396 0C420 110 352 200 410 296S548 420 592 500 690 588 760 620L790 ${vy+vh}"/>${shapes}${marks}${pin}</svg>${buttons}<ul class="map-legend"><li><i class="lg-open"></i>Ваше влияние</li><li><i class="lg-now"></i>Текущее дело</li><li><i class="lg-won"></i>Выиграно</li><li><i class="lg-lost"></i>Проиграно</li></ul></div>`;
  }
  function districtPanel(){
    const s=game.s,a=s.active,c=game.definition,d=DISTRICTS.find(x=>x.key===ui.district)||DISTRICTS.find(x=>districtState(x)==='current')||DISTRICTS[0],state=districtState(d);
    const done=s.completed.filter(r=>game.cases.find(x=>x.id===r.id)?.district===d.name);
    const offers=!a&&!s.campaignComplete?game.choices().filter(x=>x.district===d.name):[];
    return `<aside class="district-panel ${state}"><span class="eyebrow">Район · ${state==='locked'?'откроется с главы '+d.from:'главы '+d.from+'–'+(d.from+1)}</span><h3>${d.name}</h3><p>${d.desc}</p>${a&&c.district===d.name?`<div class="district-item now"><small>Дело в работе</small><strong>${safe(c.title)}</strong><button class="text-button" data-room-view="dossier">Открыть досье →</button></div>`:''}${offers.map(x=>`<div class="district-item"><small>Предложение · ${money(x.fee)}</small><strong>${safe(x.title)}</strong><button class="text-button" data-room-view="cases">К делам главы →</button></div>`).join('')}${done.map(r=>`<div class="district-item ${r.won?'won':'lost'}"><small>День ${r.day} · ${r.won?'успех':'неудача'} · ${r.score}%</small><strong>${safe(r.title)}</strong></div>`).join('')}${state==='locked'?'<p class="hint">Район откроется, когда карьера дойдёт до его главы.</p>':!done.length&&!offers.length&&!(a&&c.district===d.name)?'<p class="hint">Завершённых дел здесь пока нет.</p>':''}</aside>`;
  }
  function cityView(){const s=game.s;return `<div class="eyebrow">Новореченск / ${s.campaignComplete?'кампания завершена':'глава '+s.stage+' из 10'}</div><h2 class="section-title">Влияние в городе.</h2><div class="city-layout">${cityMap()}${districtPanel()}</div>`;}
  function renderMap(){
    const s=game.s,visible=ui.room&&ui.focus==='map'&&spatialAvailable()&&!!globalThis.OfficeRoom.diagnostics().map,screenEl=$('#room-map-screen');
    screenEl.hidden=!visible;if(!visible)return;
    screenEl.innerHTML=`<div class="map-wall"><header class="map-wall-head"><div><span class="eyebrow">Новореченск · ${s.campaignComplete?'кампания завершена':'глава '+s.stage+' из 10'}</span><h2>Влияние в городе</h2></div><div class="map-wall-stats"><span>Известность <b>${s.rep}</b></span><span>Профессионализм <b>${s.professional}</b></span><span class="${s.heat>=50?'hot':''}">Внимание <b>${s.heat}/100</b></span></div></header><div class="city-layout">${cityMap({tall:true})}${districtPanel()}</div></div>`;
  }
  // Chapter 1 follows the episode script: its own orders, three witnesses, a torn note and facts.
  const epIcons={cameras:'eye',search:'evidence',study_club:'eye',study_bus:'eye',deep_club:'evidence',deep_bus:'evidence'};
  const epVisible=o=>(o.requires||[]).every(r=>game.s.active.ep.done.includes(r));
  function epOrderList(agent){const list=game.definition.episode.orders.filter(o=>o.agent===agent&&epVisible(o));return list.length?list.map(epOrderButton).join(''):`<p class="phone-tip">${agent==='irina'?'Ирина ждёт материалов для изучения.':'Сейчас поручений нет.'}</p>`;}
  function epOrderButton(o){const blocked=game.epOrderBlock(o.id),done=game.s.active.ep.done.includes(o.id);return `<button class="order ${done?'done':''}" data-ep-order="${o.id}" ${blocked?'disabled':''}><span class="order-icon">${roomIcon(epIcons[o.id]||(o.id.startsWith('extra')?'dossier':'witness'))}</span><span class="order-text"><strong>${done?'✓ ':''}${safe(o.label)}</strong><small>${game.orderAp(o)} ОД · ${o.days?o.days+' дн.':'в тот же день'}</small>${blocked&&!done?`<small class="order-block">${safe(blocked)}</small>`:''}</span></button>`;}
  function epTasks(){const a=game.s.active,ep=game.definition.episode;if(!a.ep.pending.length)return '';return `<div class="section-head"><h3>Поручения в работе</h3><span class="tag">${a.ep.pending.length}</span></div><div class="task-list">${a.ep.pending.map(t=>{const o=ep.orders.find(x=>x.id===t.id);return `<div class="task"><div>${safe(o.label)}<small>${names[o.agent]} · ответ в день ${t.due}</small></div><span class="tag">${t.due-game.s.day} дн.</span></div>`;}).join('')}</div>`;}
  // Torn scraps: each piece gets its own jagged outline and a scattered spot on the table.
  const noteRand=(i,k)=>{const x=Math.sin((i+1)*12.9898+k*78.233)*43758.5453;return x-Math.floor(x);};
  function tornShape(i){
    const pts=[],n=6,f=v=>v.toFixed(1)+'%';
    for(let k=0;k<=n;k++)pts.push(f(k/n*100)+' '+f(noteRand(i,k)*9));
    for(let k=1;k<n;k++)pts.push(f(100-noteRand(i,k+10)*11)+' '+f(k/n*100));
    for(let k=n;k>=0;k--)pts.push(f(k/n*100)+' '+f(100-noteRand(i,k+20)*9));
    for(let k=n-1;k>0;k--)pts.push(f(noteRand(i,k+30)*11)+' '+f(k/n*100));
    return 'polygon('+pts.join(',')+')';
  }
  function notePiece(p,placed,slot=0){
    const tilt=placed?Math.round(noteRand(p.i,40)*4-2):Math.round(noteRand(p.i,41)*36-18);
    const pos=placed?'':`left:${(slot%4)*24+1+noteRand(p.i,42)*3}%;top:${Math.floor(slot/4)*32+3+noteRand(p.i,43)*6}%;`;
    return `<button class="note-piece ${p.t?'':'blank'} ${placed?'placed':''}" data-note-piece="${p.i}" style="--tilt:${tilt}deg;clip-path:${tornShape(p.i)};${pos}" aria-label="${p.t?'Клочок: '+safe(p.t):'Пустой клочок'}${placed?', на листе':''}">${p.t?`<span>${safe(p.t)}</span>`:''}</button>`;
  }
  function notePuzzle(){
    const a=game.s.active,note=game.definition.episode.note;
    if(a.ep.noteRestored)return `<section class="torn-note restored"><span class="eyebrow">Записка у служебного выхода</span><p class="note-text">${safe(note.text)}</p><p class="small">Восстановлено, +${note.ap} ОД. Теперь свидетелям можно задать вопрос о Старом порте.</p></section>`;
    const all=[...note.pieces.map((t,i)=>({i,t})),...Array.from({length:note.decoys},(_,k)=>({i:note.pieces.length+k,t:''}))];
    const line=ui.noteLine.filter(i=>i<all.length),table=[...all].sort((x,y)=>(x.i*7919)%13-(y.i*7919)%13).filter(p=>!line.includes(p.i));
    return `<section class="torn-note"><span class="eyebrow">Клочки у служебного выхода</span><h3>Соберите записку</h3><p class="small">Перетащите клочки на лист в нужном порядке — или нажимайте на них по очереди. Клочок с листа можно вернуть на стол. Пустые обрывки лишние. Восстановленный текст даст +${note.ap} ОД.</p><div class="note-line" aria-label="Лист: собранный текст">${line.length?line.map(i=>notePiece(all[i],true)).join(''):'<span class="small">Положите сюда первый клочок</span>'}</div><div class="note-table" aria-label="Клочки на столе">${table.map((p,k)=>notePiece(p,false,k)).join('')}</div>${btn('Сложить заново','note-reset','text-button',!line.length)}</section>`;
  }
  function epDossierView(){
    const a=game.s.active,c=game.definition,ep=c.episode,done=ep.orders.filter(o=>a.ep.done.includes(o.id));
    return `<div class="eyebrow">Досье / ${safe(c.client)}</div><h2 class="section-title">Материалы дела</h2><p class="section-lead">${safe(c.story)} ${safe(c.objective)}</p>${tutorial()}${epTasks()}<div class="materials">${materialCard(a.materials[0])}${done.map(o=>`<article class="material"><div class="material-top"><h3>${safe(o.label)}</h3><span class="tag">${names[o.agent]}</span></div><p>${safe(o.result)}</p></article>`).join('')}</div>${a.ep.noteFound?notePuzzle():''}<button class="text-button" data-room-view="chat">Поручения детективу и эксперту →</button>`;
  }
  function epFactsView(){
    const a=game.s.active,ep=game.definition.episode;
    return `<div class="eyebrow">Улики / ${safe(game.definition.title)}</div><h2 class="section-title">Что установлено.</h2><p class="section-lead">Здесь собраны установленные факты. В суде важно, что доказано, а не сколько собрано.</p><div class="materials">${a.ep.facts.map(id=>`<article class="material"><div class="material-top"><h3>${safe(ep.facts[id].title)}</h3></div><p>${safe(ep.facts[id].text)}</p></article>`).join('')||'<p class="section-lead">Пока ничего не установлено.</p>'}</div>`;
  }
  function epActionsView(){
    const ep=game.definition.episode;
    return `<div class="eyebrow">Поручения / ${game.s.active.ap} ОД</div><h2 class="section-title">Детектив и эксперт</h2><p class="section-lead">${ep.perDayAgent==='mark'?'Детективу':'Каждому исполнителю'} — не больше ${ep.perDay} поручений в день. Новые поручения появятся, когда для них будет материал.</p>${epTasks()}${['mark','irina'].map(k=>`<div class="section-head"><h3>${names[k]}</h3><span class="tag">${roles[k]}</span></div><div class="orders">${epOrderList(k)}</div>`).join('')}`;
  }
  function epWitnessView(){
    const a=game.s.active,c=game.definition,ep=c.episode,w=ep.witnesses.find(x=>x.id===ui.witness)||ep.witnesses[0];
    const st=a.ep.witnesses[w.id]||{mode:null,asked:[],log:[],port:false},afford=n=>game.preparing()&&a.ap>=n;
    const profileOrder=ep.orders.find(o=>o.witness===w.id),extraOrder=ep.orders.find(o=>(o.requires||[]).includes(profileOrder?.id));
    const plain=t=>t.replace(/\s*Рекомендация для допроса:[^.]*\.?/,'');
    const profile=a.ep.done.includes(profileOrder?.id)?`<p>${safe(plain(profileOrder.result))}</p>${a.ep.done.includes(extraOrder?.id)?`<p style="margin-top:8px">${safe(extraOrder.result)}</p>`:''}`:'<p>Справки нет. Её может собрать Марк Волков.</p>';
    const tabs=ep.witnesses.map(x=>{const t=a.ep.witnesses[x.id];return `<button class="witness-tab" data-witness="${x.id}" aria-pressed="${x.id===w.id}"><strong>${safe(x.name)}</strong><small>${t?.mode?(t.mode==='free'?'Рассказ':'Вопросы')+' · ответов: '+t.asked.length:t?.log.length?'Отказ':'Не допрошен'}</small></button>`;}).join('');
    const coordinate=st.mode&&!a.ep.coordinated.includes(w.id)?`<div class="hint coordinate-hint"><span>Ответы не устраивают? Можно предложить свидетелю согласовать показания: ${ep.coordinateAp} ОД, незаконно, внимание властей растёт.</span><button class="text-button risky-link" data-ep-coordinate="${w.id}" ${!afford(ep.coordinateAp)?'disabled':''}>Давайте согласуем ваши показания в суде</button></div>`:'';
    const approaches=`<div class="approaches"><button class="approach" data-ep-interview="free" data-witness-id="${w.id}" ${!afford(2)?'disabled':''}><strong>Расскажите, что было</strong><small>Свободный рассказ · 2 ОД, уточнения по 1 ОД.</small></button><button class="approach" data-ep-interview="ask" data-witness-id="${w.id}" ${!game.preparing()?'disabled':''}><strong>Ответьте на мои вопросы</strong><small>Вопросы · по 1 ОД за каждый.</small></button></div>`;
    const questions=st.mode?`<div class="section-head"><h3>${st.mode==='free'?'Уточняющие вопросы':'Вопросы'}</h3><span class="tag">По 1 ОД</span></div><div class="question-grid">${w[st.mode].questions.map(q=>`<button data-ep-ask="${q.id}" data-witness-id="${w.id}" ${!afford(1)||st.asked.includes(q.id)?'disabled':''}>${st.asked.includes(q.id)?'✓ ':''}${safe(q.q)}</button>`).join('')}${a.ep.noteRestored?`<button data-ep-port="${w.id}" ${!afford(1)||st.port?'disabled':''}>${st.port?'✓ ':''}Вы бываете в районе Старого порта?</button>`:''}</div>${coordinate}`:'';
    const protocol=`<div class="protocol"><div class="section-head"><h3>Протокол</h3></div>${st.log.length?st.log.map(p=>`<article class="protocol-item"><strong>${safe(p.q)}</strong><p>${safe(p.a)}</p></article>`).join(''):'<p class="section-lead">Ответы появятся здесь.</p>'}</div>`;
    return `<div class="eyebrow">Свидетели / ${safe(c.title)}</div><h2 class="section-title">Допросы</h2><p class="section-lead">Для каждого свидетеля выбирается один тип допроса: рассказ или вопросы.</p>${tutorial()}<div class="witness-tabs">${tabs}</div><div class="profile"><span class="eyebrow">${safe(w.role)}</span><h3>${safe(w.name)}</h3>${profile}</div>${st.mode?'':approaches}${protocol}${questions}`;
  }
  function epPlanView(){
    const a=game.s.active,c=game.definition,ep=c.episode;
    if(!game.planOpen())return `<div class="eyebrow">Судебное заседание / день ${a.deadline}</div><h2 class="section-title">Сначала — подготовка.</h2><p class="section-lead">Подготовка к заседанию откроется в день ${a.deadline-1}, за сутки до суда, или раньше, если закончатся ОД. Каждый новый день даёт +${ep.apPerDay} ОД.</p>${epTasks()}${btn('Открыть досье →','dossier','primary')}`;
    return `<div class="eyebrow">Подготовка к заседанию / суд в день ${a.deadline}</div><h2 class="section-title">Материалы защиты</h2>${suitWarning()}<p class="section-lead">Судья ${safe(c.judge.name)}. ${safe(c.judge.hint)}${a.ep.pending.length?' Часть поручений ещё в работе: если пойти в суд сейчас, их результаты не будут учтены.':''}</p><div class="plan-estimate"><div><span class="eyebrow">Установлено</span><p>Для оправдания нужно ${c.target}% и ключевые доказательства.<br>В заседании судья задаст вопрос по делу: неверный ответ снимет 10% от итога.</p></div><strong>${game.epScore()}<span style="font:12px Arial">%</span></strong></div><div class="materials">${a.ep.facts.map(id=>`<article class="material"><div class="material-top"><h3>${safe(ep.facts[id].title)}</h3></div><p>${safe(ep.facts[id].text)}</p></article>`).join('')||'<p class="section-lead">Пока ничего не установлено.</p>'}</div>`;
  }
  function epNotesView(){const a=game.s.active,c=game.definition,key=(game.s.training?'training:':'career:')+a.id;return `<div class="eyebrow">Личный блокнот / ${safe(c.client)}</div><h2 class="section-title">Мысли, которые стоит сохранить.</h2><label class="room-field-label" for="case-notes">Ваши заметки по делу</label><textarea id="case-notes" data-note-key="${key}" rows="6" maxlength="4000" placeholder="Ваши мысли по делу…">${safe(caseNotes[key]||'')}</textarea><p id="notes-state" class="section-lead">Сохраняется в этой сессии.</p>${a.ep.noteFound?notePuzzle():''}`;}
  function suitWarning(){const s=game.s;return game.suitWorn()?`<div class="hint warning">Костюм изношен на ${s.wear}%: в суд в нём идти нельзя. Новый костюм — у зеркала, 12 000 кр.</div>`:'';}
  function wardrobeView(){const s=game.s,state=s.wear>=75?'в суд в нём идти нельзя':s.wear>=45?'бонуса больше нет':'даёт бонус';return `<div class="eyebrow">Зеркало / гардероб</div><h2 class="section-title">Ваш деловой облик.</h2><div class="room-wardrobe"><img src="${portrait}" alt="Портрет адвоката в деловом костюме"><div><h3>${safe(s.name)}</h3><p class="section-lead">Деловой костюм · износ ${s.wear}% · ${state}</p><div class="hint">Каждое дело изнашивает костюм на 15%. Пока износ меньше 45%, костюм даёт +2 известности и +1 профессионализма за дело. При износе 75% в суд в нём идти нельзя — нужен новый.</div>${btn('Новый костюм · 12 000 кр.','buy-suit','primary',s.wear===0||s.training)}<p class="section-lead" style="margin-top:16px">Покупки оплачиваются с личного счёта. Костюм можно купить и при задолженности.</p><button class="text-button" data-room-view="career">Развитие практики →</button></div></div>`;}
  function settingsView(){return `<div class="eyebrow">Настройки / текущая сессия</div><h2 class="section-title">Ваш рабочий ритм.</h2><div class="materials"><article class="material"><h3>Качество кабинета</h3><p>Авто учитывает размер экрана. Бережный режим уменьшает разрешение 3D и отключает тени.</p><select id="room-quality" aria-label="Качество 3D-кабинета"><option value="auto" ${roomSettings.quality==='auto'?'selected':''}>Авто</option><option value="low" ${roomSettings.quality==='low'?'selected':''}>Бережный режим</option></select></article><article class="material"><label class="room-checkbox"><input id="room-motion" type="checkbox" ${roomSettings.motion?'checked':''}>Плавные движения камеры и бегущая строка</label></article><article class="material"><h3>Сессия игры</h3><p>«Продолжить» возвращает к текущей карьере. Обновление страницы открывает стартовое меню; «Новая игра» начинает карьеру заново.</p></article></div><button class="primary" data-action="room">Вернуться в кабинет →</button>`;}
  root.addEventListener('input',e=>{if(e.target.id==='case-notes'){caseNotes[e.target.dataset.noteKey]=e.target.value;$('#notes-state').textContent='Заметка сохранена в текущей сессии.';}});
  root.addEventListener('change',e=>{if(e.target.id==='room-quality'){roomSettings.quality=e.target.value;globalThis.OfficeRoom?.setQuality(roomSettings.quality);render();}else if(e.target.id==='room-motion'){roomSettings.motion=e.target.checked;globalThis.OfficeRoom?.setMotion(roomSettings.motion);render();}});
  window.addEventListener('office:ready',()=>{if(started)render();});

  function render() {
    const desktop=$('#desktop-content'),phoneContent=$('#phone-content');
    if(lastDeskKey&&desktop.getClientRects().length)viewScroll[lastDeskKey]=desktop.scrollTop;
    if(lastPhoneKey&&phoneContent.getClientRects().length)viewScroll[lastPhoneKey]=phoneContent.scrollTop;
    const s=game.s,a=s.active,c=game.definition;
    root.dataset.device=ui.device;
    root.dataset.view=ui.room?'room':'app';
    root.dataset.focus=ui.room&&ui.focus||'overview';
    $('#office-room').hidden=!ui.room;
    $('.stage').hidden=!!ui.room;
    $('.device-switch').hidden=!!ui.room;
    $('.room-return').hidden=!!ui.room&&!ui.focus;
    $('.room-return').textContent='← Общий вид';
    renderRoom();
    renderArchive();
    renderMap();
    syncDeviceSurfaces();
    $('#chapter-label').textContent=s.training?'Тренировочное дело':s.campaignComplete?'Северный берег · кампания завершена':`Северный берег · глава ${s.stage} / 10`;
    $('#day-label').textContent='День '+s.day;$('#district-label').textContent=c?.district||'Новореченск';$('#lawyer-name').textContent=s.name;
    for(const key of ['rep','professional','heat']){$('#'+key).textContent=s[key];$('#'+key+'-bar').style.width=s[key]+'%';}$('#money').textContent=money(s.money);
    $('#mail-badge').textContent=s.unread;$('#mail-badge').hidden=!s.unread;$('#phone-badge').textContent=a?.pending.length?'· '+a.pending.length:'';
    $('#training-banner').hidden=!s.training;
    for(const attr of ['desk','phone','device'])root.querySelectorAll('button[data-'+attr+']').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[attr]===ui[attr])));
    const strip=$('#case-strip');strip.hidden=!a;
    if(a)strip.innerHTML=`<strong>№ ${safe(c.no)} · ${safe(c.title)}</strong><div><span>Суд: день ${a.deadline}${s.day===a.deadline?' · сегодня':''}</span><span class="ap ${!a.ap?'empty':''}"><b>${a.ap}</b>${a.ep?` ОД · +${c.episode.apPerDay} завтра`:` / ${a.apMax} ОД`}</span></div>`;
    const views={overview:overviewView,cases:casesView,dossier:dossierView,witness:witnessView,plan:planView,career:careerView,news:newsView,mail:mailView,result:resultView,evidence:evidenceView,actions:actionsView,notes:notesView,archive:archiveView,archiveDetail:archivedView,city:cityView,wardrobe:wardrobeView,shop:careerView,settings:settingsView};
    const epViews={dossier:epDossierView,witness:epWitnessView,plan:epPlanView,evidence:epFactsView,actions:epActionsView,notes:epNotesView};
    $('#desktop-content').innerHTML=((a?.ep&&epViews[ui.desk])||views[ui.desk]||overviewView)();$('#desk-app-select').value='';
    $('#phone-content').innerHTML=phoneView();
    const session=(s.training?'training:':'career:')+(a?.id||'none');
    lastDeskKey=session+':desk:'+ui.desk;lastPhoneKey=session+':phone:'+ui.phone+':'+ui.agent;
    desktop.scrollTop=viewScroll[lastDeskKey]||0;phoneContent.scrollTop=viewScroll[lastPhoneKey]||0;
    $('#phone-title').textContent=({bank:'Счёт',contacts:'Контакты'})[ui.phone]||'Переписка';
    $('#court-button').disabled=!a||!game.planOpen()||!!s.ending;$('#court-button').textContent='В суд →';
    $('#day-button').disabled=!!s.ending||(!a&&!s.investigation);$('#day-button').textContent=a&&s.day>=a.deadline?'Завершить день · пропуск суда':'Следующий день →';
    $('#footer-label').textContent=a?s.day>=a.deadline?'Заседание сегодня. Следующий день означает поражение.':!a.ap?'ОД закончились; поручения продолжают выполняться.':`Подготовка до дня ${a.deadline}. ${a.ep?'Каждый новый день +'+c.episode.apPerDay+' ОД.':'ОД не восстанавливаются.'}`:'Справедливость — не идеал. Это работа.';
    $('#day-track').innerHTML=a?`<span>День ${s.day}</span><div>${Array.from({length:a.deadline-a.accepted+1},(_,i)=>{const d=a.accepted+i;return `<i class="${d<s.day?'past':d===s.day?'now':''}${d===a.deadline?' court':''}" title="День ${d}${d===a.deadline?' · суд':''}"></i>`;}).join('')}</div><small>суд · день ${a.deadline}</small>`:`<span>День ${s.day}</span>`;
    const p=s.investigation;$('#investigation').hidden=!p;
    if(p)$('#investigation').innerHTML=`<h3>Дело против вас</h3><p>Сила обвинения ${p.evidence}/100. Решение в день ${p.due}. От 50 — штраф; от 75 — тюрьма. Снижение внимания не убирает собранные улики.</p>${p.defended?'<p>Независимая защита уже учтена.</p>':btn('Нанять защитника · 25 000 кр. · 1 день'+(a&&s.day>=a.deadline?' · пропуск суда':''),'defend','secondary',s.money<25000)}`;
    $('#notice').textContent=s.notice;
    globalThis.OfficeRoom?.setActive(screen==='game'&&!!ui.room&&!s.ending&&$('#overlay').hidden);
    if(s.ending&&screen==='game')showPrison();
  }
  function clearOverlay() {movieToken++;finishMovie=null;const v=$('#court-video');if(v)v.pause();$('#overlay').hidden=true;$('#overlay').innerHTML='';$('#workspace').inert=false;}
  function showMenu() {globalThis.OfficeRoom?.setActive(false);clearOverlay();game.cancelCourt();screen='menu';$('#menu').hidden=false;$('#workspace').hidden=true;$('[data-action="continue"]').hidden=!started||(!!game.s.ending&&!game.s.training);$('#rules').hidden=true;$('[data-action="rules"]').setAttribute('aria-expanded','false');window.scrollTo(0,0);$('[data-action="new-game"]').focus({preventScroll:true});}
  function enterGame() {screen='game';$('#menu').hidden=true;$('#workspace').hidden=false;render();window.scrollTo(0,0);$('[data-action="menu"]').focus({preventScroll:true});}
  function newGame() {clearOverlay();game.reset();ui={desk:'overview',phone:'chat',agent:'mark',device:'laptop',allTransactions:false,room:true,focus:null,district:null,witness:null,noteLine:[]};caseNotes={};archivedId=null;archivePage=0;archiveRenderKey=null;pendingArchiveFocus=false;viewScroll={};lastDeskKey=null;lastPhoneKey=null;roomSettings={quality:'auto',motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,newsPaused:false};globalThis.OfficeRoom?.setView('reset');globalThis.OfficeRoom?.setQuality(roomSettings.quality);globalThis.OfficeRoom?.setMotion(roomSettings.motion);started=true;enterGame();}
  function openOverlay(html) {globalThis.OfficeRoom?.setActive(false);$('#overlay').innerHTML=html;$('#overlay').hidden=false;$('#workspace').inert=true;$('#overlay').querySelector('button')?.focus();}
  function showCourt() {
    if(!game.beginCourt().ok){render();return;}
    const c=game.definition,s=game.s,selected=s.active.ep?(s.active.ep.facts.map(id=>safe(c.episode.facts[id].title)).join(' · ')||'Защита пока ничего не установила'):game.plan().map(id=>safe(s.active.materials.find(m=>m.id===id).title)).join(' → ')||'Материалы не выбраны';
    openOverlay(`<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="court-title"><div class="eyebrow">Заседание / ${safe(c.judge.name)}</div><h2 id="court-title">${s.rep>=45?safe(s.name)+', ваша позиция.':'Господин адвокат, ваша позиция.'}</h2><p>${selected}</p><p>${safe(c.court.prompt)}</p><div class="choices">${c.court.options.map((o,i)=>`<button class="option" data-court-answer="${i}"><span class="letter">0${i+1}</span>${safe(o)}</button>`).join('')}</div>${btn('Вернуться к подготовке','cancel-court','secondary')}</section>`);
  }
  function cinema() {
    const c=game.definition,token=++movieToken,outcome=game.assessment(game.s.active.courtChoice)?.won?'acquit':'guilty',verdict=verdicts[outcome],opening=8,total=Math.ceil(opening+verdict.length);
    let stage=1,hold=0,ending=false,length=verdict.length;
    openOverlay(`<section class="dialog cinema" data-verdict="${outcome}" role="dialog" aria-modal="true" aria-labelledby="film-title"><video id="court-video" playsinline preload="auto" poster="${portrait}" src="${videoSource}" aria-label="Последнее слово защиты"></video><div><div id="film-stage" class="eyebrow">Ключевой момент / защита</div><h2 id="film-title">Последнее слово защиты.</h2><p id="film-lead">${safe(c.title)}<br>Суд рассматривает ваши материалы и ответ.</p><p id="film-quote" class="film-quote" aria-live="polite" hidden></p><div class="film-progress"><span id="film-bar"></span></div><div id="film-time" class="film-time">00:00 / ${clock(total)}</div><div class="dialog-actions">${btn('К результату →','skip','secondary')}${btn('В меню','menu','secondary')}<button class="secondary" data-action="play" hidden>Включить видео</button></div></div></section>`);
    const v=$('#court-video'),verdictPoster=verdict.src.replace(/\.mp4$/,'.jpg');
    new Image().src=verdictPoster;
    const blocked=e=>{if(e?.name==='NotAllowedError'&&token===movieToken&&$('[data-action="play"]'))$('[data-action="play"]').hidden=false;};
    const later=(fn,ms)=>{clearTimeout(hold);hold=setTimeout(()=>{if(token===movieToken)fn();},ms);};
    const quote=()=>{const q=$('#film-quote');if(q&&q.hidden){q.textContent='«'+verdict.quote+'»';q.hidden=false;}};
    finishMovie=()=>{if(token!==movieToken)return;clearTimeout(hold);clearOverlay();game.finishCourt();navigate('result');render();$('#desktop-content').scrollTop=0;};
    const endVerdict=()=>{if(token!==movieToken||ending)return;ending=true;quote();v.classList.add('film-ended');$('#film-bar').style.width='100%';$('#film-time').textContent=clock(total)+' / '+clock(total);later(()=>finishMovie?.(),1000);};
    const toVerdict=()=>{
      if(token!==movieToken||stage!==1)return;stage=2;
      $('#film-stage').textContent='Ключевой момент / приговор';$('#film-title').textContent='Слово суда.';$('#film-lead').innerHTML=safe(c.title)+'<br>Судья оглашает решение.';
      $('[data-action="play"]').hidden=true;
      v.poster=verdictPoster;v.src=verdict.src;v.setAttribute('aria-label',verdict.label);
      v.play().catch(blocked);
    };
    v.addEventListener('ended',()=>{if(token!==movieToken)return;if(stage===1)toVerdict();else endVerdict();});
    v.addEventListener('timeupdate',()=>{
      if(token!==movieToken||$('#court-video')!==v||ending)return;
      if(stage===2&&v.duration>0)length=v.duration;
      const elapsed=stage===1?Math.min(opening,v.currentTime):opening+Math.min(length,v.currentTime);
      $('#film-bar').style.width=Math.min(100,elapsed/total*100)+'%';$('#film-time').textContent=clock(elapsed)+' / '+clock(total);
      if(stage===2&&v.currentTime>=verdict.quoteAt)quote();
      if(stage===2&&v.currentTime>=length-.05)endVerdict();
      if(stage===1&&v.currentTime>=opening)toVerdict();
    });
    v.addEventListener('error',()=>{if(token!==movieToken)return;if(stage===1){toVerdict();return;}$('#film-time').textContent='Видео недоступно. Нажмите «К результату».';quote();later(()=>finishMovie?.(),2500);});
    v.play().catch(blocked);
  }
  function showPrison(){if($('#prison-title'))return;openOverlay(`<section class="dialog prison" role="dialog" aria-modal="true" aria-labelledby="prison-title"><div class="eyebrow">Дело против адвоката / финал</div><h2 id="prison-title">Теперь вы —<br>подзащитный.</h2><p>Следствие доказало систематическое вмешательство в показания. Суд назначил тюремное заключение. Практика закрыта.</p><p>День ${game.s.day} · завершено дел: ${game.s.completed.length} · известность: ${game.s.rep}</p><div class="dialog-actions">${game.s.training?btn('Вернуться в карьеру','leave-training','primary'):btn('Новая игра','new-game','primary')}${btn('Главное меню','menu','secondary')}</div></section>`);}
  function navigate(desk){
    if((desk==='archive'||desk==='archiveDetail')&&spatialAvailable()){
      pendingArchiveFocus=ui.focus!=='archive';ui.room=true;ui.focus='archive';
      if(desk==='archive')archivedId=null;
    }else{ui.desk=desk;selectDevice('laptop');}
    if(desk==='mail')game.s.unread=0;
  }
  function checkNote(){const note=game.definition?.episode?.note;if(note&&note.pieces.every((_,j)=>ui.noteLine.includes(j))&&game.restoreNote(ui.noteLine).ok)ui.noteLine=[];}
  // Drag a scrap with the mouse or a finger: drop it on the sheet to place it, anywhere else to put it back.
  let noteDrag=null,noteDragUntil=0;
  const over=(el,e)=>{if(!el)return false;const r=el.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;};
  root.addEventListener('pointerdown',e=>{const piece=e.target.closest('.note-piece');if(!piece||e.button>0||!root.contains(piece))return;noteDrag={piece,id:Number(piece.dataset.notePiece),x:e.clientX,y:e.clientY,moved:false};});
  window.addEventListener('pointermove',e=>{
    const d=noteDrag;if(!d)return;
    if(!d.moved){if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;d.moved=true;const r=d.piece.getBoundingClientRect();d.dx=d.x-r.left;d.dy=d.y-r.top;d.ghost=d.piece.cloneNode(true);d.ghost.classList.add('note-ghost');Object.assign(d.ghost.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});root.append(d.ghost);d.piece.classList.add('lifted');}
    e.preventDefault();d.ghost.style.left=(e.clientX-d.dx)+'px';d.ghost.style.top=(e.clientY-d.dy)+'px';$('.note-line')?.classList.toggle('drop',over($('.note-line'),e));
    // Near the edge of the scrolling screen, scroll it so the sheet and the far scraps stay reachable.
    const box=d.piece.closest('#desktop-content'),r=box?.getBoundingClientRect();
    if(r){const edge=48;if(e.clientY<r.top+edge)box.scrollTop-=14;else if(e.clientY>r.bottom-edge)box.scrollTop+=14;}
  },{passive:false});
  const endNoteDrag=e=>{
    const d=noteDrag;noteDrag=null;if(!d||!d.moved)return;
    d.ghost.remove();d.piece.classList.remove('lifted');noteDragUntil=Date.now()+350;
    const line=$('.note-line');line?.classList.remove('drop');
    if(e.type!=='pointerup'){render();return;}
    const order=ui.noteLine.filter(i=>i!==d.id);
    if(over(line,e)){
      const placed=[...line.querySelectorAll('.note-piece.placed')].filter(el=>Number(el.dataset.notePiece)!==d.id);
      let at=placed.findIndex(el=>{const r=el.getBoundingClientRect();return e.clientY<r.top||(e.clientY<=r.bottom&&e.clientX<r.left+r.width/2);});
      if(at<0)at=placed.length;order.splice(at,0,d.id);ui.noteLine=order;checkNote();
    }else ui.noteLine=order;
    render();
  };
  window.addEventListener('pointerup',endNoteDrag);window.addEventListener('pointercancel',endNoteDrag);
  root.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled||!root.contains(b))return;const action=b.dataset.action;
    if(action==='new-game'){newGame();return;}if(action==='menu'){showMenu();return;}
    if(action==='continue'){if(started&&(!game.s.ending||game.s.training))enterGame();return;}
    if(action==='rules'){const rules=$('#rules');rules.hidden=!rules.hidden;b.setAttribute('aria-expanded',String(!rules.hidden));return;}
    if(action==='leave-training'){clearOverlay();game.leaveTraining();ui.desk='cases';ui.device='laptop';enterGame();return;}
    if(screen!=='game')return;
    if(!$('#overlay').hidden){
      if(b.dataset.courtAnswer!==undefined&&game.chooseCourt(Number(b.dataset.courtAnswer)))cinema();
      else if(action==='skip')finishMovie?.();
      else if(action==='play')$('#court-video')?.play().then(()=>{b.hidden=true;}).catch(()=>{});
      else if(action==='cancel-court'){clearOverlay();game.cancelCourt();render();}
      return;
    }
    const previous=game.s.result,previousArchiveId=archivedId;
    if(b.dataset.roomView)openRoomView(b.dataset.roomView);
    else if(b.dataset.roomCamera){if(b.dataset.roomCamera==='reset'){openRoomView('room');globalThis.OfficeRoom?.setView('reset');}else globalThis.OfficeRoom?.setView(b.dataset.roomCamera);}
    else if(b.dataset.roomNewsPause){roomSettings.newsPaused=!roomSettings.newsPaused;}
    else if(b.dataset.roomDay){game.nextDay();}
    else if(b.dataset.archiveId){archivedId=b.dataset.archiveId;navigate('archiveDetail');}
    else if(b.dataset.archivePage){archivePage+=Number(b.dataset.archivePage);}
    else if(action==='archive-close'){archivedId=null;}
    else if(action==='room')openRoomView('room');
    else if(b.dataset.desk)navigate(b.dataset.desk);
    else if(b.dataset.phone){ui.phone=b.dataset.phone;selectDevice('phone');}
    else if(b.dataset.agent){ui.agent=b.dataset.agent;ui.phone='chat';selectDevice('phone');}
    else if(b.dataset.district){ui.district=b.dataset.district;if(ui.desk!=='city'&&ui.focus!=='map')openRoomView('city');}
    else if(b.dataset.device)selectDevice(b.dataset.device);
    else if(b.dataset.offer){game.offer(b.dataset.offer);ui.noteLine=[];ui.witness=null;navigate('mail');}
    else if(b.dataset.probono){game.offer(b.dataset.probono,true);navigate('mail');}
    else if(b.dataset.order)game.order(b.dataset.order);
    else if(b.dataset.epOrder)game.epOrder(b.dataset.epOrder);
    else if(b.dataset.witness)ui.witness=b.dataset.witness;
    else if(b.dataset.epInterview)game.epInterview(b.dataset.witnessId,b.dataset.epInterview);
    else if(b.dataset.epAsk)game.epAsk(b.dataset.witnessId,b.dataset.epAsk);
    else if(b.dataset.epPort)game.epPort(b.dataset.epPort);
    else if(b.dataset.epCoordinate)game.epCoordinate(b.dataset.epCoordinate);
    else if(b.dataset.notePiece!==undefined){if(Date.now()<noteDragUntil)return;const i=Number(b.dataset.notePiece),k=ui.noteLine.indexOf(i);if(k>=0)ui.noteLine.splice(k,1);else{ui.noteLine.push(i);checkNote();}}
    else if(action==='note-reset')ui.noteLine=[];
    else if(b.dataset.approach)game.chooseApproach(b.dataset.approach);
    else if(b.dataset.question)game.question(b.dataset.question);
    else if(b.dataset.puzzle!==undefined)game.puzzleSelect(Number(b.dataset.puzzle));
    else if(b.dataset.material)game.toggleMaterial(b.dataset.material);
    else if(b.dataset.line)game.setLine(b.dataset.line);
    else if(b.dataset.up)game.move(b.dataset.up,-1);
    else if(b.dataset.down)game.move(b.dataset.down,1);
    else if(b.dataset.training){if(game.training(b.dataset.training).ok){archivedId=null;navigate('dossier');ui.agent='mark';ui.phone='chat';ui.noteLine=[];ui.witness=null;}}
    else if(['cases','dossier','witness','plan','career','result'].includes(action))navigate(action);
    else if(action==='phone')openRoomView('chat');
    else if(action==='bank')openRoomView('bank');
    else if(action==='day')game.nextDay();
    else if(action==='solve')game.solvePuzzle();
    else if(action==='postpone')game.postpone();
    else if(action==='defend')game.defend();
    else if(action==='court'){showCourt();return;}
    else if(action?.startsWith('buy-'))game.buy(action.slice(4));
    else if(action==='debt')game.payDebt();
    else if(action==='transactions')ui.allTransactions=!ui.allTransactions;
    if(game.s.result&&game.s.result!==previous){navigate('result');}
    render();
    if(b.dataset.archiveId&&ui.focus==='archive')$('#archive-document-title')?.focus({preventScroll:true});
    if(action==='archive-close')$('#room-archive-shelves [data-archive-id="'+previousArchiveId+'"]')?.focus({preventScroll:true});
    if(b.dataset.archivePage)($('#room-archive-controls [data-archive-page="'+b.dataset.archivePage+'"]:not(:disabled)')||$('#room-archive-controls [data-archive-page]:not(:disabled)')||$('#room-archive-shelves button'))?.focus({preventScroll:true});
    if(b.dataset.device||action==='phone'||action==='bank')window.scrollTo(0,0);
  });
  root.addEventListener('change',e=>{if(e.target.id==='desk-app-select'){navigate(e.target.value);render();if(ui.focus==='archive')$('#room-focus-bar [data-room-view=archive]')?.focus({preventScroll:true});else $('#desk-app-select').focus();}else if(e.target.id==='agent-select'){ui.agent=e.target.value;render();$('#agent-select').focus();}else if(e.target.id==='personal-funding'&&game.s.active){game.s.active.personalFunding=e.target.checked;game.say(e.target.checked?'Личные вложения разрешены. Перед поручением показана сумма.':'Оплата ограничена бюджетом клиента.');render();$('#personal-funding').focus();}});
  root.addEventListener('submit',e=>{if(e.target.id==='name-form'){e.preventDefault();const value=$('#name-input').value.trim();if(value){game.s.name=value.slice(0,40);game.say('Имя адвоката обновлено.');render();}}});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&screen==='game'){e.preventDefault();if(!$('#overlay').hidden&&game.s.active?.phase==='court'){if(finishMovie)finishMovie();else{clearOverlay();game.cancelCourt();render();}}else if(!game.s.ending){if(!ui.room||ui.focus){openRoomView('room');render();}else showMenu();}return;}
    if(e.key==='Tab'&&!$('#overlay').hidden){const nodes=[...$('#overlay').querySelectorAll('button:not([hidden]):not(:disabled)')],first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  });
  if('scrollRestoration'in history)history.scrollRestoration='manual';
  window.addEventListener('pageshow',e=>{if(e.persisted){game.reset();started=false;ui={desk:'overview',phone:'chat',agent:'mark',device:'laptop',allTransactions:false,room:true,focus:null,district:null,witness:null,noteLine:[]};showMenu();}});
  // WebMCP exposes the ordinary screen/day actions, never raw career mutation.
  const toolState = () => ({ready:true,screen,started,day:game.s.day,chapter:game.s.stage,
    reputation:game.s.rep,professional:game.s.professional,training:!!game.s.training,
    ending:game.s.ending || null,desk:ui.desk,phone:ui.phone,device:ui.device,
    overlayOpen:!$('#overlay').hidden,officeOpen:screen==='game'&&!!ui.room,focusedDevice:ui.room?ui.focus:null,office3d:globalThis.OfficeRoom?.diagnostics()||null,
    activeCase:game.s.active ? {id:game.s.active.id,phase:game.s.active.phase,
      actionPoints:game.s.active.ap,deadline:game.s.active.deadline,pendingOrders:game.s.active.pending.length} : null});
  function requireWorkspace() {
    if(screen !== 'game')throw new Error('Start or continue the game first.');
    if(!$('#overlay').hidden)throw new Error('Finish the current dialog or court scene first.');
    if(game.s.ending)throw new Error('The current campaign has ended.');
  }
  const webmcp = window.GameWebMCP?.register({id:'good-lawyer',
    version:new URL(assetScript.src,location.href).searchParams.get('v') || 'dev',tools:[
    {name:'lawyer_get_state',description:'Read the visible screen, chapter, day, case phase and action points. Omits player names and messages.',readOnly:true,execute:toolState},
    {name:'lawyer_get_performance',description:'Read browser frame timing and video state. Browser FPS is measured separately from gameplay state.',readOnly:true,execute:() => ({frameTiming:webmcp?.diagnostics(),videoPlaying:!!finishMovie})},
    {name:'lawyer_start',description:'Start the first campaign, or continue the current session from the menu. Does not reset an existing career.',execute:() => {
      if(!$('#overlay').hidden)throw new Error('Finish the current dialog first.');
      if(!started)newGame();else if(game.s.ending&&!game.s.training)throw new Error('The campaign has ended.');else if(screen==='menu')enterGame();
      return toolState();
    }},
    {name:'lawyer_open_menu',description:'Return to the normal menu without resetting career state. Finish the court scene first.',execute:() => {
      if(!$('#overlay').hidden)throw new Error('Finish the current dialog or court scene first.');
      showMenu();return toolState();
    }},
    {name:'lawyer_open_view',description:'Open a laptop program or phone application through the usual navigation. Opening mail marks it read.',
      inputSchema:{type:'object',properties:{view:{type:'string',enum:['room','laptop','phone','cases','dossier','witness','plan','career','news','mail','chat','bank','evidence','actions','notes','archive','city','wardrobe','shop','settings']}},required:['view'],additionalProperties:false},
      execute:({view}) => {
        requireWorkspace();
        openRoomView(view);
        render();return toolState();
      }},
    {name:'lawyer_advance_day',description:'Press the ordinary Next day button. Deadlines, orders and costs follow the existing game rules.',execute:() => {
      requireWorkspace();const button=$('[data-action="day"]');
      if(!button||button.disabled)throw new Error('Next day is unavailable in this phase.');
      button.click();return toolState();
    }}
  ]});
  showMenu();
})();
