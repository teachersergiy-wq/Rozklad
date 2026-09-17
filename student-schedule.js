const SUPABASE_URL = "https://vjjrwvraannccejyqcci.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XYvCzMPGQjhT0AT2r2v3dw_zZIesIJB";

const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

const DAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTH_NAMES_SHORT = ['січ.', 'лют.', 'берез.', 'квіт.', 'трав.', 'черв.', 'лип.', 'серп.', 'верес.', 'жовт.', 'лист.', 'груд.'];

const MIN_HOUR = 9;
const DEFAULT_OPEN_HOUR = 18;
const MAX_HOUR = 21;
const THEME_STORAGE_KEY = 'schedule_theme_pref';

let publicState = {
  key: null,
  studentId: null,
  student: null,
  students: [],
  lessons: [],
  blockedSlots: [],
  availableSlots: [],
  bookingRequests: [],
  auditLog: [],
  backups: [],
  currentDate: new Date(),
  rescheduleFrom: null // { lessonId, date, time } — активний режим "оберіть новий час для перенесення"
};

const els = {
  container: document.getElementById('schedule-container'),
  weekDisplay: document.getElementById('current-week-display'),
  prevBtn: document.getElementById('prev-week-btn'),
  nextBtn: document.getElementById('next-week-btn'),
  todayBtn: document.getElementById('today-btn'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  pageTitle: document.getElementById('page-title'),
  pageSubtitle: document.getElementById('page-subtitle'),
  toastContainer: document.getElementById('toast-container'),
  confirmModal: document.getElementById('confirm-modal'),
  confirmModalMessage: document.getElementById('confirm-modal-message'),
  confirmModalCancelBtn: document.getElementById('confirm-modal-cancel-btn'),
  confirmModalOkBtn: document.getElementById('confirm-modal-ok-btn'),
  rescheduleBanner: document.getElementById('reschedule-banner'),
  rescheduleBannerText: document.getElementById('reschedule-banner-text'),
  rescheduleBannerCancelBtn: document.getElementById('reschedule-banner-cancel-btn'),
  lessonDetailModal: document.getElementById('lesson-detail-modal'),
  lessonDetailTitle: document.getElementById('lesson-detail-title'),
  lessonDetailBody: document.getElementById('lesson-detail-body'),
  lessonDetailCloseBtn: document.getElementById('lesson-detail-close-btn'),
  lessonDetailRescheduleBtn: document.getElementById('lesson-detail-reschedule-btn')
};

document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'light');
  els.themeToggleBtn.onclick = () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  };

  const urlParams = new URLSearchParams(window.location.search);
  publicState.key = urlParams.get('key') || 'default_schedule';
  publicState.studentId = urlParams.get('student') || null;

  await loadPublicSchedule();

  if (publicState.studentId) {
    publicState.student = publicState.students.find(s => String(s.id) === String(publicState.studentId)) || null;
    if (publicState.student) {
      els.pageTitle.textContent = `📅 Вітаємо, ${publicState.student.name}!`;
      els.pageSubtitle.textContent = 'У розкладі показано ваші заплановані та проведені уроки, а також вільні для запису години. Натисніть на свій урок, щоб побачити тему, домашнє завдання й статус оплати, або надішліть заявку на вільний час.';
    } else {
      els.pageSubtitle.textContent = 'Учня для цього посилання не знайдено. Зверніться до викладача за коректним посиланням.';
    }
  }

  setupPublicListeners();
  setupModalDismissBehaviors();
  renderPublicWeek();
});

// ===================== ЗАКРИТТЯ МОДАЛЬНИХ ВІКОН: ESC/ENTER (ПК), СВАЙП/КЛІК ПОВЗ (МОБІЛЬНІ) =====================

function isMobileMode() {
  return window.innerWidth <= 640;
}

function getOpenModal() {
  return document.querySelector('.modal:not(.hidden)');
}

// kind: 'confirm' (Enter) — основна дія вікна; 'cancel' (Esc, клік повз, свайп) — закриття
// БЕЗ надсилання заявки/збереження внесеного.
function triggerModalAction(modal, kind) {
  if (!modal) return;
  const btnId = kind === 'confirm' ? modal.dataset.confirmBtn : modal.dataset.cancelBtn;
  const btn = btnId ? document.getElementById(btnId) : null;
  if (btn) btn.click();
  else modal.classList.add('hidden');
}

