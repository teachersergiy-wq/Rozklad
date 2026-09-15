const SUPABASE_URL = "https://vjjrwvraannccejyqcci.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XYvCzMPGQjhT0AT2r2v3dw_zZIesIJB";

const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

// 7 вказаних ненасичених пастельних кольорів
const PASTEL_COLORS = [
  '#f5f5f4', '#fce7f3', '#ccfbf1', '#dbeafe', '#fef3c7', '#ffe4e6', '#e0f2fe'
];

const MONTH_NAMES_SHORT = ['січ.', 'лют.', 'берез.', 'квіт.', 'трав.', 'черв.', 'лип.', 'серп.', 'верес.', 'жовт.', 'лист.', 'груд.'];
const DAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const DEFAULT_PAID_AMOUNT = 175;
const PAID_METHODS = ['МоноБанк', 'Готівка', 'ПриватБанк', 'Ощад Банк', 'Mathema'];
const DEFAULT_PAID_METHOD = PAID_METHODS[0];

const MIN_HOUR = 9;
const DEFAULT_OPEN_HOUR = 18;
const MAX_HOUR = 21;

const AUTO_COMPLETE_MS = 48 * 60 * 60 * 1000;   // 48 годин
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 години
const MAX_BACKUPS = 14;
const MAX_AUDIT_ENTRIES = 300;
const THEME_STORAGE_KEY = 'schedule_theme_pref';

let state = {
  key: null,
  students: [],
  lessons: [],
  blockedSlots: [],
  availableSlots: [],
  bookingRequests: [],
  auditLog: [],
  backups: [],
  currentDate: new Date(),
  view: 'day',
  isEditMode: false,
  editingLessonId: null,
  currentInfoStudentId: null,
  selectedNewStudentColor: PASTEL_COLORS[0]
};

const elements = {
  currentDateDisplay: document.getElementById('current-date-display'),
  calendarGrid: document.getElementById('calendar-grid'),
  todayBtn: document.getElementById('today-btn'),
  prevBtn: document.getElementById('prev-date-btn'),
  nextBtn: document.getElementById('next-date-btn'),
  viewDayBtn: document.getElementById('view-day-btn'),
  viewWeekBtn: document.getElementById('view-week-btn'),
  viewMonthBtn: document.getElementById('view-month-btn'),

  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  syncStatus: document.getElementById('sync-status'),
  syncStatusText: document.getElementById('sync-status-text'),
  settingsBadgeCount: document.getElementById('settings-badge-count'),

  settingsBtn: document.getElementById('settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  closeSettingsModalBtn: document.getElementById('close-settings-modal-btn'),
  modalAddLessonBtn: document.getElementById('modal-add-lesson-btn'),
  modalManageStudentsBtn: document.getElementById('modal-manage-students-btn'),
  modalRequestsBtn: document.getElementById('modal-requests-btn'),
  requestsBadgeCount: document.getElementById('requests-badge-count'),
  modalReportsBtn: document.getElementById('modal-reports-btn'),
  modalAuditLogBtn: document.getElementById('modal-audit-log-btn'),
  modalBackupsBtn: document.getElementById('modal-backups-btn'),
  modalStudentLinkBtn: document.getElementById('modal-student-link-btn'),
  editModeCheckbox: document.getElementById('edit-mode-checkbox'),

  studentsInfoBtn: document.getElementById('students-info-btn'),
  studentsPickerModal: document.getElementById('students-picker-modal'),
  studentsPickerList: document.getElementById('students-picker-list'),
  closeStudentsPickerModalBtn: document.getElementById('close-students-picker-modal-btn'),

  studentInfoModal: document.getElementById('student-info-modal'),
  studentInfoTitle: document.getElementById('student-info-title'),
  studentInfoFields: document.getElementById('student-info-fields'),
  studentInfoStats: document.getElementById('student-info-stats'),
  studentInfoList: document.getElementById('student-info-list'),
  studentInfoLinkInput: document.getElementById('student-info-link-input'),
  studentInfoCopyLinkBtn: document.getElementById('student-info-copy-link-btn'),
  studentInfoPlannedBtn: document.getElementById('student-info-planned-btn'),
  studentInfoHistoryBtn: document.getElementById('student-info-history-btn'),
  closeStudentInfoModalBtn: document.getElementById('close-student-info-modal-btn'),

  studentsModal: document.getElementById('students-modal'),
  closeStudentsModalBtn: document.getElementById('close-students-modal-btn'),
  newStudentName: document.getElementById('new-student-name'),
  newStudentGrade: document.getElementById('new-student-grade'),
  newStudentPhone: document.getElementById('new-student-phone'),
  newStudentParentName: document.getElementById('new-student-parent-name'),
  newStudentParentPhone: document.getElementById('new-student-parent-phone'),
  newStudentSwatches: document.getElementById('new-student-swatches'),
  addStudentBtn: document.getElementById('add-student-btn'),
  studentsList: document.getElementById('students-list'),

  lessonModal: document.getElementById('lesson-modal'),
  lessonModalTitle: document.getElementById('lesson-modal-title'),
  closeLessonModalBtn: document.getElementById('close-lesson-modal-btn'),
  saveLessonBtn: document.getElementById('save-lesson-btn'),
  lessonStudentSelect: document.getElementById('lesson-student-select'),
  lessonDateInput: document.getElementById('lesson-date-input'),
  lessonHourSelect: document.getElementById('lesson-hour-select'),
  lessonMinuteSelect: document.getElementById('lesson-minute-select'),
  lessonPaidSelect: document.getElementById('lesson-paid-select'),
  lessonStatusSelect: document.getElementById('lesson-status-select'),
  lessonRepeatSelect: document.getElementById('lesson-repeat-select'),
  repeatGroup: document.getElementById('repeat-group'),

  paymentDetailsGroup: document.getElementById('payment-details-group'),
  lessonPaidAmount: document.getElementById('lesson-paid-amount'),
  lessonPaidDate: document.getElementById('lesson-paid-date'),
  lessonPaidMethod: document.getElementById('lesson-paid-method'),

  lessonTopicInput: document.getElementById('lesson-topic-input'),
  lessonHomeworkInput: document.getElementById('lesson-homework-input'),

  lessonPastNotice: document.getElementById('lesson-past-notice'),
  deleteLessonBtn: document.getElementById('delete-lesson-btn'),

  reportsModal: document.getElementById('reports-modal'),
  closeReportsModalBtn: document.getElementById('close-reports-modal-btn'),
  reportPeriodSelect: document.getElementById('report-period-select'),
  reportCustomRange: document.getElementById('report-custom-range'),
  reportFromDate: document.getElementById('report-from-date'),
  reportToDate: document.getElementById('report-to-date'),
  generateReportBtn: document.getElementById('generate-report-btn'),
  reportOutput: document.getElementById('report-output'),
  reportIssues: document.getElementById('report-issues'),

  requestsModal: document.getElementById('requests-modal'),
  requestsList: document.getElementById('requests-list'),
  closeRequestsModalBtn: document.getElementById('close-requests-modal-btn'),

  auditLogModal: document.getElementById('audit-log-modal'),
  auditLogList: document.getElementById('audit-log-list'),
  closeAuditLogModalBtn: document.getElementById('close-audit-log-modal-btn'),

  backupsModal: document.getElementById('backups-modal'),
  backupsList: document.getElementById('backups-list'),
  closeBackupsModalBtn: document.getElementById('close-backups-modal-btn'),

  studentLinkModal: document.getElementById('student-link-modal'),
  studentLinkInput: document.getElementById('student-link-input'),
  copyStudentLinkBtn: document.getElementById('copy-student-link-btn'),
  closeStudentLinkModalBtn: document.getElementById('close-student-link-modal-btn'),

  confirmModal: document.getElementById('confirm-modal'),
  confirmModalMessage: document.getElementById('confirm-modal-message'),
  confirmModalCancelBtn: document.getElementById('confirm-modal-cancel-btn'),
  confirmModalOkBtn: document.getElementById('confirm-modal-ok-btn'),

  toastContainer: document.getElementById('toast-container')
};

document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'light');
  initTimeOptions();
  setupEventListeners();
  setupSwipeNavigation();

  const urlParams = new URLSearchParams(window.location.search);
  state.key = urlParams.get('key') || 'default_schedule';

  await loadSchedule();
  sanitizeState();

  let needsSave = false;
  if (autoCompleteLessons()) needsSave = true;
  if (maybeCreateBackup()) needsSave = true;
  if (needsSave) await saveSchedule();

  renderNewStudentSwatches();
  render();

  // Періодична перевірка на автозавершення уроків, поки застосунок відкритий
  setInterval(async () => {
    if (autoCompleteLessons()) {
      await saveSchedule();
      render();
    }
  }, 30 * 60 * 1000);
});

