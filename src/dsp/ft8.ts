const sync=[3,1,4,0,6,5,2]
export function symbols(seed:number){return Uint8Array.from({length:79},(_,i)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return i<7?sync[i]:i>=36&&i<43?sync[i-36]:i>=72?sync[i-72]:seed>>>29})}
export function symbolAt(t:number){const i=Math.floor(((t%15)-.5)*6.25);return i>=0&&i<79?i:-1}
