const SUPABASE_URL = "https://vjjrwvraannccejyqcci.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XYvCzMPGQjhT0AT2r2v3dw_zZIesIJB";
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

const DAY_NAMES = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
const MONTH_NAMES = ['січ.','лют.','берез.','квіт.','трав.','черв.','лип.','серп.','верес.','жовт.','лист.','груд.'];
const THEME_KEY = 'schedule_theme_pref';
const MAX_PENDING_REQUESTS = 2;

const state = {
  token: null,
  student: null,
  settings: { minHour:9, maxHour:21, defaultOpenHour:18 },
  ownLessons: [],
  completedHistory: [],
  completedHistoryLoaded: false,
  completedHistoryLoading: false,
  completedHistoryError: '',
  busySlots: [],
  openOverrides: [],
  closedOverrides: [],
  pendingRequests: [],
  currentDate: new Date(),
  rescheduleFrom: null,
  hourPicker: null,
  archived: false,
  navigationBusy: false,
  view: 'week'
};

const els = {};

function $(id){return document.getElementById(id);}
function cache(){
  els.scheduleContainer=$('schedule-container');
  els.currentWeekDisplay=$('current-week-display');
  els.prevWeekBtn=$('prev-week-btn');
  els.nextWeekBtn=$('next-week-btn');
  els.todayBtn=$('today-btn');
  els.themeToggleBtn=$('theme-toggle-btn');
  els.pageTitle=$('page-title');
  els.pageSubtitle=$('page-subtitle');
  els.archiveNotice=$('archive-notice');
  els.toastContainer=$('toast-container');
  els.confirmModal=$('confirm-modal');
  els.confirmModalMessage=$('confirm-modal-message');
  els.confirmModalCancelBtn=$('confirm-modal-cancel-btn');
  els.confirmModalOkBtn=$('confirm-modal-ok-btn');
  els.rescheduleBanner=$('reschedule-banner');
  els.rescheduleBannerText=$('reschedule-banner-text');
  els.pendingRequestsPanel=$('pending-requests-panel');
  els.pendingRequestsList=$('pending-requests-list');
  els.pendingRequestCounter=$('pending-request-counter');
  els.debtNotice=$('debt-notice');
  els.rescheduleBannerCancelBtn=$('reschedule-banner-cancel-btn');
  els.lessonDetailModal=$('lesson-detail-modal');
  els.lessonDetailTitle=$('lesson-detail-title');
  els.lessonDetailBody=$('lesson-detail-body');
  els.lessonDetailCloseBtn=$('lesson-detail-close-btn');
  els.lessonDetailRescheduleBtn=$('lesson-detail-reschedule-btn');
}

