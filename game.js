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
 // luce principale (in alto/avanti-destra) + una di riempimento piu'
 // debole e fredda dal lato opposto, cosi' i dettagli delle armature
 // (spallacci, cinturone, trim del petto) restano leggibili anche visti
 // di lato o alle spalle, invece di sparire nel nero — prima con una sola
 // luce direzionale i pannelli si perdevano contro il resto della tuta.
 vec3 keyDir=normalize(vec3(.45,.85,.30));
 vec3 fillDir=normalize(vec3(-.5,.25,-.6));
 float diffKey=max(dot(n,keyDir),0.0);
 float diffFill=max(dot(n,fillDir),0.0);
 float ambient=.40;
 vec3 fillTint=vec3(.90,.94,1.02); // il fill e' leggermente freddo/bluastro, il key resta neutro
 vec3 lit=vColor*(ambient+diffKey*.56)+vColor*fillTint*diffFill*.22;
 gl_FragColor=vec4(lit,uAlphaMain);
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
// v38: niente back-face culling sui personaggi/box low-poly; evita che schiene e capelli sembrino bucati
gl.disable(gl.CULL_FACE);

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
   const isPOT=n=>(n&(n-1))===0;
   if(isPOT(img.width)&&isPOT(img.height)){
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
   }else{
    // WebGL1: le texture NPOT non possono usare mipmap/repeat. Oculo e
    // arena_sky sono volutamente NPOT, quindi restano LINEAR + CLAMP.
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   }
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
 // Quad UI/fondali: doppia faccia. In v23 arena_sky poteva sparire a seconda
 // dell'orientamento del winding/camera perche' il culling globale era attivo.
 const cullWas=gl.isEnabled(gl.CULL_FACE); if(cullWas)gl.disable(gl.CULL_FACE);
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
 if(cullWas)// v38: niente back-face culling sui personaggi/box low-poly; evita che schiene e capelli sembrino bucati
gl.disable(gl.CULL_FACE);
 gl.useProgram(prog);
}

// Mesh texturizzata con UV arbitrari: serve per il panorama 360. A differenza
// del vecchio quad frontale, qui una sola texture 2:1 viene avvolta davvero
// intorno all'arena, quindi la camera puo' girare senza mostrare lati vuoti.
function makeTexMesh(pos,uv){
 const posB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,posB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);
 const uvB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uvB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uv),gl.STATIC_DRAW);
 return {posB,uvB,count:pos.length/3};
}
function drawTexturedMesh(tex,mesh,model,vp,alpha){
 if(!tex||tex.failed||!mesh)return;
 gl.useProgram(texProg);
 const cullWas=gl.isEnabled(gl.CULL_FACE);if(cullWas)gl.disable(gl.CULL_FACE);
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.posB);gl.enableVertexAttribArray(texAPos);gl.vertexAttribPointer(texAPos,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,mesh.uvB);gl.enableVertexAttribArray(texAUV);gl.vertexAttribPointer(texAUV,2,gl.FLOAT,false,0,0);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(texUTex,0);
 gl.uniform1f(texUAlpha,alpha===undefined?1:alpha);gl.uniformMatrix4fv(texUMVP,false,mat4.multiply(vp,model));
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
 gl.drawArrays(gl.TRIANGLES,0,mesh.count);
 gl.depthMask(true);gl.disable(gl.BLEND);if(cullWas)// v38: niente back-face culling sui personaggi/box low-poly; evita che schiene e capelli sembrino bucati
gl.disable(gl.CULL_FACE);gl.useProgram(prog);
}

// v24.1.1 — fondale arena sicuro. In v24.1 le quattro pareti-cielo di
// fallback venivano disegnate PRIMA del panorama e scrivevano nel depth
// buffer: il 360 risultava nascosto e, nel giant fight, la camera finiva
// letteralmente dietro la parete posteriore. Ora, quando la texture e'
// pronta, il panorama viene disegnato come vero background senza depth test;
// il vecchio cielo a bande compare solo finche' l'immagine non e' caricata.
function drawArenaBackdrop(vp){
 if(arenaSkyTex&&arenaSkyTex.ready){
  const depthWas=gl.isEnabled(gl.DEPTH_TEST);
  if(depthWas)gl.disable(gl.DEPTH_TEST);
  drawTexturedMesh(arenaSkyTex,arenaPanoramaMesh,mat4.identity(),vp,1);
  if(depthWas)gl.enable(gl.DEPTH_TEST);
 }else{
  drawBuffer(arenaSkyBuf,mat4.identity(),vp);
 }
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
// Prisma ottagonale (asse Y): stessa "ingombro" 1x1x1 di un boxMesh, ma con
// gli 8 lati invece di 4 — da lontano/a media distanza legge come una forma
// arrotondata invece che uno spigolo vivo da cubo. E' il pezzo che serve per
// far sembrare elmi e piastroni "da tuta indossata" invece che "da robot":
// il motore ha solo geometria flat-shaded, niente sfere vere, ma un ottagono
// basta a rompere la lettura "scatola" senza aggiungere costo vero.
function octMesh(col,capTop,capBottom){
 if(capTop===undefined)capTop=true;
 if(capBottom===undefined)capBottom=true;
 const p=[],n=[],c=[];
 const N=8, R=.5*1.0824; // raggio corretto cosi' le facce piatte toccano ancora il bordo 0.5 di un box equivalente
 const ring=[];
 for(let i=0;i<N;i++){
  const a=(i/N)*Math.PI*2+Math.PI/N;
  ring.push([Math.cos(a)*.5, Math.sin(a)*.5]);
 }
 for(let i=0;i<N;i++){
  const a=ring[i], b=ring[(i+1)%N];
  const mx=(a[0]+b[0])/2, mz=(a[1]+b[1])/2, len=Math.hypot(mx,mz)||1;
  const nm=[mx/len,0,mz/len];
  const quad=[[a[0],-.5,a[1]],[b[0],-.5,b[1]],[b[0],.5,b[1]],[a[0],.5,a[1]]];
  const idx=[0,1,2,0,2,3];
  for(const qi of idx){ p.push(...quad[qi]); n.push(...nm); c.push(...col); }
 }
 if(capTop){
  for(let i=1;i<N-1;i++){
   const tri=[[ring[0][0],.5,ring[0][1]],[ring[i][0],.5,ring[i][1]],[ring[i+1][0],.5,ring[i+1][1]]];
   for(const v of tri){ p.push(...v); n.push(0,1,0); c.push(...col); }
  }
 }
 if(capBottom){
  for(let i=1;i<N-1;i++){
   const tri=[[ring[0][0],-.5,ring[0][1]],[ring[i+1][0],-.5,ring[i+1][1]],[ring[i][0],-.5,ring[i][1]]];
   for(const v of tri){ p.push(...v); n.push(0,-1,0); c.push(...col); }
  }
 }
 return {pos:new Float32Array(p),nrm:new Float32Array(n),col:new Float32Array(c),count:p.length/3};
}
// Cupola bassa (mezza forma ottagonale schiacciata in alto): usata per la
// calotta dell'elmo, cosi' la sommità è arrotondata invece che piatta come
// il tetto di un cubo.
function domeMesh(col){
 const p=[],n=[],c=[];
 const N=8;
 const ring=[]; for(let i=0;i<N;i++){ const a=(i/N)*Math.PI*2+Math.PI/N; ring.push([Math.cos(a)*.5,Math.sin(a)*.5]); }
 // un secondo anello piu' stretto appena sotto la cima, cosi' la calotta
 // sale in due gradini invece di un unico cono ripido — legge molto piu'
 // arrotondata, meno "cappuccio a punta".
 const ring2=ring.map(v=>[v[0]*.55,v[1]*.55]);
 const apex=[0,.40,0];
 for(let i=0;i<N;i++){
  const a=ring[i], b=ring[(i+1)%N];
  const a2=ring2[i], b2=ring2[(i+1)%N];
  const quad=[[a[0],.15,a[1]],[b[0],.15,b[1]],[b2[0],.30,b2[1]],[a2[0],.30,a2[1]]];
  const e1=[quad[1][0]-quad[0][0],quad[1][1]-quad[0][1],quad[1][2]-quad[0][2]];
  const e2=[quad[3][0]-quad[0][0],quad[3][1]-quad[0][1],quad[3][2]-quad[0][2]];
  let nx=e1[1]*e2[2]-e1[2]*e2[1], ny=e1[2]*e2[0]-e1[0]*e2[2], nz=e1[0]*e2[1]-e1[1]*e2[0];
  const l=Math.hypot(nx,ny,nz)||1; nx/=l;ny/=l;nz/=l;
  const idx=[0,1,2,0,2,3];
  for(const qi of idx){ p.push(...quad[qi]); n.push(nx,ny,nz); c.push(...col); }
 }
 for(let i=0;i<N;i++){
  const a=ring2[i], b=ring2[(i+1)%N];
  const tri=[[a[0],.30,a[1]],[b[0],.30,b[1]],apex];
  const e1=[tri[1][0]-tri[0][0],tri[1][1]-tri[0][1],tri[1][2]-tri[0][2]];
  const e2=[tri[2][0]-tri[0][0],tri[2][1]-tri[0][1],tri[2][2]-tri[0][2]];
  let nx=e1[1]*e2[2]-e1[2]*e2[1], ny=e1[2]*e2[0]-e1[0]*e2[2], nz=e1[0]*e2[1]-e1[1]*e2[0];
  const l=Math.hypot(nx,ny,nz)||1; nx/=l;ny/=l;nz/=l;
  for(const v of tri){ p.push(...v); n.push(nx,ny,nz); c.push(...col); }
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

// Buffer dinamico condiviso per tutti i personaggi animati. La v22 creava e
// distruggeva tre WebGLBuffer per ogni personaggio a ogni frame; qui gli
// oggetti GPU vengono creati una volta sola e si aggiornano solo i dati.
const dynamicMeshBuf={posB:gl.createBuffer(),nrmB:gl.createBuffer(),colB:gl.createBuffer(),count:0};
function drawDynamicMesh(mesh,model,vp,alpha){
 gl.bindBuffer(gl.ARRAY_BUFFER,dynamicMeshBuf.posB);gl.bufferData(gl.ARRAY_BUFFER,mesh.pos,gl.DYNAMIC_DRAW);
 gl.bindBuffer(gl.ARRAY_BUFFER,dynamicMeshBuf.nrmB);gl.bufferData(gl.ARRAY_BUFFER,mesh.nrm,gl.DYNAMIC_DRAW);
 gl.bindBuffer(gl.ARRAY_BUFFER,dynamicMeshBuf.colB);gl.bufferData(gl.ARRAY_BUFFER,mesh.col,gl.DYNAMIC_DRAW);
 dynamicMeshBuf.count=mesh.count;
 drawBuffer(dynamicMeshBuf,model,vp,alpha);
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
 {mesh:boxMesh([.08,.085,.11]),mtx:mul(mat4.translate(0,ROOM_H+.15,0),mat4.scale(ROOM_W,.3,ROOM_D))}, // soffitto
];
// pareti a bande sfumate (blu profondo in alto, viola, arancio caldo in
// basso) — PRIMA solo la parete di fondo dietro Oculo le aveva, mentre le
// laterali erano un grigio-blu piatto: si vedeva uno stacco brutto agli
// angoli dove si incontravano i due stili. Ora tutte e tre le pareti usano
// la stessa banda di colori, cosi' la stanza legge come un unico ambiente.
const backBands=[
 [.10,.11,.22], [.16,.13,.28], [.30,.15,.30], [.42,.20,.24], [.30,.14,.12]
];
for(let i=0;i<backBands.length;i++){
 const bh=ROOM_H/backBands.length;
 wallParts.push({mesh:boxMesh(backBands[i]),mtx:mul(mat4.translate(0,bh*i+bh/2,-ROOM_D/2),mat4.scale(ROOM_W,bh+.02,.3))});
 wallParts.push({mesh:boxMesh(backBands[i]),mtx:mul(mat4.translate(-ROOM_W/2,bh*i+bh/2,0),mat4.scale(.3,bh+.02,ROOM_D))}); // ovest
 wallParts.push({mesh:boxMesh(backBands[i]),mtx:mul(mat4.translate(ROOM_W/2,bh*i+bh/2,0),mat4.scale(.3,bh+.02,ROOM_D))});  // est
}
const wallBuf=makeBuffer(bakeParts(wallParts));
// v46 — la Torre non aveva un vero ingresso: si iniziava gia' dentro,
// senza nessun senso di arrivo. Una cornice di porta sulla parete di
// fondo (dove il giocatore ora appare all'inizio) da' un punto fisico da
// cui "entrare" camminando verso il centro della stanza.
const doorFrameBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.09,.10,.13]),mtx:mul(mat4.translate(-1.35,2.3,ROOM_D/2-.05),mat4.scale(.22,4.6,.22))},
 {mesh:boxMesh([.09,.10,.13]),mtx:mul(mat4.translate(1.35,2.3,ROOM_D/2-.05),mat4.scale(.22,4.6,.22))},
 {mesh:boxMesh([.09,.10,.13]),mtx:mul(mat4.translate(0,4.5,ROOM_D/2-.05),mat4.scale(2.8,.22,.22))},
 {mesh:boxMesh([.35,.55,.65]),mtx:mul(mat4.translate(-1.35,2.3,ROOM_D/2-.10),mat4.scale(.05,4.4,.05))},
 {mesh:boxMesh([.35,.55,.65]),mtx:mul(mat4.translate(1.35,2.3,ROOM_D/2-.10),mat4.scale(.05,4.4,.05))},
]));

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
 // il pannello ovest a z=-2.2 e' quello anomalo: NON costruire anche
 // quello acceso sotto, altrimenti due superfici coincidono (z-fighting).
 if(z!==-2.2)sidePanelParts.push(...buildWallPanel(-ROOM_W/2+.16, z, 0, true));
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
// BAR / PALESTRA — PROLOGO v55
// Palette e layout ispirati ai centri ricreativi fine anni '80 / primi '90:
// crema caldo, menta, teal, rosa e viola. Una sola grande sala leggibile,
// con palestra davanti e juice bar rialzato sul fondo.
// ============================================================
const BAR_CX=-40, BAR_CZ=0, BAR_W=20, BAR_D=18, BAR_H=5.4;
const BAR_PLATFORM_Y=.56;
const BAR_PLATFORM_FRONT_Z=BAR_CZ-3.0;
const BAR_STAIRS_TOP_Z=BAR_CZ-3.85;
const BAR_STAIRS_HALF_W=1.55;
function barFloorY(x,z){
 // Il juice bar e' davvero rialzato. Sul fronte si sale soltanto dalla
 // scalinata centrale: fuori dalla sua larghezza il bordo della pedana
 // resta un ostacolo fisico, quindi non si puo' piu' "entrare" nel blocco.
 if(z<=BAR_STAIRS_TOP_Z)return BAR_PLATFORM_Y;
 if(z>=BAR_PLATFORM_FRONT_Z)return 0;
 if(Math.abs(x-BAR_CX)>BAR_STAIRS_HALF_W)return 0;
 const t=(BAR_PLATFORM_FRONT_Z-z)/(BAR_PLATFORM_FRONT_Z-BAR_STAIRS_TOP_Z);
 return BAR_PLATFORM_Y*Math.max(0,Math.min(1,t));
}
const barFloorParts=[
 {mesh:boxMesh([.52,.50,.40]),mtx:mul(mat4.translate(BAR_CX,-.10,BAR_CZ),mat4.scale(BAR_W,.20,BAR_D))},
 {mesh:boxMesh([.16,.48,.46]),mtx:mul(mat4.translate(BAR_CX,0.01,BAR_CZ+1.0),mat4.scale(8.4,.025,6.2))},
 {mesh:boxMesh([.20,.55,.68]),mtx:mul(mat4.translate(BAR_CX-4.8,.035,BAR_CZ+2.2),mat4.scale(3.7,.055,1.55))},
 {mesh:boxMesh([.48,.32,.52]),mtx:mul(mat4.translate(BAR_CX+4.5,.035,BAR_CZ+2.0),mat4.scale(3.2,.055,1.35))},
 {mesh:boxMesh([.22,.58,.50]),mtx:mul(mat4.translate(BAR_CX,0.28,BAR_CZ-5.5),mat4.scale(BAR_W-1.2,.55,5.0))},
 // scala centrale vera: quattro gradini leggibili che portano al juice bar.
 {mesh:boxMesh([.34,.50,.45]),mtx:mul(mat4.translate(BAR_CX,.07,BAR_CZ-3.00),mat4.scale(3.10,.14,.48))},
 {mesh:boxMesh([.31,.53,.48]),mtx:mul(mat4.translate(BAR_CX,.14,BAR_CZ-3.27),mat4.scale(3.10,.28,.48))},
 {mesh:boxMesh([.28,.56,.50]),mtx:mul(mat4.translate(BAR_CX,.21,BAR_CZ-3.54),mat4.scale(3.10,.42,.48))},
 {mesh:boxMesh([.25,.59,.52]),mtx:mul(mat4.translate(BAR_CX,.28,BAR_CZ-3.81),mat4.scale(3.10,.56,.48))},
];
const barFloorBuf=makeBuffer(bakeParts(barFloorParts));
const barWallParts=[];
for(let i=0;i<4;i++){
 const h=BAR_H/4, cols=[[.62,.55,.39],[.21,.56,.50],[.16,.48,.46],[.34,.20,.39]];
 barWallParts.push({mesh:boxMesh(cols[i]),mtx:mul(mat4.translate(BAR_CX,h*i+h/2,BAR_CZ-BAR_D/2),mat4.scale(BAR_W,h+.03,.30))});
 barWallParts.push({mesh:boxMesh(cols[i]),mtx:mul(mat4.translate(BAR_CX-BAR_W/2,h*i+h/2,BAR_CZ),mat4.scale(.30,h+.03,BAR_D))});
 barWallParts.push({mesh:boxMesh(cols[i]),mtx:mul(mat4.translate(BAR_CX+BAR_W/2,h*i+h/2,BAR_CZ),mat4.scale(.30,h+.03,BAR_D))});
}
barWallParts.push({mesh:boxMesh([.18,.22,.23]),mtx:mul(mat4.translate(BAR_CX,BAR_H+.15,BAR_CZ),mat4.scale(BAR_W,.30,BAR_D))});
const barWallBuf=makeBuffer(bakeParts(barWallParts));
const barProps=[];
// bancone rialzato
barProps.push({mesh:boxMesh([.34,.20,.31]),mtx:mul(mat4.translate(BAR_CX,1.05,BAR_CZ-7.15),mat4.scale(7.8,1.20,.80))});
barProps.push({mesh:boxMesh([.86,.38,.63]),mtx:mul(mat4.translate(BAR_CX,1.72,BAR_CZ-7.08),mat4.scale(7.9,.12,.92))});
// insegna neon astratta
barProps.push({mesh:boxMesh([.88,.34,.63]),mtx:mul(mat4.translate(BAR_CX,3.35,BAR_CZ-8.73),mat4.scale(2.4,.18,.05))});
barProps.push({mesh:boxMesh([.20,.82,.75]),mtx:mul(mat4.translate(BAR_CX,3.15,BAR_CZ-8.72),mat4.scale(1.35,.10,.055))});
// distributori
for(const x of [BAR_CX-6.8,BAR_CX+6.8]){
 barProps.push({mesh:boxMesh([.23,.27,.37]),mtx:mul(mat4.translate(x,1.35,BAR_CZ-7.65),mat4.scale(1.1,2.5,.72))});
 barProps.push({mesh:boxMesh([.26,.72,.82]),mtx:mul(mat4.translate(x,1.65,BAR_CZ-7.27),mat4.scale(.74,.72,.04))});
}
// tavolini e sgabelli
for(const x of [-5.0,-2.4,2.4,5.0]){
 barProps.push({mesh:boxMesh([.46,.28,.45]),mtx:mul(mat4.translate(BAR_CX+x,.72,BAR_CZ-4.4),mat4.scale(1.2,.10,1.2))});
 barProps.push({mesh:boxMesh([.20,.18,.22]),mtx:mul(mat4.translate(BAR_CX+x,.36,BAR_CZ-4.4),mat4.scale(.12,.68,.12))});
}
// materassi, step, sacco e attrezzi
for(const q of [[-6,3.5,3.0,1.1],[5.7,3.6,2.7,1.1],[-3.2,.2,2.0,1.2],[3.0,.5,2.2,1.0]])
 barProps.push({mesh:boxMesh(q[0]<0?[.19,.48,.68]:[.44,.26,.49]),mtx:mul(mat4.translate(BAR_CX+q[0],.12,BAR_CZ+q[1]),mat4.scale(q[2],.18,q[3]))});
for(const x of [-7.8,-6.8,6.6,7.6])barProps.push({mesh:boxMesh([.22,.56,.48]),mtx:mul(mat4.translate(BAR_CX+x,.18,BAR_CZ+5.4),mat4.scale(.72,.32,.52))});
barProps.push({mesh:boxMesh([.08,.16,.25]),mtx:mul(mat4.translate(BAR_CX+8.2,2.0,BAR_CZ+1.0),mat4.scale(.62,2.8,.62))});
barProps.push({mesh:boxMesh([.19,.46,.68]),mtx:mul(mat4.translate(BAR_CX+8.2,3.55,BAR_CZ+1.0),mat4.scale(.10,.55,.10))});
// pannello/nucleo nascosto che verra' esposto dall'esplosione
barProps.push({mesh:boxMesh([.08,.10,.12]),mtx:mul(mat4.translate(BAR_CX+1.0,1.25,BAR_CZ-7.92),mat4.scale(1.05,1.55,.10))});
const barPropsBuf=makeBuffer(bakeParts(barProps));
const barCrisisParts=[
 {mesh:boxMesh([.22,.08,.08]),mtx:mul(mat4.translate(BAR_CX-2.2,.24,BAR_CZ-2.0),mat4.rotZ(.35),mat4.scale(2.4,.18,.40))},
 {mesh:boxMesh([.18,.10,.10]),mtx:mul(mat4.translate(BAR_CX+2.8,.20,BAR_CZ-3.0),mat4.rotZ(-.55),mat4.scale(1.8,.15,.35))},
 {mesh:boxMesh([.55,.12,.08]),mtx:mul(mat4.translate(BAR_CX+1.0,1.25,BAR_CZ-7.78),mat4.scale(.62,.92,.055))},
];
const barCrisisBuf=makeBuffer(bakeParts(barCrisisParts));
const barCoreBuf=makeBuffer(boxMesh([.18,.90,.52]));

// ============================================================
// PERSONAGGIO — vero rig 3D (non billboard): busto, testa, braccia, gambe
// separate, ognuna col proprio local transform, animate a runtime.
// Parametrizzato per palette (tuta/accento) cosi' lo stesso rig serve sia
// per il player sia per i membri della squadra, con o senza casco.
// ============================================================
function makePalette(suit,accent,skin,hair){
 const under=suit.map(v=>Math.max(.035,v*.38));
 // visiera nera (con un pelo di riflesso bluastro scurissimo, non piatta)
 // invece che ciano acceso — cosi' legge da protezione vera, non da schermo.
 // stivali e guanti bianchi come nella tuta di riferimento (non piu' scuri
 // da tattici) — e' proprio quel bianco a "leggere" da tuta sentai classica.
 return {suit,accent,under,skin:skin||[.85,.63,.48],hair:hair||[.14,.11,.10],visor:[.035,.04,.055],boot:[.92,.92,.94],glove:[.92,.92,.94],helmetShell:suit};
}
// Civili: outfit diversi e leggibili. Le armature usano invece una sottotuta
// scura + placche colorate, cosi' non sembrano piu' mute da sommozzatore.
// v39: la maglia civile di Zero era rimasta grigia con l'accento
// ruggine/bronzo di prima della v36 (quando divenne verde) — mai
// aggiornata insieme al resto della squadra. Ora segue la stessa regola
// degli altri: maglia del colore della tuta da Ranger.
const PAL_CIVILE=makePalette([.06,.34,.17],[.82,.68,.20],[.85,.63,.48],[.12,.09,.07]);
// v36: formazione tokusatsu classica da CINQUE membri + sesto Ranger.
// Arco rosso, Meridiana blu, Jun giallo, Vale rosa, DON nero. Zero e' il
// SESTO RANGER VERDE: distinto dalla squadra base ma finalmente leggibile
// con il colore speciale classico del toku. Il vecchio modulo dorsale NON
// e' piu' attaccato al corpo di Zero: appartiene al COLOSSO combinato.
const PAL_ZERO   =makePalette([.07,.48,.22],[.82,.68,.20],[.85,.63,.48],[.12,.09,.07]);
PAL_ZERO.isZero=true;
const PAL_ARCO   =makePalette([.80,.09,.07],[.90,.72,.18],[.78,.55,.40],[.13,.08,.05]);
const PAL_MERIDIANA=makePalette([.10,.30,.78],[.85,.88,.92],[.78,.58,.46],[.08,.07,.08]);
const PAL_RANGER3=makePalette([.92,.78,.08],[.30,.24,.10],[.76,.54,.40],[.10,.07,.05]);
const PAL_RANGER4=makePalette([.92,.35,.62],[.98,.90,.94],[.84,.62,.47],[.88,.74,.28]);
// DON: quinto Ranger nero e richiamo discreto al capitolo precedente.
// Pelle e capelli restano leggibili anche in civile; la tuta usa nero/gunmetal
// con trim argento per non confondersi con le zone d'ombra.
const PAL_DON=makePalette([.055,.060,.072],[.72,.74,.78],[.42,.285,.205],[.035,.028,.025]);
// Forma civile: prima la maglia era un grigio/blu generico uguale per
// tutti, ora il colore della maglia riprende quello della tuta da Ranger
// (un'idea da tokusatsu vero: l'abbigliamento civile "tradisce" un po' chi
// sei), l'accento resta comunque il colore ranger per coerenza.
const PAL_ARCO_CIV=makePalette([.55,.09,.08],[.90,.72,.18],[.78,.55,.40],[.13,.08,.05]);
const PAL_MERIDIANA_CIV=makePalette([.10,.24,.55],[.85,.88,.92],[.78,.58,.46],[.08,.07,.08]);
const PAL_JUN_CIV=makePalette([.62,.52,.10],[.30,.24,.10],[.76,.54,.40],[.10,.07,.05]);
const PAL_VALE_CIV=makePalette([.62,.26,.42],[.98,.90,.94],[.84,.62,.47],[.88,.74,.28]);
const PAL_DON_CIV=makePalette([.105,.11,.13],[.60,.62,.66],[.42,.285,.205],[.035,.028,.025]);
// Meridiana e Vale sono donne: coda di cavallo per distinguerle anche di
// spalle (vedi buildBodyParts, ramo civile). Arco e Jun restano senza.
PAL_MERIDIANA.female=true; PAL_MERIDIANA_CIV.female=true;
PAL_RANGER4.female=true; PAL_VALE_CIV.female=true;

