const SUPABASE_URL = "https://vjjrwvraannccejyqcci.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XYvCzMPGQjhT0AT2r2v3dw_zZIesIJB";
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

const DAY_NAMES = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
const MONTH_NAMES = ['січ.','лют.','берез.','квіт.','трав.','черв.','лип.','серп.','верес.','жовт.','лист.','груд.'];
const THEME_KEY = 'schedule_theme_pref';

const state = {
  token: null,
  student: null,
  settings: { minHour:9, maxHour:21, defaultOpenHour:18 },
  ownLessons: [],
  busySlots: [],
  openOverrides: [],
  closedOverrides: [],
  pendingRequests: [],
  currentDate: new Date(),
  rescheduleFrom: null
};

const els = {};

function $(id){return document.getElementById(id);}
function cache(){[
  'schedule-container','current-week-display','prev-week-btn','next-week-btn','today-btn','theme-toggle-btn',
  'page-title','page-subtitle','toast-container','confirm-modal','confirm-modal-message',
  'confirm-modal-cancel-btn','confirm-modal-ok-btn','reschedule-banner','reschedule-banner-text',
  'reschedule-banner-cancel-btn','lesson-detail-modal','lesson-detail-title','lesson-detail-body',
  'lesson-detail-close-btn','lesson-detail-reschedule-btn'
].forEach(id=>els[id]=$(id));}

function toast(message,type,duration){
  const t=document.createElement('div');t.className='toast '+(type||'info');t.textContent=message;els.toastContainer.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),250);},duration||3200);
}
function confirmBox(message){
  return new Promise(resolve=>{
    els.confirmModalMessage.textContent=message;els.confirmModal.classList.remove('hidden');
    const done=v=>{els.confirmModal.classList.add('hidden');els.confirmModalOkBtn.onclick=null;els.confirmModalCancelBtn.onclick=null;resolve(v);};
    els.confirmModalOkBtn.onclick=()=>done(true);els.confirmModalCancelBtn.onclick=()=>done(false);
  });
}
function applyTheme(v){document.documentElement.setAttribute('data-theme',v);els.themeToggleBtn.textContent=v==='dark'?'☀️':'🌙';localStorage.setItem(THEME_KEY,v);}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function prettyDate(s){const p=String(s).split('-').map(Number);if(!p[0])return s||'';return new Date(p[0],p[1]-1,p[2]).toLocaleDateString('uk-UA',{day:'numeric',month:'long',year:'numeric'});}
function monday(d){const x=new Date(d),day=x.getDay();x.setDate(x.getDate()-day+(day===0?-6:1));x.setHours(0,0,0,0);return x;}
function time(h){return String(h).padStart(2,'0')+':00';}
function pastSlot(date,h){const p=date.split('-').map(Number);return new Date(p[0],p[1]-1,p[2],h,0,0).getTime()<Date.now();}
function esc(v){const d=document.createElement('div');d.textContent=v==null?'':String(v);return d.innerHTML;}

async function loadStudentSchedule(){
  if(!db)throw new Error('Supabase-клієнт не ініціалізовано.');
  if(!state.token)throw new Error('У посиланні немає персонального токена учня.');

  const start=monday(state.currentDate),end=new Date(start);end.setDate(start.getDate()+6);
  const r=await db.rpc('v2_get_student_schedule',{
    p_token:state.token,p_from:iso(start),p_to:iso(end)
  });
  if(r.error)throw r.error;
  if(!r.data||!r.data.student)throw new Error('Невірне або застаріле персональне посилання.');

  state.student=r.data.student;
  state.settings=r.data.scheduleSettings||state.settings;
  state.ownLessons=Array.isArray(r.data.ownLessons)?r.data.ownLessons.map(x=>({
    id:String(x.id),date:String(x.date),time:String(x.time||'00:00').slice(0,5),status:x.status||'planned',
    topic:x.topic||'',homework:x.homework||'',paid:!!x.paid,paidAmount:x.paidAmount==null?null:Number(x.paidAmount),paidMethod:x.paidMethod||null
  })):[];
  state.busySlots=Array.isArray(r.data.busySlots)?r.data.busySlots.map(x=>({date:String(x.date),time:String(x.time).slice(0,5)})):[];
  state.openOverrides=Array.isArray(r.data.openOverrides)?r.data.openOverrides.map(x=>({date:String(x.date),time:String(x.time).slice(0,5)})):[];
  state.closedOverrides=Array.isArray(r.data.closedOverrides)?r.data.closedOverrides.map(x=>({date:String(x.date),time:String(x.time).slice(0,5)})):[];
  state.pendingRequests=Array.isArray(r.data.myPendingRequests)?r.data.myPendingRequests.map(x=>({
    id:String(x.id),type:x.type,lessonId:x.lessonId?String(x.lessonId):null,date:String(x.date),time:String(x.time).slice(0,5),
    oldDate:x.oldDate||null,oldTime:x.oldTime?String(x.oldTime).slice(0,5):null
  })):[];
}