function setupModalDismissBehaviors() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' && e.key !== 'Enter') return;
    const modal = getOpenModal();
    if (!modal) return;
    e.preventDefault();
    triggerModalAction(modal, e.key === 'Escape' ? 'cancel' : 'confirm');
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target !== modal) return;
      if (!isMobileMode()) return;
      triggerModalAction(modal, 'cancel');
    });

    const content = modal.querySelector('.modal-content');
    if (!content) return;

    let touchStartX = 0, touchStartY = 0, touchActive = false;
    content.addEventListener('touchstart', (e) => {
      if (!isMobileMode() || e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchActive = true;
    }, { passive: true });

    content.addEventListener('touchend', (e) => {
      if (!touchActive) return;
      touchActive = false;
      if (!isMobileMode()) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        triggerModalAction(modal, 'cancel');
      }
    }, { passive: true });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  els.themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function showToast(message, type = 'info', duration = 3200) {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  els.toastContainer.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 250);
  }, duration);
}

function showConfirm(message) {
  return new Promise(resolve => {
    els.confirmModalMessage.textContent = message;
    els.confirmModal.classList.remove('hidden');
    const cleanup = (result) => {
      els.confirmModal.classList.add('hidden');
      els.confirmModalOkBtn.onclick = null;
      els.confirmModalCancelBtn.onclick = null;
      resolve(result);
    };
    els.confirmModalOkBtn.onclick = () => cleanup(true);
    els.confirmModalCancelBtn.onclick = () => cleanup(false);
  });
}

async function loadPublicSchedule() {
  let loaded = false;

  if (db && publicState.key) {
    try {
      const { data, error } = await db.rpc('get_schedule', { p_access_token: publicState.key });
      if (!error && data && data.data) {
        applyLoadedData(data.data);
        loaded = true;
      }
    } catch (e) {
      console.warn('Supabase fallback to LocalStorage');
    }
  }

  if (!loaded) {
    const local = localStorage.getItem('schedule_' + publicState.key);
    if (local) {
      try {
        applyLoadedData(JSON.parse(local));
      } catch (e) { console.error(e); }
    }
  }
}

function applyLoadedData(data) {
  publicState.students = data.students || [];
  publicState.lessons = data.lessons || [];
  publicState.blockedSlots = data.blockedSlots || [];
  publicState.availableSlots = data.availableSlots || [];
  publicState.bookingRequests = data.bookingRequests || [];
  publicState.auditLog = data.auditLog || [];
  publicState.backups = data.backups || [];
}

// Учнівська сторінка має лише обмежений запис: додає заявку до bookingRequests,
// не чіпаючи lessons/students/blockedSlots. Перед записом підвантажує свіжі дані,
// щоб зменшити ризик перезапису паралельних змін викладача.
async function submitBookingRequest(dateISO, hour) {
  await loadPublicSchedule();

  const hourStatus = getSlotStatus(dateISO, hour);
  if (hourStatus.status !== 'available') {
    showToast('На жаль, цей час вже зайнято. Оберіть інший.', 'error');
    renderPublicWeek();
    return;
  }

  const timeStr = hourToTimeStr(hour);
  const alreadyRequested = publicState.bookingRequests.some(r =>
    r.status === 'pending' && String(r.studentId) === String(publicState.studentId) && r.date === dateISO && r.time === timeStr
  );
  if (alreadyRequested) {
    showToast('Ви вже надсилали заявку на цей час. Очікуйте підтвердження.', 'info');
    return;
  }

  publicState.bookingRequests.push({
    id: `${Date.now()}_stureq`,
    studentId: publicState.studentId,
    date: dateISO,
    time: timeStr,
    status: 'pending',
    createdAt: Date.now()
  });
  publicState.auditLog.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    actor: 'Учень',
    action: `${publicState.student ? publicState.student.name : 'Учень'} надіслав(ла) заявку на запис: ${dateISO} ${timeStr}`
  });

  await savePublicSchedule();
  showToast('Заявку надіслано! Очікуйте підтвердження від викладача.', 'success');
  renderPublicWeek();
}

