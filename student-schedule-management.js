(() => {
  const DAYS = [
    [1, 'Понеділок'], [2, 'Вівторок'], [3, 'Середа'], [4, 'Четвер'],
    [5, 'П’ятниця'], [6, 'Субота'], [7, 'Неділя']
  ];

  const esc = value => {
    const node = document.createElement('span');
    node.textContent = value == null ? '' : String(value);
    return node.innerHTML;
  };
  const isoToday = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const dateLabel = value => {
    if (!value) return 'дата невідома';
    const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const timeLabel = value => String(value || '').slice(0, 5);

  function addStyle() {
    if (document.getElementById('student-schedule-feature-style')) return;
    const style = document.createElement('style');
    style.id = 'student-schedule-feature-style';
    style.textContent = `
      .student-schedule-feature{margin:14px 0;padding:12px;border:1px solid var(--border,#cbd5e1);border-radius:10px;background:var(--card-bg,#fff);color:var(--text,#1e293b)}
      .student-schedule-feature h3{margin:0 0 8px;font-size:1rem}
      .student-schedule-feature .ssf-muted{color:var(--text-muted,#64748b);font-size:.82rem;line-height:1.4}
      .student-schedule-feature .ssf-row{display:flex;align-items:center;gap:8px;margin:7px 0}
      .student-schedule-feature .ssf-row select,.student-schedule-feature .ssf-row input{min-width:0;padding:7px;border:1px solid #cbd5e1;border-radius:7px}
      .student-schedule-feature .ssf-row select{flex:1}
      .student-schedule-feature .ssf-row input[type=time]{width:112px}
      .student-schedule-feature .ssf-conflict{margin:8px 0;padding:9px;border:1px solid #f59e0b;border-radius:8px;background:#fffbeb;font-size:.82rem}
      .student-schedule-feature .ssf-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      .student-schedule-feature .ssf-actions button{padding:7px 9px}
      .student-schedule-feature .ssf-rule-label{font-weight:700}
      .student-schedule-feature .ssf-toggle{display:flex;align-items:center;gap:8px;margin:9px 0}
      .student-schedule-feature .ssf-toggle input{width:auto}
      .student-schedule-feature .ssf-error{color:#b91c1c;font-size:.82rem}
    `;
    document.head.appendChild(style);
  }

  async function mount(options) {
    const { container, db, scheduleId, student, onChanged, onOpenLesson, confirmAction } = options || {};
    if (!container || !db || !student) return;
    addStyle();
    container.replaceChildren();
    const panel = document.createElement('section');
    panel.className = 'student-schedule-feature';
    panel.innerHTML = '<h3>🗓️ Графік учня</h3><div class="ssf-body"><span class="ssf-muted">Завантаження графіка…</span></div>';
    container.appendChild(panel);
    const body = panel.querySelector('.ssf-body');

    if (student.archivedAt) {
      body.innerHTML = '<div class="ssf-muted">Учень заархівований. Нові уроки не створюються; уже заплановані залишаються в розкладі.</div>';
      return;
    }

    let rules = [];
    let enabled = false;
    let conflicts = [];
    let loadError = null;

    async function load() {
      const [settingsResult, rulesResult, conflictResult] = await Promise.all([
        db.from('v2_schedule_settings').select('auto_schedule_enabled').eq('schedule_id', scheduleId).maybeSingle(),
        db.from('v2_student_schedule_rules').select('*').eq('schedule_id', scheduleId).eq('student_id', student.id).order('weekday').order('lesson_time'),
        db.from('v2_schedule_conflicts').select('*').eq('schedule_id', scheduleId).eq('student_id', student.id).is('resolved_at', null).order('occurrence_date').limit(100)
      ]);
      const failed = [settingsResult, rulesResult, conflictResult].find(x => x?.error);
      if (failed) throw failed.error;
      enabled = !!settingsResult.data?.auto_schedule_enabled;
      rules = rulesResult.data || [];
      conflicts = conflictResult.data || [];
      loadError = null;
    }

    function render() {
      const activeRules = rules.filter(rule => rule.is_active);
      const startValue = activeRules.map(rule => rule.starts_on).sort()[0] || isoToday();
      body.replaceChildren();

      const status = document.createElement('div');
      status.className = 'ssf-muted';
      status.textContent = enabled
        ? 'Автоматичне створення увімкнене. Графік діє від дати початку до архівації учня.'
        : 'Автоматичне створення вимкнене. Після налаштування графіка його можна увімкнути тут.';
      body.appendChild(status);

      const toggle = document.createElement('label');
      toggle.className = 'ssf-toggle';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = enabled;
      checkbox.onchange = async () => {
        if (checkbox.checked && confirmAction) {
          const accepted = await confirmAction('Увімкнути автоматичне створення уроків? Для всіх активних графіків будуть створені уроки на найближчі 14 днів.');
          if (!accepted) { checkbox.checked = false; return; }
        }
        checkbox.disabled = true;
        try {
          const result = await db.rpc('v2_set_auto_schedule_enabled', { p_schedule_id: scheduleId, p_enabled: checkbox.checked });
          if (result.error) throw result.error;
          await load();
          render();
          if (onChanged) await onChanged(student.id);
        } catch (error) {
          checkbox.disabled = false;
          checkbox.checked = enabled;
          showError(error);
        }
      };
      toggle.append(checkbox, document.createTextNode('Автоматично створювати уроки'));
      body.appendChild(toggle);

      const startLabel = document.createElement('label');
      startLabel.className = 'ssf-muted';
      startLabel.textContent = 'Початок графіка:';
      const startInput = document.createElement('input');
      startInput.type = 'date';
      startInput.min = isoToday();
      startInput.value = startValue < isoToday() ? isoToday() : startValue;
      startInput.style.cssText = 'display:block;margin:5px 0 10px;padding:7px;border:1px solid #cbd5e1;border-radius:7px;';
      startLabel.appendChild(startInput);
      body.appendChild(startLabel);

      const editor = document.createElement('div');
      editor.className = 'ssf-rules';
      activeRules.forEach(rule => addRuleRow(editor, rule.weekday, timeLabel(rule.lesson_time)));
      if (!activeRules.length) addRuleRow(editor, 1, '16:00');
      body.appendChild(editor);

      const controls = document.createElement('div');
      controls.className = 'ssf-actions';
      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.textContent = '+ Додати час';
      addButton.onclick = () => addRuleRow(editor, 1, '16:00');
      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'primary';
      saveButton.textContent = 'Зберегти графік';
      saveButton.onclick = async () => {
        const entries = Array.from(editor.querySelectorAll('.ssf-rule-row')).map(row => ({
          weekday: Number(row.querySelector('select').value),
          time: row.querySelector('input[type=time]').value
        })).filter(item => item.time);
        if (!startInput.value) { showError('Вкажіть дату початку.'); return; }
        const seen = new Set();
        for (const item of entries) {
          const key = item.weekday + '|' + item.time;
          if (seen.has(key)) { showError('Приберіть повтор однакового дня й часу.'); return; }
          seen.add(key);
        }
        saveButton.disabled = true;
        try {
          const result = await db.rpc('v2_replace_student_schedule', {
            p_student_id: student.id,
            p_start_date: startInput.value,
            p_rules: entries
          });
          if (result.error) throw result.error;
          await load();
          render();
          if (onChanged) await onChanged(student.id);
        } catch (error) {
          saveButton.disabled = false;
          showError(error);
        }
      };
      controls.append(addButton, saveButton);
      body.appendChild(controls);

      if (!activeRules.length) {
        const note = document.createElement('div');
        note.className = 'ssf-muted';
        note.style.marginTop = '8px';
        note.textContent = 'Графік ще не заданий. Додайте один або кілька днів і часів.';
        body.appendChild(note);
      } else {
        const summary = document.createElement('div');
        summary.className = 'ssf-muted';
        summary.style.marginTop = '8px';
        summary.textContent = 'Поточний графік: ' + activeRules.map(rule => {
          const day = DAYS.find(item => item[0] === Number(rule.weekday));
          return (day ? day[1] : 'День?') + ' ' + timeLabel(rule.lesson_time);
        }).join('; ');
        body.appendChild(summary);
      }

      const openConflicts = conflicts.filter(item => item.conflict_kind !== 'generation_error');
      if (conflicts.length) {
        const title = document.createElement('h3');
        title.style.marginTop = '14px';
        title.textContent = 'Потребують узгодження (' + conflicts.length + ')';
        body.appendChild(title);
        conflicts.forEach(conflict => {
          const card = document.createElement('div');
          card.className = 'ssf-conflict';
          const message = document.createElement('div');
          if (conflict.conflict_kind === 'old_new') {
            message.innerHTML = '<b>' + esc(dateLabel(conflict.occurrence_date)) + '</b><br><span class="ssf-rule-label">За старим графіком:</span> ' + lessonText(conflict.old_lesson_id, conflict) +
              '<br><span class="ssf-rule-label">За новим графіком:</span> ' + lessonText(conflict.new_lesson_id, conflict);
          } else if (conflict.conflict_kind === 'occupied_slot') {
            message.innerHTML = '<b>Зайнята година · ' + esc(dateLabel(conflict.occurrence_date)) + ' ' + esc(timeLabel(conflict.slot_time)) + '</b><br>' +
              esc(lessonText(conflict.lesson_id, conflict)) + ' — ' + esc(lessonText(conflict.conflicting_lesson_id, conflict)) +
              '<br>Перенесіть один із цих уроків вручну.';
          } else {
            message.innerHTML = '<b>Не вдалося створити урок · ' + esc(dateLabel(conflict.occurrence_date)) + '</b><br>' + esc(conflict.details || 'Перевірте розклад.');
          }
          card.appendChild(message);
          if (conflict.conflict_kind === 'old_new') {
            const actions = document.createElement('div');
            actions.className = 'ssf-actions';
            const keepOld = document.createElement('button');
            keepOld.textContent = 'Залишити урок за старим графіком';
            keepOld.onclick = () => resolveConflict(conflict, conflict.old_lesson_id);
            const keepNew = document.createElement('button');
            keepNew.textContent = 'Залишити урок за новим графіком';
            keepNew.onclick = () => resolveConflict(conflict, conflict.new_lesson_id);
            actions.append(keepOld, keepNew);
            card.appendChild(actions);
          } else if (conflict.conflict_kind === 'occupied_slot') {
            const actions = document.createElement('div');
            actions.className = 'ssf-actions';
            [conflict.lesson_id, conflict.conflicting_lesson_id].filter(Boolean).forEach(id => {
              const button = document.createElement('button');
              button.textContent = 'Відкрити урок';
              button.onclick = () => onOpenLesson && onOpenLesson(id);
              actions.appendChild(button);
            });
            card.appendChild(actions);
          }
          body.appendChild(card);
        });
      }
      if (!openConflicts.length && conflicts.length) {
        const errorNote = document.createElement('div');
        errorNote.className = 'ssf-muted';
        errorNote.textContent = 'Збій генерації записано для перевірки. Перезавантажте картку, щоб побачити актуальний стан.';
        body.appendChild(errorNote);
      }
    }

    function lessonText(id, conflict) {
      const row = options.lessons?.find(item => String(item.id) === String(id));
      if (row) {
        const name = options.students?.find(item => String(item.id) === String(row.studentId))?.name || student.name;
        return esc(name + ' · ' + dateLabel(row.date) + ' ' + row.time);
      }
      return esc(dateLabel(conflict.occurrence_date) + ' ' + timeLabel(conflict.slot_time));
    }

    function addRuleRow(editor, weekday, value) {
      const row = document.createElement('div');
      row.className = 'ssf-row ssf-rule-row';
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'День тижня');
      select.innerHTML = DAYS.map(([number, label]) => '<option value="' + number + '">' + label + '</option>').join('');
      select.value = String(weekday || 1);
      const time = document.createElement('input');
      time.type = 'time';
      time.step = '60';
      time.value = value || '16:00';
      time.setAttribute('aria-label', 'Час уроку');
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Прибрати';
      remove.onclick = () => {
        if (editor.querySelectorAll('.ssf-rule-row').length > 1) row.remove();
        else { time.value = ''; row.style.display = 'none'; }
      };
      row.append(select, time, remove);
      editor.appendChild(row);
    }

    async function resolveConflict(conflict, keepId) {
      try {
        const result = await db.rpc('v2_resolve_student_schedule_conflict', {
          p_conflict_id: conflict.id,
          p_keep_lesson_id: keepId
        });
        if (result.error) throw result.error;
        await load();
        render();
        if (onChanged) await onChanged(student.id);
      } catch (error) { showError(error); }
    }

    function showError(error) {
      let node = body.querySelector('.ssf-error');
      if (!node) { node = document.createElement('div'); node.className = 'ssf-error'; body.prepend(node); }
      node.textContent = typeof error === 'string' ? error : (error?.message || 'Не вдалося зберегти графік.');
    }

    try { await load(); render(); }
    catch (error) {
      body.innerHTML = '<div class="ssf-error">Графік учня ще не підключений до бази. Потрібно застосувати міграцію Student Schedule Autofill перед використанням.</div>';
      console.error('Student schedule feature load failed:', error);
    }
  }

  window.StudentScheduleFeature = { mount };
})();