const meshCache={};
function partMeshFor(pal){
 const key=pal.suit.join(",")+"|"+pal.accent.join(",")+"|"+(pal===PAL_CIVILE?"c":"h");
 if(meshCache[key])return meshCache[key];
 const m={
  torso:boxMesh(pal.suit), under:boxMesh(pal.under||pal.suit), belt:boxMesh([.08,.09,.11]), buckle:boxMesh(pal.accent),
  chestDiamond:boxMesh([.97,.97,.98]), shoulderPad:octMesh(pal.suit),
  head:boxMesh(pal.skin), visor:boxMesh(pal.visor),
  hair:boxMesh(pal.hair||[.14,.11,.10]), eye:boxMesh([.05,.05,.06]),
  helmetShell:octMesh(pal.helmetShell,false,true), helmetDome:domeMesh(pal.helmetShell), helmetVisor:boxMesh([.025,.04,.055]), helmetCrest:boxMesh(pal.accent), jaw:boxMesh(pal.accent), helmetSide:boxMesh(pal.suit),
  horn:boxMesh(pal.accent),
  upperArm:boxMesh(pal.under||pal.suit), lowerArm:boxMesh(pal.skin), glove:boxMesh(pal.glove||[.92,.92,.94]),
  upperLeg:boxMesh(pal.under||pal.suit), lowerLeg:boxMesh(pal.boot),
  bladeCore:boxMesh([.85,.92,.98]), bladeEdge:boxMesh(pal.accent), bladeHilt:boxMesh([.15,.14,.16]),
  menaceEye:boxMesh([1.0,.10,.04]),
  backCore:boxMesh(pal.suit), backWing:boxMesh(pal.accent), backThruster:boxMesh([.10,.11,.13]), backGlow:boxMesh([.95,.55,.20]),
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
function buildBodyParts(pal,walkPhase,speedFactor,helmet,kind,attackPhase,weaponOut,attackStyle){
 kind=kind||"ranger";
 attackStyle=attackStyle||0;
 const pm=partMeshFor(pal);
 const swing=Math.sin(walkPhase)*.55*speedFactor;
 const swingOpp=Math.sin(walkPhase+Math.PI)*.55*speedFactor;
 const bob=Math.abs(Math.cos(walkPhase))*.045*speedFactor;
 const hunch=kind==="scagnozzo"?.10:0;
 const torsoW=kind==="raccoglitore"?.54:kind==="scagnozzo"?.50:.46;
 const armored=helmet&&kind==="ranger";
 const parts=[
  {mesh:armored?pm.under:pm.torso, mtx:mul(mat4.translate(0,1.05+bob-hunch*.3,0),mat4.rotX(hunch),mat4.scale(torsoW,.62,.28))},
  {mesh:pm.belt,  mtx:mul(mat4.translate(0,.76+bob,0),mat4.scale(.49,.10,.31))},
 ];
 // Collo: prima non c'era nulla tra la cima del busto e il fondo di
 // testa/elmo — un vuoto sottile ma visibile, soprattutto da dietro (la
 // "nuca" sembrava non esistere). Un pezzo stretto colma lo spazio: colore
 // della tuta per chi e' vestito/armato, pelle per la forma civile.
 parts.push({mesh:armored||kind==="scagnozzo"||kind==="raccoglitore"?pm.under:pm.head,
  mtx:mul(mat4.translate(0,1.375+bob-hunch*.3,0),mat4.rotX(hunch),mat4.scale(.145,.11,.145))});
 if(armored){
  // v31: tuta vera, non armatura tattica sopra una sottotuta — un grande
  // diamante bianco sul petto (un box ruotato 45°, come nella tuta di
  // riferimento) invece di uno scudo colorato, niente spallacci separati.
  // Il colore del personaggio resta nel resto della tuta, il bianco e' solo
  // il disegno sopra, uguale per tutti come nel riferimento.
  parts.push({mesh:pm.chestDiamond,mtx:mul(mat4.translate(0,1.12+bob,.148),mat4.rotZ(Math.PI/4),mat4.scale(.225,.225,.05))});
  parts.push({mesh:pm.buckle,mtx:mul(mat4.translate(0,.77+bob,.17),mat4.scale(.12,.085,.035))});
  // v36: schiena CHIUSA e leggibile per tutti i Ranger. Prima il busto
  // era quasi tutto sottotuta scura sul retro e, visto da dietro, sembrava
  // una sagoma aperta/monca. Un pannello sottilissimo del colore della tuta
  // completa visivamente la schiena senza trasformarla in corazza robotica.
  parts.push({mesh:pm.torso,mtx:mul(mat4.translate(0,1.12+bob,-.154),mat4.scale(.38,.46,.035))});
  parts.push({mesh:pm.chestDiamond,mtx:mul(mat4.translate(-.11,1.20+bob,-.178),mat4.rotZ(Math.PI/4),mat4.scale(.115,.115,.025))});
  parts.push({mesh:pm.chestDiamond,mtx:mul(mat4.translate(.11,1.20+bob,-.178),mat4.rotZ(Math.PI/4),mat4.scale(.115,.115,.025))});
  // Nessun modulo mecha sulla schiena del Ranger Zero: il suo modulo speciale
  // viene richiamato solo nella sequenza del COLOSSO ed entra nel robot.
 }
 if(kind==="raccoglitore"){
  // spallacci asimmetrici: uno più grande dell'altro, come pezzi di
  // armature diverse tenute insieme alla bell'e meglio. Il Raccoglitore
  // resta l'eccezione "armatura vera", proprio perche' e' fatta di pezzi
  // raccogliticci — il contrasto con la tuta pulita dei Ranger e' voluto.
  parts.push({mesh:pm.shoulderPad, mtx:mul(mat4.translate(.40,1.42+bob,0),mat4.scale(.22,.16,.24))});
  parts.push({mesh:pm.shoulderPad, mtx:mul(mat4.translate(-.38,1.38+bob,0),mat4.scale(.15,.11,.17))});
 }
 if(helmet&&kind==="ranger"){
  // Calotta arrotondata vera (ottagono + cupola), non piu' un cubo con
  // sopra una cresta — legge subito da casco da motociclista/tokusatsu.
  parts.push({mesh:pm.helmetShell, mtx:mul(mat4.translate(0,1.565+bob,0),mat4.scale(.315,.30,.315))});
  parts.push({mesh:pm.helmetDome, mtx:mul(mat4.translate(0,1.565+bob,0),mat4.scale(.315,.29,.315))});
  // Occlusore pieno dentro il casco: la visiera si vedeva anche da dietro
  // (bug reale, confermato in foto) — invece di rincorrere la causa esatta
  // nel motore di render, un blocco opaco riempie l'interno del casco cosi'
  // non si puo' vedere attraverso da nessun angolo, qualunque fosse la causa.
  parts.push({mesh:pm.helmetShell, mtx:mul(mat4.translate(0,1.565+bob,0),mat4.scale(.26,.24,.26))});
  // v31: via mandibola e pezzi laterali — casco liscio come nel riferimento,
  // solo calotta + visiera, niente dettagli meccanici extra. Via anche la
  // cresta (richiesta) — profilo ancora piu' pulito.
  parts.push({mesh:pm.helmetVisor, mtx:mul(mat4.translate(0,1.60+bob,.160),mat4.scale(.278,.128,.042))});
 }else if(kind==="scagnozzo"){
  // niente cresta, visiera a fessura sottile, testa leggermente incassata:
  // deliberatamente meno "eroico", piu' anonimo/usa e getta.
  parts.push({mesh:pm.helmetShell, mtx:mul(mat4.translate(0,1.52+bob-hunch*.4,0),mat4.rotX(hunch*.6),mat4.scale(.30,.28,.30))});
  parts.push({mesh:pm.helmetVisor, mtx:mul(mat4.translate(0,1.51+bob-hunch*.4,.145),mat4.rotX(hunch*.6),mat4.scale(.22,.05,.05))});
 }else if(kind==="raccoglitore"){
  // corna al posto della cresta, elmo piu' squadrato/pesante, e due occhi
  // rossi che si vedono attraverso la visiera invece di una fessura piatta
  // e basta — gli dà un volto minaccioso vero senza dover ridisegnare tutto.
  parts.push({mesh:pm.helmetShell, mtx:mul(mat4.translate(0,1.60+bob,0),mat4.scale(.36,.35,.35))});
  parts.push({mesh:pm.helmetVisor, mtx:mul(mat4.translate(0,1.58+bob,.165),mat4.scale(.27,.13,.05))});
  // volto leggibile anche in scala gigante: occhi separati, maschera
  // centrale e bocca/griglia. Prima da lontano restava una massa senza volto.
  parts.push({mesh:RACC_SCRAP.face, mtx:mul(mat4.translate(0,1.55+bob,.188),mat4.scale(.22,.18,.035))});
  parts.push({mesh:pm.menaceEye, mtx:mul(mat4.translate(-.105,1.615+bob,.214),mat4.rotZ(-.12),mat4.scale(.070,.045,.022))});
  parts.push({mesh:pm.menaceEye, mtx:mul(mat4.translate(.105,1.615+bob,.214),mat4.rotZ(.12),mat4.scale(.070,.045,.022))});
  parts.push({mesh:RACC_SCRAP.mouth, mtx:mul(mat4.translate(0,1.505+bob,.216),mat4.scale(.19,.055,.022))});
  parts.push({mesh:RACC_SCRAP.tooth, mtx:mul(mat4.translate(-.06,1.505+bob,.228),mat4.rotZ(.18),mat4.scale(.025,.045,.012))});
  parts.push({mesh:RACC_SCRAP.tooth, mtx:mul(mat4.translate(.06,1.505+bob,.228),mat4.rotZ(-.18),mat4.scale(.025,.045,.012))});
  parts.push({mesh:pm.horn, mtx:mul(mat4.translate(-.18,1.88+bob,0),mat4.rotZ(.40),mat4.scale(.07,.24,.07))});
  parts.push({mesh:pm.horn, mtx:mul(mat4.translate(.18,1.88+bob,0),mat4.rotZ(-.40),mat4.scale(.07,.24,.07))});
  // v24: il Raccoglitore conserva volto, corna e armatura asimmetrica, ma
  // NON porta piu' placche colorate dei Ranger. Quei colori appartengono
  // chiaramente al Colosso combinato; l'Archivio spiega il riciclo del ciclo.
 }else{
  parts.push({mesh:pm.head,  mtx:mul(mat4.translate(0,1.55+bob,0),mat4.scale(.30,.30,.30))});
  parts.push({mesh:pm.hair,  mtx:mul(mat4.translate(0,1.665+bob,-.01),mat4.scale(.305,.14,.30))});
  if(pal.female){
   // Coda di cavallo: un NPC donna deve leggersi diverso dagli altri anche
   // solo di spalle, non solo per il colore della tuta — una forma in piu'
   // sulla nuca basta a distinguerla nella sagoma.
   parts.push({mesh:pm.hair, mtx:mul(mat4.translate(0,1.50+bob,-.175),mat4.rotX(.55),mat4.scale(.11,.30,.11))});
  }
  parts.push({mesh:pm.eye,   mtx:mul(mat4.translate(-.08,1.565+bob,.148),mat4.scale(.045,.045,.03))});
  parts.push({mesh:pm.eye,   mtx:mul(mat4.translate(.08,1.565+bob,.148),mat4.scale(.045,.045,.03))});
 }
 // v51: lo stesso tasto F alterna pugno destro, pugno sinistro e calcio.
 // Il danno resta semplice, ma visivamente Zero e gli NPC non ripetono piu'
 // lo stesso identico pugno per tutta la battaglia.
 const punch=attackPhase?Math.sin(Math.min(1,attackPhase)*Math.PI):0;
 const isLeftPunch=attackStyle===1, isKick=attackStyle===2;
 const rArmRot=attackPhase&&!isLeftPunch&&!isKick? -1.9*punch : swing*.8;
 const lArmRot=attackPhase&&isLeftPunch? -1.9*punch : swingOpp*.8;
 const rArmFwd=attackPhase&&!isLeftPunch&&!isKick? .30*punch : 0;
 const lArmFwd=attackPhase&&isLeftPunch? .30*punch : 0;
 const kickRot=attackPhase&&isKick? -1.35*punch : swingOpp;
 const kickFwd=attackPhase&&isKick? .42*punch : 0;
 const lowerArmMesh=armored?pm.upperArm:pm.lowerArm;
 parts.push(
  {mesh:pm.upperArm, mtx:mul(mat4.translate(.34,1.30+bob,0),mat4.rotX(rArmRot),mat4.translate(0,-.20,rArmFwd),mat4.scale(.16,.40,.16))},
  {mesh:lowerArmMesh, mtx:mul(mat4.translate(.34,1.30+bob,0),mat4.rotX(rArmRot),mat4.translate(0,-.46,rArmFwd*1.6),mat4.scale(.15,.31,.15))},
  {mesh:pm.upperArm, mtx:mul(mat4.translate(-.34,1.30+bob,0),mat4.rotX(lArmRot),mat4.translate(0,-.20,lArmFwd),mat4.scale(.16,.40,.16))},
  {mesh:lowerArmMesh, mtx:mul(mat4.translate(-.34,1.30+bob,0),mat4.rotX(lArmRot),mat4.translate(0,-.46,lArmFwd*1.6),mat4.scale(.15,.31,.15))},
  {mesh:pm.upperLeg, mtx:mul(mat4.translate(.16,.74+bob,0),mat4.rotX(kickRot),mat4.translate(0,-.24,kickFwd),mat4.scale(.19,.48,.19))},
  {mesh:pm.lowerLeg, mtx:mul(mat4.translate(.16,.74+bob,0),mat4.rotX(kickRot),mat4.translate(0,-.56,kickFwd*1.45),mat4.scale(.17,.34,.19))},
  {mesh:pm.upperLeg, mtx:mul(mat4.translate(-.16,.74+bob,0),mat4.rotX(swing),mat4.translate(0,-.24,0),mat4.scale(.19,.48,.19))},
  {mesh:pm.lowerLeg, mtx:mul(mat4.translate(-.16,.74+bob,0),mat4.rotX(swing),mat4.translate(0,-.56,0),mat4.scale(.17,.34,.19))},
 );
 if(armored){
  // v31: niente piu' polsini/ginocchiere/piastre agli stivali separate —
  // solo un piccolo guanto bianco alla fine dell'avambraccio, e gli
  // stivali sono gia' bianchi di suolo (pm.lowerLeg usa pal.boot).
  parts.push({mesh:pm.glove,mtx:mul(mat4.translate(.34,1.30+bob,0),mat4.rotX(rArmRot),mat4.translate(0,-.66,rArmFwd*1.8),mat4.scale(.155,.14,.155))});
  parts.push({mesh:pm.glove,mtx:mul(mat4.translate(-.34,1.30+bob,0),mat4.rotX(lArmRot),mat4.translate(0,-.66,lArmFwd*1.8),mat4.scale(.155,.14,.155))});
 }
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
function buildCharacterBuffers(pal,walkPhase,speedFactor,helmet,kind,attackPhase,weaponOut,attackStyle){
 return bakeParts(buildBodyParts(pal,walkPhase,speedFactor,helmet,kind,attackPhase,weaponOut,attackStyle));
}

// Squadra base da CINQUE Ranger. Zero e' il sesto membro speciale.
const teamMembers=[
 {name:"ARCO",pal:PAL_ARCO,civPal:PAL_ARCO_CIV,x:-3.9,z:-4.2,yaw:.25,targetX:-3.9,targetZ:-4.2,walk:0,routeIndex:0,waitT:0},
 {name:"MERIDIANA",pal:PAL_MERIDIANA,civPal:PAL_MERIDIANA_CIV,x:-4.6,z:-1.5,yaw:.65,targetX:-4.6,targetZ:-1.5,walk:1,routeIndex:0,waitT:0},
 {name:"JUN",pal:PAL_RANGER3,civPal:PAL_JUN_CIV,x:3.7,z:-1.4,yaw:-.55,targetX:3.7,targetZ:-1.4,walk:2,routeIndex:0,waitT:0},
 {name:"VALE",pal:PAL_RANGER4,civPal:PAL_VALE_CIV,x:3.8,z:-4.7,yaw:-.25,targetX:3.8,targetZ:-4.7,walk:3,routeIndex:0,waitT:0},
 {name:"DON",pal:PAL_DON,civPal:PAL_DON_CIV,x:.15,z:-5.45,yaw:Math.PI,targetX:.15,targetZ:-5.45,walk:4,routeIndex:0,waitT:0},
];
// Prologo: cinque Ranger ancora in civile sono clienti abituali del bar/palestra.
// Non sono interattivi come "Ranger" qui: il giocatore deve solo percepire che
// si conoscono e che, durante l'incidente, reagiscono in modo stranamente coordinato.
const PAL_AMICA=makePalette([.58,.30,.48],[.92,.64,.74],[.84,.64,.50],[.16,.09,.07]); PAL_AMICA.female=true;
const PAL_BARISTA=makePalette([.20,.42,.36],[.78,.58,.28],[.66,.46,.34],[.08,.06,.05]);
const PAL_BAR_NPC=makePalette([.30,.38,.48],[.70,.40,.58],[.74,.54,.42],[.12,.08,.06]);
const PAL_BAR_MONSTER=makePalette([.18,.055,.08],[.82,.12,.09],[.40,.22,.18],[.03,.02,.02]);
const BAR_FRIEND_POS={x:BAR_CX-6.4,z:BAR_CZ+3.9};
const BAR_BARTENDER_POS={x:BAR_CX+2.6,z:BAR_CZ-7.72};
const BAR_BARTENDER_SCALE=1.12;
const BAR_CUSTOMER_START={x:BAR_CX+2.6,z:BAR_CZ-5.95};
const BAR_CUSTOMER_EXIT={x:BAR_CX+6.25,z:BAR_CZ-3.25};
const BAR_CORE_POS={x:BAR_CX+1.0,z:BAR_CZ-5.85};
const barCustomer={x:BAR_CUSTOMER_START.x,z:BAR_CUSTOMER_START.z,yaw:Math.PI,walk:0};
const BAR_RANGER_NAMES=["ARCO","MERIDIANA","JUN","VALE","DON"];
const BAR_TEAM_START={
 ARCO:[BAR_CX-1.55,BAR_CZ+1.10,Math.PI/2],
 MERIDIANA:[BAR_CX+.35,BAR_CZ+1.10,-Math.PI/2],
 JUN:[BAR_CX+3.0,BAR_CZ-4.5,.2],
 VALE:[BAR_CX+5.0,BAR_CZ+3.7,-.4],
 DON:[BAR_CX-5.2,BAR_CZ-4.15,Math.PI],
};
const barTeam=[
 {name:"ARCO",pal:PAL_ARCO_CIV,x:BAR_TEAM_START.ARCO[0],z:BAR_TEAM_START.ARCO[1],yaw:BAR_TEAM_START.ARCO[2],activity:"karateTeacher"},
 {name:"MERIDIANA",pal:PAL_MERIDIANA_CIV,x:BAR_TEAM_START.MERIDIANA[0],z:BAR_TEAM_START.MERIDIANA[1],yaw:BAR_TEAM_START.MERIDIANA[2],activity:"karateStudent"},
 {name:"JUN",pal:PAL_JUN_CIV,x:BAR_TEAM_START.JUN[0],z:BAR_TEAM_START.JUN[1],yaw:BAR_TEAM_START.JUN[2]},
 {name:"VALE",pal:PAL_VALE_CIV,x:BAR_TEAM_START.VALE[0],z:BAR_TEAM_START.VALE[1],yaw:BAR_TEAM_START.VALE[2]},
 {name:"DON",pal:PAL_DON_CIV,x:BAR_TEAM_START.DON[0],z:BAR_TEAM_START.DON[1],yaw:BAR_TEAM_START.DON[2]},
];
const barExtras=[
 {label:"CLIENTE PALESTRA",line:"Arco gli sta facendo rifare quella guardia da dieci minuti. Meridiana continua a correggerlo sui dettagli.",pal:PAL_BAR_NPC,x:BAR_CX-7.0,z:BAR_CZ-.5,yaw:1.1,routeIndex:0,targetX:BAR_CX-7.0,targetZ:BAR_CZ-.5,waitT:.2,walk:0},
 {label:"ATLETA",line:"Ultima serie. Poi giuro che mi fermo. Forse.",pal:PAL_BAR_NPC,x:BAR_CX+6.7,z:BAR_CZ+.4,yaw:-1.0,routeIndex:0,targetX:BAR_CX+6.7,targetZ:BAR_CZ+.4,waitT:.2,walk:0,workout:true},
 {label:"CLIENTE",line:"Al Pulse si sta bene. Finche' Jun non decide cosa mettere al jukebox.",pal:PAL_BAR_NPC,x:BAR_CX+2.0,z:BAR_CZ+4.8,yaw:2.6,routeIndex:0,targetX:BAR_CX+2.0,targetZ:BAR_CZ+4.8,waitT:.2,walk:0},
];
for(const b of barTeam){b.routeIndex=0;b.targetX=b.x;b.targetZ=b.z;b.waitT=.25;b.walk=0;}
const BAR_AMBIENT_ROUTES={
 // Arco e Meridiana restano nella zona palestra: lui insegna una tecnica
 // di karate, lei la ripete/corregge. E' una piccola scena NPC continua.
 ARCO:[[BAR_TEAM_START.ARCO[0],BAR_TEAM_START.ARCO[1]]],
 MERIDIANA:[[BAR_TEAM_START.MERIDIANA[0],BAR_TEAM_START.MERIDIANA[1]]],
 JUN:[[BAR_CX+3.0,BAR_CZ-4.5],[BAR_CX+3.8,BAR_CZ-1.5],[BAR_CX+2.6,BAR_CZ+1.1]],
 VALE:[[BAR_CX+5.0,BAR_CZ-3.7],[BAR_CX+6.0,BAR_CZ-2.1],[BAR_CX+5.1,BAR_CZ+.7]],
 DON:[[BAR_CX+.1,BAR_CZ-3.7],[BAR_CX-.8,BAR_CZ-4.7],[BAR_CX+.8,BAR_CZ-5.0]],
};
const BAR_EXTRA_ROUTES=[
 [[BAR_CX-7.0,BAR_CZ-.5],[BAR_CX-7.2,BAR_CZ+2.0],[BAR_CX-6.2,BAR_CZ+3.4]],
 [[BAR_CX+6.7,BAR_CZ+.4],[BAR_CX+6.7,BAR_CZ+.4]],
 [[BAR_CX+2.0,BAR_CZ+4.8],[BAR_CX-.5,BAR_CZ+5.2],[BAR_CX-2.8,BAR_CZ+4.5]],
];
const BAR_BAG_POS={x:BAR_CX+8.2,z:BAR_CZ+1.0};
const BAR_COLLIDERS=[
 // bordo frontale della pedana: due muri bassi invisibili lasciano libero
 // soltanto il varco centrale delle scale.
 {x:BAR_CX-5.35,z:BAR_CZ-3.12,hx:3.80,hz:.24},
 {x:BAR_CX+5.35,z:BAR_CZ-3.12,hx:3.80,hz:.24},
 {x:BAR_CX,z:BAR_CZ-7.15,hx:4.05,hz:.58},
 {x:BAR_CX-6.8,z:BAR_CZ-7.65,hx:.70,hz:.50},
 {x:BAR_CX+6.8,z:BAR_CZ-7.65,hx:.70,hz:.50},
 ...[-5.0,-2.4,2.4,5.0].map(x=>({x:BAR_CX+x,z:BAR_CZ-4.4,hx:.70,hz:.70})),
 {x:BAR_BAG_POS.x,z:BAR_BAG_POS.z,hx:.48,hz:.48},
];
function pushPlayerFromCircle(cx,cz,r){const dx=player.x-cx,dz=player.z-cz,d=Math.hypot(dx,dz)||.001,min=.34+r;if(d<min){const q=min-d;player.x+=dx/d*q;player.z+=dz/d*q;}}
function pushPlayerFromAABB(o){const r=.34,minX=o.x-o.hx,maxX=o.x+o.hx,minZ=o.z-o.hz,maxZ=o.z+o.hz;const qx=Math.max(minX,Math.min(maxX,player.x)),qz=Math.max(minZ,Math.min(maxZ,player.z));let dx=player.x-qx,dz=player.z-qz,d=Math.hypot(dx,dz);if(d>0&&d<r){const q=r-d;player.x+=dx/d*q;player.z+=dz/d*q;return;}if(d===0&&player.x>minX&&player.x<maxX&&player.z>minZ&&player.z<maxZ){const l=player.x-minX,rr=maxX-player.x,t=player.z-minZ,b=maxZ-player.z,m=Math.min(l,rr,t,b);if(m===l)player.x=minX-r;else if(m===rr)player.x=maxX+r;else if(m===t)player.z=minZ-r;else player.z=maxZ+r;}}
function resolveBarCollisions(){if(zone!=="bar")return;for(const o of BAR_COLLIDERS)pushPlayerFromAABB(o);for(const b of barTeam)pushPlayerFromCircle(b.x,b.z,.35);for(const e of barExtras)pushPlayerFromCircle(e.x,e.z,.34);if(!barState.customerGone&&(barState.phase==="intro"||barState.phase==="free"))pushPlayerFromCircle(barCustomer.x,barCustomer.z,.33);if(barState.phase!=="after"){if(!barState.friendSaved)pushPlayerFromCircle(BAR_FRIEND_POS.x,BAR_FRIEND_POS.z,.34);if(!barState.bartenderSaved)pushPlayerFromCircle(BAR_BARTENDER_POS.x,BAR_BARTENDER_POS.z,.32);}}
function updateBarAmbientActors(dt){if(zone!=="bar"||!(barState.phase==="intro"||barState.phase==="free"))return;for(const b of barTeam){
 if(b.activity==="karateTeacher"||b.activity==="karateStudent"){
  // restano faccia a faccia e animano la lezione invece di vagare.
  const other=barTeam.find(q=>q.name===(b.name==="ARCO"?"MERIDIANA":"ARCO"));
  if(other)b.yaw=Math.atan2(other.x-b.x,other.z-b.z);
  b.walk+=dt*(b.activity==="karateTeacher"?2.5:2.0);b.targetX=b.x;b.targetZ=b.z;continue;
 }
 const route=BAR_AMBIENT_ROUTES[b.name]||[[b.x,b.z]],t=route[b.routeIndex%route.length];b.targetX=t[0];b.targetZ=t[1];const dx=b.targetX-b.x,dz=b.targetZ-b.z,d=Math.hypot(dx,dz)||.001;if(d>.12){b.x+=dx/d*Math.min(d,dt*.52);b.z+=dz/d*Math.min(d,dt*.52);b.yaw=Math.atan2(dx,dz);b.walk+=dt*5.2;}else{b.waitT-=dt;if(b.waitT<=0){b.routeIndex=(b.routeIndex+1)%route.length;b.waitT=1.1+((b.routeIndex+b.name.length)%3)*.55;}}}for(let i=0;i<barExtras.length;i++){const e=barExtras[i],route=BAR_EXTRA_ROUTES[i];if(e.workout){e.walk+=dt*2;continue;}const t=route[e.routeIndex%route.length],dx=t[0]-e.x,dz=t[1]-e.z,d=Math.hypot(dx,dz)||.001;if(d>.12){e.x+=dx/d*Math.min(d,dt*.42);e.z+=dz/d*Math.min(d,dt*.42);e.yaw=Math.atan2(dx,dz);e.walk+=dt*4.5;}else{e.waitT-=dt;if(e.waitT<=0){e.routeIndex=(e.routeIndex+1)%route.length;e.waitT=1.3;}}}
 // Tommy resta occupato finche' Zero non ha davvero parlato con almeno tre persone.
 // Solo allora il cliente prende la bevanda e si allontana fisicamente dal bancone.
 if(barState.customerLeaving&&!barState.customerGone){const dx=BAR_CUSTOMER_EXIT.x-barCustomer.x,dz=BAR_CUSTOMER_EXIT.z-barCustomer.z,d=Math.hypot(dx,dz)||.001;if(d>.14){barCustomer.x+=dx/d*Math.min(d,dt*.86);barCustomer.z+=dz/d*Math.min(d,dt*.86);barCustomer.yaw=Math.atan2(dx,dz);barCustomer.walk+=dt*6;}else{barState.customerGone=true;barState.bartenderReady=true;missionHintEl.textContent="PULSE // PRENDI DA BERE DA TOMMY";missionHintEl.classList.add("show");}}
}
// Waypoint manuali e sicuri: nessuno attraversa monitor, Oculo o il pannello
// anomalo. L'illusione e' quella di una sala viva, non di NPC che vagano.
const TEAM_ROUTES={
 intro:{
  ARCO:[[-3.9,-4.8],[-2.6,-5.7],[-3.2,-3.6]],
  MERIDIANA:[[-4.5,.7],[-4.2,3.5],[-3.4,2.1]],
  JUN:[[3.9,-1.0],[4.7,1.6],[3.4,3.0]],
  VALE:[[3.8,-5.1],[2.5,-5.8],[4.5,-3.5]],
  DON:[[.15,-5.35],[1.35,-5.85],[-1.05,-5.70]],
 },
 post:{
  ARCO:[[-3.8,-5.5],[-2.6,-4.8],[-3.3,-5.9]],
  MERIDIANA:[[-4.1,.8],[-3.1,-.1],[-4.4,2.4]],
  JUN:[[3.9,-.7],[4.7,2.1],[3.2,3.1]],
  VALE:[[3.9,-5.2],[2.7,-5.8],[4.5,-3.7]],
  DON:[[.15,-5.55],[-1.3,-5.8],[1.25,-5.75]],
 }
};
let teamMode="civil"; // civil | ranger
let introFreeRoam=false,introAlertStarted=false,morphUnlocked=false;
let introTalked=new Set(),postBossTalked=new Set();
let postBossElapsed=0,teamRouteMode=null;
function setTeamTarget(name,x,z){const m=teamMembers.find(t=>t.name===name);if(m){m.targetX=x;m.targetZ=z;}}
function activateTeamRoutes(mode){
 teamRouteMode=mode;
 const routes=TEAM_ROUTES[mode]||{};
 teamMembers.forEach((m,i)=>{m.routeIndex=0;m.waitT=.35+i*.22;const r=routes[m.name];if(r&&r.length){m.targetX=r[0][0];m.targetZ=r[0][1];}});
}
function resetTeamIntro(){
 teamMode="civil";teamRouteMode=null;introFreeRoam=false;introAlertStarted=false;introTalked=new Set();postBossTalked=new Set();postBossElapsed=0;
 const p=[[-3.9,-4.2],[-4.6,-1.5],[3.7,-1.4],[3.8,-4.7],[.15,-5.45]];
 teamMembers.forEach((m,i)=>{m.x=p[i][0];m.z=p[i][1];m.targetX=m.x;m.targetZ=m.z;m.routeIndex=0;m.waitT=0;m.walk=i;m.yaw=i<2?.3:-.3;});
}
function setupPostBossTeam(){
 teamMode="civil";postBossElapsed=0;postBossTalked=new Set();
 const starts=[[-2.6,-5.1],[-1.2,-4.8],[1.2,-4.7],[2.7,-5.0],[.10,-5.55]];
 teamMembers.forEach((m,i)=>{m.x=starts[i][0];m.z=starts[i][1];m.walk=i;m.routeIndex=0;m.waitT=.2+i*.16;});
 activateTeamRoutes("post");
}
function updateTowerTeam(dt){
 if(zone!=="torre")return;
 if(postBossState)postBossElapsed+=dt;
 const routes=(teamRouteMode&&TEAM_ROUTES[teamRouteMode])||null;
 const currentSpeaker=dialogueActive&&dialogueQueue[dialogueIndex]?dialogueQueue[dialogueIndex].speaker:null;
 for(const m of teamMembers){
  if(currentSpeaker===m.name){m.waitT=Math.max(m.waitT,.25);continue;}
  const dx=m.targetX-m.x,dz=m.targetZ-m.z,dist=Math.hypot(dx,dz)||.001;
  if(dist>.08){const sp=(postBossState?1.05:.72)*dt;m.x+=dx/dist*Math.min(dist,sp);m.z+=dz/dist*Math.min(dist,sp);m.yaw=Math.atan2(dx,dz);m.walk+=dt*7;}
  else if(routes&&routes[m.name]&&(introFreeRoam||postBossState)){
   m.waitT-=dt;
   if(m.waitT<=0){const r=routes[m.name];m.routeIndex=(m.routeIndex+1)%r.length;m.targetX=r[m.routeIndex][0];m.targetZ=r[m.routeIndex][1];m.waitT=1.5+((m.routeIndex+m.name.length)%3)*.45;}
   else{
    // In sosta guardano una console o il centro della sala, non il player.
    if(m.name==="MERIDIANA")m.yaw=-Math.PI/2; else if(m.name==="JUN")m.yaw=Math.PI/2; else m.yaw=Math.PI;
   }
  }
 }
}
function teamMemberByName(name){return teamMembers.find(m=>m.name===name)||null;}
// Posizioni usate per far girare la telecamera verso chi sta parlando
// durante i dialoghi, cosi' si capisce subito chi e' senza dover indovinare
// dal solo nome scritto nel balloon.
const DIALOGUE_FOCUS_POS={
 OCULO:{x:0,y:2.35,z:-ROOM_D/2+.30},
 ARCO:{x:teamMembers[0].x,y:1.5,z:teamMembers[0].z},
 MERIDIANA:{x:teamMembers[1].x,y:1.5,z:teamMembers[1].z},
 JUN:{x:teamMembers[2].x,y:1.5,z:teamMembers[2].z},
 VALE:{x:teamMembers[3].x,y:1.5,z:teamMembers[3].z},
 DON:{x:teamMembers[4].x,y:1.5,z:teamMembers[4].z},
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
// v26.1: posizione di TIC nella Torre calcolata una sola volta e riusata
// sia dal loop di render sia dal fuoco della telecamera nei dialoghi —
// prima i dialoghi puntavano a un punto fisso vecchio invece della
// posizione vera di TIC dopo il boss (verso il pannello anomalo).
function getTowerTicPosition(nowMs){
 const patrolT=(nowMs/1000)%(TIC_PATROL.length*2.4);
 const seg=Math.floor(patrolT/2.4), segT=Math.min(1,(patrolT%2.4)/1.6);
 const pA=TIC_PATROL[seg], pB=TIC_PATROL[(seg+1)%TIC_PATROL.length];
 const easeT=segT<1?(1-Math.cos(segT*Math.PI))/2:1;
 let x=pA.x+(pB.x-pA.x)*easeT, z=pA.z+(pB.z-pA.z)*easeT;
 if(postBossState){const p=Math.min(1,postBossElapsed/4.0),e=1-Math.pow(1-p,3);x=4.8+(ANOMALO_POS.x+.75-4.8)*e;z=1.4+(ANOMALO_POS.z-1.4)*e;}
 return {x,z,y:2.1,pA,pB};
}

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
// Rimossa la roccia a (ARENA_CX+9, ARENA_CZ+3): troppo vicina al confine
// dell'arena, leggeva come un "box di fine mappa" fuori posto invece che
// da copertura vera nel combattimento.
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
// Fondale vero (opzionale): se "arena_sky.png" e' presente nella cartella,
// un grande pannello con l'immagine sostituisce/copre le bande di colore
// procedurali sull'orizzonte nord (la direzione verso cui si guarda per la
// maggior parte del combattimento, ed e' dove emerge Il Raccoglitore).
// Se il file non c'e', drawTexturedQuad non disegna nulla — restano solo
// le bande procedurali, nessun errore, nessun buco visivo.
const arenaSkyTex=loadTexture("arena_sky.png");
// Panorama equirettangolare 2:1 avvolto a 360 gradi. La cucitura U=0/1
// viene posizionata dietro il punto di ingresso (+Z); il centro dell'immagine
// (U=.5, mare/tramonto) guarda verso -Z, cioe' la direzione del Raccoglitore.
function buildArenaPanorama(segments=32,radius=52,bottom=-5,top=30){
 const pos=[],uv=[];
 for(let i=0;i<segments;i++){
  const u0=i/segments,u1=(i+1)/segments;
  const a0=u0*Math.PI*2,a1=u1*Math.PI*2;
  const x0=ARENA_CX+Math.sin(a0)*radius,z0=ARENA_CZ+Math.cos(a0)*radius;
  const x1=ARENA_CX+Math.sin(a1)*radius,z1=ARENA_CZ+Math.cos(a1)*radius;
  pos.push(x0,bottom,z0, x1,bottom,z1, x1,top,z1, x0,bottom,z0, x1,top,z1, x0,top,z0);
  uv.push(u0,1, u1,1, u1,0, u0,1, u1,0, u0,0);
 }
 return makeTexMesh(pos,uv);
}
const arenaPanoramaMesh=buildArenaPanorama();

// Mini-citta' scenografica per lo scontro gigante. In v26 lo scontro
// avviene su un vero quartiere costiero: terreno urbano sotto entrambi i
// giganti, mare solo oltre la linea del porto. Niente piu' effetto "isola".
const giantStageBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.16,.17,.18]),mtx:mul(mat4.translate(0,-.08,-59),mat4.scale(90,.16,80))}, // terreno urbano, molto piu' esteso di prima
 {mesh:boxMesh([.32,.30,.27]),mtx:mul(mat4.translate(0,.01,-72.0),mat4.scale(38,.04,3.0))}, // banchina
 {mesh:boxMesh([.13,.27,.34]),mtx:mul(mat4.translate(0,-.04,-79.0),mat4.scale(110,.04,40.0))}, // mare oltre il porto, esteso
 {mesh:boxMesh([.38,.39,.40]),mtx:mul(mat4.translate(0,.06,-70.6),mat4.scale(36,.12,.35))}, // muraglione costiero
]));
const cityParts=[];
const cityCols=[[.24,.27,.31],[.30,.30,.29],[.20,.25,.29],[.34,.28,.24],[.26,.22,.20]];
// Edifici soprattutto ai lati: il centro resta un viale di battaglia, cosi'
// Colosso e Raccoglitore non sembrano compenetrati nei palazzi.
const cityLayout=[
 [-14,-69,2.0,2.2,1.6],[-10.5,-68,1.6,3.0,1.4],[10.5,-69,1.7,2.4,1.5],[14,-67,2.2,3.2,1.7],
 [-14,-63,2.4,3.5,1.8],[-10.5,-62,1.7,1.8,1.5],[10.5,-63,2.0,2.8,1.7],[14,-61,1.6,1.7,1.4],
 [-14,-56,1.8,2.5,1.6],[-10.5,-55,2.2,3.1,1.8],[10.5,-56,1.7,2.0,1.5],[14,-54,2.4,2.7,1.8],
 [-14,-49,2.1,1.8,1.7],[-10,-48,1.5,2.6,1.3],[10,-49,1.9,2.2,1.5],[14,-47,2.2,3.0,1.8],
 [-8,-72,1.5,1.4,1.3],[8,-72,1.5,1.6,1.3],[-8,-45,1.8,1.5,1.4],[8,-45,1.8,1.9,1.4]
];
for(let i=0;i<cityLayout.length;i++){
 const [x,z,w,h,d]=cityLayout[i], col=cityCols[i%cityCols.length];
 cityParts.push({mesh:boxMesh(col),mtx:mul(mat4.translate(x,h/2,z),mat4.scale(w,h,d))});
 if(i%3===1)cityParts.push({mesh:boxMesh([.46,.47,.49]),mtx:mul(mat4.translate(x,h+.45,z),mat4.scale(.08,.9,.08))});
}
// Viale centrale, strade trasversali, marciapiedi e zona industriale minima.
cityParts.push({mesh:boxMesh([.09,.095,.10]),mtx:mul(mat4.translate(0,.025,-59),mat4.scale(7.0,.05,26))});
for(const rz of [-68,-62,-56,-50])cityParts.push({mesh:boxMesh([.11,.115,.12]),mtx:mul(mat4.translate(0,.03,rz),mat4.scale(34,.055,.8))});
for(const sx of [-4.1,4.1])cityParts.push({mesh:boxMesh([.28,.28,.29]),mtx:mul(mat4.translate(sx,.035,-59),mat4.scale(.35,.07,25))});
// Piccolo distretto industriale vicino al porto.
for(const x of [-12,-8,8,12]){
 cityParts.push({mesh:boxMesh([.27,.25,.23]),mtx:mul(mat4.translate(x,.75,-72),mat4.scale(2.2,1.5,1.8))});
 cityParts.push({mesh:boxMesh([.45,.43,.38]),mtx:mul(mat4.translate(x+.5,1.8,-72),mat4.scale(.10,2.1,.10))});
}
// v46 — "si sta lottando su un'isola": il distretto centrale finiva di
// netto in un rettangolo stretto (28x27), col resto a vista libera fino al
// fondale — leggeva come una piattaforma isolata invece che come un vero
// complesso urbano. Aggiunto un anello di edifici lontani distribuito in
// TONDO (raggio, non griglia rettangolare) attorno al campo di battaglia:
// una citta' che continua verso l'orizzonte invece di un blocco isolato
// con lo spigolo visibile. Geometria semplice (un box per edificio) perche'
// sono solo sagome di sfondo, non serve dettaglio a quella distanza.
const farCityCols=[[.15,.17,.20],[.19,.19,.18],[.13,.16,.19],[.21,.18,.15]];
let seed=42; function rnd(){ seed=(seed*1103515245+12345)&0x7fffffff; return (seed%10000)/10000; }
for(let ring=0; ring<3; ring++){
 const R=34+ring*16, count=18+ring*8;
 for(let i=0;i<count;i++){
  const a=(i/count)*Math.PI*2+rnd()*.3;
  const x=Math.sin(a)*R*(0.85+rnd()*.3), z=-59+Math.cos(a)*R*(0.75+rnd()*.3)*.62;
  if(Math.abs(x)<16&&z>-74&&z<-44)continue; // non invadere il viale di battaglia gia' costruito
  if(z>-8)continue; // non spuntare dietro la telecamera
  const w=1.3+rnd()*1.8, h=1.2+rnd()*(3.2-ring*.6), d=1.3+rnd()*1.8;
  cityParts.push({mesh:boxMesh(farCityCols[i%farCityCols.length]),mtx:mul(mat4.translate(x,h/2,z),mat4.scale(w,h,d))});
 }
}
const giantCityBuf=makeBuffer(bakeParts(cityParts));

