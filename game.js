(() => {
"use strict";
const c=document.getElementById("c"),gl=c.getContext("webgl",{antialias:false,alpha:false});
if(!gl){document.body.innerHTML="<pre style='color:#fff'>WebGL non disponibile.</pre>";return}
gl.clearColor(.035,.04,.055,1);

// ============================================================
// AUDIO — tutto sintetizzato al volo (oscillatori Web Audio), nessun file
// da scaricare. Si sblocca al primo click/tasto (i browser bloccano
// l'audio finche' l'utente non interagisce), vedi unlockAudio().
// ============================================================
let actx=null;
function unlockAudio(){
 if(actx)return;
 try{ actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ actx=null; }
}
function tone(freq,dur,type,peak,sweepTo){
 if(!actx)return;
 const t0=actx.currentTime;
 const osc=actx.createOscillator(), gain=actx.createGain();
 osc.type=type||"square"; osc.frequency.setValueAtTime(freq,t0);
 if(sweepTo)osc.frequency.exponentialRampToValueAtTime(Math.max(20,sweepTo),t0+dur);
 gain.gain.setValueAtTime(0,t0);
 gain.gain.linearRampToValueAtTime(peak||.10,t0+.012);
 gain.gain.exponentialRampToValueAtTime(.001,t0+dur);
 osc.connect(gain); gain.connect(actx.destination);
 osc.start(t0); osc.stop(t0+dur+.02);
}
function noiseBurst(dur,peak){
 if(!actx)return;
 const t0=actx.currentTime;
 const bufSize=actx.sampleRate*dur;
 const buf=actx.createBuffer(1,bufSize,actx.sampleRate);
 const data=buf.getChannelData(0);
 for(let i=0;i<bufSize;i++)data[i]=(Math.random()*2-1)*(1-i/bufSize);
 const src=actx.createBufferSource(); src.buffer=buf;
 const gain=actx.createGain(); gain.gain.setValueAtTime(peak||.12,t0);
 gain.gain.exponentialRampToValueAtTime(.001,t0+dur);
 src.connect(gain); gain.connect(actx.destination);
 src.start(t0);
}
const sfx={
 uiBlip:()=>tone(740,.06,"square",.05),
 attack:()=>{tone(180,.09,"square",.09,90);noiseBurst(.05,.06);},
 hitEnemy:()=>tone(320,.07,"sawtooth",.08,140),
 hitPlayer:()=>{tone(110,.16,"sawtooth",.11,60);noiseBurst(.10,.08);},
 dodge:()=>tone(500,.10,"sine",.06,900),
 special:()=>{tone(220,.35,"sawtooth",.13,700);setTimeout(()=>tone(880,.18,"square",.08),90);},
 enemyDefeat:()=>{tone(300,.22,"square",.09,70);},
 transform:()=>{tone(140,.22,"sawtooth",.12,650);setTimeout(()=>tone(760,.12,"square",.09),140);},
 alarm:()=>{tone(660,.16,"square",.10,440);setTimeout(()=>tone(660,.16,"square",.10,440),240);},
 giantHit:()=>tone(150,.20,"sawtooth",.12,80),
 teleport:()=>{tone(300,.28,"sine",.09,1100);setTimeout(()=>tone(900,.10,"sine",.06,1400),120);},
 win:()=>{[0,140,280].forEach((d,i)=>setTimeout(()=>tone(440+i*220,.22,"square",.09),d));},
 lose:()=>{tone(220,.5,"sawtooth",.11,60);},
};

// ------------------------------------------------------------
// Musica d'ambiente: anche questa sintetizzata (droni con oscillatori
// scordati + rumore filtrato per il mare), non file audio. Un bus dedicato
// (musicGain) per poter dissolvere in/out quando si cambia zona invece di
// tagliare di netto. playAmbient(zona) e' idempotente: chiamarla di nuovo
// con la stessa zona non fa nulla, cosi' si puo' richiamare tranquillamente
// ad ogni ingresso zona senza doversi preoccupare di duplicare i droni.
// ------------------------------------------------------------
let musicGain=null, musicNodes=[], musicZone=null;
function ensureMusicGain(){
 if(!actx)return null;
 if(!musicGain){ musicGain=actx.createGain(); musicGain.gain.value=0; musicGain.connect(actx.destination); }
 return musicGain;
}
function makeLoopNoiseBuffer(dur){
 const bufSize=Math.floor(actx.sampleRate*dur);
 const buf=actx.createBuffer(1,bufSize,actx.sampleRate);
 const data=buf.getChannelData(0);
 let last=0;
 for(let i=0;i<bufSize;i++){ const w=Math.random()*2-1; last=(last+.02*w)/1.02; data[i]=last*3.2; }
 return buf;
}
function stopAmbient(fadeTime){
 if(!musicGain)return;
 const t=actx.currentTime, f=fadeTime===undefined?1.0:fadeTime;
 musicGain.gain.cancelScheduledValues(t);
 musicGain.gain.setValueAtTime(musicGain.gain.value,t);
 musicGain.gain.linearRampToValueAtTime(0,t+f);
 const toStop=musicNodes; musicNodes=[];
 setTimeout(()=>{ toStop.forEach(n=>{ try{n.stop();}catch(e){} }); },(f*1000)+150);
}
const AMBIENT_PRESETS={
 // Torre: basso, sparso, quasi immobile — la sensazione di essere osservati
 torre:{base:55,detune:3.5,wave:"sine",vol:.055,filt:850,waves:false},
 // Spiaggia: un pelo piu' teso, con un fondo di mare filtrato
 arena:{base:73,detune:5,wave:"triangle",vol:.05,filt:1300,waves:true},
 colosso:{base:73,detune:5,wave:"triangle",vol:.05,filt:1300,waves:true},
 // Archivio: il piu' spoglio e dissonante di tutti, apposta
 archivio:{base:48,detune:7,wave:"sawtooth",vol:.04,filt:500,waves:false},
};
function playAmbient(zoneKey){
 if(!actx)return;
 const p=AMBIENT_PRESETS[zoneKey];
 if(!p||musicZone===zoneKey)return;
 musicZone=zoneKey;
 stopAmbient(1.0);
 const gain=ensureMusicGain();
 const t=actx.currentTime+0.05;
 const nodes=[];
 for(const df of [0,p.detune]){
  const osc=actx.createOscillator(); osc.type=p.wave;
  osc.frequency.setValueAtTime(p.base+df,t);
  const og=actx.createGain(); og.gain.value=p.vol;
  const filt=actx.createBiquadFilter(); filt.type="lowpass"; filt.frequency.value=p.filt;
  osc.connect(filt); filt.connect(og); og.connect(gain);
  osc.start(t);
  nodes.push(osc);
 }
 const osc2=actx.createOscillator(); osc2.type=p.wave;
 osc2.frequency.setValueAtTime((p.base+p.detune*.5)*2,t);
 const og2=actx.createGain(); og2.gain.value=p.vol*.28;
 osc2.connect(og2); og2.connect(gain);
 osc2.start(t);
 nodes.push(osc2);
 if(p.waves){
  const src=actx.createBufferSource();
  src.buffer=makeLoopNoiseBuffer(4); src.loop=true;
  const wf=actx.createBiquadFilter(); wf.type="lowpass"; wf.frequency.value=480;
  const wg=actx.createGain(); wg.gain.value=.055;
  src.connect(wf); wf.connect(wg); wg.connect(gain);
  src.start(t);
  nodes.push(src);
 }
 musicNodes=nodes;
 gain.gain.cancelScheduledValues(t);
 gain.gain.setValueAtTime(gain.gain.value,t);
 gain.gain.linearRampToValueAtTime(1,t+1.6);
}


// ============================================================
// mat4 minimale
// ============================================================
const mat4={
 identity:()=>new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
 multiply:(a,b)=>{
  const o=new Float32Array(16);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
   let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];
   o[i*4+j]=s;
  }
  return o;
 },
 perspective:(fovy,aspect,near,far)=>{
  const f=1/Math.tan(fovy/2),nf=1/(near-far),o=new Float32Array(16);
  o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;
  return o;
 },
 lookAt:(eye,target,up)=>{
  let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2];
  let zl=Math.hypot(zx,zy,zz)||1;zx/=zl;zy/=zl;zz/=zl;
  let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
  let xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;
  let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
  return new Float32Array([
   xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
   -(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1
  ]);
 },
 translate:(x,y,z)=>new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]),
 rotY:(r)=>{const c=Math.cos(r),s=Math.sin(r);return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1])},
 rotX:(r)=>{const c=Math.cos(r),s=Math.sin(r);return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1])},
 rotZ:(r)=>{const c=Math.cos(r),s=Math.sin(r);return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1])},
 scale:(x,y,z)=>new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]),
};
function mul(...ms){let r=ms[0];for(let i=1;i<ms.length;i++)r=mat4.multiply(r,ms[i]);return r}

// ============================================================
// shader
// ============================================================
function shader(type,src){
 const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(s));
 return s;
}
const vsSrc=`
attribute vec3 aPos;attribute vec3 aNormal;attribute vec3 aColor;
uniform mat4 uMVP;uniform mat4 uModel;
varying vec3 vColor;varying vec3 vNormal;
void main(){
 gl_Position=uMVP*vec4(aPos,1.0);
 vNormal=mat3(uModel)*aNormal;
 vColor=aColor;
}`;
const fsSrc=`
precision mediump float;
varying vec3 vColor;varying vec3 vNormal;
uniform float uAlphaMain;
void main(){
 vec3 n=normalize(vNormal);
 vec3 lightDir=normalize(vec3(.45,.85,.30));
 float diff=max(dot(n,lightDir),0.0);
 float ambient=.46;
 float shade=ambient+diff*.62;
 gl_FragColor=vec4(vColor*shade,uAlphaMain);
}`;
const prog=gl.createProgram();
gl.attachShader(prog,shader(gl.VERTEX_SHADER,vsSrc));
gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,fsSrc));
gl.linkProgram(prog);
gl.useProgram(prog);
const aPos=gl.getAttribLocation(prog,"aPos");
const aNormal=gl.getAttribLocation(prog,"aNormal");
const aColor=gl.getAttribLocation(prog,"aColor");
const uMVP=gl.getUniformLocation(prog,"uMVP");
const uModel=gl.getUniformLocation(prog,"uModel");
const uAlphaMain=gl.getUniformLocation(prog,"uAlphaMain");
gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);

// ------------------------------------------------------------
// secondo programma: quad con texture (per Oculo, che va mostrato come una
// vera immagine appoggiata al muro invece che costruito a scatole — meno
// pesante e molto piu' leggibile di un occhio fatto di cubi)
// ------------------------------------------------------------
const texVsSrc=`
attribute vec3 aPos;attribute vec2 aUV;
uniform mat4 uMVP;
varying vec2 vUV;
void main(){ gl_Position=uMVP*vec4(aPos,1.0); vUV=aUV; }`;
const texFsSrc=`
precision mediump float;
varying vec2 vUV;
uniform sampler2D uTex;
uniform float uAlpha;
void main(){
 vec4 c=texture2D(uTex,vUV);
 gl_FragColor=vec4(c.rgb,c.a*uAlpha);
}`;
const texProg=gl.createProgram();
gl.attachShader(texProg,shader(gl.VERTEX_SHADER,texVsSrc));
gl.attachShader(texProg,shader(gl.FRAGMENT_SHADER,texFsSrc));
gl.linkProgram(texProg);
const texAPos=gl.getAttribLocation(texProg,"aPos");
const texAUV=gl.getAttribLocation(texProg,"aUV");
const texUMVP=gl.getUniformLocation(texProg,"uMVP");
const texUTex=gl.getUniformLocation(texProg,"uTex");
const texUAlpha=gl.getUniformLocation(texProg,"uAlpha");

let fileWarningShown=false;
function showFileProtocolWarning(){
 if(fileWarningShown)return;
 fileWarningShown=true;
 const el=document.getElementById("fileWarning");
 if(el)el.classList.add("show");
}
function loadTexture(url){
 const tex=gl.createTexture();
 gl.bindTexture(gl.TEXTURE_2D,tex);
 // pixel 1x1 come segnaposto finche' l'immagine vera non e' caricata
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([25,60,55,255]));
 const img=new Image();
 img.onload=()=>{
  try{
   gl.bindTexture(gl.TEXTURE_2D,tex);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
   gl.generateMipmap(gl.TEXTURE_2D);
   tex.ready=true;
  }catch(err){
   // I browser bloccano il caricamento delle texture WebGL quando la
   // pagina e' aperta come file:// (doppio click sull'html) invece che
   // tramite un server locale. Le immagini normali (<img>, CSS) funzionano
   // comunque - solo le texture 3D no. Avviso a schermo invece di fallire
   // in silenzio con un rettangolo scuro senza spiegazione.
   console.warn("Texture bloccata (probabile apertura via file://, serve un server locale):",err);
   showFileProtocolWarning();
  }
 };
 img.onerror=()=>{ tex.ready=false; tex.failed=true; };
 img.src=url;
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 return tex;
}
// quad verticale di 1x1 centrato sull'origine, sul piano XY (normale +Z)
const quadBuf=(()=>{
 const pos=new Float32Array([-.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,-.5,0, .5,.5,0, -.5,.5,0]);
 const uv =new Float32Array([0,1, 1,1, 1,0, 0,1, 1,0, 0,0]);
 const posB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,posB);gl.bufferData(gl.ARRAY_BUFFER,pos,gl.STATIC_DRAW);
 const uvB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uvB);gl.bufferData(gl.ARRAY_BUFFER,uv,gl.STATIC_DRAW);
 return {posB,uvB};
})();
function drawTexturedQuad(tex,model,vp,alpha){
 if(!tex||tex.failed)return;
 gl.useProgram(texProg);
 gl.bindBuffer(gl.ARRAY_BUFFER,quadBuf.posB);gl.enableVertexAttribArray(texAPos);gl.vertexAttribPointer(texAPos,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,quadBuf.uvB);gl.enableVertexAttribArray(texAUV);gl.vertexAttribPointer(texAUV,2,gl.FLOAT,false,0,0);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.uniform1i(texUTex,0);
 gl.uniform1f(texUAlpha,alpha===undefined?1:alpha);
 gl.uniformMatrix4fv(texUMVP,false,mat4.multiply(vp,model));
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 gl.depthMask(false);
 gl.drawArrays(gl.TRIANGLES,0,6);
 gl.depthMask(true);gl.disable(gl.BLEND);
 gl.useProgram(prog);
}