function toast(message,type,duration){
  const t=document.createElement('div');t.className='toast '+(type||'info');t.textContent=message;els.toastContainer.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),250);},duration||3200);
}
function confirmBox(message,confirmText='Надіслати заявку'){
  return new Promise(resolve=>{
    const oldText=els.confirmModalOkBtn.textContent;
    els.confirmModalMessage.textContent=message;
    els.confirmModalOkBtn.textContent=confirmText;
    els.confirmModal.classList.remove('hidden');
    const done=v=>{els.confirmModal.classList.add('hidden');els.confirmModalOkBtn.onclick=null;els.confirmModalCancelBtn.onclick=null;els.confirmModalOkBtn.textContent=oldText;resolve(v);};
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

  const range=getViewRange();
  const r=await db.rpc('v2_get_student_schedule',{
    p_token:state.token,p_from:iso(range.from),p_to:iso(range.to)
  });
  if(r.error)throw r.error;
  if(!r.data||!r.data.student)throw new Error('Невірне або застаріле персональне посилання.');

  state.student=r.data.student;
  state.archived=!!r.data.student.archived;
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

function getViewRange(){
  const y=state.currentDate.getFullYear(),m=state.currentDate.getMonth();
  if(state.view==='month'){
    return {from:new Date(y,m,1),to:new Date(y,m+1,0)};
  }
  if(state.view==='year'){
    return {from:new Date(y,0,1),to:new Date(y,11,31)};
  }
  const from=monday(state.currentDate),to=new Date(from);to.setDate(from.getDate()+6);
  return {from,to};
}
function periodLabel(){
  const r=getViewRange();
  if(state.view==='month')return r.from.toLocaleDateString('uk-UA',{month:'long',year:'numeric'});
  if(state.view==='year')return String(r.from.getFullYear());
  return r.from.getDate()+' '+MONTH_NAMES[r.from.getMonth()]+' - '+r.to.getDate()+' '+MONTH_NAMES[r.to.getMonth()];
}
function viewTitle(view){
  return view==='month'?'Місяць':view==='year'?'Рік':'Тиждень';
}
async function loadCompletedHistory(force=false){
  if(state.completedHistoryLoaded&&!force){
    renderCompletedHistory();
    return;
  }

  state.completedHistoryLoading=true;
  state.completedHistoryError='';
  // Show already-known completed lessons immediately, then refresh from the server.
  state.completedHistory=state.ownLessons.filter(x=>x.status==='completed').map(x=>({
    id:String(x.id),date:String(x.date),time:String(x.time||'00:00').slice(0,5),
    status:'completed',topic:x.topic||'',homework:x.homework||'',
    paid:!!x.paid,paidAmount:x.paidAmount==null?null:Number(x.paidAmount),paidMethod:x.paidMethod||null
  }));
  renderCompletedHistory();

  const to=new Date();
  to.setHours(23,59,59,999);
  const from=new Date(2000,0,1);
  try{
    const r=await db.rpc('v2_get_student_schedule',{
      p_token:state.token,p_from:iso(from),p_to:iso(to)
    });
    if(r.error)throw r.error;

    const payload=r.data&&typeof r.data==='object'&&!Array.isArray(r.data)
      ?r.data
      :Array.isArray(r.data)&&r.data[0]&&typeof r.data[0]==='object'
        ?r.data[0]
        :{};
    const rows=Array.isArray(payload.ownLessons)?payload.ownLessons:[];
    state.completedHistory=rows.filter(x=>x&&x.status==='completed').map(x=>({
      id:String(x.id),date:String(x.date),time:String(x.time||'00:00').slice(0,5),
      status:'completed',topic:x.topic||'',homework:x.homework||'',
      paid:!!x.paid,paidAmount:x.paidAmount==null?null:Number(x.paidAmount),paidMethod:x.paidMethod||null
    })).sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time));

    state.completedHistoryLoaded=true;
    state.completedHistoryError='';
  }catch(e){
    console.error('Completed history load failed:',e);
    state.completedHistoryError=e&&e.message?e.message:'Не вдалося оновити історію проведених уроків.';
  }finally{
    state.completedHistoryLoading=false;
    renderCompletedHistory();
  }
}
function renderDebtNotice(){
  const host=els.debtNotice;
  if(!host)return;
  const rows=Array.isArray(state.completedHistory)?state.completedHistory:[];
  const unpaid=rows.filter(x=>x&&x.status==='completed'&&!x.paid);
  if(unpaid.length){
    host.textContent='💳 Заборгованість: '+unpaid.length+' проведених уроків не оплачено.';
    host.classList.remove('hidden');
    host.setAttribute('aria-hidden','false');
  }else{
    host.classList.add('hidden');
    host.setAttribute('aria-hidden','true');
  }
}

function renderCompletedHistory(){
  const host=$('completed-lessons-list');
  const count=$('completed-lessons-count');
  if(!host)return;
  const rows=(state.completedHistory||[]).slice().sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time));
  if(count)count.textContent='Усього проведено: '+rows.length;
  renderDebtNotice();

  if(state.completedHistoryLoading&&rows.length===0){
    host.innerHTML='<div class="loading">Завантаження проведених уроків...</div>';
    return;
  }

  host.innerHTML='';
  if(state.completedHistoryError){
    const note=document.createElement('div');
    note.className='completed-history-error';
    note.textContent=rows.length
      ?'Не вдалося оновити історію з сервера. Показано вже завантажені проведені уроки.'
      :state.completedHistoryError;
    host.appendChild(note);
  }

  if(!rows.length){
    if(!state.completedHistoryError){
      const empty=document.createElement('div');
      empty.className='loading';
      empty.textContent=state.completedHistoryLoading?'Завантаження проведених уроків...':'Проведених уроків не знайдено.';
      host.appendChild(empty);
    }
    return;
  }

  rows.forEach((l,index)=>{
    const item=document.createElement('div');item.className='completed-lesson-item';
    const date=document.createElement('div');date.className='completed-lesson-date';date.textContent=(index+1)+'. '+prettyDate(l.date)+' · '+l.time;
    const topic=document.createElement('div');topic.className='completed-lesson-topic';topic.textContent=l.topic||'Тема не вказана';
    const meta=document.createElement('div');meta.className='completed-lesson-meta';
    const paid=l.paid?'Оплачено'+(l.paidAmount!=null?' · '+l.paidAmount+' грн':''):'Не оплачено';
    meta.textContent='Домашнє завдання: '+(l.homework||'—')+' · '+paid;
    item.append(date,topic,meta);
    host.appendChild(item);
  });
}
function renderCalendarMonth(){
  const host=els.scheduleContainer;host.className='calendar-month';host.innerHTML='';
  const y=state.currentDate.getFullYear(),m=state.currentDate.getMonth();
  const first=new Date(y,m,1),start=(first.getDay()+6)%7,total=new Date(y,m+1,0).getDate();
  DAY_NAMES.forEach(d=>{const h=document.createElement('div');h.className='calendar-weekday';h.textContent=d;host.appendChild(h);});
  for(let i=0;i<start;i++){const e=document.createElement('div');e.className='calendar-month-cell empty';host.appendChild(e);}
  for(let day=1;day<=total;day++){
    const date=iso(new Date(y,m,day)),cell=document.createElement('div');cell.className='calendar-month-cell';
    const num=document.createElement('div');num.className='calendar-month-day-num';num.textContent=day;cell.appendChild(num);
    state.ownLessons.filter(l=>l.date===date).sort((a,b)=>(a.time||'').localeCompare(b.time||'')).forEach(l=>{
      const b=document.createElement('button');b.type='button';b.className='calendar-month-lesson';b.innerHTML='<span>'+esc(l.time)+' '+esc(l.topic||'')+'</span><small>'+esc(l.status==='completed'?'Проведено':'Заплановано')+'</small>';b.onclick=()=>showLesson(l);cell.appendChild(b);
    });
    host.appendChild(cell);
  }
  while(host.children.length%7!==0){const e=document.createElement('div');e.className='calendar-month-cell empty';host.appendChild(e);}
}
function renderCalendarYear(){
  const host=els.scheduleContainer;host.className='calendar-year';host.innerHTML='';
  const y=state.currentDate.getFullYear();
  for(let m=0;m<12;m++){
    const card=document.createElement('section');card.className='calendar-year-month';
    const title=document.createElement('button');title.type='button';title.className='calendar-year-title';title.textContent=new Date(y,m,1).toLocaleDateString('uk-UA',{month:'long'});title.onclick=async()=>{state.view='month';state.currentDate=new Date(y,m,1);await loadStudentSchedule();render();};
    card.appendChild(title);
    const weekdays=document.createElement('div');weekdays.className='calendar-year-weekdays';DAY_NAMES.forEach(d=>{const x=document.createElement('div');x.textContent=d;weekdays.appendChild(x);});card.appendChild(weekdays);
    const grid=document.createElement('div');grid.className='calendar-year-days';
    const first=new Date(y,m,1),start=(first.getDay()+6)%7,total=new Date(y,m+1,0).getDate();
    for(let i=0;i<start;i++){const e=document.createElement('div');e.className='calendar-year-day empty';grid.appendChild(e);}
    for(let day=1;day<=total;day++){
      const date=iso(new Date(y,m,day)),lessons=state.ownLessons.filter(l=>l.date===date),completed=lessons.filter(l=>l.status==='completed').length,planned=lessons.filter(l=>l.status==='planned').length;
      const cell=document.createElement('button');cell.type='button';cell.className='calendar-year-day';cell.onclick=async()=>{state.view='month';state.currentDate=new Date(y,m,day);await loadStudentSchedule();render();};
      const n=document.createElement('span');n.className='calendar-year-day-num';n.textContent=day;cell.appendChild(n);
      const counts=document.createElement('span');counts.className='calendar-year-counts';
      if(completed){const q=document.createElement('span');q.className='completed';q.textContent=completed;counts.appendChild(q);}
      if(planned){const q=document.createElement('span');q.className='planned';q.textContent=planned;counts.appendChild(q);}
      cell.appendChild(counts);grid.appendChild(cell);
    }
    while(grid.children.length%7!==0){const e=document.createElement('div');e.className='calendar-year-day empty';grid.appendChild(e);}
    card.appendChild(grid);host.appendChild(card);
  }
}
function updateViewButtons(){
  const buttons=[
    ['view-week-btn','week'],
    ['view-month-btn','month'],
    ['view-year-btn','year']
  ];
  buttons.forEach(([id,view])=>{
    const btn=$(id);
    if(!btn)return;
    const active=state.view===view;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-selected',active?'true':'false');
  });
}
function render(){
  const title=els.currentWeekDisplay;
  if(title)title.textContent=periodLabel();
  updateViewButtons();
  if(els.scheduleContainer){
    els.scheduleContainer.dataset.view=state.view;
    els.scheduleContainer.className=state.view==='month'?'calendar-month':state.view==='year'?'calendar-year':'schedule-week';
  }
  if(state.view==='month')renderCalendarMonth();
  else if(state.view==='year')renderCalendarYear();
  else renderWeek();
  renderPendingCounter();
}
function busy(date,h){return state.busySlots.some(x=>x.date===date&&x.time===time(h));}
function ownLesson(date,h){return state.ownLessons.find(x=>x.date===date&&parseInt(x.time.split(':')[0],10)===h)||null;}
function pendingBooking(date,h){return state.pendingRequests.find(x=>x.type==='booking'&&x.date===date&&x.time===time(h))||null;}
function pendingReschedule(lessonId){return state.pendingRequests.find(x=>x.type==='reschedule'&&String(x.lessonId)===String(lessonId))||null;}