async function savePublicSchedule() {
  const payload = {
    students: publicState.students,
    lessons: publicState.lessons,
    blockedSlots: publicState.blockedSlots,
    availableSlots: publicState.availableSlots,
    bookingRequests: publicState.bookingRequests,
    auditLog: publicState.auditLog,
    backups: publicState.backups
  };
  localStorage.setItem('schedule_' + publicState.key, JSON.stringify(payload));

  if (db && publicState.key) {
    try {
      await db.rpc('save_schedule', { p_access_token: publicState.key, p_data: payload });
    } catch (e) {
      console.warn('Saved to LocalStorage only.');
    }
  }
}

function setupPublicListeners() {
  els.prevBtn.onclick = () => {
    publicState.currentDate.setDate(publicState.currentDate.getDate() - 7);
    renderPublicWeek();
  };
  els.nextBtn.onclick = () => {
    publicState.currentDate.setDate(publicState.currentDate.getDate() + 7);
    renderPublicWeek();
  };
  els.todayBtn.onclick = () => {
    publicState.currentDate = new Date();
    renderPublicWeek();
  };
  window.addEventListener('resize', renderPublicWeek);
  // Свайп-навігація вимкнена навмисно: переходи між тижнями відбуваються лише через кнопки "<"/">"

  els.rescheduleBannerCancelBtn.onclick = () => cancelRescheduleMode();
  els.lessonDetailCloseBtn.onclick = () => hideLessonDetailModal();
}