// ============================================================
// box builder: unit box centered at origin, size 1x1x1, tinted per face
// ============================================================
function boxMesh(col){
 const p=[],n=[],c=[];
 const faces=[
  // pos, normal
  [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],  // +z
  [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]], // -z
  [[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]], // +x
  [[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]], // -x
  [[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]], // +y
  [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]], // -y
 ];
 const normals=[[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0]];
 for(let f=0;f<6;f++){
  const q=faces[f],nm=normals[f];
  const idx=[0,1,2,0,2,3];
  for(const i of idx){
   p.push(...q[i]);n.push(...nm);c.push(...col);
  }
 }
 return {pos:new Float32Array(p),nrm:new Float32Array(n),col:new Float32Array(c),count:p.length/3};
}
// merge multiple box instances (each with a local transform) into one static buffer
function bakeParts(parts){
 let pos=[],nrm=[],col=[];
 for(const pt of parts){
  const {mesh,mtx}=pt;
  for(let i=0;i<mesh.count;i++){
   const x=mesh.pos[i*3],y=mesh.pos[i*3+1],z=mesh.pos[i*3+2];
   const wx=mtx[0]*x+mtx[4]*y+mtx[8]*z+mtx[12];
   const wy=mtx[1]*x+mtx[5]*y+mtx[9]*z+mtx[13];
   const wz=mtx[2]*x+mtx[6]*y+mtx[10]*z+mtx[14];
   pos.push(wx,wy,wz);
   const nx=mesh.nrm[i*3],ny=mesh.nrm[i*3+1],nz=mesh.nrm[i*3+2];
   const wnx=mtx[0]*nx+mtx[4]*ny+mtx[8]*nz;
   const wny=mtx[1]*nx+mtx[5]*ny+mtx[9]*nz;
   const wnz=mtx[2]*nx+mtx[6]*ny+mtx[10]*nz;
   nrm.push(wnx,wny,wnz);
   col.push(mesh.col[i*3],mesh.col[i*3+1],mesh.col[i*3+2]);
  }
 }
 return {pos:new Float32Array(pos),nrm:new Float32Array(nrm),col:new Float32Array(col),count:pos.length/3};
}
function makeBuffer(mesh){
 const posB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,posB);gl.bufferData(gl.ARRAY_BUFFER,mesh.pos,gl.STATIC_DRAW);
 const nrmB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nrmB);gl.bufferData(gl.ARRAY_BUFFER,mesh.nrm,gl.STATIC_DRAW);
 const colB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,colB);gl.bufferData(gl.ARRAY_BUFFER,mesh.col,gl.STATIC_DRAW);
 return {posB,nrmB,colB,count:mesh.count};
}
function drawBuffer(buf,model,vp,alpha){
 gl.bindBuffer(gl.ARRAY_BUFFER,buf.posB);gl.enableVertexAttribArray(aPos);gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,buf.nrmB);gl.enableVertexAttribArray(aNormal);gl.vertexAttribPointer(aNormal,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,buf.colB);gl.enableVertexAttribArray(aColor);gl.vertexAttribPointer(aColor,3,gl.FLOAT,false,0,0);
 gl.uniformMatrix4fv(uModel,false,model);
 gl.uniformMatrix4fv(uMVP,false,mat4.multiply(vp,model));
 const a=alpha===undefined?1:alpha;
 gl.uniform1f(uAlphaMain,a);
 if(a<1){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}
 gl.drawArrays(gl.TRIANGLES,0,buf.count);
 if(a<1){gl.depthMask(true);gl.disable(gl.BLEND);}
}

// ============================================================
// STANZA: La Torre — Sala di Comando, ispirata ai riferimenti (parete di
// fondo sfumata, fascio di luce centrale, colonne con anelli, consolle
// a "V" aperta verso il giocatore, passerella illuminata sul pavimento).
// ============================================================
const ROOM_W=13,ROOM_D=16,ROOM_H=4.4;
const floorMesh=boxMesh([.09,.09,.115]);
const floorParts=[{mesh:floorMesh,mtx:mul(mat4.translate(0,-.1,0),mat4.scale(ROOM_W,.2,ROOM_D))}];
// passerella centrale piu' chiara, dal punto di partenza fino alla consolle
floorParts.push({mesh:boxMesh([.16,.17,.20]),mtx:mul(mat4.translate(0,.001,1.5),mat4.scale(1.8,.01,11.5))});
for(const zz of [7.2,4.8,2.4,0,-2.4,-4.8])for(const xx of [-1.15,1.15])
 floorParts.push({mesh:boxMesh([.35,.85,.85]),mtx:mul(mat4.translate(xx,.006,zz),mat4.scale(.10,.008,.10))});
const floorBuf=makeBuffer(bakeParts(floorParts));

const wallCol=[.145,.155,.185];
const wallParts=[
 {mesh:boxMesh(wallCol),mtx:mul(mat4.translate(-ROOM_W/2,ROOM_H/2,0),mat4.scale(.3,ROOM_H,ROOM_D))}, // ovest
 {mesh:boxMesh(wallCol),mtx:mul(mat4.translate(ROOM_W/2,ROOM_H/2,0),mat4.scale(.3,ROOM_H,ROOM_D))},  // est
 {mesh:boxMesh([.08,.085,.11]),mtx:mul(mat4.translate(0,ROOM_H+.15,0),mat4.scale(ROOM_W,.3,ROOM_D))}, // soffitto
];
// parete di fondo a bande sfumate (blu profondo in alto, viola, arancio caldo in basso)
// per evocare l'illuminazione drammatica dei riferimenti, senza bisogno di un vero gradiente.
const backBands=[
 [.10,.11,.22], [.16,.13,.28], [.30,.15,.30], [.42,.20,.24], [.30,.14,.12]
];
for(let i=0;i<backBands.length;i++){
 const bh=ROOM_H/backBands.length;
 wallParts.push({mesh:boxMesh(backBands[i]),mtx:mul(mat4.translate(0,bh*i+bh/2,-ROOM_D/2),mat4.scale(ROOM_W,bh+.02,.3))});
}
const wallBuf=makeBuffer(bakeParts(wallParts));

// fascio di luce verticale dietro Oculo
const lightBeamBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.55,.85,.95]),mtx:mul(mat4.translate(0,ROOM_H/2+.2,-ROOM_D/2+.16),mat4.scale(1.7,ROOM_H+.6,.06))},
 {mesh:boxMesh([.85,.97,1.0]),mtx:mul(mat4.translate(0,ROOM_H/2+.2,-ROOM_D/2+.17),mat4.scale(.75,ROOM_H+.6,.04))},
]));

// colonne decorative con anelli luminosi (4, due per lato) — approssimazione
// low-poly di quelle dei riferimenti.
function buildPillar(x,z){
 return [
  {mesh:boxMesh([.10,.10,.13]),mtx:mul(mat4.translate(x,ROOM_H*.55,z),mat4.scale(.32,ROOM_H*1.05,.32))},
  {mesh:boxMesh([.20,.85,.55]),mtx:mul(mat4.translate(x,1.15,z),mat4.scale(.40,.05,.40))}, // anello verde
  {mesh:boxMesh([.20,.70,.90]),mtx:mul(mat4.translate(x,2.55,z),mat4.scale(.40,.05,.40))}, // anello ciano
 ];
}
const pillarBuf=makeBuffer(bakeParts([
 ...buildPillar(-4.7,-3.4), ...buildPillar(4.7,-3.4),
 ...buildPillar(-5.6,1.2),  ...buildPillar(5.6,1.2),
]));

// Pannelli laterali lungo le pareti est/ovest: prima la stanza aveva tutto
// concentrato in fondo, ora si legge come una vera sala controllo abitata
// su tutti i lati.
function buildWallPanel(x,z,rotY,lit){
 const glow=lit?[.20,.80,.95]:[.30,.32,.30];
 return [
  {mesh:boxMesh([.13,.14,.17]),mtx:mul(mat4.translate(x,1.05,z),mat4.rotY(rotY),mat4.scale(.10,1.15,.85))},
  {mesh:boxMesh(glow),mtx:mul(mat4.translate(x,1.35,z),mat4.rotY(rotY),mat4.translate(.06,0,0),mat4.scale(.02,.42,.62))},
  {mesh:boxMesh(glow),mtx:mul(mat4.translate(x,.78,z),mat4.rotY(rotY),mat4.translate(.06,0,0),mat4.scale(.02,.16,.62))},
 ];
}
const sidePanelParts=[];
for(const z of [-5.2,-2.2,1.0,4.2]){
 sidePanelParts.push(...buildWallPanel(-ROOM_W/2+.16, z, 0, true));
 sidePanelParts.push(...buildWallPanel( ROOM_W/2-.16, z, Math.PI, true));
}
// Eco di IT SHIFT: un pannello spento/incrinato tra gli altri, diverso da
// tutti quelli accesi. Nessun testo leggibile per ora (serve un sistema di
// interazione prima di poterci scrivere sopra), ma e' il punto dove in
// futuro comparira' un riferimento diretto al capitolo precedente (es. un
// frammento dati con un numero di badge o la parola "STUDIO" corrotta,
// stesso linguaggio degli indizi LMN_0x gia' usati in IT SHIFT).
sidePanelParts.push(...buildWallPanel(-ROOM_W/2+.16, -2.2, 0, false));
const sidePanelBuf=makeBuffer(bakeParts(sidePanelParts));

// Oggetto segreto LIMEN: un piccolo nucleo che pulsa del verde fosforo
// usato per gli indizi LMN in IT SHIFT (#b7ff4a), infilato in un angolo
// defilato della sala invece che in bella vista — da scoprire, non da
// sbattere in faccia.
const LIMEN_CORE_POS={x:-ROOM_W/2+.85,y:.66,z:ROOM_D/2-.9};
const limenPedestalBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.12,.13,.15]),mtx:mul(mat4.translate(LIMEN_CORE_POS.x,.30,LIMEN_CORE_POS.z),mat4.scale(.34,.60,.34))},
]));
const limenCoreMesh=boxMesh([.72,1.0,.29]);
const limenCoreBuf=makeBuffer(limenCoreMesh);

// OCULO: ora e' un'immagine vera (textured quad) invece di essere costruito
// a scatole — molto piu' leggero e molto piu' leggibile come occhio.
// Nel frattempo che l'immagine definitiva non e' pronta, un quad scuro fa
// da segnaposto (vedi loadTexture: mostra un pixel scuro finche' non carica).
// La cornice scura rettangolare che c'era prima e' stata tolta: l'immagine
// dell'occhio brilla gia' di suo e riprende il fascio di luce dietro, un
// bordo netto ci stonava sopra invece di aiutare.
const EYE_Y=2.35, EYE_Z=-ROOM_D/2+.30;
const oculoTex=loadTexture("oculo_eye.png");

// consolle a "V" aperta verso il giocatore, come nei riferimenti, invece
// di un semplice blocco dritto.
function buildConsoleWing(x,z,rotY){
 return [
  {mesh:boxMesh([.16,.17,.22]),mtx:mul(mat4.translate(x,.50,z),mat4.rotY(rotY),mat4.scale(2.3,1.0,.85))},
  {mesh:boxMesh([.22,.58,.34]),mtx:mul(mat4.translate(x,1.02,z),mat4.rotY(rotY),mat4.scale(2.0,.05,.55))},
  {mesh:boxMesh([.75,.20,.16]),mtx:mul(mat4.translate(x,1.08,z),mat4.rotY(rotY),mat4.scale(.30,.03,.30))}, // gemma rossa
 ];
}
const consoleBuf=makeBuffer(bakeParts([
 ...buildConsoleWing(-1.55,-ROOM_D/2+1.55, .38),
 ...buildConsoleWing( 1.55,-ROOM_D/2+1.55,-.38),
 {mesh:boxMesh([.14,.15,.19]),mtx:mul(mat4.translate(0,.42,-ROOM_D/2+.95),mat4.scale(1.3,.85,.7))},
]));