function pendingTarget(date,h){
  const t=time(h);
  return state.pendingRequests.some(x=>x.date===date&&x.time===t);
}

function isOpen(date,h){
  if(pastSlot(date,h))return false;
  if(busy(date,h))return false;
  if(pendingTarget(date,h))return false;
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
    if(state.archived){flush();continue;}
    const pr=pendingBooking(date,h);
    if(pr){flush();out.push({type:'pending',hour:h});continue;}
    if(isOpen(date,h)){run.push(h);continue;}
    flush();
  }
  flush();return out;
}

function dayHeader(date){
  const h=document.createElement('div');h.className='day-header '+(date.toDateString()===new Date().toDateString()?'today':'');
  const n=document.createElement('span');n.className='day-header-name';n.textContent=DAY_NAMES[(date.getDay()+6)%7];
  const d=document.createElement('span');d.className='day-header-date';d.textContent=date.getDate()+' '+MONTH_NAMES[date.getMonth()];h.append(n,d);return h;
}

function pickerMode(){return state.rescheduleFrom&&!state.archived?'reschedule':'booking';}
function pickerMatches(date,x){
  const p=state.hourPicker;
  return !!p&&p.date===date&&p.start===x.start&&p.end===x.end&&p.mode===pickerMode();
}
function rangeLabel(x){
  const first=time(x.start),last=time(Math.max(x.start,x.end-1));
  return first===last?first:first+'–'+last;
}
function openHourPicker(date,x){
  if(state.archived)return;
  const mode=pickerMode();
  if(pickerMatches(date,x)){state.hourPicker=null;renderWeek();return;}
  state.hourPicker={date,start:x.start,end:x.end,mode,selected:null};
  renderWeek();
}
function renderHourPicker(host,date,x){
  const p=document.createElement('div');p.className='hour-picker';p.setAttribute('role','group');
  p.onclick=e=>e.stopPropagation();
  const title=document.createElement('div');title.className='hour-picker-title';title.textContent='Оберіть годину:';p.appendChild(title);
  const list=document.createElement('div');list.className='hour-choice-list';
  const picker=state.hourPicker;
  let availableCount=0;
  for(let h=x.start;h<x.end;h++){
    if(!isOpen(date,h))continue;
    availableCount++;
    const b=document.createElement('button');b.type='button';b.className='hour-choice'+(picker&&picker.selected===h?' selected':'');b.textContent=time(h);
    b.setAttribute('aria-pressed',picker&&picker.selected===h?'true':'false');
    b.onclick=e=>{e.stopPropagation();if(state.hourPicker){state.hourPicker.selected=h;renderWeek();}};
    list.appendChild(b);
  }
  if(!availableCount){
    const none=document.createElement('div');none.className='hour-picker-empty';none.textContent='На цей момент вільних годин немає.';p.appendChild(none);host.appendChild(p);return;
  }
  p.appendChild(list);
  const chosen=document.createElement('div');chosen.className='hour-picker-selected';chosen.textContent=picker&&picker.selected!=null?'Обрано: '+time(picker.selected):'Годину ще не обрано.';p.appendChild(chosen);
  const maxed=state.pendingRequests.length>=MAX_PENDING_REQUESTS;
  if(maxed){
    const limit=document.createElement('div');limit.className='hour-picker-limit';limit.textContent='Досягнуто ліміту: дочекайтеся рішення вчителя щодо поданих запитів.';p.appendChild(limit);
  }
  const send=document.createElement('button');send.type='button';send.className='primary hour-picker-submit';send.disabled=maxed||!(picker&&picker.selected!=null);
  send.textContent=picker&&picker.mode==='reschedule'?'Запросити перенесення':'Надіслати заявку';
  send.onclick=e=>{e.stopPropagation();if(!state.hourPicker||state.hourPicker.selected==null)return;const h=state.hourPicker.selected;state.hourPicker=null;picker.mode==='reschedule'?requestReschedule(date,h):requestBooking(date,h);};
  p.appendChild(send);
  const cancel=document.createElement('button');cancel.type='button';cancel.className='hour-picker-cancel';cancel.textContent='Скасувати вибір';cancel.onclick=e=>{e.stopPropagation();state.hourPicker=null;renderWeek();};p.appendChild(cancel);
  host.appendChild(p);
}
function renderPendingRequests(){
  if(!els.pendingRequestsPanel||!els.pendingRequestsList)return;
  const visible=!state.archived&&state.pendingRequests.length>0;
  els.pendingRequestsPanel.classList.toggle('hidden',!visible);
  if(!visible){els.pendingRequestsList.innerHTML='';return;}
  els.pendingRequestsList.innerHTML='';
  state.pendingRequests.forEach(r=>{
    const item=document.createElement('div');item.className='pending-request-item';
    const info=document.createElement('div');info.className='pending-request-info';
    const title=document.createElement('div');title.className='pending-request-title';
    title.textContent=r.type==='reschedule'
      ? 'Перенесення: '+prettyDate(r.oldDate||'')+', '+(r.oldTime||'')+' → '+prettyDate(r.date)+', '+r.time
      : 'Запис: '+prettyDate(r.date)+', '+r.time;
    const meta=document.createElement('div');meta.className='pending-request-meta';meta.textContent='Очікує рішення викладача';
    info.append(title,meta);
    const cancel=document.createElement('button');cancel.type='button';cancel.className='pending-request-cancel';cancel.textContent='Відкликати';cancel.title='Відкликати цей запит';cancel.onclick=()=>cancelStudentRequest(r);
    item.append(info,cancel);
    els.pendingRequestsList.appendChild(item);
  });
}

