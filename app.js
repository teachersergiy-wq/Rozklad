const SUPABASE_URL = "https://vjjrwvraannccejyqcci.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XYvCzMPGQjhT0AT2r2v3dw_zZIesIJB";

let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL) {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Параметри з URL
const urlParams = new URLSearchParams(window.location.search);
const scheduleToken = urlParams.get('key');
let isStudentMode = urlParams.get('mode') === 'student';

let lessons = [];
let students = [];
let currentDate = new Date();

// Робочі години для перегляду та запису учнями
const WORK_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  await loadScheduleData();
  setupUIForMode();
  populateStudentSelect();
  renderCalendar();
}

function setupUIForMode() {
  const addBtn = document.querySelector('.btn-primary, button[onclick*="openNewLessonModal"]');
  const settingsToggle = document.querySelector('.toggle-switch, label:has(#settingsMode)');
  
  if (isStudentMode) {
    if (addBtn) addBtn.style.display = 'none';
    if (settingsToggle) settingsToggle.style.display = 'none';
  }
}

// Завантаження даних із Supabase / LocalStorage
async function loadScheduleData() {
  if (supabaseClient && scheduleToken) {
    const { data, error } = await supabaseClient
      .from('schedules')
      .select('data')
      .eq('access_token', scheduleToken)
      .maybeSingle();

    if (error) {
      console.error("Помилка завантаження Supabase:", error);
      alert("Помилка доступу до Supabase: " + error.message);
      return;
    }

    if (data && data.data) {
      let payload = data.data;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) {}
      }

      lessons = Array.isArray(payload.lessons) ? payload.lessons : Object.values(payload.lessons || {});
      students = Array.isArray(payload.students) ? payload.students : Object.values(payload.students || {});
      return;
    }
  }

  lessons = JSON.parse(localStorage.getItem('lessons') || '[]');
  students = JSON.parse(localStorage.getItem('students') || '[]');
}

// Збереження даних у Supabase / LocalStorage
async function saveScheduleData() {
  const payload = { lessons, students };

  if (supabaseClient && scheduleToken) {
    const { error } = await supabaseClient
      .from('schedules')
      .update({ 
        data: payload, 
        updated_at: new Date().toISOString() 
      })
      .eq('access_token', scheduleToken);

    if (error) {
      alert("Помилка збереження в Supabase: " + error.message);
    }
  } else {
    localStorage.setItem('lessons', JSON.stringify(lessons));
    localStorage.setItem('students', JSON.stringify(students));
  }
}

function populateStudentSelect() {
  const select = document.getElementById('lessonStudent');
  if (!select) return;
  select.innerHTML = '<option value="">Оберіть учня</option>';
  students.forEach(st => {
    const opt = document.createElement('option');
    opt.value = st.id;
    opt.textContent = st.name;
    select.appendChild(opt);
  });
}

function changeWeek(days) {
  currentDate.setDate(currentDate.getDate() + days);
  renderCalendar();
}

function resetToToday() {
  currentDate = new Date();
  renderCalendar();
}

function getWeekDays(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  
  const monday = new Date(date.setDate(diff));
  const weekDays = [];
  
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(monday);
    nextDay.setDate(monday.getDate() + i);
    weekDays.push(nextDay.toISOString().split('T')[0]);
  }
  return weekDays;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Рендеринг календарної сітки