// ============================================================
// PERSONAGGIO — vero rig 3D (non billboard): busto, testa, braccia, gambe
// separate, ognuna col proprio local transform, animate a runtime.
// Parametrizzato per palette (tuta/accento) cosi' lo stesso rig serve sia
// per il player sia per i membri della squadra, con o senza casco.
// ============================================================
function makePalette(suit,accent,skin){
 return {suit,accent,skin:skin||[.85,.63,.48],visor:[.15,.85,.95],boot:[.10,.10,.12],helmetShell:accent};
}
const PAL_CIVILE=makePalette([.30,.30,.33],[.45,.45,.48]); // prima della trasformazione
const PAL_ZERO   =makePalette([.58,.30,.11],[.50,.40,.18]); // Vermiglio bruciato/ruggine / Bronzo scuro (Ranger Zero) — deliberatamente piu' scuro/opaco di Arco
const PAL_ARCO   =makePalette([.74,.10,.08],[.85,.66,.16]); // Vermiglio pieno acceso / Ottone dorato brillante
const PAL_MERIDIANA=makePalette([.55,.72,.80],[.75,.78,.80]); // Blu ghiaccio / Argento
const PAL_RANGER3=makePalette([.34,.18,.42],[.68,.56,.34]); // Viola profondo / Bronzo
const PAL_RANGER4=makePalette([.14,.40,.28],[.74,.76,.78]); // Verde muschio / Argento chiaro

const meshCache={};
function partMeshFor(pal){
 const key=pal.suit.join(",")+"|"+pal.accent.join(",")+"|"+(pal===PAL_CIVILE?"c":"h");
 if(meshCache[key])return meshCache[key];
 const m={
  torso:boxMesh(pal.suit), belt:boxMesh(pal.accent),
  head:boxMesh(pal.skin), visor:boxMesh(pal.visor),
  hair:boxMesh([.14,.11,.10]), eye:boxMesh([.05,.05,.06]),
  helmetShell:boxMesh(pal.helmetShell), helmetVisor:boxMesh(pal.visor), helmetCrest:boxMesh(pal.accent),
  horn:boxMesh(pal.accent), shoulderPad:boxMesh(pal.accent),
  upperArm:boxMesh(pal.suit), lowerArm:boxMesh(pal.skin), glove:boxMesh(pal.accent),
  upperLeg:boxMesh(pal.suit), lowerLeg:boxMesh(pal.boot),
  bladeCore:boxMesh([.85,.92,.98]), bladeEdge:boxMesh(pal.accent), bladeHilt:boxMesh([.15,.14,.16]),
 };
 meshCache[key]=m;
 return m;
}
// kind: "ranger" (default, eroico), "scagnozzo" (sagoma diversa: niente
// cresta, visiera a fessura, un po' curvo — si legge subito come nemico
// generico, non come "un altro Ranger"), "raccoglitore" (corna al posto
// della cresta, spallacci asimmetrici — armatura raccogliticcia, non di
// serie). attackPhase (0..1, opzionale) fa scattare in avanti il braccio
// destro per un pugno leggibile invece di restare fermo mentre "attacca".
function buildBodyParts(pal,walkPhase,speedFactor,helmet,kind,attackPhase,weaponOut){
 kind=kind||"ranger";
 const pm=partMeshFor(pal);
 const swing=Math.sin(walkPhase)*.55*speedFactor;
 const swingOpp=Math.sin(walkPhase+Math.PI)*.55*speedFactor;
 const bob=Math.abs(Math.cos(walkPhase))*.045*speedFactor;
 const hunch=kind==="scagnozzo"?.10:0;
 const torsoW=kind==="raccoglitore"?.54:kind==="scagnozzo"?.50:.46;
 const parts=[
  {mesh:pm.torso, mtx:mul(mat4.translate(0,1.05+bob-hunch*.3,0),mat4.rotX(hunch),mat4.scale(torsoW,.62,.28))},
  {mesh:pm.belt,  mtx:mul(mat4.translate(0,.76+bob,0),mat4.scale(.48,.10,.30))},
 ];
 if(kind==="raccoglitore"){
  // spallacci asimmetrici: uno più grande dell'altro, come pezzi di
  // armature diverse tenute insieme alla bell'e meglio.
  parts.push({mesh:pm.shoulderPad, mtx:mul(mat4.translate(.40,1.42+bob,0),mat4.scale(.22,.16,.24))});
  parts.push({mesh:pm.shoulderPad, mtx:mul(mat4.translate(-.38,1.38+bob,0),mat4.scale(.15,.11,.17))});
 }
 if(helmet&&kind==="ranger"){
  parts.push({mesh:pm.helmetShell, mtx:mul(mat4.translate(0,1.57+bob,0),mat4.scale(.33,.33,.33))});
  parts.push({mesh:pm.helmetVisor, mtx:mul(mat4.translate(0,1.55+bob,.155),mat4.scale(.26,.14,.05))});
  parts.push({mesh:pm.helmetCrest, mtx:mul(mat4.translate(0,1.80+bob,-.02),mat4.scale(.08,.10,.34))});
 }else if(kind==="scagnozzo"){
  // niente cresta, visiera a fessura sottile, testa leggermente incassata:
  // deliberatamente meno "eroico", piu' anonimo/usa e getta.
  parts.push({mesh:pm.helmetShell, mtx:mul(mat4.translate(0,1.52+bob-hunch*.4,0),mat4.rotX(hunch*.6),mat4.scale(.30,.28,.30))});
  parts.push({mesh:pm.helmetVisor, mtx:mul(mat4.translate(0,1.51+bob-hunch*.4,.145),mat4.rotX(hunch*.6),mat4.scale(.22,.05,.05))});
 }else if(kind==="raccoglitore"){
  // corna al posto della cresta, elmo piu' squadrato/pesante
  parts.push({mesh:pm.helmetShell, mtx:mul(mat4.translate(0,1.60+bob,0),mat4.scale(.36,.35,.35))});
  parts.push({mesh:pm.helmetVisor, mtx:mul(mat4.translate(0,1.58+bob,.165),mat4.scale(.27,.13,.05))});
  parts.push({mesh:pm.horn, mtx:mul(mat4.translate(-.16,1.86+bob,0),mat4.rotZ(.35),mat4.scale(.06,.20,.06))});
  parts.push({mesh:pm.horn, mtx:mul(mat4.translate(.16,1.86+bob,0),mat4.rotZ(-.35),mat4.scale(.06,.20,.06))});
 }else{
  parts.push({mesh:pm.head,  mtx:mul(mat4.translate(0,1.55+bob,0),mat4.scale(.30,.30,.30))});
  parts.push({mesh:pm.hair,  mtx:mul(mat4.translate(0,1.665+bob,-.01),mat4.scale(.305,.14,.30))});
  parts.push({mesh:pm.eye,   mtx:mul(mat4.translate(-.08,1.565+bob,.148),mat4.scale(.045,.045,.03))});
  parts.push({mesh:pm.eye,   mtx:mul(mat4.translate(.08,1.565+bob,.148),mat4.scale(.045,.045,.03))});
 }
 // braccio destro: pugno in avanti se attackPhase e' passato (0->1->0),
 // altrimenti la normale oscillazione di camminata.
 const punch=attackPhase?Math.sin(Math.min(1,attackPhase)*Math.PI):0;
 const rArmRot=attackPhase? -1.9*punch : swing*.8;
 const rArmFwd=attackPhase? .30*punch : 0;
 parts.push(
  {mesh:pm.upperArm, mtx:mul(mat4.translate(.34,1.30+bob,0),mat4.rotX(rArmRot),mat4.translate(0,-.20,rArmFwd),mat4.scale(.16,.40,.16))},
  {mesh:pm.lowerArm, mtx:mul(mat4.translate(.34,1.30+bob,0),mat4.rotX(rArmRot),mat4.translate(0,-.46,rArmFwd*1.6),mat4.scale(.14,.30,.14))},
  {mesh:pm.upperArm, mtx:mul(mat4.translate(-.34,1.30+bob,0),mat4.rotX(swingOpp*.8),mat4.translate(0,-.20,0),mat4.scale(.16,.40,.16))},
  {mesh:pm.lowerArm, mtx:mul(mat4.translate(-.34,1.30+bob,0),mat4.rotX(swingOpp*.8),mat4.translate(0,-.46,0),mat4.scale(.14,.30,.14))},
  {mesh:pm.upperLeg, mtx:mul(mat4.translate(.16,.74+bob,0),mat4.rotX(swingOpp),mat4.translate(0,-.24,0),mat4.scale(.19,.48,.19))},
  {mesh:pm.lowerLeg, mtx:mul(mat4.translate(.16,.74+bob,0),mat4.rotX(swingOpp),mat4.translate(0,-.56,0),mat4.scale(.17,.34,.19))},
  {mesh:pm.upperLeg, mtx:mul(mat4.translate(-.16,.74+bob,0),mat4.rotX(swing),mat4.translate(0,-.24,0),mat4.scale(.19,.48,.19))},
  {mesh:pm.lowerLeg, mtx:mul(mat4.translate(-.16,.74+bob,0),mat4.rotX(swing),mat4.translate(0,-.56,0),mat4.scale(.17,.34,.19))},
 );
 if(weaponOut){
  // lama energetica agganciata alla mano destra, inclinata in avanti come
  // se fosse impugnata pronta a colpire — compare solo durante l'attacco
  // speciale, cosi' si legge subito come "questo e' diverso dal solito".
  const gm=mul(mat4.translate(.34,1.30+bob,0),mat4.rotX(rArmRot),mat4.translate(0,-.80,rArmFwd*1.6),mat4.rotX(-.55));
  parts.push({mesh:pm.bladeHilt, mtx:mul(gm,mat4.translate(0,.06,0),mat4.scale(.07,.14,.09))});
  parts.push({mesh:pm.bladeEdge, mtx:mul(gm,mat4.translate(0,-.34,0),mat4.scale(.09,.55,.045))});
  parts.push({mesh:pm.bladeCore, mtx:mul(gm,mat4.translate(0,-.34,.005),mat4.scale(.035,.50,.02))});
 }
 return parts;
}
function buildCharacterBuffers(pal,walkPhase,speedFactor,helmet,kind,attackPhase,weaponOut){
 return bakeParts(buildBodyParts(pal,walkPhase,speedFactor,helmet,kind,attackPhase,weaponOut));
}

// squadra: 4 Ranger fermi con casco completo, colori da bibbia personaggi,
// disposti a semicerchio davanti a Oculo
const arcoBuf=makeBuffer(buildCharacterBuffers(PAL_ARCO,0,0,true));
const meridianaBuf=makeBuffer(buildCharacterBuffers(PAL_MERIDIANA,0,0,true));
const ranger3Buf=makeBuffer(buildCharacterBuffers(PAL_RANGER3,0,0,true));
const ranger4Buf=makeBuffer(buildCharacterBuffers(PAL_RANGER4,0,0,true));
const teamMembers=[
 {buf:arcoBuf,      x:-3.6, z:-ROOM_D/2+3.9, yaw:.25},
 {buf:meridianaBuf, x:-1.2, z:-ROOM_D/2+3.3, yaw:.10},
 {buf:ranger3Buf,   x: 1.2, z:-ROOM_D/2+3.3, yaw:-.10},
 {buf:ranger4Buf,   x: 3.6, z:-ROOM_D/2+3.9, yaw:-.25},
];
// Posizioni usate per far girare la telecamera verso chi sta parlando
// durante i dialoghi, cosi' si capisce subito chi e' senza dover indovinare
// dal solo nome scritto nel balloon.
const DIALOGUE_FOCUS_POS={
 OCULO:{x:0,y:2.35,z:-ROOM_D/2+.30},
 ARCO:{x:teamMembers[0].x,y:1.5,z:teamMembers[0].z},
 MERIDIANA:{x:teamMembers[1].x,y:1.5,z:teamMembers[1].z},
 TIC:{x:-5.6,y:2.3,z:-2.6},
};

// TIC: drone assistente — corpo a disco, cupola, un solo occhio ciclopico,
// due piccoli pod laterali. Silhouette volutamente diversa da un Ranger
// in miniatura, cosi' si legge subito come "robot", non come personaggio.
const ticCol=[.62,.65,.68], ticDark=[.30,.32,.36], ticEye=[.20,.90,.98];
const ticParts=[
 {mesh:boxMesh(ticCol),  mtx:mul(mat4.scale(.46,.10,.46))},                       // disco base (ottagonale approssimato da box)
 {mesh:boxMesh(ticCol),  mtx:mul(mat4.rotY(Math.PI/4),mat4.scale(.34,.10,.34))},  // secondo strato ruotato 45gradi -> profilo piu' ottagonale
 {mesh:boxMesh(ticDark), mtx:mul(mat4.translate(0,.14,0),mat4.scale(.30,.16,.30))}, // cupola scura
 {mesh:boxMesh(ticEye),  mtx:mul(mat4.translate(0,.15,.155),mat4.scale(.13,.13,.04))}, // occhio ciclopico
 {mesh:boxMesh(ticDark), mtx:mul(mat4.translate(0,.30,0),mat4.scale(.04,.14,.04))},   // antenna
 {mesh:boxMesh(ticEye),  mtx:mul(mat4.translate(0,.37,0),mat4.scale(.06,.06,.06))},   // luce in cima all'antenna
 {mesh:boxMesh(ticCol),  mtx:mul(mat4.translate(.42,-.02,0),mat4.scale(.10,.06,.22))}, // pod laterale destro
 {mesh:boxMesh(ticCol),  mtx:mul(mat4.translate(-.42,-.02,0),mat4.scale(.10,.06,.22))},// pod laterale sinistro
];
const ticBuf=makeBuffer(bakeParts(ticParts));
const ticHome={x:-5.6,y:2.55,z:-2.6};
// Percorso di pattuglia tra i pannelli laterali, cosi' TIC sembra
// controllare davvero la sala invece di restare fermo in un punto.
const TIC_PATROL=[
 {x:-ROOM_W/2+1.3, z:-5.2},
 {x:-ROOM_W/2+1.3, z: 1.0},
 {x:-2.0, z:-1.5},
 {x: ROOM_W/2-1.3, z: 1.0},
 {x: ROOM_W/2-1.3, z:-5.2},
 {x: 0, z:-3.5},
];