window.addEventListener('resize', () => {
  if (state.view === 'week') render();
});

// ===================== ЗАГАЛЬНІ УТИЛІТИ: TOAST / CONFIRM / ТЕМА =====================

function showToast(message, type = 'info', duration = 3200) {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  elements.toastContainer.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 250);
  }, duration);
}

function showConfirm(message) {
  return new Promise(resolve => {
    elements.confirmModalMessage.textContent = message;
    elements.confirmModal.classList.remove('hidden');
    const cleanup = (result) => {
      elements.confirmModal.classList.add('hidden');
      elements.confirmModalOkBtn.onclick = null;
      elements.confirmModalCancelBtn.onclick = null;
      resolve(result);
    };
    elements.confirmModalOkBtn.onclick = () => cleanup(true);
    elements.confirmModalCancelBtn.onclick = () => cleanup(false);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (elements.themeToggleBtn) elements.themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ===================== СИНХРОНІЗАЦІЯ / СТАТУС ЗБЕРЕЖЕННЯ =====================

function setSyncStatus(status) {
  if (!elements.syncStatus) return;
  elements.syncStatus.className = status;
  if (status === 'saving') elements.syncStatusText.textContent = 'Збереження...';
  else if (status === 'saved') elements.syncStatusText.textContent = 'Збережено';
  else if (status === 'offline') elements.syncStatusText.textContent = 'Немає з\'єднання, локально';
}

// ===================== ЖУРНАЛ ЗМІН (АУДИТ-ЛОГ) =====================

function logAudit(actor, action) {
  state.auditLog.unshift({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), actor, action });
  if (state.auditLog.length > MAX_AUDIT_ENTRIES) state.auditLog.length = MAX_AUDIT_ENTRIES;
}

function renderAuditLog() {
  elements.auditLogList.innerHTML = '';
  if (state.auditLog.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text-muted); font-size:0.88rem; text-align:center; padding:16px;';
    empty.textContent = 'Журнал змін поки порожній.';
    elements.auditLogList.appendChild(empty);
    return;
  }
  state.auditLog.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'audit-item';
    const dt = new Date(entry.ts);
    div.innerHTML = `<div>${escapeHtml(entry.action)}</div><div class="audit-meta">${escapeHtml(entry.actor)} · ${escapeHtml(dt.toLocaleString('uk-UA'))}</div>`;
    elements.auditLogList.appendChild(div);
  });
}

// ===================== РЕЗЕРВНІ КОПІЇ =====================

function maybeCreateBackup() {
  const last = state.backups.length ? state.backups[0].ts : 0;
  if (Date.now() - last < BACKUP_INTERVAL_MS) return false;
  state.backups.unshift({
    ts: Date.now(),
    students: deepClone(state.students),
    lessons: deepClone(state.lessons),
    blockedSlots: deepClone(state.blockedSlots),
    availableSlots: deepClone(state.availableSlots)
  });
  if (state.backups.length > MAX_BACKUPS) state.backups.length = MAX_BACKUPS;
  return true;
}

function renderBackupsList() {
  elements.backupsList.innerHTML = '';
  if (state.backups.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text-muted); font-size:0.88rem; text-align:center; padding:16px;';
    empty.textContent = 'Резервних копій ще немає. Перша буде створена автоматично.';
    elements.backupsList.appendChild(empty);
    return;
  }
  state.backups.forEach(b => {
    const div = document.createElement('div');
    div.className = 'backup-item';
    const dt = new Date(b.ts);
    const label = document.createElement('span');
    label.textContent = `${dt.toLocaleString('uk-UA')} · ${b.students.length} учнів, ${b.lessons.length} уроків`;
    const btn = document.createElement('button');
    btn.className = 'danger';
    btn.textContent = 'Відновити';
    btn.onclick = () => restoreBackup(b.ts);
    div.appendChild(label);
    div.appendChild(btn);
    elements.backupsList.appendChild(div);
  });
}

async function restoreBackup(ts) {
  const backup = state.backups.find(b => b.ts === ts);
  if (!backup) return;
  const dtLabel = new Date(ts).toLocaleString('uk-UA');
  const confirmed = await showConfirm(`Відновити дані станом на ${dtLabel}? Поточні уроки, учні та слоти доступності буде замінено.`);
  if (!confirmed) return;

  state.students = deepClone(backup.students);
  state.lessons = deepClone(backup.lessons);
  state.blockedSlots = deepClone(backup.blockedSlots);
  state.availableSlots = deepClone(backup.availableSlots);
  logAudit('Викладач', `Відновлено дані з резервної копії від ${dtLabel}`);
  await saveSchedule();
  render();
  renderBackupsList();
  showToast('Дані відновлено з резервної копії.', 'success');
}

// ===================== АВТОМАТИЧНЕ ПОЗНАЧЕННЯ "ВІДБУВСЯ" (через 48 год) =====================

function autoCompleteLessons() {
  let changed = false;
  state.lessons.forEach(l => {
    if (l.status !== 'planned') return;
    const [y, m, d] = String(l.date).split('-').map(Number);
    const [hh, mm] = String(l.time || '00:00').split(':').map(Number);
    if (!y) return;
    const lessonTime = new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
    if (Date.now() - lessonTime > AUTO_COMPLETE_MS) {
      l.status = 'completed';
      changed = true;
      const student = state.students.find(s => String(s.id) === String(l.studentId));
      logAudit('Система', `Автоматично позначено як "Відбувся": ${student ? student.name : 'учень'} (${l.date} ${l.time})`);
    }
  });
  return changed;
}

// ===================== ІНІЦІАЛІЗАЦІЯ ЧАСОВИХ ОПЦІЙ =====================

function initTimeOptions() {
  elements.lessonHourSelect.innerHTML = '';
  for (let h = 8; h <= 22; h++) {
    const hourStr = String(h).padStart(2, '0');
    const opt = document.createElement('option');
    opt.value = hourStr;
    opt.textContent = hourStr;
    if (h === 18) opt.selected = true;
    elements.lessonHourSelect.appendChild(opt);
  }

  elements.lessonMinuteSelect.innerHTML = '';
  for (let m = 0; m < 60; m += 5) {
    const minStr = String(m).padStart(2, '0');
    const opt = document.createElement('option');
    opt.value = minStr;
    opt.textContent = minStr;
    if (m === 0) opt.selected = true;
    elements.lessonMinuteSelect.appendChild(opt);
  }
}

function sanitizeState() {
  if (!Array.isArray(state.students)) state.students = [];
  if (!Array.isArray(state.lessons)) state.lessons = [];
  if (!Array.isArray(state.blockedSlots)) state.blockedSlots = [];
  if (!Array.isArray(state.availableSlots)) state.availableSlots = [];
  if (!Array.isArray(state.bookingRequests)) state.bookingRequests = [];
  if (!Array.isArray(state.auditLog)) state.auditLog = [];
  if (!Array.isArray(state.backups)) state.backups = [];

  state.students.forEach((s, idx) => {
    s.id = s.id ? String(s.id) : String(Date.now() + idx);
    s.name = s.name || `Учень ${idx + 1}`;
    s.grade = s.grade || '';
    s.phone = s.phone || '';
    s.parentName = s.parentName || '';
    s.parentPhone = s.parentPhone || '';
    if (!PASTEL_COLORS.includes(s.color)) {
      s.color = PASTEL_COLORS[idx % PASTEL_COLORS.length];
    }
  });

  state.lessons.forEach((l, idx) => {
    l.id = l.id ? String(l.id) : String(Date.now() + '_' + idx);
    l.studentId = String(l.studentId || '');
    l.paid = l.paid === true || l.paid === 'true';
    l.status = l.status || 'planned';
    l.topic = l.topic || '';
    l.homework = l.homework || '';
    l.paidAmount = l.paid ? (l.paidAmount != null && l.paidAmount !== '' ? Number(l.paidAmount) : DEFAULT_PAID_AMOUNT) : null;
    l.paidDate = l.paid ? (l.paidDate || l.date) : null;
    l.paidMethod = l.paid ? (l.paidMethod || DEFAULT_PAID_METHOD) : null;
  });

  state.blockedSlots = state.blockedSlots.filter(b => b && b.date && b.time).map(b => ({ date: String(b.date), time: String(b.time) }));
  state.availableSlots = state.availableSlots.filter(b => b && b.date && b.time).map(b => ({ date: String(b.date), time: String(b.time) }));
  state.bookingRequests = state.bookingRequests.filter(r => r && r.date && r.time && r.studentId);
}

