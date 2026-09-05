"use strict";

/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL = 
  "https://vjjrwvraannccejyqcci.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = 
  "sb_publishable_XYvCzMPGQjhT0AT2r2v3dw_zZIesIJB";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


let cloudAccessToken = null;


/* =========================================================
   CONFIG
========================================================= */

const START_MINUTES = 9 * 60;
const END_MINUTES = 21 * 60;

/*
  Відображення календаря — 15 хв.
*/
const DISPLAY_STEP_MINUTES = 15;

/*
  Вибір часу заняття — 5 хв.
*/
const TIME_PICKER_STEP_MINUTES = 5;

const DEFAULT_UNAVAILABLE_BEFORE =
  17 * 60;


/* =========================================================
   STATE
========================================================= */

function defaultState() {

  return {
    students: [],
    lessons: {}
  };

}


let state =
  defaultState();

let currentDate =
  new Date();

let currentView =
  "week";

let editMode =
  false;

let activeSlot =
  null;

let draggedLesson =
  null;

let justDropped =
  false;


/* =========================================================
   TIME
========================================================= */

function pad(number) {

  return String(number)
    .padStart(2, "0");

}


function minutesToTime(minutes) {

  const hours =
    Math.floor(minutes / 60);

  const mins =
    minutes % 60;

  return `${pad(hours)}:${pad(mins)}`;

}


function timeToMinutes(time) {

  if (!time || !time.includes(":")) {
    return null;
  }

  const [hours, minutes] =
    time.split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  return hours * 60 + minutes;

}


/*
  Часові рядки календаря:
  09:00
  09:15
  09:30
  ...
  21:00
*/
function createDisplayTimeSlots() {

  const result = [];

  for (
    let minutes = START_MINUTES;
    minutes <= END_MINUTES;
    minutes += DISPLAY_STEP_MINUTES
  ) {

    result.push(
      minutesToTime(minutes)
    );

  }

  return result;

}


const DISPLAY_TIME_SLOTS =
  createDisplayTimeSlots();


/*
  Час для input type="time":
  09:00
  09:05
  09:10
  ...
*/
function createPickerTimeSlots() {

  const result = [];

  for (
    let minutes = START_MINUTES;
    minutes <= END_MINUTES;
    minutes += TIME_PICKER_STEP_MINUTES
  ) {

    result.push(
      minutesToTime(minutes)
    );

  }

  return result;

}


const PICKER_TIME_SLOTS =
  createPickerTimeSlots();


/* =========================================================
   DATE
========================================================= */

function dateKey(date) {

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");

}


function parseDate(key) {

  const [
    year,
    month,
    day
  ] = key.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  );

}


function formatDate(date) {

  return date.toLocaleDateString(
    "uk-UA",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  );

}


function shortDate(date) {

  return date.toLocaleDateString(
    "uk-UA",
    {
      day: "2-digit",
      month: "2-digit"
    }
  );

}


function addDays(date, amount) {

  const result =
    new Date(date);

  result.setDate(
    result.getDate() + amount
  );

  return result;

}


function startOfWeek(date) {

  const result =
    new Date(date);

  const weekday =
    result.getDay();

  const diff =
    weekday === 0
      ? -6
      : 1 - weekday;

  result.setDate(
    result.getDate() + diff
  );

  result.setHours(
    0,
    0,
    0,
    0
  );

  return result;

}


function isToday(date) {

  const today =
    new Date();

  return (
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate()
  );

}


/* =========================================================
   DEFAULT UNAVAILABLE
========================================================= */

function isDefaultUnavailableTime(time) {

  const minutes =
    timeToMinutes(time);

  return (
    minutes !== null &&
    minutes < DEFAULT_UNAVAILABLE_BEFORE
  );

}


/* =========================================================
   CLOUD
========================================================= */

async function createCloudSchedule() {

  const {
    data,
    error
  } = await supabaseClient.rpc(
    "create_schedule"
  );

  if (error) {
    throw error;
  }

  return data;

}