// ============================================================
// ARENA — spiaggia vicino al mare per il primo combattimento, separata da
// La Torre (zona diversa, vedi ZONES piu' sotto). Pochi elementi apposta
// (sabbia + mare + qualche scoglio), sia per restare leggera sia perche'
// il mare serve gia' da ora: e' li' che Il Raccoglitore uscira' quando
// costruiremo la fase 2, come nei tokusatsu veri.
// ============================================================
const ARENA_CX=0, ARENA_CZ=-60, ARENA_W=26, ARENA_D=26;
const SEA_EDGE_Z=ARENA_CZ-ARENA_D/2+7; // il mare occupa il terzo piu' lontano dal punto di ingresso
const sandCol=[.62,.53,.38];
const arenaFloorBuf=makeBuffer(bakeParts([
 {mesh:boxMesh(sandCol),mtx:mul(mat4.translate(ARENA_CX,-.1,ARENA_CZ),mat4.scale(ARENA_W,.2,ARENA_D))},
 {mesh:boxMesh([.58,.49,.35]),mtx:mul(mat4.translate(ARENA_CX,.001,ARENA_CZ+ARENA_D/2-4),mat4.scale(ARENA_W,.01,3))}, // bagnasciuga piu' scuro
]));
// mare: due tinte per dare un minimo di profondita' (bassofondo piu' chiaro
// vicino alla riva, acqua profonda piu' scura oltre)
const arenaSeaBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.10,.22,.30]),mtx:mul(mat4.translate(ARENA_CX,.02,ARENA_CZ-ARENA_D/2+3.2),mat4.scale(ARENA_W,.02,6.4))}, // profondo
 {mesh:boxMesh([.16,.36,.42]),mtx:mul(mat4.translate(ARENA_CX,.03,SEA_EDGE_Z+.4),mat4.scale(ARENA_W,.02,1.0))},           // bassofondo/schiuma vicino riva
]));
function buildRock(x,z,w,h,d,col){
 return [{mesh:boxMesh(col),mtx:mul(mat4.translate(x,h/2,z),mat4.rotY(x*.7),mat4.scale(w,h,d))}];
}
const arenaPropParts=[];
const rockCol=[.30,.28,.27];
arenaPropParts.push(...buildRock(ARENA_CX-8, ARENA_CZ-2, 1.6,1.1,1.3,rockCol));
arenaPropParts.push(...buildRock(ARENA_CX+7, ARENA_CZ-4, 1.2,.8,1.0,rockCol));
arenaPropParts.push(...buildRock(ARENA_CX-5, ARENA_CZ+6, .9,.6,.8,[.32,.30,.28]));
arenaPropParts.push(...buildRock(ARENA_CX+9, ARENA_CZ+3, 1.4,.9,1.1,rockCol));
const arenaPropBuf=makeBuffer(bakeParts(arenaPropParts));
// confine basso solo sui tre lati di sabbia: il lato mare non ha muro, ci
// pensa il mare stesso a essere il limite (sia visivo che, piu' avanti,
// narrativo).
const arenaEdgeBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.45,.40,.30]),mtx:mul(mat4.translate(ARENA_CX,.5,ARENA_CZ+ARENA_D/2),mat4.scale(ARENA_W,1.0,.3))}, // duna lato ingresso
 {mesh:boxMesh([.45,.40,.30]),mtx:mul(mat4.translate(ARENA_CX-ARENA_W/2,.5,ARENA_CZ),mat4.scale(.3,1.0,ARENA_D))},
 {mesh:boxMesh([.45,.40,.30]),mtx:mul(mat4.translate(ARENA_CX+ARENA_W/2,.5,ARENA_CZ),mat4.scale(.3,1.0,ARENA_D))},
]));

// Cielo: prima sopra la spiaggia c'era il vuoto nero, ora una parete di
// fondo a bande (stesso trucco della sala di comando) dietro il mare, piu'
// due pareti laterali piu' basse, cosi' l'orizzonte si chiude invece di
// sparire nel nulla.
const skyBands=[[.08,.10,.20],[.14,.16,.30],[.30,.24,.30],[.55,.38,.28],[.70,.48,.30]];
const SKY_H=30, SKY_Y0=-2;
function buildSkyWall(x,z,w,rotY){
 const parts=[];
 for(let i=0;i<skyBands.length;i++){
  const bh=SKY_H/skyBands.length;
  parts.push({mesh:boxMesh(skyBands[i]),mtx:mul(mat4.translate(x,SKY_Y0+bh*i+bh/2,z),mat4.rotY(rotY),mat4.scale(w,bh+.05,.4))});
 }
 return parts;
}
const arenaSkyBuf=makeBuffer(bakeParts([
 ...buildSkyWall(ARENA_CX,ARENA_CZ-ARENA_D/2-2,ARENA_W+30,0),
 ...buildSkyWall(ARENA_CX-ARENA_W/2-2,ARENA_CZ,ARENA_D+30,Math.PI/2),
 ...buildSkyWall(ARENA_CX+ARENA_W/2+2,ARENA_CZ,ARENA_D+30,Math.PI/2),
 ...buildSkyWall(ARENA_CX,ARENA_CZ+ARENA_D/2+2,ARENA_W+30,0),
]));

// ============================================================
// NEMICI — scagnozzi (deboli, in gruppo) e Il Raccoglitore (piu' forte,
// scala umana per questo primo scontro; diventera' gigante in una fase
// successiva, non ancora costruita).
// ============================================================
const PAL_SCAGNOZZO=makePalette([.22,.20,.18],[.42,.38,.30],[.55,.42,.30]);
// Il Raccoglitore: guerriero dorato, ma le placche sono volutamente
// irregolari/asimmetriche — armature di vecchi Ranger fuse insieme,
// non un'armatura di serie come quella della squadra.
const PAL_RACCOGLITORE=makePalette([.48,.36,.10],[.62,.48,.14],[.35,.28,.22]);

const scagnozzoBuf=makeBuffer(buildCharacterBuffers(PAL_SCAGNOZZO,0,0,true,"scagnozzo"));
const raccoglitoreBuf=makeBuffer(buildCharacterBuffers(PAL_RACCOGLITORE,0,0,true,"raccoglitore"));

// ============================================================
// FASE 2 — IL COLOSSO: i 5 Ranger si combinano (implicito, non
// animato/modellato — vedi nota sotto), Il Raccoglitore diventa gigante,
// scontro finale in prima persona fissa (niente camminata: solo mira e
// attacco, per tenerlo semplice come richiesto). Il "video" della
// combinazione e' una breve sequenza scriptata con testo + il nemico che
// cresce, non un vero filmato — costruire un modello animato dei 5 Ranger
// che si fondono sarebbe un progetto a se'; la telecamera in prima persona
// aggira elegantemente il problema (non serve renderizzare il Colosso
// stesso, solo il suo punto di vista).
// ============================================================
let colosso=null;
const COLOSSO_EYE_Y=6.5;
const COLOSSO_CAM_Z=ARENA_CZ+11;
const COLOSSO_GIANT_Z=SEA_EDGE_Z-9;
let colossoTeamPos=null;
function startColossoSequence(){
 if(colosso)return;
 colosso={phase:"converge",t:0,giantHp:400,giantHpMax:400,playerHp:100,playerHpMax:100,
  giantScale:1.55,attackCd:2.6,punchT:0,beamT:0,shakeT:0,beamBursts:[]};
 missionHintEl.textContent="I RANGER SI COMBINANO...";
 missionHintEl.classList.add("show");
 colossoHpWrapEl.classList.add("show");
 sfx.teleport();
 // i 4 compagni "volano" verso il giocatore da punti sparsi della
 // spiaggia — prima la combinazione era solo un testo, ora si vede
 // davvero la squadra convergere prima del lampo.
 colossoTeamPos=teamMembers.map((m,i)=>({
  startX:player.x+Math.cos(i*1.6)*7, startZ:player.z+Math.sin(i*1.6)*7,
  x:0,z:0,pal:[PAL_ARCO,PAL_MERIDIANA,PAL_RANGER3,PAL_RANGER4][i],
 }));
}
function colossoPunch(){
 if(!colosso||colosso.phase!=="fight"||colosso.punchT>0||colosso.beamT>0)return;
 colosso.punchT=.32;
 colosso.giantHp=Math.max(0,colosso.giantHp-18);
 player.energy=Math.min(player.energyMax,player.energy+9);
 colosso.beamBursts.push({t:0,kind:"punch"});
 sfx.giantHit();
 triggerSlowMo(.09,.08);
 if(colosso.giantHp<=0)startColossoFinish();
}
function colossoSpecial(){
 if(!colosso||colosso.phase!=="fight"||player.energy<player.energyMax||colosso.beamT>0||colosso.punchT>0)return;
 colosso.beamT=.5;
 player.energy=0;
 colosso.giantHp=Math.max(0,colosso.giantHp-70);
 specialFlashEl.style.opacity=.95;
 setTimeout(()=>{specialFlashEl.style.opacity=0;},140);
 colosso.beamBursts.push({t:0,kind:"beam"});
 sfx.special();
 triggerSlowMo(.16,.1);
 if(colosso.giantHp<=0)startColossoFinish();
}
// Colpo di grazia in rallentatore: la telecamera si stringe sul gigante
// mentre crolla, invece di saltare dritti alla schermata di vittoria —
// il momento che dovrebbe sentirsi piu' epico di tutti.
function startColossoFinish(){
 if(colosso.phase==="finishing"||colosso.phase==="won")return;
 colosso.phase="finishing";
 colosso.finishT=0;
 triggerSlowMo(2.2,.22);
 sfx.alarm();
}
function updateColossoFinish(dt){
 colosso.finishT+=dt;
 const p=Math.min(1,colosso.finishT/2.0);
 colosso.finishZoom=p;
 colosso.finishTilt=p*p*1.1; // il gigante si piega in avanti crollando
 if(colosso.finishT>2.0)colossoWin();
}
function colossoWin(){
 colosso.phase="won";
 missionHintEl.textContent="IL RACCOGLITORE E' STATO RESPINTO";
 sfx.win();
 setTimeout(()=>{ colossoOutcomeEl.querySelector("h1").textContent="VITTORIA";
  colossoOutcomeEl.querySelector("p").textContent="Il Colosso ha respinto Il Raccoglitore nel mare.";
  colossoOutcomeEl.classList.add("show","win"); },900);
}
function colossoLose(){
 colosso.phase="lost";
 colossoOutcomeEl.querySelector("h1").textContent="IL COLOSSO CROLLA";
 colossoOutcomeEl.querySelector("p").textContent="Riprova — Il Raccoglitore non aspetta.";
 colossoOutcomeEl.classList.remove("win");
 colossoOutcomeEl.classList.add("show");
 sfx.lose();
}
function updateColosso(dt){
 if(!colosso)return;
 colosso.t+=dt;
 if(colosso.phase==="converge"){
  const p=Math.min(1,colosso.t/1.5);
  const ease=1-Math.pow(1-p,3);
  for(const tp of colossoTeamPos){
   tp.x=tp.startX+(player.x-tp.startX)*ease;
   tp.z=tp.startZ+(player.z-tp.startZ)*ease;
  }
  if(colosso.t>1.5){
   colosso.phase="cutscene";
   colosso.t=0;
   colossoTeamPos=null;
   zone="colosso";
   flashEl.style.opacity=1;
   setTimeout(()=>{flashEl.style.opacity=0;},220);
   sfx.transform();
   playAmbient("colosso");
  }
  return;
 }
 if(colosso.phase==="cutscene"){
  colosso.giantScale=1.55+Math.min(1,colosso.t/2.6)*5.8;
  if(colosso.t>1.4)missionHintEl.textContent="IL COLOSSO E' PRONTO";
  if(colosso.t>2.8){
   colosso.phase="fight";
   missionHintEl.classList.remove("show");
  }
  return;
 }
 if(colosso.phase==="finishing"){ updateColossoFinish(dt); return; }
 if(colosso.phase!=="fight")return;
 colosso.punchT=Math.max(0,colosso.punchT-dt);
 colosso.beamT=Math.max(0,colosso.beamT-dt);
 colosso.shakeT=Math.max(0,colosso.shakeT-dt);
 colosso.attackCd-=dt;
 for(let i=colosso.beamBursts.length-1;i>=0;i--){colosso.beamBursts[i].t+=dt;if(colosso.beamBursts[i].t>.4)colosso.beamBursts.splice(i,1);}
 if(colosso.attackCd<=0){
  colosso.attackCd=2.6;
  colosso.shakeT=.35;
  colosso.playerHp=Math.max(0,colosso.playerHp-16);
  sfx.hitPlayer();
  if(colosso.playerHp<=0)colossoLose();
 }
}
document.getElementById("colossoOutcomeBtn").addEventListener("click",()=>{
 colossoOutcomeEl.classList.remove("show");
 if(colosso&&colosso.phase==="lost"){
  colosso.phase="fight";colosso.giantHp=colosso.giantHpMax*.5;colosso.playerHp=colosso.playerHpMax;colosso.attackCd=2.6;
 }else{
  colosso=null;missionHintEl.classList.remove("show");colossoHpWrapEl.classList.remove("show");
  archivioUnlocked=true;
  enterTorre();
  setTimeout(startArchiveSequence,500);
 }
});

