import {bands,type Band} from './plans'
import {C} from '../ui/copy'
export type Mode='LSB'|'USB'|'FM'|'FT8'
export type Station={f:number; mode:Mode; label:string; seed:number; gain:number; tone?:number}
export type Scene={id:string;band:Band;name:string;sub:string;home:number;mode:Mode;stations:Station[];span:number}
const special:Record<number,string>={7150000:C.e40,7095000:C.dx40,14195000:C.dx20,14285000:C.qrp,14300000:C.emergency,21295000:C.dx15,21360000:C.emergency,21250000:C.e15}
export const scenes:Scene[]=bands.flatMap(b=>{
 const mode:Mode=b.n===2?'FM':b.home<1e7?'LSB':'USB'
 const scene:Scene={band:b,id:b.n+'v',name:C.sceneTitle(b.n,mode==='FM'?'FM':mode+' '+C.phone),sub:mode==='FM'?C.vhf+' · '+C.simplex:C.hf+' · '+C.voice,home:b.home,mode,span:b.n===2?80000:90000,
 stations:b.voice.map((f,i)=>({f,mode,seed:i+1,gain:0.85+(i%3)*0.1,label:special[f]??(b.n===2?i?C.repeater:C.simplex:C.us)}))}
 return b.ft?[scene,{...scene,id:b.n+'d',name:C.sceneTitle(b.n,'FT8'),sub:C.hf+' · '+C.digital,mode:'FT8',home:b.ft,span:8000,stations:[320,680,1100,1610,2150,2640].map((tone,i)=>({f:b.ft,mode:'FT8',tone,label:C.digital,seed:i+1,gain:.5}))}]:[scene]
})
export const qrmScene:Scene={...scenes[2],id:'qrm',name:C.qrm,span:12000,stations:[0,2000,2500].map((off,i)=>({f:14260000+off,mode:'USB',label:i?C.neighbour:C.target,seed:i+1,gain:i?1.3:1}))}
