import {observe,type Settings} from '../radio/model'
import type {Scene} from '../band/scenes'
export function grade(kind:number,scene:Scene,s:Settings,pick?:string){
 const target=scene.stations.find(st=>st.f===scene.home)!,obs=observe(target,s,0),side=scene.mode==='FT8'?'USB':scene.mode
 if(kind===0)return {ok:pick===side,bonus:false}
 const tuned=Math.abs(scene.home-s.vfo)<=(kind===4?10:100)&&!obs.inverted&&obs.inPassband&&s.mode!=='FM'
 if(kind!==3)return {ok:tuned,bonus:false}
 const interference=scene.stations.slice(1).reduce((sum,st)=>sum+observe(st,{...s,qsb:0},0).energy,0)
 const ok=tuned&&obs.energy>.40&&interference<.025
 return {ok,bonus:ok&&s.bw>=1800}
}