async function loadSchedule() {
  let loaded = false;

  if (db && state.key) {
    try {
      const { data, error } = await db.rpc('get_schedule', { p_access_token: state.key });
      if (!error && data && data.data) {
        applyLoadedData(data.data);
        loaded = true;
      }
    } catch (e) {
      console.warn('Supabase fallback to LocalStorage');
    }
  }

  if (!loaded) {
    const local = localStorage.getItem('schedule_' + state.key);
    if (local) {
      try {
        applyLoadedData(JSON.parse(local));
      } catch (e) { console.error(e); }
    }
  }
}

function applyLoadedData(data) {
  state.students = data.students || [];
  state.lessons = data.lessons || [];
  state.blockedSlots = data.blockedSlots || [];
  state.availableSlots = data.availableSlots || [];
  state.bookingRequests = data.bookingRequests || [];
  state.auditLog = data.auditLog || [];
  state.backups = data.backups || [];
}

async function saveSchedule() {
  sanitizeState();
  setSyncStatus('saving');
  const payload = {
    students: state.students,
    lessons: state.lessons,
    blockedSlots: state.blockedSlots,
    availableSlots: state.availableSlots,
    bookingRequests: state.bookingRequests,
    auditLog: state.auditLog,
    backups: state.backups
  };
  localStorage.setItem('schedule_' + state.key, JSON.stringify(payload));

  if (db && state.key) {
    try {
      const { error } = await db.rpc('save_schedule', { p_access_token: state.key, p_data: payload });
      if (error) throw error;
      setSyncStatus('saved');
    } catch (e) {
      console.warn('Saved to LocalStorage only.');
      setSyncStatus('offline');
    }
  } else {
    setSyncStatus('offline');
  }
}

function render() {
  updateDateDisplay();
  updateViewButtons();
  updateStudentSelectOptions();
  updateBadgeCounts();
  renderGrid();
}

function updateBadgeCounts() {
  const count = state.bookingRequests.filter(r => r.status === 'pending').length;
  [elements.settingsBadgeCount, elements.requestsBadgeCount].forEach(el => {
    if (!el) return;
    if (count > 0) {
      el.style.display = 'flex';
      el.textContent = String(count);
    } else {
      el.style.display = 'none';
    }
  });
}

function renderNewStudentSwatches() {
  elements.newStudentSwatches.innerHTML = '';
  PASTEL_COLORS.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = `color-swatch ${color === state.selectedNewStudentColor ? 'selected' : ''}`;
    swatch.style.backgroundColor = color;
    swatch.onclick = () => {
      state.selectedNewStudentColor = color;
      renderNewStudentSwatches();
    };
    elements.newStudentSwatches.appendChild(swatch);
  });
}

function updateViewButtons() {
  [elements.viewDayBtn, elements.viewWeekBtn, elements.viewMonthBtn].forEach(btn => btn.classList.remove('active'));
  if (state.view === 'day') elements.viewDayBtn.classList.add('active');
  if (state.view === 'week') elements.viewWeekBtn.classList.add('active');
  if (state.view === 'month') elements.viewMonthBtn.classList.add('active');
}

function updateDateDisplay() {
  elements.currentDateDisplay.innerHTML = '';

  if (state.view === 'day') {
    const text = state.currentDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    const span = document.createElement('span');
    span.className = 'date-display-big';
    span.textContent = text;
    elements.currentDateDisplay.appendChild(span);
  } else if (state.view === 'week') {
    const start = getStartOfWeek(state.currentDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const text = `${start.getDate()} ${start.toLocaleDateString('uk-UA', { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString('uk-UA', { month: 'short' })}`;
    const span = document.createElement('span');
    span.className = 'date-display-big';
    span.textContent = text;
    elements.currentDateDisplay.appendChild(span);
  } else if (state.view === 'month') {
    const monthName = state.currentDate.toLocaleDateString('uk-UA', { month: 'long' });
    const year = state.currentDate.getFullYear();
    const monthSpan = document.createElement('span');
    monthSpan.className = 'date-display-big';
    monthSpan.textContent = monthName;
    const yearSpan = document.createElement('span');
    yearSpan.className = 'date-display-year';
    yearSpan.textContent = String(year);
    elements.currentDateDisplay.appendChild(monthSpan);
    elements.currentDateDisplay.appendChild(yearSpan);
  }
}

function updateStudentSelectOptions() {
  elements.lessonStudentSelect.innerHTML = '';
  state.students.forEach(s => {
    const opt = document.createElement('option');
    opt.value = String(s.id);
    opt.textContent = s.name;
    elements.lessonStudentSelect.appendChild(opt);
  });
}

function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
}

function isPastDate(dateISO) {
  return dateISO < formatDateISO(new Date());
}

function isPastSlot(dateISO, hour) {
  const [y, m, d] = String(dateISO).split('-').map(Number);
  if (!y) return false;
  const slotDate = new Date(y, m - 1, d, hour, 0, 0, 0);
  return slotDate.getTime() < Date.now();
}