async function loadCloudSchedule() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  cloudAccessToken =
    params.get("key");


  /*
    Перший запуск:
    створюємо новий розклад.
  */

  if (!cloudAccessToken) {

    const result =
      await createCloudSchedule();

    cloudAccessToken =
      result.access_token;


    const url =
      new URL(
        window.location.href
      );

    url.searchParams.set(
      "key",
      cloudAccessToken
    );

    window.history.replaceState(
      {},
      "",
      url.toString()
    );


    state =
      result.data ||
      defaultState();

    return;

  }


  /*
    Існуючий розклад.
  */

  const {
    data,
    error
  } = await supabaseClient.rpc(
    "get_schedule",
    {
      p_access_token:
        cloudAccessToken
    }
  );


  if (error) {
    throw error;
  }


  if (!data) {

    throw new Error(
      "Розклад за цим посиланням не знайдено."
    );

  }


  state =
    data.data ||
    defaultState();

}


async function saveState() {

  /*
    Локальна копія — тільки як кеш.
  */

  try {

    localStorage.setItem(
      "tutorCalendarCache",
      JSON.stringify(state)
    );

  } catch (error) {

    console.warn(
      "Не вдалося зберегти локальний кеш:",
      error
    );

  }


  /*
    Основне збереження — хмара.
  */

  if (!cloudAccessToken) {
    return;
  }


  const {
    error
  } = await supabaseClient.rpc(
    "save_schedule",
    {
      p_access_token:
        cloudAccessToken,

      p_data:
        state
    }
  );


  if (error) {

    console.error(
      "Помилка збереження в хмару:",
      error
    );

    alert(
      "Не вдалося зберегти зміни в хмару."
    );

  }

}


/* =========================================================
   LESSONS
========================================================= */

function lessonKey(
  date,
  time
) {

  return `${dateKey(date)}_${time}`;

}


function getLesson(
  date,
  time
) {

  return (
    state.lessons[
      lessonKey(date, time)
    ] || null
  );

}


function setLesson(
  date,
  time,
  lesson
) {

  state.lessons[
    lessonKey(date, time)
  ] =
    lesson;

}


function deleteLesson(
  date,
  time
) {

  delete state.lessons[
    lessonKey(date, time)
  ];

}


function getStudent(
  studentId
) {

  return state.students.find(
    student =>
      String(student.id) ===
      String(studentId)
  ) || null;

}


/* =========================================================
   LESSONS INSIDE 15 MIN BLOCK
========================================================= */

function getLessonsInDisplayBlock(
  date,
  displayTime
) {

  const start =
    timeToMinutes(displayTime);

  const end =
    start + DISPLAY_STEP_MINUTES;

  const targetDate =
    dateKey(date);


  return Object.entries(
    state.lessons
  )
  .filter(
    ([key, lesson]) => {

      if (!lesson) {
        return false;
      }

      if (
        !key.startsWith(
          targetDate + "_"
        )
      ) {
        return false;
      }

      const lessonMinutes =
        timeToMinutes(
          lesson.time
        );

      if (
        lessonMinutes === null
      ) {
        return false;
      }

      return (
        lessonMinutes >= start &&
        lessonMinutes < end
      );

    }
  )
  .map(
    ([key, lesson]) => ({
      key,
      lesson
    })
  )
  .sort(
    (a, b) => {

      return (
        timeToMinutes(
          a.lesson.time
        ) -
        timeToMinutes(
          b.lesson.time
        )
      );

    }
  );

}


/* =========================================================
   VISIBLE TIMES
========================================================= */

function getVisibleTimesForDay(
  date
) {

  if (editMode) {
    return DISPLAY_TIME_SLOTS;
  }


  return DISPLAY_TIME_SLOTS.filter(
    displayTime => {

      if (
        !isDefaultUnavailableTime(
          displayTime
        )
      ) {

        return true;

      }


      const lessons =
        getLessonsInDisplayBlock(
          date,
          displayTime
        );


      return lessons.some(
        item =>
          item.lesson.status !==
          "unavailable"
      );

    }
  );

}


