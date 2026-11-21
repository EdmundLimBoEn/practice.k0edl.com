import worklet from '../dsp/ssb-worklet?worker&url'
import {analytic,synthetic,clipRate} from '../dsp/analytic'
import type {Settings} from './model'
import type {Station} from '../band/scenes'
export class Audio {
 ctx?:AudioContext;node?:AudioWorkletNode;recorded=false
 async toggle(){if(this.node&&this.ctx){if(this.ctx.state==='running')await this.ctx.suspend();else await this.ctx.resume();return}
 this.ctx??=new AudioContext();await this.ctx.resume()
 await this.ctx.audioWorklet.addModule(worklet)
 const clips=[];const manifest=await (await fetch('/audio/manifest.json')).json()
 for(const file of manifest.voice.slice(0,8)){try{const url=new URL(file,location.origin+'/audio/voice/');if(url.origin!==location.origin)continue
 const buffer=await this.ctx.decodeAudioData(await (await fetch(url)).arrayBuffer()),raw=buffer.getChannelData(0),len=Math.min(2**19,2**Math.ceil(Math.log2(buffer.duration*clipRate)))
 const samples=Float32Array.from({length:len},(_,i)=>raw[Math.floor(i*buffer.sampleRate/clipRate)]??0);clips.push(analytic(samples));this.recorded=true}catch{/* Use remaining recordings or the built-in voice. */}}
 if(!clips.length)for(let i=1;i<=5;i++)clips.push(synthetic(i))
 this.node=new AudioWorkletNode(this.ctx,'practice-receiver',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1]});this.node.port.postMessage({clips});this.node.connect(this.ctx.destination)}
 update(state:Settings,stations:Station[]){this.node?.port.postMessage({state,stations,time:Date.now()/1000})}
}