async function cancelStudentRequest(req){
  if(state.archived)return;
  const label=req.type==='reschedule'
    ? 'перенесення з '+prettyDate(req.oldDate||'')+', '+(req.oldTime||'')+' на '+prettyDate(req.date)+', '+req.time
    : 'запис на '+prettyDate(req.date)+', '+req.time;
  if(!await confirmBox('Відкликати запит: '+label+'?','Відкликати'))return;
  try{
    const r=await db.rpc('v2_cancel_booking_request',{p_token:state.token,p_request_id:req.id});
    if(r.error)throw r.error;
    await loadStudentSchedule();renderWeek();
    toast('Запит відкликано.','success');
  }catch(e){
    console.error(e);
    const msg=String(e?.message||'');
    if(msg.includes('REQUEST_NOT_PENDING')){
      try{await loadStudentSchedule();renderWeek();}catch(_){}
      toast('Цей запит уже не очікує рішення.','error',5000);
      return;
    }
    if(msg.includes('REQUEST_NOT_FOUND_OR_NOT_OWNED')){
      try{await loadStudentSchedule();renderWeek();}catch(_){}
      toast('Запит не знайдено або він уже недоступний.','error',5000);
      return;
    }
    toast(msg||'Не вдалося відкликати запит.','error',5000);
  }
}

