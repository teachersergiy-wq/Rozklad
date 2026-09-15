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
  currentDate: new Date()
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
  myLessonsContainer: document.getElementById('my-lessons-container'),
  toastContainer: document.getElementById('toast-container'),
  confirmModal: document.getElementById('confirm-modal'),
  confirmModalMessage: document.getElementById('confirm-modal-message'),
  confirmModalCancelBtn: document.getElementById('confirm-modal-cancel-btn'),
  confirmModalOkBtn: document.getElementById('confirm-modal-ok-btn')
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
      els.pageSubtitle.textContent = 'Тут показано ваші заплановані уроки та вільні години. Оберіть зручний вільний час, щоб надіслати заявку на запис — вона потрапить у розклад лише після підтвердження викладачем.';
      renderMyLessons();
    } else {
      els.pageSubtitle.textContent = 'Учня для цього посилання не знайдено. Зверніться до викладача за коректним посиланням.';
    }
  }

  setupPublicListeners();
  renderPublicWeek();
});

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
  setupSwipeNavigation();
}

function setupSwipeNavigation() {
  let touchStartX = 0, touchStartY = 0, touchActive = false;
  els.container.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchActive = true;
  }, { passive: true });
  els.container.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) els.nextBtn.click();
      else els.prevBtn.click();
    }
  }, { passive: true });
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

function renderMyLessons() {
  if (!publicState.student) return;
  const idStr = String(publicState.studentId);
  const todayISO = formatDateISO(new Date());
  const upcoming = publicState.lessons
    .filter(l => String(l.studentId) === idStr && l.status === 'planned' && l.date >= todayISO)
    .sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));

  const box = document.createElement('div');
  box.className = 'my-lessons-box';
  const heading = document.createElement('h2');
  heading.textContent = '📚 Ваші заплановані уроки';
  box.appendChild(heading);

  if (upcoming.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-lessons';
    empty.textContent = 'У вас поки немає запланованих уроків.';
    box.appendChild(empty);
  } else {
    upcoming.forEach(l => {
      const row = document.createElement('div');
      row.className = 'my-lesson-row';
      row.innerHTML = `<strong>${formatDateDisplay(l.date)}, ${l.time || ''}</strong>${l.topic ? ' — ' + escapeHtml(l.topic) : ''}`;
      box.appendChild(row);
    });
  }

  els.myLessonsContainer.innerHTML = '';
  els.myLessonsContainer.appendChild(box);
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

  const isMobile = window.innerWidth <= 640;
  els.container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = `week-columns ${isMobile ? 'mobile-stack' : ''}`;

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

        const el = document.createElement('div');
        el.className = 'slot-free';
        el.textContent = `${hourToTimeStr(e.start)}–${hourToTimeStr(e.end)} Вільно`;

        if (publicState.studentId && publicState.student) {
          el.classList.add('bookable');
          el.title = 'Натисніть, щоб надіслати заявку на запис';
          el.onclick = async () => {
            const label = e.end - e.start > 1
              ? `${hourToTimeStr(e.start)}–${hourToTimeStr(e.end)}`
              : hourToTimeStr(e.start);
            const confirmed = await showConfirm(`Надіслати заявку на запис: ${formatDateDisplay(dateISO)}, ${label} (початок о ${hourToTimeStr(e.start)})?`);
            if (confirmed) await submitBookingRequest(dateISO, e.start);
          };
        }

        column.appendChild(el);
      });
    }

    wrap.appendChild(column);
  });

  els.container.appendChild(wrap);
}
