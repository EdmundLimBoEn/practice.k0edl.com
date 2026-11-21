import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './ui/style.css'
import {C} from './ui/copy'
import {icon} from './ui/icons'
import {Scope} from './ui/scope'
import {bands} from './band/plans'
import {scenes,qrmScene,type Scene,type Mode} from './band/scenes'
import {Audio} from './radio/audio'
import {clamp,defaults,freq,observe,parseFrequency,presets} from './radio/model'
import {grade} from './exercises/scoring'
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const names=[C.side,C.tune,C.hole,C.qrm,C.fine],drillIcons=['headphones','crosshair','radar','list-filter','locate-fixed']
const state={...defaults},audio=new Audio()
let scene=scenes[0],drill=-1,question=0,difficulty=0,score=Number(localStorage.getItem('practice-score')??0),done=false,elapsed=Date.now(),busy=false
const start=elapsed
document.title=C.brand+' '+C.practice
const button=(id:string,label:string,cls='',title='')=>'<button id="'+id+'" class="'+cls+'"'+(title?' title="'+title+'" aria-label="'+title+'"':'')+'>'+label+'</button>'
const head=(ic:string,title:string,extra='')=>'<div class="cardhead">'+icon(ic)+'<h2>'+title+'</h2>'+extra+'</div>'
const range=(id:string,label:string,min:number,max:number,step:number)=>'<label class="rangeline" for="'+id+'"><span>'+label+'</span><output id="'+id+'Val"></output></label><input type="range" id="'+id+'" min="'+min+'" max="'+max+'" step="'+step+'">'
const sceneIcon=(s:Scene)=>s.mode==='FT8'?'chart-no-axes-column-increasing':s.mode==='FM'?'radio-tower':'audio-waveform'
const rows=scenes.map((s,i)=>'<button class="sceneRow" data-scene="'+i+'"><span class="sceneIcon">'+icon(sceneIcon(s))+'</span><span><b>'+s.name+'</b><small>'+(s.home/1e6).toFixed(3)+' '+C.mhz+'</small></span>'+icon('chevron-right')+'</button>').join('')
const badge=(label:string)=>'<span class="badge">'+label+'</span>'
$('app').innerHTML='<header>'+button('nav',icon('panel-left'),'topIcon',C.menu)+'<div class="brand"><span class="mark">'+icon('audio-waveform')+'</span><strong>'+C.brand+'</strong><span>'+C.practice+'</span></div><span class="sst">'+C.course+'</span><div class="topSpacer"></div><div class="clocks">'+icon('clock-3')+'<span id="clock"></span><em>'+C.utc+'</em><span class="divider"></span>'+icon('timer')+'<span id="timer"></span></div>'+button('tools',icon('wrench')+C.tools,'top')+button('help',icon('circle-help')+C.help,'top')+button('audio',icon('volume-2')+'<span>'+C.audio+'</span>','audio')+'</header>'+
 '<aside id="side"><div class="sideLabel">'+C.scenes+'</div>'+rows+'<div class="sideLabel drillsLabel">'+C.drills+'</div>'+names.map((n,i)=>'<button class="drillRow" data-drill="'+i+'">'+icon(drillIcons[i])+n+'</button>').join('')+'<div class="sideFoot">'+icon('antenna')+'<div><b>'+C.navFooter+'</b><small>'+C.sim+'</small></div></div></aside><main>'+
 '<div class="station"><div><div class="eyebrow"><span class="statusDot"></span>'+C.console+'</div><h1 id="title"></h1><div class="meta" id="meta"></div></div><div class="overlay"><label for="plan">'+C.bandPlan+'</label><select id="plan"><option>'+C.fcc+'</option><option>'+C.r3+'</option></select></div></div>'+
 '<section class="monitor"><div class="scopehead">'+icon('activity')+'<h2>'+C.scope+'</h2><span class="live"><span class="statusDot"></span>'+C.live+'</span><div class="scopeTools">'+button('minus',icon('zoom-out'),'',C.zoomOut)+button('plus',icon('zoom-in'),'',C.zoomIn)+'</div></div><div id="strip"></div><div class="scopeBody"><div class="scopeChip"><b>'+C.main+'</b> <span id="chip"></span></div><canvas id="scope" aria-label="'+C.scopeInfo+'"></canvas></div><div class="scopefoot"><span>'+icon('mouse-pointer-2')+C.cursor+'</span><span>'+icon('move-horizontal')+C.drag+'</span><span>'+icon('zoom-in')+C.scroll+'</span><div class="spacer"></div><span id="span"></span><span id="delta"></span></div></section>'+
 '<section id="training" class="card" hidden></section><div class="panels"><section class="card receiver">'+head('sliders-horizontal',C.receiver,badge(C.rx))+'<div class="body"><div class="frequencyRow"><div><label for="frequency">'+C.vfo+'</label><div class="freqBox"><input id="frequency" inputmode="decimal" aria-label="'+C.enter+'"><span>'+C.mhz+'</span></div></div><div class="bandBox"><label for="band">'+C.band+'</label><select id="band">'+bands.map(b=>'<option value="'+b.n+'">'+C.bandFmt(b.n)+'</option>').join('')+'</select></div></div><div class="steps">'+[-1000,-100,-10,10,100,1000].map(v=>'<button data-step="'+v+'">'+(v>0?'+':'−')+(Math.abs(v)===1000?'1k':Math.abs(v))+'</button>').join('')+'</div><div class="controlRow"><label>'+C.mode+'</label><div class="segments" id="modes">'+C.modes.map(m=>button('m'+m,m)).join('')+'</div></div><div class="controlRow"><label>'+C.filter+'</label><div class="segments">'+C.bwPresets.map((f,i)=>button('fil'+i,f)).join('')+'</div></div><div class="slidergrid"><div>'+range('bw',C.bandwidth,500,3600,50)+'</div><div>'+range('shift',C.shift,-1000,1000,50)+'</div></div><div class="slidergrid"><div>'+range('volume',C.volume,0,100,1)+'</div><div id="sqlWrap">'+range('sql',C.sql,0,100,1)+'</div></div></div></section>'+
 '<section class="card conditions">'+head('activity',C.condition)+'<div class="body"><div class="meterTitle"><label>'+C.signal+'</label><b id="sval"></b></div><div id="meter">'+Array.from({length:32},()=>'<b></b>').join('')+'</div><div class="meterlabels">'+['S1','S3','S5','S7','S9','+20'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="snr"><span>'+C.snr+'</span><b id="snr"></b></div><label>'+C.difficulty+'</label><div class="segments dif">'+C.presets.map((p,i)=>button('d'+i,p)).join('')+'</div>'+range('noise',C.noise,-25,12,1)+range('qsb',C.qsb,0,100,1)+'</div></section></div>'+
 '<details class="card notes"><summary>'+icon('book-open')+C.tips+'</summary><p id="note"></p><p>'+C.priv+'</p></details><details class="card notes"><summary>'+icon('radio')+C.stationList+'</summary><div id="stations"></div></details><footer><span class="statusDot"></span>'+C.online+'<span class="spacer"></span><span id="source"></span></footer></main><dialog id="dialog"><div id="dialogbody"></div>'+button('close',C.close)+'</dialog>'
// Presets choose the viewport. All signals on the band remain available while panning.
const bandSignals=new Map(bands.map(b=>[b,scenes.filter(s=>s.band===b).flatMap(s=>s.stations)]))
const air=()=>scene===qrmScene?scene.stations:bandSignals.get(scene.band)!
const scope=new Scope($('scope'),()=>({...scene,stations:air()}),()=>state,f=>tune(f,false),strip)
function strip(){const spans=scope.segments()
 $('strip').innerHTML=spans.map((s,i)=>'<button data-seg="'+i+'" class="seg'+(s.label===C.outside?' out':s.label===C.narrow||s.label===C.digital?' digital':'')+'" style="flex:'+((s.right-s.left)/scope.span)+'">'+C.bandFmt(scene.band.n)+' · '+s.label+'</button>').join('')
 $('span').textContent=C.span+' '+(scope.span/1000).toFixed(scope.span%1000?1:0)+' '+C.khz;$('delta').textContent=C.step+' '+scope.step+' '+C.hz}
function tune(f:number,recenter=true){if(!Number.isFinite(f))return
 const b=bands.find(b=>f>=b.low&&f<=b.high);if(b&&b!==scene.band)load(scenes.find(s=>s.band===b)!,false)
 state.vfo=clamp(Math.round(f),scene.band.low,scene.band.high)
 if(recenter&&(state.vfo<scope.at(.05)||state.vfo>scope.at(.95)))scope.pan(state.vfo);sync()}
function load(s:Scene,resetDrill=true){scene=s;if(resetDrill)drill=-1;state.vfo=s.home;state.mode=s.mode;state.bw=s.mode==='FT8'?3000:2400;state.shift=0;scope.reset();strip();sync();$('side').classList.remove('open')}
function sync(){
 const isDrill=drill>=0;$('title').textContent=isDrill?names[drill]:scene.name
 $('meta').innerHTML=badge(scene.band.n===2?C.vhf:C.hf)+badge(scene.mode==='FT8'?C.digital:scene.mode==='FM'?C.simplex:C.voice)+'<span class="metaDivider"></span><span>'+scene.stations.length+' '+C.stations+'</span>'
 document.querySelectorAll<HTMLElement>('[data-scene]').forEach((el,i)=>el.classList.toggle('selected',!isDrill&&scenes[i]===scene))
 document.querySelectorAll<HTMLElement>('[data-drill]').forEach((el,i)=>el.classList.toggle('selected',drill===i))
 $('chip').textContent=freq(state.vfo);if(document.activeElement!==$('frequency'))$<HTMLInputElement>('frequency').value=freq(state.vfo)
 $<HTMLSelectElement>('band').value=String(scene.band.n)
 C.modes.forEach(m=>$('m'+m).classList.toggle('active',state.mode===m));[2400,1800,500].forEach((bw,i)=>$('fil'+i).classList.toggle('chosen',state.bw===bw))
 C.presets.forEach((_,i)=>$('d'+i).classList.toggle('chosen',difficulty===i))
 for(const k of ['bw','shift','volume','sql','noise','qsb'] as const){const el=$<HTMLInputElement>(k),v=k==='noise'?-state.noise:state[k];el.value=String(v);el.style.setProperty('--fill',(v-Number(el.min))/(Number(el.max)-Number(el.min))*100+'%')
 $(k+'Val').textContent=k==='bw'?(v/1000).toFixed(2)+' '+C.khz:k==='shift'?(v>0?'+':'')+v+' '+C.hz:k==='noise'?v+' '+C.db:v+'%'}
 $('sqlWrap').hidden=state.mode!=='FM';$('bw').toggleAttribute('disabled',state.mode==='FM');$('shift').toggleAttribute('disabled',state.mode==='FM')
 $('source').textContent=audio.recorded?C.clip:C.synthetic
 $('note').textContent=scene.mode==='FM'?C.fmNote:scene.mode==='FT8'?C.ftNote:scene.band.n===40?C.phoneNote:C.highNote
 $('stations').innerHTML=scene.stations.map((st,i)=>'<button data-st="'+i+'">'+freq(st.f+(st.tone??0))+' · '+st.label+'</button>').join('')
 $('training').hidden=!isDrill;audio.update(state,air());meters()}
function targetScene(){return drill===2?scenes[1]:scene}
function exercise(k:number,advance=false){drill=k;if(advance)question++;else question=0;done=false;elapsed=Date.now()
 load(k===3?qrmScene:k===0&&question%2?scenes[1]:scenes[0],false)
 if(k===3)state.bw=3600;if(k===1||k===4)state.vfo+=k===1?3400:190
 $('training').innerHTML=head(drillIcons[k],C.lesson,'<small class="score">'+C.score+' <b id="points">'+score+'</b></small>')+'<div class="exerciseBody"><div><b>'+C.prompts[k]+'</b><p>'+(k===1||k===3?C.target+' · '+freq(scene.home):scene.name)+'</p></div><div class="exerciseActions">'+(k===0?button('pickLSB','LSB')+button('pickUSB','USB'):button('check',C.check,'active'))+button('hint',C.hint)+button('retry',C.retry)+'</div></div><div class="feedback" id="feedback"></div>';sync()}
function check(pick?:string){if(pick){state.mode=pick as Mode;sync()}
 const result=grade(drill,targetScene(),state,pick);if(result.ok&&!done){done=true;score+=result.bonus?2:1;localStorage.setItem('practice-score',String(score));$('points').textContent=String(score)}
 $('feedback').innerHTML=result.ok?(result.bonus?C.bonus:C.correct)+' · '+C.drillTime+' '+Math.floor((Date.now()-elapsed)/1000)+'s '+(drill===0?button('next',C.next):''):C.miss+' '+button('answer',C.answer)}
function meters(){const now=Date.now()/1000,obs=air().map(st=>observe(st,state,now)).sort((a,b)=>b.energy-a.energy)[0]
 const db=obs.snr,bars=clamp(Math.round(10+db*.65),2,32);$('snr').textContent=(db>0?'+':'')+db.toFixed(1)+' '+C.db
 $('sval').textContent='S'+Math.min(9,Math.max(1,Math.round(bars/3)));[...$('meter').children].forEach((el,i)=>el.classList.toggle('lit',i<bars))}
const dialog=(body:string)=>{$('dialogbody').innerHTML=body;$<HTMLDialogElement>('dialog').showModal()}
const endpoint=import.meta.env.VITE_LIVE_ENDPOINT
document.addEventListener('click',async e=>{const el=(e.target as Element).closest('button');if(!el)return
 const id=el.id,d=el.dataset
 if(d.scene!==undefined)return load(scenes[+d.scene])
 if(d.drill!==undefined){exercise(+d.drill);if(!audio.node&&!busy)$('audio').click();return}
 if(d.step)return tune(state.vfo+Number(d.step))
 if(d.st)return tune(scene.stations[+d.st].f)
 if(d.seg){const seg=scope.segments()[+d.seg];scope.zoom(.65);scope.pan((seg.left+seg.right)/2);return}
 if(id==='nav'){if(matchMedia('(max-width:780px)').matches)$('side').classList.toggle('open');else document.body.classList.toggle('compact');return}
 if(id==='audio'){if(busy)return;busy=true;try{await audio.toggle();el.innerHTML=icon('volume-2')+'<span>'+(audio.ctx?.state==='running'?C.playing:C.muted)+'</span>';sync()}catch{el.textContent=C.audioError}finally{busy=false}return}
 if(id==='minus'||id==='plus')return scope.zoom(id==='plus'?.7:1/.7)
 if(id.startsWith('m')&&C.modes.some(m=>'m'+m===id)){const m=id.slice(1);state.mode=m==='SSB'?(state.vfo<1e7?'LSB':'USB'):m as Mode;sync();return}
 if(id.startsWith('fil')){state.bw=[2400,1800,500][+id.slice(3)];sync();return}
 if(/^d\d$/.test(id)){difficulty=+id[1];[state.noise,state.qsb]=presets[difficulty];sync();return}
 if(id==='retry'){const saved=question;exercise(drill, false);if(drill===0&&saved%2)exercise(0,true)}
 if(id==='next')exercise(0,true)
 if(id==='check'||id.startsWith('pick'))check(id.startsWith('pick')?id.slice(4):undefined)
 if(id==='hint')$('feedback').textContent=C.hints[drill]
 if(id==='answer')$('feedback').textContent=drill===3?C.filAnswer:freq(targetScene().home)+' '+(targetScene().mode==='FT8'?'USB':targetScene().mode)
 if(id==='tools')dialog('<h2>'+C.tools+'</h2>'+button('reset',C.reset)+'<h3>'+C.livePartner+'</h3>'+(endpoint?button('liveCheck',C.tryLive):'<p>'+C.disabled+'</p>'))
 if(id==='help')dialog('<h2>'+C.tips+'</h2><p>'+C.cursor+' · '+C.drag+' · '+C.scroll+'</p><p>'+C.enter+'</p><p>'+C.phoneNote+'</p><p>'+C.priv+'</p>')
 if(id==='liveCheck'){try{const r=await fetch(endpoint,{method:'POST'});el.textContent=r.ok?C.ready:C.failed}catch{el.textContent=C.failed}}
 if(id==='reset'){Object.assign(state,defaults);difficulty=0;load(scenes[0]);$<HTMLDialogElement>('dialog').close()}
 if(id==='close')$<HTMLDialogElement>('dialog').close()
})
for(const k of ['bw','shift','volume','sql','noise','qsb'] as const){$(k).oninput=()=>{const v=+$<HTMLInputElement>(k).value;state[k]=k==='noise'?-v:v;if(k==='noise'||k==='qsb')difficulty=-1;sync()}}
$('band').onchange=()=>load(scenes.find(s=>s.band.n===+$<HTMLSelectElement>('band').value)!)
$('plan').onchange=()=>{scope.r3=$<HTMLSelectElement>('plan').selectedIndex===1;strip()}
const input=$<HTMLInputElement>('frequency');input.onfocus=()=>{input.value=(state.vfo/1e6).toFixed(6);input.select()};input.onblur=()=>{tune(parseFrequency(input.value));input.value=freq(state.vfo)}
input.onkeydown=e=>{if(e.key==='Escape')input.value=String(state.vfo/1e6);if(e.key==='Enter'||e.key==='Escape')input.blur()}
document.addEventListener('keydown',e=>{if(e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();tune(state.vfo+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?100:10))}})
Object.defineProperty(window,'__practice',{get:()=>({...state,scene:scene.id,audio:audio.ctx?.state,stations:air().map(st=>({...st,...observe(st,state,Date.now()/1000)})),span:scope.span,center:scope.center})})
function tick(){const now=Date.now();$('clock').textContent=new Date(now).toISOString().slice(11,19);$('timer').textContent=new Date(now-start).toISOString().slice(14,19);meters()}
load(scene);tick();setInterval(tick,300)
