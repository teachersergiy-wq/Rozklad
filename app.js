const SUPABASE_URL = "https://vjjrwvraannccejyqcci.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XYvCzMPGQjhT0AT2r2v3dw_zZIesIJB";

const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

// 7 вказаних ненасичених пастельних кольорів
const PASTEL_COLORS = [
  '#f5f5f4', // Світло-сірий
  '#fce7f3', // Ніжно-рожевий
  '#ccfbf1', // Ніжно-м'ятний
  '#dbeafe', // Ніжно-блакитний
  '#fef3c7', // Ніжно-жовтий
  '#ffe4e6', // Ніжно-персиковий
  '#e0f2fe'  // Небесно-голубий
];

const MONTH_NAMES_SHORT = ['січ.', 'лют.', 'берез.', 'квіт.', 'трав.', 'черв.', 'лип.', 'серп.', 'верес.', 'жовт.', 'лист.', 'груд.'];
const DAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

let state = {
  key: null,
  students: [],
  lessons: [],
  blockedSlots: [], // {id, date, time} — недоступні слоти
  currentDate: new Date(),
  view: 'day',
  isEditMode: false,
  editingLessonId: null,
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
  
  settingsBtn: document.getElementById('settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  closeSettingsModalBtn: document.getElementById('close-settings-modal-btn'),
  modalAddLessonBtn: document.getElementById('modal-add-lesson-btn'),
  modalManageStudentsBtn: document.getElementById('modal-manage-students-btn'),
  editModeCheckbox: document.getElementById('edit-mode-checkbox'),
  
  studentsModal: document.getElementById('students-modal'),
  closeStudentsModalBtn: document.getElementById('close-students-modal-btn'),
  newStudentName: document.getElementById('new-student-name'),
  newStudentSwatches: document.getElementById('new-student-swatches'),
  addStudentBtn: document.getElementById('add-student-btn'),
  studentsList: document.getElementById('students-list'),

  lessonModal: document.getElementById('lesson-modal'),
  lessonModalTitle: document.getElementById('lesson-modal-title'),
  closeLessonModalBtn: document.getElementById('close-lesson-modal-btn'),
  saveLessonBtn: document.getElementById('save-lesson-btn'),
  deleteLessonBtn: document.getElementById('delete-lesson-btn'),
  lessonStudentSelect: document.getElementById('lesson-student-select'),
  lessonDateInput: document.getElementById('lesson-date-input'),
  lessonHourSelect: document.getElementById('lesson-hour-select'),
  lessonMinuteSelect: document.getElementById('lesson-minute-select'),
  lessonPaidSelect: document.getElementById('lesson-paid-select'),
  lessonStatusSelect: document.getElementById('lesson-status-select'),
  lessonRepeatSelect: document.getElementById('lesson-repeat-select'),
  repeatGroup: document.getElementById('repeat-group'),
  lessonTopicInput: document.getElementById('lesson-topic-input'),
  lessonHomeworkInput: document.getElementById('lesson-homework-input'),
  paymentFields: document.getElementById('payment-fields'),
  lessonAmountInput: document.getElementById('lesson-amount-input'),
  lessonPaymentDateInput: document.getElementById('lesson-payment-date-input'),
  lessonPaymentMethodSelect: document.getElementById('lesson-payment-method-select'),

  historyModal: document.getElementById('history-modal'),
  historyModalTitle: document.getElementById('history-modal-title'),
  historyList: document.getElementById('history-list'),
  closeHistoryModalBtn: document.getElementById('close-history-modal-btn')
};

document.addEventListener('DOMContentLoaded', async () => {
  initTimeOptions();
  setupEventListeners();

  const urlParams = new URLSearchParams(window.location.search);
  state.key = urlParams.get('key') || 'default_schedule';

  await loadSchedule();
  sanitizeState();
  renderNewStudentSwatches();
  render();
});

window.addEventListener('resize', () => {
  if (state.view === 'week') render();
});

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

  state.students.forEach((s, idx) => {
    s.id = s.id ? String(s.id) : String(Date.now() + idx);
    s.name = s.name || `Учень ${idx + 1}`;
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
    l.paymentAmount = (typeof l.paymentAmount === 'number') ? l.paymentAmount : 175;
    l.paymentDate = l.paymentDate || '';
    l.paymentMethod = l.paymentMethod || 'МоноБанк';
  });

  state.blockedSlots.forEach((b, idx) => {
    b.id = b.id ? String(b.id) : String('b_' + Date.now() + '_' + idx);
    b.date = b.date || '';
    b.time = b.time || '00:00';
  });
}