function busy(date,h){return state.busySlots.some(x=>x.date===date&&x.time===time(h));}
function ownLesson(date,h){return state.ownLessons.find(x=>x.date===date&&parseInt(x.time.split(':')[0],10)===h)||null;}
function pendingBooking(date,h){return state.pendingRequests.find(x=>x.type==='booking'&&x.date===date&&x.time===time(h))||null;}
function pendingReschedule(lessonId){return state.pendingRequests.find(x=>x.type==='reschedule'&&String(x.lessonId)===String(lessonId))||null;}

function isOpen(date,h){
  if(pastSlot(date,h))return false;
  if(busy(date,h))return false;
  const t=time(h);
  if(h < Number(state.settings.defaultOpenHour||18))return state.openOverrides.some(x=>x.date===date&&x.time===t);
  return !state.closedOverrides.some(x=>x.date===date&&x.time===t);
}

function dayEntries(date){
  const out=[];let run=[];
  const flush=()=>{if(run.length){out.push({type:'free',start:run[0],end:run[run.length-1]+1});run=[];}};
  const min=Number(state.settings.minHour||9),max=Number(state.settings.maxHour||21);
  for(let h=min;h<=max;h++){
    const own=ownLesson(date,h);
    if(own){flush();out.push({type:'lesson',hour:h,lesson:own});continue;}
    const pr=pendingBooking(date,h);
    if(pr){flush();out.push({type:'pending',hour:h});continue;}
    if(isOpen(date,h)){
      if(h < Number(state.settings.defaultOpenHour||18)){if(run.length&&run[run.length-1]!==h-1)flush();run.push(h);}
      else{flush();out.push({type:'free',start:h,end:h+1});}
    }else flush();
  }
  flush();return out;
}

function dayHeader(date){
  const h=document.createElement('div');h.className='day-header '+(date.toDateString()===new Date().toDateString()?'today':'');
  const n=document.createElement('span');n.className='day-header-name';n.textContent=DAY_NAMES[(date.getDay()+6)%7];
  const d=document.createElement('span');d.className='day-header-date';d.textContent=date.getDate()+' '+MONTH_NAMES[date.getMonth()];h.append(n,d);return h;
}

function renderWeek(){
  const start=monday(state.currentDate),end=new Date(start);end.setDate(start.getDate()+6);
  els.currentWeekDisplay.textContent=start.getDate()+' '+MONTH_NAMES[start.getMonth()]+' - '+end.getDate()+' '+MONTH_NAMES[end.getMonth()];
  els.scheduleContainer.innerHTML='';
  const wrap=document.createElement('div');wrap.className='week-columns week-pairs';

  for(let i=0;i<7;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);const date=iso(d),col=document.createElement('div');col.className='day-column';col.appendChild(dayHeader(d));
    const entries=dayEntries(date);
    if(!entries.length){const e=document.createElement('div');e.className='no-slots';e.textContent='Немає вільних годин';col.appendChild(e);}
    entries.forEach(x=>{
      if(x.type==='lesson'){renderOwnLesson(col,x.lesson);return;}
      if(x.type==='pending'){const p=document.createElement('div');p.className='slot-pending';p.textContent=time(x.hour)+' Очікує підтвердження';col.appendChild(p);return;}
      const f=document.createElement('div');f.className='slot-free';f.textContent=time(x.start)+(x.end>x.start+1?'–'+time(x.end):'')+' Вільно';
      if(state.student){f.classList.add('bookable');}
      if(state.rescheduleFrom){f.classList.add('reschedule-target');f.title='Запропонувати цей час для перенесення';f.onclick=()=>requestReschedule(date,x.start);}
      else{f.title='Надіслати заявку на запис';f.onclick=()=>requestBooking(date,x.start);}
      col.appendChild(f);
    });
    wrap.appendChild(col);
  }
  els.scheduleContainer.appendChild(wrap);
}