function getVisibleTimesForWeek(
  monday
) {

  if (editMode) {
    return DISPLAY_TIME_SLOTS;
  }


  return DISPLAY_TIME_SLOTS.filter(
    displayTime => {

      if (
        !isDefaultUnavailableTime(
          displayTime
        )
      ) {

        return true;

      }


      for (
        let i = 0;
        i < 7;
        i++
      ) {

        const date =
          addDays(
            monday,
            i
          );


        const lessons =
          getLessonsInDisplayBlock(
            date,
            displayTime
          );


        if (
          lessons.some(
            item =>
              item.lesson.status !==
              "unavailable"
          )
        ) {

          return true;

        }

      }


      return false;

    }
  );

}


/* =========================================================
   RENDER
========================================================= */

function renderCalendar() {

  const calendar =
    document.getElementById(
      "calendar"
    );

  calendar.innerHTML = "";


  if (
    currentView === "day"
  ) {

    renderDay(calendar);

  } else if (
    currentView === "week"
  ) {

    renderWeek(calendar);

  } else {

    renderMonth(calendar);

  }

}


/* =========================================================
   DAY
========================================================= */

function renderDay(calendar) {

  const grid =
    document.createElement("div");

  grid.className =
    "calendar-grid day-grid";


  const timeHeader =
    document.createElement("div");

  timeHeader.className =
    "grid-header";

  timeHeader.textContent =
    "Час";

  grid.appendChild(
    timeHeader
  );


  const dayHeader =
    document.createElement("div");

  dayHeader.className =
    "grid-header";


  if (
    isToday(currentDate)
  ) {

    dayHeader.classList.add(
      "today"
    );

  }


  const weekday =
    currentDate.toLocaleDateString(
      "uk-UA",
      {
        weekday: "long"
      }
    );


  const weekdayElement =
    document.createElement("div");

  weekdayElement.className =
    "weekday";

  weekdayElement.textContent =
    weekday.charAt(0).toUpperCase() +
    weekday.slice(1);


  const dateElement =
    document.createElement("div");

  dateElement.className =
    "header-date";

  dateElement.textContent =
    formatDate(
      currentDate
    );


  dayHeader.appendChild(
    weekdayElement
  );

  dayHeader.appendChild(
    dateElement
  );

  grid.appendChild(
    dayHeader
  );


  const visibleTimes =
    getVisibleTimesForDay(
      currentDate
    );


  visibleTimes.forEach(
    displayTime => {

      const timeCell =
        document.createElement("div");

      timeCell.className =
        "time-cell";

      timeCell.textContent =
        displayTime;

      grid.appendChild(
        timeCell
      );


      grid.appendChild(
        createSlot(
          currentDate,
          displayTime
        )
      );

    }
  );


  calendar.appendChild(
    grid
  );

}


/* =========================================================
   WEEK
========================================================= */

