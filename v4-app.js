const SUPABASE_URL='https://olxoxeelbkiwcgnocwiw.supabase.co';
const SUPABASE_KEY='sb_publishable_O1Tb8mtEil8M0i168Jhafw_4Ekj60QY';
const SITE_URL='https://hvhuser1234.github.io/vyntro/';
const OPENDOTA='https://api.opendota.com/api';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let mode='login',session=null,user=null,matches=[],analysis=null,dotaProfile=null,HEROES={};

function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.x);toast.x=setTimeout(()=>e.classList.remove('show'),2500)}
function authStatus(t,type=''){const e=$('#authStatus');e.textContent=t;e.className='status '+type}
function cleanError(e){const m=(e?.message||String(e||''));if(/invalid login credentials/i.test(m))return'Неверная почта или пароль.';if(/email not confirmed/i.test(m))return'Подтверди почту по ссылке из письма.';if(/user already registered/i.test(m))return'Аккаунт с этой почтой уже существует.';if(/password/i.test(m)&&/6/i.test(m))return'Пароль должен содержать минимум 6 символов.';return m}
function setMode(m){mode=m;$('#loginTab').classList.toggle('active',m==='login');$('#registerTab').classList.toggle('active',m==='register');$('#emailAction').textContent=m==='login'?'Войти':'Создать аккаунт';$('#password').autocomplete=m==='login'?'current-password':'new-password';authStatus('')}
$('#loginTab').onclick=()=>setMode('login');$('#registerTab').onclick=()=>setMode('register');
$$('[data-page]').forEach(b=>b.onclick=()=>{$$('[data-page]').forEach(x=>x.classList.toggle('active',x===b));$$('.page').forEach(p=>p.classList.toggle('active',p.id===b.dataset.page))});

async function emailAuth(){
  const email=$('#email').value.trim(),password=$('#password').value;
  if(!/^\S+@\S+\.\S+$/.test(email)||password.length<6)return authStatus('Введите корректную почту и пароль минимум из 6 символов.','error');
  authStatus(mode==='login'?'Входим…':'Создаём аккаунт…');
  try{
    const res=mode==='login'
      ? await sb.auth.signInWithPassword({email,password})
      : await sb.auth.signUp({email,password,options:{emailRedirectTo:SITE_URL,data:{display_name:email.split('@')[0],role:'Carry',target_rank:'Legend',mission_history:[]}}});
    if(res.error)throw res.error;
    if(mode==='register'&&!res.data.session)return authStatus('Аккаунт создан. Проверь почту и подтверди регистрацию, затем вернись на VYNTRO.','ok');
    authStatus('Готово ✓','ok');
  }catch(e){authStatus(cleanError(e),'error')}
}
$('#emailAction').onclick=emailAuth;$('#password').addEventListener('keydown',e=>{if(e.key==='Enter')emailAuth()});

async function callSteamLogin(action='login'){
  authStatus('Проверяю Steam-вход…');
  try{
    const headers={'apikey':SUPABASE_KEY};
    if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
    const r=await fetch(`${SUPABASE_URL}/functions/v1/steam-login?action=${encodeURIComponent(action)}&return_to=${encodeURIComponent(SITE_URL)}`,{headers});
    if(!r.ok)throw new Error(r.status===404?'Steam-вход ещё не опубликован на backend.':'Steam backend недоступен: '+r.status);
    const data=await r.json();
    if(action==='unlink'){
      if(!data.ok)throw new Error(data.error||'Не удалось отвязать Steam');
      await sb.auth.refreshSession();await refreshUser();toast('Steam отвязан');return;
    }
    if(!data.url)throw new Error('Steam backend не вернул ссылку входа');
    location.href=data.url;
  }catch(e){authStatus(cleanError(e),'error');toast(cleanError(e))}
}
async function checkSteamBackend(){try{const r=await fetch(`${SUPABASE_URL}/functions/v1/steam-login?probe=1`,{headers:{apikey:SUPABASE_KEY}});return r.ok}catch{return false}}
async function steamLogin(){return callSteamLogin('login')}
$('#steamAction').onclick=steamLogin;$('#linkSteam').onclick=steamLogin;$('#profileSteam').onclick=steamLogin;
async function logout(){await sb.auth.signOut();location.replace(SITE_URL)}$('#logout').onclick=logout;

