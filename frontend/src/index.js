import audioIcon from '../../pic/mic.png';
import videoIcon from '../../pic/video.png';
import "./css/style.css";
import { parseCoords } from "./js/coords";

const timeline = document.querySelector('.timeline');
const form = document.querySelector('.add-post');
const input = form.querySelector('.add-post__input');
const micBtn = form.querySelector('.mic-btn');
const videoBtn = form.querySelector('.video-btn');
const recordControls = form.querySelector('.record-controls');
const okBtn = recordControls.querySelector('.record-ok');
const cancelBtn = recordControls.querySelector('.record-cancel');
const timerEl = recordControls.querySelector('.record-timer');
const modal = document.querySelector('.modal');
const modalInput = modal.querySelector('.modal__input');
const modalOk = modal.querySelector('.modal__ok');
const modalCancel = modal.querySelector('.modal__cancel');
const modalError = modal.querySelector('.modal__error');

micBtn.innerHTML = '<img src="' + audioIcon + '" alt="записать аудио" />';
videoBtn.innerHTML = '<img src="' + videoIcon + '" alt="записать видео" />';

let posts = [];

function formatDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2)
    + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function getCoords() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation API недоступен'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  });
}

function askCoordsManually() {
  return new Promise((resolve) => {
    modal.classList.add('modal_open');
    modalError.textContent = '';
    modalInput.classList.remove('modal__input_invalid');
    modalInput.focus();

    const validate = () => {
      try {
        const coords = parseCoords(modalInput.value);
        closeModal();
        resolve(coords);
      } catch (e) {
        modalError.textContent = 'Введите координаты в формате: 51.50851, -0.12572';
        modalInput.classList.add('modal__input_invalid');
      }
    };

    function closeModal() {
      modal.classList.remove('modal_open');
      modalOk.removeEventListener('click', validate);
      modalCancel.removeEventListener('click', onCancel);
      modalInput.removeEventListener('keydown', onEnter);
    }

    function onCancel() {
      closeModal();
      resolve(null);
    }

    function onEnter(e) {
      if (e.key === 'Enter') validate();
    }

    modalOk.addEventListener('click', validate);
    modalCancel.addEventListener('click', onCancel);
    modalInput.addEventListener('keydown', onEnter);
  });
}

async function resolveCoords() {
  try {
    return await getCoords();
  } catch (e) {
    return await askCoordsManually();
  }
}

function buildPlayer(post) {
  const player = document.createElement('div');
  player.className = post.type === 'video' ? 'player player_video' : 'player';

  const media = document.createElement(post.type === 'video' ? 'video' : 'audio');
  media.src = post.data;
  media.preload = 'metadata';
  media.playsInline = true;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'player__play';
  btn.setAttribute('aria-label', 'Воспроизвести');

  const bar = document.createElement('div');
  bar.className = 'player__bar';
  const fill = document.createElement('div');
  fill.className = 'player__fill';
  bar.appendChild(fill);

  if (post.type === 'video') {
    media.className = 'player__screen';
    const frame = document.createElement('div');
    frame.className = 'player__frame';
    frame.appendChild(media);
    frame.appendChild(btn);
    player.appendChild(frame);
    player.appendChild(bar);
  } else {
    player.appendChild(btn);
    player.appendChild(bar);
  }

  const toggle = () => {
    if (media.paused) {
      document.querySelectorAll('.post audio, .post video').forEach((m) => {
        if (m !== media && !m.paused) m.pause();
      });
      media.play();
    } else {
      media.pause();
    }
  };

  media.addEventListener('play', () => player.classList.add('player_playing'));
  media.addEventListener('pause', () => player.classList.remove('player_playing'));
  media.addEventListener('ended', () => {
    player.classList.remove('player_playing');
    fill.style.width = '0%';
  });

  const sync = () => {
    if (media.duration) {
      fill.style.width = (media.currentTime / media.duration) * 100 + '%';
    }
  };
  media.addEventListener('timeupdate', sync);
  media.addEventListener('loadedmetadata', sync);

  btn.addEventListener('click', toggle);
  if (post.type === 'video') {
    media.addEventListener('click', toggle);
  }

  bar.addEventListener('click', (e) => {
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (media.duration) {
      media.currentTime = ratio * media.duration;
    }
  });

  return player;
}