function renderOwnLesson(col,l){
  const pending=pendingReschedule(l.id),isCompleted=l.status==='completed',isPaid=l.paid;
  const x=document.createElement('div');x.className='slot-lesson '+(pending?'pending-reschedule':(isCompleted?'completed':'planned'));
  const t=document.createElement('div');t.className='slot-lesson-time';t.textContent=l.time;x.appendChild(t);
  const n=document.createElement('div');n.className='slot-lesson-student';n.textContent=state.student.name;x.appendChild(n);
  if(l.topic){const q=document.createElement('div');q.className='slot-lesson-topic';q.textContent=l.topic;x.appendChild(q);}
  const b=document.createElement('div');b.className='slot-lesson-badges';
  const s=document.createElement('span');s.className='mini-badge '+(isCompleted?'status-completed':'status-planned');s.textContent=pending?'⏳ Перенесення':(isCompleted?'Проведено':'Заплановано');b.appendChild(s);
  const p=document.createElement('span');p.className='mini-badge '+(isPaid?'paid-yes':'paid-no');p.textContent=isPaid?'Оплачено':'Не опл.';b.appendChild(p);x.appendChild(b);
  x.onclick=()=>showLesson(l);col.appendChild(x);
}

function showLesson(l){
  const pending=pendingReschedule(l.id);
  els.lessonDetailTitle.textContent=prettyDate(l.date)+', '+l.time;
  els.lessonDetailBody.innerHTML='<div class="lesson-detail-row"><b>Статус:</b> '+(l.status==='completed'?'Проведено':'Заплановано')+'</div><div class="lesson-detail-row"><b>Тема уроку:</b> '+(l.topic?esc(l.topic):'—')+'</div><div class="lesson-detail-row"><b>Домашнє завдання:</b> '+(l.homework?esc(l.homework):'—')+'</div>';
  const p=document.createElement('div');p.className='payment-note '+(l.paid?'paid':'unpaid');p.textContent=l.paid?'Оплачено'+(l.paidAmount!=null?' · '+l.paidAmount+' грн':'')+(l.paidMethod?' · '+l.paidMethod:''):'⚠️ Урок ще не оплачено. Будь ласка, зв\'яжіться з викладачем щодо оплати.';els.lessonDetailBody.appendChild(p);
  if(pending){const q=document.createElement('div');q.className='lesson-detail-row';q.style.marginTop='10px';q.innerHTML='<b>⏳ Запит на перенесення</b> вже надіслано на '+prettyDate(pending.date)+', '+pending.time+' — очікує підтвердження.';els.lessonDetailBody.appendChild(q);}
  const can=l.status==='planned'&&!pending&&!pastSlot(l.date,parseInt(l.time.split(':')[0],10));
  els.lessonDetailRescheduleBtn.style.display=can?'block':'none';
  els.lessonDetailRescheduleBtn.onclick=()=>{els.lessonDetailModal.classList.add('hidden');state.rescheduleFrom={lessonId:l.id,date:l.date,time:l.time};els.rescheduleBannerText.textContent='Оберіть новий вільний час для перенесення уроку з '+prettyDate(l.date)+', '+l.time;els.rescheduleBanner.classList.remove('hidden');renderWeek();};
  els.lessonDetailModal.classList.remove('hidden');
}