let enemies=[];
function spawnWave(){
 enemies=[
  {type:"scagnozzo",pal:PAL_SCAGNOZZO,x:ARENA_CX-4,z:ARENA_CZ-2,yaw:0,hp:30,hpMax:30,state:"idle",cd:0,scale:1,alpha:1,dead:false,walkPhaseE:0,hitFlash:0,attackFlashT:0},
  {type:"scagnozzo",pal:PAL_SCAGNOZZO,x:ARENA_CX+4,z:ARENA_CZ-2,yaw:0,hp:30,hpMax:30,state:"idle",cd:0,scale:1,alpha:1,dead:false,walkPhaseE:0,hitFlash:0,attackFlashT:0},
  {type:"scagnozzo",pal:PAL_SCAGNOZZO,x:ARENA_CX,z:ARENA_CZ-6,yaw:0,hp:30,hpMax:30,state:"idle",cd:1.2,scale:1,alpha:1,dead:false,walkPhaseE:0,hitFlash:0,attackFlashT:0},
  // Il Raccoglitore resta sommerso e "hidden" (non attaccabile, non
  // renderizzato in scena) finche' gli scagnozzi non sono stati ripuliti —
  // solo allora emerge davvero dal mare con tanto di schizzo e ruggito,
  // invece di startare gia' fermo li' dall'inizio.
  {type:"raccoglitore",pal:PAL_RACCOGLITORE,x:ARENA_CX,z:SEA_EDGE_Z+1.5,y:0,yaw:0,hp:160,hpMax:160,state:"idle",cd:2,scale:1.55,alpha:1,dead:false,retreated:false,walkPhaseE:0,hitFlash:0,attackFlashT:0,hidden:true,emerging:false,emerged:false},
 ];
}
let emergeCutscene=null;
function maybeEmergeRaccoglitore(){
 const racc=enemies.find(e=>e.type==="raccoglitore");
 if(!racc||racc.emerging||racc.emerged||emergeCutscene)return;
 const mooksLeft=enemies.some(e=>e.type==="scagnozzo"&&!e.dead);
 if(mooksLeft)return;
 racc.emerging=true;
 racc.emergeT=0;
 emergeCutscene={t:0,phase:"buildup",racc};
 missionHintEl.textContent="QUALCOSA SI MUOVE NELL'ACQUA...";
 missionHintEl.classList.add("show");
}
function updateEmergeCutscene(dt){
 if(!emergeCutscene)return;
 emergeCutscene.t+=dt;
 const racc=emergeCutscene.racc;
 if(emergeCutscene.phase==="buildup"&&emergeCutscene.t>2.2){
  emergeCutscene.phase="rising";
  emergeCutscene.t=0;
  racc.hidden=false;
  sfx.alarm();
  triggerSlowMo(.6,.3);
  missionHintEl.textContent="IL RACCOGLITORE";
 }else if(emergeCutscene.phase==="rising"&&racc.emerged){
  emergeCutscene.phase="hold";
  emergeCutscene.t=0;
 }else if(emergeCutscene.phase==="hold"&&emergeCutscene.t>1.3){
  emergeCutscene=null;
  missionHintEl.classList.remove("show");
 }
}

// ============================================================
// ARCHIVIO — terza stanza della Torre, si sblocca dopo il Colosso. Elmi
// danneggiati appesi (con gli stessi colori della squadra + il rosso
// ruggine di Zero, per far capire senza dirlo che sono i resti delle
// vecchie squadre) e un terminale con il registro delle squadre precedenti.
// ============================================================
const ARCHIVIO_CX=40, ARCHIVIO_CZ=0, ARCHIVIO_W=9, ARCHIVIO_D=12;
const archivioFloorBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.07,.07,.08]),mtx:mul(mat4.translate(ARCHIVIO_CX,-.1,ARCHIVIO_CZ),mat4.scale(ARCHIVIO_W,.2,ARCHIVIO_D))},
]));
const archivioWallCol=[.08,.08,.10];
const archivioWallParts=[
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX,2.2,ARCHIVIO_CZ-ARCHIVIO_D/2),mat4.scale(ARCHIVIO_W,4.4,.3))},
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX,2.2,ARCHIVIO_CZ+ARCHIVIO_D/2),mat4.scale(ARCHIVIO_W,4.4,.3))},
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX-ARCHIVIO_W/2,2.2,ARCHIVIO_CZ),mat4.scale(.3,4.4,ARCHIVIO_D))},
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX+ARCHIVIO_W/2,2.2,ARCHIVIO_CZ),mat4.scale(.3,4.4,ARCHIVIO_D))},
 {mesh:boxMesh([.05,.05,.06]),mtx:mul(mat4.translate(ARCHIVIO_CX,4.5,ARCHIVIO_CZ),mat4.scale(ARCHIVIO_W,.3,ARCHIVIO_D))},
];
// elmi danneggiati appesi lungo la parete est — colori delle vecchie
// squadre, volutamente spenti/sporchi invece che brillanti come quelli
// della squadra attuale.
const oldHelmetPalettes=[
 [.42,.10,.08],[.30,.40,.44],[.20,.12,.24],[.10,.24,.16],[.35,.18,.10],[.28,.28,.30],
];
const archivioHelmetParts=[];
for(let i=0;i<oldHelmetPalettes.length;i++){
 const hz=ARCHIVIO_CZ-ARCHIVIO_D/2+1.4+i*1.7;
 const hx=ARCHIVIO_CX+ARCHIVIO_W/2-.6;
 archivioHelmetParts.push({mesh:boxMesh([.10,.10,.11]),mtx:mul(mat4.translate(hx,2.9,hz),mat4.scale(.04,.5,.04))}); // gancio
 archivioHelmetParts.push({mesh:boxMesh(oldHelmetPalettes[i]),mtx:mul(mat4.translate(hx,2.35,hz),mat4.rotZ((i%2?1:-1)*.12),mat4.scale(.30,.32,.32))});
}
const archivioHelmetBuf=makeBuffer(bakeParts(archivioHelmetParts));
// terminale col registro delle squadre — il testo vero e' nel dialogo, qui
// solo l'oggetto fisico (schermo acceso, colore malato).
const archivioTerminalBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.14,.15,.17]),mtx:mul(mat4.translate(ARCHIVIO_CX-ARCHIVIO_W/2+.9,.5,ARCHIVIO_CZ),mat4.scale(.7,1.0,.6))},
 {mesh:boxMesh([.35,.55,.25]),mtx:mul(mat4.translate(ARCHIVIO_CX-ARCHIVIO_W/2+.9,1.15,ARCHIVIO_CZ),mat4.rotX(-.3),mat4.scale(.55,.42,.04))},
]));
const archivioWallBuf=makeBuffer(bakeParts(archivioWallParts));
let archivioUnlocked=false;
function enterArchivio(){
 zone="archivio";
 player.x=ARCHIVIO_CX; player.z=ARCHIVIO_CZ+ARCHIVIO_D/2-1.5; player.yaw=Math.PI;
 teleportFlash();
 playAmbient("archivio");
}
DIALOGUE_FOCUS_POS.REGISTRO={x:ARCHIVIO_CX-ARCHIVIO_W/2+.9,y:1.3,z:ARCHIVIO_CZ};

// ============================================================
// stato di gioco
// ============================================================
const player={x:0,z:4.0,yaw:Math.PI,speed:2.6,walkPhase:0,transformed:false,helmet:false,
 hp:100,hpMax:100,energy:0,energyMax:100,attackT:0,dodgeT:0,dodgeCd:0,invuln:0,hitFlashT:0,specialT:0};
const camState={dist:4.2,height:2.1,yawOffset:0};
const keys={};
const flashEl=document.getElementById("flash");
const specialFlashEl=document.getElementById("specialFlash");
const teleportFlashEl=document.getElementById("teleportFlash");
const titleEl=document.getElementById("titleScreen");
const hudEl=document.getElementById("gameHud");
const energyFillEl=document.getElementById("energyFill");
const hpFillEl=document.getElementById("hpFill");
const missionHintEl=document.getElementById("missionHint");
const interactPromptEl=document.getElementById("interactPrompt");
const dmgVignetteEl=document.getElementById("dmgVignette");
const gameOverEl=document.getElementById("gameOver");
const colossoHpWrapEl=document.getElementById("colossoHpWrap");
const colossoHpFillEl=document.getElementById("colossoHpFill");
const colossoOutcomeEl=document.getElementById("colossoOutcome");
let gameStarted=false;
let gameOverActive=false;
function triggerGameOver(){
 if(gameOverActive)return;
 gameOverActive=true;
 gameOverEl.classList.add("show");
 sfx.lose();
}
document.getElementById("gameOverBtn").addEventListener("click",()=>{
 gameOverActive=false;
 gameOverEl.classList.remove("show");
 player.hp=player.hpMax;
 enterArena(); // ricomincia direttamente la missione, senza dover rifare l'intro
});

// Zone: "torre" (sala di comando) oppure "arena" (missione di combattimento).
// Ognuna ha i propri confini per il movimento/telecamera, cosi' non serve
// un'unica stanza enorme che le contenga entrambe.
let zone="torre";
const ZONES={
 torre:{w:ROOM_W,d:ROOM_D,cx:0,cz:0},
 arena:{w:26,d:26,cx:0,cz:-60},
 colosso:{w:26,d:26,cx:0,cz:-60},
 archivio:{w:ARCHIVIO_W,d:ARCHIVIO_D,cx:ARCHIVIO_CX,cz:ARCHIVIO_CZ},
};
function zoneBounds(){
 const z=ZONES[zone];
 const b={xmin:z.cx-z.w/2+.6,xmax:z.cx+z.w/2-.6,zmin:z.cz-z.d/2+.6,zmax:z.cz+z.d/2-.6,
  camXmin:z.cx-z.w/2+.35,camXmax:z.cx+z.w/2-.35,camZmin:z.cz-z.d/2+.35,camZmax:z.cz+z.d/2-.35};
 if(zone==="arena"){
  // niente nuoto per ora: il mare resta un confine visivo/narrativo finche'
  // non costruiamo la fase 2 (Il Raccoglitore che ne esce).
  b.zmin=SEA_EDGE_Z+.5; b.camZmin=SEA_EDGE_Z+.3;
 }
 return b;
}
function enterArena(){
 if(zone==="arena")return;
 zone="arena";
 player.x=ZONES.arena.cx; player.z=ZONES.arena.cz+9; player.yaw=Math.PI;
 spawnWave();
 missionHintEl.textContent="MISSIONE: sconfiggi gli scagnozzi e Il Raccoglitore";
 missionHintEl.classList.add("show");
 teleportFlash();
 playAmbient("arena");
}
function enterTorre(){
 zone="torre";
 player.x=0; player.z=4.0; player.yaw=Math.PI;
 missionHintEl.classList.remove("show");
 teleportFlash();
 playAmbient("torre");
}
function teleportFlash(){
 sfx.teleport();
 teleportFlashEl.style.opacity=1;
 setTimeout(()=>{teleportFlashEl.style.opacity=0;},260);
}

// ------------------------------------------------------------
// Dialoghi: box in basso, un rigo alla volta, avanti con click o SPAZIO.
// Usato per l'intro (Oculo che finisce di spiegare, due chiacchiere con la
// squadra, l'allarme) — la stessa coda puo' servire anche in futuro per
// altre scene scriptate.
// ------------------------------------------------------------
const dialogueBoxEl=document.getElementById("dialogueBox");
const dialogueNameEl=document.getElementById("dialogueName");
const dialogueTextEl=document.getElementById("dialogueText");
let dialogueQueue=[], dialogueIndex=0, dialogueActive=false, dialogueOnEnd=null, dialogueFocus=null;
function playDialogue(lines,onEnd){
 dialogueQueue=lines; dialogueIndex=0; dialogueActive=true; dialogueOnEnd=onEnd||null;
 dialogueBoxEl.classList.add("show");
 document.body.classList.add("dialogue-active");
 showDialogueLine();
}
function showDialogueLine(){
 const l=dialogueQueue[dialogueIndex];
 dialogueNameEl.textContent=l.speaker;
 dialogueNameEl.className=l.speaker==="OCULO"?"oculo":"";
 dialogueTextEl.textContent=l.text;
 // la telecamera si gira verso chi sta parlando, cosi' si capisce subito
 // chi e' — prima restava fissa sul giocatore per tutta la scena.
 dialogueFocus=DIALOGUE_FOCUS_POS[l.speaker]||null;
}
function advanceDialogue(){
 if(!dialogueActive)return;
 sfx.uiBlip();
 dialogueIndex++;
 if(dialogueIndex>=dialogueQueue.length){
  dialogueActive=false;
  dialogueBoxEl.classList.remove("show");
  document.body.classList.remove("dialogue-active");
  dialogueFocus=null;
  const cb=dialogueOnEnd; dialogueOnEnd=null;
  if(cb)cb();
 }else{
  showDialogueLine();
 }
}
dialogueBoxEl.addEventListener("click",advanceDialogue);