function renderWeek(calendar) {

  const monday =
    startOfWeek(
      currentDate
    );


  const grid =
    document.createElement("div");

  grid.className =
    "calendar-grid week-grid";


  const timeHeader =
    document.createElement("div");

  timeHeader.className =
    "grid-header";

  timeHeader.textContent =
    "Час";

  grid.appendChild(
    timeHeader
  );


  for (
    let i = 0;
    i < 7;
    i++
  ) {

    const date =
      addDays(
        monday,
        i
      );


    const header =
      document.createElement("div");

    header.className =
      "grid-header";


    if (isToday(date)) {

      header.classList.add(
        "today"
      );

    }


    const weekday =
      date.toLocaleDateString(
        "uk-UA",
        {
          weekday: "short"
        }
      );


    const weekdayElement =
      document.createElement("div");

    weekdayElement.className =
      "weekday";

    weekdayElement.textContent =
      weekday.charAt(0).toUpperCase() +
      weekday.slice(1);


    const dateElement =
      document.createElement("div");

    dateElement.className =
      "header-date";

    dateElement.textContent =
      shortDate(date);


    header.appendChild(
      weekdayElement
    );

    header.appendChild(
      dateElement
    );


    grid.appendChild(
      header
    );

  }


  const visibleTimes =
    getVisibleTimesForWeek(
      monday
    );


  visibleTimes.forEach(
    displayTime => {

      const timeCell =
        document.createElement("div");

      timeCell.className =
        "time-cell";

      timeCell.textContent =
        displayTime;

      grid.appendChild(
        timeCell
      );


      for (
        let i = 0;
        i < 7;
        i++
      ) {

        const date =
          addDays(
            monday,
            i
          );


        grid.appendChild(
          createSlot(
            date,
            displayTime
          )
        );

      }

    }
  );


  calendar.appendChild(
    grid
  );

}


/* =========================================================
   SLOT
========================================================= */

function createSlot(
  date,
  displayTime
) {

  const slot =
    document.createElement("div");

  slot.className =
    "slot";


  if (isToday(date)) {

    slot.classList.add(
      "today-column"
    );

  }


  const blockStart =
    timeToMinutes(
      displayTime
    );


  const blockEnd =
    blockStart +
    DISPLAY_STEP_MINUTES;


  /*
    Усі записи всередині 15-хвилинного
    блоку.
  */

  const lessons =
    getLessonsInDisplayBlock(
      date,
      displayTime
    );


  /*
    Якщо в блоці є зайняте заняття —
    показуємо його.
  */

  const occupied =
    lessons.filter(
      item =>
        item.lesson.status ===
        "occupied"
    );


  if (
    occupied.length > 0
  ) {

    occupied.forEach(
      item => {

        renderLesson(
          slot,
          date,
          displayTime,
          item.lesson,
          item.key
        );

      }
    );


    addSlotEvents(
      slot,
      date,
      displayTime
    );


    return slot;

  }


  /*
    Недоступний блок.
  */

  const unavailable =
    lessons.some(
      item =>
        item.lesson.status ===
        "unavailable"
    );


  if (
    unavailable ||
    (
      lessons.length === 0 &&
      isDefaultUnavailableTime(
        displayTime
      )
    )
  ) {

    if (editMode) {

      slot.classList.add(
        "unavailable"
      );

      slot.textContent =
        "* Недоступно";

      addSlotEvents(
        slot,
        date,
        displayTime
      );

    }

    return slot;

  }


  /*
    Вільний.
  */

  slot.classList.add(
    "free"
  );

  addSlotEvents(
    slot,
    date,
    displayTime
  );


  return slot;

}


/* =========================================================
   EVENTS
========================================================= */

function addSlotEvents(
  slot,
  date,
  displayTime
) {

  slot.addEventListener(
    "click",
    event => {

      if (justDropped) {

        justDropped = false;

        return;

      }


      if (
        event.target.closest(
          ".lesson"
        )
      ) {

        return;

      }


      openLessonModal(
        date,
        displayTime
      );

    }
  );


  slot.addEventListener(
    "dragover",
    event => {

      if (!draggedLesson) {
        return;
      }

      event.preventDefault();

      event.dataTransfer.dropEffect =
        "move";

      slot.classList.add(
        "drop-target"
      );

    }
  );


  slot.addEventListener(
    "dragleave",
    () => {

      slot.classList.remove(
        "drop-target"
      );

    }
  );


  slot.addEventListener(
    "drop",
    event => {

      event.preventDefault();

      event.stopPropagation();

      slot.classList.remove(
        "drop-target"
      );


      let source =
        draggedLesson;


      if (!source) {

        const raw =
          event.dataTransfer.getData(
            "text/plain"
          );


        if (raw) {

          const parts =
            raw.split("|");

          if (
            parts.length === 2
          ) {

            source = {
              dateKey: parts[0],
              time: parts[1]
            };

          }

        }

      }


      if (!source) {
        return;
      }


      handleDrop(
        source,
        date,
        displayTime
      );


      draggedLesson =
        null;

      justDropped =
        true;

    }
  );

}


