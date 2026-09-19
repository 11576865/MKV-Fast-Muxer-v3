import './style.css';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const $ = (id) => document.getElementById(id);

const videoInput = $('videoInput');
const subInput = $('subInput');
const fontInput = $('fontInput');
const muxBtn = $('muxBtn');
const status = $('status');
const logEl = $('log');
const bar = $('bar');
const downloadLink = $('downloadLink');

const ffmpeg = new FFmpeg();
let loaded = false;
let outputURL = null;

ffmpeg.on('log', ({ message }) => {
  logEl.textContent += message + '\n';
  logEl.scrollTop = logEl.scrollHeight;
});

ffmpeg.on('progress', ({ progress }) => {
  if (Number.isFinite(progress) && progress >= 0) {
    bar.style.width = `${Math.min(95, Math.max(8, progress * 95))}%`;
  }
});

function ext(name) {
  const m = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? m[0] : '';
}

function safeOutputName(videoName) {
  return videoName.replace(/\.[^.]+$/, '') + '.mkv';
}

function updateUI() {
  const video = videoInput.files[0];
  const sub = subInput.files[0];
  const font = fontInput.files[0];

  $('videoName').textContent = video?.name ?? '未选择';
  $('subName').textContent = sub?.name ?? '未选择';
  $('fontName').textContent = font?.name ?? '未选择';
  $('outputName').textContent = video ? safeOutputName(video.name) : '—';

  muxBtn.disabled = !(video && sub && font);
}

videoInput.addEventListener('change', updateUI);
subInput.addEventListener('change', updateUI);
fontInput.addEventListener('change', updateUI);
updateUI();

async function loadFFmpeg() {
  if (loaded) return;

  status.textContent = '正在从本机加载 ffmpeg.wasm 核心（约 31 MB）……';
  bar.style.width = '8%';

  const coreBase = new URL('ffmpeg-core/', window.location.href).href;
  const classWorkerURL = new URL('ffmpeg-class-worker/worker.js', window.location.href).href;

  const slowTimer = setTimeout(() => {
    status.textContent = '核心仍在加载。若持续超过约 30 秒，请查看 Termux 输出和浏览器开发者日志。';
  }, 15000);

  try {
    await ffmpeg.load({
      coreURL: `${coreBase}ffmpeg-core.js`,
      wasmURL: `${coreBase}ffmpeg-core.wasm`,
      classWorkerURL,
    });
  } finally {
    clearTimeout(slowTimer);
  }

  loaded = true;
  status.textContent = 'ffmpeg.wasm 已从本机加载。';
  bar.style.width = '12%';
}

async function removeQuietly(path) {
  try { await ffmpeg.deleteFile(path); } catch {}
}

muxBtn.addEventListener('click', async () => {
  const video = videoInput.files[0];
  const sub = subInput.files[0];
  const font = fontInput.files[0];
  if (!video || !sub || !font) return;

  const videoExt = ext(video.name);
  const subExt = ext(sub.name);
  const fontExt = ext(font.name);

  if (!['.mp4', '.mkv', '.webm', '.mov', '.m4v'].includes(videoExt)) {
    status.textContent = '请选择 MP4 / MKV / WebM / MOV / M4V 视频文件。';
    return;
  }
  if (subExt !== '.ass') {
    status.textContent = '字幕必须是 .ass 文件。';
    return;
  }
  if (!['.ttf', '.otf'].includes(fontExt)) {
    status.textContent = '字体必须是 .ttf 或 .otf 文件。';
    return;
  }

  muxBtn.disabled = true;
  downloadLink.classList.add('hidden');
  logEl.textContent = '';
  bar.style.width = '4%';

  if (outputURL) {
    URL.revokeObjectURL(outputURL);
    outputURL = null;
  }

  const videoPath = `input${videoExt}`;
  const subPath = 'subtitle.ass';
  const fontPath = `font${fontExt}`;
  const outputPath = 'output.mkv';
  const outputName = safeOutputName(video.name);
  const fontMime = fontExt === '.otf' ? 'font/otf' : 'font/ttf';

  try {
    await loadFFmpeg();

    status.textContent = '正在把文件载入浏览器内存……';
    bar.style.width = '20%';

    await ffmpeg.writeFile(videoPath, await fetchFile(video));
    await ffmpeg.writeFile(subPath, await fetchFile(sub));
    await ffmpeg.writeFile(fontPath, await fetchFile(font));

    status.textContent = '正在无损封装 MKV……';
    bar.style.width = '40%';

    const code = await ffmpeg.exec([
      '-i', videoPath,
      '-i', subPath,
      '-map', '0:v?',
      '-map', '0:a?',
      '-map', '1:0',
      '-map_metadata', '0',
      '-map_chapters', '0',
      '-c', 'copy',
      '-metadata:s:s:0', 'language=zho',
      '-metadata:s:s:0', 'title=简体中文 ASS',
      '-disposition:s:0', 'default',
      '-attach', fontPath,
      '-metadata:s:t:0', `mimetype=${fontMime}`,
      '-metadata:s:t:0', `filename=${font.name}`,
      outputPath,
    ]);

    if (code !== 0) {
      throw new Error(`FFmpeg 返回错误代码 ${code}`);
    }

    status.textContent = '正在准备保存……';
    bar.style.width = '96%';

    const data = await ffmpeg.readFile(outputPath);
    outputURL = URL.createObjectURL(
      new Blob([data.buffer], { type: 'video/x-matroska' })
    );

    downloadLink.href = outputURL;
    downloadLink.download = outputName;
    downloadLink.textContent = `保存 ${outputName}`;
    downloadLink.classList.remove('hidden');

    bar.style.width = '100%';
    status.textContent = '完成。视频/音频未重新编码；字幕和字体已写入 MKV。';

    videoInput.value = '';
    subInput.value = '';
    updateUI();
  } catch (err) {
    console.error(err);
    logEl.textContent += `ERROR: ${err?.stack || err}\n`;
    status.textContent = `失败：${err?.message || err}`;
    bar.style.width = '0%';
  } finally {
    await removeQuietly(videoPath);
    await removeQuietly(subPath);
    await removeQuietly(fontPath);
    await removeQuietly(outputPath);
    muxBtn.disabled = !(videoInput.files[0] && subInput.files[0] && fontInput.files[0]);
  }
});