function hourToTimeStr(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

function getSlotStatus(dateISO, hour) {
  const timeStr = hourToTimeStr(hour);
  const lessons = state.lessons.filter(l => {
    if (l.date !== dateISO) return false;
    const lHour = parseInt((l.time || '00:00').split(':')[0], 10);
    return lHour === hour;
  });

  if (lessons.length > 0) return { status: 'lesson', lessons };
  if (isPastSlot(dateISO, hour)) return { status: 'unavailable' };

  if (hour < DEFAULT_OPEN_HOUR) {
    const opened = state.availableSlots.some(s => s.date === dateISO && s.time === timeStr);
    return { status: opened ? 'available' : 'unavailable' };
  } else {
    const closed = state.blockedSlots.some(s => s.date === dateISO && s.time === timeStr);
    return { status: closed ? 'unavailable' : 'available' };
  }
}

async function toggleSlotAvailability(dateISO, hour) {
  const timeStr = hourToTimeStr(hour);
  let nowAvailable;
  if (hour < DEFAULT_OPEN_HOUR) {
    const idx = state.availableSlots.findIndex(s => s.date === dateISO && s.time === timeStr);
    if (idx >= 0) { state.availableSlots.splice(idx, 1); nowAvailable = false; }
    else { state.availableSlots.push({ date: dateISO, time: timeStr }); nowAvailable = true; }
  } else {
    const idx = state.blockedSlots.findIndex(s => s.date === dateISO && s.time === timeStr);
    if (idx >= 0) { state.blockedSlots.splice(idx, 1); nowAvailable = true; }
    else { state.blockedSlots.push({ date: dateISO, time: timeStr }); nowAvailable = false; }
  }
  logAudit('Викладач', `Слот ${dateISO} ${timeStr} позначено як "${nowAvailable ? 'доступно' : 'недоступно'}"`);
  await saveSchedule();
}

function formatDateDisplay(dateISO) {
  const [y, m, d] = String(dateISO).split('-').map(Number);
  if (!y || !m || !d) return dateISO || '';
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
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

function renderGrid() {
  elements.calendarGrid.innerHTML = '';

  if (state.view === 'month') {
    renderMonthView();
    return;
  }

  if (state.view === 'week') {
    renderWeekOrDayColumns(getWeekDates(state.currentDate), { merge: !state.isEditMode, showUnavailable: state.isEditMode });
    return;
  }

  renderWeekOrDayColumns([new Date(state.currentDate)], { merge: false, showUnavailable: state.isEditMode });
}

function getWeekDates(anchorDate) {
  const startOfWeek = getStartOfWeek(anchorDate);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getRelevantHours(dateISO) {
  const hours = [];
  for (let h = MIN_HOUR; h <= MAX_HOUR; h++) hours.push(h);
  state.lessons.forEach(l => {
    if (l.date === dateISO) {
      const lh = parseInt((l.time || '00:00').split(':')[0], 10);
      if (!isNaN(lh) && !hours.includes(lh)) hours.push(lh);
    }
  });
  hours.sort((a, b) => a - b);
  return hours;
}

function buildDayEntries(dateISO, options) {
  const merge = !!options.merge;
  const showUnavailable = !!options.showUnavailable;
  const hours = getRelevantHours(dateISO);

  const entries = [];
  let run = [];

  function flushRun() {
    if (run.length === 0) return;
    if (run.length === 1) entries.push({ type: 'hour', hour: run[0], status: 'available' });
    else entries.push({ type: 'range', start: run[0], end: run[run.length - 1] + 1 });
    run = [];
  }

  hours.forEach(h => {
    const info = getSlotStatus(dateISO, h);

    if (info.status === 'lesson') {
      flushRun();
      entries.push({ type: 'lesson', hour: h, lessons: info.lessons });
      return;
    }

    if (info.status === 'available') {
      if (merge && h < DEFAULT_OPEN_HOUR) {
        if (run.length && run[run.length - 1] !== h - 1) flushRun();
        run.push(h);
      } else {
        flushRun();
        entries.push({ type: 'hour', hour: h, status: 'available' });
      }
      return;
    }

    flushRun();
    if (showUnavailable) entries.push({ type: 'hour', hour: h, status: 'unavailable' });
  });

  flushRun();
  return entries;
}

function renderWeekOrDayColumns(daysDates, options) {
  const isWeek = daysDates.length > 1;
  const isMobile = window.innerWidth <= 640;

  elements.calendarGrid.className = '';
  const columnsWrap = document.createElement('div');
  columnsWrap.className = `week-columns ${isWeek && isMobile ? 'mobile-stack' : ''}`;

  daysDates.forEach(date => {
    const dateISO = formatDateISO(date);
    const pastDate = isPastDate(dateISO);

    const column = document.createElement('div');
    column.className = 'day-column';
    column.appendChild(createDayHeaderElement(date));

    const entries = buildDayEntries(dateISO, options);

    if (entries.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'color:var(--text-muted); font-size:0.78rem; text-align:center; padding:8px;';
      emptyMsg.textContent = 'Немає вільних годин';
      column.appendChild(emptyMsg);
    }

    entries.forEach(entry => {
      if (entry.type === 'lesson') {
        entry.lessons.forEach(lesson => column.appendChild(createLessonCard(lesson, pastDate)));
        return;
      }

      if (entry.type === 'range') {
        const startStr = hourToTimeStr(entry.start);
        const endStr = hourToTimeStr(entry.end);
        const el = document.createElement('div');
        el.className = 'slot-free slot-range';
        el.textContent = `${startStr}–${endStr} Вільно`;
        attachFreeSlotHandlers(el, dateISO, entry.start, pastDate);
        column.appendChild(el);
        return;
      }

      const timeStr = hourToTimeStr(entry.hour);
      if (entry.status === 'available') {
        const el = document.createElement('div');
        el.className = 'slot-free';
        el.textContent = `${timeStr} Вільно`;
        attachFreeSlotHandlers(el, dateISO, entry.hour, pastDate);
        column.appendChild(el);
      } else {
        const el = document.createElement('div');
        el.className = 'slot-unavailable';
        el.textContent = `${timeStr} Недоступно`;
        if (state.isEditMode) {
          el.style.cursor = 'pointer';
          el.title = 'Натисніть, щоб зробити слот доступним';
          el.onclick = async () => { await toggleSlotAvailability(dateISO, entry.hour); render(); };
        }
        column.appendChild(el);
      }
    });

    columnsWrap.appendChild(column);
  });

  elements.calendarGrid.appendChild(columnsWrap);
}

function attachFreeSlotHandlers(el, dateISO, hour, pastDate) {
  const canInteract = !pastDate || state.isEditMode;
  if (!canInteract) return;

  el.classList.add('clickable');

  if (state.isEditMode) {
    el.title = 'Натисніть, щоб позначити слот недоступним';
    el.onclick = async () => { await toggleSlotAvailability(dateISO, hour); render(); };
  } else {
    el.title = 'Натисніть, щоб швидко додати урок на цей час';
    el.onclick = () => openAddLessonModal(dateISO, hour);
  }

  el.ondragover = (e) => { e.preventDefault(); el.classList.add('drag-over'); };
  el.ondragleave = () => el.classList.remove('drag-over');
  el.ondrop = async (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    const lessonId = e.dataTransfer.getData('text/plain');
    await moveLesson(lessonId, dateISO, hourToTimeStr(hour));
  };
}

function createLessonCard(lesson, pastDate) {
  const student = state.students.find(s => String(s.id) === String(lesson.studentId));
  const card = document.createElement('div');
  card.className = 'lesson-card';
  card.style.backgroundColor = student ? (student.color || PASTEL_COLORS[0]) : '#f5f5f4';

  const canDrag = !pastDate || state.isEditMode;
  card.draggable = canDrag;

  const isPaid = lesson.paid === true || lesson.paid === 'true';
  const isCompleted = lesson.status === 'completed';

  const titleRow = document.createElement('div');
  titleRow.className = 'lesson-title-row';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'lesson-time';
  timeSpan.textContent = lesson.time || '';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'lesson-student-name';
  nameSpan.textContent = student ? student.name : 'Учень';
  nameSpan.title = 'Показати картку учня';
  nameSpan.onclick = (e) => {
    e.stopPropagation();
    if (student) openStudentInfoModal(student.id);
  };

  titleRow.appendChild(timeSpan);
  titleRow.appendChild(nameSpan);

  const badgesRow = document.createElement('div');
  badgesRow.className = 'lesson-badges';

  const paidBadge = document.createElement('span');
  paidBadge.className = 'badge';
  paidBadge.style.backgroundColor = isPaid ? '#dcfce7' : '#fee2e2';
  paidBadge.style.color = isPaid ? '#15803d' : '#991b1b';
  paidBadge.textContent = isPaid ? 'Оплачено' : 'Не опл.';
  paidBadge.title = isPaid
    ? `Оплачено${lesson.paidAmount != null ? ' ' + lesson.paidAmount + ' грн' : ''}${lesson.paidMethod ? ' · ' + lesson.paidMethod : ''}`
    : 'Оплата ще не внесена';

  const statusBadge = document.createElement('span');
  statusBadge.className = 'badge';
  statusBadge.style.backgroundColor = isCompleted ? '#e2e8f0' : '#dbeafe';
  statusBadge.style.color = isCompleted ? '#334155' : '#1d4ed8';
  statusBadge.textContent = isCompleted ? 'Відбувся' : 'Заплан.';
  statusBadge.title = isCompleted ? 'Урок відбувся' : 'Урок запланований';

  badgesRow.appendChild(paidBadge);
  badgesRow.appendChild(statusBadge);

  card.appendChild(titleRow);
  card.appendChild(badgesRow);

  card.onclick = () => openEditLessonModal(lesson.id);
  if (canDrag) {
    card.ondragstart = (e) => e.dataTransfer.setData('text/plain', String(lesson.id));
  }

  return card;
}

function renderMonthView() {
  elements.calendarGrid.className = 'calendar-grid grid-month';

  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  DAY_NAMES_SHORT.forEach(name => {
    const h = document.createElement('div');
    h.className = 'day-header';
    h.style.cssText = 'font-weight:700; font-size:0.85rem;';
    h.textContent = name;
    elements.calendarGrid.appendChild(h);
  });

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const cell = document.createElement('div');
    cell.className = 'month-cell padding-cell';
    cell.innerHTML = `<div class="month-day-num muted">${prevMonthLastDay - i}</div>`;
    elements.calendarGrid.appendChild(cell);
  }

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month, day);
    const dateISO = formatDateISO(d);
    const isCurrentToday = isToday(d);

    const cell = document.createElement('div');
    cell.className = `month-cell ${isCurrentToday ? 'today' : ''}`;

    const numDiv = document.createElement('div');
    numDiv.className = `month-day-num ${isCurrentToday ? 'today-num' : ''}`;
    numDiv.textContent = day;
    cell.appendChild(numDiv);

    const dayLessons = state.lessons.filter(l => l.date === dateISO);
    dayLessons.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    dayLessons.forEach(l => {
      const s = state.students.find(st => String(st.id) === String(l.studentId));
      const badge = document.createElement('div');
      badge.className = 'month-lesson-badge';
      badge.style.backgroundColor = s ? (s.color || PASTEL_COLORS[0]) : '#f5f5f4';

      const isPaid = l.paid === true || l.paid === 'true';
      const isCompleted = l.status === 'completed';

      const textSpan = document.createElement('span');
      textSpan.style.cssText = 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#1e293b; font-weight:600; display:flex; gap:4px;';

      const timeStrong = document.createElement('strong');
      timeStrong.textContent = l.time || '';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'month-lesson-name';
      nameSpan.textContent = s ? s.name : '';
      nameSpan.onclick = (e) => {
        e.stopPropagation();
        if (s) openStudentInfoModal(s.id);
      };

      textSpan.appendChild(timeStrong);
      textSpan.appendChild(nameSpan);

      const iconSpan = document.createElement('span');
      iconSpan.style.cssText = 'display:flex; align-items:center; gap:2px; flex-shrink:0;';
      if (isPaid) {
        const dollarEl = document.createElement('span');
        dollarEl.style.cssText = 'color:#15803d; font-weight:800; font-size:0.85rem;';
        dollarEl.textContent = '$';
        dollarEl.title = `Оплачено${l.paidAmount != null ? ' ' + l.paidAmount + ' грн' : ''}${l.paidMethod ? ' · ' + l.paidMethod : ''}`;
        iconSpan.appendChild(dollarEl);
      }
      if (isCompleted) {
        const checkEl = document.createElement('span');
        checkEl.style.cssText = 'color:#16a34a; font-weight:800; font-size:0.85rem;';
        checkEl.textContent = '✓';
        checkEl.title = 'Урок відбувся';
        iconSpan.appendChild(checkEl);
      }

      badge.appendChild(textSpan);
      badge.appendChild(iconSpan);

      badge.onclick = (e) => {
        e.stopPropagation();
        openEditLessonModal(l.id);
      };

      cell.appendChild(badge);
    });

    elements.calendarGrid.appendChild(cell);
  }

  const totalCells = startDayOfWeek + totalDays;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const cell = document.createElement('div');
    cell.className = 'month-cell padding-cell';
    cell.innerHTML = `<div class="month-day-num muted">${i}</div>`;
    elements.calendarGrid.appendChild(cell);
  }
}