function renderPendingCounter(){
  if(!els.pendingRequestCounter)return;
  const n=state.pendingRequests.length;
  const hidden=!!state.archived;
  els.pendingRequestCounter.classList.toggle('hidden',hidden);
  els.pendingRequestCounter.classList.toggle('limit',!hidden&&n>=MAX_PENDING_REQUESTS);
  els.pendingRequestCounter.textContent=hidden?'':'Запитів на розгляді: '+n+' із '+MAX_PENDING_REQUESTS;
  els.pendingRequestCounter.setAttribute('aria-hidden',hidden?'true':'false');
}
function renderWeek(){
  const start=monday(state.currentDate),end=new Date(start);end.setDate(start.getDate()+6);
  els.currentWeekDisplay.textContent=start.getDate()+' '+MONTH_NAMES[start.getMonth()]+' - '+end.getDate()+' '+MONTH_NAMES[end.getMonth()];
  renderPendingRequests();
  renderPendingCounter();
  els.scheduleContainer.innerHTML='';
  if(els.archiveNotice){
    els.archiveNotice.classList.toggle('hidden',!state.archived);
    els.archiveNotice.setAttribute('aria-hidden',state.archived?'false':'true');
  }
  if(els.rescheduleBanner && state.archived){
    state.rescheduleFrom=null;
    state.hourPicker=null;
    els.rescheduleBanner.classList.add('hidden');
  }
  const wrap=document.createElement('div');wrap.className='week-columns week-pairs';

  for(let i=0;i<7;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);const date=iso(d),col=document.createElement('div');col.className='day-column';col.appendChild(dayHeader(d));
    const entries=dayEntries(date);
    if(!entries.length){
      const e=document.createElement('div');e.className='no-slots';e.textContent=state.archived?'Історія цього дня відсутня або прихована після дати архівації':'Немає вільних годин';col.appendChild(e);
    }
    entries.forEach(x=>{
      if(x.type==='lesson'){renderOwnLesson(col,x.lesson);return;}
      if(x.type==='pending'){const p=document.createElement('div');p.className='slot-pending';p.textContent=time(x.hour)+' Очікує підтвердження';col.appendChild(p);return;}
      const f=document.createElement('div');f.className='slot-free'+(state.student&&!state.archived?' bookable':'');
      const label=document.createElement('div');label.className='slot-free-label';label.textContent=rangeLabel(x)+' Вільно';f.appendChild(label);
      if(!state.archived){
        f.title='Показати вільні години для вибору';
        f.onclick=()=>openHourPicker(date,x);
        if(pickerMatches(date,x))renderHourPicker(f,date,x);
      }
      col.appendChild(f);
    });
    wrap.appendChild(col);
  }
  els.scheduleContainer.appendChild(wrap);
}