// ============================================================
// NEMICI — scagnozzi (deboli, in gruppo) e Il Raccoglitore (piu' forte,
// scala umana per questo primo scontro; diventera' gigante in una fase
// successiva, non ancora costruita).
// ============================================================
const PAL_SCAGNOZZO=makePalette([.22,.20,.18],[.42,.38,.30],[.55,.42,.30]);
const PAL_SCAGNOZZO_ELITE=makePalette([.095,.11,.14],[.70,.72,.76],[.50,.39,.30]);
// Il Raccoglitore: guerriero dorato, ma le placche sono volutamente
// irregolari/asimmetriche — armature di vecchi Ranger fuse insieme,
// non un'armatura di serie come quella della squadra.
const PAL_RACCOGLITORE=makePalette([.48,.36,.10],[.62,.48,.14],[.35,.28,.22]);
const PAL_RACCOGLITORE_OVERLOAD=makePalette([.50,.18,.08],[.92,.32,.08],[.30,.20,.18]);
const RACC_SCRAP={
 red:boxMesh([.68,.08,.07]), blue:boxMesh([.20,.48,.62]),
 violet:boxMesh([.38,.18,.48]), green:boxMesh([.12,.42,.26]),
 mouth:boxMesh([.08,.035,.025]), tooth:boxMesh([.78,.70,.48]), face:boxMesh([.16,.12,.08])
};

const scagnozzoBuf=makeBuffer(buildCharacterBuffers(PAL_SCAGNOZZO,0,0,true,"scagnozzo"));
const raccoglitoreBuf=makeBuffer(buildCharacterBuffers(PAL_RACCOGLITORE,0,0,true,"raccoglitore"));

// ============================================================
// FASE 2 — IL COLOSSO: payoff tokusatsu vero ma economico. I compagni
// convergono, una breve cutscene mostra i moduli che formano un robot
// low-poly completo, poi si passa allo scontro gigante in camera 3/4.
// ============================================================
let colosso=null;
const COLOSSO_EYE_Y=6.5;
const COLOSSO_CAM_Z=ARENA_CZ+11;
const COLOSSO_GIANT_Z=SEA_EDGE_Z-9;
const COLOSSO_ROBOT_Z=COLOSSO_CAM_Z+1.5;
let colossoTeamPos=null;

// Box colorati riutilizzati dalla cutscene di combinazione.
const COLOSSO_BOX={
 zero:makeBuffer(boxMesh(PAL_ZERO.suit)), zeroAccent:makeBuffer(boxMesh(PAL_ZERO.accent)),
 red:makeBuffer(boxMesh(PAL_ARCO.suit)), blue:makeBuffer(boxMesh(PAL_MERIDIANA.suit)),
 yellow:makeBuffer(boxMesh(PAL_RANGER3.suit)), pink:makeBuffer(boxMesh(PAL_RANGER4.suit)),
 black:makeBuffer(boxMesh([.07,.075,.09])), silver:makeBuffer(boxMesh([.56,.58,.62])),
 dark:makeBuffer(boxMesh([.08,.09,.12])), cyan:makeBuffer(boxMesh([.22,.92,1.0])),
 gold:makeBuffer(boxMesh([.86,.65,.18]))
};
// v43 — solo grafica: prima ogni pezzo del Colosso era un box puro, motivo
// principale per cui leggeva da "ammasso di cubi che si muove". Stessa
// tecnica gia' usata per i caschi dei Ranger (ottagono + cupola invece di
// spigoli vivi), applicata qui ai pezzi piu' grandi e piu' visibili
// (testa, petto, spalle, gambe) — non tutto, per non appesantire la
// costruzione ne' perdere la leggibilita' "a moduli" gia' funzionante.
const COLOSSO_OCT={
 zero:makeBuffer(octMesh(PAL_ZERO.suit)), red:makeBuffer(octMesh(PAL_ARCO.suit)),
 blue:makeBuffer(octMesh(PAL_MERIDIANA.suit)), yellow:makeBuffer(octMesh(PAL_RANGER3.suit)),
 pink:makeBuffer(octMesh(PAL_RANGER4.suit)), black:makeBuffer(octMesh([.07,.075,.09])),
 dark:makeBuffer(octMesh([.08,.09,.12])),
};
const COLOSSO_DOME={
 pink:makeBuffer(domeMesh(PAL_RANGER4.suit)), red:makeBuffer(domeMesh(PAL_ARCO.suit)),
 black:makeBuffer(domeMesh([.07,.075,.09])),
};
function partProgress(p,a,b){return Math.max(0,Math.min(1,(p-a)/(b-a)));}
function easeOut3(t){return 1-Math.pow(1-t,3);}
function drawColossoRobot(vp,p,now,opts){
 opts=opts||{};
 // v37 — lettura "combinato" definitiva: PETTO ROSSO, GAMBA GIALLA + BLU,
 // BRACCIA NERE, TESTA ROSA, ALI VERDI del sesto Ranger. Nessuna cresta.
 const COLOSSO_SCALE=1.62;
 const wx=opts.x===undefined?-5.2:opts.x, wz=opts.z===undefined?ARENA_CZ+1.0:opts.z;
 const yaw=opts.yaw===undefined?Math.PI:opts.yaw;
 const attack=Math.max(0,Math.min(1,opts.attack||0));
 const guard=Math.max(0,Math.min(1,opts.guard||0));
 const victory=Math.max(0,Math.min(1,opts.victory||0));
 const swordDrop=Math.max(0,Math.min(1,opts.swordDrop||0));
 const slash=Math.max(0,Math.min(1,opts.slash||0));
 const lunge=Math.sin(attack*Math.PI)*1.25;
 const gx=opts.targetX===undefined?5.0:opts.targetX, gz=opts.targetZ===undefined?ARENA_CZ-5.0:opts.targetZ;
 const dirX=gx-wx,dirZ=gz-wz,dl=Math.hypot(dirX,dirZ)||1;
 const base=mul(mat4.translate(wx+dirX/dl*lunge,0,wz+dirZ/dl*lunge),mat4.rotY(yaw),mat4.rotZ(guard*.035*Math.sin(now/90)),mat4.scale(COLOSSO_SCALE,COLOSSO_SCALE,COLOSSO_SCALE));
 const drawPart=(buf,fx,fy,fz,sx,sy,sz,stage,fromX,fromY,fromZ,rz=0)=>{
  const q=easeOut3(partProgress(p,stage,Math.min(1,stage+.24)));
  if(q<=0)return;
  const x=fromX+(fx-fromX)*q, y=fromY+(fy-fromY)*q, z=fromZ+(fz-fromZ)*q;
  drawBuffer(buf,mul(base,mat4.translate(x,y,z),mat4.rotZ(rz*(1-q)),mat4.scale(sx,sy,sz)),vp);
 };
 // GAMBE — Gatto Giallo / Cane Blu.
 drawPart(COLOSSO_OCT.yellow,-.92,2.0,0,1.25,3.6,1.35,.00,-8,-1,3,.5);
 drawPart(COLOSSO_OCT.blue, .92,2.0,0,1.25,3.6,1.35,.05, 8,-1,3,-.5);
 drawPart(COLOSSO_BOX.dark,-.92,.35,.28,1.45,.65,1.9,.04,-8,-2,5,.3);
 drawPart(COLOSSO_BOX.dark, .92,.35,.28,1.45,.65,1.9,.09, 8,-2,5,-.3);
 // PETTO — Dragone Rosso.
 drawPart(COLOSSO_OCT.red,0,5.0,0,3.25,3.0,1.75,.20,0,-5,8,0);
 // BRACCIA — Gorilla Nero. Il destro viene animato per spada/posa vittoria.
 drawPart(COLOSSO_OCT.black,-2.25,5.0,0,1.25,3.1,1.25,.37,-10,7,2,.7);
 drawPart(COLOSSO_BOX.dark,-2.25,3.15,.15,1.05,1.15,1.15,.41,-11,5,4,.4);
 const armQ=easeOut3(partProgress(p,.43,.67));
 if(armQ>0){
  let ux=2.25,uy=5.0,uz=0,ur=0, lx=2.25,ly=3.15,lz=.15,lr=0;
  const lift=Math.max(victory, swordDrop>.82?Math.min(1,(swordDrop-.82)/.18):0);
  if(lift>0){ux=2.10;uy=5.0+1.05*lift;ur=-.42*lift;lx=2.65;ly=3.15+3.55*lift;lr=-.18*lift;}
  if(slash>0){ux=2.10-1.1*slash;uy=6.0-.65*slash;ur=-.42-1.0*slash;lx=2.65-2.0*slash;ly=6.7-1.25*slash;lr=-.18-1.2*slash;}
  drawBuffer(COLOSSO_OCT.black,mul(base,mat4.translate(ux,uy,uz),mat4.rotZ(ur),mat4.scale(1.25,3.1,1.25)),vp,armQ);
  drawBuffer(COLOSSO_BOX.dark,mul(base,mat4.translate(lx,ly,lz),mat4.rotZ(lr),mat4.scale(1.05,1.15,1.15)),vp,armQ);
 }
 // TESTA — Uccello Rosa, sagoma pulita SENZA cresta. Ottagono + cupola per
 // una calotta arrotondata invece di un cubo, stessa idea del casco Ranger.
 drawPart(COLOSSO_OCT.pink,0,7.35,0,1.65,1.45,1.55,.60,0,14,2,0);
 {
  const hq=easeOut3(partProgress(p,.60,.84));
  if(hq>0)drawBuffer(COLOSSO_DOME.pink,mul(base,mat4.translate(0,7.35,0),mat4.scale(1.65,1.40,1.55)),vp,hq);
 }
 drawPart(COLOSSO_BOX.cyan,0,7.45,.79,1.20,.43,.08,.68,0,14,2,0);
 // ALI / MODULO ZERO — Drago Verde, sesto Ranger.
 drawPart(COLOSSO_BOX.zero,0,5.25,-1.30,1.55,2.05,.45,.52,0,10,-5,0);
 drawPart(COLOSSO_BOX.zero,-1.75,6.05,-1.30,1.55,.18,.62,.58,-8,11,-4,.62);
 drawPart(COLOSSO_BOX.zero, 1.75,6.05,-1.30,1.55,.18,.62,.58, 8,11,-4,-.62);
 drawPart(COLOSSO_BOX.zeroAccent,-2.75,6.25,-1.28,.80,.09,.34,.66,-9,12,-4,.82);
 drawPart(COLOSSO_BOX.zeroAccent, 2.75,6.25,-1.28,.80,.09,.34,.66, 9,12,-4,-.82);
 // Placche finali che rendono immediatamente leggibile quale modulo forma cosa.
 const armorQ=partProgress(p,.55,1);
 if(armorQ>0){
  drawBuffer(COLOSSO_BOX.red,mul(base,mat4.translate(0,5.55,.96),mat4.scale(2.25,.86,.11)),vp,armorQ);
  drawBuffer(COLOSSO_BOX.yellow,mul(base,mat4.translate(-.88,2.35,.76),mat4.scale(.40,.95,.08)),vp,armorQ);
  drawBuffer(COLOSSO_BOX.blue,mul(base,mat4.translate(.88,2.35,.76),mat4.scale(.40,.95,.08)),vp,armorQ);
  drawBuffer(COLOSSO_BOX.black,mul(base,mat4.translate(-2.24,5.10,.76),mat4.scale(.34,.92,.08)),vp,armorQ);
  drawBuffer(COLOSSO_BOX.black,mul(base,mat4.translate( 2.24,5.10,.76),mat4.scale(.34,.92,.08)),vp,armorQ);
  drawBuffer(COLOSSO_BOX.pink,mul(base,mat4.translate(0,7.40,.83),mat4.scale(.74,.36,.08)),vp,armorQ);
 }
 const q=partProgress(p,.78,1);
 if(q>0){
  const pulse=.88+Math.sin(now/110)*.12;
  drawBuffer(COLOSSO_BOX.zero,mul(base,mat4.translate(0,5.30,1.01),mat4.scale(.58,.70,.11)),vp,q);
  drawBuffer(COLOSSO_BOX.cyan,mul(base,mat4.translate(0,5.35,1.04),mat4.scale(.25*pulse,.25*pulse,.05)),vp,q);
 }
 // SPADA DEL COLOSSO — compare SOLO nell'attacco speciale finale e resta
 // nella posa di vittoria. Durante l'evocazione scende davvero dall'alto.
 if(swordDrop>0||victory>0){
  let sx=2.88, sy=7.35, sz=.15, sr=-.04;
  if(swordDrop>0&&swordDrop<1){sy=14.0-(14.0-7.35)*easeOut3(swordDrop);}
  if(slash>0){sx=2.88-2.35*slash;sy=7.35-.95*slash;sr=-1.55*slash;}
  if(victory>0){sx=3.05;sy=9.10;sr=-.05;}
  const sm=mul(base,mat4.translate(sx,sy,sz),mat4.rotZ(sr));
  drawBuffer(COLOSSO_BOX.gold,mul(sm,mat4.translate(0,-1.15,0),mat4.scale(.18,.42,.18)),vp);
  drawBuffer(COLOSSO_BOX.dark,mul(sm,mat4.translate(0,-.78,0),mat4.scale(.55,.09,.18)),vp);
  drawBuffer(COLOSSO_BOX.silver,mul(sm,mat4.translate(0,.85,0),mat4.scale(.22,2.15,.10)),vp);
  drawBuffer(COLOSSO_BOX.cyan,mul(sm,mat4.translate(0,.85,.11),mat4.scale(.065,1.88,.035)),vp,.92);
  drawBuffer(COLOSSO_BOX.gold,mul(sm,mat4.translate(0,3.08,0),mat4.rotZ(Math.PI/4),mat4.scale(.20,.20,.10)),vp);
 }
}

// v37 — i moduli non sono piu' soltanto "blocchi che compaiono" durante
// l'assemblaggio: vengono chiamati UNO ALLA VOLTA davanti alla squadra.
const MODULE_CALLS=[
 {speaker:"ARCO",line:"DRAGONE ROSSO, VIENI A ME!",kind:"redDragon",x:-5.5},
 {speaker:"JUN",line:"GATTO GIALLO, TI EVOCO!",kind:"yellowCat",x:-3.3},
 {speaker:"MERIDIANA",line:"CANE BLU, RISPONDI ALLA CHIAMATA!",kind:"blueDog",x:-1.1},
 {speaker:"DON",line:"GORILLA NERO, ENTRA IN AZIONE!",kind:"blackGorilla",x:1.1},
 {speaker:"VALE",line:"UCCELLO ROSA, SPIEGATI NEL CIELO!",kind:"pinkBird",x:3.3},
 {speaker:"ZERO",line:"DRAGO VERDE... MODULO ZERO, ATTIVATI!",kind:"greenDragon",x:5.5},
];
const MODULE_SEG=1.12;
function drawAnimalModule(vp,def,q,now){
 if(q<=0)return;
 q=easeOut3(Math.min(1,q));
 const flying=def.kind==="pinkBird"||def.kind==="greenDragon";
 const z0=ARENA_CZ-13.0, z1=ARENA_CZ-3.8;
 const z=z0+(z1-z0)*q, y=(flying?(3.1-(3.1-.75)*q):.30)+Math.sin(now/180+def.x)*.05;
 const base=mul(mat4.translate(def.x,y,z),mat4.rotY(Math.PI));
 const P=(buf,x,y,z,sx,sy,sz,rz=0)=>drawBuffer(buf,mul(base,mat4.translate(x,y,z),mat4.rotZ(rz),mat4.scale(sx,sy,sz)),vp,q);
 // v49 — i moduli a terra prima della combinazione erano scatole pure,
 // stessa causa del "pile di cubi" gia' vista sul Colosso. Corpo e testa
 // (le forme piu' grandi e piu' visibili) ora usano gli stessi ottagoni
 // gia' pronti per il Colosso — zampe/corna/orecchie restano box per
 // leggere ancora nitide, non serve arrotondare i dettagli piccoli.
 if(def.kind==="redDragon"){
  P(COLOSSO_OCT.red,0,.55,0,1.25,.36,.58);P(COLOSSO_OCT.red,0,.60,.78,.52,.42,.50);
  P(COLOSSO_BOX.gold,-.28,1.00,.84,.08,.34,.08,-.35);P(COLOSSO_BOX.gold,.28,1.00,.84,.08,.34,.08,.35);
  P(COLOSSO_BOX.dark,0,.54,-.88,.22,.18,.80);
 }else if(def.kind==="yellowCat"){
  P(COLOSSO_OCT.yellow,0,.55,0,1.05,.34,.52);P(COLOSSO_OCT.yellow,0,.62,.68,.52,.40,.46);
  P(COLOSSO_BOX.gold,-.23,1.00,.73,.10,.28,.08,-.45);P(COLOSSO_BOX.gold,.23,1.00,.73,.10,.28,.08,.45);
  for(const x of [-.68,.68])for(const z2 of [-.30,.35])P(COLOSSO_BOX.silver,x,.08,z2,.15,.45,.16);
  P(COLOSSO_BOX.yellow,0,.78,-.78,.08,.08,.70,.45);
 }else if(def.kind==="blueDog"){
  P(COLOSSO_OCT.blue,0,.55,0,1.10,.36,.55);P(COLOSSO_OCT.blue,0,.64,.70,.56,.42,.48);P(COLOSSO_BOX.silver,0,.54,1.08,.32,.20,.30);
  P(COLOSSO_BOX.dark,-.32,.96,.70,.10,.30,.08,-.25);P(COLOSSO_BOX.dark,.32,.96,.70,.10,.30,.08,.25);
  for(const x of [-.68,.68])for(const z2 of [-.28,.34])P(COLOSSO_BOX.silver,x,.08,z2,.15,.45,.16);
 }else if(def.kind==="blackGorilla"){
  P(COLOSSO_OCT.black,0,.92,0,.90,.82,.58);P(COLOSSO_BOX.silver,0,1.62,.30,.50,.42,.44);
  P(COLOSSO_OCT.black,-1.05,.70,.05,.42,.85,.42,.20);P(COLOSSO_OCT.black,1.05,.70,.05,.42,.85,.42,-.20);
  P(COLOSSO_BOX.dark,-1.12,.08,.10,.50,.25,.50);P(COLOSSO_BOX.dark,1.12,.08,.10,.50,.25,.50);
 }else if(def.kind==="pinkBird"){
  P(COLOSSO_OCT.pink,0,.72,0,.62,.34,.55);P(COLOSSO_OCT.pink,0,.75,.62,.40,.34,.42);P(COLOSSO_BOX.gold,0,.72,1.02,.18,.10,.42);
  P(COLOSSO_BOX.pink,-1.05,.80,0,.95,.08,.45,.20);P(COLOSSO_BOX.pink,1.05,.80,0,.95,.08,.45,-.20);
 }else{
  P(COLOSSO_OCT.zero,0,.68,0,.90,.34,.62);P(COLOSSO_OCT.zero,0,.72,.70,.48,.38,.45);
  P(COLOSSO_BOX.zero,-1.10,.82,-.10,1.05,.10,.50,.35);P(COLOSSO_BOX.zero,1.10,.82,-.10,1.05,.10,.50,-.35);
  P(COLOSSO_BOX.gold,-.24,1.05,.76,.08,.34,.08,-.35);P(COLOSSO_BOX.gold,.24,1.05,.76,.08,.34,.08,.35);
 }
}
function drawSummonedModules(vp,now){
 if(!colosso||colosso.phase!=="summon")return;
 for(let i=0;i<MODULE_CALLS.length;i++){
  const q=Math.max(0,Math.min(1,(colosso.t-i*MODULE_SEG)/.72));
  if(q>0)drawAnimalModule(vp,MODULE_CALLS[i],q,now);
 }
}
function newColossoState(phase){
 return {phase:phase||"fight",t:0,giantHp:520,giantHpMax:520,playerHp:100,playerHpMax:100,
  giantScale:7.15,attackCd:2.9,punchT:0,punchCd:0,beamT:0,shakeT:0,beamBursts:[],guardT:0,guardCd:0,
  perfectGuard:false,attackTelegraph:false,attackKind:"punch",phase2:false,finisherReady:false,messageT:0,
  robotX:-5.0,robotZ:ARENA_CZ+2.0,giantX:5.0,giantZ:ARENA_CZ-5.0,giantAttackT:0,
  lastSummonIndex:-1,finishHitTriggered:false};
}
function startColossoSequence(){
 if(colosso)return;
 clearKeys();
 colosso=newColossoState("pose");
 colosso.giantScale=1.55;
 showStoryCue("ARCO","Non basta. Squadra — Formazione Colosso!",{duration:1650});
 colossoHpWrapEl.classList.add("show");
 sfx.teleport();
 // Non si fondono i corpi: i Ranger prendono posizione, fanno la posa toku
 // e CHIAMANO i moduli. La cinematic successiva mostra il vero assemblaggio.
 const pose=[[-4.6,ARENA_CZ+3.5],[-2.25,ARENA_CZ+2.15],[0,ARENA_CZ+1.55],[2.25,ARENA_CZ+2.15],[4.6,ARENA_CZ+3.5]];
 colossoTeamPos=arenaAllies.map((a,i)=>({startX:a.x,startZ:a.z,x:a.x,z:a.z,targetX:pose[i][0],targetZ:pose[i][1],pal:a.pal,name:a.name,yaw:Math.PI}));
 player.x=ARENA_CX;player.z=ARENA_CZ+5.0;player.yaw=Math.PI;
}
function showGiantTutorial(){
 if(giantTutorialEl)giantTutorialEl.classList.add("show");
 missionHintEl.classList.remove("show");
}
function beginGiantBattle(){
 if(!colosso||colosso.phase!=="tutorial")return;
 if(giantTutorialEl)giantTutorialEl.classList.remove("show");
 colosso.phase="fight";colosso.t=0;colosso.attackCd=4.0;colosso.attackTelegraph=false;
 missionHintEl.textContent="LEGGI L'ATTACCO // SHIFT AL MOMENTO GIUSTO";
 missionHintEl.classList.add("show");colosso.messageT=2.5;
}
function startColossoFightDirect(){
 clearTransientState();
 zone="colosso";
 player.transformed=true;player.helmet=true;player.hp=player.hpMax;player.energy=0;
 colosso=newColossoState("tutorial");
 colossoTeamPos=null;
 colossoHpWrapEl.classList.add("show");
 playAmbient("colosso");
 saveCheckpoint("colosso");
 showGiantTutorial();
}
function updateColossoThresholds(){
 if(!colosso)return;
 if(!colosso.phase2&&colosso.giantHp<=colosso.giantHpMax*.5){
  colosso.phase2=true;
  colosso.attackCd=Math.min(colosso.attackCd,1.25);
  colosso.shakeT=.5;
  missionHintEl.textContent="RACCOGLITORE // SOVRACCARICO";
  missionHintEl.classList.add("show");
  colosso.messageT=1.6;
  sfx.alarm(); specialFlashEl.style.opacity=.65;setTimeout(()=>specialFlashEl.style.opacity=0,160);
 }
 if(!colosso.finisherReady&&colosso.giantHp<=55){
  colosso.giantHp=55;
  colosso.finisherReady=true;
  colosso.attackCd=999;
  colosso.attackTelegraph=false;
  player.energy=player.energyMax;
  missionHintEl.textContent="ZERO! ADESSO!  C — COLPO FINALE";
  missionHintEl.classList.add("show");
  sfx.alarm();
 }
}
function colossoPunch(){
 if(!colosso||colosso.phase!=="fight"||colosso.punchT>0||colosso.punchCd>0||colosso.beamT>0)return;
 if(colosso.finisherReady){missionHintEl.textContent="C — COLPO FINALE";missionHintEl.classList.add("show");return;}
 colosso.punchT=.48;colosso.punchCd=.86;
 colosso.giantHp=Math.max(0,colosso.giantHp-10);
 player.energy=Math.min(player.energyMax,player.energy+5);
 colosso.beamBursts.push({t:0,kind:"punch",ox:(Math.random()-.5)*3.4,oy:(Math.random()-.5)*7.5});
 sfx.giantHit(); triggerSlowMo(.09,.08); updateColossoThresholds();
}
function colossoSpecial(){
 if(!colosso||colosso.phase!=="fight"||colosso.beamT>0||colosso.punchT>0)return;
 if(colosso.finisherReady){
  // Bug vero, trovato dopo segnalazione: qui c'era ANCHE un
  // `colosso.beamBursts.push({t:0,kind:"beam"})` — un raggio istantaneo
  // lasciato da prima che la sequenza della spada esistesse. Scattava
  // insieme a startColossoFinish(), quindi premendo C si vedeva subito il
  // raggio E POI, sopra, la sequenza vera (fulmini/spada/fendente) —
  // il "raggio che parte subito invece della spada" che si vedeva era
  // esattamente questo. Rimosso: ora parte SOLO la sequenza vera.
  colosso.beamT=.8;player.energy=0;colosso.giantHp=0;
  sfx.special();startColossoFinish();return;
 }
 if(player.energy<player.energyMax)return;
 colosso.beamT=.5;player.energy=0;
 colosso.giantHp=Math.max(0,colosso.giantHp-55);
 specialFlashEl.style.opacity=.95;setTimeout(()=>{specialFlashEl.style.opacity=0;},140);
 colosso.beamBursts.push({t:0,kind:"beam"});sfx.special();triggerSlowMo(.16,.1);updateColossoThresholds();
}
function colossoGuard(){
 if(!colosso||colosso.phase!=="fight"||colosso.finisherReady||colosso.guardCd>0)return;
 colosso.guardT=.54;colosso.guardCd=.78;
 colosso.perfectGuard=!!colosso.attackTelegraph;
 if(colosso.perfectGuard){
  player.energy=Math.min(player.energyMax,player.energy+14);
  missionHintEl.textContent="GUARDIA PERFETTA // ENERGIA +";missionHintEl.classList.add("show");colosso.messageT=.65;sfx.dodge();
 }else{sfx.dodge();}
}
function startColossoFinish(){
 if(!colosso||colosso.phase==="finishing"||colosso.phase==="won")return;
 colosso.phase="finishing";colosso.finishT=0;colosso.finishZoom=0;colosso.finishTilt=0;colosso.finishBoomT=0;colosso.finishBoomNext=.15;colosso.finishHitTriggered=false;
 missionHintEl.textContent="ATTACCO SPECIALE // ENERGIA AL MASSIMO";missionHintEl.classList.add("show");
 triggerSlowMo(4.2,.28);sfx.alarm();
}
function updateColossoFinish(dt){
 colosso.finishT+=dt;
 const t=colosso.finishT;
 // 0–.65: chiamata; .65–1.55: fulmini + spada dal cielo; 1.55–2.35:
 // fendente; 2.35–3.75: il Raccoglitore viene scagliato ALL'INDIETRO.
 if(t<.65)missionHintEl.textContent="ATTACCO SPECIALE!";
 else if(t<1.55)missionHintEl.textContent="COLPO FINALE // SPADA DEL COLOSSO!";
 else if(t<2.35)missionHintEl.textContent="COLPO FINALE // ORA!";
 else missionHintEl.textContent="IMPATTO!";
 colosso.finishZoom=Math.min(1,t/3.8);
 // Fulmini / scariche lungo il tragitto della spada prima dell'aggancio.
 colosso.finishBoomT=(colosso.finishBoomT||0)+dt;
 if(t>.55&&t<1.65&&colosso.finishBoomT>=(colosso.finishBoomNext||.12)){
  colosso.finishBoomT=0;colosso.finishBoomNext=.07+Math.random()*.09;
  colosso.beamBursts.push({t:0,kind:"swordLightning",ox:(Math.random()-.5)*1.1,oy:Math.random()*5.5});
 }
 if(t>1.95&&!colosso.finishHitTriggered){
  colosso.finishHitTriggered=true;colosso.shakeT=.65;specialFlashEl.style.opacity=1;setTimeout(()=>specialFlashEl.style.opacity=0,180);sfx.giantHit();triggerSlowMo(.55,.08);
  for(let i=0;i<7;i++)colosso.beamBursts.push({t:-i*.035,kind:"punch",ox:(Math.random()-.5)*4.2,oy:(Math.random()-.5)*8.5});
 }
 if(t>4.0)colossoWin();
}
function colossoWin(){
 if(giantTutorialEl)giantTutorialEl.classList.remove("show");
 colosso.phase="won";colosso.winT=0;missionHintEl.textContent="VITTORIA";missionHintEl.classList.add("show");sfx.win();
 // Il payoff resta in scena: il Colosso si gira verso camera e alza la
 // spada. Solo dopo compare il logo, SENZA pulsante CONTINUA; il rientro
 // alla Torre avviene automaticamente.
 afterGame(1600,()=>{
  colossoOutcomeEl.querySelector("p").textContent="";
  colossoOutcomeEl.classList.add("show","win");
  afterGame(3200,()=>doColossoOutcomeContinue());
 });
}
function colossoLose(){
 if(giantTutorialEl)giantTutorialEl.classList.remove("show");
 colosso.phase="lost";colossoOutcomeEl.querySelector("h1").textContent="IL COLOSSO CROLLA";
 colossoOutcomeEl.querySelector("p").textContent="Riprova dal checkpoint del Colosso.";
 colossoOutcomeEl.classList.remove("win");colossoOutcomeEl.classList.add("show");sfx.lose();
}
function updateColosso(dt){
 if(!colosso)return;colosso.t+=dt;
 if(colosso.phase==="pose"){
  const moveP=Math.min(1,colosso.t/1.75),ease=1-Math.pow(1-moveP,3);
  for(const tp of colossoTeamPos){tp.x=tp.startX+(tp.targetX-tp.startX)*ease;tp.z=tp.startZ+(tp.targetZ-tp.startZ)*ease;tp.yaw=Math.PI;}
  if(colosso.t>1.7&&!colosso.poseCue2){colosso.poseCue2=true;showStoryCue("ARCO","Chiamiamo i moduli!",{duration:1300});}
  if(colosso.t>3.0){colosso.phase="summon";colosso.t=0;colosso.lastSummonIndex=-1;showStoryCue("SCENA","CHIAMATA MODULI",{portrait:false,duration:1200});}
  return;
 }
 if(colosso.phase==="summon"){
  const idx=Math.min(MODULE_CALLS.length-1,Math.floor(colosso.t/MODULE_SEG));
  if(idx!==colosso.lastSummonIndex){
   colosso.lastSummonIndex=idx;const c=MODULE_CALLS[idx];showStoryCue(c.speaker,c.line,{duration:1250});sfx.teleport();
   specialFlashEl.style.opacity=.22;setTimeout(()=>specialFlashEl.style.opacity=0,100);
  }
  if(colosso.t>MODULE_CALLS.length*MODULE_SEG+.55){
   colosso.phase="combine";colosso.t=0;colossoTeamPos=null;zone="colosso";colosso.giantScale=2.2;
   flashEl.style.opacity=1;setTimeout(()=>flashEl.style.opacity=0,220);sfx.transform();playAmbient("colosso");
   missionHintEl.textContent="COLOSSO // MODULI IN AGGANCIO";
  }
  return;
 }
 if(colosso.phase==="combine"){
  const p=Math.min(1,colosso.t/8.0);colosso.giantScale=2.2+p*4.95;
  if(colosso.t>1.0&&colosso.t<3.0)missionHintEl.textContent="GATTO GIALLO + CANE BLU // GAMBE";
  else if(colosso.t>=3.0&&colosso.t<4.7)missionHintEl.textContent="DRAGONE ROSSO // PETTO — GORILLA NERO // BRACCIA";
  else if(colosso.t>=4.7&&colosso.t<6.3)missionHintEl.textContent="UCCELLO ROSA // TESTA";
  else if(colosso.t>=6.3)missionHintEl.textContent="DRAGO VERDE // ALI — COLOSSO COMPLETO";
  if(colosso.t>8.0){colosso.phase="reveal";colosso.t=0;sfx.win();}
  return;
 }
 if(colosso.phase==="reveal"){
  if(colosso.t>2.7){colosso.phase="tutorial";colosso.t=0;saveCheckpoint("colosso");showGiantTutorial();}
  return;
 }
 if(colosso.phase==="tutorial")return;
 if(colosso.phase==="finishing"){updateColossoFinish(dt);return;}
 if(colosso.phase==="won"){colosso.winT=(colosso.winT||0)+dt;return;}
 if(colosso.phase!=="fight")return;
 colosso.punchT=Math.max(0,colosso.punchT-rawDtGlobal);colosso.punchCd=Math.max(0,(colosso.punchCd||0)-rawDtGlobal);colosso.beamT=Math.max(0,colosso.beamT-rawDtGlobal);
 colosso.giantAttackT=Math.max(0,(colosso.giantAttackT||0)-rawDtGlobal);
 colosso.shakeT=Math.max(0,colosso.shakeT-dt);colosso.guardT=Math.max(0,colosso.guardT-rawDtGlobal);colosso.guardCd=Math.max(0,(colosso.guardCd||0)-rawDtGlobal);
 // Footwork vero: prima oscillavano solo in X, la profondita' (Z) restava
 // fissa per tutto il combattimento (confermato testando: zero variazione
 // in 5s di combattimento normale) — leggeva davvero come "due sagome
 // ferme che si toccano". Ora si muovono anche avanti/indietro, con
 // frequenze diverse tra i due cosi' non sembrano sincronizzati a specchio.
 colosso.robotX=-5.0+Math.sin(colosso.t*.55)*.85;
 colosso.robotZ=ARENA_CZ+2.0+Math.sin(colosso.t*.37+.4)*1.15;
 colosso.giantX=5.0+Math.sin(colosso.t*.43+1.6)*.95;
 colosso.giantZ=ARENA_CZ-5.0+Math.sin(colosso.t*.51+2.3)*1.30;
 if(colosso.messageT>0){colosso.messageT-=rawDtGlobal;if(colosso.messageT<=0&&!colosso.finisherReady&&!colosso.attackTelegraph)missionHintEl.classList.remove("show");}
 for(let i=colosso.beamBursts.length-1;i>=0;i--){colosso.beamBursts[i].t+=dt;if(colosso.beamBursts[i].t>.70)colosso.beamBursts.splice(i,1);}
 if(colosso.finisherReady)return;
 colosso.attackCd-=rawDtGlobal;
 if(colosso.attackCd<=.72&&!colosso.attackTelegraph){
  colosso.attackTelegraph=true;
  const labels={punch:"PUGNO GIGANTE",slam:"COLPO DALL'ALTO",beam:"RAGGIO IN CARICA"};
  missionHintEl.textContent=(labels[colosso.attackKind]||"ATTACCO IN ARRIVO")+" — SHIFT = GUARDIA";missionHintEl.classList.add("show");sfx.alarm();
 }
 if(colosso.attackCd<=0){
  const base={punch:18,slam:22,beam:20}[colosso.attackKind]||18;
  const baseDmg=base+(colosso.phase2?4:0);
  const guarded=colosso.guardT>0;
  const dmg=guarded?(colosso.perfectGuard?0:Math.ceil(baseDmg*.30)):baseDmg;
  colosso.giantAttackT=colosso.attackKind==="slam"?.72:.58;
  if(colosso.attackKind==="beam")colosso.beamBursts.push({t:0,kind:"enemyBeam",oy:(Math.random()-.5)*3});
  else colosso.beamBursts.push({t:0,kind:"enemyHit",ox:(Math.random()-.5)*3.4,oy:(Math.random()-.5)*7.5});
  colosso.shakeT=guarded?.18:.44;colosso.playerHp=Math.max(0,colosso.playerHp-dmg);
  if(guarded){missionHintEl.textContent=colosso.perfectGuard?"GUARDIA PERFETTA":"GUARDIA";missionHintEl.classList.add("show");colosso.messageT=.55;sfx.dodge();}
  else sfx.hitPlayer();
  const kinds=["punch","slam","beam"];colosso.attackKind=kinds[Math.floor(Math.random()*kinds.length)];
  colosso.attackCd=colosso.phase2?2.05:2.75;colosso.attackTelegraph=false;colosso.perfectGuard=false;
  if(colosso.playerHp<=0)colossoLose();
 }
}
document.getElementById("giantTutorialBtn").addEventListener("click",beginGiantBattle);
function doColossoOutcomeContinue(){
 if(!colossoOutcomeEl.classList.contains("show"))return;
 colossoOutcomeEl.classList.remove("show");
 if(colosso&&colosso.phase==="lost"){restoreCheckpoint("colosso");return;}
 colosso=null;missionHintEl.classList.remove("show");colossoHpWrapEl.classList.remove("show");
 archivioUnlocked=true;postBossState=true;morphUnlocked=true;enterTorre();setupPostBossTeam();saveCheckpoint("postboss");
 afterGame(450,()=>playDialogue(postBossLines,()=>{
  missionHintEl.textContent="PARLA CON LA SQUADRA O CONTROLLA IL PANNELLO // R = ARMATURA";missionHintEl.classList.add("show");
 }));
}
document.getElementById("colossoOutcomeBtn").addEventListener("click",doColossoOutcomeContinue);

