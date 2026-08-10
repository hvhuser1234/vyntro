/* VYNTRO V4.1 — onboarding, role-aware analytics, recovery, hero pool & weekly insights */
(() => {
  const PROBLEM_LABELS={farm:'Фарм',deaths:'Смерти',fights:'Драки',heroes:'Пул героев',consistency:'Нестабильность',unknown:'Не понимаю ошибки'};
  const RANKS=['Crusader','Archon','Legend','Ancient','Divine','Immortal'];
  const q=s=>document.querySelector(s);
  const avgOf=(arr,k)=>arr.reduce((s,m)=>s+(+m[k]||0),0)/Math.max(1,arr.length);
  const wrOf=arr=>arr.filter(win).length/Math.max(1,arr.length)*100;
  const kdaOf=arr=>{const k=avgOf(arr,'kills'),a=avgOf(arr,'assists'),d=avgOf(arr,'deaths');return(k+a)/Math.max(.75,d)};
  const signed=n=>`${n>0?'+':''}${n}`;

  function addAuthExtras(){
    const card=q('.auth-card'); if(!card||q('#forgotPassword')) return;
    const btn=document.createElement('button');btn.id='forgotPassword';btn.className='link-btn';btn.type='button';btn.textContent='Забыли пароль?';
    const status=q('#authStatus');card.insertBefore(btn,status);
    const live=document.createElement('div');live.id='steamBackendState';live.className='backend-state';live.textContent='Steam backend: проверка…';card.appendChild(live);
    btn.onclick=async()=>{
      const email=q('#email').value.trim();
      if(!/^\S+@\S+\.\S+$/.test(email))return authStatus('Сначала введи почту аккаунта.','error');
      authStatus('Отправляю письмо…');
      const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:SITE_URL});
      if(error)return authStatus(cleanError(error),'error');
      authStatus('Ссылка для сброса пароля отправлена на почту.','ok');
    };
    checkSteamBackend().then(ok=>{live.textContent=ok?'Steam backend: ONLINE':'Steam backend: недоступен';live.classList.toggle('online',ok)});
  }

  function ensureModals(){
    if(!q('#onboardingModal'))document.body.insertAdjacentHTML('beforeend',`
      <div id="onboardingModal" class="v41-modal hidden" aria-hidden="true"><div class="v41-backdrop"></div><div class="v41-modal-card">
        <div class="eyebrow">ПЕРВЫЕ 60 СЕКУНД</div><h2>Настроим твой путь</h2><p class="muted">VYNTRO будет учитывать роль, цель и твою главную проблему при выборе фокуса.</p>
        <label class="field"><span>Как тебя называть</span><input id="onbName" maxlength="24" placeholder="Ник или имя"></label>
        <div class="onb-grid"><label class="field"><span>Основная роль</span><select id="onbRole"><option>Carry</option><option>Mid</option><option>Offlane</option><option>Soft Support</option><option>Hard Support</option></select></label>
        <label class="field"><span>Целевой ранг</span><select id="onbRank">${RANKS.map(x=>`<option>${x}</option>`).join('')}</select></label></div>
        <div class="onb-grid"><label class="field"><span>Сколько ranked-игр в неделю</span><select id="onbGames"><option value="1-3">1–3</option><option value="4-10">4–10</option><option value="10+">10+</option></select></label>
        <label class="field"><span>Что мешает сильнее всего</span><select id="onbProblem"><option value="unknown">Не понимаю ошибки</option><option value="farm">Фарм</option><option value="deaths">Часто умираю</option><option value="fights">Драки</option><option value="heroes">Не понимаю пул героев</option><option value="consistency">Нестабильность</option></select></label></div>
        <div class="onb-actions"><button id="onbSave" class="primary">Сохранить и продолжить</button><button id="onbSteam" class="steam">Сохранить и подключить Steam</button></div>
        <div id="onbStatus" class="status"></div>
      </div></div>`);
    if(!q('#recoveryModal'))document.body.insertAdjacentHTML('beforeend',`
      <div id="recoveryModal" class="v41-modal hidden" aria-hidden="true"><div class="v41-backdrop"></div><div class="v41-modal-card small">
        <div class="eyebrow">БЕЗОПАСНОСТЬ</div><h2>Новый пароль</h2><label class="field"><span>Пароль</span><input id="newPassword" type="password" placeholder="Минимум 6 символов"></label>
        <button id="saveNewPassword" class="primary wide">Сохранить новый пароль</button><div id="recoveryStatus" class="status"></div>
      </div></div>`);
    q('#onbSave').onclick=()=>saveOnboarding(false);q('#onbSteam').onclick=()=>saveOnboarding(true);q('#saveNewPassword').onclick=saveNewPassword;
  }

  function showModal(id,on=true){const e=q(id);if(!e)return;e.classList.toggle('hidden',!on);e.setAttribute('aria-hidden',String(!on));document.body.classList.toggle('modal-open',on)}
  async function saveOnboarding(connect){
    const name=q('#onbName').value.trim().slice(0,24)||'Игрок';q('#onbStatus').textContent='Сохраняю…';
    try{await updateMeta({display_name:name,role:q('#onbRole').value,target_rank:q('#onbRank').value,games_per_week:q('#onbGames').value,self_problem:q('#onbProblem').value,onboarding_complete:true,onboarding_version:1});showModal('#onboardingModal',false);renderProfile();if(matches.length){analyze();renderAll()}toast('Профиль настроен ✓');if(connect&&!steam64())await steamLogin()}catch(e){q('#onbStatus').textContent=cleanError(e)}
  }
  async function saveNewPassword(){const p=q('#newPassword').value;if(p.length<6)return q('#recoveryStatus').textContent='Минимум 6 символов.';const {error}=await sb.auth.updateUser({password:p});if(error)return q('#recoveryStatus').textContent=cleanError(error);q('#recoveryStatus').textContent='Пароль обновлён ✓';setTimeout(()=>showModal('#recoveryModal',false),700)}

  function maybeOnboard(){if(!user||meta().onboarding_complete||q('#app')?.classList.contains('hidden'))return;const m=meta();q('#onbName').value=m.display_name||'';q('#onbRole').value=m.role||'Carry';q('#onbRank').value=m.target_rank||'Legend';q('#onbGames').value=m.games_per_week||'4-10';q('#onbProblem').value=m.self_problem||'unknown';q('#onbSteam').classList.toggle('hidden',!!steam64());showModal('#onboardingModal',true)}

  function roleAnalyze(){
    if(!matches.length){analysis=null;return}
    const role=meta().role||'Carry';
    const wins=matches.filter(win).length,wr=wins/matches.length*100,gpm=avgOf(matches,'gold_per_min'),xpm=avgOf(matches,'xp_per_min'),deaths=avgOf(matches,'deaths'),kills=avgOf(matches,'kills'),ass=avgOf(matches,'assists'),td=avgOf(matches,'tower_damage'),hd=avgOf(matches,'hero_damage'),kda=(kills+ass)/Math.max(.75,deaths);
    const survival=Math.round(clamp(100-deaths*(role.includes('Support')?8.7:10.2))),stability=Math.round(clamp(62+(wr-50)*.55-Math.max(0,deaths-5)*1.7));let scores={};
    if(role==='Carry')scores={Фарм:Math.round(clamp((gpm-330)/4.0)),Драки:Math.round(clamp(kda*13+Math.min(20,hd/1900))),Выживаемость:survival,Объекты:Math.round(clamp(td/55)),Стабильность:stability};
    else if(role==='Mid')scores={Фарм:Math.round(clamp((gpm-315)/4.2)),Драки:Math.round(clamp(kda*14+Math.min(22,hd/1750))),Выживаемость:survival,Темп:Math.round(clamp((xpm-300)/4.2)),Стабильность:stability};
    else if(role==='Offlane')scores={Драки:Math.round(clamp(kda*15+Math.min(18,hd/2000))),Выживаемость:survival,Объекты:Math.round(clamp(td/60)),Темп:Math.round(clamp((xpm-270)/4.4)),Стабильность:stability};
    else scores={Поддержка:Math.round(clamp(ass*4.2+kda*7)),Выживаемость:survival,Драки:Math.round(clamp(kda*13+Math.min(16,hd/2400))),Темп:Math.round(clamp((xpm-220)/4.2)),Стабильность:stability};
    const low=Object.entries(scores).sort((a,b)=>a[1]-b[1])[0];let mission;
    if(low[0]==='Выживаемость'){const t=Math.max(2,Math.floor(deaths*.82));mission={key:'survival',title:'Снизь смерти',text:`В следующих 3 матчах держи смерти ≤ ${t} за игру.`,baseline:`${deaths.toFixed(1)} смерти`,target:`≤ ${t}`,target_value:t,why:`Для роли ${role} выживаемость сейчас ограничивает стабильность.`}}
    else if(low[0]==='Фарм'){const t=Math.round(gpm*1.07);mission={key:'farming',title:'Подними темп фарма',text:`В следующих 3 матчах держи GPM ≥ ${t}.`,baseline:`${Math.round(gpm)} GPM`,target:`≥ ${t} GPM`,target_value:t,why:`Для ${role} экономика — главный текущий резерв.`}}
    else if(low[0]==='Объекты'){const t=Math.max(1200,Math.round(td*1.15));mission={key:'objectives',title:'Конвертируй преимущество',text:`В следующих 3 матчах цель — tower damage ≥ ${t}.`,baseline:`${Math.round(td)} урона`,target:`≥ ${t}`,target_value:t,why:'Текущие результаты слабо превращаются в урон по строениям.'}}
    else if(low[0]==='Темп'){const t=Math.max(300,Math.round(xpm*1.07));mission={key:'xpm',title:'Держи игровой темп',text:`В следующих 3 матчах держи XPM ≥ ${t}.`,baseline:`${Math.round(xpm)} XPM`,target:`≥ ${t} XPM`,target_value:t,why:`Темп набора опыта ниже остальных измеримых навыков для ${role}.`}}
    else if(low[0]==='Поддержка'){const t=Math.max(8,Math.round(ass*1.1));mission={key:'assists',title:'Больше полезных подключений',text:`В следующих 3 матчах сделай ≥ ${t} assists за игру.`,baseline:`${ass.toFixed(1)} assists`,target:`≥ ${t}`,target_value:t,why:'Для support-роли важнее участие и выживаемость, а не GPM.'}}
    else{const t=+(kda*1.08).toFixed(1);mission={key:'fighting',title:'Чище драки',text:`В следующих 3 матчах цель — KDA ≥ ${t}.`,baseline:`${kda.toFixed(1)} KDA`,target:`≥ ${t} KDA`,target_value:t,why:'Эффективность участия в драках сейчас проседает.'}}
    analysis={wins,wr,gpm,xpm,deaths,kda,assists:ass,scores,low,mission,score:Math.round(Object.values(scores).reduce((a,b)=>a+b,0)/Object.keys(scores).length*10),role};
  }
  analyze=roleAnalyze;
  missionPass=(m,a)=>{if(a.key==='survival')return(+m.deaths||0)<=a.target_value;if(a.key==='farming')return(+m.gold_per_min||0)>=a.target_value;if(a.key==='objectives')return(+m.tower_damage||0)>=a.target_value;if(a.key==='xpm')return(+m.xp_per_min||0)>=a.target_value;if(a.key==='assists')return(+m.assists||0)>=a.target_value;const kd=((+m.kills||0)+(+m.assists||0))/Math.max(1,+m.deaths||0);return kd>=a.target_value};

  function heroPool(){const map={};matches.forEach(m=>{const x=map[m.hero_id]||(map[m.hero_id]={id:m.hero_id,games:0,wins:0,gpm:0,k:0,d:0,a:0});x.games++;x.wins+=win(m)?1:0;x.gpm+=(+m.gold_per_min||0);x.k+=(+m.kills||0);x.d+=(+m.deaths||0);x.a+=(+m.assists||0)});return Object.values(map).map(x=>({...x,wr:x.wins/x.games*100,avgGpm:x.gpm/x.games,kda:(x.k+x.a)/Math.max(1,x.d)})).sort((a,b)=>(b.games*8+b.wr*.4)-(a.games*8+a.wr*.4))}
  function trendData(){if(matches.length<6)return null;const recent=matches.slice(0,5),prev=matches.slice(5,10);return{wrNow:wrOf(recent),wrPrev:wrOf(prev),gpmNow:avgOf(recent,'gold_per_min'),gpmPrev:avgOf(prev,'gold_per_min'),deathNow:avgOf(recent,'deaths'),deathPrev:avgOf(prev,'deaths'),kdaNow:kdaOf(recent),kdaPrev:kdaOf(prev),assNow:avgOf(recent,'assists'),assPrev:avgOf(prev,'assists')}}

  function renderV41(){
    const m=meta(),name=m.display_name||'Игрок',role=m.role||'Carry';const goal=q('#v41Goal');if(goal)goal.innerHTML=`<span>${role}</span><b>${m.target_rank||'Legend'}</b><small>${m.games_per_week||'—'} ranked / нед.</small>`;const self=q('#v41SelfProblem');if(self)self.textContent=PROBLEM_LABELS[m.self_problem]||'Не задано';
    const hp=heroPool(),pool=q('#v41HeroPool');if(pool)pool.innerHTML=!hp.length?'<div class="empty">Нужны матчи</div>':hp.slice(0,5).map((h,i)=>`<div class="hero-opt ${i<3?'recommended':''}"><span>${i+1}</span><div><b>${hname(h.id)}</b><small>${h.games} игр • ${Math.round(h.wr)}% WR</small></div><em>${h.kda.toFixed(1)} KDA</em></div>`).join('');const rec=q('#v41PoolAdvice');if(rec&&hp.length){const top=hp.slice(0,3).map(x=>hname(x.id)).join(' • ');rec.innerHTML=`<b>Ranked pool:</b> ${top}<small>${hp[0].games<3?' Предварительная рекомендация — пока мало матчей.':' Основано на частоте и результатах последних матчей.'}</small>`}
    const t=trendData(),week=q('#v41Weekly');if(week){if(!t)week.innerHTML='<div class="empty">Нужно минимум 6 матчей для сравнения формы.</div>';else{const support=role.includes('Support');week.innerHTML=`<div class="trend-kpi"><span>WR</span><b>${Math.round(t.wrNow)}%</b><small class="${t.wrNow>=t.wrPrev?'up':'down'}">${signed(Math.round(t.wrNow-t.wrPrev))} п.п.</small></div><div class="trend-kpi"><span>${support?'ASSISTS':'GPM'}</span><b>${support?t.assNow.toFixed(1):Math.round(t.gpmNow)}</b><small class="${support?(t.assNow>=t.assPrev?'up':'down'):(t.gpmNow>=t.gpmPrev?'up':'down')}">${support?signed((t.assNow-t.assPrev).toFixed(1)):signed(Math.round(t.gpmNow-t.gpmPrev))}</small></div><div class="trend-kpi"><span>Смерти</span><b>${t.deathNow.toFixed(1)}</b><small class="${t.deathNow<=t.deathPrev?'up':'down'}">${signed((t.deathNow-t.deathPrev).toFixed(1))}</small></div><div class="trend-kpi"><span>KDA</span><b>${t.kdaNow.toFixed(1)}</b><small class="${t.kdaNow>=t.kdaPrev?'up':'down'}">${signed((t.kdaNow-t.kdaPrev).toFixed(1))}</small></div>`}}
    const mom=q('#v41Momentum');if(mom){const ms=matches.slice(0,10).reverse();mom.innerHTML=ms.length?ms.map(x=>`<span class="${win(x)?'mw':'ml'}" title="${hname(x.hero_id)} • ${+x.gold_per_min||0} GPM">${win(x)?'W':'L'}</span>`).join(''):'<div class="empty">Нет матчей</div>'}const focus=q('#v41NextFocus');if(focus)focus.innerHTML=analysis?`<span>Следующий фокус</span><b>${analysis.mission.title}</b><small>${analysis.mission.why}</small>`:'<span>Следующий фокус</span><b>Нужны данные</b>';const nameInput=q('#displayName');if(nameInput&&document.activeElement!==nameInput)nameInput.value=name;const gpw=q('#gamesPerWeek');if(gpw)gpw.value=m.games_per_week||'4-10';const sp=q('#selfProblem');if(sp)sp.value=m.self_problem||'unknown';
  }

  const baseRenderAll=renderAll;renderAll=function(){baseRenderAll();renderV41()};const baseRenderProfile=renderProfile;renderProfile=function(){baseRenderProfile();renderV41();setTimeout(maybeOnboard,50)};
  function bindProfileExtras(){q('#saveProfileV41')?.addEventListener('click',async()=>{try{await updateMeta({display_name:q('#displayName').value.trim().slice(0,24)||'Игрок',games_per_week:q('#gamesPerWeek').value,self_problem:q('#selfProblem').value});renderProfile();toast('Профиль обновлён ✓')}catch(e){toast(cleanError(e))}});q('#copyWeekly')?.addEventListener('click',async()=>{if(!analysis)return toast('Сначала нужны матчи');const hp=heroPool().slice(0,3).map(x=>hname(x.id)).join(', ');const text=`VYNTRO • ${meta().display_name||'Игрок'}\n${meta().role||'Carry'} → ${meta().target_rank||'Legend'}\nVYNTRO Score: ${analysis.score}\nWR: ${Math.round(analysis.wr)}% • KDA: ${analysis.kda.toFixed(1)}\nФокус: ${analysis.mission.title}\nRanked pool: ${hp}`;try{await navigator.clipboard.writeText(text);toast('Отчёт скопирован')}catch{toast('Не удалось скопировать')}})}
  async function handleSteamReturn(){const u=new URL(location.href),linked=u.searchParams.get('steam_linked'),err=u.searchParams.get('steam_error');if(linked==='1'){toast('Steam успешно привязан ✓');await sb.auth.refreshSession();await refreshUser();u.searchParams.delete('steam_linked');history.replaceState({},'',u.pathname+u.search+u.hash)}if(err){toast('Ошибка Steam: '+err);u.searchParams.delete('steam_error');history.replaceState({},'',u.pathname+u.search+u.hash)}}
  function boot(){addAuthExtras();ensureModals();bindProfileExtras();const badge=q('.brand small');if(badge)badge.textContent='V4.1';handleSteamReturn();sb.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')showModal('#recoveryModal',true);if(event==='SIGNED_IN')setTimeout(maybeOnboard,120)});setInterval(()=>{if(user&&!q('#app')?.classList.contains('hidden')){renderV41();maybeOnboard()}},1800);if(matches.length){analyze();renderAll()}renderV41()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