function meta(){return user?.user_metadata||{}}
function steam64(){return user?.app_metadata?.steam_id64||null}
async function refreshUser(){const {data,error}=await sb.auth.getUser();if(!error&&data.user){user=data.user;renderProfile();const sid=steam64();if(sid)await loadDota(sid);else{matches=[];analysis=null;dotaProfile=null;renderAll()}}}
function renderProfile(){
  const email=user?.email||'',m=meta(),sid=steam64(),steamOnly=email.endsWith('@vyntro.invalid');
  const name=m.display_name||(!steamOnly?email.split('@')[0]:'Steam Player')||'Игрок';
  $('#hello').textContent=`Привет, ${name}`;$('#profileName').textContent=name;$('#profileEmail').textContent=steamOnly?'Аккаунт создан через Steam':email;
  $('#role').value=m.role||'Carry';$('#targetRank').value=m.target_rank||'Legend';
  if(dotaProfile?.profile?.avatarfull){$('#avatar').src=dotaProfile.profile.avatarfull;$('#avatar').classList.remove('hidden');$('#avatarFallback').classList.add('hidden')}else{$('#avatar').classList.add('hidden');$('#avatarFallback').classList.remove('hidden');$('#avatarFallback').textContent=(name[0]||'V').toUpperCase()}
  if(sid){$('#steamState').textContent='Steam подтверждён ✓';$('#steamLinkBanner').classList.add('hidden');$('#profileSteam').textContent='Перепривязать Steam';$('#unlinkSteam').disabled=false}else{$('#steamState').textContent='Steam не привязан';$('#steamLinkBanner').classList.remove('hidden');$('#profileSteam').textContent='Привязать Steam';$('#unlinkSteam').disabled=true}
}
async function updateMeta(patch){const current=meta();const {data,error}=await sb.auth.updateUser({data:{...current,...patch}});if(error)throw error;user=data.user;return data.user}
async function saveGoal(){try{await updateMeta({role:$('#role').value,target_rank:$('#targetRank').value});renderProfile();toast('Цель сохранена')}catch{toast('Не удалось сохранить цель')}}$('#saveGoal').onclick=saveGoal;
async function unlinkSteam(){if(!steam64())return;await callSteamLogin('unlink')}$('#unlinkSteam').onclick=unlinkSteam;