// Intro: Oculo finisce di spiegare perche' il protagonista e' li', due
// battute con la squadra (con dentro un riferimento discreto a IT SHIFT —
// "badge", "sessione", roba amministrativa che non dovrebbe esistere qui),
// poi l'allarme che porta dritti al combattimento in spiaggia.
const introLines=[
 {speaker:"OCULO",text:"...e con questo, il quadro e' completo. La Torre veglia da molto prima di te. Quando un posto si libera, ne troviamo un altro pronto a occuparlo."},
 {speaker:"OCULO",text:"Benvenuto, unita' Zero."},
 {speaker:"ARCO",text:"Non fare quella faccia. Ci siamo passati tutti. Io sono Arco, comando la squadra sul campo — resta vicino e vai bene."},
 {speaker:"MERIDIANA",text:"Meridiana. Non serve che tu ci creda subito. Vedrai con che squadra hai a che fare quando contera' davvero."},
 {speaker:"MERIDIANA",text:"Ogni tanto Oculo tira fuori vecchi registri da prima di noi. Sessioni, badge, roba amministrativa. Non ci penso troppo."},
 {speaker:"TIC",text:"IO SONO TIC! Supporto tattico, morale, e tecnicamente l'unico qui che si ricorda gli anniversari."},
 {speaker:"OCULO",text:"Allarme. Presenza ostile sulla costa sud — scagnozzi, e qualcosa di piu' grande dietro di loro."},
 {speaker:"OCULO",text:"Squadra, in posizione. Zero — trasformati, e vai."},
];
function startIntro(){
 playDialogue(introLines,()=>{
  missionHintEl.textContent="ALLARME — TRASFORMAZIONE IN CORSO";
  missionHintEl.classList.add("show");
  sfx.alarm();
  startTransformation();
  setTimeout(()=>{
   missionHintEl.textContent="TRASFERIMENTO IN CORSO";
   setTimeout(()=>{ enterArena(); },700);
  },2300);
 });
}

// ------------------------------------------------------------
// Archivio: ora giocabile, non solo narrativo — il giocatore cammina
// liberamente e scopre il registro e gli elmi avvicinandosi e premendo
// SPAZIO, invece di subire tutto in automatico. Solo dopo aver scoperto
// entrambi, Oculo rompe la quarta parete e offre la scelta finale.
// ------------------------------------------------------------
const terminalLines=[
 {speaker:"REGISTRO",text:"SQUADRA_07 — STATO: TERMINATA."},
 {speaker:"REGISTRO",text:"SQUADRA_08 — STATO: TERMINATA."},
 {speaker:"REGISTRO",text:"SQUADRA_09 — STATO: TERMINATA."},
];
const helmetLines=[
 {speaker:"MERIDIANA",text:"Quello... conosco quel colore. Era di uno di prima. Non me l'hanno mai detto cosa gli e' successo davvero."},
 {speaker:"MERIDIANA",text:"Andiamo via da qui, Zero."},
];
const oculoRevealLines=[
 {speaker:"OCULO",text:"Non dovevi vederlo. Ma hai vinto, e chi vince guadagna il diritto di guardare."},
 {speaker:"OCULO",text:"L'armatura che hai combattuto non e' nata dal nulla. Era fatta di loro — di chi e' venuto prima di te."},
 {speaker:"OCULO",text:"E tu, che stai leggendo questo — non tu, unita' Zero. Tu, dall'altra parte dello schermo."},
 {speaker:"OCULO",text:"Registriamo ogni sessione. Ogni scelta. So che stai scegliendo per lui in questo momento, come hai scelto per altri prima."},
 {speaker:"OCULO",text:"Allora scegli tu. Cosa ne facciamo di questo ciclo?"},
];
const TERMINAL_POS={x:ARCHIVIO_CX-ARCHIVIO_W/2+.9,z:ARCHIVIO_CZ};
const HELMET_POS={x:ARCHIVIO_CX+ARCHIVIO_W/2-.6,z:ARCHIVIO_CZ};
let archiveState={terminalRead:false,helmetsRead:false,revealing:false};
let nearInteractable=null;
function doArchiveInteract(){
 if(nearInteractable==="terminal"&&!archiveState.terminalRead){
  archiveState.terminalRead=true;
  playDialogue(terminalLines,maybeStartOculoReveal);
 }else if(nearInteractable==="helmets"&&!archiveState.helmetsRead){
  archiveState.helmetsRead=true;
  playDialogue(helmetLines,maybeStartOculoReveal);
 }
}
function startArchiveSequence(){
 archiveState={terminalRead:false,helmetsRead:false,revealing:false};
 enterArchivio();
 setTimeout(()=>{
  missionHintEl.textContent="ESPLORA L'ARCHIVIO";
  missionHintEl.classList.add("show");
 },600);
}
function maybeStartOculoReveal(){
 if(archiveState.terminalRead&&archiveState.helmetsRead&&!archiveState.revealing){
  archiveState.revealing=true;
  missionHintEl.classList.remove("show");
  setTimeout(()=>{ playDialogue(oculoRevealLines,showChoiceScreen); },900);
 }
}
const choiceScreenEl=document.getElementById("choiceScreen");
const choiceRowEl=document.getElementById("choiceRow");
const endingScreenEl=document.getElementById("endingScreen");
const cliffFlashEl=document.getElementById("cliffFlash");
const cliffEyeEl=document.getElementById("cliffEye");
const ENDINGS={
 good:{cls:"good",title:"CICLO INTERROTTO",
  text:"Distruggi il sistema di trasformazione dall'interno. Meridiana e TIC ti aiutano a coprirti. Oculo non dice altro. Il ciclo, per ora, si ferma."},
 normal:{cls:"normal",title:"CICLO DI SOSTITUZIONE: PRONTO",
  text:"Completi la missione come richiesto. La Torre torna in silenzio. Da qualche parte, un nuovo fascicolo si apre gia'."},
 evil:{cls:"evil",title:"IL POSTO SI LIBERA",
  text:"Prendi il posto di Oculo. Il sistema ha bisogno di qualcuno che guardi. Alla porta della Torre, qualcuno di nuovo sta per entrare."},
};
function showChoiceScreen(){
 choiceRowEl.innerHTML="";
 const opts=[
  {kind:"good",lbl:"RIFIUTA",txt:"Sabota il sistema di trasformazione. Interrompi il ciclo, qualunque cosa costi."},
  {kind:"normal",lbl:"COMPLETA",txt:"Porta a termine la missione come da protocollo. E' quello per cui sei stato scelto."},
  {kind:"evil",lbl:"PRENDI IL SUO POSTO",txt:"Diventa parte del sistema. Qualcuno deve pur guardare chi verra' dopo."},
 ];
 for(const o of opts){
  const b=document.createElement("button");
  b.className="choiceBtn";
  b.innerHTML=`<span class="lbl">${o.lbl}</span>${o.txt}`;
  b.addEventListener("click",()=>triggerEnding(o.kind));
  choiceRowEl.appendChild(b);
 }
 choiceScreenEl.classList.add("show");
}
function triggerEnding(kind){
 choiceScreenEl.classList.remove("show");
 // salva la sessione LIMEN condivisa con IT SHIFT (stessa chiave), cosi' i
 // marcatori LMN_02 restano per quando l'antologia li rilegge.
 try{
  const raw=localStorage.getItem("LIMEN_SESSION_01");
  const session=raw?JSON.parse(raw):{};
  session.LMN_02={ending:kind,ts:Date.now()};
  localStorage.setItem("LIMEN_SESSION_01",JSON.stringify(session));
 }catch(e){}
 const e=ENDINGS[kind];
 endingScreenEl.className=e.cls;
 endingScreenEl.querySelector("h1").textContent=e.title;
 endingScreenEl.querySelector("p").textContent=e.text;
 endingScreenEl.classList.add("show");
 stopAmbient(3.5);
 sfx.win();
 // cliffhanger: un lampo breve, poi l'occhio di Oculo compare enorme al
 // centro e resta li' a fissare — non "la scena", ma chi sta guardando lo
 // schermo — prima di sparire nel buio vero (non si torna al gioco).
 setTimeout(()=>{
  const h1=endingScreenEl.querySelector("h1"), p=endingScreenEl.querySelector("p"), code=endingScreenEl.querySelector(".code");
  [h1,p,code].forEach(el=>{ el.style.transition="opacity .8s ease"; el.style.opacity=0; });
  cliffFlashEl.style.transition="opacity .04s linear";
  cliffFlashEl.style.opacity=1;
  sfx.alarm();
  setTimeout(()=>{
   cliffFlashEl.style.transition="opacity 1.1s ease";
   cliffFlashEl.style.opacity=0;
   cliffEyeEl.classList.add("show");
   setTimeout(()=>{
    cliffEyeEl.style.transition="opacity 1.8s ease";
    cliffEyeEl.classList.remove("show");
    cliffEyeEl.style.opacity=0;
   },3400);
  },90);
 },4200);
}

function beginGame(){
 if(gameStarted)return;
 unlockAudio();
 gameStarted=true;
 titleEl.style.display="none";
 hudEl.style.display="block";
 document.body.classList.add("started");
 playAmbient("torre");
 startIntro();
}
titleEl.addEventListener("click",beginGame);
window.addEventListener("keydown",e=>{
 keys[e.code]=true;
 if(e.code==="Space"&&!gameStarted){beginGame();return;}
 if(e.code==="Space"&&dialogueActive){advanceDialogue();return;}
 if(e.code==="Space"&&zone==="archivio"&&nearInteractable){doArchiveInteract();return;}
 if(gameOverActive)return;
 if(e.code==="KeyT")startTransformation();
 if(e.code==="KeyM"&&gameStarted&&!transformState&&!dialogueActive){ if(zone==="torre")enterArena(); else enterTorre(); }
 if(e.code==="KeyF"){ if(zone==="colosso")colossoPunch(); else tryAttack(); }
 if(e.code==="KeyC"){ if(zone==="colosso")colossoSpecial(); else trySpecial(); }
 if(e.code==="ShiftLeft"||e.code==="ShiftRight")tryDodge();
});
window.addEventListener("keyup",e=>{keys[e.code]=false;});

// ------------------------------------------------------------
// Sequenza di trasformazione: pochi secondi, il giocatore perde il
// controllo, la telecamera si stringe sul personaggio, un paio di flash,
// poi la palette passa da civile a Ranger Zero (vermiglio/ottone) e
// compare il casco. Placeholder di posa/effetti, ma già cablato come
// vera cinematic a stati invece che un semplice timer unico.
// ------------------------------------------------------------
let transformState=null; // null oppure {t, toRanger}
function startTransformation(){
 if(transformState)return;
 transformState={t:0, toRanger:!player.transformed};
 sfx.transform();
}
function updateTransformation(dt){
 if(!transformState)return;
 transformState.t+=dt;
 const t=transformState.t;
 // via la card (era brutta anche corretta): ora solo due lampi rapidi e
 // via, la telecamera fa il resto del lavoro stringendosi sul personaggio.
 flashEl.style.opacity =
  (t>.10&&t<.20)?.9 :
  (t>.30&&t<.42)?1 :
  (t>.42&&t<.70)?Math.max(0,1-(t-.42)/.28) : 0;
 if(t>.36&&player.transformed!==transformState.toRanger){
  player.transformed=transformState.toRanger;
  player.helmet=transformState.toRanger;
 }
 if(t>.9)transformState=null;
}