async function loadSchedule() {
  let loaded = false;

  if (db && state.key) {
    try {
      const { data, error } = await db.rpc('get_schedule', { p_access_token: state.key });
      if (!error && data && data.data) {
        state.students = data.data.students || [];
        state.lessons = data.data.lessons || [];
        state.blockedSlots = data.data.blockedSlots || [];
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
        const parsed = JSON.parse(local);
        state.students = parsed.students || [];
        state.lessons = parsed.lessons || [];
        state.blockedSlots = parsed.blockedSlots || [];
      } catch (e) { console.error(e); }
    }
  }
}

async function saveSchedule() {
  sanitizeState();
  const payload = {
    students: state.students,
    lessons: state.lessons,
    blockedSlots: state.blockedSlots
  };
  localStorage.setItem('schedule_' + state.key, JSON.stringify(payload));

  if (db && state.key) {
    try {
      await db.rpc('save_schedule', {
        p_access_token: state.key,
        p_data: payload
      });
    } catch (e) {
      console.warn('Saved to LocalStorage.');
    }
  }
}

function isPastDate(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d < today;
}

function canEditDate(dateStr) {
  return state.isEditMode || !isPastDate(dateStr);
}

function render() {
  updateDateDisplay();
  updateViewButtons();
  renderStudentsList();
  updateStudentSelectOptions();
  renderGrid();
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
  if (state.view === 'day') {
    elements.currentDateDisplay.textContent = state.currentDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
  } else if (state.view === 'week') {
    const start = getStartOfWeek(state.currentDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    elements.currentDateDisplay.textContent = `${start.getDate()} ${start.toLocaleDateString('uk-UA', {month:'short'})} - ${end.getDate()} ${end.toLocaleDateString('uk-UA', {month:'short'})}`;
  } else if (state.view === 'month') {
    elements.currentDateDisplay.textContent = state.currentDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
  }
}

function renderStudentsList() {
  elements.studentsList.innerHTML = '';
  if (state.students.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = 'color:#64748b; font-size:0.88rem; text-align:center; padding:12px;';
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
    nameInput.style.cssText = 'flex:1; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-weight:600; font-size:0.9rem; color:#1e293b; min-width:120px;';
    nameInput.onchange = async (e) => {
      const val = e.target.value.trim();
      if (val) {
        student.name = val;
        await saveSchedule();
        render();
      }
    };

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap;';

    const historyBtn = document.createElement('button');
    historyBtn.type = 'button';
    historyBtn.textContent = 'Історія';
    historyBtn.style.cssText = 'padding:6px 10px; font-size:0.8rem;';
    historyBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openStudentHistory(student.id);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger';
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Видалити';
    deleteBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (confirm(`Видалити учня "${student.name}" та всі його уроки?`)) {
        const studentIdStr = String(student.id);
        state.students = state.students.filter(s => String(s.id) !== studentIdStr);
        state.lessons = state.lessons.filter(l => String(l.studentId) !== studentIdStr);
        await saveSchedule();
        render();
      }
    };

    actions.appendChild(historyBtn);
    actions.appendChild(deleteBtn);

    headerRow.appendChild(nameInput);
    headerRow.appendChild(actions);

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
      };
      swatchesDiv.appendChild(dot);
    });

    item.appendChild(headerRow);
    item.appendChild(swatchesDiv);

    elements.studentsList.appendChild(item);
  });
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

