const SUPABASE_URL = "https://vjjrwvraannccejyqcci.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XYvCzMPGQjhT0AT2r2v3dw_zZIesIJB";
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;
const COLORS=['#f5f5f4','#fce7f3','#ccfbf1','#dbeafe','#fef3c7','#ffe4e6','#e0f2fe'];
const DAYS=['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
const MONTHS=['січ.','лют.','берез.','квіт.','трав.','черв.','лип.','серп.','верес.','жовт.','лист.','груд.'];
const MIN_HOUR=9, MAX_HOUR=21, DEFAULT_OPEN_HOUR=18, DEFAULT_PAID_AMOUNT=175;
const PAID_METHODS=['МоноБанк','Готівка','ПриватБанк','Ощад Банк','Mathema'];
const DEFAULT_PAID_METHOD=PAID_METHODS[0];
const COOPERATION_PLATFORMS=['Buki','Mathema','Оптіма','Приватна домовленість'];
const AUTO_COMPLETE_MS=48*60*60*1000, MAX_AUDIT=300, THEME_KEY='schedule_theme_pref';

const state={
  user:null,schedule:null,scheduleId:null,students:[],lessons:[],availableSlots:[],blockedSlots:[],
  bookingRequests:[],auditLog:[],backups:[],currentDate:new Date(),view:'day',filterType:'all',
  filterStudentId:null,isEditMode:false,editingLessonId:null,currentInfoStudentId:null,
  selectedNewStudentColor:COLORS[0],editingStudentIds:new Set(),contextLessonId:null,contextSlot:null,showArchivedStudents:false
};
let el={};

function $(id){return document.getElementById(id);}
function cache(){
  const ids='current-date-display calendar-grid today-btn prev-date-btn next-date-btn view-day-btn view-week-btn view-month-btn filter-type-select filter-student-select theme-toggle-btn sync-status sync-status-text settings-badge-count settings-btn settings-modal close-settings-modal-btn modal-add-lesson-btn modal-manage-students-btn modal-requests-btn requests-badge-count modal-reports-btn modal-audit-log-btn modal-backups-btn modal-student-link-btn edit-mode-checkbox students-info-btn students-picker-modal students-picker-list close-students-picker-modal-btn student-info-modal student-info-title student-info-fields student-info-stats student-info-list student-info-link-input student-info-copy-link-btn student-info-planned-btn student-info-history-btn close-student-info-modal-btn students-modal close-students-modal-btn show-active-students-btn show-archived-students-btn open-add-student-modal-btn students-list add-student-modal close-add-student-modal-btn new-student-name new-student-grade new-student-phone new-student-parent-name new-student-parent-phone new-student-cooperation-platform new-student-swatches save-new-student-btn lesson-modal lesson-modal-title close-lesson-modal-btn save-lesson-btn lesson-student-select lesson-student-required lesson-date-input lesson-hour-select lesson-minute-select lesson-paid-select lesson-status-select lesson-repeat-select repeat-group payment-details-group lesson-paid-amount lesson-paid-date lesson-paid-method lesson-topic-input lesson-homework-input lesson-past-notice delete-lesson-btn reports-modal close-reports-modal-btn report-period-select report-custom-range report-from-date report-to-date generate-report-btn report-output modal-issues-btn issues-modal issues-list close-issues-modal-btn requests-modal requests-list close-requests-modal-btn audit-log-modal audit-log-list close-audit-log-modal-btn backups-modal backups-list close-backups-modal-btn student-link-modal student-link-input copy-student-link-btn close-student-link-modal-btn confirm-modal confirm-modal-message confirm-modal-cancel-btn confirm-modal-ok-btn toast-container lesson-context-menu context-menu-edit context-menu-delete context-menu-add context-menu-toggle'.split(' ');
  el={};ids.forEach(id=>{el[id]=$(id);const camel=id.replace(/-([a-z])/g,(_,ch)=>ch.toUpperCase());if(camel!==id)el[camel]=el[id];});
  // Backward-compatible aliases used by navigation handlers.
  el.prevBtn=el.prevDateBtn;
  el.nextBtn=el.nextDateBtn;
}

function safeBind(key,eventName,handler){
  try{
    const node=el[key];
    if(!node){console.error('UI binding skipped: missing '+key);return false;}
    node[eventName]=handler;
    return true;
  }catch(e){
    console.error('UI binding failed: '+key,e);
    return false;
  }
}
function safeDomBind(id,eventName,handler){
  try{
    const node=$(id);
    if(!node){console.error('DOM binding skipped: missing '+id);return false;}
    node[eventName]=handler;
    return true;
  }catch(e){
    console.error('DOM binding failed: '+id,e);
    return false;
  }
}
function safeAddEventListener(node,eventName,handler,label){
  try{
    if(!node){console.error('Event listener skipped: missing '+(label||eventName));return false;}
    node.addEventListener(eventName,handler);
    return true;
  }catch(e){
    console.error('Event listener failed: '+(label||eventName),e);
    return false;
  }
}

function createAuthGate(){
  const gate=document.createElement('div');gate.id='teacher-auth-gate';
  gate.style.cssText='position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:16px;background:#f8fafc;';
  gate.innerHTML='<div style="width:min(420px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.12);"><div id="teacher-login-panel"><h2 style="margin:0 0 8px;color:#0f172a;">Вхід викладача</h2><p style="margin:0 0 18px;color:#64748b;font-size:.9rem;">Увійдіть через Supabase Auth, щоб відкрити V2-розклад.</p><div style="display:flex;flex-direction:column;gap:10px;"><label style="font-size:.85rem;font-weight:700;color:#334155;">Email<input id="teacher-email" type="email" autocomplete="username" style="width:100%;margin-top:5px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;"></label><label style="font-size:.85rem;font-weight:700;color:#334155;">Пароль<input id="teacher-password" type="password" autocomplete="current-password" style="width:100%;margin-top:5px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;"></label><button id="teacher-login-btn" class="primary" type="button" style="padding:11px 14px;">Увійти</button><button id="teacher-forgot-btn" type="button" style="padding:10px 14px;">Забули пароль?</button><div id="teacher-login-message" style="min-height:20px;font-size:.82rem;color:#b91c1c;"></div></div></div><div id="teacher-recovery-panel" style="display:none;"><h2 style="margin:0 0 8px;color:#0f172a;">Відновлення пароля</h2><p style="margin:0 0 18px;color:#64748b;font-size:.9rem;">Задайте новий пароль для входу викладача.</p><div style="display:flex;flex-direction:column;gap:10px;"><label style="font-size:.85rem;font-weight:700;color:#334155;">Новий пароль<input id="teacher-new-password" type="password" autocomplete="new-password" style="width:100%;margin-top:5px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;"></label><label style="font-size:.85rem;font-weight:700;color:#334155;">Повторіть новий пароль<input id="teacher-new-password-confirm" type="password" autocomplete="new-password" style="width:100%;margin-top:5px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;"></label><button id="teacher-update-password-btn" class="primary" type="button" style="padding:11px 14px;">Зберегти новий пароль</button><button id="teacher-recovery-cancel-btn" type="button" style="padding:10px 14px;">До входу</button><div id="teacher-recovery-message" style="min-height:20px;font-size:.82rem;color:#b91c1c;"></div></div></div></div>';
  document.body.insertBefore(gate,document.body.firstChild);return gate;
}
function isRecoveryRedirect(){
  const p=new URLSearchParams(window.location.hash.replace(/^#/,''));
  return p.get('type')==='recovery';
}
function showLoginPanel(gate,message){
  const login=$('teacher-login-panel'),recovery=$('teacher-recovery-panel'),msg=$('teacher-login-message');
  if(login)login.style.display='block';if(recovery)recovery.style.display='none';if(msg)msg.textContent=message||'';
}
function showRecoveryPanel(gate){
  const login=$('teacher-login-panel'),recovery=$('teacher-recovery-panel'),msg=$('teacher-recovery-message');
  if(login)login.style.display='none';if(recovery)recovery.style.display='block';if(msg)msg.textContent='';
}
function recoveryRedirectUrl(){
  const u=new URL(window.location.href);u.hash='';u.search='';return u.toString();
}
async function requestPasswordRecovery(){
  const email=$('teacher-email'),msg=$('teacher-login-message'),button=$('teacher-forgot-btn');
  const value=email?email.value.trim():'';
  if(!value){if(msg)msg.textContent='Спочатку введіть email.';email?.focus();return;}
  if(button)button.disabled=true;if(msg)msg.textContent='Надсилання листа...';
  try{
    const r=await db.auth.resetPasswordForEmail(value,{redirectTo:recoveryRedirectUrl()});
    if(r.error)throw r.error;
    if(msg)msg.textContent='Лист для скидання пароля надіслано. Перевірте пошту.';
  }catch(e){console.error(e);if(msg)msg.textContent=e.message||'Не вдалося надіслати лист для скидання пароля.';}
  finally{if(button)button.disabled=false;}
}
async function updateRecoveredPassword(gate){
  const p=$('teacher-new-password'),c=$('teacher-new-password-confirm'),msg=$('teacher-recovery-message'),button=$('teacher-update-password-btn');
  const value=p?p.value:'';
  if(!value){if(msg)msg.textContent='Введіть новий пароль.';return;}
  if(value.length<6){if(msg)msg.textContent='Пароль має містити щонайменше 6 символів.';return;}
  if(value!==((c&&c.value)||'')){if(msg)msg.textContent='Паролі не збігаються.';return;}
  if(button)button.disabled=true;if(msg)msg.textContent='Збереження нового пароля...';
  try{
    const session=(await db.auth.getSession()).data.session;
    if(!session)throw new Error('Сесію відновлення не знайдено. Запросіть новий лист для скидання пароля.');
    const r=await db.auth.updateUser({password:value});if(r.error)throw r.error;
    await db.auth.signOut();window.history.replaceState({},document.title,window.location.pathname);
    showLoginPanel(gate,'Пароль успішно змінено. Увійдіть із новим паролем.');
  }catch(e){console.error(e);if(msg)msg.textContent=e.message||'Не вдалося змінити пароль.';}
  finally{if(button)button.disabled=false;}
}
function appShell(){
  let shell=$('teacher-app-shell');if(shell)return shell;
  shell=document.createElement('div');shell.id='teacher-app-shell';shell.style.minHeight='100vh';
  Array.from(document.body.children).filter(n=>n.id!=='teacher-auth-gate'&&n.tagName!=='SCRIPT').forEach(n=>shell.appendChild(n));
  const gate=$('teacher-auth-gate');document.body.insertBefore(shell,gate?gate.nextSibling:null);return shell;
}
function setVisible(v){appShell().style.display=v?'block':'none';}
function toast(msg,type,duration){
  const t=document.createElement('div');t.className='toast '+(type||'info');t.textContent=msg;el.toastContainer.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),250);},duration||3200);
}
function confirmBox(msg){
  return new Promise(resolve=>{el.confirmModalMessage.textContent=msg;el.confirmModal.classList.remove('hidden');
    const done=v=>{el.confirmModal.classList.add('hidden');el.confirmModalOkBtn.onclick=null;el.confirmModalCancelBtn.onclick=null;resolve(v);};
    el.confirmModalOkBtn.onclick=()=>done(true);el.confirmModalCancelBtn.onclick=()=>done(false);
  });
}
function theme(v){document.documentElement.setAttribute('data-theme',v);if(el.themeToggleBtn)el.themeToggleBtn.textContent=v==='dark'?'☀️':'🌙';localStorage.setItem(THEME_KEY,v);}
function syncStatus(v){if(!el.syncStatus)return;el.syncStatus.className=v;el.syncStatusText.textContent=v==='saving'?'Збереження...':v==='saved'?'Збережено':v==='offline'?'Помилка синхронізації':'Готово';}
function dbFail(e){console.error(e);syncStatus('offline');toast(e&&e.message?e.message:'Не вдалося виконати операцію.','error',5000);}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function prettyDate(s){const p=String(s).split('-').map(Number);if(!p[0])return s||'';return new Date(p[0],p[1]-1,p[2]).toLocaleDateString('uk-UA',{day:'numeric',month:'long',year:'numeric'});}
function monday(d){const x=new Date(d),day=x.getDay();x.setDate(x.getDate()-day+(day===0?-6:1));x.setHours(0,0,0,0);return x;}
function today(d){const n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate();}
function pastDate(s){return s<iso(new Date());}
function pastSlot(s,h){const p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2],h,0,0).getTime()<Date.now();}
function time(h){return String(h).padStart(2,'0')+':00';}
function esc(v){const d=document.createElement('div');d.textContent=v==null?'':String(v);return d.innerHTML;}

