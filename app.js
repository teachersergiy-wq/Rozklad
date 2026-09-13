let isSettingsMode = false;

// Зміна режиму налаштувань
function toggleSettingsMode(enabled) {
  isSettingsMode = enabled;
  renderCalendar();
}

// Перевірка, чи дата є минулою
function isPastDate(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(dateStr);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate < today;
}

// Екранування символів HTML
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Відображення / приховування деталей оплати
function togglePaymentDetails(isPaid) {
  const details = document.getElementById('paymentDetails');
  details.style.display = isPaid ? 'block' : 'none';

  if (isPaid && !document.getElementById('lessonPaymentDate').value) {
    document.getElementById('lessonPaymentDate').value = new Date().toISOString().split('T')[0];
  }
}

// 1. Рендеринг картки уроку (Без хрестика видалення, з відміткою статусу)
function createLessonCardElement(lesson, student) {
  const card = document.createElement('div');
  card.className = `lesson-card status-${lesson.status || 'planned'}`;
  if (student && student.color) {
    card.style.borderLeft = `5px solid ${student.color}`;
  }

  // Значок статусу виконання
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

// 2. Відкриття модального вікна створення нового уроку
function openNewLessonModal() {
  document.getElementById('lessonId').value = '';
  document.getElementById('modalTitle').innerText = 'Додати урок';
  document.getElementById('lessonForm').reset();
  
  document.getElementById('lessonDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('lessonTime').value = '12:00';
  document.getElementById('lessonStatus').value = 'заплановано';
  document.getElementById('lessonIsPaid').checked = false;
  document.getElementById('lessonPaymentAmount').value = 175;
  document.getElementById('lessonPaymentDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('lessonPaymentMethod').value = 'МоноБанк';
  
  togglePaymentDetails(false);
  document.getElementById('deleteLessonContainer').innerHTML = '';
  document.getElementById('lessonModal').style.display = 'block';
}

// 3. Відкриття модального вікна редагування
function openEditLessonModal(lesson) {
  const isPast = isPastDate(lesson.date);

  // Обмеження: Зміна минулих дат дозволена тільки у режимі налаштувань
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

  // Кнопка видалення: додається ТІЛЬКИ у режимі налаштувань і ТІЛЬКИ для статусу "заплановано"
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

// 4. Збереження даних уроку
async function handleSaveLesson(event) {
  event.preventDefault();

  const lessonId = document.getElementById('lessonId').value;
  const dateVal = document.getElementById('lessonDate').value;

  // Повторна перевірка редакції минулої дати
  if (isPastDate(dateVal) && !isSettingsMode) {
    alert("Неможливо зберегти зміни для минулої дати поза режимом налаштувань.");
    return;
  }

  const isPaid = document.getElementById('lessonIsPaid').checked;

  const lessonData = {
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

  if (lessonId) {
    await updateLessonInSupabase(lessonId, lessonData);
  } else {
    await createLessonInSupabase(lessonData);
  }

  closeLessonModal();
  renderCalendar();
}

// 5. Видалення уроку (лише з режиму налаштувань)
async function handleDeleteLesson(lessonId) {
  if (!isSettingsMode) {
    alert("Видалення доступне лише в режимі налаштувань.");
    return;
  }

  if (confirm("Ви впевнені, що хочете видалити цей запланований урок?")) {
    await deleteLessonFromSupabase(lessonId);
    closeLessonModal();
    renderCalendar();
  }
}

// Функції роботи з базами даних та відмальовування
async function updateLessonInSupabase(id, data) {
  // Ваша логіка Supabase update
}

async function createLessonInSupabase(data) {
  // Ваша логіка Supabase insert
}

async function deleteLessonFromSupabase(id) {
  // Ваша логіка Supabase delete
}

function renderCalendar() {
  // Оновлення відображення розкладу
}