function isBlocked(dateISO, timeStr) {
  return state.blockedSlots.some(b => b.date === dateISO && b.time === timeStr);
}

function renderGrid() {
  elements.calendarGrid.innerHTML = '';

  if (state.view === 'month') {
    renderMonthView();
    return;
  }

  const isMobile = window.innerWidth <= 640;

  if (state.view === 'week' && isMobile) {
    renderWeekViewMobile();
    return;
  }

  const isWeek = state.view === 'week';
  elements.calendarGrid.className = `calendar-grid ${isWeek ? 'grid-week-desktop' : 'grid-day'}`;

  const daysCount = isWeek ? 7 : 1;
  const startOfWeek = getStartOfWeek(state.currentDate);
  const daysDates = [];

  for (let i = 0; i < daysCount; i++) {
    const date = isWeek ? new Date(startOfWeek) : new Date(state.currentDate);
    if (isWeek) date.setDate(startOfWeek.getDate() + i);
    daysDates.push(date);

    const header = createDayHeaderElement(date);
    elements.calendarGrid.appendChild(header);
  }

  renderTimeSlotsForDays(elements.calendarGrid, daysDates);
}

function renderWeekViewMobile() {
  elements.calendarGrid.className = 'calendar-grid';

  const startOfWeek = getStartOfWeek(state.currentDate);
  const daysDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    daysDates.push(d);
  }

  const dayChunks = [];
  for (let i = 0; i < daysDates.length; i += 2) {
    dayChunks.push(daysDates.slice(i, i + 2));
  }

  dayChunks.forEach(chunk => {
    const block = document.createElement('div');
    block.className = `calendar-grid grid-week-mobile-block ${chunk.length === 1 ? 'single-day' : ''}`;

    chunk.forEach(date => {
      const header = createDayHeaderElement(date);
      block.appendChild(header);
    });

    renderTimeSlotsForDays(block, chunk);
    elements.calendarGrid.appendChild(block);
  });
}