function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateISO) {
  const [y, m, d] = String(dateISO).split('-').map(Number);
  if (!y) return dateISO || '';
  return new Date(y, m - 1, d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

function hourToTimeStr(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

function isPastSlot(dateISO, hour) {
  const [y, m, d] = String(dateISO).split('-').map(Number);
  if (!y) return false;
  return new Date(y, m - 1, d, hour, 0, 0, 0).getTime() < Date.now();
}

function getSlotStatus(dateISO, hour) {
  const timeStr = hourToTimeStr(hour);
  const hasLesson = publicState.lessons.some(l => {
    if (l.date !== dateISO) return false;
    const lHour = parseInt((l.time || '00:00').split(':')[0], 10);
    return lHour === hour;
  });
  if (hasLesson) return { status: 'lesson' };
  if (isPastSlot(dateISO, hour)) return { status: 'unavailable' };

  if (hour < DEFAULT_OPEN_HOUR) {
    const opened = publicState.availableSlots.some(s => s.date === dateISO && s.time === timeStr);
    return { status: opened ? 'available' : 'unavailable' };
  } else {
    const closed = publicState.blockedSlots.some(s => s.date === dateISO && s.time === timeStr);
    return { status: closed ? 'unavailable' : 'available' };
  }
}

function getMyPendingRequest(dateISO, hour) {
  if (!publicState.studentId) return null;
  const timeStr = hourToTimeStr(hour);
  return publicState.bookingRequests.find(r =>
    r.status === 'pending' && String(r.studentId) === String(publicState.studentId) && r.date === dateISO && r.time === timeStr
  ) || null;
}

// Урок (будь-якого учня), що займає конкретну годину — використовується, щоб не показувати
// вільним цей час, навіть якщо урок належить іншому учневі.
function getLessonAtHour(dateISO, hour) {
  return publicState.lessons.find(l => {
    if (l.date !== dateISO) return false;
    const lHour = parseInt((l.time || '00:00').split(':')[0], 10);
    return lHour === hour;
  }) || null;
}

function isOwnLesson(lesson) {
  return !!lesson && publicState.studentId && String(lesson.studentId) === String(publicState.studentId);
}

// Активна заявка на перенесення саме цього уроку (щойно надіслана, очікує підтвердження).
function getPendingRescheduleForLesson(lessonId) {
  return publicState.bookingRequests.find(r =>
    r.status === 'pending' && r.type === 'reschedule' && String(r.lessonId) === String(lessonId)
  ) || null;
}

function isLessonInPast(lesson) {
  const hour = parseInt((lesson.time || '00:00').split(':')[0], 10);
  return isPastSlot(lesson.date, hour);
}

// ===================== ДЕТАЛІ УРОКУ ТА ЗАПИТ НА ПЕРЕНЕСЕННЯ =====================

function showLessonDetailModal(lesson) {
  const isCompleted = lesson.status === 'completed';
  const isPaid = lesson.paid === true || lesson.paid === 'true';
  const pendingReschedule = getPendingRescheduleForLesson(lesson.id);

  els.lessonDetailTitle.textContent = `${formatDateDisplay(lesson.date)}, ${lesson.time || ''}`;

  let html = '';
  html += `<div class="lesson-detail-row"><b>Статус:</b> ${isCompleted ? 'Проведено' : 'Заплановано'}</div>`;
  html += `<div class="lesson-detail-row"><b>Тема уроку:</b> ${lesson.topic ? escapeHtml(lesson.topic) : '—'}</div>`;
  html += `<div class="lesson-detail-row"><b>Домашнє завдання:</b> ${lesson.homework ? escapeHtml(lesson.homework) : '—'}</div>`;
  els.lessonDetailBody.innerHTML = html;

  const note = document.createElement('div');
  note.className = `payment-note ${isPaid ? 'paid' : 'unpaid'}`;
  const isMathema = lesson.paidMethod === 'Mathema';
  note.textContent = isPaid
    ? `Оплачено${(lesson.paidAmount != null && !isMathema) ? ' · ' + lesson.paidAmount + ' грн' : ''}${lesson.paidMethod ? ' · ' + lesson.paidMethod : ''}`
    : '⚠️ Урок ще не оплачено. Будь ласка, зв\'яжіться з викладачем щодо оплати.';
  els.lessonDetailBody.appendChild(note);

  if (pendingReschedule) {
    const rNote = document.createElement('div');
    rNote.className = 'lesson-detail-row';
    rNote.style.marginTop = '10px';
    rNote.innerHTML = `<b>⏳ Запит на перенесення</b> вже надіслано (на ${formatDateDisplay(pendingReschedule.date)}, ${pendingReschedule.time}) — очікує підтвердження викладача.`;
    els.lessonDetailBody.appendChild(rNote);
  }

  const canReschedule = !isCompleted && !isLessonInPast(lesson) && !pendingReschedule;
  els.lessonDetailRescheduleBtn.style.display = canReschedule ? 'block' : 'none';
  els.lessonDetailRescheduleBtn.onclick = () => {
    hideLessonDetailModal();
    startRescheduleMode(lesson);
  };

  els.lessonDetailModal.classList.remove('hidden');
}

function hideLessonDetailModal() {
  els.lessonDetailModal.classList.add('hidden');
}

function startRescheduleMode(lesson) {
  publicState.rescheduleFrom = { lessonId: lesson.id, date: lesson.date, time: lesson.time };
  els.rescheduleBannerText.textContent = `Оберіть новий вільний час для перенесення уроку з ${formatDateDisplay(lesson.date)}, ${lesson.time}`;
  els.rescheduleBanner.classList.remove('hidden');
  showToast('Тепер оберіть вільний час у розкладі, щоб запропонувати нову дату уроку.', 'info');
  renderPublicWeek();
}

function cancelRescheduleMode() {
  publicState.rescheduleFrom = null;
  els.rescheduleBanner.classList.add('hidden');
  renderPublicWeek();
}

// Заявка на перенесення уроку — на відміну від звичайної заявки на запис, посилається на
// існуючий урок (lessonId) і зберігає й стару, і нову дату/час. Викладач бачить обидві
// в своєму списку заявок і, підтверджуючи, переносить сам урок (а не створює новий).
async function submitRescheduleRequest(newDateISO, newHour) {
  if (!publicState.rescheduleFrom) return;
  await loadPublicSchedule();

  const { lessonId, date: oldDate, time: oldTime } = publicState.rescheduleFrom;

  const hourStatus = getSlotStatus(newDateISO, newHour);
  if (hourStatus.status !== 'available') {
    showToast('На жаль, цей час вже зайнято. Оберіть інший.', 'error');
    renderPublicWeek();
    return;
  }

  const newTimeStr = hourToTimeStr(newHour);
  if (newDateISO === oldDate && newTimeStr === oldTime) {
    showToast('Це той самий час, що й зараз. Оберіть інший.', 'error');
    return;
  }

  publicState.bookingRequests.push({
    id: `${Date.now()}_reschedreq`,
    type: 'reschedule',
    lessonId,
    studentId: publicState.studentId,
    oldDate,
    oldTime,
    date: newDateISO,
    time: newTimeStr,
    status: 'pending',
    createdAt: Date.now()
  });

  publicState.auditLog.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    actor: 'Учень',
    action: `${publicState.student ? publicState.student.name : 'Учень'} запросив(ла) перенесення уроку з ${oldDate} ${oldTime} на ${newDateISO} ${newTimeStr}`
  });

  publicState.rescheduleFrom = null;
  els.rescheduleBanner.classList.add('hidden');

  await savePublicSchedule();
  showToast('Запит на перенесення надіслано! Очікуйте підтвердження від викладача.', 'success');
  renderPublicWeek();
}

function getRelevantHours() {
  const hours = [];
  for (let h = MIN_HOUR; h <= MAX_HOUR; h++) hours.push(h);
  return hours;
}

// Будує список записів для дня: діапазон до 18:00 об'єднується в один запис,
// після 18:00 — кожна година окремо. "Очікує підтвердження" — окремий тип запису.
function buildPublicDayEntries(dateISO) {
  const hours = getRelevantHours();
  const entries = [];
  let run = [];

  function flushRun() {
    if (run.length === 0) return;
    entries.push({ type: 'free', start: run[0], end: run[run.length - 1] + 1 });
    run = [];
  }

  hours.forEach(h => {
    const lessonHere = getLessonAtHour(dateISO, h);
    if (lessonHere) {
      flushRun();
      if (isOwnLesson(lessonHere)) {
        entries.push({ type: 'lesson', start: h, end: h + 1, lesson: lessonHere });
      }
      // Урок іншого учня: година просто прихована (зайнята), без деталей — приватність.
      return;
    }

    const pendingReq = getMyPendingRequest(dateISO, h);
    if (pendingReq) {
      flushRun();
      entries.push({ type: 'pending', start: h, end: h + 1 });
      return;
    }

    const info = getSlotStatus(dateISO, h);
    if (info.status === 'available') {
      if (h < DEFAULT_OPEN_HOUR) {
        if (run.length && run[run.length - 1] !== h - 1) flushRun();
        run.push(h);
      } else {
        flushRun();
        entries.push({ type: 'free', start: h, end: h + 1 });
      }
    } else {
      flushRun();
    }
  });

  flushRun();
  return entries;
}

function createDayHeaderElement(date) {
  const dayIdx = (date.getDay() + 6) % 7;
  const header = document.createElement('div');
  header.className = `day-header ${isToday(date) ? 'today' : ''}`;

  const nameSpan = document.createElement('span');
  nameSpan.className = 'day-header-name';
  nameSpan.textContent = DAY_NAMES_SHORT[dayIdx];

  const dateSpan = document.createElement('span');
  dateSpan.className = 'day-header-date';
  dateSpan.textContent = `${date.getDate()} ${MONTH_NAMES_SHORT[date.getMonth()]}`;

  header.appendChild(nameSpan);
  header.appendChild(dateSpan);
  return header;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function renderPublicWeek() {
  const startOfWeek = getStartOfWeek(publicState.currentDate);
  const end = new Date(startOfWeek);
  end.setDate(startOfWeek.getDate() + 6);
  els.weekDisplay.textContent = `${startOfWeek.getDate()} ${startOfWeek.toLocaleDateString('uk-UA', { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString('uk-UA', { month: 'short' })}`;

  const daysDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    daysDates.push(d);
  }

  els.container.innerHTML = '';
  const wrap = document.createElement('div');
  // Дні тижня розміщуються парами по ширині: Пн+Вт, Ср+Чт, Пт+Сб, Нд окремо.
  wrap.className = 'week-columns week-pairs';

  daysDates.forEach(date => {
    const dateISO = formatDateISO(date);
    const column = document.createElement('div');
    column.className = 'day-column';
    column.appendChild(createDayHeaderElement(date));

    const entries = buildPublicDayEntries(dateISO);
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'no-slots';
      empty.textContent = 'Немає вільних годин';
      column.appendChild(empty);
    } else {
      entries.forEach(e => {
        if (e.type === 'pending') {
          const el = document.createElement('div');
          el.className = 'slot-pending';
          el.textContent = `${hourToTimeStr(e.start)}–${hourToTimeStr(e.end)} Очікує підтвердження`;
          column.appendChild(el);
          return;
        }

        if (e.type === 'lesson') {
          const lesson = e.lesson;
          const isCompleted = lesson.status === 'completed';
          const isPaid = lesson.paid === true || lesson.paid === 'true';
          const pendingReschedule = getPendingRescheduleForLesson(lesson.id);

          const el = document.createElement('div');
          el.className = `slot-lesson ${pendingReschedule ? 'pending-reschedule' : (isCompleted ? 'completed' : 'planned')}`;
          el.title = 'Натисніть, щоб переглянути деталі уроку';

          const timeEl = document.createElement('div');
          timeEl.className = 'slot-lesson-time';
          timeEl.textContent = hourToTimeStr(e.start);
          el.appendChild(timeEl);

          const studentForLesson = publicState.students.find(s => String(s.id) === String(lesson.studentId));
          if (studentForLesson && studentForLesson.name) {
            const studentEl = document.createElement('div');
            studentEl.className = 'slot-lesson-student';
            studentEl.textContent = studentForLesson.name;
            el.appendChild(studentEl);
          }

          if (lesson.topic) {
            const topicEl = document.createElement('div');
            topicEl.className = 'slot-lesson-topic';
            topicEl.textContent = lesson.topic;
            el.appendChild(topicEl);
          }

          const badgesEl = document.createElement('div');
          badgesEl.className = 'slot-lesson-badges';
          if (pendingReschedule) {
            const b = document.createElement('span');
            b.className = 'mini-badge status-planned';
            b.textContent = '⏳ Перенесення';
            badgesEl.appendChild(b);
          } else {
            const statusBadge = document.createElement('span');
            statusBadge.className = `mini-badge ${isCompleted ? 'status-completed' : 'status-planned'}`;
            statusBadge.textContent = isCompleted ? 'Проведено' : 'Заплановано';
            badgesEl.appendChild(statusBadge);
          }
          const paidBadge = document.createElement('span');
          paidBadge.className = `mini-badge ${isPaid ? 'paid-yes' : 'paid-no'}`;
          paidBadge.textContent = isPaid ? 'Оплачено' : 'Не опл.';
          badgesEl.appendChild(paidBadge);
          el.appendChild(badgesEl);

          el.onclick = () => showLessonDetailModal(lesson);
          column.appendChild(el);
          return;
        }

        const el = document.createElement('div');
        el.className = 'slot-free';
        el.textContent = `${hourToTimeStr(e.start)}–${hourToTimeStr(e.end)} Вільно`;

        if (publicState.studentId && publicState.student) {
          el.classList.add('bookable');

          if (publicState.rescheduleFrom) {
            el.classList.add('reschedule-target');
            el.title = 'Натисніть, щоб запропонувати цей час для перенесення уроку';
            el.onclick = async () => {
              const label = e.end - e.start > 1
                ? `${hourToTimeStr(e.start)}–${hourToTimeStr(e.end)}`
                : hourToTimeStr(e.start);
              const confirmed = await showConfirm(`Запросити перенесення уроку з ${formatDateDisplay(publicState.rescheduleFrom.date)}, ${publicState.rescheduleFrom.time} на ${formatDateDisplay(dateISO)}, ${label}?`);
              if (confirmed) await submitRescheduleRequest(dateISO, e.start);
            };
          } else {
            el.title = 'Натисніть, щоб надіслати заявку на запис';
            el.onclick = async () => {
              const label = e.end - e.start > 1
                ? `${hourToTimeStr(e.start)}–${hourToTimeStr(e.end)}`
                : hourToTimeStr(e.start);
              const confirmed = await showConfirm(`Надіслати заявку на запис: ${formatDateDisplay(dateISO)}, ${label} (початок о ${hourToTimeStr(e.start)})?`);
              if (confirmed) await submitBookingRequest(dateISO, e.start);
            };
          }
        }

        column.appendChild(el);
      });
    }

    wrap.appendChild(column);
  });

  els.container.appendChild(wrap);
}