/* =========================================================
   LESSON
========================================================= */

function renderLesson(
  slot,
  date,
  displayTime,
  lesson
) {

  const student =
    getStudent(
      lesson.studentId
    );


  if (!student) {
    return;
  }


  const element =
    document.createElement(
      "div"
    );


  element.className =
    "lesson " +
    (
      student.color ||
      lesson.studentColor ||
      "blue"
    );


  element.draggable =
    true;


  const name =
    document.createElement(
      "span"
    );

  name.className =
    "lesson-name";


  name.textContent =
    `${lesson.time || displayTime} · ${student.name}`;


  element.appendChild(
    name
  );


  if (lesson.paid) {

    const paid =
      document.createElement(
        "span"
      );

    paid.className =
      "lesson-paid";

    paid.textContent =
      "$";

    element.appendChild(
      paid
    );

  }


  if (
    lesson.lessonState ===
    "completed"
  ) {

    const completed =
      document.createElement(
        "span"
      );

    completed.className =
      "lesson-completed";

    completed.textContent =
      "✓";

    element.appendChild(
      completed
    );

  }


  element.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      if (justDropped) {

        justDropped = false;

        return;

      }


      openLessonModal(
        date,
        lesson.time || displayTime
      );

    }
  );


  element.addEventListener(
    "dragstart",
    event => {

      event.stopPropagation();

      draggedLesson = {

        dateKey:
          dateKey(date),

        time:
          lesson.time ||
          displayTime

      };


      event.dataTransfer.effectAllowed =
        "move";


      event.dataTransfer.setData(
        "text/plain",
        `${dateKey(date)}|${lesson.time || displayTime}`
      );

    }
  );


  element.addEventListener(
    "dragend",
    () => {

      draggedLesson =
        null;


      document
        .querySelectorAll(
          ".drop-target"
        )
        .forEach(
          item => {

            item.classList.remove(
              "drop-target"
            );

          }
        );

    }
  );


  slot.appendChild(
    element
  );

}


/* =========================================================
   DROP
========================================================= */

async function handleDrop(
  source,
  targetDate,
  targetDisplayTime
) {

  const sourceDate =
    parseDate(
      source.dateKey
    );


  const sourceResult =
    state.lessons[
      lessonKey(
        sourceDate,
        source.time
      )
    ];


  if (!sourceResult) {
    return;
  }


  const targetStart =
    timeToMinutes(
      targetDisplayTime
    );


  const targetLessons =
    getLessonsInDisplayBlock(
      targetDate,
      targetDisplayTime
    );


  const targetOccupied =
    targetLessons.find(
      item =>
        item.lesson.status ===
        "occupied"
    );


  /*
    Забороняємо перетягування
    у недоступний час.
  */

  if (
    targetStart <
      DEFAULT_UNAVAILABLE_BEFORE &&
    !targetOccupied &&
    !targetLessons.some(
      item =>
        item.lesson.status !==
        "unavailable"
    )
  ) {

    if (!editMode) {

      alert(
        "Цей час недоступний."
      );

      return;

    }

  }


  /*
    Якщо в цій 15-хвилинній комірці
    вже є заняття — запитуємо swap.
  */

  if (targetOccupied) {

    if (
      targetOccupied.key ===
      lessonKey(
        sourceDate,
        source.time
      )
    ) {

      return;

    }


    const shouldSwap =
      confirm(
        "Цей час уже зайнятий. Поміняти заняття місцями?"
      );


    if (!shouldSwap) {
      return;
    }


    const targetLesson =
      targetOccupied.lesson;


    const newSource =
      {
        ...sourceResult,
        time:
          targetDisplayTime,
        date:
          dateKey(targetDate)
      };


    const newTarget =
      {
        ...targetLesson,
        time:
          source.time,
        date:
          dateKey(sourceDate)
      };


    delete state.lessons[
      lessonKey(
        sourceDate,
        source.time
      )
    ];


    delete state.lessons[
      targetOccupied.key
    ];


    setLesson(
      targetDate,
      targetDisplayTime,
      newSource
    );


    setLesson(
      sourceDate,
      source.time,
      newTarget
    );


    await saveState();

    renderCalendar();

    return;

  }


  /*
    Звичайне переміщення.
  */

  delete state.lessons[
    lessonKey(
      sourceDate,
      source.time
    )
  ];


  const movedLesson =
    {
      ...sourceResult,
      time:
        targetDisplayTime,
      date:
        dateKey(targetDate)
    };


  setLesson(
    targetDate,
    targetDisplayTime,
    movedLesson
  );


  await saveState();

  renderCalendar();

}


