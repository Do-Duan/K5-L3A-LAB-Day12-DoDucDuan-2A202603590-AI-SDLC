import contract from '../game.contract.json';

export type V3 = [number, number, number];
export type InputFrame = { tick: number; move?: [number, number]; cam_yaw_deg?: number; jump?: boolean; interact?: boolean; pulse?: boolean; dash?: boolean; pause?: boolean };
export type Scenario = { bench?: boolean; mote_spawn?: boolean; player?: { pos?: V3; carried?: number; flames?: number; invuln_ticks?:number; dash_cd_ticks?:number; pulse_cd_ticks?:number; charm_ticks?:number; successful_lights?:number }; random_motes?: boolean; random_shades?: boolean; random_drifters?:boolean; wind_enabled?:boolean; motes?: V3[]; shades?: { id?: string; pos: V3;state?:string;state_ticks_left?:number;target_lantern_id?:string }[]; drifters?:{id?:string;pos:V3;state?:string;stolen?:number}[]; charms?:{id:string;available?:boolean;respawn_s?:number}[]; lanterns?: { id: string; pos?: V3; deposited?: number; lit?: boolean; fuel?: number; ever_lit?: boolean; relit_count?: number }[]; time_left_s?: number };
const T = contract.tuning;
const dist = (a: V3, b: V3) => Math.hypot(a[0]-b[0], a[2]-b[2]);
const FUEL_U=60, FUEL_MAX_U=T.fuel_max*FUEL_U; // fuel is stored as integer 1/60 units to avoid float drift
const fuelOut=(u:number)=>+(u/FUEL_U).toFixed(1);
const numId=(a:{id:string},b:{id:string})=>a.id.localeCompare(b.id,undefined,{numeric:true});
const REPEL_RADIUS=6; // Ticket-03 §2: shades within 6 m of a lantern are pushed to the edge when it is lit/refuelled to >=30
const clamp = (v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export class Simulation {
  tick=0; simTick=0; night=1; state:'playing'|'won'|'lost'|'paused'='playing'; score=0; timeTicks:number=T.night1_duration_s*60; get time(){return this.timeTicks/60;} set time(v:number){this.timeTicks=Math.round(v*60);} player={pos:[0,0,0] as V3,flames:T.flames,carried:0,successful_lights:0,vel:[0,0,0] as V3,grounded:true};
  motes:{id:string;pos:V3}[]=[]; shades:{id:string;pos:V3;state:string;stun:number;target:string|null;drainTicks:number;push:number;pushFrom:V3|null}[]=[];
  lanterns=([[0,0,25],[23.8,0,7.7],[14.7,0,-20.2],[-14.7,0,-20.2],[-23.8,0,7.7]] as V3[]).map((pos,i)=>({id:`L${i+1}`,pos,deposited:0,lit:false,fuelU:0,ever_lit:false,relit_count:0}));
  events:{type:'event';tick:number;name:string;data:Record<string,unknown>}[]=[]; prev={interact:false,pulse:false,dash:false,pause:false,jump:false}; invuln=0; cooldown=0; dashCd=0; charm=0; dashLeft=0; dashDir:V3=[0,0,0]; jumpVel=0; paused=false; rng:number; drifters:{id:string;pos:V3;state:string;stolen:number;ttl:number}[]=[]; charms:{id:string;pos:V3;available:boolean;respawn:number}[]=[]; nightScore=0; wind={active:false,dir_deg:0};windEnabled=true;autoShades=true;autoDrifters=true;bench=false;moteSpawn=false;moteRng=1;moteSeq=1000;
  constructor(seed=1, scenario:Scenario={}, night=1) { this.night=night;this.bench=!!scenario.bench;this.moteSpawn=!!scenario.mote_spawn;this.moteRng=(((seed|0)||1)^0x9E3779B9)>>>0;this.time=night===1?T.night1_duration_s:night===2?T.night2_duration_s:T.night3_duration_s; if(night===2){this.lanterns=[...[ [0,20],[17,-10],[-17,-10],[70,20],[87,-10],[53,-10] ].map((p,i)=>({id:`L${i+1}`,pos:[p[0],0,p[1]] as V3,deposited:0,lit:false,fuelU:0,ever_lit:false,relit_count:0}))];}if(night===3){const p:[[number,number,number],[number,number,number],[number,number,number],[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[[0,6,6],[18,3,10],[-18,3,10],[35,0,-10],[-35,0,-10],[20,0,-35],[-20,0,-35]];this.lanterns=p.map((v,i)=>({id:`L${i+1}`,pos:[...v],deposited:0,lit:false,fuelU:0,ever_lit:false,relit_count:0}));} this.rng=(seed|0)||1; const rand=()=>{this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296;};
    this.motes=Array.from({length:24},(_,i)=>{const ring=i<8?12:33,angle=i<8?i*Math.PI/4:(i-8)*Math.PI/8;return{id:`M${i+1}`,pos:[Math.cos(angle)*ring,0,Math.sin(angle)*ring] as V3};}); this.shades=[];
    if(scenario.player){Object.assign(this.player,scenario.player); if(scenario.player.pos)this.player.pos=[...scenario.player.pos];}
    if(night===2&&!scenario.motes)this.motes=Array.from({length:24},(_,i)=>{const island=i%2,circle=i%3<1?10:22,a=(i%12)*Math.PI/4;return{id:`M${i+1}`,pos:[island*70+Math.cos(a)*circle,0,Math.sin(a)*circle] as V3};});if(night===3&&!scenario.motes)this.motes=Array.from({length:30},(_,i)=>{const ring=i<18?34:i<26?18:5,a=i<18?i*20*Math.PI/180:i<26?(i-18)*20*Math.PI/180:(i-26)*Math.PI/2+Math.PI/4;const y=i<18?0:i<26?3:6;return{id:`M${i+1}`,pos:[Math.cos(a)*ring,y,Math.sin(a)*ring] as V3};});
    if(scenario.motes)this.motes=scenario.motes.map((pos,i)=>({id:`M${i+1}`,pos:[...pos]}));
    if(scenario.shades)this.shades=scenario.shades.map((s,i)=>({id:s.id??`S${i+1}`,pos:[...s.pos],state:s.state??'wander',stun:0,target:s.target_lantern_id??null,drainTicks:0,push:0,pushFrom:null}));
    if(scenario.lanterns)for(const x of scenario.lanterns){const l=this.lanterns.find(y=>y.id===x.id);if(l){if(x.pos)l.pos=[...x.pos];if(x.deposited!==undefined)l.deposited=x.deposited;if(x.lit!==undefined)l.lit=x.lit;if(l.lit){l.fuelU=Math.round((x.fuel??T.fuel_max)*FUEL_U);l.ever_lit=x.ever_lit??true;}else{l.fuelU=0;l.ever_lit=x.ever_lit??false;}if(x.relit_count!==undefined)l.relit_count=x.relit_count;}}
    if(scenario.time_left_s!==undefined)this.time=scenario.time_left_s;
    if(scenario.player?.invuln_ticks)this.invuln=scenario.player.invuln_ticks/60;if(scenario.player?.dash_cd_ticks)this.dashCd=scenario.player.dash_cd_ticks/60;if(scenario.player?.pulse_cd_ticks)this.cooldown=scenario.player.pulse_cd_ticks/60;if(scenario.player?.charm_ticks)this.charm=scenario.player.charm_ticks/60;
    if(night===2)this.charms=[{id:'C1',pos:[35,0,0],available:true,respawn:0}];if(night===3)this.charms=[{id:'C1',pos:[30,0,25],available:true,respawn:0},{id:'C2',pos:[-30,0,25],available:true,respawn:0}];if(scenario.charms)this.charms=scenario.charms.map((c,i)=>({id:c.id,pos:[...(night===2?[35,0,0]:night===3?i===0?[30,0,25]:[-30,0,25]:[0,0,0])] as V3,available:c.available??true,respawn:c.respawn_s??0}));
    if(night>=2&&!scenario.drifters)this.drifters=[];if(scenario.drifters)this.drifters=scenario.drifters.map((d,i)=>({id:d.id??`D${i+1}`,pos:[...d.pos],state:d.state??'idle',stolen:d.stolen??0,ttl:0}));this.windEnabled=scenario.wind_enabled??true;this.autoDrifters=scenario.random_drifters!==false;
    if(scenario.random_motes===false&&!scenario.motes)this.motes=[]; if(scenario.random_shades===false&&!scenario.shades)this.shades=[];this.autoShades=scenario.random_shades!==false;
  }

  get capacity(){return Math.min(T.capacity_max,T.carry_capacity+2*this.player.successful_lights);}
  /** Opt-in (scenario.mote_spawn, used by the game UI): a new mote appears every mote_spawn_interval_s while the field has fewer than mote_field_max. Own seeded RNG, so other randomness is unaffected. */
  private spawnMote(){
    if(!this.moteSpawn||this.bench||this.simTick%Math.round(T.mote_spawn_interval_s*60)!==0||this.motes.length>=T.mote_field_max)return;
    const rand=()=>{this.moteRng=(Math.imul(this.moteRng,1664525)+1013904223)>>>0;return this.moteRng/4294967296;};
    const island=this.night===2&&rand()<0.5?1:0,cx=island*70,radius=this.night===2?24:this.night===3?40:36;
    const r=radius*Math.sqrt(rand()),a=rand()*Math.PI*2,pos:V3=[+(cx+Math.cos(a)*r).toFixed(3),0,+(Math.sin(a)*r).toFixed(3)];
    const id=`M${this.moteSeq++}`;this.motes.push({id,pos});this.ev('mote_spawned',{id});
  }
  litCount(){return this.lanterns.filter(l=>l.lit).length;}
  litNeeded(){return Math.ceil(+(T.win_ratio*this.lanterns.length).toFixed(9));}
  /** Step 2: fuel decay + drain, then any lantern with fuel<=0 goes out. */
  private fuelStep(){
    if(this.bench)return; // benchmark scene: no fuel decay/drain
    for(const l of this.lanterns)if(l.lit)l.fuelU-=Math.round(T.fuel_decay_per_s*FUEL_U/60);
    for(const s of this.shades)if(s.state==='drain'&&s.target){const l=this.lanterns.find(x=>x.id===s.target);if(l&&l.lit){l.fuelU-=Math.round(T.drain_per_s*FUEL_U/60);s.drainTicks++;if(s.drainTicks%60===0)this.ev('fuel_drain',{lantern_id:l.id,shade_id:s.id,fuel:fuelOut(Math.max(0,l.fuelU))});}}
    for(const l of this.lanterns)if(l.lit&&l.fuelU<=0){l.lit=false;l.fuelU=0;l.deposited=0;l.ever_lit=true;this.ev('lantern_out',{lantern_id:l.id});}
  }
  private receivable(l:{lit:boolean;fuelU:number}){return !l.lit||l.fuelU<FUEL_MAX_U;}
  private interactLantern(){
    const c=this.lanterns.filter(l=>dist(l.pos,this.player.pos)<=T.interact_radius&&this.receivable(l)).sort((a,b)=>dist(a.pos,this.player.pos)-dist(b.pos,this.player.pos)||numId(a,b))[0];
    if(!c||this.player.carried<=0)return;
    if(c.lit){
      const used=Math.min(this.player.carried,Math.ceil((FUEL_MAX_U-c.fuelU)/FUEL_U/T.fuel_per_mote));if(used<=0)return;
      const before=c.fuelU;this.player.carried-=used;c.fuelU=Math.min(FUEL_MAX_U,c.fuelU+T.fuel_per_mote*FUEL_U*used);this.score+=used*T.score.per_mote;
      this.ev('refuel',{lantern_id:c.id,amount:used,fuel:fuelOut(c.fuelU)});
      if(before<T.low_fuel_threshold*FUEL_U&&c.fuelU>=T.low_fuel_threshold*FUEL_U)this.repel(c);
      return;
    }
    const cost=c.ever_lit?T.relight_cost:T.lantern_cost,n=Math.min(this.player.carried,cost-c.deposited);if(n<=0)return;
    this.player.carried-=n;c.deposited+=n;this.score+=n*T.score.per_mote;this.ev('deposit',{lantern_id:c.id,amount:n,deposited:c.deposited});
    if(c.deposited>=cost){const relight=c.ever_lit;c.lit=true;c.fuelU=FUEL_MAX_U;c.ever_lit=true;if(relight)c.relit_count++;this.player.successful_lights++;this.score+=relight?T.score.per_relight:T.score.per_lantern;this.ev('lantern_lit',{lantern_id:c.id,relight});this.repel(c);}
  }
  /** Shades inside the lantern's zone are pushed to its edge over <=30 ticks and cannot hurt the player meanwhile. */
  private repel(l:{pos:V3}){for(const s of this.shades)if(dist(s.pos,l.pos)<REPEL_RADIUS){s.push=30;s.pushFrom=[...l.pos] as V3;if(s.state==='drain'){s.state='wander';s.target=null;}}}
  private stepShade(s:Simulation['shades'][number]){
    const p=this.player.pos;
    if(s.stun>0){s.stun=Math.max(0,s.stun-1/60);if(!s.stun){s.state='wander';s.target=null;}return;}
    if(s.push>0&&s.pushFrom){const f=s.pushFrom,dx=s.pos[0]-f[0],dz=s.pos[2]-f[2],d=Math.hypot(dx,dz)||1,step=Math.max(0,REPEL_RADIUS-d)/s.push;const ux=d===0?1:dx/d,uz=d===0?0:dz/d;s.pos[0]+=ux*step;s.pos[2]+=uz*step;s.push--;return;}
    const byId=(id:string|null)=>this.lanterns.find(l=>l.id===id);
    if(s.state==='drain'){
      const l=byId(s.target);
      if(dist(s.pos,p)<=6){s.state='chase';s.target=null;}
      else if(!l||!l.lit||l.fuelU>=T.low_fuel_threshold*FUEL_U||dist(s.pos,l.pos)>2){s.state='wander';s.target=null;}
    }
    if(s.state==='wander'||s.state==='spawning'){
      if(dist(s.pos,p)<=6)s.state='chase';
      else{
        const weak=this.lanterns.filter(l=>l.lit&&l.fuelU<T.low_fuel_threshold*FUEL_U).sort((a,b)=>dist(a.pos,s.pos)-dist(b.pos,s.pos)||numId(a,b))[0];
        if(weak){
          s.target=weak.id;
          if(dist(s.pos,weak.pos)>2){const dx=weak.pos[0]-s.pos[0],dz=weak.pos[2]-s.pos[2],d=Math.hypot(dx,dz)||1,m=Math.min(T.shade_speed/60,d);s.pos[0]+=dx/d*m;s.pos[2]+=dz/d*m;}
          if(dist(s.pos,weak.pos)<=2){s.state='drain';s.drainTicks=0;}
          return;
        }
        s.target=null;
      }
    }
    if(s.state==='drain')return; // stands still and drains in fuelStep
    const safe=this.lanterns.some(l=>l.lit&&l.fuelU>=T.low_fuel_threshold*FUEL_U&&dist(l.pos,s.pos)<T.safe_radius);
    if(!safe){const dx=p[0]-s.pos[0],dz=p[2]-s.pos[2],d=Math.hypot(dx,dz)||1;s.pos[0]+=dx/d*T.shade_speed/60;s.pos[2]+=dz/d*T.shade_speed/60;}
    if(!this.bench&&dist(s.pos,p)<T.shade_hit_radius&&this.invuln<=0){this.player.flames--;this.invuln=T.invuln_s;const dropped=Math.floor(this.player.carried*T.hit_drop_ratio);this.player.carried-=dropped;for(let j=0;j<dropped;j++)this.motes.push({id:`M${this.motes.length+1}`,pos:[...p]});this.ev('player_hit',{by:'shade',flames:this.player.flames,dropped});if(this.player.flames<=0)this.finish('lost','no_flames');}
  }
  private ev(name:string,data:Record<string,unknown>={}){this.events.push({type:'event',tick:this.tick+1,name,data});}
  step(input:Partial<InputFrame>={}){const pausePress=!!input.pause&&!this.prev.pause;this.prev.pause=!!input.pause;if(pausePress){this.paused=!this.paused;this.state=this.paused?'paused':'playing';this.ev(this.paused?'paused':'resumed');}if(this.paused){this.tick++;return;}if(this.state!=='playing')return; const move=input.move??[0,0], mag=Math.hypot(move[0],move[1]), scale=mag>1?1/mag:1, yaw=(input.cam_yaw_deg??0)*Math.PI/180; const x=(move[0]*Math.cos(yaw)+move[1]*Math.sin(yaw))*scale,z=(-move[0]*Math.sin(yaw)+move[1]*Math.cos(yaw))*scale;
    this.invuln=Math.max(0,this.invuln-1/60);this.cooldown=Math.max(0,this.cooldown-1/60);this.dashCd=Math.max(0,this.dashCd-1/60);this.charm=Math.max(0,this.charm-1/60);this.simTick++;
    const dashPress=!!input.dash&&!this.prev.dash;if(dashPress&&this.dashCd<=0){this.dashDir=[x,z,0];if(Math.hypot(x,z)===0)this.dashDir=[0,1,0];this.dashLeft=T.dash_duration_s;this.dashCd=this.charm>0?0:T.dash_cooldown_s;this.ev('dash');}if(this.dashLeft>0){this.dashLeft=Math.max(0,this.dashLeft-1/60);this.player.pos[0]+=this.dashDir[0]*T.dash_speed/60;this.player.pos[2]+=this.dashDir[1]*T.dash_speed/60;}else{const speed=this.charm>0?7.2:T.player_speed;const bx=this.night===2?[-10,100]:[-46,46],bz=this.night===2?[-32,32]:[-46,46];this.player.pos[0]=clamp(this.player.pos[0]+x*speed/60,bx[0],bx[1]);this.player.pos[2]=clamp(this.player.pos[2]+z*speed/60,bz[0],bz[1]);}
    const jumpPress=!!input.jump&&!this.prev.jump;const onPad=this.night===2?(dist(this.player.pos,[20,0,18])<=1||dist(this.player.pos,[50,0,-18])<=1):this.night===3&&dist(this.player.pos,[0,3,13])<=1;if(onPad&&this.player.grounded){this.jumpVel=this.night===2?14:12;const toward=this.night===2?(this.player.pos[0]<35?1:-1):0;this.player.vel=[this.night===2?toward*24:0,this.jumpVel,this.night===2?0:-8];this.player.grounded=false;}else if(jumpPress&&this.player.grounded){this.jumpVel=6.2;this.player.vel[1]=this.jumpVel;this.player.grounded=false;}if(!this.player.grounded){this.player.pos[0]+=this.player.vel[0]/60;this.player.pos[2]+=this.player.vel[2]/60;this.jumpVel-=20/60;this.player.pos[1]+=this.jumpVel/60;}
    const supported=this.night===2?(dist(this.player.pos,[0,0,0])<=28||dist(this.player.pos,[70,0,0])<=28||(this.player.pos[0]>=26&&this.player.pos[0]<=44&&Math.abs(this.player.pos[2])<=2)):Math.hypot(this.player.pos[0],this.player.pos[2])<=(this.night===1?40:45);if(!supported&&T.fall_enabled&&this.invuln<=0){this.player.flames--;this.player.pos=[0,0,0];this.player.grounded=true;this.jumpVel=0;this.player.vel=[0,0,0];this.invuln=T.invuln_s;this.ev('player_hit',{by:'fall',flames:this.player.flames,dropped:0,lost:0});if(this.player.flames<=0)this.finish('lost','no_flames');}else if(!this.player.grounded){const floor=this.night===3?(Math.hypot(this.player.pos[0],this.player.pos[2])<=8?6:(this.player.pos[2]>0&&Math.hypot(this.player.pos[0],this.player.pos[2])<=24?3:0)):0;if(this.player.pos[1]<=floor){this.player.pos[1]=floor;this.player.grounded=true;this.jumpVel=0;this.player.vel=[0,0,0];}}else{this.player.pos[1]=this.night===3?(Math.hypot(this.player.pos[0],this.player.pos[2])<=8?6:(this.player.pos[2]>0&&Math.hypot(this.player.pos[0],this.player.pos[2])<=24?3:0)):0;}
    const pulse=!!input.pulse&&!this.prev.pulse, interact=!!input.interact&&!this.prev.interact;
    if(pulse&&this.player.flames>=T.pulse_cost&&this.cooldown<=0){this.player.flames-=T.pulse_cost;this.cooldown=T.pulse_cooldown_s;const ids:string[]=[];for(const s of [...this.shades].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})))if(dist(s.pos,this.player.pos)<=T.pulse_radius){const wasDrain=s.state==='drain';s.state='stunned';s.stun=T.pulse_stun_s;s.target=null;s.drainTicks=0;s.push=0;const dx=s.pos[0]-this.player.pos[0],dz=s.pos[2]-this.player.pos[2],d=Math.hypot(dx,dz)||1;s.pos[0]+=dx/d*T.pulse_push_m;s.pos[2]+=dz/d*T.pulse_push_m;ids.push(s.id);this.score+=wasDrain?15:5;}for(const d of this.drifters)if(dist(d.pos,this.player.pos)<=T.pulse_radius){if(d.state==='chase'){d.state='flee';d.ttl=4;}else if(d.state==='flee'&&d.stolen){for(let j=0;j<d.stolen;j++)this.motes.push({id:`M${this.motes.length+1}`,pos:[...d.pos]});this.ev('drifter_drop',{drifter_id:d.id,amount:d.stolen});d.state='removed';}}this.ev('pulse',{stunned_ids:ids});}
    for(let i=this.motes.length-1;i>=0;i--)if(!this.bench&&this.player.carried<this.capacity&&dist(this.motes[i].pos,this.player.pos)<=T.pickup_radius){this.motes.splice(i,1);this.player.carried++;this.ev('mote_picked',{carried:this.player.carried});}
    if(interact)this.interactLantern();
    this.spawnMote();
    this.fuelStep();
    for(const s of this.shades)this.stepShade(s);
    for(const c of this.charms){if(!c.available){c.respawn=Math.max(0,c.respawn-1/60);if(!c.respawn)c.available=true;}if(c.available&&dist(c.pos,this.player.pos)<=T.pickup_radius){c.available=false;c.respawn=45;this.charm=10;this.ev('charm_picked',{charm_id:c.id,charm_ticks:600});}}
    for(const d of this.drifters){if(d.state==='idle'&&this.player.carried>=5&&dist(d.pos,this.player.pos)<=15)d.state='chase';else if(d.state==='chase'&&(this.player.carried<5||dist(d.pos,this.player.pos)>15))d.state='idle';if(d.state==='idle'){d.pos[0]+=Math.cos(this.simTick/90)*2/60;d.pos[2]+=Math.sin(this.simTick/90)*2/60;}else if(d.state==='chase'){const dx=this.player.pos[0]-d.pos[0],dz=this.player.pos[2]-d.pos[2],n=Math.hypot(dx,dz)||1;d.pos[0]+=dx/n*7/60;d.pos[2]+=dz/n*7/60;if(dist(d.pos,this.player.pos)<=1.2){const amount=Math.min(3,this.player.carried);d.stolen=amount;this.player.carried-=amount;d.state='flee';d.ttl=4;this.ev('drifter_steal',{drifter_id:d.id,amount,carried:this.player.carried});}}else if(d.state==='flee'){const dx=d.pos[0]-this.player.pos[0],dz=d.pos[2]-this.player.pos[2],n=Math.hypot(dx,dz)||1;d.pos[0]+=dx/n*7/60;d.pos[2]+=dz/n*7/60;d.ttl-=1/60;if(d.ttl<=0)d.state='removed';}}this.drifters=this.drifters.filter(d=>d.state!=='removed');
    const shadeInterval=this.night===1?480:this.night===2?420:360,shadeMax=this.night===1?6:this.night===2?8:10;if(this.autoShades&&this.simTick>=300&&this.simTick%shadeInterval===300%shadeInterval&&this.shades.length<shadeMax){const id=`S${this.shades.length+1}`;const index=this.shades.length;const angle=((this.night===1?15+index*30:this.night===2?22.5+(index%8)*45:index*22.5)*Math.PI)/180;let centerX=this.night===2&&index%2?70:0;if(this.night===1&&dist([Math.cos(angle)*37,0,Math.sin(angle)*37],this.player.pos)<15)centerX=Math.cos(angle)*-74;const radius=this.night===1?37:this.night===2?26:43;this.shades.push({id,pos:[centerX+Math.cos(angle)*radius,0,Math.sin(angle)*radius],state:'wander',stun:0,target:null,drainTicks:0,push:0,pushFrom:null});this.ev('shade_spawned',{id});}
    if(this.autoDrifters&&this.night>=2&&this.simTick%1200===0&&this.drifters.length<2){const id=`D${this.drifters.length+1}`;this.drifters.push({id,pos:[Math.cos(this.rng%360*Math.PI/180)*30,0,Math.sin(this.rng%360*Math.PI/180)*30],state:'idle',stolen:0,ttl:0});}
    if(this.night===3&&this.windEnabled){const cycle=this.simTick%1800;this.wind.active=cycle>=120&&cycle<420;if(cycle===120)this.wind.dir_deg=(this.rng%360);if(this.wind.active){const a=this.wind.dir_deg*Math.PI/180;this.player.pos[0]+=Math.cos(a)*2/60;this.player.pos[2]+=Math.sin(a)*2/60;}}
    this.tick++;this.timeTicks=Math.max(0,this.timeTicks-1);if(!this.bench&&this.state==='playing'&&this.timeTicks<=0){if(this.player.flames<=0)this.finish('lost','no_flames');else if(this.litCount()>=this.litNeeded())this.finish('won','dawn_survived');else this.finish('lost','dawn');}this.prev={...this.prev,pulse:!!input.pulse,interact:!!input.interact,dash:!!input.dash,jump:!!input.jump};
  }
  finish(state:'won'|'lost',reason:string){if(this.state!=='playing')return;this.state=state;if(state==='won'){for(const l of this.lanterns)if(l.lit)this.score+=T.score.dawn_per_lantern+Math.floor(l.fuelU/FUEL_U);this.score+=this.player.flames*T.score.dawn_per_flame;}this.ev('game_over',{result:state,reason});}
  snapshot(){return {type:'snapshot',tick:this.tick,sim_tick:this.simTick,night:this.night,state:this.state,time_left_s:+this.time.toFixed(3),score:this.score,wind:this.wind,player:{pos:this.player.pos.map(v=>+v.toFixed(3)),vel:this.player.vel,grounded:this.player.grounded,flames:this.player.flames,carried:this.player.carried,capacity:this.capacity,successful_lights:this.player.successful_lights,invuln:+this.invuln.toFixed(3),dash_cd_s:+this.dashCd.toFixed(3),pulse_cd_s:+this.cooldown.toFixed(3),charm_s:+this.charm.toFixed(3)},lanterns:this.lanterns.map(l=>({id:l.id,pos:l.pos,lit:l.lit,deposited:l.deposited,fuel:l.lit?fuelOut(l.fuelU):0,ever_lit:l.ever_lit,relit_count:l.relit_count})),shades:this.shades.map(s=>({id:s.id,pos:s.pos.map(v=>+v.toFixed(3)),state:s.state,target_lantern_id:s.target})),motes:this.motes.map((m,i)=>({id:m.id,pos:m.pos,kind:'random',ttl_s:null})),motes_active:this.motes.length,drifters:this.drifters.map(d=>({id:d.id,pos:d.pos,state:d.state,stolen:d.stolen})),charms:this.charms.map(c=>({id:c.id,available:c.available,respawn_s:c.respawn}))};}
  takeEvents(){const e=this.events;this.events=[];return e;}
}