// ------------------------------------------------------------
// Combat: attacco/schivata/energia, come da progettazione ("attacco,
// schivata, magari colpo speciale, energia" — niente di piu' elaborato).
// Funziona solo da trasformato: da civile non c'e' nulla da attaccare con.
// ------------------------------------------------------------
function facingDot(fromX,fromZ,fromYaw,toX,toZ){
 const dx=toX-fromX,dz=toZ-fromZ,len=Math.hypot(dx,dz)||1;
 const fx=Math.sin(fromYaw),fz=Math.cos(fromYaw);
 return {dot:(dx/len)*fx+(dz/len)*fz, dist:len};
}
function tryAttack(){
 if(!player.transformed||transformState||player.attackT>0||player.dodgeT>0)return;
 player.attackT=.34;
 sfx.attack();
 for(const en of enemies){
  if(en.dead||en.hidden)continue;
  const f=facingDot(player.x,player.z,player.yaw,en.x,en.z);
  if(f.dist<1.7&&f.dot>.55){
   damageEnemy(en,16);
   player.energy=Math.min(player.energyMax,player.energy+9);
  }
 }
}
let specialBursts=[];
let splashBursts=[];
function trySpecial(){
 if(!player.transformed||transformState||player.energy<player.energyMax||player.attackT>0)return;
 player.attackT=.5;
 player.specialT=1.0;
 player.energy=0;
 sfx.special();
 specialFlashEl.style.opacity=.9;
 setTimeout(()=>{specialFlashEl.style.opacity=0;},110);
 let hitAny=false;
 for(const en of enemies){
  if(en.dead||en.hidden)continue;
  const f=facingDot(player.x,player.z,player.yaw,en.x,en.z);
  if(f.dist<2.6&&f.dot>.25){
   damageEnemy(en,42);
   specialBursts.push({x:en.x,y:1.1,z:en.z,t:0});
   hitAny=true;
  }
 }
 if(!hitAny)specialBursts.push({x:player.x+Math.sin(player.yaw)*1.6,y:1.1,z:player.z+Math.cos(player.yaw)*1.6,t:0});
}
function tryDodge(){
 if(!player.transformed||transformState||player.dodgeCd>0)return;
 player.dodgeT=.28;player.dodgeCd=.85;player.invuln=.34;
 sfx.dodge();
}
function damageEnemy(en,amt){
 en.hp-=amt;en.hitFlash=.15;
 triggerSlowMo(.07,.06); // hit-stop: un colpo che va a segno si sente
 if(en.hp<=0){
  sfx.enemyDefeat();
  if(en.type==="raccoglitore"&&!en.retreated){
   // Il Raccoglitore non muore qui: si ritira verso il mare, e da li'
   // parte la fase 2 — cresce gigante, i 5 Ranger si combinano nel
   // Colosso, scontro finale in prima persona.
   en.retreated=true;en.state="retreat";
   triggerSlowMo(.35,.18); // colpo finale sui mob normali, un pelo piu' lungo
   setTimeout(startColossoSequence,900);
  }else{
   en.dead=true;
  }
 }else{
  sfx.hitEnemy();
 }
}
function updateEnemies(dt){
 maybeEmergeRaccoglitore();
 for(const en of enemies){
  if(en.dead)continue;
  if(en.emerging&&!en.emerged&&!en.hidden){
   en.emergeT=(en.emergeT||0)+dt;
   if(en.emergeT<.05)splashBursts.push({x:en.x,y:.1,z:en.z,t:0});
   const p=Math.min(1,en.emergeT/1.7);
   const ease=1-Math.pow(1-p,2);
   en.y=-2.6+ease*2.6;
   if(p>=1){en.emerged=true;en.y=0;}
   continue; // resta passivo finche' non e' emerso del tutto
  }
  if(en.hidden)continue;
  if(en.hitFlash>0)en.hitFlash-=dt;
  if(en.state==="retreat"){
   en.alpha=Math.max(0,en.alpha-dt*.6);
   en.z-=dt*1.4;
   if(en.alpha<=0)en.dead=true;
   continue;
  }
  const f=facingDot(en.x,en.z,en.yaw,player.x,player.z);
  const distToPlayer=f.dist;
  const wantRange=en.type==="raccoglitore"?1.9:1.5;
  // orienta il nemico verso il giocatore
  en.yaw=Math.atan2(player.x-en.x,player.z-en.z);
  if(en.cd>0)en.cd-=dt;
  if(distToPlayer>wantRange+.15){
   const spd=(en.type==="raccoglitore"?1.5:1.9)*dt;
   en.x+=Math.sin(en.yaw)*spd; en.z+=Math.cos(en.yaw)*spd;
   en.walkPhaseE+=dt*7.5;
  }else if(en.cd<=0){
   en.cd=en.type==="raccoglitore"?1.7:2.1;
   en.attackFlashT=.5;
   if(player.invuln<=0){
    const dmg=en.type==="raccoglitore"?14:7;
    player.hp=Math.max(0,player.hp-dmg);
    player.hitFlashT=.3;
    sfx.hitPlayer();
   }
  }
  if(en.attackFlashT>0)en.attackFlashT-=dt;
 }
 // separazione nemico-nemico: prima potevano accavallarsi tutti nello
 // stesso punto avvicinandosi al giocatore. Ora si spingono via a vicenda
 // se si sovrappongono troppo.
 for(let i=0;i<enemies.length;i++){
  const a=enemies[i];
  if(a.dead||a.state==="retreat")continue;
  const ra=(a.type==="raccoglitore"?.55:.40)*a.scale;
  for(let j=i+1;j<enemies.length;j++){
   const b=enemies[j];
   if(b.dead||b.state==="retreat")continue;
   const rb=(b.type==="raccoglitore"?.55:.40)*b.scale;
   const dx=b.x-a.x, dz=b.z-a.z, dist=Math.hypot(dx,dz)||.001;
   const minDist=ra+rb;
   if(dist<minDist){
    const push=(minDist-dist)/2, nx=dx/dist, nz=dz/dist;
    a.x-=nx*push; a.z-=nz*push;
    b.x+=nx*push; b.z+=nz*push;
   }
  }
 }
}

function resize(){
 c.width=innerWidth*devicePixelRatio;c.height=innerHeight*devicePixelRatio;
 c.style.width=innerWidth+"px";c.style.height=innerHeight+"px";
 gl.viewport(0,0,c.width,c.height);
}
window.addEventListener("resize",resize);
resize();

// impatto dell'attacco speciale: una piccola forma chiara che si espande e
// sparisce, riusata per ogni scoppio invece di ricostruire geometria nuova.
const burstMesh=boxMesh([1,.92,.55]);
const burstBuf=makeBuffer(burstMesh);

// ombra a terra condivisa: un box scuro schiacciato, riusato sotto ogni
// personaggio invece di costruirne una per ciascuno. Senza, tutti
// sembravano leggermente "fluttuare" sul pavimento.
const shadowMesh=boxMesh([0,0,0]);
const shadowBuf=makeBuffer(shadowMesh);
function drawShadow(x,z,radius,vp,alpha){
 drawBuffer(shadowBuf, mul(mat4.translate(x,.012,z),mat4.scale(radius,.02,radius*.85)), vp, alpha===undefined?.35:alpha);
}

// Rallentatore/hit-stop: un fattore di scala globale sul tempo di gioco,
// usato sia per i micro-freeze quando un colpo va a segno (hit-stop, molto
// breve e deciso) sia per il rallentatore vero e proprio sul colpo di
// grazia del Colosso (piu' lungo, meno estremo). Il conto alla rovescia
// va in tempo REALE (rawDt), non in quello scalato, altrimenti non
// finirebbe mai.
let slowMoT=0, slowMoFactor=1;
function triggerSlowMo(duration,factor){ slowMoT=duration; slowMoFactor=factor; }