async function authUser(){
  if(!db)throw new Error('Supabase-клієнт не ініціалізовано.');
  const r=await db.auth.getSession();
  if(r.error)throw r.error;
  const user=r.data&&r.data.session&&r.data.session.user;
  if(!user)throw new Error('Потрібен вхід викладача.');
  state.user=user;
  return state.user;
}
async function loadV2(){
  await authUser();
  const s=await db.from('v2_schedules').select('*').eq('owner_id',state.user.id).order('created_at',{ascending:true}).limit(1).maybeSingle();
  if(s.error)throw s.error;if(!s.data)throw new Error('Для цього облікового запису V2-розклад не знайдено.');
  state.schedule=s.data;state.scheduleId=String(s.data.id);
  const r=await Promise.all([
    db.from('v2_students').select('*').eq('schedule_id',state.scheduleId).order('created_at'),
    db.from('v2_lessons').select('*').eq('schedule_id',state.scheduleId).order('lesson_date').order('lesson_time'),
    db.from('v2_slot_overrides').select('*').eq('schedule_id',state.scheduleId).order('slot_date').order('slot_time'),
    db.from('v2_booking_requests').select('*').eq('schedule_id',state.scheduleId).order('created_at',{ascending:false}),
    db.from('v2_audit_log').select('*').eq('schedule_id',state.scheduleId).order('created_at',{ascending:false}).limit(MAX_AUDIT),
    db.from('v2_schedule_snapshots').select('*').eq('schedule_id',state.scheduleId).order('created_at',{ascending:false}).limit(14)
  ]);
  r.forEach(x=>{if(x.error)throw x.error;});
  state.students=r[0].data.map(x=>({id:String(x.id),name:x.name||'',grade:x.grade||'',phone:x.phone||'',parentName:x.parent_name||'',parentPhone:x.parent_phone||'',color:COLORS.includes(x.color)?x.color:COLORS[0],accessToken:x.access_token?String(x.access_token):'',archivedAt:x.archived_at||null,cooperationPlatform:COOPERATION_PLATFORMS.includes(x.cooperation_platform)?x.cooperation_platform:''}));
  state.lessons=r[1].data.map(x=>({id:String(x.id),studentId:String(x.student_id),date:String(x.lesson_date),time:String(x.lesson_time||'00:00').slice(0,5),status:x.status||'planned',topic:x.topic||'',homework:x.homework||'',paid:!!x.paid,paidAmount:x.paid_amount==null?null:Number(x.paid_amount),paidDate:x.paid_date||null,paidMethod:x.paid_method||null}));
  state.availableSlots=[];state.blockedSlots=[];r[2].data.forEach(x=>{const z={id:String(x.id),date:String(x.slot_date),time:String(x.slot_time).slice(0,5)};(x.is_open?state.availableSlots:state.blockedSlots).push(z);});
  state.bookingRequests=r[3].data.map(x=>({id:String(x.id),studentId:String(x.student_id),type:x.request_type,lessonId:x.lesson_id?String(x.lesson_id):null,oldDate:x.old_date||null,oldTime:x.old_time?String(x.old_time).slice(0,5):null,date:String(x.new_date),time:String(x.new_time).slice(0,5),status:x.status,createdAt:x.created_at}));
  state.auditLog=r[4].data.map(x=>({id:String(x.id),ts:new Date(x.created_at).getTime(),actor:x.actor_type||'system',action:x.action||'',meta:x.meta||null}));
  state.backups=r[5].data||[];
  if(state.filterStudentId&&!state.students.some(x=>x.id===String(state.filterStudentId)&&!x.archivedAt))state.filterStudentId=state.students.find(x=>!x.archivedAt)?.id||null;
  syncStatus('saved');
}
async function autoComplete(){
  const cutoff=Date.now()-AUTO_COMPLETE_MS,old=state.lessons.filter(l=>{const p=l.date.split('-').map(Number),t=l.time.split(':').map(Number);return l.status==='planned'&&new Date(p[0],p[1]-1,p[2],t[0]||0,t[1]||0).getTime()<cutoff;});
  for(const l of old){const r=await db.from('v2_lessons').update({status:'completed'}).eq('id',l.id).eq('schedule_id',state.scheduleId);if(r.error)console.warn(r.error);}
  if(old.length)await loadV2();
}
function badges(){const n=state.bookingRequests.filter(x=>x.status==='pending').length;[el.settingsBadgeCount,el.requestsBadgeCount].forEach(x=>{if(!x)return;x.style.display=n?'flex':'none';if(n)x.textContent=String(n);});}
function dateDisplay(){
  el.currentDateDisplay.innerHTML='';
  const s=document.createElement('span');s.className='date-display-big';
  if(state.view==='day')s.textContent=state.currentDate.toLocaleDateString('uk-UA',{day:'numeric',month:'long'});
  else if(state.view==='week'){const a=monday(state.currentDate),b=new Date(a);b.setDate(a.getDate()+6);s.textContent=a.getDate()+' '+MONTHS[a.getMonth()]+' - '+b.getDate()+' '+MONTHS[b.getMonth()];}
  else{s.textContent=state.currentDate.toLocaleDateString('uk-UA',{month:'long'});const y=document.createElement('span');y.className='date-display-year';y.textContent=state.currentDate.getFullYear();el.currentDateDisplay.append(s,y);return;}
  el.currentDateDisplay.appendChild(s);
}
function viewButtons(){[el.viewDayBtn,el.viewWeekBtn,el.viewMonthBtn].forEach(x=>x.classList.remove('active'));el['view'+state.view.charAt(0).toUpperCase()+state.view.slice(1)+'Btn'].classList.add('active');}
function populateLessonTimeSelects(){
  if(!el.lessonHourSelect||!el.lessonMinuteSelect)return;
  el.lessonHourSelect.innerHTML='';
  for(let h=MIN_HOUR;h<=MAX_HOUR;h++){
    const o=document.createElement('option');
    o.value=String(h).padStart(2,'0');
    o.textContent=String(h).padStart(2,'0')+':00';
    el.lessonHourSelect.appendChild(o);
  }
  el.lessonMinuteSelect.innerHTML='';
  for(let m=0;m<60;m+=5){
    const o=document.createElement('option');
    o.value=String(m).padStart(2,'0');
    o.textContent=String(m).padStart(2,'0');
    el.lessonMinuteSelect.appendChild(o);
  }
}
function activeStudents(){return state.students.filter(s=>!s.archivedAt);}
function archivedStudents(){return state.students.filter(s=>!!s.archivedAt);}
function platformLabel(s){return s&&s.cooperationPlatform?s.cooperationPlatform:'Платформа не вказана';}
function selects(includeStudentId=null){
  const active=activeStudents();
  const selected=includeStudentId?state.students.find(s=>s.id===String(includeStudentId)):null;
  const lessonStudents=selected&&selected.archivedAt?[selected,...active]:active;
  el.lessonStudentSelect.innerHTML='';
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Оберіть учня';el.lessonStudentSelect.appendChild(placeholder);
  lessonStudents.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.name+(s.archivedAt?' (архів)':'');el.lessonStudentSelect.appendChild(o);});
  el.filterStudentSelect.innerHTML='';active.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.name;el.filterStudentSelect.appendChild(o);});
  if(active.length){const p=String(state.filterStudentId||'');state.filterStudentId=active.some(s=>s.id===p)?p:active[0].id;el.filterStudentSelect.value=state.filterStudentId;}else state.filterStudentId=null;
  el.filterStudentSelect.style.display=state.filterType==='student'?'':'none';
}
function match(l){
  if(state.filterType==='student')return l.studentId===String(state.filterStudentId);
  if(state.filterType==='planned')return l.status!=='completed';
  if(state.filterType==='planned-overdue')return l.status!=='completed'&&pastDate(l.date);
  if(state.filterType==='completed')return l.status==='completed';
  if(state.filterType==='completed-unpaid')return l.status==='completed'&&!l.paid;
  if(state.filterType==='paid')return l.paid;
  if(state.filterType==='free')return false;
  return true;
}
function slot(date,h){
  const lessons=state.lessons.filter(l=>l.date===date&&parseInt(l.time.split(':')[0],10)===h);
  if(lessons.length)return{status:'lesson',lessons};
  if(pastSlot(date,h))return{status:'unavailable'};
  const t=time(h);
  if(h<DEFAULT_OPEN_HOUR)return{status:state.availableSlots.some(x=>x.date===date&&x.time===t)?'available':'unavailable'};
  return{status:state.blockedSlots.some(x=>x.date===date&&x.time===t)?'unavailable':'available'};
}
function hoursFor(date){
  const a=[];for(let h=MIN_HOUR;h<=MAX_HOUR;h++)a.push(h);
  state.lessons.forEach(l=>{if(l.date===date){const h=parseInt(l.time.split(':')[0],10);if(!a.includes(h))a.push(h);}});
  return a.sort((a,b)=>a-b);
}
async function toggleSlot(date,h){
  const t=time(h);try{syncStatus('saving');
    const existing=(h<DEFAULT_OPEN_HOUR?state.availableSlots:state.blockedSlots).find(x=>x.date===date&&x.time===t);
    if(existing){const r=await db.from('v2_slot_overrides').delete().eq('id',existing.id).eq('schedule_id',state.scheduleId);if(r.error)throw r.error;}
    else{const r=await db.from('v2_slot_overrides').insert({schedule_id:state.scheduleId,slot_date:date,slot_time:t,is_open:h<DEFAULT_OPEN_HOUR});if(r.error)throw r.error;}
    await loadV2();render();
  }catch(e){dbFail(e);}
}
function attachFree(n,date,h,past){
  if(past&&!state.isEditMode)return;
  n.classList.add('clickable');n.onclick=()=>state.isEditMode?toggleSlot(date,h):openAddLesson(date,h);
  n.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();showContext(e.clientX,e.clientY,{dateISO:date,hour:h});};
  n.ondragover=e=>{e.preventDefault();n.classList.add('drag-over');};n.ondragleave=()=>n.classList.remove('drag-over');
  n.ondrop=async e=>{e.preventDefault();n.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain');if(id)await moveLesson(id,date,time(h));};
}
function dayHeader(d){
  const h=document.createElement('div');h.className='day-header '+(today(d)?'today':'');
  const n=document.createElement('span');n.className='day-header-name';n.textContent=DAYS[(d.getDay()+6)%7];
  h.appendChild(n);
  if(state.view!=='day'){
    const x=document.createElement('span');x.className='day-header-date';x.textContent=d.getDate()+' '+MONTHS[d.getMonth()];h.appendChild(x);
  }
  return h;
}
function lessonCard(l){
  const s=state.students.find(x=>x.id===l.studentId),c=document.createElement('div');c.className='lesson-card';c.style.backgroundColor=s?s.color:COLORS[0];c.draggable=!pastDate(l.date)||state.isEditMode;
  const row=document.createElement('div');row.className='lesson-title-row';const tm=document.createElement('span');tm.className='lesson-time';tm.textContent=l.time;
  const nm=document.createElement('span');nm.className='lesson-student-name';nm.textContent=s?s.name:'Учень';nm.onclick=e=>{e.stopPropagation();if(s)openStudent(s.id);};row.append(tm,nm);
  const b=document.createElement('div');b.className='lesson-badges';const p=document.createElement('span');p.className='badge';p.style.backgroundColor=l.paid?'#dcfce7':'#fee2e2';p.style.color=l.paid?'#15803d':'#991b1b';p.textContent=l.paid?'Оплачено':'Не опл.';
  const st=document.createElement('span');st.className='badge';st.style.backgroundColor=l.status==='completed'?'#e2e8f0':'#dbeafe';st.style.color=l.status==='completed'?'#334155':'#1d4ed8';st.textContent=l.status==='completed'?'Відбувся':'Заплан.';b.append(p,st);c.append(row,b);
  c.onclick=()=>openEditLesson(l.id);c.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();showContext(e.clientX,e.clientY,{lessonId:l.id});};
  if(c.draggable)c.ondragstart=e=>e.dataTransfer.setData('text/plain',l.id);return c;
}
function renderColumns(days){
  el.calendarGrid.className='';el.calendarGrid.innerHTML='';const wrap=document.createElement('div');wrap.className='week-columns '+(days.length>1?'week-pairs':'');
  days.forEach(d=>{const date=iso(d),col=document.createElement('div');col.className='day-column';col.appendChild(dayHeader(d));let run=[];
    const out=[],merge=days.length>1&&!state.isEditMode,flush=()=>{if(!run.length)return;out.push(run.length===1?{type:'hour',hour:run[0]}:{type:'range',start:run[0],end:run[run.length-1]+1});run=[];};
    hoursFor(date).forEach(h=>{const z=slot(date,h);if(z.status==='lesson'){flush();const f=z.lessons.filter(match);if(f.length)out.push({type:'lesson',lessons:f});return;}
      if(z.status==='available'&&(state.filterType==='all'||state.filterType==='free')){if(merge&&h<DEFAULT_OPEN_HOUR){if(run.length&&run[run.length-1]!==h-1)flush();run.push(h);}else{flush();out.push({type:'hour',hour:h});}return;}
      flush();if(state.isEditMode&&state.filterType==='all')out.push({type:'unavailable',hour:h});
    });flush();
    if(!out.length){const x=document.createElement('div');x.style.cssText='color:var(--text-muted);font-size:.78rem;text-align:center;padding:8px;';x.textContent=state.filterType==='all'?'Немає вільних годин':'Немає записів за фільтром';col.appendChild(x);}
    out.forEach(e=>{if(e.type==='lesson'){e.lessons.forEach(l=>col.appendChild(lessonCard(l)));return;}
      if(e.type==='range'){const x=document.createElement('div');x.className='slot-free slot-range';x.textContent=time(e.start)+'–'+time(e.end)+' Вільно';attachFree(x,date,e.start,pastDate(date));col.appendChild(x);return;}
      if(e.type==='hour'){const x=document.createElement('div');x.className='slot-free';x.textContent=time(e.hour)+' Вільно';attachFree(x,date,e.hour,pastDate(date));col.appendChild(x);return;}
      const x=document.createElement('div');x.className='slot-unavailable';x.textContent=time(e.hour)+' Недоступно';x.style.cursor='pointer';x.onclick=()=>toggleSlot(date,e.hour);x.oncontextmenu=ev=>{ev.preventDefault();ev.stopPropagation();showContext(ev.clientX,ev.clientY,{dateISO:date,hour:e.hour});};col.appendChild(x);
    });wrap.appendChild(col);});el.calendarGrid.appendChild(wrap);
}
function renderMonth(){
  el.calendarGrid.className='calendar-grid grid-month';el.calendarGrid.innerHTML='';const h=document.querySelector('.header');if(h)document.documentElement.style.setProperty('--month-sticky-top',Math.round(h.getBoundingClientRect().height)+'px');
  const y=state.currentDate.getFullYear(),m=state.currentDate.getMonth(),first=new Date(y,m,1),start=(first.getDay()+6)%7,total=new Date(y,m+1,0).getDate(),prev=new Date(y,m,0).getDate();
  DAYS.forEach(n=>{const x=document.createElement('div');x.className='day-header';x.style.cssText='font-weight:700;font-size:.85rem;';x.textContent=n;el.calendarGrid.appendChild(x);});
  for(let i=start-1;i>=0;i--){const x=document.createElement('div');x.className='month-cell padding-cell';x.innerHTML='<div class="month-day-num muted">'+(prev-i)+'</div>';el.calendarGrid.appendChild(x);}
  for(let day=1;day<=total;day++){const d=new Date(y,m,day),date=iso(d),c=document.createElement('div');c.className='month-cell '+(today(d)?'today':'');const n=document.createElement('div');n.className='month-day-num '+(today(d)?'today-num':'');n.textContent=day;c.appendChild(n);
    state.lessons.filter(l=>l.date===date&&match(l)).sort((a,b)=>(a.time||'').localeCompare(b.time||'')).forEach(l=>{const s=state.students.find(q=>q.id===l.studentId),b=document.createElement('div');b.className='month-lesson-badge';b.style.backgroundColor=s?s.color:COLORS[0];b.innerHTML='<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1e293b;font-weight:600;">'+esc(l.time)+' '+esc(s?s.name:'')+'</span><span>'+(l.paid?'$':'')+(l.status==='completed'?' ✓':'')+'</span>';b.onclick=e=>{e.stopPropagation();openEditLesson(l.id);};c.appendChild(b);});
    el.calendarGrid.appendChild(c);
  }
  const cells=start+total;for(let i=cells;i<Math.ceil(cells/7)*7;i++){const x=document.createElement('div');x.className='month-cell padding-cell';x.innerHTML='<div class="month-day-num muted">'+(i-cells+1)+'</div>';el.calendarGrid.appendChild(x);}
}
function render(){
  dateDisplay();viewButtons();selects();badges();
  if(state.view==='month')renderMonth();
  else if(state.view==='week'){const s=monday(state.currentDate),ds=[];for(let i=0;i<7;i++){const d=new Date(s);d.setDate(s.getDate()+i);ds.push(d);}renderColumns(ds);}
  else renderColumns([new Date(state.currentDate)]);
}
function clearLessonStudentRequired(){
  if(el.lessonStudentRequired)el.lessonStudentRequired.style.display='none';
  if(el.lessonStudentSelect)el.lessonStudentSelect.classList.remove('input-error');
}
function requireLessonStudent(){
  if(el.lessonStudentRequired)el.lessonStudentRequired.style.display='block';
  if(el.lessonStudentSelect){el.lessonStudentSelect.classList.add('input-error');el.lessonStudentSelect.focus();}
}
function openAddLesson(date,h){
  if(!activeStudents().length){toast("Спочатку додайте хоча б одного активного учня.",'error');el.studentsModal.classList.remove('hidden');state.showArchivedStudents=false;renderStudents();return;}
  state.editingLessonId=null;el.lessonModalTitle.textContent='Додати урок';selects();clearLessonStudentRequired();el.lessonStudentSelect.value='';el.lessonDateInput.value=date||iso(state.currentDate);el.lessonHourSelect.value=String(h??18).padStart(2,'0');el.lessonMinuteSelect.value='00';el.lessonPaidSelect.value='false';el.lessonStatusSelect.value='planned';el.lessonTopicInput.value='';el.lessonHomeworkInput.value='';el.lessonPaidAmount.value=DEFAULT_PAID_AMOUNT;el.lessonPaidDate.value=el.lessonDateInput.value;el.lessonPaidMethod.value=DEFAULT_PAID_METHOD;el.repeatGroup.style.display='block';el.deleteLessonBtn.style.display='none';formEdit(true);paymentVisible();el.lessonModal.classList.remove('hidden');
}
function paymentVisible(){el.paymentDetailsGroup.style.display=el.lessonPaidSelect.value==='true'?'block':'none';}
function formEdit(ok){
  [el.lessonStudentSelect,el.lessonDateInput,el.lessonHourSelect,el.lessonMinuteSelect,el.lessonPaidSelect,el.lessonStatusSelect,el.lessonTopicInput,el.lessonHomeworkInput,el.lessonPaidAmount,el.lessonPaidDate,el.lessonPaidMethod].forEach(x=>x.disabled=!ok);
  el.saveLessonBtn.style.display=ok?'block':'none';el.lessonPastNotice.style.display=ok?'none':'block';
}
function openEditLesson(id){
  const l=state.lessons.find(x=>x.id===String(id));if(!l)return;state.editingLessonId=l.id;selects();el.lessonStudentSelect.value=l.studentId;el.lessonDateInput.value=l.date;const p=(l.time||'18:00').split(':');el.lessonHourSelect.value=p[0];el.lessonMinuteSelect.value=p[1]||'00';el.lessonPaidSelect.value=String(l.paid);el.lessonStatusSelect.value=l.status;el.lessonTopicInput.value=l.topic;el.lessonHomeworkInput.value=l.homework;el.lessonPaidAmount.value=l.paidAmount??DEFAULT_PAID_AMOUNT;el.lessonPaidDate.value=l.paidDate||l.date;el.lessonPaidMethod.value=PAID_METHODS.includes(l.paidMethod)?l.paidMethod:DEFAULT_PAID_METHOD;el.repeatGroup.style.display='none';paymentVisible();const ok=!pastDate(l.date)||state.isEditMode;el.lessonModalTitle.textContent=ok?'Редагувати урок':'Перегляд уроку';formEdit(ok);el.deleteLessonBtn.style.display=l.status==='planned'?'block':'none';el.lessonModal.classList.remove('hidden');
}
async function saveLesson(){
  const sid=el.lessonStudentSelect.value,date=el.lessonDateInput.value,t=el.lessonHourSelect.value+':'+el.lessonMinuteSelect.value,paid=el.lessonPaidSelect.value==='true',status=el.lessonStatusSelect.value;
  if(!sid){requireLessonStudent();toast('Оберіть учня перед збереженням уроку.','error');return;}
  clearLessonStudentRequired();
  if(!date){toast('Виберіть дату уроку.','error');return;}
  const payload={schedule_id:state.scheduleId,student_id:sid,lesson_date:date,lesson_time:t,status:status,topic:el.lessonTopicInput.value.trim()||null,homework:el.lessonHomeworkInput.value.trim()||null,paid:paid,paid_amount:paid?(parseFloat(el.lessonPaidAmount.value)||DEFAULT_PAID_AMOUNT):null,paid_date:paid?(el.lessonPaidDate.value||date):null,paid_method:paid?(el.lessonPaidMethod.value||DEFAULT_PAID_METHOD):null};
  try{syncStatus('saving');if(state.editingLessonId){const old=state.lessons.find(x=>x.id===state.editingLessonId);if(old&&pastDate(old.date)&&!state.isEditMode){toast('Для минулої дати увімкніть режим редагування.','error');return;}const r=await db.from('v2_lessons').update(payload).eq('id',state.editingLessonId).eq('schedule_id',state.scheduleId);if(r.error)throw r.error;}
  else{const count=parseInt(el.lessonRepeatSelect.value,10)||1,p=date.split('-').map(Number);for(let i=0;i<count;i++){const d=new Date(p[0],p[1]-1,p[2]+i*7),r=await db.from('v2_lessons').insert(Object.assign({},payload,{lesson_date:iso(d)}));if(r.error)throw r.error;}}
  await loadV2();el.lessonModal.classList.add('hidden');render();toast('Урок збережено.','success');}catch(e){dbFail(e);}
}
async function deleteLesson(id){
  const l=state.lessons.find(x=>x.id===String(id));if(!l||l.status!=='planned'){toast('Видаляти можна лише заплановані уроки.','error');return;}const s=state.students.find(x=>x.id===l.studentId);if(!await confirmBox('Видалити урок '+(s?' "'+s.name+'"':'')+' — '+l.date+' '+l.time+'?'))return;
  try{syncStatus('saving');const r=await db.from('v2_lessons').delete().eq('id',l.id).eq('schedule_id',state.scheduleId);if(r.error)throw r.error;await loadV2();el.lessonModal.classList.add('hidden');render();toast('Урок видалено.','success');}catch(e){dbFail(e);}
}
async function moveLesson(id,date,t){
  const l=state.lessons.find(x=>x.id===String(id));if(!l)return;if(!state.isEditMode&&(pastDate(l.date)||pastDate(date))){toast('Перенесення минулих дат потребує режиму редагування.','error');return;}
  try{syncStatus('saving');const r=await db.from('v2_lessons').update({lesson_date:date,lesson_time:t}).eq('id',l.id).eq('schedule_id',state.scheduleId);if(r.error)throw r.error;await loadV2();render();}catch(e){dbFail(e);}
}
function clearStudentForm(){el.newStudentName.value='';el.newStudentGrade.value='';el.newStudentPhone.value='';el.newStudentParentName.value='';el.newStudentCooperationPlatform.value='';state.selectedNewStudentColor=COLORS[0];renderSwatches();}
function renderSwatches(){el.newStudentSwatches.innerHTML='';COLORS.forEach(c=>{const x=document.createElement('div');x.className='color-swatch '+(state.selectedNewStudentColor===c?'selected':'');x.style.backgroundColor=c;x.onclick=()=>{state.selectedNewStudentColor=c;renderSwatches();};el.newStudentSwatches.appendChild(x);});}
async function addStudent(){
  const name=el.newStudentName.value.trim();if(!name){toast("Введіть ім'я учня.",'error');return;}try{syncStatus('saving');const r=await db.from('v2_students').insert({schedule_id:state.scheduleId,name:name,grade:el.newStudentGrade.value.trim()||null,phone:el.newStudentPhone.value.trim()||null,parent_name:el.newStudentParentName.value.trim()||null,parent_phone:el.newStudentParentPhone.value.trim()||null,color:state.selectedNewStudentColor,cooperation_platform:el.newStudentCooperationPlatform.value||null});if(r.error)throw r.error;await loadV2();clearStudentForm();el.addStudentModal.classList.add('hidden');el.studentsModal.classList.remove('hidden');renderStudents();render();toast('Учня додано.','success');}catch(e){dbFail(e);}
}
async function updateStudent(id,patch){try{const r=await db.from('v2_students').update(patch).eq('id',String(id)).eq('schedule_id',state.scheduleId);if(r.error)throw r.error;await loadV2();renderStudents();render();}catch(e){dbFail(e);}}
async function archiveStudent(s){if(!await confirmBox('Архівувати учня "'+s.name+'"? Його уроки залишаться у розкладі та історії.'))return;try{syncStatus('saving');const r=await db.from('v2_students').update({archived_at:new Date().toISOString()}).eq('id',s.id).eq('schedule_id',state.scheduleId);if(r.error)throw r.error;await loadV2();state.showArchivedStudents=false;renderStudents();render();toast('Учня архівовано. Його уроки залишилися у розкладі.','success');}catch(e){dbFail(e);}}
async function unarchiveStudent(s){if(!await confirmBox('Розархівувати учня "'+s.name+'"? Уся збережена інформація буде повернута до активного списку.'))return;try{syncStatus('saving');const r=await db.from('v2_students').update({archived_at:null}).eq('id',s.id).eq('schedule_id',state.scheduleId);if(r.error)throw r.error;await loadV2();state.showArchivedStudents=false;renderStudents();render();toast('Учня розархівовано.','success');}catch(e){dbFail(e);}}
function renderStudents(){
  el.studentsList.innerHTML='';
  const list=state.showArchivedStudents?archivedStudents():activeStudents();
  if(!list.length){el.studentsList.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:16px;">'+(state.showArchivedStudents?'Архів порожній.':'Список активних учнів порожній.')+'</div>';return;}
  list.forEach(s=>{const edit=state.editingStudentIds.has(s.id),item=document.createElement('div');item.className='student-item';const head=document.createElement('div');head.className='student-item-header';const name=document.createElement('div');name.className='student-name-block';
    if(edit){const i=document.createElement('input');i.className='student-edit-name-input';i.value=s.name;i.onchange=()=>updateStudent(s.id,{name:i.value.trim()||s.name});name.appendChild(i);}else{const n=document.createElement('div');n.className='student-name-line';n.textContent=s.name;name.appendChild(n);if(s.grade){const g=document.createElement('div');g.className='student-grade-line';g.textContent='Клас: '+s.grade;name.appendChild(g);}}
    const card=document.createElement('button');card.className='small-btn';card.textContent='Картка';card.onclick=()=>openStudent(s.id);const editBtn=document.createElement('button');editBtn.className='small-btn '+(edit?'active':'');editBtn.textContent=edit?'✓ Готово':'✏️ Редагувати';editBtn.onclick=()=>{edit?state.editingStudentIds.delete(s.id):state.editingStudentIds.add(s.id);renderStudents();};const del=document.createElement('button');del.className=state.showArchivedStudents?'primary':'danger';del.textContent=state.showArchivedStudents?'Розархівувати':'Архівувати';del.onclick=()=>state.showArchivedStudents?unarchiveStudent(s):archiveStudent(s);head.append(name,card,editBtn,del);item.appendChild(head);
    if(!edit){const cc=document.createElement('div');cc.className='student-contact-line';const a=[];if(s.grade)a.push('🎓 '+esc(s.grade));if(s.phone)a.push('📞 '+esc(s.phone));if(s.parentName)a.push('👤 '+esc(s.parentName));if(s.parentPhone)a.push('📞 батьки: '+esc(s.parentPhone));a.push('💼 '+esc(platformLabel(s)));cc.innerHTML=a.join(' &nbsp;·&nbsp; ');item.appendChild(cc);}
    else{const extra=document.createElement('div');extra.className='student-extra-fields';const fld=(ph,val,key)=>{const i=document.createElement('input');i.placeholder=ph;i.value=val||'';i.onchange=()=>updateStudent(s.id,{[key]:i.value.trim()});return i;};const platform=document.createElement('select');platform.innerHTML='<option value="">Платформа не вказана</option>'+COOPERATION_PLATFORMS.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');platform.value=s.cooperationPlatform||'';platform.onchange=()=>updateStudent(s.id,{cooperation_platform:platform.value||null});extra.append(fld('Клас',s.grade,'grade'),fld('Контактний телефон',s.phone,'phone'),fld("Ім'я батьків",s.parentName,'parent_name'),fld('Телефон батьків',s.parentPhone,'parent_phone'),platform);item.appendChild(extra);const lab=document.createElement('div');lab.style.cssText='font-size:.78rem;font-weight:600;color:var(--text-muted);margin-top:2px;';lab.textContent='Колір картки:';item.appendChild(lab);const sw=document.createElement('div');sw.className='student-color-swatches';COLORS.forEach(col=>{const d=document.createElement('div');d.className='swatch-dot '+(s.color===col?'active':'');d.style.backgroundColor=col;d.onclick=()=>updateStudent(s.id,{color:col});sw.appendChild(d);});item.appendChild(sw);}
    el.studentsList.appendChild(item);
  });
}
function studentStats(id){const ls=state.lessons.filter(l=>l.studentId===String(id)),done=ls.filter(l=>l.status==='completed');return{lessons:ls,completed:done,planned:ls.filter(l=>l.status==='planned'),completedCount:done.length,completedUnpaid:done.filter(l=>!l.paid).length,paidNotCompleted:ls.filter(l=>l.paid&&l.status!=='completed').length};}
function personalLink(id){const s=state.students.find(x=>x.id===String(id));if(!s||!s.accessToken)return'';const u=new URL('student-schedule.html',window.location.href);u.searchParams.set('token',s.accessToken);return u.toString();}
function openStudent(id){
  const s=state.students.find(x=>x.id===String(id));if(!s)return;state.currentInfoStudentId=s.id;el.studentInfoTitle.textContent=s.name;
  el.studentInfoFields.innerHTML='<div class="info-row"><span>Клас</span><span>'+(esc(s.grade)||'—')+'</span></div><div class="info-row"><span>Платформа</span><span>'+esc(platformLabel(s))+'</span></div><div class="info-row"><span>Контактний телефон</span><span>'+(esc(s.phone)||'—')+'</span></div><div class="info-row"><span>Ім\'я батьків</span><span>'+(esc(s.parentName)||'—')+'</span></div><div class="info-row"><span>Телефон батьків</span><span>'+(esc(s.parentPhone)||'—')+'</span></div>';
  const st=studentStats(s.id);el.studentInfoStats.innerHTML='<div class="stat-card"><b>'+st.completedCount+'</b><span>Проведено уроків</span></div><div class="stat-card"><b>'+st.completedUnpaid+'</b><span>Проведено, не оплачено</span></div><div class="stat-card"><b>'+st.paidNotCompleted+'</b><span>Оплачено, не проведено</span></div>';el.studentInfoLinkInput.value=personalLink(s.id);renderStudentCompleted(s.id);el.studentInfoModal.classList.remove('hidden');
}
function renderStudentsPicker(){
  el.studentsPickerList.innerHTML='';activeStudents().forEach(s=>{const x=document.createElement('div');x.className='clickable-list-item';x.style.backgroundColor=s.color||COLORS[0];x.innerHTML='<span>'+esc(s.name)+'</span><span style="font-weight:500;font-size:.8rem;color:#475569;">'+esc(s.grade||'')+'</span>';x.onclick=()=>{el.studentsPickerModal.classList.add('hidden');openStudent(s.id);};el.studentsPickerList.appendChild(x);});
}
function renderStudentCompleted(id){
  const ls=studentStats(id).completed.slice().sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time));el.studentInfoList.innerHTML='';if(!ls.length){el.studentInfoList.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:16px;">Ще немає проведених уроків.</div>';return;}
  ls.forEach(l=>{const x=document.createElement('div');x.className='lesson-history-item';x.innerHTML='<div class="lesson-history-header"><strong>'+esc(prettyDate(l.date))+', '+esc(l.time)+'</strong><span class="badge" style="background:'+(l.paid?'#dcfce7':'#fee2e2')+';color:'+(l.paid?'#15803d':'#991b1b')+';">'+(l.paid?'Оплачено':'Не оплачено')+'</span></div>'+(l.topic?'<div class="lesson-history-row"><b>Тема:</b> '+esc(l.topic)+'</div>':'')+(l.homework?'<div class="lesson-history-row"><b>ДЗ:</b> '+esc(l.homework)+'</div>':'');el.studentInfoList.appendChild(x);});
}
function renderStudentPlanned(id){
  const ls=studentStats(id).planned.slice().sort((a,b)=>(a.date+' '+a.time).localeCompare(b.date+' '+b.time));el.studentInfoList.innerHTML='';if(!ls.length){el.studentInfoList.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:16px;">Немає запланованих уроків.</div>';return;}
  ls.forEach(l=>{const x=document.createElement('div');x.className='lesson-history-item';x.innerHTML='<div class="lesson-history-header"><strong>'+esc(prettyDate(l.date))+', '+esc(l.time)+'</strong></div>'+(l.topic?'<div class="lesson-history-row"><b>Тема:</b> '+esc(l.topic)+'</div>':'');el.studentInfoList.appendChild(x);});
}
function renderRequests(){
  const p=state.bookingRequests.filter(x=>x.status==='pending');el.requestsList.innerHTML='';if(!p.length){el.requestsList.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:16px;">Наразі немає нових заявок.</div>';return;}
  p.forEach(r=>{const s=state.students.find(x=>x.id===r.studentId),item=document.createElement('div');item.className='request-item';const row=document.createElement('div');row.className='request-row';
    row.innerHTML=r.type==='reschedule'?'<strong>'+esc(s?s.name:'Невідомий учень')+'</strong><span>Перенесення: '+esc(prettyDate(r.oldDate))+' '+esc(r.oldTime||'')+' → '+esc(prettyDate(r.date))+', '+esc(r.time)+'</span>':'<strong>'+esc(s?s.name:'Невідомий учень')+'</strong><span>'+esc(prettyDate(r.date))+', '+esc(r.time)+'</span>';
    const a=document.createElement('div');a.className='request-actions';const ok=document.createElement('button');ok.className='primary';ok.textContent='Підтвердити';ok.onclick=()=>approve(r.id);const no=document.createElement('button');no.className='danger';no.textContent='Відхилити';no.onclick=()=>reject(r.id);a.append(ok,no);item.append(row,a);el.requestsList.appendChild(item);
  });
}
async function approve(id){try{syncStatus('saving');const r=await db.rpc('v2_approve_booking_request',{p_request_id:id});if(r.error)throw r.error;await loadV2();renderRequests();render();toast('Заявку підтверджено.','success');}catch(e){dbFail(e);}}
async function reject(id){const q=state.bookingRequests.find(x=>x.id===String(id));if(!q)return;const s=state.students.find(x=>x.id===q.studentId);if(!await confirmBox(q.type==='reschedule'?'Відхилити запит на перенесення від '+(s?s.name:'учня')+'?':'Відхилити заявку від '+(s?s.name:'учня')+' на '+q.date+' '+q.time+'?'))return;try{syncStatus('saving');const r=await db.rpc('v2_reject_request',{p_request_id:id});if(r.error)throw r.error;await loadV2();renderRequests();render();toast('Заявку відхилено.','info');}catch(e){dbFail(e);}}
async function takeBackup(){if(!state.scheduleId)return;if(!await confirmBox('Створити серверний знімок поточного V2-розкладу?'))return;try{syncStatus('saving');const r=await db.rpc('v2_take_schedule_snapshot',{p_schedule_id:state.scheduleId});if(r.error)throw r.error;await loadV2();renderBackups();toast('Бекап створено на сервері.','success');}catch(e){dbFail(e);}}
function renderBackups(){
  el.backupsList.innerHTML='';if(!state.backups.length){el.backupsList.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:16px;">Серверних бекапів ще немає.</div>';return;}
  state.backups.forEach(s=>{const d=s.snapshot||{},a=Array.isArray(d.students)?d.students.length:0,b=Array.isArray(d.lessons)?d.lessons.length:0,c=Array.isArray(d.slotOverrides)?d.slotOverrides.length:0,q=Array.isArray(d.bookingRequests)?d.bookingRequests.length:0,x=document.createElement('div');x.className='backup-item';x.innerHTML='<span><strong>'+esc(new Date(s.created_at).toLocaleString('uk-UA'))+'</strong><br><small>'+a+' учнів · '+b+' уроків · '+c+' слотів · '+q+' заявок</small></span>';el.backupsList.appendChild(x);});
}
function renderAudit(){
  el.auditLogList.innerHTML='';if(!state.auditLog.length){el.auditLogList.innerHTML='<div style="color:var(--text-muted);text-align:center;padding:16px;">Журнал порожній.</div>';return;}
  state.auditLog.forEach(x=>{const d=document.createElement('div');d.className='audit-item';d.innerHTML='<div>'+esc(x.action)+'</div><div class="audit-meta">'+esc(x.actor)+' · '+esc(new Date(x.ts).toLocaleString('uk-UA'))+'</div>';el.auditLogList.appendChild(d);});
}
function reportRange(){const p=el.reportPeriodSelect.value,t=new Date(),s=iso(t);if(p==='today')return{from:s,to:s};if(p==='week'){const a=monday(t),b=new Date(a);b.setDate(a.getDate()+6);return{from:iso(a),to:iso(b)}}if(p==='month')return{from:iso(new Date(t.getFullYear(),t.getMonth(),1)),to:iso(new Date(t.getFullYear(),t.getMonth()+1,0))};if(p==='year')return{from:iso(new Date(t.getFullYear(),0,1)),to:iso(new Date(t.getFullYear(),11,31))};if(p==='all'){if(!state.lessons.length)return{from:s,to:s};const d=state.lessons.map(x=>x.date).sort();return{from:d[0],to:d[d.length-1]};}return{from:el.reportFromDate.value||s,to:el.reportToDate.value||s};}
function generateReport(){
  const r=reportRange(),done=state.lessons.filter(l=>l.date>=r.from&&l.date<=r.to&&l.status==='completed'),paid=done.filter(l=>l.paid),unpaid=done.filter(l=>!l.paid),sum=paid.reduce((a,l)=>a+Number(l.paidAmount||0),0),m=new Map();
  done.forEach(l=>{const s=state.students.find(x=>x.id===l.studentId),n=s?s.name:'Невідомий учень';if(!m.has(n))m.set(n,{count:0,paid:0,sum:0});const x=m.get(n);x.count++;if(l.paid){x.paid++;x.sum+=Number(l.paidAmount||0);}});
  let rows='';m.forEach((x,n)=>rows+='<tr><td>'+esc(n)+'</td><td>'+x.count+'</td><td>'+x.paid+'</td><td>'+x.sum+' грн</td></tr>');
  el.reportOutput.innerHTML='<div style="font-size:.85rem;color:var(--text-muted);margin-bottom:8px;">Період: '+esc(prettyDate(r.from))+' — '+esc(prettyDate(r.to))+'</div><div class="stat-cards"><div class="stat-card"><b>'+done.length+'</b><span>Проведено</span></div><div class="stat-card"><b>'+paid.length+'</b><span>Оплачено · '+sum+' грн</span></div><div class="stat-card"><b>'+unpaid.length+'</b><span>Не оплачено</span></div></div><table class="report-table"><thead><tr><th>Учень</th><th>Проведено</th><th>Оплачено</th><th>Сума</th></tr></thead><tbody>'+(rows||'<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Немає даних</td></tr>')+'</tbody></table>';
}
function renderIssues(){
  const a=[];state.lessons.forEach(l=>{if(!state.students.some(s=>s.id===l.studentId))a.push('Урок '+l.date+' '+l.time+': учня не знайдено.');if(pastDate(l.date)&&l.status==='planned')a.push('Урок '+prettyDate(l.date)+', '+l.time+': дата минула, але статус — заплановано.');if(l.status==='completed'&&!l.topic)a.push('Урок '+prettyDate(l.date)+', '+l.time+': не вказано тему.');});
  state.students.forEach(s=>{const m=[];if(!s.grade)m.push('клас');if(!s.phone)m.push('телефон');if(!s.parentName)m.push("ім'я батьків");if(!s.parentPhone)m.push('телефон батьків');if(m.length)a.push('Учень "'+s.name+'": '+m.join(', ')+'.');});
  el.issuesList.innerHTML=a.length?a.map(x=>'<div class="issue-item">'+esc(x)+'</div>').join(''):'<div class="issue-item ok">✓ Помилок та незаповнених полів не знайдено.</div>';
}
function hideContext(){el.lessonContextMenu.classList.add('hidden');state.contextLessonId=null;state.contextSlot=null;}
function showContext(x,y,a){state.contextLessonId=a.lessonId?String(a.lessonId):null;state.contextSlot=a.dateISO&&a.hour!=null?{dateISO:a.dateISO,hour:a.hour}:null;const l=state.contextLessonId?state.lessons.find(z=>z.id===state.contextLessonId):null;el.contextMenuEdit.style.display=l?'block':'none';el.contextMenuDelete.style.display=l?'block':'none';el.contextMenuAdd.style.display=!l&&state.contextSlot?'block':'none';el.contextMenuToggle.style.display=!l&&state.contextSlot?'block':'none';el.contextMenuDelete.disabled=!!l&&l.status!=='planned';el.lessonContextMenu.classList.remove('hidden');const r=el.lessonContextMenu.getBoundingClientRect(),mx=Math.max(4,innerWidth-r.width-4),my=Math.max(4,innerHeight-r.height-4);el.lessonContextMenu.style.left=Math.min(Math.max(4,x),mx)+'px';el.lessonContextMenu.style.top=Math.min(Math.max(4,y),my)+'px';}
function setupContext(){document.addEventListener('click',hideContext);document.addEventListener('scroll',hideContext,true);el.lessonContextMenu.addEventListener('click',e=>e.stopPropagation());el.contextMenuEdit.onclick=()=>{const id=state.contextLessonId;hideContext();if(id)openEditLesson(id);};el.contextMenuDelete.onclick=()=>{const id=state.contextLessonId;hideContext();if(id)deleteLesson(id);};el.contextMenuAdd.onclick=()=>{const s=state.contextSlot;hideContext();if(s)openAddLesson(s.dateISO,s.hour);};el.contextMenuToggle.onclick=()=>{const s=state.contextSlot;hideContext();if(s)toggleSlot(s.dateISO,s.hour);};}
function setupModals(){document.addEventListener('keydown',e=>{if(e.key!=='Escape'&&e.key!=='Enter')return;const m=document.querySelector('.modal:not(.hidden)');if(!m)return;e.preventDefault();const id=e.key==='Escape'?m.dataset.cancelBtn:m.dataset.confirmBtn,b=id?$(id):null;if(b)b.click();});document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target!==m||innerWidth>640)return;const id=m.dataset.cancelBtn,b=id?$(id):null;if(b)b.click();}));}
function setupUI(){
  safeBind('themeToggleBtn','onclick',()=>theme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'));
  safeBind('settingsBtn','onclick',()=>el.settingsModal.classList.remove('hidden'));
  safeBind('closeSettingsModalBtn','onclick',()=>el.settingsModal.classList.add('hidden'));
  safeBind('editModeCheckbox','onchange',e=>{state.isEditMode=e.target.checked;render();});
  safeBind('modalAddLessonBtn','onclick',()=>{el.settingsModal.classList.add('hidden');openAddLesson();});
  safeBind('modalManageStudentsBtn','onclick',()=>{el.settingsModal.classList.add('hidden');renderStudents();el.studentsModal.classList.remove('hidden');});
  safeBind('modalRequestsBtn','onclick',()=>{el.settingsModal.classList.add('hidden');renderRequests();el.requestsModal.classList.remove('hidden');});
  safeBind('closeRequestsModalBtn','onclick',()=>el.requestsModal.classList.add('hidden'));
  safeBind('modalReportsBtn','onclick',()=>{el.settingsModal.classList.add('hidden');generateReport();el.reportsModal.classList.remove('hidden');});
  safeBind('closeReportsModalBtn','onclick',()=>el.reportsModal.classList.add('hidden'));
  safeBind('reportPeriodSelect','onchange',()=>el.reportCustomRange.style.display=el.reportPeriodSelect.value==='custom'?'flex':'none');
  safeBind('generateReportBtn','onclick',generateReport);
  safeBind('modalIssuesBtn','onclick',()=>{el.settingsModal.classList.add('hidden');renderIssues();el.issuesModal.classList.remove('hidden');});
  safeBind('closeIssuesModalBtn','onclick',()=>el.issuesModal.classList.add('hidden'));
  safeBind('modalAuditLogBtn','onclick',()=>{el.settingsModal.classList.add('hidden');renderAudit();el.auditLogModal.classList.remove('hidden');});
  safeBind('closeAuditLogModalBtn','onclick',()=>el.auditLogModal.classList.add('hidden'));
  safeBind('modalBackupsBtn','onclick',()=>{el.settingsModal.classList.add('hidden');renderBackups();el.backupsModal.classList.remove('hidden');});
  safeBind('closeBackupsModalBtn','onclick',()=>el.backupsModal.classList.add('hidden'));
  safeBind('studentsInfoBtn','onclick',()=>{renderStudentsPicker();el.studentsPickerModal.classList.remove('hidden');});
  safeBind('closeStudentsPickerModalBtn','onclick',()=>el.studentsPickerModal.classList.add('hidden'));
  safeBind('closeStudentInfoModalBtn','onclick',()=>el.studentInfoModal.classList.add('hidden'));
  safeBind('studentInfoHistoryBtn','onclick',()=>renderStudentCompleted(state.currentInfoStudentId));
  safeBind('studentInfoPlannedBtn','onclick',()=>renderStudentPlanned(state.currentInfoStudentId));
  safeBind('studentInfoCopyLinkBtn','onclick',async()=>{try{await navigator.clipboard.writeText(el.studentInfoLinkInput.value);toast('Персональне посилання скопійовано.','success');}catch(e){toast('Не вдалося скопіювати посилання.','error');}});
  safeBind('closeStudentsModalBtn','onclick',()=>el.studentsModal.classList.add('hidden'));
  safeBind('showActiveStudentsBtn','onclick',()=>{state.showArchivedStudents=false;renderStudents();});
  safeBind('showArchivedStudentsBtn','onclick',()=>{state.showArchivedStudents=true;renderStudents();});
  safeBind('lessonStudentSelect','onchange',clearLessonStudentRequired);
  safeBind('openAddStudentModalBtn','onclick',()=>{clearStudentForm();el.studentsModal.classList.add('hidden');el.addStudentModal.classList.remove('hidden');});
  safeBind('closeAddStudentModalBtn','onclick',()=>{el.addStudentModal.classList.add('hidden');el.studentsModal.classList.remove('hidden');});
  safeBind('saveNewStudentBtn','onclick',addStudent);
  safeBind('lessonPaidSelect','onchange',paymentVisible);
  safeBind('closeLessonModalBtn','onclick',()=>el.lessonModal.classList.add('hidden'));
  safeBind('saveLessonBtn','onclick',saveLesson);
  safeBind('deleteLessonBtn','onclick',()=>{if(state.editingLessonId)deleteLesson(state.editingLessonId);});
  safeBind('viewDayBtn','onclick',()=>{state.view='day';render();});
  safeBind('viewWeekBtn','onclick',()=>{state.view='week';render();});
  safeBind('viewMonthBtn','onclick',()=>{state.view='month';render();});
  safeBind('filterTypeSelect','onchange',e=>{state.filterType=e.target.value;render();});
  safeBind('filterStudentSelect','onchange',e=>{state.filterStudentId=e.target.value;render();});
  safeBind('todayBtn','onclick',()=>{state.currentDate=new Date();render();});
  safeBind('prevBtn','onclick',()=>{if(state.view==='day')state.currentDate.setDate(state.currentDate.getDate()-1);else if(state.view==='week')state.currentDate.setDate(state.currentDate.getDate()-7);else state.currentDate=new Date(state.currentDate.getFullYear(),state.currentDate.getMonth()-1,1);render();});
  safeBind('nextBtn','onclick',()=>{if(state.view==='day')state.currentDate.setDate(state.currentDate.getDate()+1);else if(state.view==='week')state.currentDate.setDate(state.currentDate.getDate()+7);else state.currentDate=new Date(state.currentDate.getFullYear(),state.currentDate.getMonth()+1,1);render();});
  try{if(el.modalStudentLinkBtn)el.modalStudentLinkBtn.style.display='none';}catch(e){console.error('UI setup failed: modalStudentLinkBtn',e);}
  try{
    if(!$('manual-backup-btn')){
      const b=document.createElement('button');b.id='manual-backup-btn';b.type='button';b.style.cssText='width:100%;padding:12px;';b.textContent='💾 Зробити бекап';b.onclick=takeBackup;
      if(el.modalBackupsBtn?.parentElement)el.modalBackupsBtn.parentElement.insertBefore(b,el.modalBackupsBtn);else console.error('UI setup skipped: modalBackupsBtn parent missing');
    }
  }catch(e){console.error('UI binding failed: manual-backup-btn',e);}
  try{
    if(!$('logout-teacher-btn')){
      const b=document.createElement('button');b.id='logout-teacher-btn';b.type='button';b.className='danger';b.style.cssText='width:100%;padding:12px;';b.textContent='Вийти з акаунта викладача';
      b.onclick=async()=>{const r=await db.auth.signOut();if(r.error)dbFail(r.error);else{setVisible(false);$('teacher-auth-gate').style.display='flex';}};
      if(el.modalBackupsBtn?.parentElement)el.modalBackupsBtn.parentElement.appendChild(b);else console.error('UI setup skipped: logout container missing');
    }
  }catch(e){console.error('UI binding failed: logout-teacher-btn',e);}
}
async function start(gate){
  try{await authUser();gate.style.display='none';setVisible(true);cache();populateLessonTimeSelects();theme(localStorage.getItem(THEME_KEY)||'light');setupUI();setupModals();setupContext();await loadV2();renderSwatches();render();await autoComplete();render();}
  catch(e){setVisible(false);gate.style.display='flex';const m=$('teacher-login-message');if(m)m.textContent=e.message||'Не вдалося відкрити V2-розклад.';}
}
document.addEventListener('DOMContentLoaded',async()=>{
  let gate;
  try{gate=createAuthGate();setVisible(false);}catch(e){console.error('Auth gate initialization failed',e);return;}
  const email=$('teacher-email'),password=$('teacher-password'),button=$('teacher-login-btn'),msg=$('teacher-login-message'),forgot=$('teacher-forgot-btn'),recoveryCancel=$('teacher-recovery-cancel-btn'),recoveryUpdate=$('teacher-update-password-btn');
  async function login(){
    if(!db){if(msg)msg.textContent='Supabase-клієнт недоступний.';return;}
    try{
      if(button)button.disabled=true;if(msg)msg.textContent='Вхід...';
      const r=await db.auth.signInWithPassword({email:email?.value.trim()||'',password:password?.value||''});
      if(r.error)throw r.error;if(msg)msg.textContent='';await start(gate);
    }catch(e){console.error(e);if(msg)msg.textContent=e.message||'Не вдалося увійти.';}
    finally{if(button)button.disabled=false;}
  }
  safeDomBind('teacher-login-btn','onclick',login);
  safeDomBind('teacher-forgot-btn','onclick',()=>requestPasswordRecovery());
  safeDomBind('teacher-recovery-cancel-btn','onclick',()=>{window.history.replaceState({},document.title,window.location.pathname);showLoginPanel(gate);});
  safeDomBind('teacher-update-password-btn','onclick',()=>updateRecoveredPassword(gate));
  [email,password].forEach((node,i)=>safeAddEventListener(node,'keydown',e=>{if(e.key==='Enter')login();},i===0?'teacher-email':'teacher-password'));
  try{
    if(db){
      db.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')showRecoveryPanel(gate);});
      if(isRecoveryRedirect())showRecoveryPanel(gate);
      else{const r=await db.auth.getSession();if(r.error)console.error(r.error);if(r.data&&r.data.session&&r.data.session.user)await start(gate);}
    }
  }catch(e){console.error('Auth bootstrap failed',e);}
});
