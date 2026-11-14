(() => {
  const trigger = document.querySelector('.question-contact');
  const dialog = document.querySelector('#question-dialog');
  const form = document.querySelector('#question-form');
  if (!trigger || !dialog || !form) return;

  const closeButton = dialog.querySelector('.question-dialog__close');
  const submitButton = form.querySelector('[type="submit"]');
  const status = form.querySelector('#question-status');
  let requestId = null;
  let requestFingerprint = '';
  let submitting = false;

  trigger.addEventListener('click', () => {
    dialog.showModal();
    document.body.classList.add('question-form-open');
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('question-form-open');
    trigger.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) dialog.close();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    const values = new FormData(form);
    const payload = {
      name: String(values.get('name') || '').trim(),
      email: String(values.get('email') || '').trim(),
      question: String(values.get('question') || '').trim(),
      consent: values.get('consent') === 'on',
      website: String(values.get('website') || ''),
      page: window.location.href
    };
    if (!payload.name || !payload.question) {
      status.hidden = false;
      status.textContent = 'Заполните имя и вопрос';
      return;
    }
    const fingerprint = JSON.stringify(payload);
    if (fingerprint !== requestFingerprint) {
      requestFingerprint = fingerprint;
      requestId = crypto.randomUUID();
    }
    payload.request_id = requestId;
    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Отправляем…';
    form.setAttribute('aria-busy', 'true');
    status.hidden = true;
    const fields = form.querySelectorAll('input, textarea');
    fields.forEach(field => { field.disabled = true; });
    let userMessage = 'Не удалось отправить вопрос. Попробуйте ещё раз - текст остался в форме';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        const errors = {
          rate_limited: 'Слишком много отправок подряд. Попробуйте чуть позже',
          validation_error: 'Проверьте имя, email и текст вопроса',
          request_conflict: 'Данные обращения изменились. Попробуйте отправить ещё раз'
        };
        if (result.error === 'request_conflict') requestFingerprint = '';
        userMessage = errors[result.error] || userMessage;
        throw new Error(userMessage);
      }
      form.reset();
      requestId = null;
      requestFingerprint = '';
      status.textContent = 'Вопрос отправлен. Ответ придёт на указанный email';
    } catch (error) {
      status.textContent = userMessage;
      if (error.name === 'AbortError') {
        status.textContent = 'Отправка заняла больше времени. Попробуйте ещё раз - текст остался в форме';
      }
    } finally {
      window.clearTimeout(timeout);
      submitting = false;
      fields.forEach(field => { field.disabled = false; });
      submitButton.disabled = false;
      submitButton.textContent = 'Отправить вопрос';
      form.removeAttribute('aria-busy');
      status.hidden = false;
    }
  });
})();
