import audioIcon from '../../pic/mic.png';
import videoIcon from '../../pic/video.png';
import './css/style.css';
import { parseCoords } from './js/coords';

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

micBtn.innerHTML = `<img src="${audioIcon}" alt="записать аудио" />`;
videoBtn.innerHTML = `<img src="${videoIcon}" alt="записать видео" />`;

const posts = [];

function formatDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${p(d.getDate())}.` +
    `${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}` +
    ` ${p(d.getHours())}:${p(d.getMinutes())}`
  );
}

function getCoords() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation API недоступен'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  });
}

let modalResolve = null;

function closeModal() {
  modalResolve = null;
  modal.classList.remove('modal_open');
}

function validateModal() {
  const resolver = modalResolve;
  if (!resolver) {
    return;
  }
  try {
    const coords = parseCoords(modalInput.value);
    closeModal();
    resolver(coords);
  } catch (e) {
    modalError.textContent = 'Введите координаты в формате: 51.50851, -0.12572';
    modalInput.classList.add('modal__input_invalid');
  }
}

function cancelModal() {
  const resolver = modalResolve;
  if (!resolver) {
    return;
  }
  closeModal();
  resolver(null);
}

function askCoordsManually() {
  return new Promise((resolve) => {
    modalResolve = resolve;
    modal.classList.add('modal_open');
    modalError.textContent = '';
    modalInput.classList.remove('modal__input_invalid');
    modalInput.focus();
  });
}

modalOk.addEventListener('click', validateModal);
modalCancel.addEventListener('click', cancelModal);
modalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') validateModal();
});

function resolveCoords() {
  return getCoords().catch(() => askCoordsManually());
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
      fill.style.width = `${(media.currentTime / media.duration) * 100}%`;
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
  meta.textContent = `[${post.coords.latitude}, ${post.coords.longitude}] ${String.fromCodePoint(
    0x1f441,
  )}`;
  el.appendChild(meta);

  timeline.prepend(el);
}

function addPost(post) {
  posts.push(post);
  renderPost(post);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) {
    return;
  }

  resolveCoords().then((coords) => {
    if (!coords) return;
    addPost({ type: 'text', data: text, coords, createdAt: Date.now() });
    input.value = '';
  });
});

let recorder = null;
let chunks = [];
let timerId = null;
let seconds = 0;
let pendingSave = false;

const preview = document.createElement('div');
preview.className = 'record-preview';
const previewVideo = document.createElement('video');
previewVideo.muted = true;
previewVideo.playsInline = true;
preview.appendChild(previewVideo);

function showPreview(stream) {
  previewVideo.srcObject = stream;
  previewVideo.play().catch(() => {});
  document.body.appendChild(preview);
}

function hidePreview() {
  previewVideo.srcObject = null;
  if (preview.parentNode) {
    preview.parentNode.removeChild(preview);
  }
}

function handleRecordingStop(finishedRecorder) {
  hidePreview();
  finishedRecorder.stream.getTracks().forEach((t) => t.stop());
  if (!pendingSave) {
    return;
  }
  const blob = new Blob(chunks, { type: finishedRecorder.mimeType });
  const url = URL.createObjectURL(blob);
  const type = finishedRecorder.stream.getVideoTracks().length > 0 ? 'video' : 'audio';
  resolveCoords().then((coords) => {
    if (!coords) {
      URL.revokeObjectURL(url);
      return;
    }
    addPost({ type, data: url, coords, createdAt: Date.now() });
  });
}

function startRecording(constraints) {
  if (recorder) {
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Ваш браузер не поддерживает запись, попробуйте другой');
    return;
  }

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      const currentRecorder = new MediaRecorder(stream);
      recorder = currentRecorder;
      chunks = [];
      pendingSave = false;
      seconds = 0;
      timerEl.textContent = '0 с';

      currentRecorder.addEventListener('dataavailable', (e) => chunks.push(e.data));
      currentRecorder.addEventListener('stop', () => handleRecordingStop(currentRecorder));

      currentRecorder.start();
      if (constraints.video) {
        showPreview(stream);
      }
      form.classList.add('form_recording');
      timerId = setInterval(() => {
        seconds += 1;
        timerEl.textContent = `${seconds} с`;
      }, 1000);
    })
    .catch(() => {
      alert(
        'Не удалось получить доступ к устройству. Выдайте права или используйте другой браузер',
      );
    });
}

function stopRecording(save) {
  if (!recorder) {
    return;
  }
  pendingSave = Boolean(save);
  clearInterval(timerId);
  form.classList.remove('form_recording');
  recorder.stop();
  recorder = null;
}

micBtn.addEventListener('click', () => startRecording({ audio: true }));
videoBtn.addEventListener('click', () => startRecording({ audio: true, video: true }));
okBtn.addEventListener('click', () => stopRecording(true));
cancelBtn.addEventListener('click', () => stopRecording(false));