function renderOwnLesson(col,l){
  const pending=state.archived?null:pendingReschedule(l.id),isCompleted=l.status==='completed',isPaid=l.paid;
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
  const pending=state.archived?null:pendingReschedule(l.id);
  els.lessonDetailTitle.textContent=prettyDate(l.date)+', '+l.time;
  els.lessonDetailBody.innerHTML='<div class="lesson-detail-row"><b>Статус:</b> '+(l.status==='completed'?'Проведено':'Заплановано')+'</div><div class="lesson-detail-row"><b>Тема уроку:</b> '+(l.topic?esc(l.topic):'—')+'</div><div class="lesson-detail-row"><b>Домашнє завдання:</b> '+(l.homework?esc(l.homework):'—')+'</div>';
  const p=document.createElement('div');p.className='payment-note '+(l.paid?'paid':'unpaid');p.textContent=l.paid?'Оплачено'+(l.paidAmount!=null?' · '+l.paidAmount+' грн':'')+(l.paidMethod?' · '+l.paidMethod:''):'⚠️ Урок ще не оплачено. Будь ласка, зв\'яжіться з викладачем щодо оплати.';els.lessonDetailBody.appendChild(p);
  if(pending){const q=document.createElement('div');q.className='lesson-detail-row';q.style.marginTop='10px';q.innerHTML='<b>⏳ Запит на перенесення</b> вже надіслано на '+prettyDate(pending.date)+', '+pending.time+' — очікує підтвердження.';els.lessonDetailBody.appendChild(q);}
  const can=!state.archived&&l.status==='planned'&&!pending&&!pastSlot(l.date,parseInt(l.time.split(':')[0],10));
  els.lessonDetailRescheduleBtn.style.display=can?'block':'none';
  els.lessonDetailRescheduleBtn.onclick=()=>{els.lessonDetailModal.classList.add('hidden');state.rescheduleFrom={lessonId:l.id,date:l.date,time:l.time};els.rescheduleBannerText.textContent='Оберіть новий вільний час для перенесення уроку з '+prettyDate(l.date)+', '+l.time;els.rescheduleBanner.classList.remove('hidden');renderWeek();};
  els.lessonDetailModal.classList.remove('hidden');
}