function renderCalendar() {
  const container = document.getElementById('calendar');
  if (!container) return;
  container.innerHTML = '';

  // Навігаційні кнопки
  const navDiv = document.createElement('div');
  navDiv.style.cssText = 'grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #fff; padding: 10px 15px; border-radius: 8px; border: 1px solid #e2e8f0;';
  navDiv.innerHTML = `
    <button class="btn-primary" onclick="changeWeek(-7)">◄ Попередній тиждень</button>
    <button class="btn-primary" style="background-color: #6c757d;" onclick="resetToToday()">Поточний тиждень</button>
    <button class="btn-primary" onclick="changeWeek(7)">Наступний тиждень ►</button>
  `;
  container.appendChild(navDiv);

  const weekDays = getWeekDays(currentDate);
  const daysNames = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя'];

  weekDays.forEach((dateStr, index) => {
    const dayBox = document.createElement('div');
    dayBox.className = 'day-column';

    const dayHeader = document.createElement('h3');
    dayHeader.style.cssText = 'margin-bottom: 10px; font-size: 0.95rem; color: #475569; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; text-align: center;';
    dayHeader.innerText = `${daysNames[index]}\n${dateStr}`;
    dayBox.appendChild(dayHeader);

    if (isStudentMode) {
      // --- РЕЖИМ УЧНЯ: вільні та зайняті слоти ---
      WORK_SLOTS.forEach(timeSlot => {
        const occupied = lessons.find(l => l.date === dateStr && l.time === timeSlot && l.status !== 'скасовано');
        const slotCard = document.createElement('div');
        
        if (occupied) {
          slotCard.style.cssText = 'background: #f1f5f9; color: #94a3b8; padding: 8px; border-radius: 6px; margin-bottom: 6px; text-align: center; font-size: 0.85rem; border: 1px dashed #cbd5e1;';
          slotCard.innerText = `${timeSlot} — Зайнято`;
        } else {
          slotCard.style.cssText = 'background: #e0f2fe; color: #0369a1; padding: 8px; border-radius: 6px; margin-bottom: 6px; text-align: center; font-size: 0.85rem; cursor: pointer; font-weight: bold; border: 1px solid #bae6fd;';
          slotCard.innerText = `${timeSlot} — Вільний час`;
          slotCard.onclick = () => {
            alert(`Ви обрали вільний час: ${dateStr} о ${timeSlot}.\nЗв'яжіться з викладачем для підтвердження.`);
          };
        }
        dayBox.appendChild(slotCard);
      });

    } else {
      // --- РЕЖИМ ВЧИТЕЛЯ: повний список уроків ---
      const dayLessons = lessons.filter(l => l.date === dateStr);
      dayLessons.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

      if (dayLessons.length === 0) {
        const emptyText = document.createElement('div');
        emptyText.style.cssText = 'font-size: 0.8rem; color: #aaa; text-align: center; margin-top: 20px;';
        emptyText.innerText = 'Немає уроків';
        dayBox.appendChild(emptyText);
      } else {
        dayLessons.forEach(lesson => {
          const card = createLessonCardElement(lesson);
          dayBox.appendChild(card);
        });
      }
    }

    container.appendChild(dayBox);
  });
}

// Створення картки уроку
function createLessonCardElement(lesson) {
  const card = document.createElement('div');
  card.className = `lesson-card status-${lesson.status || 'planned'}`;
  
  const targetStudentId = lesson.student_id || lesson.studentId;
  const foundStudent = students.find(s => 
    String(s.id) === String(targetStudentId) || s.name === targetStudentId
  );

  const studentName = foundStudent ? foundStudent.name : (lesson.student_name || lesson.student || 'Учень');

  if (foundStudent && foundStudent.color) {
    card.style.borderLeft = `5px solid ${foundStudent.color}`;
  }

  let statusBadge = '';
  if (lesson.status === 'відбувся') {
    statusBadge = '<span class="status-badge status-completed">✓ Відбувся</span>';
  } else if (lesson.status === 'скасовано') {
    statusBadge = '<span class="status-badge status-canceled">✗ Скасовано</span>';
  } else {
    statusBadge = '<span class="status-badge status-planned">⏳ Заплановано</span>';
  }

  const isPaid = lesson.isPaid || lesson.is_paid || lesson.paid;
  const paidBadge = isPaid ? '<div style="color: #16a34a; font-weight: bold; font-size: 0.8rem; margin-top: 4px;">💳 Оплачено</div>' : '';

  card.innerHTML = `
    <div class="lesson-header" style="display: flex; justify-content: space-between; align-items: center;">
      <span class="lesson-time" style="font-weight: bold;">${escapeHtml(lesson.time)}</span>
      ${statusBadge}
    </div>
    <div class="lesson-body" style="margin: 6px 0;">
      <div class="student-name" style="font-weight: 600; font-size: 0.95rem; color: #1e293b;">${escapeHtml(studentName)}</div>
      ${lesson.topic ? `<div class="lesson-topic" style="font-size: 0.8rem; color: #475569;"><strong>Тема:</strong> ${escapeHtml(lesson.topic)}</div>` : ''}
      ${lesson.homework ? `<div class="lesson-hw" style="font-size: 0.8rem; color: #475569;"><strong>ДЗ:</strong> ${escapeHtml(lesson.homework)}</div>` : ''}
    </div>
    <div class="lesson-footer">
      ${paidBadge}
    </div>
  `;

  card.onclick = () => openEditLessonModal(lesson);
  return card;
}