async function moveLesson(lessonId, newDate, newTime) {
  const lesson = state.lessons.find(l => String(l.id) === String(lessonId));
  if (!lesson) return;

  if (!state.isEditMode && (isPastDate(lesson.date) || isPastDate(newDate))) {
    showToast('Переносити уроки на/з минулих дат можна лише через Налаштування.', 'error');
    return;
  }

  const student = state.students.find(s => String(s.id) === String(lesson.studentId));
  const oldDate = lesson.date, oldTime = lesson.time;
  lesson.date = newDate;
  lesson.time = newTime;
  logAudit('Викладач', `Перенесено урок ${student ? student.name : ''}: ${oldDate} ${oldTime} → ${newDate} ${newTime}`);
  await saveSchedule();
  render();
}

function togglePaymentDetailsVisibility() {
  const isPaid = elements.lessonPaidSelect.value === 'true';
  elements.paymentDetailsGroup.style.display = isPaid ? 'block' : 'none';
}

function setLessonFormEditable(editable) {
  const controls = [
    elements.lessonStudentSelect, elements.lessonDateInput,
    elements.lessonHourSelect, elements.lessonMinuteSelect,
    elements.lessonPaidSelect, elements.lessonStatusSelect,
    elements.lessonTopicInput, elements.lessonHomeworkInput,
    elements.lessonPaidAmount, elements.lessonPaidDate, elements.lessonPaidMethod
  ];
  controls.forEach(c => { if (c) c.disabled = !editable; });
  elements.saveLessonBtn.style.display = editable ? 'block' : 'none';
  elements.lessonPastNotice.style.display = editable ? 'none' : 'block';
}

function ensurePaidMethodOption(value) {
  if (!value) return;
  const exists = Array.from(elements.lessonPaidMethod.options).some(o => o.value === value);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    elements.lessonPaidMethod.appendChild(opt);
  }
}

function openAddLessonModal(prefillDate, prefillHour) {
  if (state.students.length === 0) {
    showToast('Спочатку додайте хоча б одного учня!', 'error');
    renderStudentsList();
    elements.studentsModal.classList.remove('hidden');
    return;
  }
  state.editingLessonId = null;
  elements.lessonModalTitle.textContent = 'Додати урок';
  updateStudentSelectOptions();
  elements.lessonDateInput.value = prefillDate || formatDateISO(state.currentDate);
  elements.lessonHourSelect.value = prefillHour != null ? String(prefillHour).padStart(2, '0') : '18';
  elements.lessonMinuteSelect.value = '00';
  elements.lessonPaidSelect.value = 'false';
  elements.lessonStatusSelect.value = 'planned'; // Автоматичне заповнення - новий урок завжди "Запланований"
  elements.lessonTopicInput.value = '';
  elements.lessonHomeworkInput.value = '';
  elements.lessonPaidAmount.value = DEFAULT_PAID_AMOUNT;
  elements.lessonPaidDate.value = elements.lessonDateInput.value;
  elements.lessonPaidMethod.value = DEFAULT_PAID_METHOD;
  togglePaymentDetailsVisibility();
  elements.repeatGroup.style.display = 'block';
  setLessonFormEditable(true);
  elements.deleteLessonBtn.style.display = 'none';
  elements.lessonModal.classList.remove('hidden');
}

function openEditLessonModal(lessonId) {
  const lesson = state.lessons.find(l => String(l.id) === String(lessonId));
  if (!lesson) return;

  state.editingLessonId = String(lessonId);

  updateStudentSelectOptions();
  elements.lessonStudentSelect.value = String(lesson.studentId);
  elements.lessonDateInput.value = lesson.date;

  const parts = (lesson.time || '18:00').split(':');
  elements.lessonHourSelect.value = String(parts[0]).padStart(2, '0');
  elements.lessonMinuteSelect.value = String(parts[1]).padStart(2, '0');

  elements.lessonPaidSelect.value = String(lesson.paid);
  elements.lessonStatusSelect.value = lesson.status || 'planned';
  elements.lessonTopicInput.value = lesson.topic || '';
  elements.lessonHomeworkInput.value = lesson.homework || '';
  elements.lessonPaidAmount.value = lesson.paidAmount != null ? lesson.paidAmount : DEFAULT_PAID_AMOUNT;
  elements.lessonPaidDate.value = lesson.paidDate || lesson.date;
  ensurePaidMethodOption(lesson.paidMethod);
  elements.lessonPaidMethod.value = lesson.paidMethod || DEFAULT_PAID_METHOD;
  togglePaymentDetailsVisibility();

  elements.repeatGroup.style.display = 'none';

  const pastDate = isPastDate(lesson.date);
  const editable = !pastDate || state.isEditMode;
  elements.lessonModalTitle.textContent = editable ? 'Редагувати урок' : 'Перегляд уроку';
  setLessonFormEditable(editable);

  const canDelete = state.isEditMode && lesson.status === 'planned';
  elements.deleteLessonBtn.style.display = canDelete ? 'block' : 'none';

  elements.lessonModal.classList.remove('hidden');
}

// ===================== УЧНІ: управління (адмін) =====================

function renderStudentsList() {
  elements.studentsList.innerHTML = '';
  if (state.students.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = 'color:var(--text-muted); font-size:0.88rem; text-align:center; padding:12px;';
    emptyMsg.textContent = 'Список порожній. Додайте учня вище.';
    elements.studentsList.appendChild(emptyMsg);
    return;
  }

  state.students.forEach(student => {
    const item = document.createElement('div');
    item.className = 'student-item';

    const headerRow = document.createElement('div');
    headerRow.className = 'student-item-header';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = student.name || '';
    nameInput.style.cssText = 'flex:1; padding:6px 10px; border:1px solid var(--border-strong); border-radius:6px; font-weight:600; font-size:0.9rem; min-width:120px; background:var(--surface); color:var(--text);';
    nameInput.onchange = async (e) => {
      const val = e.target.value.trim();
      if (val) {
        const oldName = student.name;
        student.name = val;
        logAudit('Викладач', `Перейменовано учня "${oldName}" → "${val}"`);
        await saveSchedule();
        render();
      }
    };

    const historyBtn = document.createElement('button');
    historyBtn.type = 'button';
    historyBtn.className = 'small-btn';
    historyBtn.textContent = 'Картка';
    historyBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openStudentInfoModal(student.id);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger';
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Видалити';
    deleteBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const confirmed = await showConfirm(`Видалити учня "${student.name}" та всі його уроки?`);
      if (confirmed) {
        const studentIdStr = String(student.id);
        state.students = state.students.filter(s => String(s.id) !== studentIdStr);
        state.lessons = state.lessons.filter(l => String(l.studentId) !== studentIdStr);
        logAudit('Викладач', `Видалено учня "${student.name}" та його уроки`);
        await saveSchedule();
        render();
        renderStudentsList();
        showToast('Учня видалено.', 'success');
      }
    };

    headerRow.appendChild(nameInput);
    headerRow.appendChild(historyBtn);
    headerRow.appendChild(deleteBtn);

    const extraFields = document.createElement('div');
    extraFields.className = 'student-extra-fields';

    const makeExtraInput = (placeholder, value, onSave) => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = placeholder;
      inp.value = value || '';
      inp.onchange = async (e) => {
        onSave(e.target.value.trim());
        await saveSchedule();
      };
      return inp;
    };

    extraFields.appendChild(makeExtraInput('Клас', student.grade, (v) => { student.grade = v; }));
    extraFields.appendChild(makeExtraInput('Контактний телефон', student.phone, (v) => { student.phone = v; }));
    extraFields.appendChild(makeExtraInput("Ім'я батьків", student.parentName, (v) => { student.parentName = v; }));
    extraFields.appendChild(makeExtraInput('Телефон батьків', student.parentPhone, (v) => { student.parentPhone = v; }));

    const swatchesDiv = document.createElement('div');
    swatchesDiv.className = 'student-color-swatches';

    PASTEL_COLORS.forEach(color => {
      const dot = document.createElement('div');
      dot.className = `swatch-dot ${student.color === color ? 'active' : ''}`;
      dot.style.backgroundColor = color;
      dot.onclick = async () => {
        student.color = color;
        await saveSchedule();
        render();
        renderStudentsList();
      };
      swatchesDiv.appendChild(dot);
    });

    item.appendChild(headerRow);
    item.appendChild(extraFields);
    item.appendChild(swatchesDiv);

    elements.studentsList.appendChild(item);
  });
}

