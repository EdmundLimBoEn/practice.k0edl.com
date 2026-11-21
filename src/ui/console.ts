import { C } from './copy'
import { icon } from './icons'
import { scenes, type Scene } from '../band/scenes'
import { bands } from '../band/plans'
export const names = [C.side, C.tune, C.hole, C.qrm, C.fine],
  drillIcons = [
    'headphones',
    'crosshair',
    'radar',
    'list-filter',
    'locate-fixed',
  ]
export const button = (id: string, label: string, cls = '', title = '') =>
  `<button id="${id}" class="${cls}"${title ? ' title="' + title + '" aria-label="' + title + '"' : ''}>${label}</button>`
export const head = (ic: string, title: string, extra = '') => `
  <div class="cardhead">${icon(ic)}<h2>${title}</h2>${extra}</div>`
const range = (
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
) => `
  <label class="rangeline" for="${id}"><span>${label}</span><output id="${id}Val"></output></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}">`
const sceneIcon = (s: Scene) =>
  s.mode === 'FT8'
    ? 'chart-no-axes-column-increasing'
    : s.mode === 'FM'
      ? 'radio-tower'
      : 'audio-waveform'
const rows = scenes
  .map(
    (s, i) =>
      `<button class="sceneRow" data-scene="${i}"><span class="sceneIcon">${icon(sceneIcon(s))}</span><span><b>${s.name}</b><small>${(s.home / 1e6).toFixed(3)} ${C.mhz}</small></span>${icon('chevron-right')}</button>`,
  )
  .join('')
export const badge = (label: string) => `<span class="badge">${label}</span>`
export const consoleView = () => `
  <header>${button('nav', icon('panel-left'), 'topIcon', C.menu)}
  <div class="brand"><span class="mark">${icon('audio-waveform')}</span><strong>${C.brand}</strong><span>${C.practice}</span></div><span class="sst">${C.course}</span>
  <div class="topSpacer"></div>
  <div class="clocks">${icon('clock-3')}<span id="clock"></span><em>${C.utc}</em><span class="divider"></span>${icon('timer')}<span id="timer"></span></div>${button('tools', icon('wrench') + C.tools, 'top')}${button('help', icon('circle-help') + C.help, 'top')}${button('audio', icon('volume-2') + '<span>' + C.audio + '</span>', 'audio')}</header>
  <aside id="side">
  <div class="sideLabel">${C.scenes}</div>${rows}
  <div class="sideLabel drillsLabel">${C.drills}</div>${names.map((n, i) => '<button class="drillRow" data-drill="' + i + '">' + icon(drillIcons[i]) + n + '</button>').join('')}
  <div class="sideFoot">${icon('antenna')}
  <div><b>${C.navFooter}</b><small>${C.sim}</small></div></div></aside>
  <main>
  <div class="station">
  <div>
  <div class="eyebrow"><span class="statusDot"></span>${C.console}</div><h1 id="title"></h1>
  <div class="meta" id="meta"></div></div>
  <div class="overlay">
  <label for="plan">${C.bandPlan}</label>
  <select id="plan"><option>${C.fcc}</option><option>${C.r3}</option></select></div></div>
  <section class="monitor">
  <div class="scopehead">${icon('activity')}<h2>${C.scope}</h2><span class="live"><span class="statusDot"></span>${C.live}</span>
  <div class="scopeTools">${button('minus', icon('zoom-out'), '', C.zoomOut)}${button('plus', icon('zoom-in'), '', C.zoomIn)}</div></div>
  <div id="strip"></div>
  <div class="scopeBody">
  <div class="scopeChip"><b>${C.main}</b> <span id="chip"></span></div>
  <canvas id="scope" aria-label="${C.scopeInfo}"></canvas></div>
  <div class="scopefoot"><span>${icon('mouse-pointer-2')}${C.cursor}</span><span>${icon('move-horizontal')}${C.drag}</span><span>${icon('zoom-in')}${C.scroll}</span>
  <div class="spacer"></div><span id="span"></span><span id="delta"></span></div></section>
  <section id="training" class="card" hidden></section>
  <div class="panels">
  <section class="card receiver">${head('sliders-horizontal', C.receiver, badge(C.rx))}
  <div class="body">
  <div class="frequencyRow">
  <div>
  <label for="frequency">${C.vfo}</label>
  <div class="freqBox"><input id="frequency" inputmode="decimal" aria-label="${C.enter}"><span>${C.mhz}</span></div></div>
  <div class="bandBox">
  <label for="band">${C.band}</label>
  <select id="band">${bands.map((b) => '<option value="' + b.n + '">' + C.bandFmt(b.n) + '</option>').join('')}</select></div></div>
  <div class="steps">${[-1000, -100, -10, 10, 100, 1000].map((v) => '<button data-step="' + v + '">' + (v > 0 ? '+' : '−') + (Math.abs(v) === 1000 ? '1' + C.kilo : Math.abs(v)) + '</button>').join('')}</div>
  <div class="controlRow">
  <label>${C.mode}</label>
  <div class="segments" id="modes">${C.modes.map((m) => button('m' + m, m)).join('')}</div></div>
  <div class="controlRow">
  <label>${C.filter}</label>
  <div class="segments">${C.bwPresets.map((f, i) => button('fil' + i, f)).join('')}</div></div>
  <div class="slidergrid">
  <div>${range('bw', C.bandwidth, 500, 3600, 50)}</div>
  <div>${range('shift', C.shift, -1000, 1000, 50)}</div></div>
  <div class="slidergrid">
  <div>${range('volume', C.volume, 0, 100, 1)}</div>
  <div id="sqlWrap">${range('sql', C.sql, 0, 100, 1)}</div></div></div></section>
  <section class="card conditions">${head('activity', C.condition)}
  <div class="body">
  <div class="meterTitle">
  <label>${C.signal}</label><b id="sval"></b></div>
  <div id="meter">${Array.from({ length: 32 }, () => '<b></b>').join('')}</div>
  <div class="meterlabels">${C.toneScale.map((x) => '<span>' + x + '</span>').join('')}</div>
  <div class="snr"><span>${C.snr}</span><b id="snr"></b></div>
  <label>${C.difficulty}</label>
  <div class="segments dif">${C.presets.map((p, i) => button('d' + i, p)).join('')}</div>${range('noise', C.noise, -25, 12, 1)}${range('qsb', C.qsb, 0, 100, 1)}<label><input id="backgroundQrm" type="checkbox"> ${C.backgroundQrm}</label></div></section></div>
  <details class="card notes"><summary>${icon('book-open')}${C.tips}</summary><p id="note"></p><p>${C.priv}</p></details>
  <details class="card notes"><summary>${icon('radio')}${C.stationList}</summary>
  <div id="stations"></div></details>
  <footer><span class="statusDot"></span>${C.online}<span class="spacer"></span><span id="source"></span></footer></main>
  <dialog id="dialog">
  <div id="dialogbody"></div>${button('close', C.close)}</dialog>`