function renderPost(post) {
  const el = document.createElement('div');
  el.className = 'post';

  const date = document.createElement('div');
  date.className = 'post__date';
  date.textContent = formatDate(post.createdAt);
  el.appendChild(date);

  if (post.type === 'text') {
    const content = document.createElement('div');
    content.className = 'post__content';
    content.textContent = post.data;
    el.appendChild(content);
  } else if (post.type === 'audio' || post.type === 'video') {
    el.appendChild(buildPlayer(post));
  }

  const meta = document.createElement('div');
  meta.className = 'post__meta';
  meta.textContent = '[' + post.coords.latitude + ', ' + post.coords.longitude + '] '
    + String.fromCodePoint(0x1F441);
  el.appendChild(meta);

  timeline.prepend(el);
}

function addPost(post) {
  posts.push(post);
  renderPost(post);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  const coords = await resolveCoords();
  if (!coords) return;

  addPost({ type: 'text', data: text, coords, createdAt: Date.now() });
  input.value = '';
});

let recorder = null;
let recordType = null;
let chunks = [];
let timerId = null;
let seconds = 0;
let pendingSave = false;
let activeStream = null;
let previewEl = null;

function showPreview(stream) {
  hidePreview();
  previewEl = document.createElement('div');
  previewEl.className = 'record-preview';
  const screen = document.createElement('video');
  screen.autoplay = true;
  screen.muted = true; 
  screen.srcObject = stream;
  previewEl.appendChild(screen);
  document.body.appendChild(previewEl);
}

function hidePreview() {
  if (!previewEl) return;
  const screen = previewEl.querySelector('video');
  if (screen) screen.srcObject = null;
  previewEl.remove();
  previewEl = null;
}

function startRecording(type) {
  if (recorder) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Ваш браузер не поддерживает запись, попробуйте другой');
    return;
  }

  const constraints = type === 'video' ? { audio: true, video: true } : { audio: true };
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    activeStream = stream;
    recordType = type;
    if (type === 'video') showPreview(stream);

    chunks = [];
    pendingSave = false;
    seconds = 0;
    timerEl.textContent = '0 с';

    recorder = new MediaRecorder(stream);
    recorder.addEventListener('dataavailable', (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    });
    recorder.addEventListener('stop', onRecordingStop);
    recorder.start();

    form.classList.add('form_recording');
    timerId = setInterval(() => {
      seconds += 1;
      timerEl.textContent = seconds + ' с';
    }, 1000);
  }).catch((err) => {
    console.error(err);
    const what = type === 'video' ? 'камере и микрофону' : 'микрофону';
    alert('Не удалось получить доступ к ' + what + '. Выдайте права и попробуйте ещё раз');
  });
}

function onRecordingStop() {
  clearInterval(timerId);
  form.classList.remove('form_recording');
  hidePreview();
  if (activeStream) {
    activeStream.getTracks().forEach((t) => t.stop());
    activeStream = null;
  }

  const type = recordType;
  const mimeType = recorder.mimeType || (type === 'video' ? 'video/webm' : 'audio/webm');
  const saved = pendingSave;
  const data = chunks.slice();

  recorder = null;
  recordType = null;
  chunks = [];
  pendingSave = false;

  if (!saved || data.length === 0) return;

  const blob = new Blob(data, { type: mimeType });
  const url = URL.createObjectURL(blob);
  resolveCoords().then((coords) => {
    if (!coords) return;
    addPost({ type, data: url, coords, createdAt: Date.now() });
  });
}

function stopRecording(save) {
  pendingSave = save;
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  } else {
    clearInterval(timerId);
    form.classList.remove('form_recording');
    hidePreview();
    if (activeStream) {
      activeStream.getTracks().forEach((t) => t.stop());
      activeStream = null;
    }
  }
}

micBtn.addEventListener('click', () => startRecording('audio'));
videoBtn.addEventListener('click', () => startRecording('video'));
okBtn.addEventListener('click', () => stopRecording(true));
cancelBtn.addEventListener('click', () => stopRecording(false));
