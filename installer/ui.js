// subzer0 setup wizard.

const $ = (id) => document.getElementById(id)
const api = window.setup

const ORDER = ['prepare', 'runtime', 'app', 'shortcuts', 'done']
const steps = [...document.querySelectorAll('#steps li')]

let target = ''
let installedExe = null

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

function markStep(step) {
  const at = ORDER.indexOf(step)
  if (at < 0) return
  for (const item of steps) {
    const index = ORDER.indexOf(item.dataset.step)
    item.classList.toggle('done', index < at || step === 'done')
    item.classList.toggle('active', index === at && step !== 'done')
  }
}

function update(payload) {
  $('progress').hidden = false

  if (typeof payload.percent === 'number') {
    $('fill').style.width = `${Math.min(100, Math.max(0, payload.percent))}%`
    $('percent').textContent = `${Math.round(payload.percent)}%`
  }

  if (payload.file) {
    const speed = payload.speed ? ` · ${formatBytes(payload.speed)}/s` : ''
    $('status').textContent = `${payload.file} · ${formatBytes(payload.done)} / ${formatBytes(
      payload.total
    )}${speed}`
  } else if (payload.status) {
    $('status').textContent = payload.status
  }

  markStep(payload.step)
}

async function boot() {
  let info
  try {
    info = await api.info()
  } catch {
    return
  }

  target = info.defaultPath
  $('path').textContent = target
  $('path').title = target
  $('version').textContent = info.version ? `v${info.version}` : ''
  $('size').textContent = info.size
    ? `${formatBytes(info.size)} of app files · no internet needed`
    : 'no internet needed'
}

async function choose() {
  const picked = await api.choose()
  if (!picked) return
  target = picked
  $('path').textContent = picked
  $('path').title = picked
}

async function startInstall() {
  $('error').hidden = true
  $('action').disabled = true
  $('browse').disabled = true
  $('action').textContent = 'Installing…'
  $('progress').hidden = false
  markStep('prepare')

  const result = await api.install(target)

  if (!result?.ok) {
    $('error').hidden = false
    $('error').textContent = result?.reason || 'Install failed'
    $('action').disabled = false
    $('browse').disabled = false
    $('action').textContent = 'Retry'
    markStep('runtime')
    return
  }

  installedExe = result.exe
  markStep('done')
  $('view-install').hidden = true
  $('view-done').hidden = false
  $('donePath').textContent = result.exe
}

async function launch() {
  await api.launch()
}

api.onProgress(update)

$('min').addEventListener('click', () => api.minimize())
$('close').addEventListener('click', () => api.close())
$('browse').addEventListener('click', () => void choose())
$('action').addEventListener('click', () => void startInstall())
$('launch').addEventListener('click', () => void launch())
$('open').addEventListener('click', () => void api.open())

void boot()