// ===================== УЧНІ: перегляд інформації (кнопка "Учні" на головній) =====================

function renderStudentsPickerList() {
  elements.studentsPickerList.innerHTML = '';
  if (state.students.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text-muted); font-size:0.88rem; text-align:center; padding:16px;';
    empty.textContent = 'Список учнів порожній.';
    elements.studentsPickerList.appendChild(empty);
    return;
  }

  state.students.forEach(student => {
    const item = document.createElement('div');
    item.className = 'clickable-list-item';
    item.style.backgroundColor = student.color || '#f8fafc';
    item.innerHTML = `<span>${escapeHtml(student.name)}</span><span style="font-weight:500; font-size:0.8rem; color:#475569;">${escapeHtml(student.grade || '')}</span>`;
    item.onclick = () => {
      elements.studentsPickerModal.classList.add('hidden');
      openStudentInfoModal(student.id);
    };
    elements.studentsPickerList.appendChild(item);
  });
}

function getStudentLessonStats(studentId) {
  const idStr = String(studentId);
  const lessons = state.lessons.filter(l => String(l.studentId) === idStr);
  const completed = lessons.filter(l => l.status === 'completed');
  const planned = lessons.filter(l => l.status === 'planned');
  const completedUnpaid = completed.filter(l => !l.paid).length;
  const paidNotCompleted = lessons.filter(l => l.paid && l.status !== 'completed').length;
  return { lessons, completed, planned, completedCount: completed.length, plannedCount: planned.length, completedUnpaid, paidNotCompleted };
}

function buildStudentPersonalLink(studentId) {
  const base = window.location.href.replace(/[^/]*$/, '') + 'student-schedule.html';
  const url = new URL(base, window.location.href);
  url.searchParams.set('key', state.key);
  url.searchParams.set('student', studentId);
  return url.toString();
}

function openStudentInfoModal(studentId) {
  const student = state.students.find(s => String(s.id) === String(studentId));
  if (!student) return;

  state.currentInfoStudentId = String(studentId);
  elements.studentInfoTitle.textContent = student.name;

  elements.studentInfoFields.innerHTML = `
    <div class="info-row"><span>Клас</span><span>${escapeHtml(student.grade) || '—'}</span></div>
    <div class="info-row"><span>Контактний телефон</span><span>${escapeHtml(student.phone) || '—'}</span></div>
    <div class="info-row"><span>Ім'я батьків</span><span>${escapeHtml(student.parentName) || '—'}</span></div>
    <div class="info-row"><span>Телефон батьків</span><span>${escapeHtml(student.parentPhone) || '—'}</span></div>
  `;

  const stats = getStudentLessonStats(studentId);
  elements.studentInfoStats.innerHTML = `
    <div class="stat-card"><b>${stats.completedCount}</b><span>Проведено уроків</span></div>
    <div class="stat-card"><b>${stats.completedUnpaid}</b><span>Проведено, не оплачено</span></div>
    <div class="stat-card"><b>${stats.paidNotCompleted}</b><span>Оплачено, не проведено</span></div>
  `;

  elements.studentInfoLinkInput.value = buildStudentPersonalLink(studentId);

  renderStudentCompletedLessons(studentId);

  elements.studentInfoModal.classList.remove('hidden');
}

function renderStudentCompletedLessons(studentId) {
  const stats = getStudentLessonStats(studentId);
  const lessons = stats.completed.slice().sort((a, b) => `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`));

  elements.studentInfoList.innerHTML = '';
  if (lessons.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text-muted); font-size:0.88rem; text-align:center; padding:16px;';
    empty.textContent = 'Ще немає проведених уроків.';
    elements.studentInfoList.appendChild(empty);
    return;
  }

  lessons.forEach(l => {
    const isPaid = l.paid === true || l.paid === 'true';
    const item = document.createElement('div');
    item.className = 'lesson-history-item';
    const paidText = isPaid
      ? `Оплачено${l.paidAmount != null ? ` · ${l.paidAmount} грн` : ''}${l.paidMethod ? ` · ${escapeHtml(l.paidMethod)}` : ''}`
      : 'Не оплачено';

    item.innerHTML = `
      <div class="lesson-history-header">
        <strong>${escapeHtml(formatDateDisplay(l.date))}, ${escapeHtml(l.time || '')}</strong>
        <span class="badge" style="background:${isPaid ? '#dcfce7' : '#fee2e2'}; color:${isPaid ? '#15803d' : '#991b1b'};">${paidText}</span>
      </div>
      ${l.topic ? `<div class="lesson-history-row"><b>Тема:</b> ${escapeHtml(l.topic)}</div>` : ''}
      ${l.homework ? `<div class="lesson-history-row"><b>ДЗ:</b> ${escapeHtml(l.homework)}</div>` : ''}
    `;
    elements.studentInfoList.appendChild(item);
  });
}

function renderStudentPlannedLessons(studentId) {
  const stats = getStudentLessonStats(studentId);
  const lessons = stats.planned.slice().sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));

  elements.studentInfoList.innerHTML = '';
  if (lessons.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text-muted); font-size:0.88rem; text-align:center; padding:16px;';
    empty.textContent = 'Немає запланованих уроків.';
    elements.studentInfoList.appendChild(empty);
    return;
  }

  lessons.forEach(l => {
    const item = document.createElement('div');
    item.className = 'lesson-history-item';
    item.innerHTML = `
      <div class="lesson-history-header">
        <strong>${escapeHtml(formatDateDisplay(l.date))}, ${escapeHtml(l.time || '')}</strong>
      </div>
      ${l.topic ? `<div class="lesson-history-row"><b>Тема:</b> ${escapeHtml(l.topic)}</div>` : ''}
    `;
    elements.studentInfoList.appendChild(item);
  });
}

// ===================== ЗАЯВКИ НА ЗАПИС ВІД УЧНІВ =====================

function renderRequestsList() {
  const pending = state.bookingRequests
    .filter(r => r.status === 'pending')
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  elements.requestsList.innerHTML = '';
  if (pending.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--text-muted); font-size:0.88rem; text-align:center; padding:16px;';
    empty.textContent = 'Наразі немає нових заявок.';
    elements.requestsList.appendChild(empty);
    return;
  }

  pending.forEach(r => {
    const student = state.students.find(s => String(s.id) === String(r.studentId));
    const item = document.createElement('div');
    item.className = 'request-item';

    const row = document.createElement('div');
    row.className = 'request-row';
    row.innerHTML = `<strong>${escapeHtml(student ? student.name : 'Невідомий учень')}</strong><span>${escapeHtml(formatDateDisplay(r.date))}, ${escapeHtml(r.time)}</span>`;

    const actions = document.createElement('div');
    actions.className = 'request-actions';

    const approveBtn = document.createElement('button');
    approveBtn.className = 'primary';
    approveBtn.textContent = 'Підтвердити';
    approveBtn.onclick = () => approveBookingRequest(r.id);

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'danger';
    rejectBtn.textContent = 'Відхилити';
    rejectBtn.onclick = () => rejectBookingRequest(r.id);

    actions.appendChild(approveBtn);
    actions.appendChild(rejectBtn);

    item.appendChild(row);
    item.appendChild(actions);
    elements.requestsList.appendChild(item);
  });
}