let last=performance.now();
function frame(now){
 const rawDt=Math.min(.05,(now-last)/1000);last=now;
 let dt=rawDt;
 if(slowMoT>0){ dt=rawDt*slowMoFactor; slowMoT-=rawDt; }
 updateTransformation(dt);
 const inputLocked=!!transformState||!gameStarted||dialogueActive||gameOverActive||zone==="colosso"||(colosso&&colosso.phase==="converge")||choiceScreenEl.classList.contains("show")||endingScreenEl.classList.contains("show")||!!emergeCutscene;
 if(gameStarted)energyFillEl.style.width=(74+Math.sin(now/900)*4)+"%";

 // rotazione del personaggio (A/D) — indipendente dal movimento, niente
 // piu' ricalcolo dello yaw dal vettore di spostamento: quel ricalcolo
 // dipendeva a sua volta dallo yaw del frame precedente, creando un loop
 // instabile che faceva "sbattere" la direzione avanti e indietro ad ogni
 // frame (il personaggio sembrava girare su se stesso e annullava quasi
 // tutto lo spostamento reale nello spazio).
 const turnSpeed=2.6;
 if(!inputLocked){
  if(keys["KeyA"]||keys["ArrowLeft"])player.yaw+=turnSpeed*dt;
  if(keys["KeyD"]||keys["ArrowRight"])player.yaw-=turnSpeed*dt;
 }
 if(keys["KeyQ"]){camState.yawOffset+=1.6*dt;camState.idleT=0;}
 else if(keys["KeyE"]){camState.yawOffset-=1.6*dt;camState.idleT=0;}
 else{
  // La telecamera torna da sola dietro al personaggio dopo una breve pausa,
  // cosi' resta libera quando serve ma non ti ritrovi mai a combattere con
  // l'inquadratura storta perche' te ne sei dimenticato.
  camState.idleT=(camState.idleT||0)+dt;
  if(camState.idleT>.35)camState.yawOffset*=Math.max(0,1-dt*3.2);
  if(Math.abs(camState.yawOffset)<.002)camState.yawOffset=0;
 }

 // movimento avanti/indietro nella direzione in cui il personaggio e' gia' rivolto
 let moveAmt=0;
 if(!inputLocked){
  if(keys["KeyW"]||keys["ArrowUp"])moveAmt+=1;
  if(keys["KeyS"]||keys["ArrowDown"])moveAmt-=1;
 }
 let moving=false;
 if(moveAmt!==0){
  moving=true;
  player.x+=Math.sin(player.yaw)*moveAmt*player.speed*dt;
  player.z+=Math.cos(player.yaw)*moveAmt*player.speed*dt;
 }
 // schivata: piccolo scatto rapido nella direzione in cui si sta gia'
 // muovendo (o in avanti se fermi), con una finestra di invulnerabilita'.
 if(player.dodgeT>0){
  const dAmt=moveAmt||1;
  player.x+=Math.sin(player.yaw)*dAmt*9*dt;
  player.z+=Math.cos(player.yaw)*dAmt*9*dt;
  moving=true;
 }
 const zb=zoneBounds();
 player.x=Math.max(zb.xmin,Math.min(zb.xmax,player.x));
 player.z=Math.max(zb.zmin,Math.min(zb.zmax,player.z));

 // collisione giocatore-nemico: prima si camminava dritti attraverso gli
 // scagnozzi come se non ci fossero. Ora il giocatore viene spinto fuori
 // se si sovrappone troppo a un nemico vivo (non in ritirata).
 if(zone==="arena"){
  const pr=.32;
  for(const en of enemies){
   if(en.dead||en.state==="retreat"||en.hidden)continue;
   const er=(en.type==="raccoglitore"?.55:.40)*en.scale;
   const dx=player.x-en.x, dz=player.z-en.z, dist=Math.hypot(dx,dz)||.001;
   const minDist=pr+er;
   if(dist<minDist){
    const push=minDist-dist, nx=dx/dist, nz=dz/dist;
    player.x+=nx*push; player.z+=nz*push;
   }
  }
  player.x=Math.max(zb.xmin,Math.min(zb.xmax,player.x));
  player.z=Math.max(zb.zmin,Math.min(zb.zmax,player.z));
 }

 // timer di combattimento
 player.attackT=Math.max(0,player.attackT-dt);
 player.dodgeT=Math.max(0,player.dodgeT-dt);
 player.dodgeCd=Math.max(0,player.dodgeCd-dt);
 player.invuln=Math.max(0,player.invuln-dt);
 player.hitFlashT=Math.max(0,player.hitFlashT-dt);
 player.specialT=Math.max(0,player.specialT-dt);
 for(let i=specialBursts.length-1;i>=0;i--){specialBursts[i].t+=dt;if(specialBursts[i].t>.5)specialBursts.splice(i,1);}
 for(let i=splashBursts.length-1;i>=0;i--){splashBursts[i].t+=dt;if(splashBursts[i].t>.7)splashBursts.splice(i,1);}
 if(zone==="arena"&&gameStarted&&!transformState)updateEnemies(dt);
 if(colosso)updateColosso(dt);
 if(zone==="arena")updateEmergeCutscene(dt);

 // Archivio: mostra il prompt "SPAZIO — LEGGI" quando ci si avvicina al
 // terminale o alla parete degli elmi, cosi' l'esplorazione e' guidata ma
 // resta libera (il giocatore decide quando e se avvicinarsi).
 if(zone==="archivio"&&!dialogueActive){
  const dT=Math.hypot(player.x-TERMINAL_POS.x,player.z-TERMINAL_POS.z);
  const dH=Math.hypot(player.x-HELMET_POS.x,player.z-HELMET_POS.z);
  if(dT<1.6&&!archiveState.terminalRead){ nearInteractable="terminal"; interactPromptEl.textContent="SPAZIO — LEGGI IL REGISTRO"; interactPromptEl.classList.add("show"); }
  else if(dH<1.8&&!archiveState.helmetsRead){ nearInteractable="helmets"; interactPromptEl.textContent="SPAZIO — GUARDA GLI ELMI"; interactPromptEl.classList.add("show"); }
  else{ nearInteractable=null; interactPromptEl.classList.remove("show"); }
 }else if(nearInteractable){
  nearInteractable=null; interactPromptEl.classList.remove("show");
 }

 player.walkPhase+=dt*(moving?8.5:0);
 const pal=player.transformed?PAL_ZERO:PAL_CIVILE;
 const zoomIn=transformState?Math.min(1,transformState.t/.35):0;
 const ATTACK_DUR=.34;
 const attackPhase=player.attackT>0?1-player.attackT/ATTACK_DUR:0;
 const charMesh=buildCharacterBuffers(pal,player.walkPhase,moving?1:0,player.helmet,"ranger",player.attackT>0?attackPhase:0,player.specialT>0);
 const charBuf=makeBuffer(charMesh);

 let eye,target;
 if(emergeCutscene){
  // scena bloccata sull'emersione: telecamera fissa di lato, leggermente
  // bassa, cosi' quello che sale dall'acqua si sente davvero grande.
  const racc=emergeCutscene.racc;
  const pushIn=emergeCutscene.phase==="rising"?Math.min(1,emergeCutscene.t/1.7)*1.2:0;
  eye=[racc.x-5.5+pushIn,1.7,racc.z-4.5+pushIn*.6];
  target=[racc.x,emergeCutscene.phase==="buildup"?.1:1.6,racc.z];
 }else if(zone==="colosso"){
  // prima persona fissa: il Colosso non cammina, si mira e si attacca e
  // basta, come richiesto per tenere semplice lo scontro finale.
  const shake=colosso&&colosso.shakeT>0?colosso.shakeT*3:0;
  const sway=Math.sin(now/900)*.04;
  // durante il colpo di grazia la telecamera si stringe sul gigante che crolla
  const finishZ=colosso&&colosso.phase==="finishing"?(colosso.finishZoom||0)*(COLOSSO_CAM_Z-COLOSSO_GIANT_Z)*.5:0;
  eye=[Math.sin(now/300)*shake*.3, COLOSSO_EYE_Y+Math.sin(now/300)*shake*.2, COLOSSO_CAM_Z-finishZ];
  target=[Math.sin(now/300)*shake*.3+sway*4, COLOSSO_EYE_Y-1.5, COLOSSO_GIANT_Z];
 }else{
 // camera terza persona dietro il personaggio, con collisione contro i
 // muri: prima "sbatteva" dentro la geometria quando ci si girava vicino
 // a una parete. Ora la posizione ideale viene bloccata dentro i bordi
 // della zona attuale con un margine, cosi' l'occhio non entra mai nel muro.
 const camYaw=player.yaw+camState.yawOffset;
 const dist=camState.dist*(1-zoomIn*.72);
 let eyeX=player.x - Math.sin(camYaw)*dist;
 let eyeZ=player.z - Math.cos(camYaw)*dist;
 eyeX=Math.max(zb.camXmin,Math.min(zb.camXmax,eyeX));
 eyeZ=Math.max(zb.camZmin,Math.min(zb.camZmax,eyeZ));
 eye=[eyeX,camState.height,eyeZ];
 if(dialogueActive&&dialogueFocus){
  // durante i dialoghi la telecamera gira a guardare chi sta parlando
  // invece di restare fissa sul giocatore — prima si capiva solo dal nome
  // scritto nel balloon, ora si vede anche chi si muove.
  target=[dialogueFocus.x,dialogueFocus.y,dialogueFocus.z];
 }else{
  target=[player.x,1.1+zoomIn*.35,player.z];
 }
 }
 const view=mat4.lookAt(eye,target,[0,1,0]);
 const proj=mat4.perspective(60*Math.PI/180, c.width/c.height, .1, 100);
 const vp=mat4.multiply(proj,view);

 if(zone==="arena"||zone==="colosso")gl.clearColor(.08,.10,.20,1);
 else if(zone==="archivio")gl.clearColor(.02,.02,.03,1);
 else gl.clearColor(.035,.04,.055,1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

 if(zone==="torre"){
  drawBuffer(floorBuf,mat4.identity(),vp);
  drawBuffer(wallBuf,mat4.identity(),vp);
  drawBuffer(lightBeamBuf,mat4.identity(),vp);
  drawBuffer(pillarBuf,mat4.identity(),vp);
  drawBuffer(sidePanelBuf,mat4.identity(),vp);
  drawBuffer(limenPedestalBuf,mat4.identity(),vp);
  const limenPulse=.7+Math.sin(now/420)*.3;
  drawBuffer(limenCoreBuf, mul(mat4.translate(LIMEN_CORE_POS.x,LIMEN_CORE_POS.y,LIMEN_CORE_POS.z),mat4.scale(.14*limenPulse,.14*limenPulse,.14*limenPulse)), vp);
  drawBuffer(consoleBuf,mat4.identity(),vp);

  // Oculo come immagine vera (textured quad): pulsa piano, e durante la
  // trasformazione lampeggia piu' in fretta. Finche' oculo_eye.png non e'
  // presente/caricato, drawTexturedQuad non disegna nulla (si vede solo il
  // fascio di luce dietro), niente errori o quad grigi a schermo.
  const pulse=.92+Math.sin(now/650)*.08;
  const flicker=transformState?.7+Math.sin(now/45)*.3:1;
  const eyeModel=mul(mat4.translate(0,EYE_Y,EYE_Z+.01),mat4.scale(3.5*pulse,2.15*pulse,1));
  drawTexturedQuad(oculoTex,eyeModel,vp,flicker);

  // squadra: 4 Ranger con casco, colori da bibbia personaggi. Non piu'
  // completamente immobili: un leggero dondolio/spostamento del peso per
  // dare un minimo di vita, e chi sta parlando in quel momento si illumina
  // un po' di piu' cosi' si riconosce anche senza leggere il nome.
  for(let mi=0;mi<teamMembers.length;mi++){
   const m=teamMembers[mi];
   drawShadow(m.x,m.z,.40,vp);
   const idlePhase=now/900+mi*1.7;
   const isSpeaking=dialogueActive&&dialogueQueue[dialogueIndex]&&
    ((mi===0&&dialogueQueue[dialogueIndex].speaker==="ARCO")||(mi===1&&dialogueQueue[dialogueIndex].speaker==="MERIDIANA"));
   const mesh=buildCharacterBuffers(m.pal||[PAL_ARCO,PAL_MERIDIANA,PAL_RANGER3,PAL_RANGER4][mi],idlePhase,.16,true,"ranger",0);
   const mb=makeBuffer(mesh);
   const bump=isSpeaking?1.06:1;
   drawBuffer(mb, mul(mat4.translate(m.x,0,m.z),mat4.rotY(m.yaw+Math.sin(idlePhase*.4)*.05),mat4.scale(bump,bump,bump)), vp);
   gl.deleteBuffer(mb.posB);gl.deleteBuffer(mb.nrmB);gl.deleteBuffer(mb.colB);
  }

  // TIC: pattuglia tra i pannelli laterali facendo finta di controllarli,
  // invece di restare fermo a fluttuare sempre nello stesso punto.
  const patrolT=(now/1000)%(TIC_PATROL.length*2.4);
  const seg=Math.floor(patrolT/2.4), segT=Math.min(1,(patrolT%2.4)/1.6);
  const pA=TIC_PATROL[seg], pB=TIC_PATROL[(seg+1)%TIC_PATROL.length];
  const easeT=segT<1?(1-Math.cos(segT*Math.PI))/2:1;
  const ticX=pA.x+(pB.x-pA.x)*easeT, ticZ=pA.z+(pB.z-pA.z)*easeT;
  const ticY=2.1+Math.sin(now/500)*.10;
  const ticFaceYaw=Math.atan2(pB.x-pA.x,pB.z-pA.z);
  const ticModel=mul(mat4.translate(ticX,ticY,ticZ),mat4.rotY(ticFaceYaw));
  drawBuffer(ticBuf,ticModel,vp);
 }else if(zone==="arena"){
  drawBuffer(arenaSkyBuf,mat4.identity(),vp);
  drawBuffer(arenaFloorBuf,mat4.identity(),vp);
  drawBuffer(arenaSeaBuf,mat4.identity(),vp);
  drawBuffer(arenaPropBuf,mat4.identity(),vp);
  drawBuffer(arenaEdgeBuf,mat4.identity(),vp);
  for(const en of enemies){
   if(en.dead||en.hidden)continue;
   drawShadow(en.x,en.z,.40*en.scale,vp,.35*(en.alpha!==undefined?en.alpha:1));
   const hitPulse=en.hitFlash>0?1+en.hitFlash*1.6:1;
   const s=en.scale*hitPulse;
   const enAttackPhase=en.attackFlashT>0?1-en.attackFlashT/.5:0;
   const enMoving=en.state!=="retreat"&&facingDot(en.x,en.z,en.yaw,player.x,player.z).dist>(en.type==="raccoglitore"?2.05:1.65);
   const enMesh=buildCharacterBuffers(en.pal,en.walkPhaseE,enMoving?1:0,true,en.type,en.attackFlashT>0?enAttackPhase:0);
   const enBuf=makeBuffer(enMesh);
   const enModel=mul(mat4.translate(en.x,en.y||0,en.z),mat4.rotY(en.yaw),mat4.scale(s,s,s));
   drawBuffer(enBuf,enModel,vp,en.alpha);
   gl.deleteBuffer(enBuf.posB);gl.deleteBuffer(enBuf.nrmB);gl.deleteBuffer(enBuf.colB);
  }
  if(colossoTeamPos){
   for(const tp of colossoTeamPos){
    const tMesh=buildCharacterBuffers(tp.pal,now/300,1,true,"ranger",0);
    const tBuf=makeBuffer(tMesh);
    const tYaw=Math.atan2(player.x-tp.x,player.z-tp.z);
    drawBuffer(tBuf, mul(mat4.translate(tp.x,0,tp.z),mat4.rotY(tYaw)), vp);
    gl.deleteBuffer(tBuf.posB);gl.deleteBuffer(tBuf.nrmB);gl.deleteBuffer(tBuf.colB);
   }
  }
 }else if(zone==="colosso"&&colosso){
  drawBuffer(arenaSkyBuf,mat4.identity(),vp);
  drawBuffer(arenaFloorBuf,mat4.identity(),vp);
  drawBuffer(arenaSeaBuf,mat4.identity(),vp);
  // Il Raccoglitore gigante, sempre rivolto verso la telecamera (verso il
  // Colosso), cresce durante la cutscene e resta fisso a scala massima
  // durante il combattimento.
  const giantWobble=1+Math.sin(now/260)*.02;
  const finishTilt=colosso.phase==="finishing"?(colosso.finishTilt||0):0;
  const gm=mul(mat4.translate(ARENA_CX,0,COLOSSO_GIANT_Z),mat4.rotY(Math.PI),mat4.rotX(finishTilt),mat4.scale(colosso.giantScale*giantWobble,colosso.giantScale,colosso.giantScale*giantWobble));
  const giantMesh=buildCharacterBuffers(PAL_RACCOGLITORE,now/450,0,true,"raccoglitore",0);
  const giantBuf=makeBuffer(giantMesh);
  drawBuffer(giantBuf,gm,vp);
  gl.deleteBuffer(giantBuf.posB);gl.deleteBuffer(giantBuf.nrmB);gl.deleteBuffer(giantBuf.colB);

  if(colosso.phase==="fight"){
   // effetti: pugno = piccolo scoppio, speciale = fascio di luce dal Colosso al bersaglio
   for(const b of colosso.beamBursts){
    if(b.kind==="punch"){
     const p=b.t/.4, sc=.4+p*2.2, a=Math.max(0,1-p);
     drawBuffer(burstBuf, mul(mat4.translate(ARENA_CX,COLOSSO_EYE_Y-1.5,COLOSSO_GIANT_Z+4),mat4.scale(sc,sc,sc)), vp, a*.9);
    }else{
     const p=b.t/.4, a=Math.max(0,1-p);
     const beamLen=(COLOSSO_CAM_Z-COLOSSO_GIANT_Z)/2;
     drawBuffer(burstBuf, mul(mat4.translate(ARENA_CX,COLOSSO_EYE_Y-1.5,(COLOSSO_CAM_Z+COLOSSO_GIANT_Z)/2),mat4.rotX(Math.PI/2),mat4.scale(.5,beamLen,.5)), vp, a*.85);
    }
   }
  }
 }else if(zone==="archivio"){
  drawBuffer(archivioFloorBuf,mat4.identity(),vp);
  drawBuffer(archivioWallBuf,mat4.identity(),vp);
  drawBuffer(archivioHelmetBuf,mat4.identity(),vp);
  drawBuffer(archivioTerminalBuf,mat4.identity(),vp);
 }

 if(zone!=="colosso"){
  drawShadow(player.x,player.z,.42,vp);
  const charModel=mul(mat4.translate(player.x,0,player.z),mat4.rotY(player.yaw));
  drawBuffer(charBuf,charModel,vp);
 }

 // scoppi dell'attacco speciale: si espandono e sfumano nel giro di mezzo secondo
 for(const b of specialBursts){
  const p=b.t/.5;
  const sc=.15+p*1.1;
  const a=Math.max(0,1-p);
  drawBuffer(burstBuf, mul(mat4.translate(b.x,b.y,b.z),mat4.rotY(p*4),mat4.scale(sc,sc,sc)), vp, a*.9);
 }
 // schizzo d'acqua quando Il Raccoglitore emerge: piu' largo e piatto,
 // colore chiaro/spumeggiante invece che dorato come i colpi speciali
 for(const b of splashBursts){
  const p=b.t/.7;
  const sc=.3+p*2.4;
  const a=Math.max(0,1-p*1.1);
  drawBuffer(burstBuf, mul(mat4.translate(b.x,b.y,b.z),mat4.rotY(p*2),mat4.scale(sc,.12+p*.3,sc)), vp, a*.8);
 }

 gl.deleteBuffer(charBuf.posB);gl.deleteBuffer(charBuf.nrmB);gl.deleteBuffer(charBuf.colB);

 // HUD: barra energia + barra vita + vignetta danno
 if(gameStarted){
  energyFillEl.style.width=(player.energy/player.energyMax*100)+"%";
  if(zone==="colosso"&&colosso){
   hpFillEl.style.width=Math.max(0,colosso.playerHp/colosso.playerHpMax*100)+"%";
   colossoHpFillEl.style.width=Math.max(0,colosso.giantHp/colosso.giantHpMax*100)+"%";
   dmgVignetteEl.style.opacity=colosso.shakeT>0?Math.min(1,colosso.shakeT/.35)*.8:0;
  }else{
   hpFillEl.style.width=Math.max(0,player.hp/player.hpMax*100)+"%";
   dmgVignetteEl.style.opacity=player.hitFlashT>0?Math.min(1,player.hitFlashT/.3)*.85:0;
   if(player.hp<=0&&!gameOverActive)triggerGameOver();
  }
 }

 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// esposto per test/debug
window.__rz={player,camState,startTransformation,enterArena,enterTorre,advanceDialogue,triggerGameOver,
 startColossoSequence,colossoPunch,colossoSpecial,startArchiveSequence,showChoiceScreen,triggerEnding,
 get enemies(){return enemies},get zone(){return zone},get dialogueActive(){return dialogueActive},
 get dialogueIndex(){return dialogueIndex},get gameOverActive(){return gameOverActive},get colosso(){return colosso}};
})();
