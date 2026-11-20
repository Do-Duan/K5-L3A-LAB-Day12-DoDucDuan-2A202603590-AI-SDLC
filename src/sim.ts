import contract from '../game.contract.json';

export type V3 = [number, number, number];
export type InputFrame = { tick: number; move?: [number, number]; cam_yaw_deg?: number; jump?: boolean; interact?: boolean; pulse?: boolean };
export type Scenario = { player?: { pos?: V3; carried?: number; flames?: number }; random_motes?: boolean; random_shades?: boolean; motes?: V3[]; shades?: { id?: string; pos: V3 }[]; lanterns?: { id: string; pos?: V3; deposited?: number; lit?: boolean }[]; time_left_s?: number };
const T = contract.tuning;
const dist = (a: V3, b: V3) => Math.hypot(a[0]-b[0], a[2]-b[2]);
const clamp = (v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export class Simulation {
  tick=0; state:'playing'|'won'|'lost'='playing'; score=0; time:number=T.night1_duration_s; player={pos:[0,0,0] as V3,flames:T.flames,carried:0};
  motes:{id:string;pos:V3}[]=[]; shades:{id:string;pos:V3;state:string;stun:number}[]=[];
  lanterns=Array.from({length:5},(_,i)=>({id:`L${i+1}`,pos:[Math.cos(i*Math.PI*2/5)*18,0,Math.sin(i*Math.PI*2/5)*18] as V3,deposited:0,lit:false}));
  events:{type:'event';tick:number;name:string;data:Record<string,unknown>}[]=[]; prev={interact:false,pulse:false}; invuln=0; cooldown=0; rng:number;
  constructor(seed=1, scenario:Scenario={}) { this.rng=(seed|0)||1; const rand=()=>{this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296;};
    this.motes=Array.from({length:24},(_,i)=>({id:`M${i+1}`,pos:[(rand()-.5)*38,0,(rand()-.5)*38] as V3})); this.shades=[{id:'S1',pos:[12,0,0],state:'chase',stun:0}];
    if(scenario.player){Object.assign(this.player,scenario.player); if(scenario.player.pos)this.player.pos=[...scenario.player.pos];}
    if(scenario.motes)this.motes=scenario.motes.map((pos,i)=>({id:`M${i+1}`,pos:[...pos]}));
    if(scenario.shades)this.shades=scenario.shades.map((s,i)=>({id:s.id??`S${i+1}`,pos:[...s.pos],state:'chase',stun:0}));
    if(scenario.lanterns)for(const x of scenario.lanterns){const l=this.lanterns.find(y=>y.id===x.id);if(l){if(x.pos)l.pos=[...x.pos];if(x.deposited!==undefined)l.deposited=x.deposited;if(x.lit!==undefined)l.lit=x.lit;}}
    if(scenario.time_left_s!==undefined)this.time=scenario.time_left_s;
    if(scenario.random_motes===false&&!scenario.motes)this.motes=[]; if(scenario.random_shades===false&&!scenario.shades)this.shades=[];
  }
  private ev(name:string,data:Record<string,unknown>={}){this.events.push({type:'event',tick:this.tick+1,name,data});}
  step(input:Partial<InputFrame>={}){if(this.state!=='playing')return; const move=input.move??[0,0], mag=Math.hypot(move[0],move[1]), scale=mag>1?1/mag:1, yaw=(input.cam_yaw_deg??0)*Math.PI/180; const x=(move[0]*Math.cos(yaw)+move[1]*Math.sin(yaw))*scale,z=(-move[0]*Math.sin(yaw)+move[1]*Math.cos(yaw))*scale;
    this.player.pos[0]=clamp(this.player.pos[0]+x*T.player_speed/60,-22,22);this.player.pos[2]=clamp(this.player.pos[2]+z*T.player_speed/60,-22,22);
    this.invuln=Math.max(0,this.invuln-1/60);this.cooldown=Math.max(0,this.cooldown-1/60);
    const pulse=!!input.pulse&&!this.prev.pulse, interact=!!input.interact&&!this.prev.interact;
    if(pulse&&this.player.flames>=T.pulse_cost&&this.cooldown<=0){this.player.flames-=T.pulse_cost;this.cooldown=T.pulse_cooldown_s;const ids:string[]=[];for(const s of this.shades)if(dist(s.pos,this.player.pos)<=T.pulse_radius){s.state='stunned';s.stun=T.pulse_stun_s;const dx=s.pos[0]-this.player.pos[0],dz=s.pos[2]-this.player.pos[2],d=Math.hypot(dx,dz)||1;s.pos[0]+=dx/d*T.pulse_push_m;s.pos[2]+=dz/d*T.pulse_push_m;ids.push(s.id);this.score+=T.score.per_stun;}this.ev('pulse',{stunned_ids:ids});}
    for(let i=this.motes.length-1;i>=0;i--)if(this.player.carried<T.carry_capacity&&dist(this.motes[i].pos,this.player.pos)<=T.pickup_radius){this.motes.splice(i,1);this.player.carried++;this.score+=T.score.per_mote;this.ev('mote_picked',{carried:this.player.carried});}
    if(interact)for(const l of this.lanterns)if(dist(l.pos,this.player.pos)<=T.interact_radius&&!l.lit&&this.player.carried>0){const n=Math.min(this.player.carried,T.lantern_cost-l.deposited);if(n>0){this.player.carried-=n;l.deposited+=n;this.score+=T.score.per_lantern*n/T.lantern_cost;this.ev('deposit',{lantern_id:l.id,amount:n,deposited:l.deposited});if(l.deposited>=T.lantern_cost){l.lit=true;this.score+=T.score.per_lantern;this.ev('lantern_lit',{lantern_id:l.id});}}break;}
    for(const s of this.shades){if(s.stun>0){s.stun=Math.max(0,s.stun-1/60);if(!s.stun)s.state='chase';continue;}const safe=this.lanterns.some(l=>l.lit&&dist(l.pos,s.pos)<T.safe_radius);if(!safe){const dx=this.player.pos[0]-s.pos[0],dz=this.player.pos[2]-s.pos[2],d=Math.hypot(dx,dz)||1;s.pos[0]+=dx/d*T.shade_speed/60;s.pos[2]+=dz/d*T.shade_speed/60;}if(dist(s.pos,this.player.pos)<T.shade_hit_radius&&this.invuln<=0){this.player.flames--;this.invuln=T.invuln_s;const dropped=Math.floor(this.player.carried*T.hit_drop_ratio);this.player.carried-=dropped;for(let j=0;j<dropped;j++)this.motes.push({id:`M${this.motes.length+1}`,pos:[...this.player.pos]});this.ev('player_hit',{by:'shade',flames:this.player.flames,dropped});if(this.player.flames<=0)this.finish('lost','no_flames');}}
    this.tick++;this.time=Math.max(0,this.time-1/60);if(this.lanterns.every(l=>l.lit))this.finish('won','all_lit');else if(this.time<=0)this.finish('lost','dawn');this.prev={pulse:!!input.pulse,interact:!!input.interact};
  }
  finish(state:'won'|'lost',reason:string){if(this.state!=='playing')return;this.state=state;if(state==='won')this.score+=Math.floor(this.time)*T.score.per_second_left+this.player.flames*T.score.per_flame_left;this.ev('game_over',{result:state,reason});}
  snapshot(){return {type:'snapshot',tick:this.tick,sim_tick:this.tick,state:this.state,time_left_s:+this.time.toFixed(3),score:this.score,player:{pos:this.player.pos.map(v=>+v.toFixed(3)),flames:this.player.flames,carried:this.player.carried},lanterns:this.lanterns.map(l=>({id:l.id,pos:l.pos,lit:l.lit,deposited:l.deposited})),shades:this.shades.map(s=>({id:s.id,pos:s.pos.map(v=>+v.toFixed(3)),state:s.state})),motes_active:this.motes.length};}
  takeEvents(){const e=this.events;this.events=[];return e;}
}