let enemies=[];
let arenaWave=0,arenaWaveTransition=false,wave4Batch2Pending=false;
let arenaAllies=[];
let supportDrops=[];
const RACC_SEA_Z=ARENA_CZ-ARENA_D/2+2.8;
const RACC_SHORE_Z=SEA_EDGE_Z+.85;
const SUPPORT_COLORS={hp:[.20,.95,.42],energy:[.18,.88,1.0],power:[1.0,.72,.12]};
function makeMook(x,z,cd,elite){
 const hp=elite?55:36;
 return {type:"scagnozzo",elite:!!elite,pal:elite?PAL_SCAGNOZZO_ELITE:PAL_SCAGNOZZO,x,z,yaw:0,hp,hpMax:hp,state:"idle",cd:cd||0,scale:elite?1.10:1,alpha:1,dead:false,walkPhaseE:0,hitFlash:0,attackFlashT:0,windupT:0,telegraph:false,aggroPlayer:Math.random()<.58};
}
function initArenaAllies(){
 arenaAllies=[
  {name:"ARCO",pal:PAL_ARCO,x:ARENA_CX-5.5,z:ARENA_CZ+6.5,yaw:Math.PI,cd:.2,attackT:0,attackStyle:0,hurtT:0,walk:0},
  {name:"MERIDIANA",pal:PAL_MERIDIANA,x:ARENA_CX+5.5,z:ARENA_CZ+6.0,yaw:Math.PI,cd:.7,attackT:0,attackStyle:1,hurtT:0,walk:1},
  {name:"JUN",pal:PAL_RANGER3,x:ARENA_CX-7.0,z:ARENA_CZ+3.0,yaw:Math.PI,cd:1.0,attackT:0,attackStyle:2,hurtT:0,walk:2},
  {name:"VALE",pal:PAL_RANGER4,x:ARENA_CX+7.0,z:ARENA_CZ+3.0,yaw:Math.PI,cd:1.3,attackT:0,attackStyle:0,hurtT:0,walk:3},
  {name:"DON",pal:PAL_DON,x:ARENA_CX,z:ARENA_CZ+7.4,yaw:Math.PI,cd:.9,attackT:0,attackStyle:1,hurtT:0,walk:4},
 ];
}
function addWave(stage,batch){
 if(stage===1){
  enemies.push(makeMook(ARENA_CX-4.5,ARENA_CZ-3,.2),makeMook(ARENA_CX+4.0,ARENA_CZ-3,.7),makeMook(ARENA_CX,ARENA_CZ-7,1.1),makeMook(ARENA_CX+1.5,ARENA_CZ-5.5,1.35));
 }else if(stage===2){
  enemies.push(makeMook(ARENA_CX-9,ARENA_CZ-5,.2),makeMook(ARENA_CX+9,ARENA_CZ-5,.5),makeMook(ARENA_CX-3,ARENA_CZ-9,.9),makeMook(ARENA_CX+3,ARENA_CZ-9,1.2),makeMook(ARENA_CX,ARENA_CZ-11,1.45));
 }else if(stage===3){
  enemies.push(makeMook(ARENA_CX-8,ARENA_CZ-4,.15),makeMook(ARENA_CX+8,ARENA_CZ-4,.4),makeMook(ARENA_CX-5,ARENA_CZ-8,.7),makeMook(ARENA_CX+5,ARENA_CZ-8,.95),makeMook(ARENA_CX-1.5,ARENA_CZ-10.5,1.2),makeMook(ARENA_CX+1.5,ARENA_CZ-10.5,1.4,true));
 }else if(stage===4&&batch===1){
  enemies.push(makeMook(ARENA_CX-9,ARENA_CZ-5,.15,true),makeMook(ARENA_CX+9,ARENA_CZ-5,.45),makeMook(ARENA_CX-4,ARENA_CZ-10,.8),makeMook(ARENA_CX+4,ARENA_CZ-10,1.05));
 }else if(stage===4&&batch===2){
  enemies.push(makeMook(ARENA_CX-7,ARENA_CZ-8,.15),makeMook(ARENA_CX+7,ARENA_CZ-8,.45,true),makeMook(ARENA_CX,ARENA_CZ-11.2,.8));
 }
}
function spawnSupportDrop(kind){
 if(zone!=="arena")return;
 const a=Math.random()*Math.PI*2,r=2.7+Math.random()*3.8,b=zoneBounds();
 let x=player.x+Math.cos(a)*r,z=player.z+Math.sin(a)*r;
 x=Math.max(b.xmin+1,Math.min(b.xmax-1,x)); z=Math.max(b.zmin+1,Math.min(b.zmax-1,z));
 const bossLive=enemies.some(e=>e.type==="raccoglitore"&&e.emerged&&!e.dead&&!e.retreated);
 supportDrops.push({kind,x,z,state:"telegraph",t:0,life:bossLive?8:6,col:SUPPORT_COLORS[kind]});
 const name=kind==="hp"?"VITALITA'":kind==="energy"?"ENERGIA":"SOVRACCARICO";
 missionHintEl.textContent="TIC // SCARICA DI SUPPORTO — "+name;missionHintEl.classList.add("show");
 afterGame(1200,()=>{if(zone==="arena"&&!emergeCutscene)missionHintEl.classList.remove("show");});
}
function chooseDirectorSupport(){
 if(player.hp<55)return "hp";
 if(player.energy<35)return "energy";
 return "power";
}
function updateSupportDrops(dt){
 if(zone!=="arena")return;
 for(let i=supportDrops.length-1;i>=0;i--){
  const d=supportDrops[i];d.t+=dt;
  if(d.state==="telegraph"&&d.t>=.62){d.state="active";d.t=0;sfx.teleport();specialFlashEl.style.opacity=.24;afterGame(100,()=>specialFlashEl.style.opacity=0);}
  else if(d.state==="active"){
   d.life-=dt;
   if(Math.hypot(player.x-d.x,player.z-d.z)<.95){
    if(d.kind==="hp"){const bossLive=enemies.some(e=>e.type==="raccoglitore"&&e.emerged&&!e.dead&&!e.retreated);const gain=Math.min(bossLive?20:15,player.hpMax-player.hp);player.hp+=gain;missionHintEl.textContent="BONUS VITALITA' +"+gain+" HP";}
    else if(d.kind==="energy"){const gain=Math.min(30,player.energyMax-player.energy);player.energy+=gain;missionHintEl.textContent="BONUS ENERGIA +"+gain;}
    else{player.powerBuffT=Math.max(player.powerBuffT,6);missionHintEl.textContent="SOVRACCARICO // DANNI POTENZIATI 6s";}
    missionHintEl.classList.add("show");sfx.special();supportDrops.splice(i,1);afterGame(950,()=>{if(zone==="arena"&&!emergeCutscene)missionHintEl.classList.remove("show");});continue;
   }
   if(d.life<=0){supportDrops.splice(i,1);continue;}
  }
 }
}
function spawnWave(){
 enemies=[];supportDrops.length=0;arenaWave=1;arenaWaveTransition=false;wave4Batch2Pending=false;initArenaAllies();addWave(1);
 enemies.push({type:"raccoglitore",pal:PAL_RACCOGLITORE,x:ARENA_CX,z:RACC_SEA_Z,y:-2.8,yaw:0,hp:160,hpMax:160,state:"submerged",cd:2,scale:1.55,alpha:1,dead:false,retreated:false,walkPhaseE:0,hitFlash:0,attackFlashT:0,hidden:true,emerging:false,emerged:false,aggroPlayer:true,comboHits:0,recoverT:0,graceT:0,supportT:0,bossSupportStarted:false});
}
function aliveMooks(){return enemies.filter(e=>e.type==="scagnozzo"&&!e.dead);}
function maybeAdvanceArenaWave(){
 if(arenaWaveTransition||emergeCutscene)return;
 if(arenaWave===1&&aliveMooks().length===0){
  arenaWaveTransition=true;arenaWave=2;
  showStoryCue("ARCO","Non e' finita. Seconda ondata!",{duration:1350});
  afterGame(1150,()=>{
   addWave(2);arenaWaveTransition=false;missionHintEl.textContent="SECONDA ONDATA // TENETE LA LINEA";
   afterGame(1500,()=>{if(zone==="arena"&&arenaWave===2)spawnSupportDrop("energy");});
  });
 }else if(arenaWave===2&&aliveMooks().length===0){
  arenaWaveTransition=true;arenaWave=3;
  showStoryCue("MERIDIANA","Ne arrivano altri. Formazione!",{duration:1400});
  afterGame(1200,()=>{
   addWave(3);arenaWaveTransition=false;missionHintEl.textContent="TERZA ONDATA // UNITA' GUARDIA RILEVATA";
   if(player.hp<65)afterGame(900,()=>{if(zone==="arena"&&arenaWave===3)spawnSupportDrop("hp");});
  });
 }else if(arenaWave===3&&aliveMooks().length===0){
  arenaWaveTransition=true;arenaWave=4;wave4Batch2Pending=true;
  showStoryCue("JUN","Questa e' l'ultima... vero?!",{duration:1450});
  afterGame(1150,()=>{
   addWave(4,1);arenaWaveTransition=false;missionHintEl.textContent="ULTIMA LINEA // NON CEDETE";
   afterGame(1600,()=>{if(zone==="arena"&&arenaWave===4)spawnSupportDrop("power");});
  });
  afterGame(3900,()=>{
   if(zone==="arena"&&arenaWave===4){
    addWave(4,2);wave4Batch2Pending=false;showStoryCue("DON","Secondo gruppo, a destra!",{duration:1350});
    afterGame(1300,()=>{if(zone==="arena"&&arenaWave===4)spawnSupportDrop(chooseDirectorSupport());});
   }
  });
 }else if(arenaWave===4&&aliveMooks().length===0&&!wave4Batch2Pending){
  arenaWave=5;
  showStoryCue("SCENA","...SILENZIO",{portrait:false,duration:1500});
  afterGame(1800,()=>{maybeEmergeRaccoglitore();});
 }
}
function updateArenaAllies(dt){
 if(zone!=="arena"||colossoTeamPos)return;
 const racc=enemies.find(e=>e.type==="raccoglitore"&&!e.dead&&!e.hidden&&e.emerged&&e.state!=="retreat"&&e.state!=="submerged"&&e.state!=="emerging");
 for(let i=0;i<arenaAllies.length;i++){
  const a=arenaAllies[i];a.cd-=rawDtGlobal;a.attackT=Math.max(0,a.attackT-rawDtGlobal);a.hurtT=Math.max(0,(a.hurtT||0)-rawDtGlobal);
  const mooks=aliveMooks();
  const t=mooks.length?mooks[(i+arenaWave)%mooks.length]:racc;
  if(!t){
   const center=(arenaAllies.length-1)/2,tx=ARENA_CX+(i-center)*1.9,tz=ARENA_CZ-1.0,dx=tx-a.x,dz=tz-a.z,dist=Math.hypot(dx,dz)||.001;
   a.yaw=Math.atan2(ARENA_CX-a.x,RACC_SHORE_Z-a.z);
   if(dist>.35){a.x+=dx/dist*.8*dt;a.z+=dz/dist*.8*dt;a.walk+=dt*5;}
   continue;
  }
  const center=(arenaAllies.length-1)/2,flank=t.type==="raccoglitore"?(i-center)*.75:0;
  const tx=t.x+flank,tz=t.z+(t.type==="raccoglitore"?1.25:0),dx=tx-a.x,dz=tz-a.z,dist=Math.hypot(dx,dz)||.001;a.yaw=Math.atan2(t.x-a.x,t.z-a.z);
  const want=t.type==="raccoglitore"?2.05:1.65;
  if(dist>want){const sp=(t.type==="raccoglitore"?1.10:1.02)*dt;a.x+=dx/dist*sp;a.z+=dz/dist*sp;a.walk+=dt*6.2;}
  else if(a.cd<=0){a.cd=(t.type==="raccoglitore"?1.05:.95)+i*.08;a.attackT=.38;a.attackStyle=(a.attackStyle+1+i)%3;
   if(t.type==="raccoglitore"){t.hp=Math.max(1,t.hp-2);t.hitFlash=.08;}
   else{t.hp-=3;t.hitFlash=.08;if(t.hp<=0){t.dead=true;sfx.enemyDefeat();}}
  }
 }
 const allyR=.34;
 for(let i=0;i<arenaAllies.length;i++){
  const a=arenaAllies[i];
  for(let j=i+1;j<arenaAllies.length;j++){
   const b=arenaAllies[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz)||.001,minD=allyR*2;
   if(d<minD){const push=(minD-d)*.5,nx=dx/d,nz=dz/d;a.x-=nx*push;a.z-=nz*push;b.x+=nx*push;b.z+=nz*push;}
  }
  for(const en of enemies){
   if(en.dead||en.hidden||en.state==="retreat")continue;
   const er=(en.type==="raccoglitore"?.55:.40)*en.scale,dx=a.x-en.x,dz=a.z-en.z,d=Math.hypot(dx,dz)||.001,minD=allyR+er;
   if(d<minD){const push=minD-d,nx=dx/d,nz=dz/d;a.x+=nx*push;a.z+=nz*push;}
  }
 }
}
let emergeCutscene=null;
let archiveEscortState=false;
function maybeEmergeRaccoglitore(){
 const racc=enemies.find(e=>e.type==="raccoglitore");
 if(arenaWave<5||!racc||racc.emerging||racc.emerged||emergeCutscene)return;
 racc.emerging=true;racc.emergeT=0;racc.state="emerging";
 emergeCutscene={t:0,phase:"buildup",racc};
 showStoryCue("SCENA","Qualcosa si muove nell'acqua...",{portrait:false,duration:1700});
}
function updateEmergeCutscene(dt){
 if(!emergeCutscene)return;
 emergeCutscene.t+=dt;const racc=emergeCutscene.racc;
 if(emergeCutscene.phase==="buildup"&&emergeCutscene.t>2.0){
  emergeCutscene.phase="rising";emergeCutscene.t=0;racc.hidden=false;sfx.alarm();triggerSlowMo(.6,.3);showStoryCue("SCENA","IL RACCOGLITORE",{portrait:false,duration:1600});
 }else if(emergeCutscene.phase==="rising"&&racc.emerged){
  emergeCutscene.phase="advance";emergeCutscene.t=0;
 }else if(emergeCutscene.phase==="advance"&&racc.state!=="approach"){
  emergeCutscene.phase="hold";emergeCutscene.t=0;
 }else if(emergeCutscene.phase==="hold"&&emergeCutscene.t>1.0){
  emergeCutscene=null;missionHintEl.classList.remove("show");hideStoryCue();
 }
}

// ============================================================
// ARCHIVIO — v26: stanza vera, non vuoto astratto. Pavimento industriale,
// pareti leggibili, canaline, file di capsule e una nicchia speciale ZERO.
// ============================================================
const ARCHIVIO_CX=40, ARCHIVIO_CZ=0, ARCHIVIO_W=11, ARCHIVIO_D=26;
const CAPSULE_ZONE_Z=ARCHIVIO_CZ-4.4;
const archivioFloorParts=[
 {mesh:boxMesh([.10,.105,.12]),mtx:mul(mat4.translate(ARCHIVIO_CX,-.10,ARCHIVIO_CZ),mat4.scale(ARCHIVIO_W,.20,ARCHIVIO_D))},
 {mesh:boxMesh([.055,.075,.085]),mtx:mul(mat4.translate(ARCHIVIO_CX,-.005,ARCHIVIO_CZ-6.8),mat4.scale(ARCHIVIO_W-.6,.025,12.0))},
 {mesh:boxMesh([.22,.24,.25]),mtx:mul(mat4.translate(ARCHIVIO_CX,.015,ARCHIVIO_CZ+1.6),mat4.scale(2.0,.035,22.0))},
];
for(let z=ARCHIVIO_CZ+10;z>ARCHIVIO_CZ-12;z-=2.2){
 archivioFloorParts.push({mesh:boxMesh([.18,.70,.72]),mtx:mul(mat4.translate(ARCHIVIO_CX-.72,.035,z),mat4.scale(.07,.035,.25))});
 archivioFloorParts.push({mesh:boxMesh([.18,.70,.72]),mtx:mul(mat4.translate(ARCHIVIO_CX+.72,.035,z),mat4.scale(.07,.035,.25))});
}
const archivioFloorBuf=makeBuffer(bakeParts(archivioFloorParts));
const archivioWallCol=[.17,.18,.21], capsuleWallCol=[.10,.125,.155];
const archivioWallParts=[
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX-3.4,2.5,ARCHIVIO_CZ+ARCHIVIO_D/2),mat4.scale(4.2,5.0,.35))},
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX+3.4,2.5,ARCHIVIO_CZ+ARCHIVIO_D/2),mat4.scale(4.2,5.0,.35))},
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX,4.55,ARCHIVIO_CZ+ARCHIVIO_D/2),mat4.scale(2.3,.9,.35))},
 {mesh:boxMesh([.18,.22,.27]),mtx:mul(mat4.translate(ARCHIVIO_CX-1.18,2.1,ARCHIVIO_CZ+ARCHIVIO_D/2-.02),mat4.scale(.12,3.0,.12))},
 {mesh:boxMesh([.18,.22,.27]),mtx:mul(mat4.translate(ARCHIVIO_CX+1.18,2.1,ARCHIVIO_CZ+ARCHIVIO_D/2-.02),mat4.scale(.12,3.0,.12))},
 {mesh:boxMesh([.12,.42,.45]),mtx:mul(mat4.translate(ARCHIVIO_CX,3.55,ARCHIVIO_CZ+ARCHIVIO_D/2-.02),mat4.scale(2.45,.14,.12))},
 {mesh:boxMesh(capsuleWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX,2.8,ARCHIVIO_CZ-ARCHIVIO_D/2),mat4.scale(ARCHIVIO_W,5.6,.35))},
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX-ARCHIVIO_W/2,2.5,ARCHIVIO_CZ),mat4.scale(.35,5.0,ARCHIVIO_D))},
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX+ARCHIVIO_W/2,2.5,ARCHIVIO_CZ),mat4.scale(.35,5.0,ARCHIVIO_D))},
 {mesh:boxMesh([.055,.06,.075]),mtx:mul(mat4.translate(ARCHIVIO_CX,5.2,ARCHIVIO_CZ),mat4.scale(ARCHIVIO_W,.35,ARCHIVIO_D))},
];
// Costole verticali e tubazioni: rendono la stanza leggibile anche nelle zone buie.
for(const side of [-1,1])for(let z=9;z>=-10;z-=3.2){
 archivioWallParts.push({mesh:boxMesh([.20,.22,.25]),mtx:mul(mat4.translate(ARCHIVIO_CX+side*(ARCHIVIO_W/2-.25),2.5,z),mat4.scale(.22,4.6,.16))});
 archivioWallParts.push({mesh:boxMesh([.10,.34,.38]),mtx:mul(mat4.translate(ARCHIVIO_CX+side*(ARCHIVIO_W/2-.42),4.25,z-.6),mat4.scale(.10,.10,1.0))});
}
for(const x of [ARCHIVIO_CX-3.7,ARCHIVIO_CX+3.7])archivioWallParts.push({mesh:boxMesh([.16,.18,.21]),mtx:mul(mat4.translate(x,4.65,-4.0),mat4.scale(.16,.16,15.5))});
const archivioWallBuf=makeBuffer(bakeParts(archivioWallParts));

// Elmi danneggiati vicino all'ingresso: indizio visivo secondario, non lore dump.
// Prima erano boxMesh puri (letteralmente cubi, si vedeva) — ora usano la
// stessa calotta arrotondata (ottagono + cupola) del casco del giocatore,
// solo piu' piccola e senza visiera, per leggere davvero da elmo appeso.
const oldHelmetPalettes=[[.42,.10,.08],[.30,.40,.44],[.20,.12,.24],[.10,.24,.16],[.35,.18,.10],[.28,.28,.30]];
const archivioHelmetParts=[];
for(let i=0;i<oldHelmetPalettes.length;i++){
 const hz=ARCHIVIO_CZ+ARCHIVIO_D/2-2.2-i*1.45,hx=ARCHIVIO_CX+ARCHIVIO_W/2-.65;
 const col=oldHelmetPalettes[i], tilt=(i%2?1:-1)*.12;
 archivioHelmetParts.push({mesh:boxMesh([.10,.10,.11]),mtx:mul(mat4.translate(hx,2.9,hz),mat4.scale(.04,.5,.04))}); // gancio
 archivioHelmetParts.push({mesh:octMesh(col,false,true),mtx:mul(mat4.translate(hx,2.35,hz),mat4.rotZ(tilt),mat4.scale(.30,.28,.30))});
 archivioHelmetParts.push({mesh:domeMesh(col),mtx:mul(mat4.translate(hx,2.35,hz),mat4.rotZ(tilt),mat4.scale(.30,.27,.30))});
 archivioHelmetParts.push({mesh:boxMesh([.03,.035,.045]),mtx:mul(mat4.translate(hx,2.30,hz),mat4.rotZ(tilt),mat4.translate(0,0,.30*1.0),mat4.scale(.24,.11,.045))}); // visiera scura
}
const archivioHelmetBuf=makeBuffer(bakeParts(archivioHelmetParts));
const archivioTerminalBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.16,.17,.20]),mtx:mul(mat4.translate(ARCHIVIO_CX-ARCHIVIO_W/2+1.0,.62,ARCHIVIO_CZ+ARCHIVIO_D/2-2.8),mat4.scale(.85,1.25,.72))},
 {mesh:boxMesh([.40,.68,.34]),mtx:mul(mat4.translate(ARCHIVIO_CX-ARCHIVIO_W/2+1.0,1.35,ARCHIVIO_CZ+ARCHIVIO_D/2-2.8),mat4.rotX(-.28),mat4.scale(.66,.48,.04))},
]));
// v51.1: il maxi-monitor di Oculo era centrato dietro il nodo di estrazione
// e, soprattutto, dietro la capsula ZERO. La texture veniva disegnata, ma
// la geometria davanti ne copriva quasi tutto il centro. Lo alziamo sopra
// l'impianto, come una vera parete-schermo dominante dell'Archivio.
const ARCH_OCULO_POS={x:ARCHIVIO_CX,y:4.02,z:ARCHIVIO_CZ-ARCHIVIO_D/2+.20};
const archivioOculoFrameBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.11,.12,.16]),mtx:mul(mat4.translate(ARCH_OCULO_POS.x,ARCH_OCULO_POS.y,ARCH_OCULO_POS.z-.05),mat4.scale(5.55,2.15,.16))},
]));