/* =========================================================
   MODAL
========================================================= */

function fillStudentSelect(
  selectedId
) {

  const select =
    document.getElementById(
      "studentSelect"
    );


  select.innerHTML = "";


  const first =
    document.createElement(
      "option"
    );

  first.value = "";

  first.textContent =
    "Оберіть учня";


  select.appendChild(
    first
  );


  state.students.forEach(
    student => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        student.id;

      option.textContent =
        student.name;


      select.appendChild(
        option
      );

    }
  );


  select.value =
    selectedId || "";

}


function openLessonModal(
  date,
  time
) {

  activeSlot = {
    date:
      new Date(date),
    time
  };


  const modal =
    document.getElementById(
      "lessonModal"
    );


  const exactLesson =
    getLesson(
      date,
      time
    );


  const blockLessons =
    getLessonsInDisplayBlock(
      date,
      time
    );


  let lesson =
    exactLesson;


  if (!lesson) {

    const occupied =
      blockLessons.find(
        item =>
          item.lesson.status ===
          "occupied"
      );


    if (occupied) {
      lesson =
        occupied.lesson;
    }

  }


  document.getElementById(
    "lessonDate"
  ).value =
    formatDate(date);


  document.getElementById(
    "lessonTime"
  ).value =
    lesson &&
    lesson.time
      ? lesson.time
      : time;


  document.getElementById(
    "slotStatus"
  ).value =
    lesson &&
    lesson.status
      ? lesson.status
      : (
        isDefaultUnavailableTime(
          time
        )
          ? "unavailable"
          : "free"
      );


  document.getElementById(
    "studentSelect"
  );


  fillStudentSelect(
    lesson
      ? lesson.studentId
      : ""
  );


  document.getElementById(
    "paidCheckbox"
  ).checked =
    !!(
      lesson &&
      lesson.paid
    );


  document.getElementById(
    "lessonState"
  ).value =
    lesson &&
    lesson.lessonState
      ? lesson.lessonState
      : "planned";


  selectStudentColor(
    lesson &&
    lesson.studentColor
      ? lesson.studentColor
      : "blue"
  );


  updateModalVisibility();

  modal.classList.remove(
    "hidden"
  );

}


/* =========================================================
   COLORS
========================================================= */

function selectStudentColor(
  color
) {

  document
    .querySelectorAll(
      ".color-option"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "selected",
          button.dataset.color === color
        );

      }
    );

}


function getSelectedStudentColor() {

  const selected =
    document.querySelector(
      ".color-option.selected"
    );


  return selected
    ? selected.dataset.color
    : "blue";

}


/* =========================================================
   MODAL VISIBILITY
========================================================= */

