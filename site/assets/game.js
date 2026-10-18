/* View and controls; career rules live in engine.js, authored stories in cases.js. */
(() => {
  'use strict';
  const {Game,ORDERS}=globalThis.GoodLawyer;
  const game=new Game(globalThis.GOOD_LAWYER_CASES);
  const root=document.getElementById('good-lawyer'), $=s=>root.querySelector(s);
  const assetScript=document.currentScript,portrait=assetScript.dataset.portrait,videoSource=assetScript.dataset.video;
  const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
  const btn=(text,action,cls='secondary',disabled=false)=>`<button class="${cls}" data-action="${action}" ${disabled?'disabled':''}>${text}</button>`;
  const names={mark:'Марк Волков',irina:'Ирина Лебедева',contact:'Закрытый контакт'};
  const lines={alibi:'Алиби',procedure:'Ошибка в материалах',motive:'Иная версия событий'};
  const kinds={document:'Документ',witness:'Показания',physical:'Вещественное'};
  const questions={events:'Что вы видели лично?',time:'Когда это произошло?',detail:'Что подтверждает ваши слова?',conflict:'Как объяснить противоречие?',source:'Откуда вы это знаете?',certainty:'В чём вы не уверены?',review:'Сверить с новым документом',confirm:'Готовы повторить в суде?'};
  let ui={desk:'cases',phone:'chat',agent:'mark',device:'laptop',allTransactions:false,room:true,focus:null},started=false,screen='menu',movieToken=0,finishMovie=null;
  function empty(title='Пока нет активного дела',body='Выберите дело и отправьте предложение клиенту на вкладке «Дела».') {return `<div class="empty"><span class="eyebrow">Ваша практика</span><h3>${title}</h3><p>${body}</p>${btn('Выбрать дело →','cases','primary')}</div>`;}
  function steps() {return `<div class="step-list" aria-label="Прогресс кампании">${Array.from({length:10},(_,i)=>`<span class="step-dot ${i+1<game.s.stage?'done':i+1===game.s.stage?'current':''}" title="Глава ${i+1}">${i+1<game.s.stage?'✓':i+1}</span>`).join('')}</div>`;}
  function tutorial() {
    const a=game.s.active,c=game.definition;if(!a||c.step!==1)return '';
    const text=!a.pending.length&&!a.done.length?'Начните с поручений: Ирина проверит документы, Марк — перемещения. Пока они работают, поговорите со свидетелем.':!a.questions.length?'Поручения в работе. На вкладке «Свидетель» выберите спокойный подход и задайте несколько вопросов.':!game.planOpen()?'Новые ответы и документы появятся после перехода дня. За день до суда откроется план защиты.':'План открыт. Включите проверенные документы, запись перемещений и протокол свидетеля. Поставьте документ перед показаниями.';
    return `<div class="hint"><strong>Первое дело / </strong>${text}</div>`;
  }
  function caseCard(c) {
    const r=game.requirement(c),accessible=game.eligible(c),s=game.s;
    return `<article class="case-card ${c.step===1?'tutorial':''}"><div><div class="case-id"><span class="eyebrow">Дело № ${safe(c.no)} / ${safe(c.district)}</span><span class="tag ${accessible?'green':''}">${accessible?'Доступно':'Высокий рейтинг'}</span></div><h3>${safe(c.title)}</h3><p>${safe(c.story)}</p><p class="goal">Клиент: ${safe(c.client)}<br>Задача: ${safe(c.objective)}</p><dl><div><dt>Гонорар за успех</dt><dd>${money(c.fee)}</dd></div><div><dt>Бюджет клиента</dt><dd>${money(c.budget)}</dd></div><div><dt>Подготовка</dt><dd>${c.ap} ОД · ${c.days} дней</dd></div><div><dt>Требования</dt><dd>Известность ${r.rep} · проф. ${r.professional}</dd></div></dl><div class="case-actions"><button class="primary" data-offer="${c.id}">Предложить защиту →</button><button class="text-button" data-probono="${c.id}">Помочь бесплатно · за свой счёт</button>${!accessible&&c.id===game.choices()[0]?.id?'<p class="small">Юридическая клиника направит это дело бесплатно даже при низкой известности.</p>':''}</div></div>${c.step===1?`<img class="case-portrait" src="${portrait}" alt="Адвокат готовится к первому делу">`:''}</article>`;
  }
  function casesView() {
    const s=game.s,a=s.active,c=game.definition;
    if(a)return `<div class="eyebrow">В работе / № ${safe(c.no)} / ${safe(c.type)}</div><h2 class="section-title">${safe(c.title)}</h2><p class="section-lead">${safe(c.story)}</p>${tutorial()}<div class="profile"><span class="eyebrow">Рассказ клиента · ${safe(c.client)}</span><h3>«Мне нужна ваша защита»</h3><p>${safe(c.objective)}</p><p style="margin-top:10px">${a.probono?'Бесплатная помощь: расходы на вас.':`Гонорар ${money(a.fee)}; при неудаче — 40%.`} Слушание: день ${a.deadline}. Запас на всё дело: ${a.apMax} ОД.</p></div>${tasksView()}<div class="choices">${btn('Открыть материалы дела →','dossier','primary')}${btn('Подготовить свидетеля →','witness')}${btn('Открыть поручения на телефоне →','phone')}</div>${steps()}`;
    if(s.campaignComplete)return `<div class="eyebrow">Кампания завершена / Северный берег</div><h2 class="section-title">Город знает ваше имя.</h2><p class="section-lead">Вы прошли десять глав и стали городским адвокатом. Выиграно ${s.wins} из ${s.completed.length} дел. Теперь можно проверить другой подход к завершённому делу: тренировка не изменит ресурсы карьеры.</p>${s.investigation?'<div class="hint warning">Расследование ещё продолжается. Дождитесь решения перед тренировкой.</div>':''}${steps()}<div class="section-head" style="margin-top:24px"><h3>Архив дел</h3><span class="tag">Тренировочные повторы</span></div><div class="materials">${s.completed.map(r=>`<article class="material"><div class="material-top"><h3>${safe(r.title)}</h3><span class="tag">${r.won?'Успех':'Неудача'} · ${r.score}%</span></div><button class="text-button" data-training="${r.id}" ${s.investigation?'disabled':''}>Переиграть без изменения карьеры →</button></article>`).join('')}</div><p class="section-lead" style="margin-top:22px">В этой версии доступна первая кампания. Продолжение, свободная игра и совместные дела описаны в плане развития.</p>`;
    return `<div class="eyebrow">Северный берег / глава ${s.stage} из 10</div><h2 class="section-title">${s.stage===1?'Первое дело. Ваше имя.':'Какое дело станет вашим?'}</h2><p class="section-lead">${s.stage===1?'В пригороде вас ещё почти не знают. Начните с небольшого дела: выслушайте клиента и соберите защиту.':'Выберите одно из двух дел. Второй путь останется для нового прохождения. Клиент ответит на предложение в почте.'}</p><div class="case-grid">${game.choices().map(caseCard).join('')}</div>${s.result?btn('Разбор предыдущего дела →','result','text-button'):''}${steps()}`;
  }
  function tasksView() {const a=game.s.active;if(!a?.pending.length)return '';return `<div class="section-head"><h3>Поручения в работе</h3><span class="tag">${a.pending.length}</span></div><div class="task-list">${a.pending.map(t=>`<div class="task"><div>${ORDERS[t.key].label}<small>${names[ORDERS[t.key].agent]} · ответ в день ${t.due}</small></div><span class="tag">${t.due-game.s.day} дн.</span></div>`).join('')}</div>`;}
  function materialCard(m,inPlan=false) {const a=game.s.active,selected=a.selection.includes(m.id);return `<article class="material ${m.risky?'risky':''} ${inPlan&&selected?'selected':''}"><div class="material-top"><h3>${safe(m.title)}</h3><span class="tag ${m.risky?'red':''}">${m.risky?'Спорный источник':kinds[m.kind]}</span></div><p>${safe(m.text)}</p><p><small>${safe(m.source)} · день ${m.day}</small></p>${inPlan?`<button class="${selected?'primary':'secondary'}" data-material="${m.id}" aria-pressed="${selected}">${selected?'✓ В плане · убрать':'+ Включить в план'}</button>`:''}</article>`;}
  function dossierView() {const a=game.s.active,c=game.definition;if(!a)return empty();return `<div class="eyebrow">Досье / ${safe(c.client)}</div><h2 class="section-title">Материалы дела</h2><p class="section-lead">${safe(c.objective)} В суд попадут только материалы плана. Не каждое найденное утверждение надёжно.</p>${tutorial()}${tasksView()}<div class="materials">${a.materials.map(m=>materialCard(m)).join('')}</div><section class="puzzle"><span class="eyebrow">Блокнот / необязательный анализ</span><h3>Найти несостыковку</h3><p>${safe(c.puzzle.prompt)}</p>${a.puzzleAttempted?`<div class="hint ${a.puzzleSolved?'':'warning'}">${a.puzzleSolved?'Верно. Заметка добавлена в досье.':'Ответ не подтвердился. Бонус не получен.'}<br>${safe(c.puzzle.explanation)}</div>`:`<div class="choices">${c.puzzle.options.map((o,i)=>`<button class="option" data-puzzle="${i}" aria-pressed="${a.puzzleChoice===i}" ${!game.canSpend(1)?'disabled':''}><span class="letter">${i+1}</span>${safe(o)}</button>`).join('')}</div><div class="choice-footer">${btn('Проверить · 1 ОД','solve','secondary',!game.canSpend(1)||a.puzzleChoice===null)}</div><p class="small" style="margin-top:12px">Одна попытка. Можно переключать вкладки: выбранный ответ сохранится.</p>`}</section>${btn('Перейти к плану защиты →','plan','text-button')}`;}
  function witnessView() {
    const a=game.s.active,c=game.definition;if(!a)return empty();const witnessMaterial=a.materials.find(m=>m.id==='witness');const trait={careful:'Внимательный. Лучше свободный рассказ, затем проверка фактов.',nervous:'Тревожный. Спокойные вопросы помогают; давление может обернуться жалобой.',stubborn:'Независимый. Навязывание версии приведёт к отказу выступать.'};
    return `<div class="eyebrow">Подготовка показаний</div><h2 class="section-title">Свидетель защиты</h2><p class="section-lead">Подход меняет надёжность показаний. Сначала можно поручить Марку собрать справку о человеке.</p><div class="profile"><span class="eyebrow">Приглашён защитой</span><h3>${safe(c.witness.name)}</h3><p>${a.profile?safe(trait[c.witness.trait]):'Справка ещё не получена. Вы знаете только рассказ клиента.'}</p>${a.profile===2?`<p style="margin-top:10px">${safe(c.witness.detail)}</p>`:''}</div>${witnessMaterial?.risky?`<div class="hint warning">${safe(witnessMaterial.text)}</div>`:''}${!a.approach?`<div class="approaches"><button class="approach" data-approach="free" ${!game.canSpend(1)?'disabled':''}><strong>Расскажите своими словами</strong><small>Точные воспоминания. Меньше контроля над версией.</small></button><button class="approach" data-approach="guided" ${!game.canSpend(1)?'disabled':''}><strong>Ответьте на мои вопросы</strong><small>Уточнить детали и сопоставить их с материалами.</small></button><button class="approach risky" data-approach="pressure" ${!game.canSpend(1)?'disabled':''}><strong>Согласуем удобные показания</strong><small>Теневой метод. Риск отказа или признания давления; внимание следствия растёт.</small></button></div>`:`<div class="section-head"><h3>Вопросы · ${a.questions.length} / 8</h3><span class="tag">По 1 ОД</span></div><div class="hint">Подход: ${a.approach==='free'?'свободный рассказ':a.approach==='guided'?'направляющие вопросы':'давление'}. Протокол обновляется после каждого нового ответа.</div><div class="question-grid">${Object.entries(questions).map(([key,label])=>`<button data-question="${key}" ${!game.canSpend(1)||a.questions.includes(key)||(key==='review'&&!a.done.includes('documents'))?'disabled':''}>${a.questions.includes(key)?'✓ ':''}${label}</button>`).join('')}</div>`}<div class="protocol"><div class="section-head"><h3>Протокол беседы</h3></div>${a.protocol.length?a.protocol.map(p=>`<article class="protocol-item"><strong>${safe(p.q)}</strong><p>${safe(p.a)}</p></article>`).join(''):'<p class="section-lead">Здесь сохранятся ответы и справки детектива.</p>'}</div><div class="hint warning" style="margin-top:20px">Свидетеля обвинения заранее опрашивать нельзя. Его показания рассматриваются только на заседании.</div>`;
  }
  function planView() {
    const a=game.s.active,c=game.definition;if(!a)return empty();
    if(!game.planOpen())return `<div class="eyebrow">Судебное заседание / день ${a.deadline}</div><h2 class="section-title">Сначала — подготовка.</h2><p class="section-lead">План откроется в день ${a.deadline-1}, за сутки до суда, или раньше при нуле ОД. До этого собирайте материалы и готовьте свидетеля.</p>${tasksView()}${btn('Открыть досье →','dossier','primary')}${c.step>=4&&!a.postponed?`<div class="hint" style="margin-top:20px">Один перенос: +2 дня, −20% гонорара и −4 балла к итогу. ОД не восстанавливаются.<br>${btn('Перенести заседание','postpone','text-button')}</div>`:''}`;
    const assessment=game.assessment(),plan=game.plan();
    return `<div class="eyebrow">Подготовка к заседанию</div><h2 class="section-title">Ваша линия защиты</h2><p class="section-lead">Судья ${safe(c.judge.name)}. ${safe(c.judge.hint)} ${a.pending.length?'Часть поручений ещё в работе: если пойти в суд сейчас, их материалы не будут учтены.':''}</p><div class="plan-lines">${Object.entries(lines).map(([key,label])=>`<button data-line="${key}" aria-pressed="${a.line===key}">${label}</button>`).join('')}</div>${!a.line?'<div class="hint warning">Линия не выбрана: по умолчанию адвокат заявит алиби.</div>':''}<div class="section-head"><h3>Порядок выступления</h3><span class="tag">${plan.length} / 4 материала</span></div>${!a.manualPlan?'<div class="hint warning">План не составлен. Суд получит первые четыре материала в порядке поступления — включая непроверенные. Выберите карточки ниже, чтобы собрать свою защиту.</div>':''}<div class="plan-order">${plan.length?plan.map((id,i)=>{const m=a.materials.find(m=>m.id===id);return `<div class="plan-row"><span>0${i+1}</span><span>${safe(m.title)}</span>${a.manualPlan?`<button data-up="${id}" aria-label="Поднять ${safe(m.title)}" ${i===0?'disabled':''}>↑</button><button data-down="${id}" aria-label="Опустить ${safe(m.title)}" ${i===plan.length-1?'disabled':''}>↓</button>`:''}</div>`;}).join(''):'<p class="section-lead">Вы пока не выбрали ни одного материала.</p>'}</div><div class="plan-estimate"><div><span class="eyebrow" style="color:#c7d2b8">Оценка плана</span><p>Для успеха нужно ${c.target}.<br>Ответ в суде и проверка спорных материалов изменят итог.</p></div><strong>${assessment.score}<span style="font:12px Arial"> / 100</span></strong></div><div class="materials">${a.materials.map(m=>materialCard(m,true)).join('')}</div>${a.postponed?'<p class="section-lead" style="margin-top:20px">Перенос уже использован. Итог защиты получит штраф 4 балла.</p>':c.step>=4?`<div class="hint" style="margin-top:20px">Перенос: +2 дня, −20% гонорара, −4 балла к итогу. Один раз за дело.<br>${btn('Перенести заседание','postpone','text-button')}</div>`:''}`;
  }
  function careerView() {
    const s=game.s,status=s.campaignComplete?'Городской адвокат':'Начинающий адвокат';
    return `<div class="eyebrow">Карьера / ${status}</div><h2 class="section-title">Имя, которое вы строите.</h2><p class="section-lead">Известность привлекает клиентов, профессионализм подтверждает опыт. Теневая репутация отражает методы; внимание следствия показывает текущий риск.</p><label class="eyebrow" for="name-input">Ваше имя</label><form id="name-form" class="name-form"><input id="name-input" maxlength="40" value="${safe(s.name)}" required aria-label="Имя адвоката"><button class="secondary" type="submit">Сохранить</button></form><div class="career-stats"><div><b>${s.wins}/${s.completed.length}</b><span>Выиграно дел</span></div><div><b>${s.shadow}</b><span>Теневая репутация</span></div><div><b>${s.suit&&s.wear>0?12:0}</b><span>Имидж</span></div></div><div class="section-head"><h3>Районы Новореченска</h3></div><div class="map">${['Пригород','Старый порт','Речной район','Деловой квартал','Холм'].map((label,i)=>`<div class="district ${s.stage>=1+i*2?'open':''}">${label}<br><small>Глава ${1+i*2}</small></div>`).join('')}</div><div class="career-grid"><article class="career-card"><h3>Свой офис</h3><p>Место для помощника. Открытие — 30 000 ₽; аренда дороже на 4 000 ₽ в неделю. Доступен после двух дел.</p>${btn(s.office?'Офис открыт':'Открыть офис','buy-office','secondary',!!s.office||s.completed.length<2||s.training)}</article><article class="career-card"><h3>Помощник аналитика</h3><p>Два одновременных поручения Ирине, каждое на день быстрее. Наём — 18 000 ₽; зарплата — 5 000 ₽ в неделю.</p>${btn(s.assistant?'В штате':'Нанять помощника','buy-assistant','secondary',s.assistant||!s.office||s.training)}</article><article class="career-card"><h3>Деловой костюм</h3><p>12 000 ₽. Имидж +12 и +2 балла в суде. Состояние уменьшается на 15% за дело; изношенный костюм не даёт бонуса.</p>${s.suit?`<p>Состояние: ${s.wear}%</p>${btn('Уход за костюмом · 3 000 ₽','buy-repair','secondary',s.wear===100||s.training)}`:btn('Приобрести костюм','buy-suit','secondary',s.training)}</article><article class="career-card"><h3>Содержание практики</h3><p>Следующее списание: день ${nextBill()}. Всего ${money(game.weeklyCost())} за семь игровых дней. Расходы видны в банке.</p>${btn('Открыть банк →','bank','secondary')}</article></div><div class="hint">В этой кампании вы ведёте одно дело. Персонал расширяет очередь поручений. Другие города, несколько дел одновременно и коллегии — следующие этапы.</div>`;
  }
  function newsView() {return `<div class="eyebrow">Городская хроника</div><h2 class="section-title">Что происходит за окном.</h2>${game.s.news.map(n=>`<article class="news"><small>ДЕНЬ ${n.day} / ВАША ПРАКТИКА</small><h3>${safe(n.title)}</h3><p>${safe(n.body)}</p></article>`).join('')}<article class="news"><small>ГОРОД / РАССЛЕДОВАНИЕ</small><h3>Чей берег — Северный?</h3><p>Название холдинга всё чаще появляется в спорах пригорода и порта. Отдельные дела могут оказаться частями одной истории.</p></article><article class="news"><small>ОБЩЕСТВО / ЮРИДИЧЕСКАЯ КЛИНИКА</small><h3>Помощь тем, кто не может заплатить</h3><p>Бесплатная защита повышает известность и снижает внимание властей. Все расходы адвокат оплачивает сам. Собранные улики действующего расследования сохраняются.</p></article>`;}
  function mailView() {return `<div class="eyebrow">Входящие / ${game.s.mail.length} писем</div><h2 class="section-title">Почта практики</h2>${game.s.active?btn('Открыть активное досье →','dossier','primary'):btn('Выбрать следующее дело →','cases','primary')}${game.s.mail.map(m=>`<article class="mail"><small>${safe(m.from)} / ДЕНЬ ${m.day}</small><h3>${safe(m.title)}</h3><p>${safe(m.body)}</p></article>`).join('')}`;}
  function resultView(r=game.s.result) {
    if(!r)return empty('Результатов пока нет','Первый разбор появится после заседания.');
    return `<div class="eyebrow">${r.training?'Тренировочный ':''}Итог заседания</div><div class="result-hero ${r.won?'':'fail'}"><div><h2 class="section-title">${r.late?'Слушание пропущено.':r.won?'Защита сработала.':'Доводов не хватило.'}</h2><p class="section-lead" style="margin:0">${safe(r.title)}</p></div><div><span class="result-score">${r.score}%</span><small>Цель: ${r.target}%</small></div></div>${r.late?'<div class="hint warning">Дело проиграно из-за пропуска заседания независимо от качества подготовки.</div>':''}<div class="section-head"><h3>Из чего сложился результат</h3></div>${r.rows.map(row=>`<div class="result-row"><span>${safe(row.label)}</span><b class="${row.value<0?'negative':''}">${row.value>0?'+':''}${row.value}</b></div>`).join('')}<div class="result-finance">Гонорар: <strong>${money(r.fee)}</strong><br>Известность +${r.repGain} · профессионализм +${r.professionalGain}<br>Личные вложения: ${money(r.invested)}<br>Возвращено клиенту: ${money(r.returned)}${r.training?'<br><strong>Все изменения относятся только к тренировке. Карьера сохранена.</strong>':''}</div>${r.training?btn('Вернуться в карьеру →','leave-training','primary'):btn(game.s.campaignComplete?'Открыть итоги кампании →':'Следующая глава →','cases','primary')}`;
  }
  function nextBill(){return 1+7*(Math.floor((game.s.day-1)/7)+1);}
  function phoneView() {
    const s=game.s,a=s.active;
    if(ui.phone==='bank')return `<div class="bank"><span class="eyebrow">Личный расчётный счёт</span><div class="balance">${money(s.money)}</div><div class="bank-card">КАПИТАЛ / ЧАСТНАЯ ПРАКТИКА<span>•••• 0418 &nbsp; Новореченский банк</span></div>${a?`<div class="budget-card"><span class="eyebrow">Бюджет клиента / отдельно</span><b>${money(a.budget)}</b><p>Получено ${money(a.initialBudget)}. Остаток после суда вернётся клиенту. Личные вложения: ${money(a.invested)}.</p><label class="funding"><input id="personal-funding" type="checkbox" ${a.personalFunding?'checked':''}><span>Разрешить оплату сверх бюджета с личного счёта</span></label><p>Перед поручением показано, сколько спишется с каждого счёта.</p></div>`:''}<div class="bill-info">Расходы за неделю: ${money(game.weeklyCost())}<br>Аренда ${money(s.office?7000:3000)} · персонал ${money(s.assistant?5000:0)}<br>Следующее списание: день ${nextBill()}${s.debt?`<br><strong>Задолженность: ${money(s.debt)}</strong><br>${btn('Погасить долг','debt','text-button',!s.money)}`:''}</div><div class="section-head"><span class="eyebrow">История операций</span></div>${(ui.allTransactions?s.transactions:s.transactions.slice(0,8)).map(t=>`<div class="transaction"><div>${safe(t.name)}<small>День ${t.day} · ${t.account==='personal'?'Личный счёт':'Бюджет клиента'}</small></div><span class="${t.amount<0?'out':''}">${t.amount>0?'+':''}${money(t.amount)}</span></div>`).join('')}${s.transactions.length>8?btn(ui.allTransactions?'Свернуть историю':'Все операции','transactions','transactions-toggle'):''}</div>`;
    const agent=ui.agent,contacts=['mark','irina',...(s.stage>=3||s.training?['contact']:[])],busy=a?.pending.filter(t=>ORDERS[t.key].agent===agent).length||0;
    const chat=s.chats[agent].slice(-3);
    const orders=Object.entries(ORDERS).filter(([,o])=>o.agent===agent);
    return `<div class="contact"><div class="avatar">${agent==='mark'?'МВ':agent==='irina'?'ИЛ':'••'}</div><div><select id="agent-select" aria-label="Исполнитель">${contacts.map(k=>`<option value="${k}" ${agent===k?'selected':''}>${names[k]}</option>`).join('')}</select><small>${busy?`В работе: ${busy}`:agent==='mark'?'Частный детектив':agent==='irina'?'Аналитик'+(s.assistant?' + помощник':''):'Теневые поручения'}</small></div></div><div class="chat">${chat.length?chat.map(m=>`<div class="bubble ${m.mine?'mine':''}">${safe(m.text)}<small>${m.mine?'Вы':'Получено'} · день ${m.day}</small></div>`).join(''):`<div class="bubble">${a?'Готов принять поручение. Результаты появятся после перехода дня.':'Сначала заключите договор с клиентом. Затем сможем начать работу.'}<small>${names[agent]}</small></div>`}</div><div class="orders"><div class="eyebrow">Поручения по делу ${a?'№ '+safe(game.definition.no):''}</div>${orders.map(([key,o])=>{const q=game.quote(key),blocked=game.orderBlock(key);return `<button class="order ${o.heat?'illegal':''}" data-order="${key}" ${blocked?'disabled':''}><strong>${o.label}</strong><small>${money(o.cost)} · ${o.ap} ОД · ${q?q.days:o.days} дн.</small>${q?`<small>Клиент ${money(q.client)} · вы ${money(q.personal)}</small>`:''}${o.heat?'<small class="risk">Незаконно · риск расследования</small>':''}${blocked?`<small>${safe(blocked)}</small>`:''}</button>`;}).join('')}</div><p class="phone-tip">${a?.ap===0?'ОД закончились. Дождитесь запущенных поручений, составьте план и идите в суд.':'Поручения идут параллельно вашей подготовке. У каждого исполнителя своя очередь.'}${a?`<br>${btn('Проверить бюджет →','bank','text-button')}`:''}</p>`;
  }
  let roomSettings={quality:'auto',motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,newsPaused:false},caseNotes={},archivedId=null;
  const roomIcons={
    cases:'M5 7h14v14H5z M8 3v7 M16 3v7 M5 12h14',dossier:'M3 7h7l2 3h9v10H3z M3 7V4h7l2 3',witness:'M8 10a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 22v-2a8 8 0 0 1 16 0v2',evidence:'M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M15 15l7 7 M7 9h6 M10 6v6',actions:'M4 5h16v14H4z M8 2v6 M16 2v6 M8 12l3 3l5-5',notes:'M4 3h14v18H4z M8 7h6 M8 11h5 M8 15h4 M19 5l3 3-6 6-3 1 1-3z',plan:'M3 5h7v5H3z M14 15h7v5h-7z M6 10v8h8 M17 3v7 M14 7l3 3 3-3',mail:'M3 5h18v14H3z M3 6l9 7 9-7',bank:'M3 8l9-6 9 6z M5 10v9 M10 10v9 M15 10v9 M20 10v9 M2 22h20',settings:'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M10 2h4l1 4 3-1 3 4-3 3 3 3-3 4-3-1-1 4h-4l-1-4-3 1-3-4 3-3-3-3 3-4 3 1z',shop:'M4 8h16l-1 13H5z M8 8V6a4 4 0 0 1 8 0v2',archive:'M3 3h18v5H3z M5 8v13h14V8 M9 12h6',city:'M3 5l6-3 6 3 6-3v17l-6 3-6-3-6 3z M9 2v17 M15 5v17',wardrobe:'M9 3l3 2 3-2 6 4-3 5-2-1v11H8V11l-2 1-3-5z',chat:'M3 3h18v14H9l-6 5z M7 7h10 M7 11h7',career:'M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M4 22v-3a8 8 0 0 1 16 0v3'};
  function roomIcon(key){key=({laptop:'cases',phone:'chat'})[key]||key;return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${roomIcons[key]||roomIcons.dossier}"/></svg>`;}
  const laptopSurface=$('.laptop'),phoneSurface=$('.phone-inner');
  const laptopHome=laptopSurface.parentElement,phoneHome=phoneSurface.parentElement;
  let viewScroll={},lastDeskKey=null,lastPhoneKey=null;
  function spatialAvailable(){return !!globalThis.OfficeRoom&&!globalThis.OfficeRoom.diagnostics().fallback;}
  function selectDevice(device){ui.device=device;ui.focus=device;ui.room=spatialAvailable();}
  function openRoomView(view){
    if(view==='room'){ui.room=true;ui.focus=null;return;}
    if(view==='laptop'||view==='phone'){selectDevice(view);return;}
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
    $('#room-focus-title').textContent=(ui.focus==='phone'?'Личная линия':'Рабочий ноутбук')+' · день '+game.s.day+(game.s.active?' · '+game.s.active.ap+' ОД':'');
    for(const button of $('#room-focus-bar').querySelectorAll('[data-room-view]'))button.setAttribute('aria-pressed',String(button.dataset.roomView===ui.focus));
    globalThis.OfficeRoom?.setFocus(ui.room?ui.focus:null);
  }
  window.addEventListener('office:unavailable',()=>{if(ui.room&&ui.focus){ui.room=false;render();}});
  function renderRoom(){
    const s=game.s,a=s.active,c=game.definition;
    $('#room-day').textContent=s.day;$('#room-rep').textContent=s.rep;$('#room-ap').textContent=a?a.ap+' / '+a.apMax:'—';$('#room-money').textContent=money(s.money);
    $('#room-case-summary').textContent=c?`Дело № ${c.no} · ${c.title} · заседание в день ${a.deadline}`:s.campaignComplete?'Северный берег завершён. Дела и ваша история — в архиве.':'Каждое дело начинается за этим столом.';
    const tiles=[['dossier','Досье','Документы клиента'],['witness','Свидетели','Беседы и показания'],['evidence','Улики','Собранные материалы'],['actions','Поручения','Работа исполнителей'],['notes','Блокнот','Заметки и анализ'],['plan','План защиты','Ваша позиция в суде']];
    $('#room-laptop-home').innerHTML=`<div class="os-top"><span class="os-seal">ХА</span><span>ЧАСТНАЯ ПРАКТИКА</span><span>09:41</span></div><button class="os-current" data-room-view="cases"><span>${c?'ДЕЛО № '+safe(c.no):'СЕВЕРНЫЙ БЕРЕГ'}</span><strong>${c?safe(c.title):s.campaignComplete?'Архив вашей практики':'Выберите первое дело'}</strong><b>↗</b></button><div class="os-apps">${tiles.map(([key,title,sub])=>`<button data-room-view="${key}" class="os-app">${roomIcon(key)}<strong>${title}</strong><span>${sub}</span></button>`).join('')}</div><nav class="os-dock" aria-label="Программы ноутбука">${[['mail','Почта'+(s.unread?' · '+s.unread:'')],['bank','Финансы'],['settings','Настройки'],['shop','Магазин']].map(([key,title])=>`<button data-room-view="${key}">${roomIcon(key)}<span>${title}</span></button>`).join('')}</nav><div class="os-bottom"><span>День ${s.day}${a?' · '+a.ap+' ОД':''}</span><button data-room-day="true" ${!a&&!s.investigation?'disabled':''}>${a&&s.day>=a.deadline?'Срок суда истекает':'Следующий день'} →</button></div>`;
    $('#room-mobile-programs').innerHTML=tiles.map(([key,title,sub])=>`<button data-room-view="${key}">${roomIcon(key)}<strong>${title}</strong></button>`).join('')+`<div class="room-mobile-dock">${[['mail','Почта'],['bank','Финансы'],['settings','Настройки'],['shop','Магазин']].map(([key,title])=>`<button data-room-view="${key}">${roomIcon(key)}<strong>${title}</strong></button>`).join('')}</div>`;
    $('#room-shortcuts').innerHTML=[['laptop','Ноутбук','Дела и подготовка'],['dossier','Папка дела','Текущие материалы'],['archive','Архив','История практики'],['phone','Телефон','Связь с детективами'],['notes','Перьевая ручка','Ваш блокнот'],['wardrobe','Зеркало','Одежда и имидж'],['career','Профиль','Развитие практики'],['city','Карта города','Районы и дела']].map(([key,title,sub])=>`<button data-room-view="${key}">${roomIcon(key)}<span><strong>${title}</strong><small>${sub}</small></span><b>↗</b></button>`).join('');
    if(!$('#room-object-labels').childElementCount){
      const labels=[['Desk',null,'Письменный стол'],['Laptop','laptop','Ноутбук · дела и подготовка'],['BankersLamp',null,'Настольная лампа'],['Bookshelf','archive','Архивный шкаф · история практики'],['Phone','phone','Телефон · переписка и банк'],['Cactus',null,'Кактус'],['Mirror','wardrobe','Зеркало · деловой имидж'],['CityMap','city','Карта города'],['Lawyer','career','Профиль адвоката'],['TripoChair','career','Кресло адвоката · профиль'],['FolderCurrent','dossier','Папка текущего дела'],['FolderArchive','archive','Архив завершённых дел'],['FountainPen','notes','Перьевая ручка · блокнот']];
      $('#room-object-labels').innerHTML=labels.map(([object,view,title])=>{const tag=view?'button':'span';return `<${tag} class="room-object-label" data-object="${object}" ${view?`data-room-view="${view}"`:'tabindex="0"'} hidden><span aria-hidden="true"></span>${title}</${tag}>`;}).join('');
    }
    const news=s.news.slice(0,3).map(n=>n.title).join('   /   ')||'Холдинг «Северный берег» расширяет влияние в городе.   /   Юридическая клиника ищет защитников для жителей пригорода.';
    $('#room-news-text').textContent=news;$('#room-news-text').style.animationPlayState=roomSettings.newsPaused||!roomSettings.motion?'paused':'running';$('#room-news-pause').setAttribute('aria-pressed',String(roomSettings.newsPaused));$('#room-news-pause').textContent=roomSettings.newsPaused?'▶':'Ⅱ';$('#room-news-pause').setAttribute('aria-label',roomSettings.newsPaused?'Продолжить бегущую строку':'Приостановить бегущую строку');
    $('#room-alert').hidden=!s.investigation;
    if(s.investigation)$('#room-alert').innerHTML=`<strong>Расследование против вас.</strong> Сила обвинения ${s.investigation.evidence}/100. Решение в день ${s.investigation.due}. <button data-room-view="cases">Открыть материалы →</button>`;
    root.dataset.roomMotion=String(roomSettings.motion);
    globalThis.OfficeRoom?.mount({viewport:$('#room-viewport'),canvasHost:$('#room-webgl'),cssHost:$('#room-css3d'),screenElement:$('#room-screen'),phoneElement:$('#room-phone-screen'),onOpen:view=>{if(screen==='game'&&$('#overlay').hidden){openRoomView(view);render();}},quality:roomSettings.quality});
    globalThis.OfficeRoom?.sync();
  }
  function evidenceView(){const a=game.s.active;if(!a)return empty();const materials=a.materials.filter(m=>m.id!=='witness');return `<div class="eyebrow">Дело № ${safe(game.definition.no)} / Улики</div><h2 class="section-title">Что подтверждено фактами.</h2><p class="section-lead">Проверяйте источник и связь с задачей клиента. Неподтверждённое сообщение может ослабить защиту. Для суда выберите материалы в плане.</p>${tasksView()}<div class="materials">${materials.map(m=>materialCard(m)).join('')}</div>${btn('Открыть план защиты →','plan','primary')}`;}
  function actionsView(){const a=game.s.active;if(!a)return empty();return `<div class="eyebrow">Фоновая работа / ${a.ap} ОД</div><h2 class="section-title">Следственные действия</h2><p class="section-lead">Исполнители работают параллельно вашей подготовке. Поручения расходуют ОД и бюджет; результат приходит в назначенный игровой день.</p>${tasksView()}<div class="room-action-grid">${Object.entries(ORDERS).filter(([,o])=>o.agent!=='contact'||game.s.stage>=3||game.s.training).map(([key,o])=>{const q=game.quote(key),blocked=game.orderBlock(key);return `<article class="material ${o.heat?'risky':''}"><div class="material-top"><h3>${o.label}</h3><span class="tag ${o.heat?'red':''}">${o.heat?'Незаконно':'Законно'}</span></div><p>${names[o.agent]} · ${money(o.cost)} · ${o.ap} ОД · ${q.days} дн.<br>Бюджет клиента ${money(q.client)}; ваши средства ${money(q.personal)}.</p><button class="secondary" data-order="${key}" ${blocked?'disabled':''}>${blocked||'Дать поручение →'}</button></article>`;}).join('')}</div>${btn('Открыть переписку →','phone','text-button')}`;}
  function notesView(){const a=game.s.active;if(!a)return empty('Блокнот ждёт первое дело','Примите дело: здесь можно будет записать свою версию событий и проверить несостыковку.');const c=game.definition,key=(game.s.training?'training:':'career:')+a.id;return `<div class="eyebrow">Личный блокнот / ${safe(c.client)}</div><h2 class="section-title">Мысли, которые стоит сохранить.</h2><p class="section-lead">Заметки не тратят ОД. Они остаются в текущей сессии при переходах между кабинетом и разделами.</p><label class="room-field-label" for="case-notes">Ваши заметки по делу</label><textarea id="case-notes" data-note-key="${key}" rows="7" maxlength="4000" placeholder="Версия событий, вопросы свидетелю, порядок выступления…">${safe(caseNotes[key]||'')}</textarea><p id="notes-state" class="section-lead">Сохраняется в этой сессии.</p><section class="puzzle"><span class="eyebrow">Анализ / необязательный бонус</span><h3>Найти несостыковку</h3><p>${safe(c.puzzle.prompt)}</p>${a.puzzleAttempted?`<div class="hint ${a.puzzleSolved?'':'warning'}">${a.puzzleSolved?'Заметка добавлена в досье.':'Бонус не получен.'}<br>${safe(c.puzzle.explanation)}</div>`:`<div class="choices">${c.puzzle.options.map((answer,i)=>`<button class="option" data-puzzle="${i}" aria-pressed="${a.puzzleChoice===i}" ${!game.canSpend(1)?'disabled':''}>${safe(answer)}</button>`).join('')}</div>${btn('Проверить · 1 ОД','solve','secondary',a.puzzleChoice===null||!game.canSpend(1))}`}</section>`;}
  function archiveView(){const s=game.s;return `<div class="eyebrow">Архив / ${s.completed.length} дел</div><h2 class="section-title">История вашей практики.</h2><p class="section-lead">Здесь хранятся результаты процессов. После завершения кампании доступны тренировочные повторы без изменения карьерных ресурсов.</p>${s.completed.length?`<div class="materials">${s.completed.map(r=>`<article class="material"><div class="material-top"><h3>${safe(r.title)}</h3><span class="tag ${r.won?'green':'red'}">${r.won?'Успех':'Неудача'} · ${r.score}%</span></div><p>День ${r.day} · гонорар ${money(r.fee)}</p><button class="secondary" data-archive-id="${r.id}">Разбор заседания →</button>${s.campaignComplete?`<button class="text-button" data-training="${r.id}" ${s.investigation?'disabled':''}>Переиграть без изменения карьеры →</button>`:''}</article>`).join('')}</div>`:'<div class="hint">Первая папка появится после завершения дела.</div>'}${btn('К доступным делам →','cases','primary')}`;}
  function archivedView(){const record=game.s.completed.find(r=>r.id===archivedId);return record?`<button class="text-button" data-room-view="archive">← Вернуться в архив</button>${resultView(record)}`:archiveView();}
  function cityView(){const s=game.s,regions=[['Пригород',1,'Первые клиенты и небольшие дела'],['Старый порт',3,'Следы, ведущие к холдингу'],['Речной район',5,'Люди, которые знают слишком много'],['Деловой квартал',7,'Деньги, документы и репутация'],['Правительственный холм',9,'Последние звенья истории']];return `<div class="eyebrow">Новореченск / карта города</div><h2 class="section-title">У каждого района — свои дела.</h2><p class="section-lead">Карьера открывает следующие главы. Сейчас ${s.campaignComplete?'кампания завершена':'глава '+s.stage+' из 10'}; вы ведёте одно дело за раз.</p><div class="room-districts">${regions.map(([title,chapter,desc])=>`<article class="material ${s.stage>=chapter?'selected':''}"><div class="material-top"><h3>${title}</h3><span class="tag">С главы ${chapter}</span></div><p>${desc}</p>${s.stage>=chapter&&s.stage<chapter+2&&!s.campaignComplete?'<button class="primary" data-room-view="cases">Дела текущей главы →</button>':`<p><small>${s.stage>=chapter?'Район открыт':'Откроется по ходу кампании'}</small></p>`}</article>`).join('')}</div>${s.campaignComplete?'<button class="primary" data-room-view="archive">Открыть архив →</button>':''}`;}
  function wardrobeView(){const s=game.s;return `<div class="eyebrow">Зеркало / гардероб</div><h2 class="section-title">Ваш деловой облик.</h2><div class="room-wardrobe"><img src="${portrait}" alt="Портрет адвоката в деловом костюме"><div><h3>${safe(s.name)}</h3><p class="section-lead">${s.suit?'Деловой костюм · состояние '+s.wear+'%':'Базовый костюм начинающего адвоката'}</p><div class="hint">Деловой костюм даёт +12 к имиджу и +2 балла в суде, пока его состояние выше нуля. Каждое дело изнашивает костюм на 15%.</div>${s.suit?btn('Уход за костюмом · 3 000 ₽','buy-repair','secondary',s.wear===100||s.training):btn('Приобрести костюм · 12 000 ₽','buy-suit','primary',s.training)}<p class="section-lead" style="margin-top:16px">Покупки оплачиваются только с личного счёта. Они доступны при отсутствии задолженности.</p><button class="text-button" data-room-view="career">Развитие практики →</button></div></div>`;}
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
    syncDeviceSurfaces();
    $('#chapter-label').textContent=s.training?'Тренировочное дело':s.campaignComplete?'Северный берег · кампания завершена':`Северный берег · глава ${s.stage} / 10`;
    $('#day-label').textContent='День '+s.day;$('#district-label').textContent=c?.district||'Новореченск';$('#lawyer-name').textContent=s.name;
    for(const key of ['rep','professional','heat']){$('#'+key).textContent=s[key];$('#'+key+'-bar').style.width=s[key]+'%';}
    $('#mail-badge').textContent=s.unread;$('#mail-badge').hidden=!s.unread;$('#phone-badge').textContent=a?.pending.length?'· '+a.pending.length:'';
    $('#training-banner').hidden=!s.training;
    for(const attr of ['desk','phone','device'])root.querySelectorAll('button[data-'+attr+']').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[attr]===ui[attr])));
    const strip=$('#case-strip');strip.hidden=!a;
    if(a)strip.innerHTML=`<strong>№ ${safe(c.no)} · ${safe(c.title)}</strong><div><span>Суд: день ${a.deadline}${s.day===a.deadline?' · сегодня':''}</span><span class="ap ${!a.ap?'empty':''}"><b>${a.ap}</b> / ${a.apMax} ОД</span></div>`;
    const views={cases:casesView,dossier:dossierView,witness:witnessView,plan:planView,career:careerView,news:newsView,mail:mailView,result:resultView,evidence:evidenceView,actions:actionsView,notes:notesView,archive:archiveView,archiveDetail:archivedView,city:cityView,wardrobe:wardrobeView,shop:careerView,settings:settingsView};
    $('#desktop-content').innerHTML=(views[ui.desk]||casesView)();$('#desk-app-select').value='';
    $('#phone-content').innerHTML=phoneView();
    const session=(s.training?'training:':'career:')+(a?.id||'none');
    lastDeskKey=session+':desk:'+ui.desk;lastPhoneKey=session+':phone:'+ui.phone+':'+ui.agent;
    desktop.scrollTop=viewScroll[lastDeskKey]||0;phoneContent.scrollTop=viewScroll[lastPhoneKey]||0;
    $('#phone-title').textContent=ui.phone==='bank'?'Капитал':'Контакты';
    $('#court-button').disabled=!a||!game.planOpen()||!!s.ending;$('#court-button').textContent='В суд →';
    $('#day-button').disabled=!!s.ending||(!a&&!s.investigation);$('#day-button').textContent=a&&s.day>=a.deadline?'Завершить день · пропуск суда':'Следующий день →';
    $('#footer-label').textContent=a?s.day>=a.deadline?'Заседание сегодня. Следующий день означает поражение.':!a.ap?'ОД закончились; поручения продолжают выполняться.':`Подготовка до дня ${a.deadline}. ОД не восстанавливаются.`:'Время идёт только по вашей команде.';
    const p=s.investigation;$('#investigation').hidden=!p;
    if(p)$('#investigation').innerHTML=`<h3>Дело против вас</h3><p>Сила обвинения ${p.evidence}/100. Решение в день ${p.due}. От 50 — штраф; от 75 — тюрьма. Снижение внимания не убирает собранные улики.</p>${p.defended?'<p>Независимая защита уже учтена.</p>':btn('Нанять защитника · 25 000 ₽ · 1 день','defend','secondary',s.money<25000)}`;
    $('#notice').textContent=s.notice;
    globalThis.OfficeRoom?.setActive(screen==='game'&&!!ui.room&&!s.ending&&$('#overlay').hidden);
    if(s.ending&&screen==='game')showPrison();
  }
  function clearOverlay() {movieToken++;finishMovie=null;const v=$('#court-video');if(v)v.pause();$('#overlay').hidden=true;$('#overlay').innerHTML='';$('#workspace').inert=false;}
  function showMenu() {globalThis.OfficeRoom?.setActive(false);clearOverlay();game.cancelCourt();screen='menu';$('#menu').hidden=false;$('#workspace').hidden=true;$('[data-action="continue"]').hidden=!started||(!!game.s.ending&&!game.s.training);$('#rules').hidden=true;$('[data-action="rules"]').setAttribute('aria-expanded','false');window.scrollTo(0,0);$('[data-action="new-game"]').focus({preventScroll:true});}
  function enterGame() {screen='game';$('#menu').hidden=true;$('#workspace').hidden=false;render();window.scrollTo(0,0);$('[data-action="menu"]').focus({preventScroll:true});}
  function newGame() {clearOverlay();game.reset();ui={desk:'cases',phone:'chat',agent:'mark',device:'laptop',allTransactions:false,room:true,focus:null};caseNotes={};viewScroll={};lastDeskKey=null;lastPhoneKey=null;roomSettings={quality:'auto',motion:!matchMedia('(prefers-reduced-motion: reduce)').matches,newsPaused:false};globalThis.OfficeRoom?.setView('reset');globalThis.OfficeRoom?.setQuality(roomSettings.quality);globalThis.OfficeRoom?.setMotion(roomSettings.motion);started=true;enterGame();}
  function openOverlay(html) {globalThis.OfficeRoom?.setActive(false);$('#overlay').innerHTML=html;$('#overlay').hidden=false;$('#workspace').inert=true;$('#overlay').querySelector('button')?.focus();}
  function showCourt() {
    if(!game.beginCourt().ok){render();return;}
    const c=game.definition,s=game.s,selected=game.plan().map(id=>safe(s.active.materials.find(m=>m.id===id).title)).join(' → ')||'Материалы не выбраны';
    openOverlay(`<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="court-title"><div class="eyebrow">Заседание / ${safe(c.judge.name)}</div><h2 id="court-title">${s.rep>=45?safe(s.name)+', ваша позиция.':'Господин адвокат, ваша позиция.'}</h2><p>${selected}</p><p>${safe(c.court.prompt)}</p><div class="choices">${c.court.options.map((o,i)=>`<button class="option" data-court-answer="${i}"><span class="letter">0${i+1}</span>${safe(o)}</button>`).join('')}</div>${btn('Вернуться к подготовке','cancel-court','secondary')}</section>`);
  }
  function cinema() {
    const c=game.definition,token=++movieToken;
    openOverlay(`<section class="dialog cinema" role="dialog" aria-modal="true" aria-labelledby="film-title"><video id="court-video" playsinline preload="auto" poster="${portrait}" src="${videoSource}" aria-label="Судебная сцена продолжительностью восемь секунд"></video><div><div class="eyebrow">Ключевой момент / 8 секунд</div><h2 id="film-title">Последнее слово защиты.</h2><p>${safe(c.title)}<br>Суд рассматривает ваши материалы и ответ.</p><div class="film-progress"><span id="film-bar"></span></div><div id="film-time" class="film-time">00:00 / 00:08</div><div class="dialog-actions">${btn('К результату →','skip','secondary')}${btn('В меню','menu','secondary')}<button class="secondary" data-action="play" hidden>Включить видео</button></div></div></section>`);
    const v=$('#court-video');
    finishMovie=()=>{if(token!==movieToken)return;clearOverlay();game.finishCourt();navigate('result');render();$('#desktop-content').scrollTop=0;};
    v.addEventListener('ended',()=>{if(token===movieToken)finishMovie?.();});
    v.addEventListener('timeupdate',()=>{if(token!==movieToken||$('#court-video')!==v)return;$('#film-bar').style.width=Math.min(100,v.currentTime/8*100)+'%';$('#film-time').textContent='00:'+String(Math.min(8,Math.floor(v.currentTime))).padStart(2,'0')+' / 00:08';if(v.currentTime>=8)finishMovie?.();});
    v.addEventListener('error',()=>{if(token===movieToken&&$('#film-time'))$('#film-time').textContent='Видео недоступно. Нажмите «К результату».';});
    v.play().catch(()=>{if(token===movieToken&&$('[data-action="play"]'))$('[data-action="play"]').hidden=false;});
  }
  function showPrison(){if($('#prison-title'))return;openOverlay(`<section class="dialog prison" role="dialog" aria-modal="true" aria-labelledby="prison-title"><div class="eyebrow">Дело против адвоката / финал</div><h2 id="prison-title">Теперь вы —<br>подзащитный.</h2><p>Следствие доказало систематическое вмешательство в показания. Суд назначил тюремное заключение. Практика закрыта.</p><p>День ${game.s.day} · завершено дел: ${game.s.completed.length} · известность: ${game.s.rep}</p><div class="dialog-actions">${game.s.training?btn('Вернуться в карьеру','leave-training','primary'):btn('Новая игра','new-game','primary')}${btn('Главное меню','menu','secondary')}</div></section>`);}
  function navigate(desk){ui.desk=desk;selectDevice('laptop');if(desk==='mail')game.s.unread=0;}
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
    const previous=game.s.result;
    if(b.dataset.roomView)openRoomView(b.dataset.roomView);
    else if(b.dataset.roomCamera){if(b.dataset.roomCamera==='reset'){openRoomView('room');globalThis.OfficeRoom?.setView('reset');}else globalThis.OfficeRoom?.setView(b.dataset.roomCamera);}
    else if(b.dataset.roomNewsPause){roomSettings.newsPaused=!roomSettings.newsPaused;}
    else if(b.dataset.roomDay){game.nextDay();}
    else if(b.dataset.archiveId){archivedId=b.dataset.archiveId;navigate('archiveDetail');}
    else if(action==='room')openRoomView('room');
    else if(b.dataset.desk)navigate(b.dataset.desk);
    else if(b.dataset.phone){ui.phone=b.dataset.phone;selectDevice('phone');}
    else if(b.dataset.device)selectDevice(b.dataset.device);
    else if(b.dataset.offer){game.offer(b.dataset.offer);navigate('mail');}
    else if(b.dataset.probono){game.offer(b.dataset.probono,true);navigate('mail');}
    else if(b.dataset.order)game.order(b.dataset.order);
    else if(b.dataset.approach)game.chooseApproach(b.dataset.approach);
    else if(b.dataset.question)game.question(b.dataset.question);
    else if(b.dataset.puzzle!==undefined)game.puzzleSelect(Number(b.dataset.puzzle));
    else if(b.dataset.material)game.toggleMaterial(b.dataset.material);
    else if(b.dataset.line)game.setLine(b.dataset.line);
    else if(b.dataset.up)game.move(b.dataset.up,-1);
    else if(b.dataset.down)game.move(b.dataset.down,1);
    else if(b.dataset.training){if(game.training(b.dataset.training).ok){ui.desk='dossier';ui.agent='mark';ui.phone='chat';}}
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
    if(b.dataset.device||action==='phone'||action==='bank')window.scrollTo(0,0);
  });
  root.addEventListener('change',e=>{if(e.target.id==='desk-app-select'){navigate(e.target.value);render();$('#desk-app-select').focus();}else if(e.target.id==='agent-select'){ui.agent=e.target.value;render();$('#agent-select').focus();}else if(e.target.id==='personal-funding'&&game.s.active){game.s.active.personalFunding=e.target.checked;game.say(e.target.checked?'Личные вложения разрешены. Перед поручением показана сумма.':'Оплата ограничена бюджетом клиента.');render();$('#personal-funding').focus();}});
  root.addEventListener('submit',e=>{if(e.target.id==='name-form'){e.preventDefault();const value=$('#name-input').value.trim();if(value){game.s.name=value.slice(0,40);game.say('Имя адвоката обновлено.');render();}}});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&screen==='game'){e.preventDefault();if(!$('#overlay').hidden&&game.s.active?.phase==='court'){clearOverlay();game.cancelCourt();render();}else if(!game.s.ending){if(!ui.room||ui.focus){openRoomView('room');render();}else showMenu();}return;}
    if(e.key==='Tab'&&!$('#overlay').hidden){const nodes=[...$('#overlay').querySelectorAll('button:not([hidden]):not(:disabled)')],first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  });
  if('scrollRestoration'in history)history.scrollRestoration='manual';
  window.addEventListener('pageshow',e=>{if(e.persisted){game.reset();started=false;ui={desk:'cases',phone:'chat',agent:'mark',device:'laptop',allTransactions:false,room:true,focus:null};showMenu();}});
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