function steamToAccount(id64){try{return String(BigInt(id64)-76561197960265728n)}catch{return null}}
async function fetchJSON(url){const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`API ${r.status}`);return r.json()}
async function loadDota(id64){
  const account=steamToAccount(id64);if(!account)return;
  $('#accountMeta').textContent='Загружаю матчи Dota…';dotaProfile=null;matches=[];analysis=null;
  try{dotaProfile=await fetchJSON(`${OPENDOTA}/players/${account}`)}catch(e){console.info('Profile endpoint unavailable:',e.message)}
  try{
    try{matches=await fetchJSON(`${OPENDOTA}/players/${account}/matches?limit=30`)}catch{matches=await fetchJSON(`${OPENDOTA}/players/${account}/recentMatches`)}
    if(!Array.isArray(matches))matches=[];
    try{HEROES=await fetchJSON(`${OPENDOTA}/constants/heroes`)}catch{HEROES={}}
    if(!matches.length)throw new Error('NO_MATCHES');
    analyze();await syncMissionProgress();renderProfile();renderAll();
  }catch(e){matches=[];analysis=null;renderProfile();renderAll();$('#accountMeta').textContent='Steam подтверждён, но публичные матчи Dota недоступны. Проверь «Expose Public Match Data» в настройках Dota 2.'}
}
function win(m){return (m.player_slot<128)===!!m.radiant_win}
function clamp(v){return Math.max(0,Math.min(100,v))}
function avg(k){return matches.reduce((s,m)=>s+(+m[k]||0),0)/Math.max(1,matches.length)}
function hname(id){return HEROES?.[id]?.localized_name||HEROES?.[String(id)]?.localized_name||`Hero #${id}`}
function analyze(){
  if(!matches.length){analysis=null;return}
  const wins=matches.filter(win).length,wr=wins/matches.length*100,gpm=avg('gold_per_min'),deaths=avg('deaths'),kills=avg('kills'),ass=avg('assists'),td=avg('tower_damage'),hd=avg('hero_damage'),kda=(kills+ass)/Math.max(.75,deaths);
  const scores={Фарм:Math.round(clamp((gpm-300)/4.5)),Драки:Math.round(clamp(kda*14+Math.min(20,hd/1800))),Выживаемость:Math.round(clamp(100-deaths*10.5)),Объекты:Math.round(clamp(td/55)),Стабильность:Math.round(clamp(64+(wr-50)*.55-Math.max(0,deaths-5)*2))};
  const low=Object.entries(scores).sort((a,b)=>a[1]-b[1])[0];let mission;
  if(low[0]==='Выживаемость'){const t=Math.max(2,Math.floor(deaths*.8));mission={key:'survival',title:'Снизь смерти',text:`В следующих 3 матчах держи смерти ≤ ${t} за игру.`,baseline:`${deaths.toFixed(1)} смерти`,target:`≤ ${t}`,target_value:t,why:'Выживаемость — самый слабый измеримый показатель'}}
  else if(low[0]==='Фарм'){const t=Math.round(gpm*1.08);mission={key:'farming',title:'Фарм выше базы',text:`В следующих 3 матчах цель — GPM ≥ ${t}.`,baseline:`${Math.round(gpm)} GPM`,target:`≥ ${t} GPM`,target_value:t,why:'Фарм сейчас даёт главный резерв роста'}}
  else if(low[0]==='Объекты'){const t=Math.max(1500,Math.round(td*1.15));mission={key:'objectives',title:'Дави объекты',text:`В следующих 3 матчах цель — tower damage ≥ ${t}.`,baseline:`${Math.round(td)} урона`,target:`≥ ${t}`,target_value:t,why:'Преимущество недостаточно конвертируется в строения'}}
  else{const t=+(kda*1.1).toFixed(1);mission={key:'fighting',title:'Чище драки',text:`В следующих 3 матчах цель — KDA ≥ ${t}.`,baseline:`${kda.toFixed(1)} KDA`,target:`≥ ${t} KDA`,target_value:t,why:'Эффективность драк сейчас проседает'}}
  analysis={wins,wr,gpm,deaths,kda,scores,low,mission,score:Math.round(Object.values(scores).reduce((a,b)=>a+b,0)/5*10)}
}
function missionPass(m,a){if(a.key==='survival')return (+m.deaths||0)<=a.target_value;if(a.key==='farming')return (+m.gold_per_min||0)>=a.target_value;if(a.key==='objectives')return (+m.tower_damage||0)>=a.target_value;const kda=((+m.kills||0)+(+m.assists||0))/Math.max(1,+m.deaths||0);return kda>=a.target_value}
async function syncMissionProgress(){
  const m=meta(),active=m.active_mission;if(!active||!matches.length)return;
  const newer=matches.filter(x=>(+x.start_time||0)>active.started_at).sort((a,b)=>(+a.start_time||0)-(+b.start_time||0)).slice(0,3);
  const results=newer.map(x=>({match_id:String(x.match_id),hero:hname(x.hero_id),passed:missionPass(x,active)}));
  const patch={active_mission:{...active,results,progress:results.filter(x=>x.passed).length,games_checked:results.length}};
  if(results.length>=3){const history=[{...patch.active_mission,status:results.filter(x=>x.passed).length>=2?'completed':'failed',finished_at:Date.now()},...(m.mission_history||[])].slice(0,12);patch.mission_history=history;patch.active_mission=null}
  const old=JSON.stringify(m.active_mission||null),neu=JSON.stringify(patch.active_mission||null);if(old!==neu||results.length>=3)await updateMeta(patch)
}
function renderMissionState(){
  const active=meta().active_mission;
  if(active){$('#missionTitle').textContent=active.title;$('#missionText').textContent=active.text;$('#focusTitle').textContent=active.title;$('#focusText').textContent=`${active.text} Проверено: ${active.games_checked||0}/3.`;$('#missionProofs').innerHTML=`<div><span>БАЗА</span><b>${active.baseline}</b></div><div><span>ЦЕЛЬ</span><b>${active.target}</b></div><div><span>ПРОГРЕСС</span><b>${active.progress||0}/${active.games_checked||0}</b></div>`;$('#startMission').textContent='Миссия уже активна';$('#startMission').disabled=true;return}
  $('#startMission').disabled=!analysis;$('#startMission').textContent='Запустить миссию';if(analysis){$('#missionTitle').textContent=analysis.mission.title;$('#missionText').textContent=analysis.mission.text;$('#focusTitle').textContent=analysis.mission.title;$('#focusText').textContent=analysis.mission.text;$('#missionProofs').innerHTML=`<div><span>БАЗА</span><b>${analysis.mission.baseline}</b></div><div><span>ЦЕЛЬ</span><b>${analysis.mission.target}</b></div><div><span>ПОЧЕМУ</span><b>${analysis.mission.why}</b></div>`}else{$('#missionTitle').textContent='Нет активной миссии';$('#missionText').textContent=steam64()?'Нужны доступные матчи Dota':'Сначала привяжи Steam';$('#focusTitle').textContent='—';$('#focusText').textContent='—';$('#missionProofs').innerHTML=''}
}
function renderAll(){
  renderMissionState();renderHistory();
  if(!analysis){$('#rankText').textContent=dotaProfile?.rank_tier?rankName(dotaProfile.rank_tier):'Ранг недоступен';if(!steam64())$('#accountMeta').textContent='Привяжи Steam, чтобы загрузить матчи';$('#scoreValue').textContent='—';$('#scoreRing').style.setProperty('--score',0);$('#skillBars').innerHTML='<div class="empty">Нет доступных матчей</div>';$('#weekly').innerHTML='<div class="empty">Нет данных</div>';$('#matchList').innerHTML='<div class="empty card">Матчи не загружены</div>';$('#report').innerHTML='<div class="empty">Выбери матч</div>';return}
  $('#scoreValue').textContent=analysis.score;$('#scoreRing').style.setProperty('--score',Math.round(analysis.score/10));$('#rankText').textContent=rankName(dotaProfile?.rank_tier);$('#accountMeta').textContent=`${matches.length} матчей • ${Math.round(analysis.wr)}% WR • ${Math.round(analysis.gpm)} GPM`;$('#skillBars').innerHTML=Object.entries(analysis.scores).map(([k,v])=>`<div class="bar"><span>${k}</span><div class="meter"><i style="width:${v}%"></i></div><b>${v}</b></div>`).join('');renderWeekly();renderMatches()
}
function rankName(t){if(!t)return'Ранг скрыт';const n=['Unranked','Herald','Guardian','Crusader','Archon','Legend','Ancient','Divine','Immortal'];return`${n[Math.floor(t/10)]||'Rank'} ${t%10||''}`.trim()}
function renderWeekly(){const a=matches.slice(0,5),b=matches.slice(5,10),wr=x=>x.length?x.filter(win).length/x.length*100:0,av=(x,k)=>x.length?x.reduce((s,m)=>s+(+m[k]||0),0)/x.length:0;$('#weekly').innerHTML=`<div><span>ПОСЛЕДНИЕ 5</span><b>${Math.round(wr(a))}% WR</b></div><div><span>ПРЕДЫДУЩИЕ 5</span><b>${Math.round(wr(b))}% WR</b></div><div><span>GPM Δ</span><b>${Math.round(av(a,'gold_per_min')-av(b,'gold_per_min'))>=0?'+':''}${Math.round(av(a,'gold_per_min')-av(b,'gold_per_min'))}</b></div><div><span>KDA</span><b>${analysis.kda.toFixed(1)}</b></div>`}
function renderMatches(){const box=$('#matchList');box.innerHTML='';matches.slice(0,20).forEach((m,i)=>{const el=document.createElement('div');el.className='match';el.innerHTML=`<span class="result ${win(m)?'win':'loss'}">${win(m)?'W':'L'}</span><div><b>${hname(m.hero_id)}</b><small>${Math.floor((m.duration||0)/60)} мин • ${m.kills||0}/${m.deaths||0}/${m.assists||0}</small></div><b>${m.gold_per_min||'—'} GPM</b>`;el.onclick=()=>report(m);box.appendChild(el);if(i===0)report(m)})}
function report(m){const kda=(m.kills+m.assists)/Math.max(1,m.deaths),farm=(+m.gold_per_min||0)>=analysis.gpm,deaths=(+m.deaths||0)<=analysis.deaths;$('#report').innerHTML=`<div class="kicker">ОТЧЁТ ПО МАТЧУ</div><h2>${hname(m.hero_id)} <span class="${win(m)?'win':'loss'}">${win(m)?'Победа':'Поражение'}</span></h2><div class="proofs"><div><span>KDA</span><b>${kda.toFixed(1)}</b></div><div><span>GPM</span><b>${m.gold_per_min||'—'}</b></div><div><span>LH</span><b>${m.last_hits||'—'}</b></div></div><p class="muted">${deaths?'По смертям матч лучше твоего среднего.':'Смертей больше твоего среднего — это заметная потеря темпа.'} ${farm?'Фарм выше твоей текущей базы.':'Фарм ниже твоей текущей базы.'}</p>`}
async function startMission(){if(!analysis||meta().active_mission)return;const a={...analysis.mission,text:analysis.mission.text,started_at:Math.floor(Date.now()/1000),created_at:Date.now(),progress:0,games_checked:0,results:[]};try{await updateMeta({active_mission:a});renderAll();toast('Миссия запущена')}catch{toast('Не удалось запустить миссию')}}$('#startMission').onclick=startMission;
function renderHistory(){const h=meta().mission_history||[];$('#missionHistory').innerHTML=h.length?h.map(x=>`<div class="history-item"><b>${x.title}</b><div class="muted">${x.status==='completed'?'Выполнена ✓':'Не выполнена'} • ${x.progress||0}/3</div></div>`).join(''):'<div class="empty">История пока пуста</div>'}
$('#refresh').onclick=()=>steam64()?loadDota(steam64()):toast('Сначала привяжи Steam');$('#deleteLocal').onclick=async()=>{await sb.auth.signOut({scope:'local'});location.replace(SITE_URL)};

async function boot(){
  const params=new URLSearchParams(location.search);
  if(params.get('steam_error'))authStatus('Ошибка входа Steam: '+params.get('steam_error'),'error');
  const {data:{session:s}}=await sb.auth.getSession();session=s;
  if(params.get('steam_linked')==='1'&&session){await sb.auth.refreshSession();history.replaceState(null,'',SITE_URL)}
  const fresh=await sb.auth.getSession();session=fresh.data.session;user=session?.user||null;
  sb.auth.onAuthStateChange((_e,sess)=>{session=sess;user=sess?.user||null;if(sess)enter();else leave()});
  const steamReady=await checkSteamBackend();if(!steamReady){$('#steamAction').textContent='Steam-вход готовится';$('#steamAction').title='Edge Function ещё не опубликована'}
  if(session)await enter();else leave();
}
async function enter(){$('#authScreen').classList.add('hidden');$('#app').classList.remove('hidden');$('#nav').classList.remove('hidden');$('#logout').classList.remove('hidden');await refreshUser();renderProfile();renderAll()}
function leave(){$('#authScreen').classList.remove('hidden');$('#app').classList.add('hidden');$('#nav').classList.add('hidden');$('#logout').classList.add('hidden')}
boot();