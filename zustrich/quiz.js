/* =========================================================================
   Квіз «Індивідуальна онлайн-зустріч»

   НАЛАШТУВАННЯ: вставте сюди адресу вашого Google Apps Script
   (вона закінчується на /exec). Поки рядок порожній, квіз працює повністю,
   але заявки нікуди не відправляються.
   ========================================================================= */
const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyBkkvIJrQKyGiBSogQ636jPziBpNwPmTazPC0Zqi1-MNtDxQBuV095kSRC_TEIv1pbNg/exec';

/* Куди вести після успішної заявки */
const TELEGRAM_CHAT = 'https://t.me/m/9HRGKk6vMGRi';

/* Скільки секунд показувати «Дякую» перед переходом у Telegram */
const REDIRECT_DELAY = 2500;

/* ========================================================================= */

const popup   = document.getElementById('quiz');
const form    = document.getElementById('quizForm');
const footer  = document.getElementById('quizFooter');
const progress= document.getElementById('quizProgress');
const panel   = popup.querySelector('.popup__panel');

const allSteps   = [...form.querySelectorAll('.step')];
const flowSteps  = allSteps.filter(s => ['cover','q','contacts'].includes(s.dataset.step));
const stepResultA= form.querySelector('[data-step="resultA"]');
const stepResultB= form.querySelector('[data-step="resultB"]');

const btnNext   = footer.querySelector('[data-next]');
const btnPrev   = footer.querySelector('[data-prev]');
const btnSubmit = footer.querySelector('[data-submit]');

const NOT_READY = 'Не готов(а) інвестувати гроші і час у своє благополуччя';

let current = flowSteps[0];
let lastFocus = null;

/* ---------- Умовна логіка кроків ---------- */

function groshi(){
  const el = form.querySelector('input[name="Groshi"]:checked');
  return el ? el.value : '';
}

function isVisible(step){
  const hideIf = step.dataset.hideIfGroshi;
  if (hideIf && groshi() === hideIf) return false;

  const showIf = step.dataset.showIfGroshi;
  if (showIf && !showIf.split('|').includes(groshi())) return false;

  return true;
}

function visibleFlow(){
  return flowSteps.filter(isVisible);
}

/* ---------- Навігація ---------- */

function show(step){
  allSteps.forEach(s => s.classList.toggle('is-active', s === step));
  current = step;
  updateChrome();

  const focusable = step.querySelector('input:not([type="radio"]), .btn, input[type="radio"]');
  if (focusable && step.dataset.step !== 'cover') focusable.focus({preventScroll:true});
  panel.scrollTop = 0;
}

function updateChrome(){
  const isResult = current.dataset.step === 'resultA' || current.dataset.step === 'resultB';
  const isCover  = current.dataset.step === 'cover';

  footer.hidden = isCover || isResult;

  const flow = visibleFlow();
  const idx  = flow.indexOf(current);

  btnPrev.hidden   = idx <= 0;
  const isLast     = idx === flow.length - 1;
  btnNext.hidden   = isLast;
  btnSubmit.hidden = !isLast || isCover;

  /* Прогрес рахуємо без обкладинки */
  const total = flow.length - 1;
  const done  = isResult ? total : Math.max(0, idx);
  progress.style.width = total > 0 ? (done / total * 100) + '%' : '0%';
}

function go(delta){
  const flow = visibleFlow();
  const idx  = flow.indexOf(current);
  const next = flow[idx + delta];
  if (next) show(next);
}

function next(){
  if (!validate(current)) return;
  const flow = visibleFlow();
  if (flow.indexOf(current) === flow.length - 1) submit();
  else go(1);
}

/* ---------- Перевірка ---------- */

function setError(holder, message){
  const box = holder.querySelector('.step__error');
  if (box) box.textContent = message || '';
}

function validate(step){
  let ok = true;

  if (step.dataset.step === 'contacts'){
    step.querySelectorAll('.field-row').forEach(row => {
      const input = row.querySelector('.field');
      const error = checkField(input);
      setError(row, error);
      input.classList.toggle('is-invalid', !!error);
      if (error && ok){ ok = false; input.focus({preventScroll:true}); }
    });
    return ok;
  }

  if (step.dataset.required !== '1') return true;

  const name = step.dataset.field;
  const radios = step.querySelectorAll(`input[type="radio"][name="${name}"]`);

  if (radios.length){
    if (!step.querySelector(`input[type="radio"][name="${name}"]:checked`)){
      setError(step, 'Оберіть один з варіантів');
      return false;
    }
    setError(step, '');
    return true;
  }

  const input = step.querySelector('.field');
  if (input){
    const error = checkField(input);
    setError(step, error);
    input.classList.toggle('is-invalid', !!error);
    if (error){ input.focus({preventScroll:true}); return false; }
  }
  return true;
}