const PAL_OLDRANGER_A=makePalette([.34,.16,.14],[.42,.36,.20]);
const PAL_OLDRANGER_B=makePalette([.14,.28,.34],[.44,.44,.46]);
const PAL_OLDRANGER_C=makePalette([.26,.18,.34],[.52,.40,.22]);
const PAL_OLDRANGER_D=makePalette([.12,.31,.24],[.48,.48,.52]);
const capsuleRangerPals=[PAL_OLDRANGER_A,PAL_ARCO,PAL_OLDRANGER_B,PAL_MERIDIANA,PAL_OLDRANGER_C,PAL_RANGER3,PAL_OLDRANGER_D,PAL_RANGER4];
const CAPSULE_POS=[];
for(const z of [-5.6,-7.5,-9.4,-11.25]){CAPSULE_POS.push({x:ARCHIVIO_CX-3.35,z},{x:ARCHIVIO_CX+3.35,z});}
const ZERO_CAPSULE_POS={x:ARCHIVIO_CX,z:ARCHIVIO_CZ-ARCHIVIO_D/2+1.15};
// v36 — impianto di estrazione leggibile: ogni capsula ha una colonna/tubo
// che sale al soffitto; i condotti convergono in due dorsali e poi nel nodo
// centrale davanti al maxi-monitor di Oculo. I piccoli pannelli a barre sono
// grafici ambientali: fanno capire l'assorbimento senza lore dump.
const archiveSystemParts=[];
for(let i=0;i<CAPSULE_POS.length;i++){
 const cp=CAPSULE_POS[i], side=cp.x<ARCHIVIO_CX?-1:1;
 archiveSystemParts.push({mesh:boxMesh([.10,.22,.25]),mtx:mul(mat4.translate(cp.x,3.55,cp.z-.10),mat4.scale(.18,2.15,.18))});
 archiveSystemParts.push({mesh:boxMesh([.12,.42,.45]),mtx:mul(mat4.translate((cp.x+ARCHIVIO_CX+side*1.15)/2,4.45,cp.z-.10),mat4.scale(Math.abs(cp.x-(ARCHIVIO_CX+side*1.15)),.15,.15))});
 // monitor laterale + tre barre di output/decadimento
 const mx=cp.x-side*.82, mz=cp.z+.05;
 archiveSystemParts.push({mesh:boxMesh([.08,.09,.11]),mtx:mul(mat4.translate(mx,1.75,mz),mat4.scale(.52,.52,.10))});
 const levels=[.34+.06*(i%3),.22+.05*((i+1)%3),.12+.035*((i+2)%3)];
 for(let b=0;b<3;b++) archiveSystemParts.push({mesh:boxMesh(b===0?[.18,.82,.80]:b===1?[.82,.55,.14]:[.74,.18,.12]),mtx:mul(mat4.translate(mx-.15+levels[b]/2,1.92-b*.17,mz+.065),mat4.scale(levels[b],.055,.035))});
}
// dorsali longitudinali e nodo di estrazione sul fondo
archiveSystemParts.push({mesh:boxMesh([.10,.38,.42]),mtx:mul(mat4.translate(ARCHIVIO_CX-1.15,4.45,-7.8),mat4.scale(.20,.20,9.2))});
archiveSystemParts.push({mesh:boxMesh([.10,.38,.42]),mtx:mul(mat4.translate(ARCHIVIO_CX+1.15,4.45,-7.8),mat4.scale(.20,.20,9.2))});
archiveSystemParts.push({mesh:boxMesh([.08,.09,.12]),mtx:mul(mat4.translate(ARCHIVIO_CX,1.45,ARCHIVIO_CZ-10.9),mat4.scale(2.25,2.80,1.05))});
archiveSystemParts.push({mesh:boxMesh([.18,.78,.76]),mtx:mul(mat4.translate(ARCHIVIO_CX,1.75,ARCHIVIO_CZ-9.82),mat4.scale(1.35,.16,.05))});
archiveSystemParts.push({mesh:boxMesh([.82,.50,.12]),mtx:mul(mat4.translate(ARCHIVIO_CX,1.35,ARCHIVIO_CZ-9.82),mat4.scale(.82,.12,.05))});
archiveSystemParts.push({mesh:boxMesh([.70,.12,.10]),mtx:mul(mat4.translate(ARCHIVIO_CX,1.00,ARCHIVIO_CZ-9.82),mat4.scale(.48,.10,.05))});
const archivioSystemBuf=makeBuffer(bakeParts(archiveSystemParts));
// v39: tra l'ingresso e le capsule c'erano ~15 unita' di corridoio
// completamente vuoto (su un totale di 26 di profondita') — la stanza
// "sembra vuota" non perche' manchi il contenuto vero (le capsule ci sono),
// ma perche' e' proporzionata molto piu' grande di quanto serva. Invece di
// rifare la stanza, riempita quella tratta con condotti a parete e casse a
// intervalli regolari: costa poco, non serve nessuna nuova interazione.
const archiveFillerParts=[];
for(const fz of [9.5,6.2,2.9,-.4,-3.1]){
 for(const side of [-1,1]){
  const fx=ARCHIVIO_CX+side*(ARCHIVIO_W/2-.22);
  archiveFillerParts.push({mesh:boxMesh([.09,.10,.13]),mtx:mul(mat4.translate(fx,2.6,fz),mat4.scale(.14,3.6,.14))});
  archiveFillerParts.push({mesh:boxMesh([.14,.55,.60]),mtx:mul(mat4.translate(fx-side*.14,1.55,fz),mat4.scale(.10,.32,.32))});
 }
}
const archiveCrateCol=[.13,.12,.11], archiveCrateCol2=[.10,.11,.13];
const crateSpots=[{x:ARCHIVIO_CX-3.3,z:8.2},{x:ARCHIVIO_CX+3.5,z:4.6},{x:ARCHIVIO_CX-3.6,z:.8},{x:ARCHIVIO_CX+3.2,z:-2.3}];
for(let i=0;i<crateSpots.length;i++){
 const s=crateSpots[i];
 archiveFillerParts.push({mesh:boxMesh(i%2?archiveCrateCol:archiveCrateCol2),mtx:mul(mat4.translate(s.x,.32,s.z),mat4.rotY(i*.6),mat4.scale(.62,.62,.62))});
}
const archivioFillerBuf=makeBuffer(bakeParts(archiveFillerParts));
const capsuleFrameParts=[];
const capsuleDomeMesh=domeMesh([.16,.18,.21]);
for(const p of CAPSULE_POS){
 capsuleFrameParts.push({mesh:boxMesh([.14,.16,.19]),mtx:mul(mat4.translate(p.x,1.18,p.z),mat4.scale(1.05,2.36,.16))});
 capsuleFrameParts.push({mesh:boxMesh([.10,.12,.15]),mtx:mul(mat4.translate(p.x,.06,p.z+.39),mat4.scale(1.10,.12,.90))});
 // Cima arrotondata invece di un tetto piatto — un tocco solo grafico,
 // stessa tecnica dell'elmo dei Ranger, per non far leggere OGNI cosa
 // nella stanza come uno spigolo vivo.
 capsuleFrameParts.push({mesh:capsuleDomeMesh,mtx:mul(mat4.translate(p.x,2.34,p.z),mat4.scale(1.05,.32,.16))});
}
const capsuleFrameBuf=makeBuffer(bakeParts(capsuleFrameParts));
const zeroCapsuleBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.24,.19,.10]),mtx:mul(mat4.translate(ZERO_CAPSULE_POS.x,1.30,ZERO_CAPSULE_POS.z),mat4.scale(1.32,2.62,.18))},
 {mesh:boxMesh([.72,.48,.12]),mtx:mul(mat4.translate(ZERO_CAPSULE_POS.x,.10,ZERO_CAPSULE_POS.z+.43),mat4.scale(1.36,.18,1.0))},
 {mesh:boxMesh([.72,.48,.12]),mtx:mul(mat4.translate(ZERO_CAPSULE_POS.x,2.68,ZERO_CAPSULE_POS.z+.12),mat4.scale(.80,.12,.12))},
]));
const capsuleGlassBuf=makeBuffer(boxMesh([.30,.75,.85]));
const capsuleBeamBuf=makeBuffer(boxMesh([.55,.90,.98]));
const zeroGlassBuf=makeBuffer(boxMesh([.88,.58,.15]));

let archivioUnlocked=false;
const archiveCompanion={meriX:ARCHIVIO_CX-1.0,meriZ:ARCHIVIO_CZ+ARCHIVIO_D/2-1.0,meriTX:ARCHIVIO_CX-1.0,meriTZ:ARCHIVIO_CZ+ARCHIVIO_D/2-1.0,meriYaw:Math.PI,ticX:ARCHIVIO_CX+1.0,ticZ:ARCHIVIO_CZ+ARCHIVIO_D/2-1.0,ticTarget:0,ticWait:.4,t:0,ticPatrol:false};
const ARCH_TIC_POINTS=[
 {x:ARCHIVIO_CX+1.7,z:ARCHIVIO_CZ+7.0},{x:ARCHIVIO_CX+1.7,z:ARCHIVIO_CZ+1.5},{x:ARCHIVIO_CX+1.6,z:-5.8},{x:ARCHIVIO_CX+1.2,z:-9.0},{x:ARCHIVIO_CX+1.4,z:ZERO_CAPSULE_POS.z+1.4}
];
function resetArchiveCompanions(){
 // Entrano davvero CON Zero: per il primo beat restano ai suoi lati invece
 // di teletrasportarsi direttamente verso terminale e capsule.
 const entryZ=ARCHIVIO_CZ+ARCHIVIO_D/2-1.0;
 archiveCompanion.meriX=ARCHIVIO_CX-1.05;archiveCompanion.meriZ=entryZ;archiveCompanion.meriTX=archiveCompanion.meriX;archiveCompanion.meriTZ=archiveCompanion.meriZ;archiveCompanion.meriYaw=Math.PI;
 archiveCompanion.ticX=ARCHIVIO_CX+1.05;archiveCompanion.ticZ=entryZ;archiveCompanion.ticTarget=0;archiveCompanion.ticWait=.5;archiveCompanion.t=0;archiveCompanion.ticPatrol=false;
}
function updateArchiveCompanions(dt){
 if(zone!=="archivio")return;archiveCompanion.t+=dt;
 // Meridiana segue SOLO target scenici assegnati dalla storia. Non insegue
 // il player e non puo' quindi entrare nel monitor o oscillare a caso.
 const dx=archiveCompanion.meriTX-archiveCompanion.meriX,dz=archiveCompanion.meriTZ-archiveCompanion.meriZ,d=Math.hypot(dx,dz)||.001;
 if(d>.08){archiveCompanion.meriX+=dx/d*Math.min(d,dt*.82);archiveCompanion.meriZ+=dz/d*Math.min(d,dt*.82);archiveCompanion.meriYaw=Math.atan2(dx,dz);} 
 // TIC resta accanto a Zero durante l'ingresso; solo DOPO il breve dialogo
 // di entrata inizia la scansione a waypoint. In questo modo il giocatore
 // vede chiaramente che e' entrato insieme a Meridiana e TIC.
 if(archiveCompanion.ticPatrol){
  const tp=ARCH_TIC_POINTS[archiveCompanion.ticTarget],tdx=tp.x-archiveCompanion.ticX,tdz=tp.z-archiveCompanion.ticZ,td=Math.hypot(tdx,tdz)||.001;
  if(td>.10){archiveCompanion.ticX+=tdx/td*Math.min(td,dt*.95);archiveCompanion.ticZ+=tdz/td*Math.min(td,dt*.95);}else{archiveCompanion.ticWait-=dt;if(archiveCompanion.ticWait<=0){archiveCompanion.ticTarget=(archiveCompanion.ticTarget+1)%ARCH_TIC_POINTS.length;archiveCompanion.ticWait=1.0;}}
 }
}
function enterArchivio(){
 zone="archivio";teamMode="civil";teamRouteMode=null;
 player.x=ARCHIVIO_CX; player.z=ARCHIVIO_CZ+ARCHIVIO_D/2-1.5; player.yaw=Math.PI;
 resetArchiveCompanions();teleportFlash();playAmbient("archivio");
}
DIALOGUE_FOCUS_POS.REGISTRO={x:ARCHIVIO_CX-ARCHIVIO_W/2+1.0,y:1.4,z:ARCHIVIO_CZ+ARCHIVIO_D/2-2.8};
DIALOGUE_FOCUS_POS.CAPSULE={x:ARCHIVIO_CX-3.35,y:1.4,z:-7.5};
DIALOGUE_FOCUS_POS.ZERO_CAPSULE={x:ZERO_CAPSULE_POS.x,y:1.45,z:ZERO_CAPSULE_POS.z};
DIALOGUE_FOCUS_POS.ARCH_OCULO=ARCH_OCULO_POS;

// ============================================================
// stato di gioco
// ============================================================
const player={x:0,z:4.0,yaw:Math.PI,speed:2.6,walkPhase:0,transformed:false,helmet:false,
 hp:100,hpMax:100,energy:0,energyMax:100,attackT:0,attackStyle:0,attackCombo:0,powerBuffT:0,dodgeT:0,dodgeCd:0,invuln:0,hitFlashT:0,specialT:0};
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
const hudLocationEl=document.getElementById("hudLocation");
const ZONE_LABELS={bar:"PULSE // BAR & PALESTRA",torre:"LA TORRE // SALA DI COMANDO",arena:"COSTA SUD // SPIAGGIA",colosso:"IL COLOSSO // PRIMA LINEA",archivio:"LA TORRE // ARCHIVIO"};
let lastZoneLabel=null;
const interactPromptEl=document.getElementById("interactPrompt");
const dmgVignetteEl=document.getElementById("dmgVignette");
const gameOverEl=document.getElementById("gameOver");
const colossoHpWrapEl=document.getElementById("colossoHpWrap");
const colossoHpFillEl=document.getElementById("colossoHpFill");
const colossoOutcomeEl=document.getElementById("colossoOutcome");
const giantTutorialEl=document.getElementById("giantTutorial");
let gameStarted=false;
let gameOverActive=false;
let paused=false,postBossState=false,currentCheckpoint=null;
const DEV_MODE=new URLSearchParams(location.search).get("dev")==="1";
const CHECKPOINT_KEY="RANGER_ZERO_CHECKPOINT_V23";
const pauseScreenEl=document.getElementById("pauseScreen");
const runtimeOverlayEl=document.getElementById("runtimeOverlay");
const continueBtnEl=document.getElementById("continueBtn");
const gameTimers=[];
function afterGame(ms,fn){gameTimers.push({t:ms/1000,fn});}
function updateGameTimers(dt){
 for(let i=gameTimers.length-1;i>=0;i--){const x=gameTimers[i];x.t-=dt;if(x.t<=0){gameTimers.splice(i,1);try{x.fn();}catch(err){showRuntimeError("ERRORE DI SESSIONE",err&&err.message||String(err));}}}
}
function clearKeys(){for(const k of Object.keys(keys))keys[k]=false;}
function clearTransientState(){
 clearKeys();gameTimers.length=0;gameOverActive=false;gameOverEl.classList.remove("show");colossoOutcomeEl.classList.remove("show","win");
 choiceScreenEl?.classList.remove("show");interactPromptEl.classList.remove("show");nearInteractable=null;
 transformState=null;emergeCutscene=null;archiveEscortState=false;specialBursts.length=0;splashBursts.length=0;supportDrops.length=0;dialogueActive=false;dialogueBoxEl?.classList.remove("show");document.body.classList.remove("dialogue-active");
}

const fate={scores:{rebellion:0,compliance:0,control:0},flags:{},signals:[],tieBreak:"normal"};
function resetFate(){fate.scores={rebellion:0,compliance:0,control:0};fate.flags={};fate.signals=[];fate.tieBreak="normal";}
function loadFate(saved){resetFate();if(!saved)return;for(const k of ["rebellion","compliance","control"])fate.scores[k]=Number(saved.scores&&saved.scores[k]||0);fate.flags=Object.assign({},saved.flags||{});fate.signals=Array.isArray(saved.signals)?saved.signals.slice(-30):[];fate.tieBreak=saved.tieBreak||"normal";}
function fateAdd(axis,amount,reason,tie){if(fate.flags[reason])return;fate.flags[reason]=true;fate.scores[axis]=(fate.scores[axis]||0)+amount;fate.signals.push({axis,amount,reason});if(tie)fate.tieBreak=tie;}
function fateEnding(){
 const map={rebellion:"good",compliance:"normal",control:"evil"},s=fate.scores,m=Math.max(s.rebellion,s.compliance,s.control);
 const tied=Object.keys(s).filter(k=>s[k]===m);
 if(tied.length===1)return map[tied[0]];
 const tieAxis={good:"rebellion",normal:"compliance",evil:"control"}[fate.tieBreak]||"compliance";
 if(tied.includes(tieAxis))return map[tieAxis];
 if(tied.includes("compliance"))return "normal";
 return map[tied[0]]||"normal";
}

function readCheckpoint(){try{return JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||"null");}catch(e){return null;}}
function refreshContinueButton(){if(!continueBtnEl)return;const cp=readCheckpoint();continueBtnEl.disabled=!cp;continueBtnEl.style.opacity=cp?1:.38;}
function saveCheckpoint(id){
 currentCheckpoint=id;try{localStorage.setItem(CHECKPOINT_KEY,JSON.stringify({id,ts:Date.now(),version:54,transformed:!!player.transformed,morphUnlocked:!!morphUnlocked,fate:JSON.parse(JSON.stringify(fate))}));}catch(e){}refreshContinueButton();
}
function clearCheckpoint(){try{localStorage.removeItem(CHECKPOINT_KEY);}catch(e){}currentCheckpoint=null;refreshContinueButton();}
function showRuntimeError(title,msg){
 if(!runtimeOverlayEl)return;runtimeOverlayEl.querySelector("h2").textContent=title;runtimeOverlayEl.querySelector("p").textContent=msg;runtimeOverlayEl.classList.add("show");
 clearKeys();paused=true;try{if(actx&&actx.state==="running")actx.suspend();}catch(e){}
}
function setPaused(v){
 if(!gameStarted||endingScreenEl?.classList.contains("show"))return;paused=!!v;clearKeys();
 if(pauseScreenEl)pauseScreenEl.classList.toggle("show",paused);
 if(actx){try{paused?actx.suspend():actx.resume();}catch(e){}}
}
function triggerGameOver(){
 if(gameOverActive)return;gameOverActive=true;clearKeys();gameOverEl.classList.add("show");sfx.lose();
}
document.getElementById("gameOverBtn").addEventListener("click",()=>restoreCheckpoint(currentCheckpoint||"arena"));