async function requestBooking(date,h){
  const label=prettyDate(date)+', '+time(h);
  if(!await confirmBox('Надіслати заявку на запис: '+label+'?'))return;
  try{
    const r=await db.rpc('v2_create_booking_request',{p_token:state.token,p_date:date,p_time:time(h)});
    if(r.error)throw r.error;
    await loadStudentSchedule();renderWeek();toast('Заявку надіслано! Очікуйте підтвердження від викладача.','success');
  }catch(e){console.error(e);toast(e.message||'Не вдалося надіслати заявку.','error',5000);}
}

async function requestReschedule(date,h){
  if(!state.rescheduleFrom)return;
  const from=state.rescheduleFrom,newTime=time(h);
  if(date===from.date&&newTime===from.time){toast('Оберіть інший час.','error');return;}
  if(!await confirmBox('Запросити перенесення з '+prettyDate(from.date)+', '+from.time+' на '+prettyDate(date)+', '+newTime+'?'))return;
  try{
    const r=await db.rpc('v2_create_reschedule_request',{p_token:state.token,p_lesson_id:from.lessonId,p_new_date:date,p_new_time:newTime});
    if(r.error)throw r.error;
    state.rescheduleFrom=null;els.rescheduleBanner.classList.add('hidden');await loadStudentSchedule();renderWeek();toast('Запит на перенесення надіслано.','success');
  }catch(e){console.error(e);toast(e.message||'Не вдалося надіслати запит.','error',5000);}
}

function setupModals(){
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'&&e.key!=='Enter')return;const m=document.querySelector('.modal:not(.hidden)');if(!m)return;e.preventDefault();
    const id=e.key==='Escape'?m.dataset.cancelBtn:m.dataset.confirmBtn,b=id?$(id):null;if(b)b.click();
  });
  document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{
    if(e.target!==m||innerWidth>640)return;const id=m.dataset.cancelBtn,b=id?$(id):null;if(b)b.click();
  }));
}

function setupUI(){
  els.themeToggleBtn.onclick=()=>applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
  els.prevWeekBtn.onclick=async()=>{state.currentDate.setDate(state.currentDate.getDate()-7);await loadStudentSchedule();renderWeek();};
  els.nextWeekBtn.onclick=async()=>{state.currentDate.setDate(state.currentDate.getDate()+7);await loadStudentSchedule();renderWeek();};
  els.todayBtn.onclick=async()=>{state.currentDate=new Date();await loadStudentSchedule();renderWeek();};
  els.lessonDetailCloseBtn.onclick=()=>els.lessonDetailModal.classList.add('hidden');
  els.rescheduleBannerCancelBtn.onclick=()=>{state.rescheduleFrom=null;els.rescheduleBanner.classList.add('hidden');renderWeek();};
  window.addEventListener('resize',renderWeek);
  setupModals();
}

document.addEventListener('DOMContentLoaded',async()=>{
  cache();applyTheme(localStorage.getItem(THEME_KEY)||'light');setupUI();
  const p=new URLSearchParams(window.location.search);state.token=p.get('token');
  if(!state.token){
    els.pageTitle.textContent='❗ Немає персонального посилання';
    els.pageSubtitle.textContent='Відкрийте посилання, яке надав викладач для цього учня.';
    els.scheduleContainer.innerHTML='<div class="loading">Не знайдено параметр token.</div>';return;
  }
  try{els.scheduleContainer.innerHTML='<div class="loading">Завантаження розкладу...</div>';await loadStudentSchedule();els.pageTitle.textContent='📅 Вітаємо, '+state.student.name+'!';els.pageSubtitle.textContent='Тут показано ваші уроки та доступні години для запису.';renderWeek();}
  catch(e){console.error(e);els.pageTitle.textContent='❗ Посилання недійсне';els.pageSubtitle.textContent=e.message||'Зверніться до викладача за новим персональним посиланням.';els.scheduleContainer.innerHTML='<div class="loading">Не вдалося завантажити персональний розклад.</div>';toast(e.message||'Не вдалося завантажити розклад.','error',6000);}
});