async function requestBooking(date,h){
  if(state.archived){showArchivedAccessMessage();return;}
  const label=prettyDate(date)+', '+time(h);
  if(!await confirmBox('Надіслати заявку на запис: '+label+'?'))return;
  try{
    const r=await db.rpc('v2_create_booking_request',{p_token:state.token,p_date:date,p_time:time(h)});
    if(r.error)throw r.error;
    await loadStudentSchedule();renderWeek();toast('Заявку надіслано! Очікуйте підтвердження від викладача.','success');
  }catch(e){
    console.error(e);
    const msg=String(e?.message||'');
    if(msg.includes('STUDENT_ARCHIVED')){showArchivedAccessMessage();return;}
    if(msg.includes('MAX_PENDING_REQUESTS')){
      try{await loadStudentSchedule();renderWeek();}catch(_){}
      toast('Запитів на розгляді: '+MAX_PENDING_REQUESTS+' із '+MAX_PENDING_REQUESTS+'. Дочекайтеся рішення вчителя щодо поданих запитів.','error',6000);
      return;
    }
    toast(msg||'Не вдалося надіслати заявку.','error',5000);
  }
}

async function requestReschedule(date,h){
  if(state.archived){showArchivedAccessMessage();return;}
  if(!state.rescheduleFrom)return;
  const from=state.rescheduleFrom,newTime=time(h);
  if(date===from.date&&newTime===from.time){toast('Оберіть інший час.','error');return;}
  if(!await confirmBox('Запросити перенесення з '+prettyDate(from.date)+', '+from.time+' на '+prettyDate(date)+', '+newTime+'?'))return;
  try{
    const r=await db.rpc('v2_create_reschedule_request',{p_token:state.token,p_lesson_id:from.lessonId,p_new_date:date,p_new_time:newTime});
    if(r.error)throw r.error;
    state.rescheduleFrom=null;els.rescheduleBanner.classList.add('hidden');await loadStudentSchedule();renderWeek();toast('Запит на перенесення надіслано.','success');
  }catch(e){
    console.error(e);
    const msg=String(e?.message||'');
    if(msg.includes('STUDENT_ARCHIVED')){showArchivedAccessMessage();return;}
    if(msg.includes('MAX_PENDING_REQUESTS')){
      try{await loadStudentSchedule();renderWeek();}catch(_){}
      toast('Запитів на розгляді: '+MAX_PENDING_REQUESTS+' із '+MAX_PENDING_REQUESTS+'. Дочекайтеся рішення вчителя щодо поданих запитів.','error',6000);
      return;
    }
    toast(msg||'Не вдалося надіслати запит.','error',5000);
  }
}