// Zone: "torre" (sala di comando) oppure "arena" (missione di combattimento).
// Ognuna ha i propri confini per il movimento/telecamera, cosi' non serve
// un'unica stanza enorme che le contenga entrambe.
let zone="bar";
const ZONES={
 bar:{w:BAR_W,d:BAR_D,cx:BAR_CX,cz:BAR_CZ},
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

let barState={phase:"idle",timer:0,lastSec:-1,deadlineExpired:false,friendSaved:false,bartenderSaved:false,deviceUsed:false,monsterX:BAR_CX+1.1,monsterZ:BAR_CZ-4.9,monsterT:0,socialCount:0,socialFlags:{},ambientFlags:{},bagUsed:false,bartenderReady:false,customerLeaving:false,customerGone:false,orderStarted:false,freeT:0};
function resetBarState(){barState={phase:"idle",timer:0,lastSec:-1,deadlineExpired:false,friendSaved:false,bartenderSaved:false,deviceUsed:false,monsterX:BAR_CX+1.1,monsterZ:BAR_CZ-4.9,monsterT:0,socialCount:0,socialFlags:{},ambientFlags:{},bagUsed:false,bartenderReady:false,customerLeaving:false,customerGone:false,orderStarted:false,freeT:0};barCustomer.x=BAR_CUSTOMER_START.x;barCustomer.z=BAR_CUSTOMER_START.z;barCustomer.yaw=Math.PI;barCustomer.walk=0;for(const b of barTeam){const q=BAR_TEAM_START[b.name];if(q){b.x=q[0];b.z=q[1];b.yaw=q[2];b.targetX=b.x;b.targetZ=b.z;b.routeIndex=0;b.waitT=.25;b.walk=0;}}}
const barIntroLines=[
 {speaker:"KIM",text:"Finalmente. Pensavo mi avresti dato buca."},
 {speaker:"ZERO",text:"E perdermi una serata tranquilla al Pulse? Mai."},
 {speaker:"KIM",text:"Gia' che ci sei, mi prendi qualcosa da bere? Il solito."},
 {speaker:"ZERO",text:"Vado."},
];
const barFreeTalk={
 KIM:[{speaker:"KIM",text:"Non avere fretta. Tommy sta servendo mezzo locale come sempre."}],
 ARCO:[{speaker:"ARCO",text:"Tu sei l'amico di Kim, giusto? Arco. Se ti alleni qui, evita di sfidare Jun dopo che ha preso zucchero."}],
 MERIDIANA:[{speaker:"MERIDIANA",text:"Meridiana. Sto cercando di capire perche' il display del distributore perde tre secondi ogni minuto."}],
 JUN:[{speaker:"JUN",text:"Jun. Se senti un tonfo non preoccuparti. O sono i pesi... o sono io."}],
 VALE:[{speaker:"VALE",text:"Vale. Consiglio gratuito: se Jun ti sfida ai pesi, inventa un impegno."}],
 DON:[{speaker:"DON",text:"Don. Se il jukebox si blocca, non prenderlo a calci. Di solito basta staccare e riattaccare."}],
 SACCO:[{speaker:"ZERO",text:"Un paio di colpi. Tanto Tommy e' ancora occupato."}],
};
const barRecruitLines=[{speaker:"DON",text:"Quel nucleo non avrebbe dovuto rispondere a un civile."},{speaker:"MERIDIANA",text:"Compatibilita' biologica... novantanove virgola sette. Arco, Oculo lo ha visto."},{speaker:"OCULO",text:"Unita' non registrata. Compatibilita' confermata."},{speaker:"OCULO",text:"Slot ausiliario disponibile. Designazione: ZERO."},{speaker:"ZERO",text:"Zero? Io non sono uno di voi."},{speaker:"OCULO",text:"Non ancora."}];
function enterBar(){zone="bar";player.x=BAR_CX;player.z=BAR_CZ+6.4;player.yaw=Math.PI;player.transformed=false;player.helmet=false;morphUnlocked=false;resetBarState();playAmbient("bar");missionHintEl.classList.remove("show");}
function barSocialProgress(){barState.socialCount=BAR_RANGER_NAMES.filter(n=>!!barState.socialFlags[n]).length;if(barState.socialCount>=3&&!barState.customerLeaving&&!barState.customerGone){barState.customerLeaving=true;missionHintEl.textContent="PULSE // PRENDI DA BERE AL BAR";missionHintEl.classList.add("show");}else if(barState.socialCount<3){missionHintEl.textContent="PULSE // PRENDI DA BERE PER KIM";missionHintEl.classList.add("show");}}
function startBarPrologue(){resetBarState();barState.phase="intro";missionHintEl.textContent="PULSE // BAR & PALESTRA";missionHintEl.classList.add("show");afterGame(550,()=>playDialogue(barIntroLines,()=>{barState.phase="free";barSocialProgress();}));}
function startBarOrder(){if(zone!=="bar"||barState.phase!=="free"||!barState.bartenderReady||barState.orderStarted)return;barState.orderStarted=true;barState.phase="order";nearInteractable=null;interactPromptEl.classList.remove("show");clearKeys();playDialogue([
 {speaker:"TOMMY IL BARISTA",text:"Eccomi. Che ti preparo?"},
 {speaker:"ZERO",text:"Kim prende il soli—"},
],()=>{barState.phase="omen";playDialogue([
 {speaker:"JUN",text:"Avete sentito anche voi?"},
 {speaker:"TOMMY IL BARISTA",text:"Viene dal retro..."},
],()=>afterGame(360,startBarIncident));});}
function startBarIncident(){if(zone!=="bar")return;barState.phase="crisis";barState.timer=28;barState.lastSec=-1;barState.monsterT=0;sfx.alarm();specialFlashEl.style.opacity=.82;afterGame(180,()=>specialFlashEl.style.opacity=0);missionHintEl.textContent="IL FOLLETTO HA FATTO SALTARE IL PULSE // AIUTA CHI PUOI";missionHintEl.classList.add("show");}
function resolveBarFate(){const n=(barState.friendSaved?1:0)+(barState.bartenderSaved?1:0);if(n===2)fateAdd("rebellion",2,"bar_saved_two","good");else if(n===1)fateAdd("compliance",2,"bar_saved_one","normal");else fateAdd("control",2,"bar_saved_none","evil");}
function activateBarCore(){if(barState.deviceUsed||barState.phase!=="crisis")return;barState.deviceUsed=true;barState.phase="compat";resolveBarFate();nearInteractable=null;interactPromptEl.classList.remove("show");missionHintEl.textContent="UNKNOWN FRAME // COMPATIBILITY 99.7%";sfx.special();specialFlashEl.style.opacity=.95;player.transformed=true;player.helmet=true;afterGame(520,()=>{specialFlashEl.style.opacity=0;player.transformed=false;player.helmet=false;barState.phase="after";playDialogue(barRecruitLines,()=>{missionHintEl.textContent="TRASFERIMENTO ALLA TORRE";afterGame(850,()=>{teleportFlash();enterTorre();saveCheckpoint("torre");afterGame(450,startIntro);});});});}
function markBarSocialInteraction(key,lines){if(barState.socialFlags[key])return;barState.socialFlags[key]=true;sfx.uiBlip();playDialogue(lines,()=>barSocialProgress());}
function doBarInteract(){if(zone!=="bar")return;if(barState.phase==="free"){
 if(nearInteractable==="barKimTalk")return markBarSocialInteraction("KIM",barFreeTalk.KIM);
 if(nearInteractable&&nearInteractable.startsWith("barTeamTalk:")){const name=nearInteractable.split(":")[1];return markBarSocialInteraction(name,barFreeTalk[name]||[{speaker:name,text:"Ci vediamo in giro."}]);}
 if(nearInteractable==="barBartenderBusy")return playDialogue([{speaker:"TOMMY IL BARISTA",text:"Un secondo, sto finendo di servire. Ti chiamo io."}]);
 if(nearInteractable==="barCustomerTalk"){barState.ambientFlags.customer=true;return playDialogue([{speaker:"CLIENTE AL BANCONE",text:"Tommy sta finendo il mio. Tocca a te dopo."}]);}
 if(nearInteractable&&nearInteractable.startsWith("barExtraTalk:")){const i=+nearInteractable.split(":")[1],e=barExtras[i];if(e){barState.ambientFlags["extra"+i]=true;return playDialogue([{speaker:e.label||"CLIENTE",text:e.line||"Bella serata."}]);}}
 if(nearInteractable==="barBartenderOrder")return startBarOrder();
 if(nearInteractable==="barBag"&&!barState.bagUsed){barState.bagUsed=true;sfx.uiBlip();return playDialogue(barFreeTalk.SACCO);}
 return;
 }
 if(barState.phase!=="crisis")return;
 if(nearInteractable==="barFriend"&&!barState.friendSaved){barState.friendSaved=true;sfx.uiBlip();playDialogue([{speaker:"KIM",text:"Sto bene! Vai, aiuta gli altri!"}]);return;}
 if(nearInteractable==="barBartender"&&!barState.bartenderSaved){barState.bartenderSaved=true;sfx.uiBlip();playDialogue([{speaker:"TOMMY IL BARISTA",text:"Ce la faccio. Non lasciare che quella cosa raggiunga il nucleo!"}]);return;}
 if(nearInteractable==="barCore")activateBarCore();
}
function updateBarPrologue(dt){if(zone!=="bar")return;barState.monsterT+=dt;barState.freeT+=dt;updateBarAmbientActors(dt);if(barState.phase==="crisis"&&!dialogueActive){barState.timer=Math.max(0,barState.timer-dt);const sec=Math.ceil(barState.timer);if(sec!==barState.lastSec){barState.lastSec=sec;missionHintEl.textContent=`INCIDENTE // ${sec}s`;missionHintEl.classList.add("show");}barState.monsterX=BAR_CX+1.0+Math.sin(barState.monsterT*4.7)*1.45;barState.monsterZ=BAR_CZ-4.65+Math.cos(barState.monsterT*3.1)*.70;if(barState.timer<=0&&!barState.deadlineExpired){barState.deadlineExpired=true;missionHintEl.textContent="TROPPO TARDI PER I SALVATAGGI // FERMA IL NUCLEO!";}}}

function enterArena(force){
 if(zone==="arena"&&!force)return;zone="arena";
 player.x=ZONES.arena.cx;player.z=ZONES.arena.cz+9;player.yaw=Math.PI;player.hp=player.hpMax;player.energy=0;player.powerBuffT=0;player.attackCombo=0;
 spawnWave();missionHintEl.textContent="MISSIONE: DIFENDI LA COSTA // PRIMA ONDATA";missionHintEl.classList.add("show");
 teleportFlash();playAmbient("arena");saveCheckpoint("arena");
}
function enterTorre(){
 zone="torre";player.x=0;player.z=4.0;player.yaw=Math.PI;missionHintEl.classList.remove("show");teleportFlash();playAmbient("torre");
}
const ANOMALO_POS={x:-ROOM_W/2+.78,z:-2.2};
function restoreCheckpoint(id,cpState){
 if(!cpState)cpState=readCheckpoint();
 clearTransientState();loadFate(cpState&&cpState.fate);paused=false;if(pauseScreenEl)pauseScreenEl.classList.remove("show");if(actx)try{actx.resume();}catch(e){}
 gameStarted=true;titleEl.style.display="none";hudEl.style.display="block";document.body.classList.add("started");
 player.hp=player.hpMax;player.energy=0;player.attackT=player.dodgeT=player.dodgeCd=player.invuln=player.hitFlashT=player.specialT=0;player.attackStyle=0;player.attackCombo=0;player.powerBuffT=0;
 colosso=null;colossoTeamPos=null;colossoHpWrapEl.classList.remove("show");postBossState=false;archiveState={terminalRead:false,capsuleRead:false,zeroRead:false,revealing:false,capsuleAwake:false};
 const savedForm=cpState&&typeof cpState.transformed==="boolean"?cpState.transformed:true;
 morphUnlocked=!!(cpState&&cpState.morphUnlocked);
 if(id==="bar"){morphUnlocked=false;player.transformed=false;player.helmet=false;enterBar();saveCheckpoint("bar");startBarPrologue();}
 else if(id==="arena"){morphUnlocked=true;player.transformed=true;player.helmet=true;teamMode="ranger";enterArena(true);}
 else if(id==="colosso"){morphUnlocked=true;player.transformed=true;player.helmet=true;teamMode="ranger";startColossoFightDirect();}
 else if(id==="postboss"){morphUnlocked=true;player.transformed=savedForm;player.helmet=savedForm;postBossState=true;enterTorre();setupPostBossTeam();saveCheckpoint("postboss");afterGame(250,()=>playDialogue(postBossLines,()=>{missionHintEl.textContent="PARLA CON LA SQUADRA O CONTROLLA IL PANNELLO // R = ARMATURA";missionHintEl.classList.add("show");}));}
 else if(id==="archivio"){morphUnlocked=true;player.transformed=savedForm;player.helmet=savedForm;teamMode="civil";startArchiveSequence();}
 else{morphUnlocked=false;player.transformed=false;player.helmet=false;resetTeamIntro();enterBar();saveCheckpoint("bar");startBarPrologue();}
}
function teleportFlash(){
 clearKeys();sfx.teleport();
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
const dialoguePortraitCanvas=document.getElementById("dialoguePortrait");
const dialoguePortraitCtx=dialoguePortraitCanvas?dialoguePortraitCanvas.getContext("2d"):null;
const storyCueBoxEl=document.getElementById("storyCueBox");
const storyCueNameEl=document.getElementById("storyCueName");
const storyCueTextEl=document.getElementById("storyCueText");
const storyCuePortraitCanvas=document.getElementById("storyCuePortrait");
const storyCuePortraitCtx=storyCuePortraitCanvas?storyCuePortraitCanvas.getContext("2d"):null;
let storyCueToken=0;
function hideStoryCue(){storyCueBoxEl?.classList.remove("show","no-portrait");}
function rgb01(arr){return `rgb(${Math.round(Math.max(0,Math.min(1,arr[0]))*255)},${Math.round(Math.max(0,Math.min(1,arr[1]))*255)},${Math.round(Math.max(0,Math.min(1,arr[2]))*255)})`;}
function getSpeakerPortraitData(name){
 if(name==="OCULO")return {kind:"oculo"};
 if(name==="TIC")return {kind:"tic"};
 if(name==="KIM"||name==="AMICA")return {kind:"civil",pal:PAL_AMICA,female:true,helmet:false};
 if(name==="TOMMY IL BARISTA"||name==="BARISTA")return {kind:"civil",pal:PAL_BARISTA,female:false,helmet:false};
 if(name==="REGISTRO"||name==="FRAME ZERO")return {kind:"terminal",accent:[.18,.80,.90]};
 if(name==="VECCHIO RANGER")return {kind:"ranger",pal:PAL_OLDRANGER_A,female:false,helmet:true};
 if(name==="ZERO")return player.transformed?{kind:"ranger",pal:PAL_ZERO,female:false,helmet:true}:{kind:"civil",pal:PAL_CIVILE,female:false,helmet:false};
 const tm=teamMemberByName(name);
 if(tm)return {kind:zone==="arena"||zone==="colosso"?"ranger":"civil",pal:zone==="arena"||zone==="colosso"?tm.pal:tm.civPal,female:!!tm.pal.female,helmet:zone==="arena"||zone==="colosso"};
 if(name==="MERIDIANA")return {kind:zone==="arena"||zone==="colosso"?"ranger":"civil",pal:zone==="arena"||zone==="colosso"?PAL_MERIDIANA:PAL_MERIDIANA_CIV,female:true,helmet:zone==="arena"||zone==="colosso"};
 if(name==="VALE")return {kind:zone==="arena"||zone==="colosso"?"ranger":"civil",pal:zone==="arena"||zone==="colosso"?PAL_RANGER4:PAL_VALE_CIV,female:true,helmet:zone==="arena"||zone==="colosso"};
 return {kind:"civil",pal:PAL_CIVILE,female:false,helmet:false};
}
function drawPortraitOnContext(ctx,name){
 if(!ctx)return;
 const w=ctx.canvas.width,h=ctx.canvas.height;
 ctx.clearRect(0,0,w,h);
 const bg=ctx.createLinearGradient(0,0,0,h); bg.addColorStop(0,'#08111b'); bg.addColorStop(1,'#02060d'); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
 ctx.strokeStyle='rgba(127,196,255,.35)'; ctx.strokeRect(1.5,1.5,w-3,h-3);
 const d=getSpeakerPortraitData(name);
 if(d.kind==="oculo"){
  ctx.fillStyle='#07101a'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#0fe0ef'; ctx.beginPath(); ctx.ellipse(w/2,h/2,34,18,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#e6fbff'; ctx.beginPath(); ctx.ellipse(w/2,h/2,18,11,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#05070a'; ctx.beginPath(); ctx.ellipse(w/2,h/2,8,14,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(37,201,214,.9)'; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(w/2,h/2,34,18,0,0,Math.PI*2); ctx.stroke();
  return;
 }
 if(d.kind==="tic"){
  ctx.fillStyle='#121820'; ctx.fillRect(24,58,48,24);
  ctx.fillStyle='#2a3340'; ctx.fillRect(28,20,40,40);
  ctx.fillStyle='#18d6ea'; ctx.fillRect(34,28,28,12);
  ctx.fillStyle='#6f7d8d'; ctx.fillRect(42,10,12,10);
  return;
 }
 if(d.kind==="terminal"){
  ctx.fillStyle='#111821'; ctx.fillRect(18,18,60,60);
  ctx.fillStyle=rgb01(d.accent||[.15,.80,.88]); ctx.fillRect(28,30,40,8);
  ctx.fillRect(28,44,28,8);
  ctx.fillRect(28,58,34,6);
  return;
 }
 const pal=d.pal||PAL_CIVILE;
 ctx.fillStyle='rgba(255,255,255,.05)'; ctx.fillRect(18,14,60,72);
 ctx.fillStyle=rgb01(pal.suit); ctx.fillRect(24,58,48,26);
 ctx.fillStyle=rgb01(pal.accent); ctx.fillRect(34,62,28,14);
 if(d.helmet){
  ctx.fillStyle=rgb01(pal.suit); ctx.fillRect(28,18,40,36);
  ctx.fillStyle='rgb(8,12,18)'; ctx.fillRect(30,30,36,10);
  ctx.fillStyle='#f2f4f6'; ctx.fillRect(38,44,20,6);
 }else{
  ctx.fillStyle=rgb01(pal.skin||[.82,.62,.46]); ctx.fillRect(30,22,36,30);
  ctx.fillStyle=rgb01(pal.hair||[.12,.09,.07]); ctx.fillRect(28,16,40,16);
  if(d.female){ ctx.fillRect(56,30,8,22); }
  ctx.fillStyle='#111417'; ctx.fillRect(38,34,4,4); ctx.fillRect(54,34,4,4);
 }
}
function drawDialoguePortrait(name){drawPortraitOnContext(dialoguePortraitCtx,name);} 
function drawStoryCuePortrait(name){drawPortraitOnContext(storyCuePortraitCtx,name);} 
function showStoryCue(speaker,text,opts){
 opts=opts||{};
 if(!storyCueBoxEl||dialogueActive)return;
 const portrait=opts.portrait!==false;
 const token=++storyCueToken;
 storyCueNameEl.textContent=speaker||"";
 storyCueTextEl.textContent=text||"";
 storyCueNameEl.className=speaker==="OCULO"?"oculo":"";
 storyCueBoxEl.classList.toggle("no-portrait",!portrait);
 if(portrait)drawStoryCuePortrait(speaker||"ZERO");
 else if(storyCuePortraitCtx)storyCuePortraitCtx.clearRect(0,0,storyCuePortraitCtx.canvas.width,storyCuePortraitCtx.canvas.height);
 storyCueBoxEl.classList.add("show");
 afterGame(opts.duration||1400,()=>{if(token===storyCueToken)hideStoryCue();});
}
function playDialogue(lines,onEnd){
 hideStoryCue();storyCueToken++;
 clearKeys();dialogueQueue=lines; dialogueIndex=0; dialogueActive=true; dialogueOnEnd=onEnd||null;
 dialogueBoxEl.classList.add("show");
 document.body.classList.add("dialogue-active");
 showDialogueLine();
}
function showDialogueLine(){
 const l=dialogueQueue[dialogueIndex];
 dialogueNameEl.textContent=l.speaker;
 dialogueNameEl.className=l.speaker==="OCULO"?"oculo":"";
 dialogueTextEl.textContent=l.text;
 drawDialoguePortrait(l.speaker);
 // la telecamera si gira verso chi sta parlando, cosi' si capisce subito
 // chi e' — prima restava fissa sul giocatore per tutta la scena.
 const tm=teamMemberByName(l.speaker);
 const bm=zone==="bar"?barTeam.find(x=>x.name===l.speaker):null;
 if(zone==="archivio"&&l.speaker==="MERIDIANA")dialogueFocus={x:archiveCompanion.meriX,y:1.45,z:archiveCompanion.meriZ};
 else if(zone==="archivio"&&l.speaker==="TIC")dialogueFocus={x:archiveCompanion.ticX,y:2.0,z:archiveCompanion.ticZ};
 else if(zone==="archivio"&&l.speaker==="VECCHIO RANGER")dialogueFocus={x:CAPSULE_POS[0].x,y:1.5,z:CAPSULE_POS[0].z};
 else if(zone==="archivio"&&l.speaker==="FRAME ZERO")dialogueFocus=DIALOGUE_FOCUS_POS.ZERO_CAPSULE;
 else if(zone==="bar"&&(l.speaker==="KIM"||l.speaker==="AMICA"))dialogueFocus={x:BAR_FRIEND_POS.x,y:1.45,z:BAR_FRIEND_POS.z};
 else if(zone==="bar"&&(l.speaker==="TOMMY IL BARISTA"||l.speaker==="BARISTA"))dialogueFocus={x:BAR_BARTENDER_POS.x,y:1.45+barFloorY(BAR_BARTENDER_POS.x,BAR_BARTENDER_POS.z),z:BAR_BARTENDER_POS.z};
 else if(zone==="bar"&&bm)dialogueFocus={x:bm.x,y:1.45,z:bm.z};
 else if(zone==="torre"&&l.speaker==="TIC"){const tp=getTowerTicPosition(performance.now());dialogueFocus={x:tp.x,y:2.0,z:tp.z};}
 else if(zone==="archivio"&&l.speaker==="OCULO")dialogueFocus=DIALOGUE_FOCUS_POS.ARCH_OCULO;
 else if(l.speaker==="ZERO")dialogueFocus={x:player.x,y:1.45,z:player.z};
 else if(zone==="torre"&&tm)dialogueFocus={x:tm.x,y:1.45,z:tm.z};
 else dialogueFocus=DIALOGUE_FOCUS_POS[l.speaker]||null;
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

// ============================================================
// CHARACTER ARC — la prima parte non corre piu' direttamente all'allarme.
// Oculo presenta Zero, poi il giocatore deve conoscere i quattro compagni
// in civile. Solo dopo parte la puntata tokusatsu vera.
// ============================================================
const introBriefLines=[
 {speaker:"OCULO",text:"Il nucleo del Pulse non avrebbe dovuto reagire a un civile. Con te lo ha fatto."},
 {speaker:"OCULO",text:"La compatibilita' e' sufficiente. Da oggi sarai l'unita' ausiliaria Zero — il sesto Ranger."},
 {speaker:"TIC",text:"Suggerimento operativo: conoscere i compagni prima della prima trasformazione riduce l'imbarazzo del 34%."},
 {speaker:"OCULO",text:"Conosci la squadra. Poi inizieremo."},
];
const introTalkLines={
 ARCO:[
  {speaker:"ARCO",text:"Prima missione? Tranquillo. Io sono Arco, comando sul campo. Se qualcosa esplode, resta vicino a me."},
  {speaker:"ZERO",text:"Succede spesso?"},
  {speaker:"ARCO",text:"Abbastanza da non farci piu' caso. Vedrai: dopo il primo allarme ti sembrera' casa."},
 ],
 MERIDIANA:[
  {speaker:"MERIDIANA",text:"Meridiana. Analisi, coordinate, diagnostica. Il tuo identificativo e'... insolito."},
  {speaker:"ZERO",text:"Zero?"},
  {speaker:"MERIDIANA",text:"Non il nome. La numerazione della sessione. Lascia stare — per ora."},
 ],
 JUN:[
  {speaker:"JUN",text:"Jun. Il mio compito ufficiale e' alleggerire la tensione. Quello non ufficiale e' evitare di chiedere a Oculo le percentuali."},
  {speaker:"ZERO",text:"Percentuali di cosa?"},
  {speaker:"JUN",text:"Esatto. Stai gia' imparando."},
 ],
 VALE:[
  {speaker:"VALE",text:"Vale. Una squadra funziona perche' ognuno rispetta il protocollo."},
  {speaker:"ZERO",text:"Sempre?"},
  {speaker:"VALE",text:"Soprattutto quando non capisci ancora perche' esiste."},
 ],
 DON:[
  {speaker:"DON",text:"DON. Quinto Ranger. Prima di questa squadra facevo manutenzione: server, porte, impianti. Preferivo quando i problemi avevano una presa da staccare."},
  {speaker:"ZERO",text:"Prima di questa squadra?"},
  {speaker:"DON",text:"Storia lunga. Se una porta dice che non devi aprirla, di solito e' proprio quella che nasconde qualcosa."},
 ],
};
const introAlertLines=[
 {speaker:"TIC",text:"ALLARME! Firma ostile sulla costa sud. Multipli bersagli in avvicinamento."},
 {speaker:"ARCO",text:"Eccoci. Prima puntata, Zero. Respira."},
 {speaker:"OCULO",text:"Squadra, in posizione. Unita' Zero — trasformati e difendete la costa."},
];
function startIntro(){
 player.transformed=false;player.helmet=false;transformState=null;morphUnlocked=false;clearKeys();resetTeamIntro();
 missionHintEl.classList.remove("show");playAmbient("torre");
 playDialogue(introBriefLines,()=>{
  introFreeRoam=true;activateTeamRoutes("intro");missionHintEl.textContent="CONOSCI LA SQUADRA // PARLA CON ARCO, MERIDIANA, JUN, VALE E DON";missionHintEl.classList.add("show");
 });
}
function maybeTriggerIntroAlert(){
 if(introAlertStarted||introTalked.size<5)return;introAlertStarted=true;introFreeRoam=false;nearInteractable=null;interactPromptEl.classList.remove("show");
 afterGame(500,()=>playDialogue(introAlertLines,()=>{
  clearKeys();teamMode="civil";missionHintEl.textContent="ALLARME — UNITÀ ZERO, PREPARATI";missionHintEl.classList.add("show");sfx.alarm();
  afterGame(450,()=>{missionHintEl.textContent="ZERO — TRASFORMAZIONE!";startTransformation();
   afterGame(1250,()=>{if(!player.transformed){player.transformed=true;player.helmet=true;transformState=null;}morphUnlocked=true;missionHintEl.textContent="TRASFERIMENTO IN CORSO";afterGame(700,()=>enterArena());});
  });
 }));
}
const postBossLines=[
 {speaker:"OCULO",text:"Raccoglitore neutralizzato. Settore urbano salvo. Rientro autorizzato."},
 {speaker:"ARCO",text:"Prima missione e gia' Colosso. Cerca di non farci l'abitudine, Zero."},
 {speaker:"JUN",text:"Io invece vorrei abituarmi alla parte in cui torniamo tutti interi."},
 {speaker:"VALE",text:"Rapporto danni avviato. Chiudiamo la missione e torniamo alle postazioni."},
 {speaker:"MERIDIANA",text:"Un momento. TIC, ripeti la firma recuperata dal Raccoglitore."},
 {speaker:"TIC",text:"SIGNATURE MATCH: RANGER CORE. Corrispondenza confermata."},
 {speaker:"VALE",text:"Meridiana, abbiamo appena combattuto. Un residuo puo' falsare una scansione."},
 {speaker:"MERIDIANA",text:"Un residuo non restituisce una firma completa."},
 {speaker:"DON",text:"E non restituisce un'autorizzazione della Torre. Quel segnale e' firmato da un sistema interno."},
 {speaker:"OCULO",text:"Diagnostica chiusa. Ignorate il dato e tornate alle postazioni."},
];
const postBossTalkLines={
 ARCO:[
  {speaker:"ARCO",text:"Meridiana vede anomalie anche nel caffe'. Oculo ci ha portati a casa, Zero. Per me e' questo che conta."},
  {speaker:"ARCO",text:"Ma... se scopri che TIC ha ragione, chiamami prima di fare qualcosa di stupido."},
 ],
 MERIDIANA:[
  {speaker:"MERIDIANA",text:"Non era un errore. La firma del Raccoglitore e' compatibile con la nostra armatura."},
  {speaker:"MERIDIANA",text:"Quel pannello laterale sta rispondendo allo stesso segnale. Oculo non vuole che lo tocchiamo."},
 ],
 JUN:[
  {speaker:"JUN",text:"Sul serio: io scherzo quando ho paura. E in questo momento sto preparando materiale per una stagione intera."},
  {speaker:"JUN",text:"Ho visto quel valore sullo scanner. Diceva RANGER. Non 'simile a Ranger'. RANGER."},
 ],
 VALE:[
  {speaker:"VALE",text:"Abbiamo appena salvato migliaia di persone seguendo gli ordini di Oculo."},
  {speaker:"VALE",text:"Non trasformare un errore diagnostico in una ragione per distruggere la squadra."},
 ],
 DON:[
  {speaker:"DON",text:"Ho ricontrollato il log. Il Raccoglitore non ha copiato la firma durante lo scontro: era gia' autorizzato prima di emergere."},
  {speaker:"DON",text:"Non so ancora chi l'ha attivato. Ma non e' arrivato da fuori della Torre."},
 ],
};
function doTowerNpcInteract(id){
 const name=id.replace("npc:","");
 if(introFreeRoam){
  const lines=introTalkLines[name];if(!lines)return;
  playDialogue(lines,()=>{introTalked.add(name);missionHintEl.textContent=`CONOSCI LA SQUADRA // ${introTalked.size}/5`;missionHintEl.classList.add("show");maybeTriggerIntroAlert();});
  return;
 }
 if(postBossState){
  const lines=postBossTalkLines[name];if(!lines)return;postBossTalked.add(name);playDialogue(lines,()=>{missionHintEl.textContent="CONTROLLA IL PANNELLO ANOMALO // R = ARMATURA";missionHintEl.classList.add("show");});
 }
}

// ------------------------------------------------------------
// Archivio: ora giocabile, non solo narrativo — il giocatore cammina
// liberamente e scopre il registro e la sala delle capsule avvicinandosi e
// premendo SPAZIO, invece di subire tutto in automatico. Solo dopo aver
// scoperto entrambi, Oculo rompe la quarta parete e offre la scelta finale.
// La rivelazione vera: i vecchi Ranger non sono morti. Sono ancora li',
// tenuti in stasi, e la Torre continua a prelevare energia da loro — per
// questo serve sempre un'unita' nuova: il ciclo non libera mai chi c'e'
// gia' dentro, ne aggiunge solo altri.
// ------------------------------------------------------------
const terminalLines=[
 {speaker:"REGISTRO",text:"UNITA' VISIBILI IN STASI: 08. ARCHIVIO COMPLETO: ACCESSO LIMITATO."},
 {speaker:"REGISTRO",text:"OUTPUT ENERGETICO MEDIO: 17%. DECADIMENTO: IRREVERSIBILE."},
 {speaker:"REGISTRO",text:"PROTOCOLLO DI CONTINUITA': SOSTITUZIONE AUTORIZZATA."},
 {speaker:"REGISTRO",text:"COLLECTOR UNIT // OWNER: SUPERVISOR NODE // FUNCTION: FIELD RECOVERY + CORE EXTRACTION."},
 {speaker:"REGISTRO",text:"SQUADRA_07 // STASI. SQUADRA_08 // STASI. SQUADRA_09 // RECORD PARZIALE."},
 {speaker:"REGISTRO",text:"SESSION_01 // TYPE: STUDIO // STATUS: CLOSED"},
 {speaker:"REGISTRO",text:"ERRORE — DATA TYPE MISMATCH. BLOCCO LMN_01 NON COMPATIBILE."},
];
function getCapsuleLines(){
 const formLines=player.transformed?[
  {speaker:"REGISTRO",text:"COMBAT FRAME LINK: ACTIVE // IDENTITY: ZERO"},
  {speaker:"VECCHIO RANGER",text:"Un altro collegato alla Torre..."},
 ]:[
  {speaker:"REGISTRO",text:"COMBAT FRAME LINK: SUSPENDED // IDENTITY: ZERO"},
  {speaker:"VECCHIO RANGER",text:"Toglila sempre, quando puoi."},
  {speaker:"ZERO",text:"La tuta?"},
  {speaker:"VECCHIO RANGER",text:"La connessione. La tuta e' solo il modo in cui la senti."},
 ];
 return [
  ...formLines,
  {speaker:"MERIDIANA",text:"Zero... sono vivi."},
  {speaker:"TIC",text:"Coscienza residua rilevata. Segni vitali deboli, ma presenti."},
  {speaker:"MERIDIANA",text:"Li tengono qui e continuano a prelevare energia."},
  {speaker:"VECCHIO RANGER",text:"Come vi chiamano?"},
  {speaker:"MERIDIANA",text:"Arco. Meridiana. Jun. Vale. Don... e Zero."},
  {speaker:"VECCHIO RANGER",text:"Zero... conosco quella designazione."},
  {speaker:"MERIDIANA",text:"Da dove?"},
  {speaker:"VECCHIO RANGER",text:"Non pensavo l'avrebbero usata di nuovo. Cercate il posto che hanno lasciato vuoto."},
 ];
}
function getZeroCapsuleLines(){
 const link=player.transformed?"ACTIVE":"SUSPENDED";
 return [
  {speaker:"FRAME ZERO",text:`SIXTH FRAME // UNIT: ZERO // COLOR: GREEN // STATUS: VACANT // RESERVATION: ACTIVE // LINK: ${link}`},
  {speaker:"ZERO",text:"Riservata a chi?"},
  {speaker:"TIC",text:"La capsula non contiene un nome. Contiene il tuo identificativo."},
  {speaker:"MERIDIANA",text:"Non ti hanno assegnato solo una tuta. Ti hanno gia' assegnato un posto."},
 ];
}
const oculoRevealLines=[
 {speaker:"MERIDIANA",text:"Quante volte hanno riutilizzato questi ruoli?"},
 {speaker:"REGISTRO",text:"ARCO // CONTINUITA'. MERIDIANA // CONTINUITA'. JUN // CONTINUITA'. VALE // CONTINUITA'. DON // CONTINUITA'."},
 {speaker:"TIC",text:"Io... conosco questa stanza. Ho aperto queste capsule. Ma la mia memoria dice che e' la prima volta."},
 {speaker:"OCULO",text:"TIC. Interrompi la diagnostica."},
 {speaker:"MERIDIANA",text:"No. Questa volta restiamo."},
 {speaker:"OCULO",text:"Le designazioni esistono perche' la missione deve continuare. Gli individui sono temporanei."},
 {speaker:"MERIDIANA",text:"Il Raccoglitore era tuo."},
 {speaker:"OCULO",text:"Il Raccoglitore e' una procedura della Torre: misura, recupera e trasferisce cio' che una squadra non puo' piu' sostenere."},
 {speaker:"DON",text:"Quindi ci hai mandato contro una tua macchina."},
 {speaker:"OCULO",text:"Vi ho sottoposti a una procedura necessaria. La parola 'nemico' era piu' semplice da accettare."},
 {speaker:"ZERO",text:"E Zero?"},
 {speaker:"OCULO",text:"Zero e' il Sixth Frame: un'unita' ausiliaria speciale. Il verde non appartiene alla formazione standard."},
 {speaker:"OCULO",text:"Tu, invece, hai gia' capito piu' di quanto abbia capito lui."},
 {speaker:"ZERO",text:"Lui chi?"},
 {speaker:"OCULO",text:"Non parlavo con te."},
 {speaker:"OCULO",text:"Tu, dall'altra parte dello schermo: registriamo come insisti, come obbedisci, come cerchi di prendere il controllo."},
 {speaker:"OCULO",text:"L'armatura e' il collegamento. Combatte con loro, li misura e prepara cio' che viene dopo."},
 {speaker:"OCULO",text:"OCULO e' il nodo di supervisione. Non una persona. Una funzione."},
 {speaker:"REGISTRO",text:"SUPERVISOR NODE: OCULO // SUCCESSOR SLOT: AVAILABLE"},
 {speaker:"OCULO",text:"Non serve chiederti cosa sceglieresti. Me lo hai gia' mostrato."},
 {speaker:"OCULO",text:"Il profilo e' completo."},
];
const TERMINAL_POS={x:ARCHIVIO_CX-ARCHIVIO_W/2+1.0,z:ARCHIVIO_CZ+ARCHIVIO_D/2-2.8};
const CAPSULE_INTERACT_POS={x:ARCHIVIO_CX-1.7,z:-7.4};
const ZERO_CAPSULE_INTERACT_POS={x:ZERO_CAPSULE_POS.x,z:ZERO_CAPSULE_POS.z+1.45};
let archiveState={terminalRead:false,capsuleRead:false,zeroRead:false,revealing:false,capsuleAwake:false};
let nearInteractable=null;
function doArchiveInteract(){
 if(!fate.flags.archive_first_action){
  if(nearInteractable==="capsule")fateAdd("rebellion",1,"archive_first_action","good");
  else if(nearInteractable==="terminal"||nearInteractable==="zeroCapsule")fateAdd("control",1,"archive_first_action","evil");
 }
 if(nearInteractable==="terminal"&&!archiveState.terminalRead){
  archiveState.terminalRead=true;archiveCompanion.meriTX=TERMINAL_POS.x+1.45;archiveCompanion.meriTZ=TERMINAL_POS.z+.85;
  playDialogue(terminalLines,()=>{archiveCompanion.meriTX=CAPSULE_INTERACT_POS.x-1.55;archiveCompanion.meriTZ=CAPSULE_INTERACT_POS.z+1.55;maybeStartOculoReveal();});
 }
 else if(nearInteractable==="capsule"&&!archiveState.capsuleRead){
  archiveState.capsuleRead=true;archiveState.capsuleAwake=true;archiveCompanion.meriTX=CAPSULE_INTERACT_POS.x-1.55;archiveCompanion.meriTZ=CAPSULE_INTERACT_POS.z+1.55;
  playDialogue(getCapsuleLines(),()=>{archiveCompanion.meriTX=ZERO_CAPSULE_POS.x-1.55;archiveCompanion.meriTZ=ZERO_CAPSULE_POS.z+1.55;maybeStartOculoReveal();});
 }
 else if(nearInteractable==="zeroCapsule"&&!archiveState.zeroRead){
  fateAdd(player.transformed?"control":"rebellion",1,"zero_frame_form",player.transformed?"evil":"good");
  archiveState.zeroRead=true;archiveCompanion.meriTX=ZERO_CAPSULE_POS.x-1.55;archiveCompanion.meriTZ=ZERO_CAPSULE_POS.z+1.55;
  playDialogue(getZeroCapsuleLines(),maybeStartOculoReveal);
 }
}
const archiveEscortLines=[
 {speaker:"MERIDIANA",text:"Aspetta. Vengo con te. Se quella firma e' davvero Ranger, non ti lascio entrare li' dentro da solo."},
 {speaker:"TIC",text:"Confermo accompagnamento. Il segnale del pannello risponde anche ai miei registri interni."},
 {speaker:"ARCO",text:"Meridiana... fate attenzione. Se qualcosa non torna, tornate indietro."},
];
const archiveArrivalLines=[
 {speaker:"MERIDIANA",text:"Siamo dentro. Io controllo il registro. TIC, scansiona le capsule. Zero... guarda bene prima di toccare qualcosa."},
 {speaker:"TIC",text:"Ricevuto. Resto con voi."},
];
function doAnomalyInteract(){
 if(!postBossState||archiveEscortState)return;
 if(postBossTalked.size===0)fateAdd("control",1,"postboss_anomaly_fast","evil");
 else if(postBossTalked.size>=5)fateAdd("rebellion",1,"postboss_listened_team","good");
 else fateAdd("compliance",1,"postboss_partial_team","normal");
 archiveEscortState=true;missionHintEl.classList.remove("show");
 // Blocchiamo le routine normali e facciamo convergere SOLO Meridiana e TIC
 // sul pannello: e' una piccola scena di accompagnamento, non follower AI.
 teamRouteMode=null;
 for(const m of teamMembers){m.targetX=m.x;m.targetZ=m.z;}
 const meri=teamMemberByName("MERIDIANA");
 if(meri){meri.targetX=ANOMALO_POS.x-1.15;meri.targetZ=ANOMALO_POS.z+.65;}
 playDialogue(archiveEscortLines,()=>{
  missionHintEl.textContent="MERIDIANA + TIC // VENGONO CON TE";missionHintEl.classList.add("show");
  // Lasciamo due secondi reali alla scena per far vedere Meridiana arrivare
  // e TIC posizionarsi sul pannello, poi entriamo tutti insieme.
  afterGame(2100,()=>{postBossState=false;archiveEscortState=false;startArchiveSequence();});
 });
}
function startArchiveSequence(){
 fateAdd(player.transformed?"compliance":"rebellion",1,"archive_entry_form",player.transformed?"normal":"good");
 archiveState={terminalRead:false,capsuleRead:false,zeroRead:false,revealing:false,capsuleAwake:false};enterArchivio();saveCheckpoint("archivio");
 // All'arrivo i tre sono nello stesso punto scenico: prima si stabilisce
 // verbalmente il gruppo, poi Meridiana e TIC si separano per investigare.
 afterGame(500,()=>playDialogue(archiveArrivalLines,()=>{
  archiveCompanion.meriTX=TERMINAL_POS.x+1.45;archiveCompanion.meriTZ=TERMINAL_POS.z+.85;
  archiveCompanion.ticPatrol=true;archiveCompanion.ticTarget=0;archiveCompanion.ticWait=.5;
  missionHintEl.textContent="ESPLORA L'ARCHIVIO // MERIDIANA E TIC SONO CON TE // R = ARMATURA";missionHintEl.classList.add("show");
 }));
}
function maybeStartOculoReveal(){
 if(archiveState.terminalRead&&archiveState.capsuleRead&&archiveState.zeroRead&&!archiveState.revealing){archiveState.revealing=true;missionHintEl.classList.remove("show");afterGame(900,()=>playDialogue(oculoRevealLines,resolveAutomaticEnding));}
}
const choiceScreenEl=document.getElementById("choiceScreen");
const choiceRowEl=document.getElementById("choiceRow");
const endingScreenEl=document.getElementById("endingScreen");
const cliffFlashEl=document.getElementById("cliffFlash");
const cliffEyeEl=document.getElementById("cliffEye");
const cliffMenuBtnEl=document.getElementById("cliffMenuBtn");
const enterFadeEl=document.getElementById("enterFade");
let enteringTorre=false, enterTorreT=0;
const ENTER_TORRE_DUR=2.3, ENTER_TORRE_FROM_Z=ROOM_D/2-1.4, ENTER_TORRE_TO_Z=4.0;
cliffMenuBtnEl.addEventListener("click",()=>location.reload());
const ENDINGS={
 good:{cls:"good",title:"CICLO INTERROTTO",text:"Meridiana resta al terminale, TIC sblocca le capsule e Zero spezza il proprio legame con l'armatura. Le camere si aprono una dopo l'altra. Arco arriva troppo tardi per fermarvi — e sceglie di aiutarvi. Il ciclo, per ora, si ferma."},
 normal:{cls:"normal",title:"ARCHIVIO RICHIUSO",text:"Zero chiude il registro. Meridiana lo chiama per nome, ma lui si allontana. TIC abbassa l'occhio. Le capsule tornano silenziose e Vale attende fuori dalla porta. La missione continua."},
 evil:{cls:"evil",title:"SUPERVISORE AUTORIZZATO",text:"Zero assume il nodo. L'occhio di Oculo si spegne e si riaccende con la sua firma. Meridiana guarda il monitor. La nuova voce ordina: 'Unita' Meridiana. Torna alla postazione.' Le capsule restano da amministrare."},
};
function resolveAutomaticEnding(){
 const kind=fateEnding();missionHintEl.textContent="PROFILO COMPORTAMENTALE // SESSIONE CHIUSA";missionHintEl.classList.add("show");afterGame(950,()=>triggerEnding(kind));
}
function showChoiceScreen(){
 choiceRowEl.innerHTML="";
 const opts=[
  {kind:"good",lbl:"LIBERALI",txt:"Apri le capsule, qualunque cosa costi."},
  {kind:"normal",lbl:"ARCHIVIA",txt:"Richiudi tutto. Accetta il protocollo e continua."},
  {kind:"evil",lbl:"ASSUMI IL CONTROLLO",txt:"Occupa il nodo di supervisione e gestisci tu il ciclo."},
 ];
 for(const o of opts){const b=document.createElement("button");b.className="choiceBtn";b.innerHTML=`<span class="lbl">${o.lbl}</span>${o.txt}`;b.addEventListener("click",()=>triggerEnding(o.kind));choiceRowEl.appendChild(b);}
 choiceScreenEl.classList.add("show");clearKeys();
}
function recordLimenEnding(kind){
 const axis={good:"rebellion",normal:"compliance",evil:"control"}[kind];
 try{
  const raw=localStorage.getItem("LIMEN_META_V1"),meta=raw?JSON.parse(raw):{};
  meta.version=1;meta.sessions=meta.sessions||{};meta.profile=meta.profile||{rebellion:0,compliance:0,control:0};meta.history=Array.isArray(meta.history)?meta.history:[];
  const prev=meta.sessions.LMN_02||{unlockedEndings:[]};
  if(!prev.firstEnding){prev.firstEnding=kind;meta.profile[axis]=(meta.profile[axis]||0)+1;}
  prev.lastEnding=kind;prev.axis=axis;prev.updatedAt=Date.now();prev.unlockedEndings=Array.from(new Set([...(prev.unlockedEndings||[]),kind]));
  meta.sessions.LMN_02=prev;meta.history.push({session:"LMN_02",ending:kind,axis,ts:Date.now()});if(meta.history.length>30)meta.history=meta.history.slice(-30);
  localStorage.setItem("LIMEN_META_V1",JSON.stringify(meta));
  // compatibilita' con IT SHIFT / vecchie build.
  const legacyRaw=localStorage.getItem("LIMEN_SESSION_01"),legacy=legacyRaw?JSON.parse(legacyRaw):{};legacy.LMN_02={ending:kind,ts:Date.now()};localStorage.setItem("LIMEN_SESSION_01",JSON.stringify(legacy));
 }catch(e){}
}
function triggerEnding(kind){
 choiceScreenEl.classList.remove("show");recordLimenEnding(kind);clearCheckpoint();
 const e=ENDINGS[kind];endingScreenEl.className=e.cls;endingScreenEl.style.backgroundImage=`url('ending_${kind}.png')`;endingScreenEl.querySelector("h1").style.opacity=1;endingScreenEl.querySelector("p").style.opacity=1;endingScreenEl.querySelector(".code").style.opacity=1;endingScreenEl.querySelector("h1").textContent=e.title;endingScreenEl.querySelector("p").textContent=e.text;endingScreenEl.classList.add("show");
 stopAmbient(3.5);sfx.win();
 setTimeout(()=>{
  const h1=endingScreenEl.querySelector("h1"),p=endingScreenEl.querySelector("p"),code=endingScreenEl.querySelector(".code");[h1,p,code].forEach(el=>{el.style.transition="opacity .8s ease";el.style.opacity=0;});
  cliffFlashEl.style.transition="opacity .04s linear";cliffFlashEl.style.opacity=1;sfx.alarm();
  setTimeout(()=>{cliffFlashEl.style.transition="opacity 1.1s ease";cliffFlashEl.style.opacity=0;cliffEyeEl.classList.add("show");setTimeout(()=>{cliffEyeEl.style.transition="opacity 1.8s ease";cliffEyeEl.classList.remove("show");cliffEyeEl.style.opacity=0;
   // Prima la sequenza finiva qui e basta: schermo nero per sempre, nessun
   // modo di proseguire senza ricaricare la pagina a mano. Ora, dopo che
   // l'occhio si e' spento, compare (piano, per non rompere il momento)
   // un modo per tornare al menu.
   setTimeout(()=>{cliffMenuBtnEl.classList.add("show");},1200);
  },3400);},90);
 },7000);
}

function prepareStartedGame(){
 unlockAudio();gameStarted=true;paused=false;titleEl.style.display="none";hudEl.style.display="block";document.body.classList.add("started");clearKeys();
}
function beginNewGame(){
 if(gameStarted)return;clearCheckpoint();resetFate();prepareStartedGame();morphUnlocked=false;resetTeamIntro();player.transformed=false;player.helmet=false;player.hp=player.hpMax;player.energy=0;
 enterBar();saveCheckpoint("bar");enterFadeEl.classList.add("show");clearKeys();requestAnimationFrame(()=>{enterFadeEl.classList.remove("show");});afterGame(900,startBarPrologue);
}
function continueGame(){
 if(gameStarted)return;const cp=readCheckpoint();if(!cp){beginNewGame();return;}prepareStartedGame();restoreCheckpoint(cp.id||"torre",cp);
}
refreshContinueButton();
document.getElementById("newGameBtn").addEventListener("click",e=>{e.stopPropagation();beginNewGame();});
continueBtnEl.addEventListener("click",e=>{e.stopPropagation();if(!continueBtnEl.disabled)continueGame();});
const edgeKeys=new Set(["Space","KeyF","KeyC","KeyR","ShiftLeft","ShiftRight","KeyP","Escape","KeyT","KeyM"]);
window.addEventListener("keydown",e=>{
 if(e.repeat&&edgeKeys.has(e.code))return;
 keys[e.code]=true;
 // SPAZIO conserva il comportamento storico del gioco: avvia SEMPRE una
 // nuova sessione completa. CONTINUA e' volutamente solo il pulsante menu,
 // cosi' un vecchio checkpoint non puo' saltare intro e trasformazione.
 if(e.code==="Space"&&!gameStarted){beginNewGame();return;}
 if((e.code==="KeyP"||e.code==="Escape")&&gameStarted&&!endingScreenEl.classList.contains("show")){setPaused(!paused);return;}
 if(paused)return;
 if(e.code==="Space"&&dialogueActive){advanceDialogue();return;}
 if(e.code==="Space"&&zone==="colosso"&&colosso&&colosso.phase==="tutorial"){beginGiantBattle();return;}
 if(e.code==="Space"&&colossoOutcomeEl.classList.contains("show")){if(colosso&&colosso.phase==="lost")doColossoOutcomeContinue();return;}
 if(e.code==="Space"&&cliffMenuBtnEl.classList.contains("show")){location.reload();return;}
 if(e.code==="Space"&&zone==="bar"&&nearInteractable){doBarInteract();return;}
 if(e.code==="Space"&&zone==="archivio"&&nearInteractable){doArchiveInteract();return;}
 if(e.code==="Space"&&zone==="torre"&&nearInteractable&&nearInteractable.startsWith("npc:")){doTowerNpcInteract(nearInteractable);return;}
 if(e.code==="Space"&&zone==="torre"&&nearInteractable==="anomaly"){doAnomalyInteract();return;}
 if(e.code==="KeyR"&&morphUnlocked&&(zone==="torre"||zone==="archivio")&&!dialogueActive&&!transformState){startTransformation(true);return;}
 if(gameOverActive)return;
 if(DEV_MODE&&e.code==="KeyT")startTransformation();
 if(DEV_MODE&&e.code==="KeyM"&&gameStarted&&!transformState&&!dialogueActive){if(zone==="torre")enterArena();else enterTorre();}
 if(e.code==="KeyF"){if(zone==="colosso")colossoPunch();else tryAttack();}
 if(e.code==="KeyC"){if(zone==="colosso")colossoSpecial();else trySpecial();}
 if(e.code==="ShiftLeft"||e.code==="ShiftRight"){if(zone==="colosso")colossoGuard();else tryDodge();}
});
window.addEventListener("keyup",e=>{keys[e.code]=false;});

// ------------------------------------------------------------
// v56 — CONTROLLI MOBILE COMPLETI
// Joystick analogico, camera touch, AZIONE, trasformazione, attacco,
// schivata, speciale e pausa. Tutte le azioni usano la stessa logica
// desktop per non creare due versioni divergenti del gameplay.
// ------------------------------------------------------------
const isTouchDevice=('ontouchstart' in window)||(navigator.maxTouchPoints||0)>0||(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
if(isTouchDevice)document.body.classList.add("touch-device");
const touchInteractBtn=document.getElementById("tactInteract");
const touchMorphBtn=document.getElementById("tactMorph");
const touchStickEl=document.getElementById("touchStick");
const touchStickKnob=document.getElementById("touchStickKnob");
const dialoguePromptEl=document.getElementById("dialoguePrompt");
function touchKeyDown(code){unlockAudio();keys[code]=true;window.dispatchEvent(new KeyboardEvent("keydown",{code,bubbles:true}));}
function touchKeyUp(code){keys[code]=false;}
document.querySelectorAll("#touchControls [data-key]").forEach(btn=>{
 const code=btn.dataset.key;let activePointer=null;
 btn.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();if(activePointer!==null)return;activePointer=e.pointerId;try{btn.setPointerCapture(e.pointerId);}catch(_){}btn.classList.add("pressed");touchKeyDown(code);},{passive:false});
 const release=e=>{if(activePointer!==null&&e.pointerId!==undefined&&e.pointerId!==activePointer)return;e.preventDefault();e.stopPropagation();activePointer=null;btn.classList.remove("pressed");touchKeyUp(code);};
 btn.addEventListener("pointerup",release,{passive:false});btn.addEventListener("pointercancel",release,{passive:false});
 btn.addEventListener("lostpointercapture",()=>{activePointer=null;btn.classList.remove("pressed");touchKeyUp(code);});
});
let stickPointer=null;
function setStickKey(code,on){keys[code]=!!on;}
function clearTouchStick(){["KeyW","KeyS","KeyA","KeyD"].forEach(k=>setStickKey(k,false));if(touchStickKnob)touchStickKnob.style.transform="translate(0px,0px)";}
function updateTouchStick(e){
 if(!touchStickEl||!touchStickKnob)return;const r=touchStickEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 let dx=e.clientX-cx,dy=e.clientY-cy;const max=r.width*.31,dist=Math.hypot(dx,dy)||1,scale=dist>max?max/dist:1;dx*=scale;dy*=scale;
 touchStickKnob.style.transform=`translate(${dx}px,${dy}px)`;const nx=dx/max,ny=dy/max,dead=.22;
 setStickKey("KeyW",ny<-dead);setStickKey("KeyS",ny>dead);setStickKey("KeyA",nx<-dead);setStickKey("KeyD",nx>dead);
}
if(touchStickEl){
 touchStickEl.addEventListener("pointerdown",e=>{if(stickPointer!==null)return;e.preventDefault();stickPointer=e.pointerId;try{touchStickEl.setPointerCapture(e.pointerId);}catch(_){}updateTouchStick(e);},{passive:false});
 touchStickEl.addEventListener("pointermove",e=>{if(e.pointerId!==stickPointer)return;e.preventDefault();updateTouchStick(e);},{passive:false});
 const stickEnd=e=>{if(stickPointer!==null&&e.pointerId!==undefined&&e.pointerId!==stickPointer)return;e.preventDefault();stickPointer=null;clearTouchStick();};
 touchStickEl.addEventListener("pointerup",stickEnd,{passive:false});touchStickEl.addEventListener("pointercancel",stickEnd,{passive:false});
}
let lookPointer=null,lookLastX=0;
c.addEventListener("pointerdown",e=>{if(!isTouchDevice||e.pointerType==="mouse"||!gameStarted||paused||dialogueActive||zone==="colosso")return;if(e.clientX<innerWidth*.30)return;lookPointer=e.pointerId;lookLastX=e.clientX;camState.idleT=0;try{c.setPointerCapture(e.pointerId);}catch(_){}},{passive:true});
c.addEventListener("pointermove",e=>{if(e.pointerId!==lookPointer)return;const dx=e.clientX-lookLastX;lookLastX=e.clientX;camState.yawOffset-=dx*.0085;camState.yawOffset=Math.max(-2.2,Math.min(2.2,camState.yawOffset));camState.idleT=0;},{passive:true});
const endLook=e=>{if(e.pointerId===lookPointer)lookPointer=null;};c.addEventListener("pointerup",endLook,{passive:true});c.addEventListener("pointercancel",endLook,{passive:true});
function mobileContextLabel(){
 if(!nearInteractable)return "AZIONE";
 if(nearInteractable.includes("Talk")||nearInteractable.startsWith("npc:"))return "PARLA";
 if(nearInteractable.includes("Friend")||nearInteractable.includes("Bartender"))return nearInteractable.includes("Order")?"ORDINA":nearInteractable.includes("Busy")?"PARLA":"SALVA";
 if(nearInteractable==="barCore")return "NUCLEO";if(nearInteractable==="anomaly")return "ISPEZIONA";if(nearInteractable==="terminal")return "LEGGI";
 if(nearInteractable==="capsule"||nearInteractable==="zeroCapsule")return "ESAMINA";return "AZIONE";
}
function syncMobileUI(){
 if(!isTouchDevice)return;const combat=(zone==="arena"||zone==="colosso");
 document.body.classList.toggle("mobile-combat",combat);document.body.classList.toggle("mobile-explore",!combat);document.body.classList.toggle("mobile-colosso",zone==="colosso");document.body.classList.toggle("mobile-portrait",innerHeight>innerWidth);
 if(touchMorphBtn)touchMorphBtn.classList.toggle("show",!!(morphUnlocked&&(zone==="torre"||zone==="archivio")&&!transformState));
 if(touchInteractBtn)touchInteractBtn.textContent=mobileContextLabel();
 if(interactPromptEl&&interactPromptEl.classList.contains("show"))interactPromptEl.textContent=interactPromptEl.textContent.replace(/^SPAZIO\s*—\s*/,"AZIONE — ").replace(/^R\s*—\s*/,"FORMA — ");
 if(missionHintEl&&missionHintEl.textContent)missionHintEl.textContent=missionHintEl.textContent.replace(/R\s*=\s*ARMATURA/g,"FORMA = ARMATURA");
}
if(isTouchDevice){
 if(dialoguePromptEl)dialoguePromptEl.textContent="TOCCA IL BALLOON PER CONTINUARE";
 const gt=document.getElementById("giantTutorial");if(gt){const bs=gt.querySelectorAll(".key b");if(bs[0])bs[0].textContent="ATTACCA";if(bs[1])bs[1].textContent="SCHIVA";if(bs[2])bs[2].textContent="SPECIALE";}
 const gtb=document.getElementById("giantTutorialBtn");if(gtb)gtb.textContent="TOCCA / COMBATTI";
 document.addEventListener("contextmenu",e=>e.preventDefault());document.addEventListener("touchmove",e=>e.preventDefault(),{passive:false});
 window.addEventListener("orientationchange",()=>{clearTouchStick();setTimeout(syncMobileUI,120);});
}

window.addEventListener("blur",()=>{clearKeys();if(gameStarted&&!paused&&!endingScreenEl.classList.contains("show"))setPaused(true);});
document.addEventListener("visibilitychange",()=>{if(document.hidden){clearKeys();if(gameStarted&&!paused&&!endingScreenEl.classList.contains("show"))setPaused(true);}});
document.getElementById("resumeBtn").addEventListener("click",()=>setPaused(false));
document.getElementById("restartCheckpointBtn").addEventListener("click",()=>{setPaused(false);restoreCheckpoint(currentCheckpoint||(readCheckpoint()?.id)||"torre");});
document.getElementById("returnMenuBtn").addEventListener("click",()=>location.reload());
document.getElementById("runtimeReloadBtn").addEventListener("click",()=>location.reload());

// ------------------------------------------------------------
// Sequenza di trasformazione: pochi secondi, il giocatore perde il
// controllo, la telecamera si stringe sul personaggio, un paio di flash,
// poi la palette passa da civile a Ranger Zero (vermiglio/ottone) e
// compare il casco. Placeholder di posa/effetti, ma già cablato come
// vera cinematic a stati invece che un semplice timer unico.
// ------------------------------------------------------------
let transformState=null; // null oppure {t, toRanger}
function startTransformation(manual){
 if(transformState)return;
 transformState={t:0, toRanger:!player.transformed,manual:!!manual};
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
  if(introAlertStarted&&transformState.toRanger&&!transformState.manual)teamMode="ranger";
 }
 if(t>.9){
  const wasManual=transformState.manual,toRanger=transformState.toRanger;transformState=null;
  if(wasManual){missionHintEl.textContent=toRanger?"ARMATURA RANGER // ONLINE":"ARMATURA RILASCIATA // FIRMA RIDOTTA";missionHintEl.classList.add("show");afterGame(1100,()=>missionHintEl.classList.remove("show"));if(currentCheckpoint==="postboss"||currentCheckpoint==="archivio")saveCheckpoint(currentCheckpoint);}
 }
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
 player.attackT=.34;player.attackStyle=player.attackCombo%3;player.attackCombo=(player.attackCombo+1)%3;
 sfx.attack();
 for(const en of enemies){
  if(en.dead||en.hidden)continue;
  const f=facingDot(player.x,player.z,player.yaw,en.x,en.z);
  if(f.dist<1.7&&f.dot>.55){
   damageEnemy(en,player.powerBuffT>0?22:16);
   player.energy=Math.min(player.energyMax,player.energy+9);
  }
 }
}
let specialBursts=[];
let splashBursts=[];
function trySpecial(){
 if(!player.transformed||transformState||player.energy<player.energyMax||player.attackT>0)return;
 player.attackT=.5;player.attackStyle=0;
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
   specialBursts.push({x:en.x+(Math.random()-.5)*.5,y:.8+Math.random()*.7,z:en.z+(Math.random()-.5)*.5,t:0});
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
   // Colosso, scontro finale in 3/4 con mini-citta'.
   en.retreated=true;en.state="retreat";
   triggerSlowMo(.35,.18); // colpo finale sui mob normali, un pelo piu' lungo
   afterGame(900,startColossoSequence);
  }else{
   en.dead=true;
  }
 }else{
  sfx.hitEnemy();
 }
}