// Відкриття вікна створення уроку
function openNewLessonModal() {
  document.getElementById('lessonId').value = '';
  document.getElementById('modalTitle').innerText = 'Додати урок';
  document.getElementById('lessonForm').reset();
  
  const paidCheckbox = document.getElementById('lessonPaid') || document.querySelector('input[type="checkbox"]');
  if (paidCheckbox) paidCheckbox.checked = false;

  document.getElementById('lessonModal').style.display = 'block';
}

// Відкриття вікна редагування уроку
function openEditLessonModal(lesson) {
  document.getElementById('modalTitle').innerText = 'Редагування уроку';
  document.getElementById('lessonId').value = lesson.id || '';
  
  const studentId = lesson.student_id || lesson.studentId || '';
  document.getElementById('lessonStudent').value = studentId;
  
  document.getElementById('lessonDate').value = lesson.date || '';
  document.getElementById('lessonTime').value = lesson.time || '';
  document.getElementById('lessonStatus').value = lesson.status || 'заплановано';
  document.getElementById('lessonTopic').value = lesson.topic || '';
  document.getElementById('lessonHomework').value = lesson.homework || '';
  
  const paidCheckbox = document.getElementById('lessonPaid') || document.querySelector('input[type="checkbox"]');
  if (paidCheckbox) {
    paidCheckbox.checked = !!(lesson.isPaid || lesson.is_paid || lesson.paid);
  }

  document.getElementById('lessonModal').style.display = 'block';
}

function closeLessonModal() {
  document.getElementById('lessonModal').style.display = 'none';
}

// Збереження уроку
async function handleSaveLesson(event) {
  if (event) event.preventDefault();

  const lessonId = document.getElementById('lessonId').value;
  const paidCheckbox = document.getElementById('lessonPaid') || document.querySelector('input[type="checkbox"]');
  const selectedStudentId = document.getElementById('lessonStudent').value;
  
  const lessonData = {
    id: lessonId || (Date.now().toString() + '_' + Math.floor(Math.random() * 1000)),
    student_id: selectedStudentId,
    studentId: selectedStudentId,
    date: document.getElementById('lessonDate').value,
    time: document.getElementById('lessonTime').value,
    status: document.getElementById('lessonStatus').value,
    topic: document.getElementById('lessonTopic').value.trim(),
    homework: document.getElementById('lessonHomework').value.trim(),
    isPaid: paidCheckbox ? paidCheckbox.checked : false
  };

  if (lessonId) {
    const idx = lessons.findIndex(l => String(l.id) === String(lessonId));
    if (idx !== -1) lessons[idx] = lessonData;
    else lessons.push(lessonData);
  } else {
    lessons.push(lessonData);
  }

  await saveScheduleData();
  closeLessonModal();
  renderCalendar();
}