function updateModalVisibility() {

  const status =
    document.getElementById(
      "slotStatus"
    ).value;


  const studentGroup =
    document.getElementById(
      "studentGroup"
    );


  const colorGroup =
    document.getElementById(
      "studentColorGroup"
    );


  const paidGroup =
    document.getElementById(
      "paidCheckbox"
    ).closest(
      ".form-group"
    );


  const stateGroup =
    document.getElementById(
      "lessonState"
    ).closest(
      ".form-group"
    );


  if (
    status === "occupied"
  ) {

    studentGroup.style.display =
      "";

    colorGroup.style.display =
      "";

    paidGroup.style.display =
      "";

    stateGroup.style.display =
      "";

  } else {

    studentGroup.style.display =
      "none";

    colorGroup.style.display =
      "none";

    paidGroup.style.display =
      "none";

    stateGroup.style.display =
      "none";

  }

}


/* =========================================================
   SAVE
========================================================= */

async function saveLesson() {

  if (!activeSlot) {
    return;
  }


  const date =
    activeSlot.date;


  const oldTime =
    activeSlot.time;


  const selectedTime =
    document.getElementById(
      "lessonTime"
    ).value;


  if (!selectedTime) {

    alert(
      "Оберіть час."
    );

    return;

  }


  const status =
    document.getElementById(
      "slotStatus"
    ).value;


  const studentId =
    document.getElementById(
      "studentSelect"
    ).value;


  if (
    status === "occupied" &&
    !studentId
  ) {

    alert(
      "Оберіть учня."
    );

    return;

  }


  /*
    Видаляємо старий запис.
  */

  deleteLesson(
    date,
    oldTime
  );


  /*
    unavailable
  */

  if (
    status === "unavailable"
  ) {

    setLesson(
      date,
      selectedTime,
      {
        status:
          "unavailable",

        time:
          selectedTime,

        date:
          dateKey(date)
      }
    );

  }


  /*
    free
  */

  else if (
    status === "free"
  ) {

    setLesson(
      date,
      selectedTime,
      {
        status:
          "free",

        time:
          selectedTime,

        date:
          dateKey(date)
      }
    );

  }


  /*
    occupied
  */

  else {

    const student =
      getStudent(
        studentId
      );


    if (!student) {
      return;
    }


    const selectedColor =
      getSelectedStudentColor();


    student.color =
      selectedColor;


    setLesson(
      date,
      selectedTime,
      {

        status:
          "occupied",

        studentId:
          studentId,

        studentColor:
          selectedColor,

        paid:
          document.getElementById(
            "paidCheckbox"
          ).checked,

        lessonState:
          document.getElementById(
            "lessonState"
          ).value,

        time:
          selectedTime,

        date:
          dateKey(date)

      }
    );

  }


  await saveState();

  closeLessonModal();

  renderCalendar();

}


/* =========================================================
   DELETE
========================================================= */

async function deleteActiveLesson() {

  if (!activeSlot) {
    return;
  }


  deleteLesson(
    activeSlot.date,
    activeSlot.time
  );


  await saveState();

  closeLessonModal();

  renderCalendar();

}


/* =========================================================
   MODAL CLOSE
========================================================= */

function closeLessonModal() {

  document
    .getElementById(
      "lessonModal"
    )
    .classList.add(
      "hidden"
    );


  activeSlot =
    null;

}


/* =========================================================
   NAVIGATION
========================================================= */

function updateCalendarTitle() {

  const title =
    document.getElementById(
      "calendarTitle"
    );


  if (
    currentView === "day"
  ) {

    title.textContent =
      formatDate(
        currentDate
      );

    return;

  }


  if (
    currentView === "week"
  ) {

    const monday =
      startOfWeek(
        currentDate
      );


    const sunday =
      addDays(
        monday,
        6
      );


    title.textContent =
      `${shortDate(monday)} – ${shortDate(sunday)}`;

    return;

  }


  const month =
    currentDate.toLocaleDateString(
      "uk-UA",
      {
        month: "long",
        year: "numeric"
      }
    );


  title.textContent =
    month.charAt(0).toUpperCase() +
    month.slice(1);

}