function renderTimeSlotsForDays(container, daysDates) {
  // Базовий діапазон: у режимі налаштування з 9:00, інакше з 17:00 до 21:00
  const baseStart = state.isEditMode ? 9 : 17;
  const baseEnd = 21;

  const hoursSet = new Set();
  for (let h = baseStart; h <= baseEnd; h++) {
    hoursSet.add(h);
  }

  // Додаємо години з існуючих уроків і blocked
  daysDates.forEach(date => {
    const dateISO = formatDateISO(date);
    state.lessons.forEach(l => {
      if (l.date === dateISO) {
        const lHour = parseInt((l.time || '00:00').split(':')[0], 10);
        if (!isNaN(lHour)) hoursSet.add(lHour);
      }
    });
    state.blockedSlots.forEach(b => {
      if (b.date === dateISO) {
        const bHour = parseInt((b.time || '00:00').split(':')[0], 10);
        if (!isNaN(bHour)) hoursSet.add(bHour);
      }
    });
  });

  const sortedHours = Array.from(hoursSet).sort((a, b) => a - b);

  // Без окремого стовпця годин — час всередині кожного слота
  sortedHours.forEach(h => {
    const timeStr = `${String(h).padStart(2, '0')}:00`;

    daysDates.forEach(date => {
      const dateISO = formatDateISO(date);
      const slot = document.createElement('div');
      slot.className = 'time-slot';

      const slotLessons = state.lessons.filter(l => {
        if (l.date !== dateISO) return false;
        const lHour = parseInt((l.time || '00:00').split(':')[0], 10);
        return lHour === h;
      });

      const blocked = isBlocked(dateISO, timeStr);

      // Unavailable: показуємо тільки в режимі День або в режимі налаштування
      const showUnavailable = state.view === 'day' || state.isEditMode;

      if (slotLessons.length > 0) {
        // Зайнято учнем
        slotLessons.forEach(lesson => {
          const card = createLessonCard(lesson);
          slot.appendChild(card);
        });
      } else if (blocked) {
        if (showUnavailable) {
          const unavail = document.createElement('div');
          unavail.className = 'slot-unavailable';
          unavail.textContent = `${timeStr} *недоступно*`;
          unavail.title = 'Натисніть, щоб зняти блокування (тільки в режимі налаштування)';
          if (state.isEditMode && canEditDate(dateISO)) {
            unavail.style.cursor = 'pointer';
            unavail.onclick = async () => {
              if (confirm('Зняти блокування цього слота?')) {
                state.blockedSlots = state.blockedSlots.filter(b => !(b.date === dateISO && b.time === timeStr));
                await saveSchedule();
                render();
              }
            };
          }
          slot.appendChild(unavail);
        }
        // Інакше (тиждень/місяць без edit) — слот порожній, нічого не додаємо
      } else {
        // Вільний слот
        const isBaseFreeHour = h >= baseStart && h <= baseEnd;
        const freeSlot = document.createElement('div');
        freeSlot.className = `slot-free ${!isBaseFreeHour ? 'out-of-range' : ''}`;
        freeSlot.textContent = isBaseFreeHour ? `${timeStr} Вільно` : timeStr;

        // Drag & drop тільки якщо можна редагувати дату
        if (canEditDate(dateISO)) {
          freeSlot.ondragover = (e) => { e.preventDefault(); freeSlot.classList.add('drag-over'); };
          freeSlot.ondragleave = () => freeSlot.classList.remove('drag-over');
          freeSlot.ondrop = async (e) => {
            e.preventDefault();
            freeSlot.classList.remove('drag-over');
            const lessonId = e.dataTransfer.getData('text/plain');
            await moveLesson(lessonId, dateISO, timeStr);
          };
        }

        // В режимі налаштування можна заблокувати слот
        if (state.isEditMode && canEditDate(dateISO) && isBaseFreeHour) {
          freeSlot.title = 'Клік — зробити недоступним';
          freeSlot.style.cursor = 'pointer';
          freeSlot.onclick = async (e) => {
            // Не спрацьовувати якщо це був drop
            if (e.defaultPrevented) return;
            state.blockedSlots.push({
              id: 'b_' + Date.now(),
              date: dateISO,
              time: timeStr
            });
            await saveSchedule();
            render();
          };
        }

        slot.appendChild(freeSlot);
      }

      container.appendChild(slot);
    });
  });
}