function showArchivedAccessMessage(){
  const msg='Ваш доступ до запису й перенесення уроків призупинено. Зверніться до вчителя для відновлення можливості надсилати запити.';
  if(els.archiveNotice){
    els.archiveNotice.classList.remove('hidden');
    els.archiveNotice.textContent=msg;
  }
  toast(msg,'error',6000);
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

async function navigatePeriod(delta){
  if(state.navigationBusy)return;
  state.navigationBusy=true;
  state.hourPicker=null;
  const buttons=[els.prevWeekBtn,els.nextWeekBtn,els.todayBtn].filter(Boolean);
  buttons.forEach(b=>b.disabled=true);
  try{
    if(state.view==='week'){
      const base=monday(state.currentDate);
      base.setDate(base.getDate()+delta*7);
      state.currentDate=base;
    }else if(state.view==='month'){
      state.currentDate=new Date(state.currentDate.getFullYear(),state.currentDate.getMonth()+delta,1);
    }else{
      state.currentDate=new Date(state.currentDate.getFullYear()+delta,0,1);
    }
    await loadStudentSchedule();
    render();
  }finally{
    state.navigationBusy=false;
    buttons.forEach(b=>b.disabled=false);
  }
}
async function goToCurrentPeriod(){
  if(state.navigationBusy)return;
  state.navigationBusy=true;
  state.hourPicker=null;
  const buttons=[els.prevWeekBtn,els.nextWeekBtn,els.todayBtn].filter(Boolean);
  buttons.forEach(b=>b.disabled=true);
  try{
    state.currentDate=new Date();
    await loadStudentSchedule();
    render();
  }finally{
    state.navigationBusy=false;
    buttons.forEach(b=>b.disabled=false);
  }
}
async function switchView(view){
  if(state.navigationBusy)return;
  state.navigationBusy=true;
  state.view=view;
  state.hourPicker=null;
  try{
    await loadStudentSchedule();
    render();
  }finally{
    state.navigationBusy=false;
  }
}

function setupUI(){
  els.themeToggleBtn.onclick=()=>applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
  els.prevWeekBtn.onclick=()=>navigatePeriod(-1);
  els.nextWeekBtn.onclick=()=>navigatePeriod(1);
  els.todayBtn.onclick=goToCurrentPeriod;
  $('view-week-btn').onclick=()=>switchView('week');
  $('view-month-btn').onclick=()=>switchView('month');
  $('view-year-btn').onclick=()=>switchView('year');
  $('completed-lessons-btn').onclick=async()=>{
    const modal=document.getElementById('completed-lessons-modal');
    modal.classList.remove('hidden');
    await loadCompletedHistory(true);
  };
  $('completed-lessons-close-btn').onclick=()=>document.getElementById('completed-lessons-modal').classList.add('hidden');
  els.lessonDetailCloseBtn.onclick=()=>els.lessonDetailModal.classList.add('hidden');
  els.rescheduleBannerCancelBtn.onclick=()=>{state.rescheduleFrom=null;els.rescheduleBanner.classList.add('hidden');renderWeek();};
  window.addEventListener('resize',()=>render());
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
  try{
    els.scheduleContainer.innerHTML='<div class="loading">Завантаження розкладу...</div>';
    await loadStudentSchedule();
    els.pageTitle.textContent='📅 '+(state.archived?'Історія розкладу · ':'Вітаємо, ')+state.student.name+'!';
    els.pageSubtitle.textContent=state.archived?'Перегляд історії уроків доступний до дати архівації. Запис і перенесення призупинені.':'Тут показано ваші уроки та доступні години для запису.';
    render();
    loadCompletedHistory(false).catch(e=>console.error('Initial completed history load failed:',e));
  }catch(e){
    console.error(e);
    els.pageTitle.textContent='❗ Посилання недійсне';
    els.pageSubtitle.textContent=e.message||'Зверніться до викладача за новим персональним посиланням.';
    els.scheduleContainer.innerHTML='<div class="loading">Не вдалося завантажити персональний розклад.</div>';
    toast(e.message||'Не вдалося завантажити розклад.','error',6000);
  }
});