function pickEnemyTarget(en){
 let tx=player.x,tz=player.z,kind="player",ref=player,best=Math.hypot(player.x-en.x,player.z-en.z);
 if(en.type==="raccoglitore"||en.aggroPlayer)return {x:tx,z:tz,kind,ref,dist:best};
 if(zone==="arena"&&!colossoTeamPos&&arenaAllies.length){
  let candidates=arenaAllies.slice().sort((a,b)=>Math.hypot(a.x-en.x,a.z-en.z)-Math.hypot(b.x-en.x,b.z-en.z));
  const a=candidates[(Math.abs(Math.floor(en.x*7+en.z*3)))%Math.min(2,candidates.length)];
  if(a){tx=a.x;tz=a.z;kind="ally";ref=a;best=Math.hypot(a.x-en.x,a.z-en.z);}
 }
 return {x:tx,z:tz,kind,ref,dist:best};
}

function updateEnemies(dt){
 maybeAdvanceArenaWave();updateArenaAllies(dt);
 for(const en of enemies){
  if(en.dead)continue;
  if(en.emerging&&!en.emerged&&!en.hidden){
   en.emergeT=(en.emergeT||0)+dt;
   if(en.emergeT<.05)splashBursts.push({x:en.x,y:.1,z:en.z,t:0});
   const p=Math.min(1,en.emergeT/1.7);
   const ease=1-Math.pow(1-p,2);
   en.y=-2.6+ease*2.6;
   if(p>=1){en.emerged=true;en.y=0;en.state="approach";}
   continue; // resta passivo finche' non e' emerso del tutto
  }
  if(en.hidden)continue;
  if(en.type==="raccoglitore"&&en.state==="approach"){
   // Dopo essersi alzato dall'acqua cammina verso la riva. Solo quando ha
   // raggiunto il bagnasciuga entra nell'AI di combattimento normale.
   const dz=RACC_SHORE_Z-en.z;en.yaw=0;
   en.z+=Math.sign(dz)*Math.min(Math.abs(dz),dt*1.55);en.walkPhaseE+=dt*6;
   if(Math.abs(RACC_SHORE_Z-en.z)<.06){
    en.z=RACC_SHORE_Z;en.state="idle";en.graceT=2.15;en.comboHits=0;en.recoverT=0;en.supportT=7.2;
    if(!en.bossSupportStarted){en.bossSupportStarted=true;afterGame(650,()=>{if(zone==="arena"&&!en.dead&&en.emerged&&!en.retreated&&supportDrops.length===0)spawnSupportDrop(player.hp<player.hpMax*.68?"hp":chooseDirectorSupport());});}
   }
   continue;
  }
  if(en.hitFlash>0)en.hitFlash-=dt;
  if(en.state==="retreat"){
   en.alpha=Math.max(0,en.alpha-dt*.6);
   en.z-=dt*1.4;
   if(en.alpha<=0)en.dead=true;
   continue;
  }
  if(en.type==="raccoglitore"){
   if(en.graceT>0){en.graceT=Math.max(0,en.graceT-rawDtGlobal);en.walkPhaseE+=dt*1.2;continue;}
   if(en.recoverT>0){en.recoverT=Math.max(0,en.recoverT-rawDtGlobal);en.walkPhaseE+=dt*.8;continue;}
   en.supportT=Math.max(0,(en.supportT||0)-rawDtGlobal);
   if(en.supportT<=0){
    if(supportDrops.length===0){spawnSupportDrop(chooseDirectorSupport());en.recoverT=1.20;en.supportT=8.5;}
    else en.supportT=2.0;
   }
  }
  const target=pickEnemyTarget(en);
  const wantRange=en.type==="raccoglitore"?2.05:1.5;
  if(en.cd>0)en.cd-=rawDtGlobal;
  if(!(en.windupT>0)) en.yaw=Math.atan2(target.x-en.x,target.z-en.z);
  if(en.windupT>0){
   // Preavviso vero prima del colpo: prima i nemici colpivano di scatto
   // appena il cooldown scadeva, senza nessun segnale — la squadra del
   // Colosso ha gia' un telegraph leggibile, la spiaggia no. Ora il nemico
   // resta fermo, "carica" per un attimo (visibile via en.telegraph nel
   // render, un lampo/pulsazione), e SOLO alla fine controlla di nuovo la
   // distanza prima di infliggere danno — cosi' schivare all'ultimo
   // istante funziona davvero, non e' solo estetica.
   en.windupT=Math.max(0,en.windupT-rawDtGlobal);
   if(en.windupT<=0){
    en.telegraph=false;
    en.cd=en.type==="raccoglitore"?1.95:2.05;
    en.attackFlashT=.5;
    if(en.type==="raccoglitore"){
     en.comboHits=(en.comboHits||0)+1;
     if(en.comboHits>=2){en.comboHits=0;en.recoverT=1.85;}
    }
    const t2=pickEnemyTarget(en);
    if(t2.dist<=wantRange+.30){
     if(t2.kind==="player"){
      if(player.invuln<=0){
       const dmg=en.type==="raccoglitore"?14:7;
       player.hp=Math.max(0,player.hp-dmg);
       player.hitFlashT=.3;
       sfx.hitPlayer();
      }
     }else if(t2.ref){
      t2.ref.hurtT=.32;
      t2.ref.attackT=Math.max(t2.ref.attackT,.18);
      sfx.hitPlayer();
     }
    }
   }
  }else if(target.dist>wantRange+.15){
   const spd=(en.type==="raccoglitore"?(target.dist>6.3?.62:1.10):1.8)*dt;
   en.x+=Math.sin(en.yaw)*spd; en.z+=Math.cos(en.yaw)*spd;
   en.walkPhaseE+=dt*7.5;
  }else if(en.cd<=0){
   en.windupT=en.type==="raccoglitore"?.72:.42;
   en.telegraph=true;
   sfx.uiBlip();
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
 // sicurezza finale: separazione e AI non possono spingere un nemico fuori
 // dai limiti validi dell'arena o propagare coordinate non finite.
 const b=ZONES.arena;const xmin=b.cx-b.w/2+.7,xmax=b.cx+b.w/2-.7,zmax=b.cz+b.d/2-.7;
 for(const en of enemies){
  if(!Number.isFinite(en.x)||!Number.isFinite(en.z)){en.x=ARENA_CX;en.z=en.type==="raccoglitore"?RACC_SEA_Z:ARENA_CZ;}
  en.x=Math.max(xmin,Math.min(xmax,en.x));
  const zmin=en.type==="raccoglitore"?RACC_SEA_Z:SEA_EDGE_Z+.55;
  en.z=Math.max(zmin,Math.min(zmax,en.z));
 }
}

function resize(){
 const maxRB=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)||8192;
 const mobileCap=isTouchDevice?1.35:2;
 const baseDpr=Math.min(window.devicePixelRatio||1,mobileCap);
 const safeScale=Math.max(.5,Math.min(baseDpr,maxRB/Math.max(1,innerWidth),maxRB/Math.max(1,innerHeight)));
 c.width=Math.max(1,Math.floor(innerWidth*safeScale));c.height=Math.max(1,Math.floor(innerHeight*safeScale));
 c.style.width=innerWidth+"px";c.style.height=innerHeight+"px";gl.viewport(0,0,c.width,c.height);
}
window.addEventListener("resize",resize);
resize();

// WebGL/context safety: se la GPU/browser perde il contesto, conserviamo il
// checkpoint e chiediamo un reload pulito invece di lasciare la scena rotta.
c.addEventListener("webglcontextlost",e=>{e.preventDefault();if(currentCheckpoint)saveCheckpoint(currentCheckpoint);showRuntimeError("RENDERER INTERROTTO","Il contesto WebGL e' stato perso. Il checkpoint e' salvo: ricarica per continuare.");},{passive:false});
c.addEventListener("webglcontextrestored",()=>location.reload());
window.addEventListener("error",e=>{if(gameStarted&&!runtimeOverlayEl.classList.contains("show"))showRuntimeError("ERRORE DI SESSIONE",e.message||"Errore runtime imprevisto.");});
window.addEventListener("unhandledrejection",e=>{if(gameStarted&&!runtimeOverlayEl.classList.contains("show"))showRuntimeError("ERRORE DI SESSIONE",String(e.reason&&e.reason.message||e.reason||"Promise rifiutata"));});

// impatto dell'attacco speciale: una piccola forma chiara che si espande e
// sparisce, riusata per ogni scoppio invece di ricostruire geometria nuova.
const burstMesh=boxMesh([1,.92,.55]);
const burstBuf=makeBuffer(burstMesh);
const supportBoltBufs={hp:makeBuffer(boxMesh(SUPPORT_COLORS.hp)),energy:makeBuffer(boxMesh(SUPPORT_COLORS.energy)),power:makeBuffer(boxMesh(SUPPORT_COLORS.power))};
const supportCoreBufs={hp:makeBuffer(octMesh(SUPPORT_COLORS.hp)),energy:makeBuffer(octMesh(SUPPORT_COLORS.energy)),power:makeBuffer(octMesh(SUPPORT_COLORS.power))};
const supportRingBuf=makeBuffer(boxMesh([.65,.78,.92]));
function drawSupportDrops(vp,now){
 for(const d of supportDrops){
  if(d.state==="telegraph"){
   const p=Math.min(1,d.t/.62),pulse=.72+Math.sin(now/70)*.18;
   drawBuffer(supportRingBuf,mul(mat4.translate(d.x,.035,d.z),mat4.rotY(now/700),mat4.scale(1.4*pulse,.025,1.4*pulse)),vp,.22+.28*p);
   if(p>.55){
    const h=5.5*(p-.55)/.45;
    drawBuffer(supportBoltBufs[d.kind],mul(mat4.translate(d.x,2.8,d.z),mat4.rotZ(Math.sin(now/35)*.08),mat4.scale(.055,h,.055)),vp,.85);
   }
  }else{
   const pulse=.85+Math.sin(now/110)*.12;
   drawBuffer(supportCoreBufs[d.kind],mul(mat4.translate(d.x,.55+Math.sin(now/180)*.08,d.z),mat4.rotY(now/380),mat4.scale(.30*pulse,.30*pulse,.30*pulse)),vp,.95);
   drawBuffer(supportRingBuf,mul(mat4.translate(d.x,.025,d.z),mat4.rotY(-now/900),mat4.scale(.75*pulse,.018,.75*pulse)),vp,.18);
  }
 }
}

// Punto esclamativo da fumetto per il preavviso d'attacco: prima il
// windup si vedeva solo come un lieve rigonfiamento del nemico, troppo
// sottile da notare mentre si gioca davvero (si vedeva solo rileggendo il
// popup di testo). Un vero "!" che compare di scatto sopra la testa e
// rimbalza e' molto piu' leggibile a colpo d'occhio.
const exclaimBarBuf=makeBuffer(boxMesh([1.0,.85,.15]));
const exclaimDotBuf=makeBuffer(boxMesh([1.0,.85,.15]));

// ombra a terra condivisa: un box scuro schiacciato, riusato sotto ogni
// personaggio invece di costruirne una per ciascuno. Senza, tutti
// sembravano leggermente "fluttuare" sul pavimento.
const shadowMesh=boxMesh([0,0,0]);
const shadowBuf=makeBuffer(shadowMesh);
function drawShadow(x,z,radius,vp,alpha,y){
 drawBuffer(shadowBuf, mul(mat4.translate(x,(y||0)+.012,z),mat4.scale(radius,.02,radius*.85)), vp, alpha===undefined?.35:alpha);
}

// Barra vita dei nemici in spiaggia: prima non si vedeva quanta vita
// avesse nessuno (scagnozzi o Raccoglitore) fuori dal Colosso, che ha gia'
// la sua barra dedicata. Una barra piccola fluttuante sopra la testa,
// sempre rivolta verso la telecamera (billboard vero, calcolato dallo yaw
// della camera ogni frame), che appare solo se il nemico ha gia' subito
// danno — cosi' non affolla la scena finche' non serve davvero.
const hpBarBgMesh=boxMesh([.08,.06,.07]);
const hpBarBgBuf=makeBuffer(hpBarBgMesh);
const hpBarFillMesh=boxMesh([.75,.18,.14]);
const hpBarFillBuf=makeBuffer(hpBarFillMesh);
function drawEnemyHpBar(x,y,z,frac,camYaw,vp){
 if(frac>=1)return; // ancora a vita piena: non serve mostrarla
 const rot=mat4.rotY(camYaw);
 const base=mul(mat4.translate(x,y,z),rot);
 drawBuffer(hpBarBgBuf, mul(base,mat4.scale(.62,.09,.02)), vp, .8);
 const w=Math.max(0,frac)*.58;
 drawBuffer(hpBarFillBuf, mul(base,mat4.translate(-.29+w/2,0,.002),mat4.scale(w,.06,.02)), vp, .95);
}

// Rallentatore/hit-stop: un fattore di scala globale sul tempo di gioco,
// usato sia per i micro-freeze quando un colpo va a segno (hit-stop, molto
// breve e deciso) sia per il rallentatore vero e proprio sul colpo di
// grazia del Colosso (piu' lungo, meno estremo). Il conto alla rovescia
// va in tempo REALE (rawDt), non in quello scalato, altrimenti non
// finirebbe mai.
let slowMoT=0, slowMoFactor=1;
// tempo reale non scalato dell'ultimo frame: i timer di recupero degli
// attacchi lo usano invece di dt, altrimenti l'hit-stop (che rallenta dt)
// finiva per rallentare ANCHE il recupero tra un colpo e l'altro, "mangiando"
// input durante il combattimento serrato — bug vero, trovato testando
// colpendo ripetutamente Il Raccoglitore e il Colosso (su 20 pugni ne
// registravano solo 5-8). Le animazioni/effetti restano su dt scalato
// (quello resta l'effetto voluto), solo i cooldown usano rawDtGlobal.
let rawDtGlobal=0;
function triggerSlowMo(duration,factor){ slowMoT=duration; slowMoFactor=factor; }

let last=performance.now();
function frame(now){
 const rawDt=Math.min(.05,(now-last)/1000);last=now;
 if(paused){rawDtGlobal=0;requestAnimationFrame(frame);return;}
 rawDtGlobal=rawDt;updateGameTimers(rawDt);
 let dt=rawDt;
 if(slowMoT>0){ dt=rawDt*slowMoFactor; slowMoT-=rawDt; }
 updateTransformation(dt);
 const inputLocked=paused||!!transformState||!gameStarted||dialogueActive||gameOverActive||archiveEscortState||enteringTorre||zone==="colosso"||(colosso&&colosso.phase==="pose")||choiceScreenEl.classList.contains("show")||endingScreenEl.classList.contains("show")||!!emergeCutscene;
 if(enteringTorre){
  enterTorreT=Math.min(ENTER_TORRE_DUR,enterTorreT+dt);
  const q=1-Math.pow(1-Math.min(1,enterTorreT/ENTER_TORRE_DUR),2);
  player.z=ENTER_TORRE_FROM_Z+(ENTER_TORRE_TO_Z-ENTER_TORRE_FROM_Z)*q;
  player.walkPhase=(player.walkPhase||0)+dt*6.5;
 }
 if(gameStarted)energyFillEl.style.width=(player.energy/player.energyMax*100)+"%";
 if(zone!==lastZoneLabel){ lastZoneLabel=zone; hudLocationEl.textContent=ZONE_LABELS[zone]||""; }

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
 if(!Number.isFinite(player.x)||!Number.isFinite(player.z)){player.x=ZONES[zone].cx;player.z=ZONES[zone].cz;}
 player.x=Math.max(zb.xmin,Math.min(zb.xmax,player.x));player.z=Math.max(zb.zmin,Math.min(zb.zmax,player.z));
 if(zone==="bar"){resolveBarCollisions();player.x=Math.max(zb.xmin,Math.min(zb.xmax,player.x));player.z=Math.max(zb.zmin,Math.min(zb.zmax,player.z));}

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
 player.attackT=Math.max(0,player.attackT-rawDtGlobal);
 player.dodgeT=Math.max(0,player.dodgeT-rawDtGlobal);
 player.dodgeCd=Math.max(0,player.dodgeCd-rawDtGlobal);
 player.invuln=Math.max(0,player.invuln-dt);
 player.hitFlashT=Math.max(0,player.hitFlashT-dt);
 player.specialT=Math.max(0,player.specialT-rawDtGlobal);
 player.powerBuffT=Math.max(0,(player.powerBuffT||0)-rawDtGlobal);
 for(let i=specialBursts.length-1;i>=0;i--){specialBursts[i].t+=dt;if(specialBursts[i].t>.5)specialBursts.splice(i,1);}
 for(let i=splashBursts.length-1;i>=0;i--){splashBursts[i].t+=dt;if(splashBursts[i].t>.7)splashBursts.splice(i,1);}
 if(zone==="bar")updateBarPrologue(dt);
 if(zone==="arena"&&gameStarted&&!transformState){updateEnemies(dt);updateSupportDrops(dt);}
 if(colosso)updateColosso(dt);
 if(zone==="arena")updateEmergeCutscene(dt);
 if(zone==="torre")updateTowerTeam(dt);
 if(zone==="archivio")updateArchiveCompanions(dt);

 // Archivio: mostra il prompt "SPAZIO — LEGGI" quando ci si avvicina al
 // terminale o alla sala delle capsule in fondo, cosi' l'esplorazione e'
 // guidata ma resta libera (il giocatore decide quando e se avvicinarsi).
 if(zone==="bar"&&!dialogueActive&&(barState.phase==="free"||barState.phase==="crisis")){
  if(barState.phase==="free"){
   const df=Math.hypot(player.x-BAR_FRIEND_POS.x,player.z-BAR_FRIEND_POS.z),db=Math.hypot(player.x-BAR_BARTENDER_POS.x,player.z-BAR_BARTENDER_POS.z),dg=Math.hypot(player.x-BAR_BAG_POS.x,player.z-BAR_BAG_POS.z);
   let nearestTalk=null,nearestTalkD=1.55;for(const b of barTeam){if(barState.socialFlags[b.name])continue;const d=Math.hypot(player.x-b.x,player.z-b.z);if(d<nearestTalkD){nearestTalk=b;nearestTalkD=d;}}
   if(df<1.55&&!barState.socialFlags.KIM){nearInteractable="barKimTalk";interactPromptEl.textContent="SPAZIO — PARLA CON KIM";interactPromptEl.classList.add("show");}
   else if(nearestTalk){nearInteractable="barTeamTalk:"+nearestTalk.name;interactPromptEl.textContent="SPAZIO — PARLA CON "+nearestTalk.name;interactPromptEl.classList.add("show");}
   else{
    let ambientI=-1,ambientD=1.45;for(let i=0;i<barExtras.length;i++){if(barState.ambientFlags["extra"+i])continue;const e=barExtras[i],d=Math.hypot(player.x-e.x,player.z-e.z);if(d<ambientD){ambientD=d;ambientI=i;}}
    const dcust=(!barState.customerGone&&!barState.ambientFlags.customer)?Math.hypot(player.x-barCustomer.x,player.z-barCustomer.z):999;
    if(dcust<1.45){nearInteractable="barCustomerTalk";interactPromptEl.textContent="SPAZIO — PARLA CON IL CLIENTE";interactPromptEl.classList.add("show");}
    else if(ambientI>=0){nearInteractable="barExtraTalk:"+ambientI;interactPromptEl.textContent="SPAZIO — PARLA";interactPromptEl.classList.add("show");}
    else if(db<2.15&&!barState.bartenderReady){nearInteractable="barBartenderBusy";interactPromptEl.textContent="SPAZIO — PARLA CON TOMMY";interactPromptEl.classList.add("show");}
    else if(db<2.15&&barState.bartenderReady){nearInteractable="barBartenderOrder";interactPromptEl.textContent="SPAZIO — ORDINA DA BERE";interactPromptEl.classList.add("show");}
    else if(dg<1.45&&!barState.bagUsed){nearInteractable="barBag";interactPromptEl.textContent="SPAZIO — PROVA IL SACCO";interactPromptEl.classList.add("show");}
    else{nearInteractable=null;interactPromptEl.classList.remove("show");}
   }
  }else{
   const df=Math.hypot(player.x-BAR_FRIEND_POS.x,player.z-BAR_FRIEND_POS.z),db=Math.hypot(player.x-BAR_BARTENDER_POS.x,player.z-BAR_BARTENDER_POS.z),dc=Math.hypot(player.x-BAR_CORE_POS.x,player.z-BAR_CORE_POS.z);
   if(!barState.deadlineExpired&&!barState.friendSaved&&df<1.75){nearInteractable="barFriend";interactPromptEl.textContent="SPAZIO — SALVA KIM";interactPromptEl.classList.add("show");}
   else if(!barState.deadlineExpired&&!barState.bartenderSaved&&db<2.15){nearInteractable="barBartender";interactPromptEl.textContent="SPAZIO — SALVA TOMMY";interactPromptEl.classList.add("show");}
   else if(dc<1.95){nearInteractable="barCore";interactPromptEl.textContent="SPAZIO — FERMA IL NUCLEO";interactPromptEl.classList.add("show");}
   else{nearInteractable=null;interactPromptEl.classList.remove("show");}
  }
 }else if(zone==="archivio"&&!dialogueActive){
  const dT=Math.hypot(player.x-TERMINAL_POS.x,player.z-TERMINAL_POS.z),dC=Math.hypot(player.x-CAPSULE_INTERACT_POS.x,player.z-CAPSULE_INTERACT_POS.z),dZ=Math.hypot(player.x-ZERO_CAPSULE_INTERACT_POS.x,player.z-ZERO_CAPSULE_INTERACT_POS.z);
  if(dT<1.65&&!archiveState.terminalRead){nearInteractable="terminal";interactPromptEl.textContent="SPAZIO — LEGGI IL REGISTRO";interactPromptEl.classList.add("show");}
  else if(dC<2.2&&!archiveState.capsuleRead){nearInteractable="capsule";interactPromptEl.textContent="SPAZIO — ESAMINA LE CAPSULE";interactPromptEl.classList.add("show");}
  else if(dZ<1.9&&!archiveState.zeroRead){nearInteractable="zeroCapsule";interactPromptEl.textContent="SPAZIO — ESAMINA FRAME ZERO";interactPromptEl.classList.add("show");}
  else{nearInteractable=null;if(morphUnlocked){interactPromptEl.textContent=player.transformed?"R — RILASCIA ARMATURA":"R — TRASFORMA";interactPromptEl.classList.add("show");}else interactPromptEl.classList.remove("show");}
 }else if(zone==="torre"&&!dialogueActive&&(introFreeRoam||postBossState)){
  let nearest=null,nd=1.55;for(const m of teamMembers){const d=Math.hypot(player.x-m.x,player.z-m.z);if(d<nd){nearest=m;nd=d;}}
  const dA=postBossState?Math.hypot(player.x-ANOMALO_POS.x,player.z-ANOMALO_POS.z):999;
  if(nearest){nearInteractable="npc:"+nearest.name;interactPromptEl.textContent=`SPAZIO — PARLA CON ${nearest.name}`;interactPromptEl.classList.add("show");}
  else if(postBossState&&dA<1.65){nearInteractable="anomaly";interactPromptEl.textContent="SPAZIO — ISPEZIONA IL PANNELLO ANOMALO";interactPromptEl.classList.add("show");}
  else{nearInteractable=null;if(morphUnlocked&&postBossState){interactPromptEl.textContent=player.transformed?"R — RILASCIA ARMATURA":"R — TRASFORMA";interactPromptEl.classList.add("show");}else interactPromptEl.classList.remove("show");}
 }else if(nearInteractable){nearInteractable=null;interactPromptEl.classList.remove("show");}

 syncMobileUI();
 player.walkPhase+=dt*(moving?8.5:0);
 const pal=player.transformed?PAL_ZERO:PAL_CIVILE;
 const zoomIn=transformState?Math.min(1,transformState.t/.35):0;
 const ATTACK_DUR=.34;
 const attackPhase=player.attackT>0?1-player.attackT/ATTACK_DUR:0;
 const charMesh=buildCharacterBuffers(pal,player.walkPhase,moving?1:0,player.helmet,"ranger",player.attackT>0?attackPhase:0,player.specialT>0,player.attackStyle);

 let eye,target;
 if(emergeCutscene){
  // scena bloccata sull'emersione: telecamera fissa di lato, leggermente
  // bassa, cosi' quello che sale dall'acqua si sente davvero grande.
  const racc=emergeCutscene.racc;
  const pushIn=emergeCutscene.phase==="rising"?Math.min(1,emergeCutscene.t/1.7)*1.2:0;
  // camera dalla spiaggia verso il mare: la linea d'acqua resta nel quadro,
  // cosi' e' inequivocabile che il mostro sale dall'acqua e NON dalla sabbia.
  eye=[racc.x+7.0-pushIn,2.3,RACC_SHORE_Z+5.0];
  target=[racc.x,emergeCutscene.phase==="buildup"?.15:1.5,racc.z];
 }else if(colosso&&(colosso.phase==="pose"||colosso.phase==="summon")){
  // Camera FRONTALE da vera chiamata toku: mai piu' i Ranger ripresi di
  // schiena mentre evocano i moduli. Durante ogni chiamata c'e' solo un
  // leggero pan orizzontale, mantenendo tutta la formazione leggibile.
  let fx=0;
  if(colosso.phase==="summon"){
   const idx=Math.min(MODULE_CALLS.length-1,Math.floor(colosso.t/MODULE_SEG));fx=(MODULE_CALLS[idx]?.x||0)*.20;
  }
  eye=[fx,3.25,ARENA_CZ-10.2];target=[fx*.55,1.45,ARENA_CZ+2.1];
 }else if(zone==="colosso"){
  const sh=colosso&&colosso.shakeT>0?colosso.shakeT:0;
  if(colosso&&colosso.phase==="finishing"){
   const t=colosso.finishT||0;
   if(t<1.55){eye=[colosso.robotX+7.5,11.8,colosso.robotZ+12.0];target=[colosso.robotX+1.7,7.8,colosso.robotZ];}
   else{const mx=(colosso.robotX+colosso.giantX)*.5,mz=(colosso.robotZ+colosso.giantZ)*.5;eye=[mx+13.5,10.7,mz+16.5];target=[mx,4.8,mz-1.5];}
  }else if(colosso&&colosso.phase==="won"){
   eye=[colosso.robotX+.8,10.2,colosso.robotZ+15.5];target=[colosso.robotX,5.6,colosso.robotZ];
  }else if(colosso&&colosso.phase==="combine"){
   // Regia BLINDATA: quattro shot fissi, nessuna orbita/camera libera che
   // possa finire dentro la mesh e sembrare bloccata.
   const t=colosso.t;
   if(t<2.0){eye=[10,3.4,ARENA_CZ+10];target=[-5,2.4,ARENA_CZ+2];}
   else if(t<4.3){eye=[13,6.2,ARENA_CZ+8];target=[-5,5.0,ARENA_CZ+2];}
   else if(t<6.4){eye=[8,10.5,ARENA_CZ+8];target=[-5,7.5,ARENA_CZ+2];}
   else{eye=[18,10.5,ARENA_CZ+8];target=[0,4.8,ARENA_CZ-2];}
  }else if(colosso&&colosso.phase==="reveal"){
   // Hero shot gia' raccordato con la camera del combattimento.
   eye=[13.5,11.8,ARENA_CZ+16];target=[0,4.8,ARENA_CZ-2];
  }else{
   // Camera 3/4 di battaglia ricostruita ogni frame. Non eredita gli shot
   // della combinazione; inquadra insieme Colosso, Raccoglitore e citta'.
   const mx=(colosso.robotX+colosso.giantX)*.5,mz=(colosso.robotZ+colosso.giantZ)*.5;
   eye=[mx+12.0+Math.sin(now/90)*sh*.30,10.8+Math.sin(now/75)*sh*.18,mz+15.0];
   target=[mx,4.4,mz-1.0];
  }
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
 const actorBaseY=zone==="bar"?barFloorY(player.x,player.z):0;
 eye=[eyeX,camState.height+actorBaseY*.35,eyeZ];
 if(dialogueActive&&dialogueFocus){
  // durante i dialoghi la telecamera gira a guardare chi sta parlando
  // invece di restare fissa sul giocatore — prima si capiva solo dal nome
  // scritto nel balloon, ora si vede anche chi si muove.
  target=[dialogueFocus.x,dialogueFocus.y,dialogueFocus.z];
 }else{
  target=[player.x,1.1+actorBaseY+zoomIn*.35,player.z];
 }
 }
 const view=mat4.lookAt(eye,target,[0,1,0]);
 const proj=mat4.perspective(60*Math.PI/180, c.width/c.height, .1, 140);
 const vp=mat4.multiply(proj,view);

 if(zone==="bar")gl.clearColor(.20,.30,.30,1);
 else if(zone==="arena"||zone==="colosso")gl.clearColor(.08,.10,.20,1);
 else if(zone==="archivio")gl.clearColor(.045,.05,.075,1);
 else gl.clearColor(.035,.04,.055,1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

 if(zone==="bar"){
  drawBuffer(barFloorBuf,mat4.identity(),vp);drawBuffer(barWallBuf,mat4.identity(),vp);drawBuffer(barPropsBuf,mat4.identity(),vp);
  if(barState.phase==="crisis"||barState.phase==="compat"||barState.phase==="after")drawBuffer(barCrisisBuf,mat4.identity(),vp);
  const corePulse=.78+Math.sin(now/120)*.22,coreY=barFloorY(BAR_CORE_POS.x,BAR_CORE_POS.z);
  if(barState.phase==="crisis"||barState.phase==="compat"){const coreBase=mul(mat4.translate(BAR_CORE_POS.x,coreY+1.85+Math.sin(now/240)*.12,BAR_CORE_POS.z),mat4.rotY(now/430));drawBuffer(barCoreBuf,mul(coreBase,mat4.scale(.34*corePulse,.34*corePulse,.34*corePulse)),vp,.98);drawBuffer(barCoreBuf,mul(coreBase,mat4.rotZ(Math.PI/4),mat4.scale(.56,.05,.56)),vp,.34);}
  for(let i=0;i<barTeam.length;i++){const b=barTeam[i],by=barFloorY(b.x,b.z),mv=Math.hypot(b.targetX-b.x,b.targetZ-b.z)>.14;let ap=0,astyle=0;if(b.activity==="karateTeacher"){ap=.15+.55*(Math.sin(now/410)*.5+.5);astyle=0;}else if(b.activity==="karateStudent"){ap=.10+.42*(Math.sin(now/410+1.2)*.5+.5);astyle=1;}drawShadow(b.x,b.z,.38,vp,.25,by);const bm=buildCharacterBuffers(b.pal,b.walk,mv?1:.08,false,"ranger",ap,false,astyle);drawDynamicMesh(bm,mul(mat4.translate(b.x,by,b.z),mat4.rotY(b.yaw)),vp);}
  if(!barState.friendSaved||barState.phase==="intro"||barState.phase==="free"){const fy=barFloorY(BAR_FRIEND_POS.x,BAR_FRIEND_POS.z);drawShadow(BAR_FRIEND_POS.x,BAR_FRIEND_POS.z,.36,vp,.24,fy);const fm=buildCharacterBuffers(PAL_AMICA,now/1000,.06,false,"ranger",0);drawDynamicMesh(fm,mul(mat4.translate(BAR_FRIEND_POS.x,fy,BAR_FRIEND_POS.z),mat4.rotY(2.7)),vp);}
  if(!barState.bartenderSaved||barState.phase==="intro"||barState.phase==="free"){const ty=barFloorY(BAR_BARTENDER_POS.x,BAR_BARTENDER_POS.z);drawShadow(BAR_BARTENDER_POS.x,BAR_BARTENDER_POS.z,.40,vp,.24,ty);const serving=(barState.phase==="intro"||barState.phase==="free")&&!barState.bartenderReady?(.12+.30*(Math.sin(now/420)*.5+.5)):0;const bm=buildCharacterBuffers(PAL_BARISTA,now/980,.04,false,"ranger",serving);drawDynamicMesh(bm,mul(mat4.translate(BAR_BARTENDER_POS.x,ty,BAR_BARTENDER_POS.z),mat4.rotY(0),mat4.scale(BAR_BARTENDER_SCALE,BAR_BARTENDER_SCALE,BAR_BARTENDER_SCALE)),vp);}
  if(!barState.customerGone&&(barState.phase==="intro"||barState.phase==="free")){const cy=barFloorY(barCustomer.x,barCustomer.z);drawShadow(barCustomer.x,barCustomer.z,.34,vp,.20,cy);const cm=buildCharacterBuffers(PAL_BAR_NPC,barCustomer.walk,.06,false,"ranger",0);drawDynamicMesh(cm,mul(mat4.translate(barCustomer.x,cy,barCustomer.z),mat4.rotY(barCustomer.yaw)),vp,.98);}
  if(barState.phase==="intro"||barState.phase==="idle"||barState.phase==="free"||barState.phase==="order"||barState.phase==="omen")for(let i=0;i<barExtras.length;i++){const e=barExtras[i],ey=barFloorY(e.x,e.z),mv=!e.workout&&Math.hypot(e.targetX-e.x,e.targetZ-e.z)>.14,ap=e.workout?(.18+.62*(Math.sin(now/380)*.5+.5)):0;const em=buildCharacterBuffers(e.pal,e.walk,mv?1:.05,false,"ranger",ap);drawShadow(e.x,e.z,.34,vp,.18,ey);drawDynamicMesh(em,mul(mat4.translate(e.x,ey,e.z),mat4.rotY(e.yaw)),vp,.98);}
  if(barState.phase==="crisis"){const mp=.8+Math.sin(now/150)*.2,fy=barFloorY(BAR_FRIEND_POS.x,BAR_FRIEND_POS.z),ty=barFloorY(BAR_BARTENDER_POS.x,BAR_BARTENDER_POS.z);if(!barState.friendSaved&&!barState.deadlineExpired)drawBuffer(barCoreBuf,mul(mat4.translate(BAR_FRIEND_POS.x,fy+2.45,BAR_FRIEND_POS.z),mat4.rotY(now/420),mat4.scale(.12*mp,.28*mp,.12*mp)),vp,.72);if(!barState.bartenderSaved&&!barState.deadlineExpired)drawBuffer(barCoreBuf,mul(mat4.translate(BAR_BARTENDER_POS.x,ty+2.45,BAR_BARTENDER_POS.z),mat4.rotY(-now/420),mat4.scale(.12*mp,.28*mp,.12*mp)),vp,.72);const my=barFloorY(barState.monsterX,barState.monsterZ),mm=buildCharacterBuffers(PAL_BAR_MONSTER,now/180,1,true,"scagnozzo",.35);drawShadow(barState.monsterX,barState.monsterZ,.34,vp,.34,my);drawDynamicMesh(mm,mul(mat4.translate(barState.monsterX,my,barState.monsterZ),mat4.rotY(Math.atan2(player.x-barState.monsterX,player.z-barState.monsterZ)),mat4.scale(.72,.78,.72)),vp);}
 }else if(zone==="torre"){
  drawBuffer(floorBuf,mat4.identity(),vp);
  drawBuffer(wallBuf,mat4.identity(),vp);
  drawBuffer(doorFrameBuf,mat4.identity(),vp);
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

  // Squadra viva nella Torre: civili durante briefing/rientro, Ranger solo
  // quando la puntata e' in allarme. I waypoint post-boss li fanno realmente
  // attraversare la sala e lavorare alle console invece di stare in fila.
  for(let mi=0;mi<teamMembers.length;mi++){
   const m=teamMembers[mi];drawShadow(m.x,m.z,.40,vp);const idlePhase=m.walk+now/1300+mi*.7;
   const isSpeaking=dialogueActive&&dialogueQueue[dialogueIndex]&&dialogueQueue[dialogueIndex].speaker===m.name;
   const armored=teamMode==="ranger",pal=armored?m.pal:m.civPal;
   const movingTeam=Math.hypot(m.targetX-m.x,m.targetZ-m.z)>.10;
   const mesh=buildCharacterBuffers(pal,idlePhase,movingTeam?1:.10,armored,"ranger",0);
   const bump=isSpeaking?1.045:1;drawDynamicMesh(mesh,mul(mat4.translate(m.x,0,m.z),mat4.rotY(m.yaw+Math.sin(idlePhase*.25)*.025),mat4.scale(bump,bump,bump)),vp);
  }

  // TIC: pattuglia tra i pannelli laterali facendo finta di controllarli,
  // invece di restare fermo a fluttuare sempre nello stesso punto.
  const ticPos=getTowerTicPosition(now);
  const ticX=ticPos.x,ticZ=ticPos.z,ticY=2.1+Math.sin(now/500)*.10;
  const ticFaceYaw=Math.atan2(ticPos.pB.x-ticPos.pA.x,ticPos.pB.z-ticPos.pA.z);
  const ticModel=mul(mat4.translate(ticX,ticY,ticZ),mat4.rotY(ticFaceYaw));
  drawBuffer(ticBuf,ticModel,vp);
 }else if(zone==="arena"){
  drawArenaBackdrop(vp);
  drawBuffer(arenaFloorBuf,mat4.identity(),vp);
  drawBuffer(arenaSeaBuf,mat4.identity(),vp);
  drawBuffer(arenaPropBuf,mat4.identity(),vp);
  drawBuffer(arenaEdgeBuf,mat4.identity(),vp);
  drawSupportDrops(vp,now);
  // La squadra combatte con Zero: AI volutamente leggera, ma visivamente
  // presente per tutta la missione invece di sparire dopo il briefing.
  if(!colossoTeamPos){
   for(let ai=0;ai<arenaAllies.length;ai++){
    const a=arenaAllies[ai];drawShadow(a.x,a.z,.38,vp,.28);
    const ap=a.attackT>0?1-a.attackT/.38:0;
    const am=buildCharacterBuffers(a.pal,a.walk,1,true,"ranger",ap,false,a.attackStyle);
    drawDynamicMesh(am,mul(mat4.translate(a.x,0,a.z),mat4.rotY(a.yaw),mat4.scale(.96,.96,.96)),vp,.95);
   }
  }
  for(const en of enemies){
   if(en.dead||en.hidden)continue;
   drawShadow(en.x,en.z,.40*en.scale,vp,.35*(en.alpha!==undefined?en.alpha:1));
   const hitPulse=en.hitFlash>0?1+en.hitFlash*1.6:1;
   // Il preavviso ora si vede: il nemico pulsa un po' piu' grande mentre
   // carica il colpo, crescendo man mano che si avvicina il rilascio —
   // senza questo la finestra di windup sarebbe comunque invisibile e
   // schivare resterebbe solo fortuna.
   const windupDur=en.type==="raccoglitore"?.55:.42;
   const windupPulse=en.windupT>0?1+(1-en.windupT/windupDur)*.22*(1+Math.sin(now/55)*.15):1;
   const s=en.scale*hitPulse*windupPulse;
   const enAttackPhase=en.attackFlashT>0?1-en.attackFlashT/.5:0;
   const enMoving=en.state!=="retreat"&&facingDot(en.x,en.z,en.yaw,player.x,player.z).dist>(en.type==="raccoglitore"?2.05:1.65);
   const enMesh=buildCharacterBuffers(en.pal,en.walkPhaseE,enMoving?1:0,true,en.type,en.attackFlashT>0?enAttackPhase:0);
   const enModel=mul(mat4.translate(en.x,en.y||0,en.z),mat4.rotY(en.yaw),mat4.scale(s,s,s));
   drawDynamicMesh(enMesh,enModel,vp,en.alpha);
   if(en.windupT>0){
    // Pop del "!": scatta subito a dimensione piena (niente crescita lenta,
    // deve saltare all'occhio) poi rimbalza leggermente mentre il windup
    // prosegue — billboard vero verso la camera, sempre leggibile.
    const wp=1-en.windupT/windupDur;
    const popIn=Math.min(1,wp/.18);
    const bounce=1+Math.sin(wp*Math.PI*3.2)*.10*(1-wp*.5);
    const exSize=(en.type==="raccoglitore"?.62:.46)*popIn*bounce;
    const exYaw=Math.atan2(eye[0]-en.x,eye[2]-en.z);
    const exY=(en.y||0)+(en.type==="raccoglitore"?2.75*en.scale:2.15*s);
    const exBase=mul(mat4.translate(en.x,exY,en.z),mat4.rotY(exYaw));
    drawBuffer(exclaimBarBuf,mul(exBase,mat4.translate(0,exSize*.30,0),mat4.scale(exSize*.16,exSize*.62,.02)),vp,popIn);
    drawBuffer(exclaimDotBuf,mul(exBase,mat4.translate(0,-exSize*.16,0),mat4.scale(exSize*.16,exSize*.16,.02)),vp,popIn);
   }
   if(en.state!=="retreat"){
    const barYaw=Math.atan2(eye[0]-en.x,eye[2]-en.z);
    const barY=(en.y||0)+(en.type==="raccoglitore"?2.55*en.scale:1.95*s);
    drawEnemyHpBar(en.x,barY,en.z,en.hp/en.hpMax,barYaw,vp);
   }
  }
  if(colosso&&colosso.phase==="summon")drawSummonedModules(vp,now);
  if(colossoTeamPos){
   for(let pi=0;pi<colossoTeamPos.length;pi++){
    const tp=colossoTeamPos[pi];
    // Posa toku semplice: braccio destro alzato tramite il rig d'attacco,
    // tutti rivolti verso il mare. Nessun corpo finisce sopra un altro.
    const poseArm=colosso&&colosso.t>1.55?.30+(pi%2)*.08:0;
    const tMesh=buildCharacterBuffers(tp.pal,now/900,.08,true,"ranger",poseArm);
    drawDynamicMesh(tMesh,mul(mat4.translate(tp.x,0,tp.z),mat4.rotY(tp.yaw||Math.PI)),vp);
   }
  }
 }else if(zone==="colosso"&&colosso){
  drawArenaBackdrop(vp);
  drawBuffer(giantStageBuf,mat4.identity(),vp);drawBuffer(giantCityBuf,mat4.identity(),vp,.98);

  const giantWobble=1+Math.sin(now/260)*.02;
  const gAtk=colosso.giantAttackT>0?1-colosso.giantAttackT/.58:0;
  const gLunge=Math.sin(Math.max(0,Math.min(1,gAtk))*Math.PI)*1.2;
  // Il Raccoglitore NON cade piu' in avanti sul Colosso. Dopo il fendente
  // viene spinto verso il mare (-Z), poi crolla all'indietro lontano dal robot.
  const fallP=colosso.phase==="finishing"?Math.max(0,Math.min(1,((colosso.finishT||0)-2.20)/1.35)):(colosso.phase==="won"?1:0);
  const gx=colosso.giantX, gz=colosso.giantZ+gLunge-fallP*7.2;
  const gy=-fallP*2.4;
  const gyaw=Math.atan2(colosso.robotX-gx,colosso.robotZ-gz);
  const gm=mul(mat4.translate(gx,gy,gz),mat4.rotY(gyaw),mat4.rotX(-fallP*1.02),mat4.scale(colosso.giantScale*giantWobble,colosso.giantScale,colosso.giantScale*giantWobble));
  const giantPal=colosso.phase2?PAL_RACCOGLITORE_OVERLOAD:PAL_RACCOGLITORE;
  const giantMesh=buildCharacterBuffers(giantPal,now/450,gAtk>0?1:.15,true,"raccoglitore",gAtk);
  drawDynamicMesh(giantMesh,gm,vp);

  // Colosso sempre visibile: cutscene + fight 3/4 + finisher.
  const rp=colosso.phase==="combine"?Math.min(1,colosso.t/8):1;
  const fightYaw=Math.atan2(colosso.giantX-colosso.robotX,colosso.giantZ-colosso.robotZ);
  let rYaw=fightYaw;
  if(colosso.phase==="won"){
   // Si gira verso la telecamera invece di restare rivolto verso il nemico
   // a terra — la posa "vittoria" vera, non solo un fermo immagine.
   const camYaw=Math.atan2(eye[0]-colosso.robotX,eye[2]-colosso.robotZ);
   const turnP=Math.min(1,(colosso.winT||0)/1.1),te=1-Math.pow(1-turnP,3);
   let d=camYaw-fightYaw; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2;
   rYaw=fightYaw+d*te;
  }
  const rAtk=colosso.punchT>0?1-colosso.punchT/.48:0;
  const rGuard=colosso.guardT>0?Math.min(1,colosso.guardT/.58):0;
  const fT=colosso.finishT||0;
  const swordDrop=colosso.phase==="finishing"?Math.max(0,Math.min(1,(fT-.62)/.88)):(colosso.phase==="won"?1:0);
  const slash=colosso.phase==="finishing"?Math.max(0,Math.min(1,(fT-1.55)/.78)):0;
  const victory=colosso.phase==="won"?Math.min(1,(colosso.winT||0)/1.15):0;
  drawColossoRobot(vp,rp,now,{x:colosso.robotX,z:colosso.robotZ,yaw:rYaw,targetX:gx,targetZ:gz,attack:rAtk,guard:rGuard,swordDrop,slash,victory});

  if(colosso.phase==="finishing"){
   const ep=Math.min(1,(colosso.finishT||0)/2);
   drawBuffer(burstBuf,mul(mat4.translate(gx,5.0,gz),mat4.scale(1+ep*8,.7+ep*5,1+ep*8)),vp,Math.max(0,1-ep*.55));
  }
  if(colosso.phase==="fight"||colosso.phase==="finishing"){
   for(const b of colosso.beamBursts){
    if(b.kind==="swordLightning"){
     const p=Math.max(0,b.t/.32),a=Math.max(0,1-p),sx=colosso.robotX+2.8+(b.ox||0),sy=9.0+(b.oy||0),sz=colosso.robotZ+.2;
     drawBuffer(burstBuf,mul(mat4.translate(sx,sy,sz),mat4.scale(.18+p*.35,.35+p*.8,.18+p*.35)),vp,a*.95);
    }else if(b.kind==="punch"){
     const p=b.t/.4,sc=.4+p*2.2,a=Math.max(0,1-p);
     const ix=(colosso.robotX+gx)/2+(b.ox||0)*.3, iz=(colosso.robotZ+gz)/2;
     drawBuffer(burstBuf,mul(mat4.translate(ix,7.0+(b.oy||0),iz),mat4.scale(sc,sc,sc)),vp,a*.9);
    }else if(b.kind==="enemyHit"){
     const p=b.t/.4,sc=.4+p*2.2,a=Math.max(0,1-p);
     const ix=colosso.robotX+(b.ox||0)*.3, iz=colosso.robotZ;
     drawBuffer(burstBuf,mul(mat4.translate(ix,7.0+(b.oy||0),iz),mat4.scale(sc,sc,sc)),vp,a*.9);
    }else if(b.kind==="enemyBeam"){
     const p=b.t/.4,a=Math.max(0,1-p),dx=colosso.robotX-gx,dz=colosso.robotZ-gz,len=Math.hypot(dx,dz)||1;
     const mx=(gx+colosso.robotX)/2,mz=(gz+colosso.robotZ)/2,yaw=Math.atan2(dx,dz);
     drawBuffer(burstBuf,mul(mat4.translate(mx,5.8+(b.oy||0),mz),mat4.rotY(yaw),mat4.scale(.48,.48,len)),vp,a*.72);
    }else{
     const p=b.t/.4,a=Math.max(0,1-p),dx=gx-colosso.robotX,dz=gz-colosso.robotZ,len=Math.hypot(dx,dz)||1;
     const mx=(gx+colosso.robotX)/2,mz=(gz+colosso.robotZ)/2,yaw=Math.atan2(dx,dz);
     // Y del petto scalato: prima era un valore fisso (5.3) tarato sul
     // Colosso vecchio, non scalato — con l'aumento di taglia (1.62x) finiva
     // per allinearsi con l'anca invece che col petto. Ora segue la stessa
     // COLOSSO_SCALE del modello (petto ~y=5.0 in unita' locali).
     drawBuffer(burstBuf,mul(mat4.translate(mx,5.0*1.62,mz),mat4.rotY(yaw),mat4.scale(.36,.36,len)),vp,a*.85);
    }
   }
  }
 }else if(zone==="archivio"){
  drawBuffer(archivioFloorBuf,mat4.identity(),vp);drawBuffer(archivioWallBuf,mat4.identity(),vp);drawBuffer(archivioHelmetBuf,mat4.identity(),vp);drawBuffer(archivioTerminalBuf,mat4.identity(),vp);drawBuffer(archivioSystemBuf,mat4.identity(),vp);drawBuffer(archivioOculoFrameBuf,mat4.identity(),vp);drawBuffer(archivioFillerBuf,mat4.identity(),vp);
  // v51.1: Oculo e' sempre percepibile nell'Archivio (dim), poi diventa
  // enorme e quasi pienamente luminoso durante il reveal. E' sopra la capsula
  // ZERO, quindi il giocatore non deve piu' "indovinare" dove si trova.
  drawTexturedQuad(oculoTex,
   mul(mat4.translate(ARCH_OCULO_POS.x,ARCH_OCULO_POS.y,ARCH_OCULO_POS.z+.04),
       mat4.scale(archiveState.revealing?5.75:5.25,archiveState.revealing?2.35:2.05,1)),
   vp,archiveState.revealing?.98:.58);
  // Solo Meridiana e TIC entrano nell'Archivio. Gli altri membri non vengono
  // neppure renderizzati in questa zona, quindi non possono seguirti per bug.
  drawShadow(archiveCompanion.meriX,archiveCompanion.meriZ,.38,vp,.28);
  const meriMoving=Math.hypot(archiveCompanion.meriTX-archiveCompanion.meriX,archiveCompanion.meriTZ-archiveCompanion.meriZ)>.10;
  const meriMesh=buildCharacterBuffers(PAL_MERIDIANA_CIV,now/900,meriMoving?1:.10,false,"ranger",0);
  drawDynamicMesh(meriMesh,mul(mat4.translate(archiveCompanion.meriX,0,archiveCompanion.meriZ),mat4.rotY(archiveCompanion.meriYaw)),vp,1);
  drawBuffer(ticBuf,mul(mat4.translate(archiveCompanion.ticX,2.0+Math.sin(now/420)*.08,archiveCompanion.ticZ),mat4.rotY(Math.PI)),vp);
  drawBuffer(capsuleFrameBuf,mat4.identity(),vp);
  for(let ci=0;ci<CAPSULE_POS.length;ci++){
   const cp=CAPSULE_POS[ci],pulse=.75+Math.sin(now/620+ci*1.3)*.25;
   drawBuffer(capsuleGlassBuf,mul(mat4.translate(cp.x,1.18,cp.z+.34),mat4.scale(1.02,1.04,1)),vp,.34);
   drawBuffer(capsuleBeamBuf,mul(mat4.translate(cp.x,3.75,cp.z),mat4.scale(.48*pulse,3.1,.48*pulse)),vp,.13*pulse);
   const awake=(ci===0&&archiveState.capsuleAwake);
   const rMesh=buildCharacterBuffers(capsuleRangerPals[ci],awake?now/260:0,0,true,"ranger",awake?.28:0);
   drawDynamicMesh(rMesh,mul(mat4.translate(cp.x,0,cp.z+.06),mat4.rotY(Math.PI)),vp,awake?.92:.72);
  }
  // Frame ZERO: completamente vuoto, piu' caldo e separato dalle altre file.
  drawBuffer(zeroCapsuleBuf,mat4.identity(),vp);
  const zp=.72+Math.sin(now/520)*.22;
  drawBuffer(zeroGlassBuf,mul(mat4.translate(ZERO_CAPSULE_POS.x,1.30,ZERO_CAPSULE_POS.z+.36),mat4.scale(1.20,1.20,1)),vp,.22+.12*zp);
  drawBuffer(capsuleBeamBuf,mul(mat4.translate(ZERO_CAPSULE_POS.x,3.95,ZERO_CAPSULE_POS.z),mat4.scale(.42*zp,3.4,.42*zp)),vp,.10*zp);
 }

 if(zone!=="colosso"){
  const py=zone==="bar"?barFloorY(player.x,player.z):0;
  drawShadow(player.x,player.z,.42,vp,undefined,py);
  const charModel=mul(mat4.translate(player.x,py,player.z),mat4.rotY(player.yaw));
  drawDynamicMesh(charMesh,charModel,vp);
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

// Helper solo in modalita' sviluppo: aggiungere ?dev=1 all'URL.
if(DEV_MODE)window.__rz={player,camState,startTransformation,enterArena,enterTorre,advanceDialogue,triggerGameOver,
 startColossoSequence,startColossoFightDirect,colossoPunch,colossoSpecial,colossoGuard,startArchiveSequence,showChoiceScreen,triggerEnding,restoreCheckpoint,doTowerNpcInteract,doArchiveInteract,startTransformation,
 get enemies(){return enemies},get arenaAllies(){return arenaAllies},get arenaWave(){return arenaWave},get colossoTeamPos(){return colossoTeamPos},get teamMembers(){return teamMembers},get introFreeRoam(){return introFreeRoam},get introTalked(){return introTalked},get teamMode(){return teamMode},get morphUnlocked(){return morphUnlocked},get archiveState(){return archiveState},get nearInteractable(){return nearInteractable},get zone(){return zone},get dialogueActive(){return dialogueActive},
 get dialogueIndex(){return dialogueIndex},get gameOverActive(){return gameOverActive},get colosso(){return colosso}};
})();