function checkField(input){
  const value = input.value.trim();
  if (!value) return 'Заповніть це поле';

  switch (input.dataset.rule){
    case 'phone': {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) return 'Вкажіть номер телефону з кодом країни';
      break;
    }
    case 'name':
      if (value.length < 2) return 'Вкажіть ваше ім’я';
      break;
    case 'telegram':
      if (value.replace(/^@/, '').length < 2) return 'Вкажіть ваш нік у Телеграмі';
      break;
    default:
      if (value.length < 2) return 'Напишіть, будь ласка, трохи детальніше';
  }
  return '';
}

/* ---------- Відправка ---------- */

function collect(){
  const data = {};
  new FormData(form).forEach((value, key) => { data[key] = String(value).trim(); });

  if (data.Telegram) data.Telegram = '@' + data.Telegram.replace(/^@+/, '');

  data.Сторінка = location.href;
  data.Дата = new Date().toLocaleString('uk-UA');
  return data;
}

async function send(data){
  if (!FORM_ENDPOINT){
    console.warn('FORM_ENDPOINT не заповнено — заявку нікуди не відправлено.', data);
    return;
  }

  const body = JSON.stringify(data);

  try {
    /* Без власних заголовків — щоб браузер не слав preflight,
       який Apps Script не обробляє. */
    await fetch(FORM_ENDPOINT, {method:'POST', body, keepalive:true});
  } catch (e){
    try { navigator.sendBeacon(FORM_ENDPOINT, new Blob([body], {type:'text/plain'})); }
    catch (_){ console.error('Не вдалося відправити заявку', e); }
  }
}

async function submit(){
  const ready = groshi() !== NOT_READY;

  btnSubmit.disabled = true;
  btnNext.disabled = true;

  /* Не тримаємо людину більше 4 секунд, навіть якщо мережа гальмує */
  await Promise.race([send(collect()), new Promise(r => setTimeout(r, 4000))]);

  btnSubmit.disabled = false;
  btnNext.disabled = false;

  if (ready){
    show(stepResultA);
    setTimeout(() => { location.href = TELEGRAM_CHAT; }, REDIRECT_DELAY);
  } else {
    show(stepResultB);
  }
}

/* ---------- Відкриття та закриття ---------- */

function openQuiz(){
  lastFocus = document.activeElement;
  popup.hidden = false;
  document.body.classList.add('is-locked');
  show(flowSteps[0]);
  popup.querySelector('[data-next]').focus({preventScroll:true});
}

function closeQuiz(){
  popup.hidden = true;
  document.body.classList.remove('is-locked');
  if (lastFocus) lastFocus.focus({preventScroll:true});
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

/* ---------- Події ---------- */

document.querySelectorAll('[data-open-quiz]').forEach(b => b.addEventListener('click', openQuiz));
document.querySelectorAll('[data-close-quiz]').forEach(b => b.addEventListener('click', closeQuiz));

btnNext.addEventListener('click', next);
btnPrev.addEventListener('click', () => go(-1));
form.addEventListener('submit', e => { e.preventDefault(); next(); });

/* Крок 0 — кнопка на обкладинці */
form.querySelector('.step--cover [data-next]').addEventListener('click', () => go(1));

/* Автоперехід після вибору варіанта */
form.addEventListener('change', e => {
  if (e.target.type !== 'radio') return;
  const step = e.target.closest('.step');
  setError(step, '');
  setTimeout(() => { if (current === step) next(); }, 280);
});

/* Прибираємо помилку, щойно людина почала виправляти */
form.addEventListener('input', e => {
  if (!e.target.classList.contains('field')) return;
  e.target.classList.remove('is-invalid');
  setError(e.target.closest('.field-row') || e.target.closest('.step'), '');
});

/* Enter у полі — крок уперед, а не відправка форми */
form.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList.contains('field')){
    e.preventDefault();
    next();
  }
});

popup.addEventListener('click', e => { if (e.target === popup) closeQuiz(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !popup.hidden) closeQuiz();
});

/* Посилання виду …/zustrich/#quiz одразу відкривають квіз */
if (location.hash === '#quiz' || location.hash === '#popup:quiz') openQuiz();

/* Підстраховка: лінк на результаті A веде туди ж, куди й автоперехід */
document.getElementById('resultAlink').href = TELEGRAM_CHAT;