async function approveBookingRequest(reqId) {
  const req = state.bookingRequests.find(r => String(r.id) === String(reqId));
  if (!req) return;
  const student = state.students.find(s => String(s.id) === String(req.studentId));

  const hour = parseInt(req.time.split(':')[0], 10);
  const status = getSlotStatus(req.date, hour);
  if (status.status === 'lesson') {
    showToast('Цей час вже зайнято іншим уроком.', 'error');
    return;
  }

  state.lessons.push({
    id: `${Date.now()}_req`,
    studentId: req.studentId,
    date: req.date,
    time: req.time,
    paid: false,
    status: 'planned',
    topic: '',
    homework: '',
    paidAmount: null,
    paidDate: null,
    paidMethod: null
  });

  state.bookingRequests = state.bookingRequests.filter(r => String(r.id) !== String(reqId));
  logAudit('Викладач', `Підтверджено заявку від ${student ? student.name : 'учня'} на ${req.date} ${req.time}`);
  await saveSchedule();
  renderRequestsList();
  render();
  showToast('Заявку підтверджено, урок додано до розкладу.', 'success');
}

async function rejectBookingRequest(reqId) {
  const req = state.bookingRequests.find(r => String(r.id) === String(reqId));
  if (!req) return;
  const student = state.students.find(s => String(s.id) === String(req.studentId));

  const confirmed = await showConfirm(`Відхилити заявку від ${student ? student.name : 'учня'} на ${req.date} ${req.time}?`);
  if (!confirmed) return;

  state.bookingRequests = state.bookingRequests.filter(r => String(r.id) !== String(reqId));
  logAudit('Викладач', `Відхилено заявку від ${student ? student.name : 'учня'} на ${req.date} ${req.time}`);
  await saveSchedule();
  renderRequestsList();
  updateBadgeCounts();
  showToast('Заявку відхилено.', 'info');
}

// ===================== ЗВІТИ ТА ПЕРЕВІРКА ПОМИЛОК =====================

function getReportRange() {
  const period = elements.reportPeriodSelect.value;
  const today = new Date();

  if (period === 'week') {
    const start = getStartOfWeek(today);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: formatDateISO(start), to: formatDateISO(end) };
  }
  if (period === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: formatDateISO(start), to: formatDateISO(end) };
  }
  return {
    from: elements.reportFromDate.value || formatDateISO(today),
    to: elements.reportToDate.value || formatDateISO(today)
  };
}