function createLessonCard(lesson) {
  const student = state.students.find(s => String(s.id) === String(lesson.studentId));
  const card = document.createElement('div');
  card.className = 'lesson-card';
  card.style.backgroundColor = student ? (student.color || PASTEL_COLORS[0]) : '#f5f5f4';
  card.style.color = '#1e293b';
  card.draggable = canEditDate(lesson.date);

  const isPaid = lesson.paid === true || lesson.paid === 'true';
  const isCompleted = lesson.status === 'completed';

  const topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:flex-start; gap:4px;';

  const titleSpan = document.createElement('span');
  titleSpan.style.cssText = 'font-weight:700; font-size:0.83rem; color:#1e293b; line-height:1.2; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
  titleSpan.textContent = `${lesson.time || ''} ${student ? student.name : 'Учень'}`;

  // Більше немає хрестика видалення на картці
  topRow.appendChild(titleSpan);

  const badgesRow = document.createElement('div');
  badgesRow.className = 'lesson-badges';

  const paidBadge = document.createElement('span');
  paidBadge.className = 'badge';
  paidBadge.style.backgroundColor = isPaid ? '#dcfce7' : '#fee2e2';
  paidBadge.style.color = isPaid ? '#15803d' : '#991b1b';
  paidBadge.textContent = isPaid ? 'Оплачено' : 'Не опл.';

  const statusBadge = document.createElement('span');
  statusBadge.className = 'badge';
  statusBadge.style.backgroundColor = isCompleted ? '#e2e8f0' : '#dbeafe';
  statusBadge.style.color = isCompleted ? '#334155' : '#1d4ed8';
  statusBadge.textContent = isCompleted ? 'Відбувся' : 'Заплан.';

  badgesRow.appendChild(paidBadge);
  badgesRow.appendChild(statusBadge);

  if (lesson.topic) {
    const topicSpan = document.createElement('div');
    topicSpan.style.cssText = 'font-size:0.72rem; color:#475569; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    topicSpan.textContent = lesson.topic;
    card.appendChild(topRow);
    card.appendChild(topicSpan);
    card.appendChild(badgesRow);
  } else {
    card.appendChild(topRow);
    card.appendChild(badgesRow);
  }

  card.onclick = () => {
    if (canEditDate(lesson.date) || state.isEditMode) {
      openEditLessonModal(lesson.id);
    } else {
      // Тільки перегляд інформації для минулих дат без режиму налаштування
      openEditLessonModal(lesson.id, true);
    }
  };

  card.ondragstart = (e) => {
    if (!canEditDate(lesson.date)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', String(lesson.id));
  };

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

    // У місяці показуємо тільки зайняті уроки (не blocked)
    const dayLessons = state.lessons.filter(l => l.date === dateISO);
    dayLessons.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    dayLessons.forEach(l => {
      const s = state.students.find(st => String(st.id) === String(l.studentId));
      const badge = document.createElement('div');
      badge.className = 'month-lesson-badge';
      badge.style.backgroundColor = s ? (s.color || PASTEL_COLORS[0]) : '#f5f5f4';

      const isPaid = l.paid === true || l.paid === 'true';
      const isCompleted = l.status === 'completed';

      let indicatorsHTML = '';
      if (isPaid) {
        indicatorsHTML += '<span style="color:#15803d; font-weight:800; font-size:0.85rem;" title="Оплачено">$</span>';
      }
      if (isCompleted) {
        indicatorsHTML += '<span style="color:#16a34a; font-weight:800; font-size:0.85rem;" title="Відбувся">✓</span>';
      }

      const textSpan = document.createElement('span');
      textSpan.style.cssText = 'overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#1e293b; font-weight:600;';
      textSpan.innerHTML = `<strong>${l.time || ''}</strong> ${s ? s.name : ''}`;

      const iconSpan = document.createElement('span');
      iconSpan.style.cssText = 'display:flex; align-items:center; gap:2px; flex-shrink:0;';
      iconSpan.innerHTML = indicatorsHTML;

      badge.appendChild(textSpan);
      badge.appendChild(iconSpan);

      badge.onclick = (e) => {
        e.stopPropagation();
        if (canEditDate(l.date) || state.isEditMode) {
          openEditLessonModal(l.id);
        } else {
          openEditLessonModal(l.id, true);
        }
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
  if (!canEditDate(newDate)) {
    alert('Не можна змінювати розклад за минулу дату. Увімкніть режим налаштування.');
    return;
  }
  const lesson = state.lessons.find(l => String(l.id) === String(lessonId));
  if (lesson) {
    // Перевірка чи цільовий слот не зайнятий і не blocked
    if (isBlocked(newDate, newTime)) {
      alert('Цей слот позначено як недоступний.');
      return;
    }
    const occupied = state.lessons.some(l => l.date === newDate && l.time === newTime && String(l.id) !== String(lessonId));
    if (occupied) {
      alert('Цей слот вже зайнятий.');
      return;
    }
    lesson.date = newDate;
    lesson.time = newTime;
    await saveSchedule();
    render();
  }
}

function togglePaymentFields() {
  const isPaid = elements.lessonPaidSelect.value === 'true';
  if (isPaid) {
    elements.paymentFields.classList.remove('hidden');
    if (!elements.lessonPaymentDateInput.value) {
      elements.lessonPaymentDateInput.value = formatDateISO(new Date());
    }
    if (!elements.lessonAmountInput.value) {
      elements.lessonAmountInput.value = 175;
    }
  } else {
    elements.paymentFields.classList.add('hidden');
  }
}

function openEditLessonModal(lessonId, readOnly = false) {
  const lesson = state.lessons.find(l => String(l.id) === String(lessonId));
  if (!lesson) return;

  state.editingLessonId = String(lessonId);
  elements.lessonModalTitle.textContent = readOnly ? 'Перегляд уроку' : 'Редагувати урок';

  updateStudentSelectOptions();
  elements.lessonStudentSelect.value = String(lesson.studentId);
  elements.lessonDateInput.value = lesson.date;

  const parts = (lesson.time || '18:00').split(':');
  elements.lessonHourSelect.value = String(parts[0]).padStart(2, '0');
  elements.lessonMinuteSelect.value = String(parts[1] || '00').padStart(2, '0');

  elements.lessonPaidSelect.value = String(lesson.paid);
  elements.lessonStatusSelect.value = lesson.status || 'planned';
  elements.lessonTopicInput.value = lesson.topic || '';
  elements.lessonHomeworkInput.value = lesson.homework || '';
  elements.lessonAmountInput.value = lesson.paymentAmount || 175;
  elements.lessonPaymentDateInput.value = lesson.paymentDate || formatDateISO(new Date());
  elements.lessonPaymentMethodSelect.value = lesson.paymentMethod || 'МоноБанк';

  togglePaymentFields();

  elements.repeatGroup.style.display = 'none';

  // Кнопка видалення — тільки для запланованих і якщо можна редагувати
  const canDelete = !readOnly && lesson.status === 'planned' && canEditDate(lesson.date);
  elements.deleteLessonBtn.style.display = canDelete ? 'inline-block' : 'none';

  // Блокуємо поля якщо readOnly
  const inputs = [
    elements.lessonStudentSelect, elements.lessonDateInput,
    elements.lessonHourSelect, elements.lessonMinuteSelect,
    elements.lessonPaidSelect, elements.lessonStatusSelect,
    elements.lessonTopicInput, elements.lessonHomeworkInput,
    elements.lessonAmountInput, elements.lessonPaymentDateInput,
    elements.lessonPaymentMethodSelect
  ];
  inputs.forEach(el => { el.disabled = readOnly; });
  elements.saveLessonBtn.style.display = readOnly ? 'none' : 'inline-block';

  elements.lessonModal.classList.remove('hidden');
}

function openAddLessonModal() {
  if (state.students.length === 0) {
    alert('Спочатку додайте хоча б одного учня!');
    elements.studentsModal.classList.remove('hidden');
    return;
  }
  state.editingLessonId = null;
  elements.lessonModalTitle.textContent = 'Додати урок';
  updateStudentSelectOptions();
  elements.lessonDateInput.value = formatDateISO(state.currentDate);
  elements.lessonHourSelect.value = '18';
  elements.lessonMinuteSelect.value = '00';
  elements.lessonPaidSelect.value = 'false';
  elements.lessonStatusSelect.value = 'planned';
  elements.lessonTopicInput.value = '';
  elements.lessonHomeworkInput.value = '';
  elements.lessonAmountInput.value = 175;
  elements.lessonPaymentDateInput.value = formatDateISO(new Date());
  elements.lessonPaymentMethodSelect.value = 'МоноБанк';
  togglePaymentFields();
  elements.repeatGroup.style.display = 'block';
  elements.deleteLessonBtn.style.display = 'none';

  const inputs = [
    elements.lessonStudentSelect, elements.lessonDateInput,
    elements.lessonHourSelect, elements.lessonMinuteSelect,
    elements.lessonPaidSelect, elements.lessonStatusSelect,
    elements.lessonTopicInput, elements.lessonHomeworkInput,
    elements.lessonAmountInput, elements.lessonPaymentDateInput,
    elements.lessonPaymentMethodSelect
  ];
  inputs.forEach(el => { el.disabled = false; });
  elements.saveLessonBtn.style.display = 'inline-block';

  elements.lessonModal.classList.remove('hidden');
}

function openStudentHistory(studentId) {
  const student = state.students.find(s => String(s.id) === String(studentId));
  if (!student) return;

  elements.historyModalTitle.textContent = `Історія уроків: ${student.name}`;
  elements.historyList.innerHTML = '';

  const studentLessons = state.lessons
    .filter(l => String(l.studentId) === String(studentId))
    .sort((a, b) => {
      const d = (b.date || '').localeCompare(a.date || '');
      if (d !== 0) return d;
      return (b.time || '').localeCompare(a.time || '');
    });

  if (studentLessons.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:#64748b; text-align:center; padding:16px;';
    empty.textContent = 'Уроків ще немає.';
    elements.historyList.appendChild(empty);
  } else {
    studentLessons.forEach(l => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const isPaid = l.paid === true || l.paid === 'true';
      const statusText = l.status === 'completed' ? 'Відбувся' : 'Запланований';

      let html = `<strong>${l.date} ${l.time || ''}</strong> — ${statusText}<br>`;
      if (l.topic) html += `Тема: ${l.topic}<br>`;
      if (l.homework) html += `ДЗ: ${l.homework}<br>`;
      html += `Оплата: ${isPaid ? 'Так' : 'Ні'}`;
      if (isPaid) {
        html += ` • ${l.paymentAmount || 175} грн`;
        if (l.paymentMethod) html += ` (${l.paymentMethod})`;
        if (l.paymentDate) html += ` від ${l.paymentDate}`;
      }

      item.innerHTML = html;
      item.style.cursor = 'pointer';
      item.onclick = () => {
        elements.historyModal.classList.add('hidden');
        openEditLessonModal(l.id, !canEditDate(l.date) && !state.isEditMode);
      };
      elements.historyList.appendChild(item);
    });
  }

  elements.historyModal.classList.remove('hidden');
}

function setupEventListeners() {
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
    elements.studentsModal.classList.remove('hidden');
  };

  elements.closeStudentsModalBtn.onclick = () => elements.studentsModal.classList.add('hidden');

  elements.addStudentBtn.onclick = async () => {
    const name = elements.newStudentName.value.trim();
    if (!name) {
      alert("Будь ласка, введіть ім'я учня!");
      return;
    }

    state.students.push({
      id: Date.now().toString(),
      name,
      color: state.selectedNewStudentColor
    });

    elements.newStudentName.value = '';
    await saveSchedule();
    render();
  };

  elements.closeLessonModalBtn.onclick = () => {
    elements.lessonModal.classList.add('hidden');
  };

  elements.lessonPaidSelect.onchange = togglePaymentFields;

  elements.deleteLessonBtn.onclick = async () => {
    if (!state.editingLessonId) return;
    const lesson = state.lessons.find(l => String(l.id) === String(state.editingLessonId));
    if (!lesson) return;
    if (lesson.status !== 'planned') {
      alert('Видаляти можна лише заплановані уроки.');
      return;
    }
    if (!canEditDate(lesson.date)) {
      alert('Не можна видаляти уроки за минулу дату без режиму налаштування.');
      return;
    }
    if (confirm('Видалити цей урок?')) {
      state.lessons = state.lessons.filter(l => String(l.id) !== String(state.editingLessonId));
      await saveSchedule();
      elements.lessonModal.classList.add('hidden');
      render();
    }
  };

  elements.saveLessonBtn.onclick = async () => {
    const studentId = String(elements.lessonStudentSelect.value);
    const baseDateStr = elements.lessonDateInput.value;
    const hour = elements.lessonHourSelect.value;
    const minute = elements.lessonMinuteSelect.value;
    const paid = elements.lessonPaidSelect.value === 'true';
    const status = elements.lessonStatusSelect.value;
    const topic = elements.lessonTopicInput.value.trim();
    const homework = elements.lessonHomeworkInput.value.trim();
    const paymentAmount = parseFloat(elements.lessonAmountInput.value) || 175;
    const paymentDate = elements.lessonPaymentDateInput.value || formatDateISO(new Date());
    const paymentMethod = elements.lessonPaymentMethodSelect.value || 'МоноБанк';

    if (!studentId || !baseDateStr) {
      alert('Заповніть усі обов\'язкові поля!');
      return;
    }

    if (!canEditDate(baseDateStr)) {
      alert('Не можна змінювати розклад за минулу дату. Увімкніть режим налаштування в Налаштуваннях.');
      return;
    }

    const time = `${hour}:${minute}`;

    // Перевірка blocked
    if (isBlocked(baseDateStr, time) && !state.editingLessonId) {
      alert('Цей слот позначено як недоступний.');
      return;
    }

    if (state.editingLessonId) {
      const lesson = state.lessons.find(l => String(l.id) === String(state.editingLessonId));
      if (lesson) {
        lesson.studentId = studentId;
        lesson.date = baseDateStr;
        lesson.time = time;
        lesson.paid = paid;
        lesson.status = status;
        lesson.topic = topic;
        lesson.homework = homework;
        lesson.paymentAmount = paid ? paymentAmount : 175;
        lesson.paymentDate = paid ? paymentDate : '';
        lesson.paymentMethod = paid ? paymentMethod : 'МоноБанк';
      }
    } else {
      const repeatCount = parseInt(elements.lessonRepeatSelect.value, 10) || 1;
      const [y, m, d] = baseDateStr.split('-').map(Number);

      for (let i = 0; i < repeatCount; i++) {
        const targetDate = new Date(y, m - 1, d + (i * 7));
        const targetISO = formatDateISO(targetDate);
        if (isBlocked(targetISO, time)) continue; // пропускаємо blocked

        state.lessons.push({
          id: `${Date.now()}_${i}`,
          studentId,
          date: targetISO,
          time,
          paid,
          status,
          topic,
          homework,
          paymentAmount: paid ? paymentAmount : 175,
          paymentDate: paid ? paymentDate : '',
          paymentMethod: paid ? paymentMethod : 'МоноБанк'
        });
      }
    }

    await saveSchedule();
    elements.lessonModal.classList.add('hidden');
    render();
  };

  elements.closeHistoryModalBtn.onclick = () => {
    elements.historyModal.classList.add('hidden');
  };

  elements.viewDayBtn.onclick = () => { state.view = 'day'; render(); };
  elements.viewWeekBtn.onclick = () => { state.view = 'week'; render(); };
  elements.viewMonthBtn.onclick = () => { state.view = 'month'; render(); };

  elements.todayBtn.onclick = () => { state.currentDate = new Date(); render(); };
  
  elements.prevBtn.onclick = () => {
    if (state.view === 'day') {
      state.currentDate.setDate(state.currentDate.getDate() - 1);
    } else if (state.view === 'week') {
      state.currentDate.setDate(state.currentDate.getDate() - 7);
    } else if (state.view === 'month') {
      const y = state.currentDate.getFullYear();
      const m = state.currentDate.getMonth();
      state.currentDate = new Date(y, m - 1, 1);
    }
    render();
  };

  elements.nextBtn.onclick = () => {
    if (state.view === 'day') {
      state.currentDate.setDate(state.currentDate.getDate() + 1);
    } else if (state.view === 'week') {
      state.currentDate.setDate(state.currentDate.getDate() + 7);
    } else if (state.view === 'month') {
      const y = state.currentDate.getFullYear();
      const m = state.currentDate.getMonth();
      state.currentDate = new Date(y, m + 1, 1);
    }
    render();
  };
}