function goPrevious() {

  if (
    currentView === "day"
  ) {

    currentDate =
      addDays(
        currentDate,
        -1
      );

  } else if (
    currentView === "week"
  ) {

    currentDate =
      addDays(
        currentDate,
        -7
      );

  } else {

    currentDate =
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      );

  }


  updateCalendarTitle();

  renderCalendar();

}


function goNext() {

  if (
    currentView === "day"
  ) {

    currentDate =
      addDays(
        currentDate,
        1
      );

  } else if (
    currentView === "week"
  ) {

    currentDate =
      addDays(
        currentDate,
        7
      );

  } else {

    currentDate =
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1
      );

  }


  updateCalendarTitle();

  renderCalendar();

}


function goToday() {

  currentDate =
    new Date();

  updateCalendarTitle();

  renderCalendar();

}


/* =========================================================
   VIEW
========================================================= */

function setView(view) {

  currentView =
    view;


  document
    .querySelectorAll(
      ".view-btn"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.view === view
        );

      }
    );


  updateCalendarTitle();

  renderCalendar();

}


/* =========================================================
   EDIT MODE
========================================================= */

function toggleEditMode() {

  editMode =
    !editMode;


  const button =
    document.getElementById(
      "editModeBtn"
    );


  button.textContent =
    editMode
      ? "Завершити редагування"
      : "Редагувати";


  document.body.classList.toggle(
    "edit-mode",
    editMode
  );


  renderCalendar();

}


/* =========================================================
   INIT
========================================================= */

async function init() {

  const calendar =
    document.getElementById(
      "calendar"
    );


  calendar.innerHTML =
    "<div style='padding:30px;text-align:center'>Завантаження розкладу…</div>";


  try {

    await loadCloudSchedule();


  } catch (error) {

    console.error(
      error
    );


    calendar.innerHTML =
      `
        <div style="
          padding:30px;
          text-align:center;
        ">
          Не вдалося завантажити розклад.
          <br><br>
          Перевір налаштування Supabase
          у файлі app.js.
        </div>
      `;

    return;

  }


  /*
    Navigation
  */

  document.getElementById(
    "prevBtn"
  ).addEventListener(
    "click",
    goPrevious
  );


  document.getElementById(
    "nextBtn"
  ).addEventListener(
    "click",
    goNext
  );


  document.getElementById(
    "todayBtn"
  ).addEventListener(
    "click",
    goToday
  );


  /*
    Views
  */

  document
    .querySelectorAll(
      ".view-btn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            setView(
              button.dataset.view
            );

          }
        );

      }
    );


  /*
    Edit
  */

  document.getElementById(
    "editModeBtn"
  ).addEventListener(
    "click",
    toggleEditMode
  );


  /*
    Modal
  */

  document.getElementById(
    "closeModalBtn"
  ).addEventListener(
    "click",
    closeLessonModal
  );


  document.getElementById(
    "cancelModalBtn"
  ).addEventListener(
    "click",
    closeLessonModal
  );


  document.getElementById(
    "saveLessonBtn"
  ).addEventListener(
    "click",
    saveLesson
  );


  document.getElementById(
    "deleteLessonBtn"
  ).addEventListener(
    "click",
    deleteActiveLesson
  );


  document.getElementById(
    "slotStatus"
  ).addEventListener(
    "change",
    updateModalVisibility
  );


  /*
    Colors
  */

  document
    .querySelectorAll(
      ".color-option"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            selectStudentColor(
              button.dataset.color
            );

          }
        );

      }
    );


  /*
    Modal overlay
  */

  document
    .querySelector(
      ".modal-overlay"
    )
    .addEventListener(
      "click",
      closeLessonModal
    );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        closeLessonModal();

      }

    }
  );


  updateCalendarTitle();

  renderCalendar();

}


document.addEventListener(
  "DOMContentLoaded",
  init
);