function generateReport() {
  const { from, to } = getReportRange();
  const lessonsInRange = state.lessons.filter(l => l.date >= from && l.date <= to);

  const totalLessons = lessonsInRange.length;
  const completedLessons = lessonsInRange.filter(l => l.status === 'completed').length;
  const totalPaid = lessonsInRange.reduce((sum, l) => sum + (l.paid ? Number(l.paidAmount || 0) : 0), 0);

  const perStudentMap = new Map();
  lessonsInRange.forEach(l => {
    const student = state.students.find(s => String(s.id) === String(l.studentId));
    const name = student ? student.name : 'Невідомий учень';
    if (!perStudentMap.has(name)) {
      perStudentMap.set(name, { name, lessonsCount: 0, completedCount: 0, paidSum: 0, unpaidCount: 0 });
    }
    const rec = perStudentMap.get(name);
    rec.lessonsCount += 1;
    if (l.status === 'completed') rec.completedCount += 1;
    if (l.paid) rec.paidSum += Number(l.paidAmount || 0);
    else rec.unpaidCount += 1;
  });

  const rows = Array.from(perStudentMap.values()).sort((a, b) => b.lessonsCount - a.lessonsCount);

  let tableRows = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      <td>${r.lessonsCount}</td>
      <td>${r.completedCount}</td>
      <td>${r.unpaidCount}</td>
      <td>${r.paidSum} грн</td>
    </tr>
  `).join('');

  if (!tableRows) {
    tableRows = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Немає даних за обраний період</td></tr>`;
  }

  elements.reportOutput.innerHTML = `
    <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">Період: ${escapeHtml(formatDateDisplay(from))} — ${escapeHtml(formatDateDisplay(to))}</div>
    <div class="stat-cards">
      <div class="stat-card"><b>${totalLessons}</b><span>Уроків всього</span></div>
      <div class="stat-card"><b>${completedLessons}</b><span>Проведено</span></div>
      <div class="stat-card"><b>${totalPaid} грн</b><span>Отримано оплат</span></div>
    </div>
    <table class="report-table">
      <thead><tr><th>Учень</th><th>Уроків</th><th>Проведено</th><th>Не оплачено</th><th>Сума оплат</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;

  renderReportIssues();
}

function renderReportIssues() {
  const issues = [];

  state.lessons.forEach(l => {
    const student = state.students.find(s => String(s.id) === String(l.studentId));
    const label = `${formatDateDisplay(l.date)}, ${l.time || ''}${student ? ' — ' + student.name : ''}`;

    if (!student) issues.push(`Урок (${label}): учня не знайдено (можливо, видалений).`);
    if (isPastDate(l.date) && l.status === 'planned') issues.push(`Урок (${label}): дата вже минула, але урок не позначено як "Відбувся".`);
    if (l.status === 'completed' && !l.topic) issues.push(`Урок (${label}): не вказано тему уроку.`);
  });

  state.students.forEach(s => {
    const missing = [];
    if (!s.grade) missing.push('клас');
    if (!s.phone) missing.push('телефон учня');
    if (!s.parentName) missing.push("ім'я батьків");
    if (!s.parentPhone) missing.push('телефон батьків');
    if (missing.length > 0) issues.push(`Учень "${s.name}": не заповнено — ${missing.join(', ')}.`);
  });

  elements.reportIssues.innerHTML = '';
  if (issues.length === 0) {
    const ok = document.createElement('div');
    ok.className = 'issue-item ok';
    ok.textContent = '✓ Помилок та незаповнених полів не знайдено.';
    elements.reportIssues.appendChild(ok);
    return;
  }

  issues.forEach(msg => {
    const el = document.createElement('div');
    el.className = 'issue-item';
    el.textContent = msg;
    elements.reportIssues.appendChild(el);
  });
}

// ===================== ЗАГАЛЬНЕ ПОСИЛАННЯ ДЛЯ УЧНІВ =====================

function buildStudentScheduleLink() {
  const base = window.location.href.replace(/[^/]*$/, '') + 'student-schedule.html';
  const url = new URL(base, window.location.href);
  url.searchParams.set('key', state.key);
  return url.toString();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    try {
      document.execCommand('copy');
      return true;
    } catch (e2) {
      return false;
    }
  }
}

// ===================== СВАЙП-НАВІГАЦІЯ (МОБІЛЬНІ) =====================

function setupSwipeNavigation() {
  let touchStartX = 0, touchStartY = 0, touchActive = false;

  elements.calendarGrid.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchActive = true;
  }, { passive: true });

  elements.calendarGrid.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) elements.nextBtn.click();
      else elements.prevBtn.click();
    }
  }, { passive: true });
}

// ===================== ОБРОБНИКИ ПОДІЙ =====================

function setupEventListeners() {
  elements.themeToggleBtn.onclick = () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  };

  elements.settingsBtn.onclick = () => elements.settingsModal.classList.remove('hidden');
  elements.closeSettingsModalBtn.onclick = () => elements.settingsModal.classList.add('hidden');

  elements.editModeCheckbox.onchange = (e) => {
    state.isEditMode = e.target.checked;
    render();
  };

  elements.modalAddLessonBtn.onclick = () => {
    elements.settingsModal.classList.add('hidden');
    openAddLessonModal();
  };

  elements.modalManageStudentsBtn.onclick = () => {
    elements.settingsModal.classList.add('hidden');
    renderStudentsList();
    elements.studentsModal.classList.remove('hidden');
  };

  elements.modalRequestsBtn.onclick = () => {
    elements.settingsModal.classList.add('hidden');
    renderRequestsList();
    elements.requestsModal.classList.remove('hidden');
  };
  elements.closeRequestsModalBtn.onclick = () => elements.requestsModal.classList.add('hidden');

  elements.modalReportsBtn.onclick = () => {
    elements.settingsModal.classList.add('hidden');
    elements.reportOutput.innerHTML = '';
    renderReportIssues();
    elements.reportsModal.classList.remove('hidden');
  };

  elements.modalAuditLogBtn.onclick = () => {
    elements.settingsModal.classList.add('hidden');
    renderAuditLog();
    elements.auditLogModal.classList.remove('hidden');
  };
  elements.closeAuditLogModalBtn.onclick = () => elements.auditLogModal.classList.add('hidden');

  elements.modalBackupsBtn.onclick = () => {
    elements.settingsModal.classList.add('hidden');
    renderBackupsList();
    elements.backupsModal.classList.remove('hidden');
  };
  elements.closeBackupsModalBtn.onclick = () => elements.backupsModal.classList.add('hidden');

  elements.modalStudentLinkBtn.onclick = () => {
    elements.settingsModal.classList.add('hidden');
    elements.studentLinkInput.value = buildStudentScheduleLink();
    elements.studentLinkModal.classList.remove('hidden');
  };
  elements.copyStudentLinkBtn.onclick = async () => {
    const ok = await copyToClipboard(elements.studentLinkInput.value);
    showToast(ok ? 'Посилання скопійовано.' : 'Не вдалося скопіювати посилання.', ok ? 'success' : 'error');
  };
  elements.closeStudentLinkModalBtn.onclick = () => elements.studentLinkModal.classList.add('hidden');

  elements.studentInfoCopyLinkBtn.onclick = async () => {
    const ok = await copyToClipboard(elements.studentInfoLinkInput.value);
    showToast(ok ? 'Персональне посилання скопійовано.' : 'Не вдалося скопіювати посилання.', ok ? 'success' : 'error');
  };

  elements.studentsInfoBtn.onclick = () => {
    renderStudentsPickerList();
    elements.studentsPickerModal.classList.remove('hidden');
  };
  elements.closeStudentsPickerModalBtn.onclick = () => elements.studentsPickerModal.classList.add('hidden');
  elements.closeStudentInfoModalBtn.onclick = () => elements.studentInfoModal.classList.add('hidden');
  elements.studentInfoHistoryBtn.onclick = () => {
    if (state.currentInfoStudentId) renderStudentCompletedLessons(state.currentInfoStudentId);
  };
  elements.studentInfoPlannedBtn.onclick = () => {
    if (state.currentInfoStudentId) renderStudentPlannedLessons(state.currentInfoStudentId);
  };

  elements.reportPeriodSelect.onchange = () => {
    elements.reportCustomRange.style.display = elements.reportPeriodSelect.value === 'custom' ? 'flex' : 'none';
  };
  elements.generateReportBtn.onclick = () => generateReport();
  elements.closeReportsModalBtn.onclick = () => elements.reportsModal.classList.add('hidden');

  elements.closeStudentsModalBtn.onclick = () => elements.studentsModal.classList.add('hidden');

  elements.lessonPaidSelect.onchange = () => {
    togglePaymentDetailsVisibility();
    if (elements.lessonPaidSelect.value === 'true' && !elements.lessonPaidDate.value) {
      elements.lessonPaidDate.value = elements.lessonDateInput.value || formatDateISO(new Date());
    }
  };

  elements.addStudentBtn.onclick = async () => {
    const name = elements.newStudentName.value.trim();
    if (!name) {
      showToast("Будь ласка, введіть ім'я учня!", 'error');
      return;
    }

    state.students.push({
      id: Date.now().toString(),
      name,
      grade: elements.newStudentGrade.value.trim(),
      phone: elements.newStudentPhone.value.trim(),
      parentName: elements.newStudentParentName.value.trim(),
      parentPhone: elements.newStudentParentPhone.value.trim(),
      color: state.selectedNewStudentColor
    });

    logAudit('Викладач', `Додано учня "${name}"`);

    elements.newStudentName.value = '';
    elements.newStudentGrade.value = '';
    elements.newStudentPhone.value = '';
    elements.newStudentParentName.value = '';
    elements.newStudentParentPhone.value = '';
    await saveSchedule();
    render();
    renderStudentsList();
    showToast('Учня додано.', 'success');
  };

  elements.closeLessonModalBtn.onclick = () => elements.lessonModal.classList.add('hidden');

  elements.saveLessonBtn.onclick = async () => {
    const studentId = String(elements.lessonStudentSelect.value);
    const baseDateStr = elements.lessonDateInput.value;
    const hour = elements.lessonHourSelect.value;
    const minute = elements.lessonMinuteSelect.value;
    const paid = elements.lessonPaidSelect.value === 'true';
    const status = elements.lessonStatusSelect.value;
    const topic = elements.lessonTopicInput.value.trim();
    const homework = elements.lessonHomeworkInput.value.trim();
    const paidAmount = paid ? (parseFloat(elements.lessonPaidAmount.value) || 0) : null;
    const paidDate = paid ? (elements.lessonPaidDate.value || baseDateStr) : null;
    const paidMethod = paid ? (elements.lessonPaidMethod.value || DEFAULT_PAID_METHOD) : null;

    if (!studentId || !baseDateStr) {
      showToast('Заповніть усі поля!', 'error');
      return;
    }

    const time = `${hour}:${minute}`;
    const student = state.students.find(s => String(s.id) === studentId);

    if (state.editingLessonId) {
      const lesson = state.lessons.find(l => String(l.id) === String(state.editingLessonId));
      if (lesson) {
        if (isPastDate(lesson.date) && !state.isEditMode) {
          showToast('Зміна розкладу для минулої дати доступна лише через Налаштування.', 'error');
          return;
        }
        lesson.studentId = studentId;
        lesson.date = baseDateStr;
        lesson.time = time;
        lesson.paid = paid;
        lesson.status = status;
        lesson.topic = topic;
        lesson.homework = homework;
        lesson.paidAmount = paidAmount;
        lesson.paidDate = paidDate;
        lesson.paidMethod = paidMethod;
        logAudit('Викладач', `Змінено урок ${student ? student.name : ''} (${baseDateStr} ${time})`);
      }
    } else {
      const repeatCount = parseInt(elements.lessonRepeatSelect.value, 10) || 1;
      const [y, m, d] = baseDateStr.split('-').map(Number);

      for (let i = 0; i < repeatCount; i++) {
        const targetDate = new Date(y, m - 1, d + (i * 7));
        state.lessons.push({
          id: `${Date.now()}_${i}`,
          studentId, date: formatDateISO(targetDate), time, paid, status, topic, homework, paidAmount, paidDate, paidMethod
        });
      }
      logAudit('Викладач', `Додано урок(и) ${student ? student.name : ''} на ${baseDateStr} ${time}${repeatCount > 1 ? ` (${repeatCount} тижні поспіль)` : ''}`);
    }

    await saveSchedule();
    elements.lessonModal.classList.add('hidden');
    render();
  };

  elements.deleteLessonBtn.onclick = async () => {
    if (!state.editingLessonId) return;
    const lesson = state.lessons.find(l => String(l.id) === String(state.editingLessonId));
    if (!lesson) return;

    if (!state.isEditMode) {
      showToast('Видалення уроків доступне лише в режимі редагування (Налаштування).', 'error');
      return;
    }
    if (lesson.status !== 'planned') {
      showToast('Видаляти можна лише заплановані уроки.', 'error');
      return;
    }

    const confirmed = await showConfirm('Видалити цей урок?');
    if (confirmed) {
      const student = state.students.find(s => String(s.id) === String(lesson.studentId));
      state.lessons = state.lessons.filter(l => String(l.id) !== String(state.editingLessonId));
      logAudit('Викладач', `Видалено урок ${student ? student.name : ''} (${lesson.date} ${lesson.time})`);
      await saveSchedule();
      elements.lessonModal.classList.add('hidden');
      render();
      showToast('Урок видалено.', 'success');
    }
  };

  elements.viewDayBtn.onclick = () => { state.view = 'day'; render(); };
  elements.viewWeekBtn.onclick = () => { state.view = 'week'; render(); };
  elements.viewMonthBtn.onclick = () => { state.view = 'month'; render(); };

  elements.todayBtn.onclick = () => { state.currentDate = new Date(); render(); };

  elements.prevBtn.onclick = () => {
    if (state.view === 'day') state.currentDate.setDate(state.currentDate.getDate() - 1);
    else if (state.view === 'week') state.currentDate.setDate(state.currentDate.getDate() - 7);
    else if (state.view === 'month') {
      const y = state.currentDate.getFullYear();
      const m = state.currentDate.getMonth();
      state.currentDate = new Date(y, m - 1, 1);
    }
    render();
  };

  elements.nextBtn.onclick = () => {
    if (state.view === 'day') state.currentDate.setDate(state.currentDate.getDate() + 1);
    else if (state.view === 'week') state.currentDate.setDate(state.currentDate.getDate() + 7);
    else if (state.view === 'month') {
      const y = state.currentDate.getFullYear();
      const m = state.currentDate.getMonth();
      state.currentDate = new Date(y, m + 1, 1);
    }
    render();
  };
}
