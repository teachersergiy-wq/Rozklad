// Вкажіть ваші дані Supabase (якщо використовуєте хмару)
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; 
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let isSettingsMode = false;
let lessons = [];
let students = [];

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  await loadStudents();
  await loadLessons();
  populateStudentSelect();
  renderCalendar();
}

// Завантаження учнів
async function loadStudents() {
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from('students').select('*');
    if (!error && data) {
      students = data;
      return;
    }
  }
  students = JSON.parse(localStorage.getItem('students') || '[]');
}

// Завантаження уроків
async function loadLessons() {
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from('lessons').select('*');
    if (!error && data) {
      lessons = data;
      return;
    }
  }
  lessons = JSON.parse(localStorage.getItem('lessons') || '[]');
}

function saveLessonsToLocal() {
  localStorage.setItem('lessons', JSON.stringify(lessons));
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

function toggleSettingsMode(enabled) {
  isSettingsMode = enabled;
  renderCalendar();
}

function isPastDate(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate < today;
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

function togglePaymentDetails(isPaid) {
  const details = document.getElementById('paymentDetails');
  if (details) {
    details.style.display = isPaid ? 'block' : 'none';
  }

  const dateInput = document.getElementById('lessonPaymentDate');
  if (isPaid && dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

// 1. Створення картки уроку (Без кнопки видалення)
function createLessonCardElement(lesson, student) {
  const card = document.createElement('div');
  card.className = `lesson-card status-${lesson.status || 'planned'}`;
  if (student && student.color) {
    card.style.borderLeft = `5px solid ${student.color}`;
  }

  let statusBadge = '';
  if (lesson.status === 'відбувся') {
    statusBadge = '<span class="status-badge status-completed">✓ Відбувся</span>';
  } else if (lesson.status === 'скасовано') {
    statusBadge = '<span class="status-badge status-canceled">✗ Скасовано</span>';
  } else {
    statusBadge = '<span class="status-badge status-planned">⏳ Заплановано</span>';
  }

  const paidBadge = lesson.isPaid ? '<span class="paid-badge">💳 Оплачено</span>' : '';

  card.innerHTML = `
    <div class="lesson-header">
      <span class="lesson-time">${escapeHtml(lesson.time)}</span>
      ${statusBadge}
    </div>
    <div class="lesson-body">
      <div class="student-name">${escapeHtml(student ? student.name : 'Учень')}</div>
      ${lesson.topic ? `<div class="lesson-topic"><strong>Тема:</strong> ${escapeHtml(lesson.topic)}</div>` : ''}
      ${lesson.homework ? `<div class="lesson-hw"><strong>ДЗ:</strong> ${escapeHtml(lesson.homework)}</div>` : ''}
    </div>
    <div class="lesson-footer">
      ${paidBadge}
    </div>
  `;

  card.onclick = () => openEditLessonModal(lesson);
  return card;
}

// 2. Рендеринг розкладу
function renderCalendar() {
  const container = document.getElementById('calendar');
  if (!container) return;
  container.innerHTML = '';

  if (lessons.length === 0) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #777; padding: 20px;">Немає запланованих уроків.</p>';
    return;
  }

  const grouped = {};
  lessons.forEach(l => {
    if (!grouped[l.date]) grouped[l.date] = [];
    grouped[l.date].push(l);
  });

  const sortedDates = Object.keys(grouped).sort();

  sortedDates.forEach(dateStr => {
    const dayBox = document.createElement('div');
    dayBox.className = 'day-column';
    dayBox.style.cssText = 'background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px;';

    const dayHeader = document.createElement('h3');
    dayHeader.style.cssText = 'margin-bottom: 10px; font-size: 1rem; color: #475569; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;';
    dayHeader.innerText = dateStr;
    dayBox.appendChild(dayHeader);

    grouped[dateStr].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    grouped[dateStr].forEach(lesson => {
      const student = students.find(s => String(s.id) === String(lesson.student_id));
      const card = createLessonCardElement(lesson, student);
      dayBox.appendChild(card);
    });

    container.appendChild(dayBox);
  });
}

// 3. Відкриття модального вікна для нового уроку
function openNewLessonModal() {
  document.getElementById('lessonId').value = '';
  document.getElementById('modalTitle').innerText = 'Додати урок';
  document.getElementById('lessonForm').reset();

  document.getElementById('lessonDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('lessonTime').value = '12:00';
  document.getElementById('lessonStatus').value = 'заплановано';
  document.getElementById('lessonTopic').value = '';
  document.getElementById('lessonHomework').value = '';
  document.getElementById('lessonIsPaid').checked = false;
  document.getElementById('lessonPaymentAmount').value = 175;
  document.getElementById('lessonPaymentDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('lessonPaymentMethod').value = 'МоноБанк';

  togglePaymentDetails(false);
  document.getElementById('deleteLessonContainer').innerHTML = '';
  document.getElementById('lessonModal').style.display = 'block';
}

// 4. Відкриття модального вікна редагування
function openEditLessonModal(lesson) {
  const isPast = isPastDate(lesson.date);

  if (isPast && !isSettingsMode) {
    alert("Змінювати розклад за дату, яка вже пройшла, можна лише в режимі налаштувань.");
    return;
  }

  document.getElementById('modalTitle').innerText = 'Редагування уроку';
  document.getElementById('lessonId').value = lesson.id || '';
  document.getElementById('lessonStudent').value = lesson.student_id || '';
  document.getElementById('lessonDate').value = lesson.date || '';
  document.getElementById('lessonTime').value = lesson.time || '';
  document.getElementById('lessonStatus').value = lesson.status || 'заплановано';
  document.getElementById('lessonTopic').value = lesson.topic || '';
  document.getElementById('lessonHomework').value = lesson.homework || '';

  const isPaid = Boolean(lesson.isPaid);
  const isPaidCheckbox = document.getElementById('lessonIsPaid');
  isPaidCheckbox.checked = isPaid;

  document.getElementById('lessonPaymentAmount').value = (lesson.paymentAmount !== undefined && lesson.paymentAmount !== null) ? lesson.paymentAmount : 175;
  document.getElementById('lessonPaymentDate').value = lesson.paymentDate || new Date().toISOString().split('T')[0];
  document.getElementById('lessonPaymentMethod').value = lesson.paymentMethod || 'МоноБанк';

  togglePaymentDetails(isPaid);

  // Додаємо кнопку видалення тільки в режимі налаштувань і для статусу "заплановано"
  const deleteContainer = document.getElementById('deleteLessonContainer');
  deleteContainer.innerHTML = '';

  if (isSettingsMode && lesson.status === 'заплановано' && lesson.id) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-danger';
    deleteBtn.innerText = 'Видалити урок';
    deleteBtn.onclick = () => handleDeleteLesson(lesson.id);
    deleteContainer.appendChild(deleteBtn);
  }

  document.getElementById('lessonModal').style.display = 'block';
}

function closeLessonModal() {
  document.getElementById('lessonModal').style.display = 'none';
}

// 5. Збереження уроку
async function handleSaveLesson(event) {
  event.preventDefault();

  const lessonId = document.getElementById('lessonId').value;
  const dateVal = document.getElementById('lessonDate').value;

  if (isPastDate(dateVal) && !isSettingsMode) {
    alert("Неможливо зберегти зміни для минулої дати поза режимом налаштувань.");
    return;
  }

  const isPaid = document.getElementById('lessonIsPaid').checked;

  const lessonData = {
    id: lessonId || Date.now().toString(),
    student_id: document.getElementById('lessonStudent').value,
    date: dateVal,
    time: document.getElementById('lessonTime').value,
    status: document.getElementById('lessonStatus').value,
    topic: document.getElementById('lessonTopic').value.trim(),
    homework: document.getElementById('lessonHomework').value.trim(),
    isPaid: isPaid,
    paymentAmount: isPaid ? (Number(document.getElementById('lessonPaymentAmount').value) || 175) : null,
    paymentDate: isPaid ? (document.getElementById('lessonPaymentDate').value || new Date().toISOString().split('T')[0]) : null,
    paymentMethod: isPaid ? document.getElementById('lessonPaymentMethod').value : null
  };

  if (supabaseClient) {
    if (lessonId) {
      await supabaseClient.from('lessons').update(lessonData).eq('id', lessonId);
    } else {
      await supabaseClient.from('lessons').insert([lessonData]);
    }
    await loadLessons();
  } else {
    if (lessonId) {
      const idx = lessons.findIndex(l => String(l.id) === String(lessonId));
      if (idx !== -1) lessons[idx] = lessonData;
    } else {
      lessons.push(lessonData);
    }
    saveLessonsToLocal();
  }

  closeLessonModal();
  renderCalendar();
}

// 6. Видалення уроку
async function handleDeleteLesson(lessonId) {
  if (!isSettingsMode) {
    alert("Видалення доступне лише в режимі налаштувань.");
    return;
  }

  if (confirm("Ви впевнені, що хочете видалити цей запланований урок?")) {
    if (supabaseClient) {
      await supabaseClient.from('lessons').delete().eq('id', lessonId);
      await loadLessons();
    } else {
      lessons = lessons.filter(l => String(l.id) !== String(lessonId));
      saveLessonsToLocal();
    }
    closeLessonModal();
    renderCalendar();
  }
}
