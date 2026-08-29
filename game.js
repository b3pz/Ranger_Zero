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
 if(cullWas)gl.enable(gl.CULL_FACE);
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
 gl.depthMask(true);gl.disable(gl.BLEND);if(cullWas)gl.enable(gl.CULL_FACE);gl.useProgram(prog);
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
  menaceEye:boxMesh([1.0,.10,.04]),
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

// Mini-citta' scenografica per lo scontro gigante: non e' una nuova mappa,
// sono solo volumi PS1 molto piccoli ai piedi dei due giganti. Serve a dare
// immediatamente la scala tokusatsu senza creare un livello urbano completo.
const cityParts=[];
const cityCols=[[.24,.27,.31],[.30,.30,.29],[.20,.25,.29],[.34,.28,.24]];
const cityLayout=[
 [-9,-65,1.3,1.5,1.1],[-7,-63,1.5,2.0,1.4],[-9,-60,1.2,1.0,1.0],[-6,-57,1.8,1.3,1.3],
 [-3,-66,1.0,.8,1.0],[-1,-64,1.5,1.2,1.2],[2,-66,1.3,1.8,1.0],[5,-64,1.7,1.1,1.4],
 [8,-66,1.2,2.2,1.0],[9,-61,1.5,1.4,1.3],[7,-57,1.1,.9,1.1],[4,-55,1.4,1.7,1.0],
 [-8,-53,1.5,1.0,1.2],[-4,-53,1.2,1.5,1.0],[0,-53,1.7,2.0,1.4],[5,-52,1.2,1.1,1.1]
];
cityParts.push({mesh:boxMesh([.10,.11,.13]),mtx:mul(mat4.translate(0,.015,-59.5),mat4.scale(23,.03,15))});
for(let i=0;i<cityLayout.length;i++){
 const [x,z,w,h,d]=cityLayout[i], col=cityCols[i%cityCols.length];
 cityParts.push({mesh:boxMesh(col),mtx:mul(mat4.translate(x,h/2,z),mat4.scale(w,h,d))});
 // tetto/antenna semplice su alcuni edifici
 if(i%4===1)cityParts.push({mesh:boxMesh([.42,.44,.46]),mtx:mul(mat4.translate(x,h+.35,z),mat4.scale(.08,.7,.08))});
}
// due strade chiare che tagliano la citta' e fanno leggere ancora meglio la scala.
cityParts.push({mesh:boxMesh([.18,.18,.19]),mtx:mul(mat4.translate(0,.04,-59.5),mat4.scale(22,.04,.9))});
cityParts.push({mesh:boxMesh([.18,.18,.19]),mtx:mul(mat4.translate(0,.045,-59.5),mat4.scale(.9,.04,14))});
const giantCityBuf=makeBuffer(bakeParts(cityParts));

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
 zero:makeBuffer(boxMesh(PAL_ZERO.suit)), bronze:makeBuffer(boxMesh(PAL_ZERO.accent)),
 red:makeBuffer(boxMesh(PAL_ARCO.suit)), blue:makeBuffer(boxMesh(PAL_MERIDIANA.suit)),
 violet:makeBuffer(boxMesh(PAL_RANGER3.suit)), green:makeBuffer(boxMesh(PAL_RANGER4.suit)),
 dark:makeBuffer(boxMesh([.08,.09,.12])), cyan:makeBuffer(boxMesh([.22,.92,1.0])),
 gold:makeBuffer(boxMesh([.86,.65,.18]))
};
function partProgress(p,a,b){return Math.max(0,Math.min(1,(p-a)/(b-a)));}
function easeOut3(t){return 1-Math.pow(1-t,3);}
function drawColossoRobot(vp,p,now,opts){
 opts=opts||{};
 const wx=opts.x===undefined?-5.2:opts.x, wz=opts.z===undefined?ARENA_CZ+1.0:opts.z;
 const yaw=opts.yaw===undefined?Math.PI:opts.yaw;
 const attack=Math.max(0,Math.min(1,opts.attack||0));
 const guard=Math.max(0,Math.min(1,opts.guard||0));
 const lunge=Math.sin(attack*Math.PI)*1.25;
 const gx=opts.targetX===undefined?5.0:opts.targetX, gz=opts.targetZ===undefined?ARENA_CZ-5.0:opts.targetZ;
 const dirX=gx-wx,dirZ=gz-wz,dl=Math.hypot(dirX,dirZ)||1;
 const base=mul(mat4.translate(wx+dirX/dl*lunge,0,wz+dirZ/dl*lunge),mat4.rotY(yaw),mat4.rotZ(guard*.035*Math.sin(now/90)));
 const drawPart=(buf,fx,fy,fz,sx,sy,sz,stage,fromX,fromY,fromZ,rz=0)=>{
  const q=easeOut3(partProgress(p,stage,Math.min(1,stage+.24)));
  if(q<=0)return;
  let x=fromX+(fx-fromX)*q, y=fromY+(fy-fromY)*q, z=fromZ+(fz-fromZ)*q;
  // Il braccio blu e' quello che legge meglio come pugno nella camera 3/4.
  if(buf===COLOSSO_BOX.blue){z+=attack*1.8;y-=attack*.15;}
  if(guard>0&&(buf===COLOSSO_BOX.red||buf===COLOSSO_BOX.blue)){z+=guard*.9;y+=guard*.25;}
  drawBuffer(buf,mul(base,mat4.translate(x,y,z),mat4.rotZ(rz*(1-q)),mat4.scale(sx,sy,sz)),vp);
 };
 drawPart(COLOSSO_BOX.violet,-.92,2.0,0,1.25,3.6,1.35,.00,-8,-1,3,.5);
 drawPart(COLOSSO_BOX.green,.92,2.0,0,1.25,3.6,1.35,.05,8,-1,3,-.5);
 drawPart(COLOSSO_BOX.dark,-.92,.35,.28,1.45,.65,1.9,.04,-8,-2,5,.3);
 drawPart(COLOSSO_BOX.dark,.92,.35,.28,1.45,.65,1.9,.09,8,-2,5,-.3);
 drawPart(COLOSSO_BOX.zero,0,5.0,0,3.25,3.0,1.75,.20,0,-5,8,0);
 drawPart(COLOSSO_BOX.red,-2.25,5.0,0,1.25,3.1,1.25,.37,-10,7,2,.7);
 drawPart(COLOSSO_BOX.blue,2.25,5.0,0,1.25,3.1,1.25,.43,10,7,2,-.7);
 drawPart(COLOSSO_BOX.dark,-2.25,3.15,.15,1.05,1.15,1.15,.41,-11,5,4,.4);
 drawPart(COLOSSO_BOX.dark,2.25,3.15,.15,1.05,1.15,1.15,.47,11,5,4,-.4);
 drawPart(COLOSSO_BOX.bronze,0,7.35,0,1.65,1.45,1.55,.60,0,14,2,0);
 drawPart(COLOSSO_BOX.cyan,0,7.45,.79,1.20,.43,.08,.68,0,14,2,0);
 drawPart(COLOSSO_BOX.gold,0,8.35,-.05,.24,.65,1.35,.74,0,15,0,0);
 // Placche cromatiche della squadra sul COLOSSO: qui e' chiarissimo che
 // sono i cinque moduli Ranger a formare l'armatura del robot.
 const armorQ=partProgress(p,.55,1);
 if(armorQ>0){
  drawBuffer(COLOSSO_BOX.red,mul(base,mat4.translate(-1.55,5.65,.92),mat4.scale(.62,.38,.10)),vp,armorQ);
  drawBuffer(COLOSSO_BOX.blue,mul(base,mat4.translate(1.55,5.65,.92),mat4.scale(.62,.38,.10)),vp,armorQ);
  drawBuffer(COLOSSO_BOX.violet,mul(base,mat4.translate(-.88,2.35,.76),mat4.scale(.40,.95,.08)),vp,armorQ);
  drawBuffer(COLOSSO_BOX.green,mul(base,mat4.translate(.88,2.35,.76),mat4.scale(.40,.95,.08)),vp,armorQ);
 }
 const q=partProgress(p,.78,1);
 if(q>0){
  const pulse=.88+Math.sin(now/110)*.12;
  drawBuffer(COLOSSO_BOX.gold,mul(base,mat4.translate(0,5.35,.93),mat4.scale(1.0,.48,.09)),vp,q);
  drawBuffer(COLOSSO_BOX.cyan,mul(base,mat4.translate(0,5.35,1.04),mat4.scale(.25*pulse,.25*pulse,.05)),vp,q);
 }
}
function newColossoState(phase){
 return {phase:phase||"fight",t:0,giantHp:520,giantHpMax:520,playerHp:100,playerHpMax:100,
  giantScale:7.15,attackCd:2.9,punchT:0,punchCd:0,beamT:0,shakeT:0,beamBursts:[],guardT:0,guardCd:0,
  perfectGuard:false,attackTelegraph:false,attackKind:"punch",phase2:false,finisherReady:false,messageT:0,
  robotX:-5.0,robotZ:ARENA_CZ+2.0,giantX:5.0,giantZ:ARENA_CZ-5.0,giantAttackT:0};
}
function startColossoSequence(){
 if(colosso)return;
 colosso=newColossoState("converge");
 colosso.giantScale=1.55;
 missionHintEl.textContent="OCULO // PROTOCOLLO COLOSSO!";
 missionHintEl.classList.add("show");
 colossoHpWrapEl.classList.add("show");
 sfx.teleport();
 // Usa ESATTAMENTE i quattro Ranger che stavano combattendo sulla spiaggia:
 // niente cloni aggiuntivi durante la combinazione.
 colossoTeamPos=arenaAllies.map(a=>({startX:a.x,startZ:a.z,x:a.x,z:a.z,pal:a.pal,name:a.name}));
}
function startColossoFightDirect(){
 clearTransientState();
 zone="colosso";
 player.transformed=true;player.helmet=true;player.hp=player.hpMax;player.energy=0;
 colosso=newColossoState("fight");
 colossoTeamPos=null;
 colossoHpWrapEl.classList.add("show");
 missionHintEl.classList.remove("show");
 playAmbient("colosso");
 saveCheckpoint("colosso");
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
 colosso.beamBursts.push({t:0,kind:"punch",ox:(Math.random()-.5)*2.2,oy:Math.random()*1.6-.2});
 sfx.giantHit(); triggerSlowMo(.09,.08); updateColossoThresholds();
}
function colossoSpecial(){
 if(!colosso||colosso.phase!=="fight"||colosso.beamT>0||colosso.punchT>0)return;
 if(colosso.finisherReady){
  colosso.beamT=.8;player.energy=0;colosso.giantHp=0;
  colosso.beamBursts.push({t:0,kind:"beam"});
  specialFlashEl.style.opacity=1;setTimeout(()=>specialFlashEl.style.opacity=0,190);
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
 colosso.phase="finishing";colosso.finishT=0;colosso.finishZoom=0;colosso.finishTilt=0;
 missionHintEl.textContent="COLPO FINALE // IMPATTO";missionHintEl.classList.add("show");
 triggerSlowMo(2.2,.22);sfx.alarm();
}
function updateColossoFinish(dt){
 colosso.finishT+=dt;const p=Math.min(1,colosso.finishT/2.0);colosso.finishZoom=p;colosso.finishTilt=p*p*1.1;
 if(colosso.finishT>2.0)colossoWin();
}
function colossoWin(){
 colosso.phase="won";missionHintEl.textContent="IL RACCOGLITORE E' STATO RESPINTO";sfx.win();
 afterGame(900,()=>{colossoOutcomeEl.querySelector("h1").textContent="VITTORIA";
  colossoOutcomeEl.querySelector("p").textContent="Il Colosso ha respinto Il Raccoglitore nel mare.";
  colossoOutcomeEl.classList.add("show","win");});
}
function colossoLose(){
 colosso.phase="lost";colossoOutcomeEl.querySelector("h1").textContent="IL COLOSSO CROLLA";
 colossoOutcomeEl.querySelector("p").textContent="Riprova dal checkpoint del Colosso.";
 colossoOutcomeEl.classList.remove("win");colossoOutcomeEl.classList.add("show");sfx.lose();
}
function updateColosso(dt){
 if(!colosso)return;colosso.t+=dt;
 if(colosso.phase==="converge"){
  const p=Math.min(1,colosso.t/1.5),ease=1-Math.pow(1-p,3);
  for(const tp of colossoTeamPos){tp.x=tp.startX+(player.x-tp.startX)*ease;tp.z=tp.startZ+(player.z-tp.startZ)*ease;}
  if(colosso.t>1.5){
   colosso.phase="combine";colosso.t=0;colossoTeamPos=null;zone="colosso";colosso.giantScale=2.2;
   flashEl.style.opacity=1;setTimeout(()=>flashEl.style.opacity=0,220);sfx.transform();playAmbient("colosso");
   missionHintEl.textContent="COMBINAZIONE COLOSSO // MODULI IN AGGANCIO";
  }return;
 }
 if(colosso.phase==="combine"){
  const p=Math.min(1,colosso.t/8.0);colosso.giantScale=2.2+p*4.95;
  if(colosso.t>2.0&&colosso.t<4.2)missionHintEl.textContent="GAMBE // NUCLEO // BRACCIA";
  else if(colosso.t>=4.2&&colosso.t<6.5)missionHintEl.textContent="TESTA // SISTEMI ONLINE";
  else if(colosso.t>=6.5)missionHintEl.textContent="COLOSSO RANGER // COMBINAZIONE COMPLETA";
  if(colosso.t>8.0){colosso.phase="reveal";colosso.t=0;sfx.win();}
  return;
 }
 if(colosso.phase==="reveal"){
  if(colosso.t>2.7){colosso.phase="fight";colosso.t=0;missionHintEl.classList.remove("show");saveCheckpoint("colosso");}
  return;
 }
 if(colosso.phase==="finishing"){updateColossoFinish(dt);return;}
 if(colosso.phase!=="fight")return;
 colosso.punchT=Math.max(0,colosso.punchT-rawDtGlobal);colosso.punchCd=Math.max(0,(colosso.punchCd||0)-rawDtGlobal);colosso.beamT=Math.max(0,colosso.beamT-rawDtGlobal);
 colosso.giantAttackT=Math.max(0,(colosso.giantAttackT||0)-rawDtGlobal);
 colosso.shakeT=Math.max(0,colosso.shakeT-dt);colosso.guardT=Math.max(0,colosso.guardT-rawDtGlobal);colosso.guardCd=Math.max(0,(colosso.guardCd||0)-rawDtGlobal);
 // Piccolo footwork automatico: non sono piu' due statue.
 colosso.robotX=-5.0+Math.sin(colosso.t*.55)*.65;
 colosso.giantX=5.0+Math.sin(colosso.t*.43+1.6)*.72;
 if(colosso.messageT>0){colosso.messageT-=rawDtGlobal;if(colosso.messageT<=0&&!colosso.finisherReady&&!colosso.attackTelegraph)missionHintEl.classList.remove("show");}
 for(let i=colosso.beamBursts.length-1;i>=0;i--){colosso.beamBursts[i].t+=dt;if(colosso.beamBursts[i].t>.55)colosso.beamBursts.splice(i,1);}
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
  if(colosso.attackKind==="beam")colosso.beamBursts.push({t:0,kind:"enemyBeam"});
  colosso.shakeT=guarded?.18:.44;colosso.playerHp=Math.max(0,colosso.playerHp-dmg);
  if(guarded){missionHintEl.textContent=colosso.perfectGuard?"GUARDIA PERFETTA":"GUARDIA";missionHintEl.classList.add("show");colosso.messageT=.55;sfx.dodge();}
  else sfx.hitPlayer();
  const kinds=["punch","slam","beam"];colosso.attackKind=kinds[Math.floor(Math.random()*kinds.length)];
  colosso.attackCd=colosso.phase2?2.05:2.75;colosso.attackTelegraph=false;colosso.perfectGuard=false;
  if(colosso.playerHp<=0)colossoLose();
 }
}
document.getElementById("colossoOutcomeBtn").addEventListener("click",()=>{
 colossoOutcomeEl.classList.remove("show");
 if(colosso&&colosso.phase==="lost"){restoreCheckpoint("colosso");return;}
 colosso=null;missionHintEl.classList.remove("show");colossoHpWrapEl.classList.remove("show");
 archivioUnlocked=true;postBossState=true;enterTorre();saveCheckpoint("postboss");
 afterGame(450,()=>playDialogue(postBossLines,()=>{
  missionHintEl.textContent="CONTROLLA IL PANNELLO ANOMALO";missionHintEl.classList.add("show");
 }));
});

let enemies=[];
let arenaWave=0,arenaWaveTransition=false;
let arenaAllies=[];
const RACC_SEA_Z=ARENA_CZ-ARENA_D/2+2.8;
const RACC_SHORE_Z=SEA_EDGE_Z+.85;
function makeMook(x,z,cd){return {type:"scagnozzo",pal:PAL_SCAGNOZZO,x,z,yaw:0,hp:30,hpMax:30,state:"idle",cd:cd||0,scale:1,alpha:1,dead:false,walkPhaseE:0,hitFlash:0,attackFlashT:0};}
function initArenaAllies(){
 arenaAllies=[
  {name:"ARCO",pal:PAL_ARCO,x:ARENA_CX-5.5,z:ARENA_CZ+6.5,yaw:Math.PI,cd:.2,attackT:0,walk:0},
  {name:"MERIDIANA",pal:PAL_MERIDIANA,x:ARENA_CX+5.5,z:ARENA_CZ+6.0,yaw:Math.PI,cd:.7,attackT:0,walk:1},
  {name:"RANGER V",pal:PAL_RANGER3,x:ARENA_CX-7.0,z:ARENA_CZ+3.0,yaw:Math.PI,cd:1.0,attackT:0,walk:2},
  {name:"RANGER G",pal:PAL_RANGER4,x:ARENA_CX+7.0,z:ARENA_CZ+3.0,yaw:Math.PI,cd:1.3,attackT:0,walk:3},
 ];
}
function addWave(stage){
 if(stage===1){
  enemies.push(makeMook(ARENA_CX-4.5,ARENA_CZ-3,.2),makeMook(ARENA_CX+4.0,ARENA_CZ-3,.7),makeMook(ARENA_CX,ARENA_CZ-7,1.1));
 }else{
  // seconda ondata: arriva dai lati e piu' vicino alla battigia, cosi' e'
  // visivamente distinta dalla prima e non sembra lo stesso fight ripetuto.
  enemies.push(makeMook(ARENA_CX-9,ARENA_CZ-5,.2),makeMook(ARENA_CX+9,ARENA_CZ-5,.5),makeMook(ARENA_CX-3,ARENA_CZ-9,.9),makeMook(ARENA_CX+3,ARENA_CZ-9,1.2));
 }
}
function spawnWave(){
 enemies=[];arenaWave=1;arenaWaveTransition=false;initArenaAllies();addWave(1);
 // Il Raccoglitore nasce DAVVERO nel mare profondo. Non verra' clampato
 // sulla sabbia e solo dopo l'emersione avanzera' fino alla battigia.
 enemies.push({type:"raccoglitore",pal:PAL_RACCOGLITORE,x:ARENA_CX,z:RACC_SEA_Z,y:-2.8,yaw:0,hp:160,hpMax:160,state:"submerged",cd:2,scale:1.55,alpha:1,dead:false,retreated:false,walkPhaseE:0,hitFlash:0,attackFlashT:0,hidden:true,emerging:false,emerged:false});
}
function aliveMooks(){return enemies.filter(e=>e.type==="scagnozzo"&&!e.dead);}
function maybeAdvanceArenaWave(){
 if(arenaWaveTransition||emergeCutscene)return;
 if(arenaWave===1&&aliveMooks().length===0){
  arenaWaveTransition=true;arenaWave=2;
  missionHintEl.textContent="ARCO // NON E' FINITA. SECONDA ONDATA!";missionHintEl.classList.add("show");
  afterGame(1050,()=>{addWave(2);arenaWaveTransition=false;missionHintEl.textContent="SECONDA ONDATA // TENETE LA LINEA";});
 }else if(arenaWave===2&&aliveMooks().length===0){
  arenaWave=3;
  const heal=Math.min(25,player.hpMax-player.hp);player.hp+=heal;
  missionHintEl.textContent=heal>0?"TIC // CARICA D'EMERGENZA +"+heal+" HP":"...SILENZIO";missionHintEl.classList.add("show");
  if(heal>0){specialFlashEl.style.opacity=.35;afterGame(220,()=>specialFlashEl.style.opacity=0);sfx.dodge();}
  afterGame(850,()=>{missionHintEl.textContent="...SILENZIO";maybeEmergeRaccoglitore();});
 }
}
function updateArenaAllies(dt){
 if(zone!=="arena"||colossoTeamPos)return;
 const racc=enemies.find(e=>e.type==="raccoglitore"&&!e.dead&&!e.hidden&&e.emerged&&e.state!=="retreat"&&e.state!=="submerged"&&e.state!=="emerging");
 for(let i=0;i<arenaAllies.length;i++){
  const a=arenaAllies[i];a.cd-=rawDtGlobal;a.attackT=Math.max(0,a.attackT-rawDtGlobal);
  const mooks=aliveMooks();
  const t=mooks.length?mooks[(i+arenaWave)%mooks.length]:racc;
  if(!t){
   // Durante il reveal non restano congelati: si dispongono ai lati e guardano il mare.
   const tx=ARENA_CX+(i-1.5)*2.2,tz=ARENA_CZ-1.0;const dx=tx-a.x,dz=tz-a.z,dist=Math.hypot(dx,dz)||.001;
   a.yaw=Math.atan2(ARENA_CX-a.x,RACC_SHORE_Z-a.z);
   if(dist>.35){a.x+=dx/dist*.8*dt;a.z+=dz/dist*.8*dt;a.walk+=dt*5;}
   continue;
  }
  // Contro Il Raccoglitore si aprono sui fianchi: battaglia di squadra vera.
  const flank=t.type==="raccoglitore"?(i-1.5)*.85:0;
  const tx=t.x+flank,tz=t.z+(t.type==="raccoglitore"?1.25:0);
  const dx=tx-a.x,dz=tz-a.z,dist=Math.hypot(dx,dz)||.001;a.yaw=Math.atan2(t.x-a.x,t.z-a.z);
  const want=t.type==="raccoglitore"?2.05:1.65;
  if(dist>want){const sp=(t.type==="raccoglitore"?1.05:.95)*dt;a.x+=dx/dist*sp;a.z+=dz/dist*sp;a.walk+=dt*6;}
  else if(a.cd<=0){a.cd=(t.type==="raccoglitore"?1.15:1.0)+i*.10;a.attackT=.38;
   // Aiutano davvero ma NON possono dare il colpo finale.
   const allyDmg=t.type==="raccoglitore"?1:2;t.hp=Math.max(1,t.hp-allyDmg);t.hitFlash=.08;
  }
 }
}
let emergeCutscene=null;
function maybeEmergeRaccoglitore(){
 const racc=enemies.find(e=>e.type==="raccoglitore");
 if(arenaWave<3||!racc||racc.emerging||racc.emerged||emergeCutscene)return;
 racc.emerging=true;racc.emergeT=0;racc.state="emerging";
 emergeCutscene={t:0,phase:"buildup",racc};
 missionHintEl.textContent="QUALCOSA SI MUOVE NELL'ACQUA...";missionHintEl.classList.add("show");
}
function updateEmergeCutscene(dt){
 if(!emergeCutscene)return;
 emergeCutscene.t+=dt;const racc=emergeCutscene.racc;
 if(emergeCutscene.phase==="buildup"&&emergeCutscene.t>2.0){
  emergeCutscene.phase="rising";emergeCutscene.t=0;racc.hidden=false;sfx.alarm();triggerSlowMo(.6,.3);missionHintEl.textContent="IL RACCOGLITORE";
 }else if(emergeCutscene.phase==="rising"&&racc.emerged){
  emergeCutscene.phase="advance";emergeCutscene.t=0;
 }else if(emergeCutscene.phase==="advance"&&racc.state!=="approach"){
  emergeCutscene.phase="hold";emergeCutscene.t=0;
 }else if(emergeCutscene.phase==="hold"&&emergeCutscene.t>1.0){
  emergeCutscene=null;missionHintEl.classList.remove("show");
 }
}

// ============================================================
// ARCHIVIO — terza stanza della Torre, si sblocca dopo il Colosso. Elmi
// danneggiati appesi (con gli stessi colori della squadra + il rosso
// ruggine di Zero, per far capire senza dirlo che sono i resti delle
// vecchie squadre) e un terminale con il registro delle squadre precedenti.
// ============================================================
// L'Archivio ora ha due parti in un unico corridoio lungo (niente cambio
// di zona/telecamera, piu' semplice e meno confuso da seguire): la parte
// vicina all'ingresso col terminale e gli elmi, e IN FONDO — piu' buia,
// col pavimento diverso apposta per far percepire il cambiamento — la
// sala delle capsule. I vecchi Ranger non sono morti: sono ancora li',
// tenuti in stasi, e la Torre continua a prelevare energia da loro. E'
// per questo che serve sempre un nuovo "unita' Zero": il ciclo non libera
// mai chi c'e' gia' dentro, ne aggiunge solo altri.
const ARCHIVIO_CX=40, ARCHIVIO_CZ=0, ARCHIVIO_W=9, ARCHIVIO_D=24;
const CAPSULE_ZONE_Z=ARCHIVIO_CZ-ARCHIVIO_D/2+6; // da qui in poi (verso nord) e' la sala delle capsule
const archivioFloorBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.07,.07,.08]),mtx:mul(mat4.translate(ARCHIVIO_CX,-.1,ARCHIVIO_CZ+4),mat4.scale(ARCHIVIO_W,.2,ARCHIVIO_D-8))},
 // pavimento della sala capsule: piu' freddo/malato, per segnare il cambio senza bisogno di una porta
 {mesh:boxMesh([.05,.09,.09]),mtx:mul(mat4.translate(ARCHIVIO_CX,-.1,CAPSULE_ZONE_Z-2),mat4.scale(ARCHIVIO_W,.2,8))},
]));
const archivioWallCol=[.08,.08,.10];
const capsuleWallCol=[.05,.06,.08];
const archivioWallParts=[
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX,2.2,ARCHIVIO_CZ+ARCHIVIO_D/2),mat4.scale(ARCHIVIO_W,4.4,.3))}, // fondo ingresso
 {mesh:boxMesh(capsuleWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX,2.6,ARCHIVIO_CZ-ARCHIVIO_D/2),mat4.scale(ARCHIVIO_W,5.2,.3))}, // fondo sala capsule
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX-ARCHIVIO_W/2,2.2,ARCHIVIO_CZ+5),mat4.scale(.3,4.4,ARCHIVIO_D-10))},
 {mesh:boxMesh(archivioWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX+ARCHIVIO_W/2,2.2,ARCHIVIO_CZ+5),mat4.scale(.3,4.4,ARCHIVIO_D-10))},
 {mesh:boxMesh(capsuleWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX-ARCHIVIO_W/2,2.6,CAPSULE_ZONE_Z-2),mat4.scale(.3,5.2,8))},
 {mesh:boxMesh(capsuleWallCol),mtx:mul(mat4.translate(ARCHIVIO_CX+ARCHIVIO_W/2,2.6,CAPSULE_ZONE_Z-2),mat4.scale(.3,5.2,8))},
 {mesh:boxMesh([.05,.05,.06]),mtx:mul(mat4.translate(ARCHIVIO_CX,4.5,ARCHIVIO_CZ+4),mat4.scale(ARCHIVIO_W,.3,ARCHIVIO_D-8))},
 {mesh:boxMesh([.03,.04,.05]),mtx:mul(mat4.translate(ARCHIVIO_CX,5.3,CAPSULE_ZONE_Z-2),mat4.scale(ARCHIVIO_W,.3,8))},
];
// elmi danneggiati appesi lungo la parete est, nella parte vicina
// all'ingresso — restano come prima, decorazione/indizio, non piu'
// un'interazione a se stante (semplificato: contava solo confondere).
const oldHelmetPalettes=[
 [.42,.10,.08],[.30,.40,.44],[.20,.12,.24],[.10,.24,.16],[.35,.18,.10],[.28,.28,.30],
];
const archivioHelmetParts=[];
for(let i=0;i<oldHelmetPalettes.length;i++){
 const hz=ARCHIVIO_CZ+ARCHIVIO_D/2-2.2-i*1.5;
 const hx=ARCHIVIO_CX+ARCHIVIO_W/2-.6;
 archivioHelmetParts.push({mesh:boxMesh([.10,.10,.11]),mtx:mul(mat4.translate(hx,2.9,hz),mat4.scale(.04,.5,.04))});
 archivioHelmetParts.push({mesh:boxMesh(oldHelmetPalettes[i]),mtx:mul(mat4.translate(hx,2.35,hz),mat4.rotZ((i%2?1:-1)*.12),mat4.scale(.30,.32,.32))});
}
const archivioHelmetBuf=makeBuffer(bakeParts(archivioHelmetParts));
const archivioTerminalBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.14,.15,.17]),mtx:mul(mat4.translate(ARCHIVIO_CX-ARCHIVIO_W/2+.9,.5,ARCHIVIO_CZ+ARCHIVIO_D/2-2.5),mat4.scale(.7,1.0,.6))},
 {mesh:boxMesh([.35,.55,.25]),mtx:mul(mat4.translate(ARCHIVIO_CX-ARCHIVIO_W/2+.9,1.15,ARCHIVIO_CZ+ARCHIVIO_D/2-2.5),mat4.rotX(-.3),mat4.scale(.55,.42,.04))},
]));
const ARCH_OCULO_POS={x:ARCHIVIO_CX,y:2.55,z:ARCHIVIO_CZ-ARCHIVIO_D/2+.18};
const archivioOculoFrameBuf=makeBuffer(bakeParts([
 {mesh:boxMesh([.10,.11,.14]),mtx:mul(mat4.translate(ARCH_OCULO_POS.x,ARCH_OCULO_POS.y,ARCH_OCULO_POS.z-.04),mat4.scale(2.7,1.65,.12))},
]));
const archivioWallBuf=makeBuffer(bakeParts(archivioWallParts));

// ------------------------------------------------------------
// Sala delle capsule: 4 vecchi Ranger, ancora vivi, tenuti in stasi —
// ognuno col rig e la palette gia' pronti (basta riusare quelli della
// squadra + due varianti in piu' per dare l'idea di piu' cicli passati),
// dentro una capsula (cornice + pannello "vetro" colorato), con un fascio
// verticale che sale verso il soffitto a suggerire il prelievo di energia.
// ------------------------------------------------------------
const PAL_OLDRANGER_A=makePalette([.34,.16,.14],[.42,.36,.20]);
const PAL_OLDRANGER_B=makePalette([.14,.28,.34],[.44,.44,.46]);
const capsuleRangerPals=[PAL_OLDRANGER_A,PAL_ARCO,PAL_OLDRANGER_B,PAL_MERIDIANA];
const CAPSULE_POS=[
 {x:ARCHIVIO_CX-2.6,z:CAPSULE_ZONE_Z-4.5},
 {x:ARCHIVIO_CX-0.9,z:CAPSULE_ZONE_Z-5.2},
 {x:ARCHIVIO_CX+0.9,z:CAPSULE_ZONE_Z-5.2},
 {x:ARCHIVIO_CX+2.6,z:CAPSULE_ZONE_Z-4.5},
];
const capsuleFrameParts=[];
for(const p of CAPSULE_POS){
 capsuleFrameParts.push({mesh:boxMesh([.12,.13,.15]),mtx:mul(mat4.translate(p.x,1.15,p.z),mat4.scale(1.0,2.3,.12))}); // schiena capsula
 capsuleFrameParts.push({mesh:boxMesh([.10,.11,.13]),mtx:mul(mat4.translate(p.x,.05,p.z+.35),mat4.scale(1.05,.10,.85))}); // base
}
const capsuleFrameBuf=makeBuffer(bakeParts(capsuleFrameParts));
// il "vetro" colorato e il fascio di luce si disegnano ogni frame (per il
// leggero pulsare, come per Oculo/LIMEN) invece di essere statici.
const capsuleGlassMesh=boxMesh([.30,.75,.85]);
const capsuleGlassBuf=makeBuffer(capsuleGlassMesh);
const capsuleBeamMesh=boxMesh([.55,.90,.98]);
const capsuleBeamBuf=makeBuffer(capsuleBeamMesh);

let archivioUnlocked=false;
function enterArchivio(){
 zone="archivio";
 player.x=ARCHIVIO_CX; player.z=ARCHIVIO_CZ+ARCHIVIO_D/2-1.5; player.yaw=Math.PI;
 teleportFlash();
 playAmbient("archivio");
}
DIALOGUE_FOCUS_POS.REGISTRO={x:ARCHIVIO_CX-ARCHIVIO_W/2+.9,y:1.3,z:ARCHIVIO_CZ+ARCHIVIO_D/2-2.5};
DIALOGUE_FOCUS_POS.CAPSULE={x:ARCHIVIO_CX,y:1.3,z:CAPSULE_ZONE_Z-5};
DIALOGUE_FOCUS_POS.ARCH_OCULO=ARCH_OCULO_POS;

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
const hudLocationEl=document.getElementById("hudLocation");
const ZONE_LABELS={torre:"LA TORRE // SALA DI COMANDO",arena:"COSTA SUD // SPIAGGIA",colosso:"IL COLOSSO // PRIMA LINEA",archivio:"LA TORRE // ARCHIVIO"};
let lastZoneLabel=null;
const interactPromptEl=document.getElementById("interactPrompt");
const dmgVignetteEl=document.getElementById("dmgVignette");
const gameOverEl=document.getElementById("gameOver");
const colossoHpWrapEl=document.getElementById("colossoHpWrap");
const colossoHpFillEl=document.getElementById("colossoHpFill");
const colossoOutcomeEl=document.getElementById("colossoOutcome");
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
 transformState=null;emergeCutscene=null;specialBursts.length=0;splashBursts.length=0;dialogueActive=false;dialogueBoxEl?.classList.remove("show");document.body.classList.remove("dialogue-active");
}
function readCheckpoint(){try{return JSON.parse(localStorage.getItem(CHECKPOINT_KEY)||"null");}catch(e){return null;}}
function refreshContinueButton(){if(!continueBtnEl)return;const cp=readCheckpoint();continueBtnEl.disabled=!cp;continueBtnEl.style.opacity=cp?1:.38;}
function saveCheckpoint(id){
 currentCheckpoint=id;try{localStorage.setItem(CHECKPOINT_KEY,JSON.stringify({id,ts:Date.now(),version:24}));}catch(e){}refreshContinueButton();
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
function enterArena(force){
 if(zone==="arena"&&!force)return;zone="arena";
 player.x=ZONES.arena.cx;player.z=ZONES.arena.cz+9;player.yaw=Math.PI;player.hp=player.hpMax;player.energy=0;
 spawnWave();missionHintEl.textContent="MISSIONE: DIFENDI LA COSTA // PRIMA ONDATA";missionHintEl.classList.add("show");
 teleportFlash();playAmbient("arena");saveCheckpoint("arena");
}
function enterTorre(){
 zone="torre";player.x=0;player.z=4.0;player.yaw=Math.PI;missionHintEl.classList.remove("show");teleportFlash();playAmbient("torre");
}
const ANOMALO_POS={x:-ROOM_W/2+.78,z:-2.2};
function restoreCheckpoint(id){
 clearTransientState();paused=false;if(pauseScreenEl)pauseScreenEl.classList.remove("show");if(actx)try{actx.resume();}catch(e){}
 gameStarted=true;titleEl.style.display="none";hudEl.style.display="block";document.body.classList.add("started");
 player.hp=player.hpMax;player.energy=0;player.attackT=player.dodgeT=player.dodgeCd=player.invuln=player.hitFlashT=player.specialT=0;
 colosso=null;colossoTeamPos=null;colossoHpWrapEl.classList.remove("show");postBossState=false;archiveState={terminalRead:false,capsuleRead:false,revealing:false};
 if(id==="arena"){player.transformed=true;player.helmet=true;enterArena(true);}
 else if(id==="colosso"){player.transformed=true;player.helmet=true;startColossoFightDirect();}
 else if(id==="postboss"){player.transformed=true;player.helmet=true;postBossState=true;enterTorre();saveCheckpoint("postboss");afterGame(250,()=>playDialogue(postBossLines,()=>{missionHintEl.textContent="CONTROLLA IL PANNELLO ANOMALO";missionHintEl.classList.add("show");}));}
 else if(id==="archivio"){player.transformed=true;player.helmet=true;startArchiveSequence();}
 else{player.transformed=false;player.helmet=false;enterTorre();saveCheckpoint("torre");startIntro();}
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
function playDialogue(lines,onEnd){
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
 // la telecamera si gira verso chi sta parlando, cosi' si capisce subito
 // chi e' — prima restava fissa sul giocatore per tutta la scena.
 if(zone==="archivio"&&l.speaker==="MERIDIANA")dialogueFocus=DIALOGUE_FOCUS_POS.CAPSULE;
 else if(zone==="archivio"&&l.speaker==="OCULO")dialogueFocus=DIALOGUE_FOCUS_POS.ARCH_OCULO;
 else if(l.speaker==="ZERO")dialogueFocus={x:player.x,y:1.45,z:player.z};
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

// Intro: Oculo finisce di spiegare perche' il protagonista e' li', due
// battute con la squadra (con dentro un riferimento discreto a IT SHIFT —
// "badge", "sessione", roba amministrativa che non dovrebbe esistere qui),
// poi l'allarme che porta dritti al combattimento in spiaggia.
const introLines=[
 {speaker:"OCULO",text:"La Torre protegge questo mondo da generazioni. Da oggi farai parte di qualcosa piu' grande di te."},
 {speaker:"OCULO",text:"Benvenuto, unita' Zero."},
 {speaker:"ARCO",text:"Non fare quella faccia. Ci siamo passati tutti. Io sono Arco, comando la squadra sul campo — resta vicino e andra' bene."},
 {speaker:"MERIDIANA",text:"Meridiana. Io tengo d'occhio quello che gli altri preferiscono non guardare."},
 {speaker:"TIC",text:"IO SONO TIC! Supporto tattico, morale, e tecnicamente l'unico qui che si ricorda gli anniversari."},
 {speaker:"OCULO",text:"Allarme. Presenza ostile sulla costa sud — scagnozzi, e qualcosa di piu' grande dietro di loro."},
 {speaker:"OCULO",text:"Squadra, in posizione. Zero — trasformati, e vai."},
];
function startIntro(){
 // Ogni nuova partita deve mostrare per intero il rituale tokusatsu:
 // briefing -> allarme -> trasformazione -> trasferimento. Nessun checkpoint
 // o stato precedente puo' lasciare Zero gia' trasformato.
 player.transformed=false;player.helmet=false;transformState=null;clearKeys();
 missionHintEl.classList.remove("show");playAmbient("torre");
 playDialogue(introLines,()=>{
  clearKeys();missionHintEl.textContent="ALLARME — UNITÀ ZERO, PREPARATI";missionHintEl.classList.add("show");sfx.alarm();
  afterGame(450,()=>{
   missionHintEl.textContent="ZERO — TRASFORMAZIONE!";
   startTransformation();
   afterGame(1250,()=>{
    // Aspettiamo che la trasformazione sia realmente terminata prima di
    // lasciare la Torre: niente salto diretto al Ranger gia' pronto.
    if(!player.transformed){player.transformed=true;player.helmet=true;transformState=null;}
    missionHintEl.textContent="TRASFERIMENTO IN CORSO";
    afterGame(700,()=>enterArena());
   });
  });
 });
}
const postBossLines=[
 {speaker:"OCULO",text:"Missione completata. Prestazione conforme ai parametri."},
 {speaker:"TIC",text:"Ehm... Oculo? Ho un sottosistema che continua a rispondere. Settore non indicizzato."},
 {speaker:"MERIDIANA",text:"Da quando abbiamo settori non indicizzati?"},
 {speaker:"OCULO",text:"Errore diagnostico. Ignoratelo."},
];

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
 {speaker:"REGISTRO",text:"UNITA' ATTIVE IN STASI: 04. OUTPUT ENERGETICO MEDIO: 17%."},
 {speaker:"REGISTRO",text:"DECADIMENTO ENERGETICO: IRREVERSIBILE. SOSTITUZIONE: NECESSARIA."},
 {speaker:"REGISTRO",text:"SQUADRA_07 — STASI ATTIVA. SQUADRA_08 — STASI ATTIVA. SQUADRA_09 — STASI ATTIVA."},
 {speaker:"REGISTRO",text:"SESSION_01 // TYPE: STUDIO // STATUS: CLOSED"},
 {speaker:"REGISTRO",text:"ERRORE — DATA TYPE MISMATCH. ACCESSO AL BLOCCO LMN_01 NEGATO."},
];
const capsuleLines=[
 {speaker:"MERIDIANA",text:"Zero... non sono morti."},
 {speaker:"MERIDIANA",text:"Sono ancora li' dentro. Li tengono cosi', e continuano a prendere quello che gli resta."},
 {speaker:"MERIDIANA",text:"Quando l'output scende troppo, non li liberano. Reclutano un'altra unita'."},
];
const oculoRevealLines=[
 {speaker:"OCULO",text:"Zero. Hai seguito il protocollo."},
 {speaker:"OCULO",text:"Anche quando lui esitava."},
 {speaker:"ZERO",text:"Lui chi?"},
 {speaker:"OCULO",text:"Non parlavo con te."},
 {speaker:"OCULO",text:"Tu, dall'altra parte dello schermo: registriamo ogni sessione. Ogni scelta. Ogni modo in cui fai avanzare un'unita'."},
 {speaker:"OCULO",text:"OCULO non e' soltanto un nome. E' il nodo di supervisione. Qualcuno deve osservare, selezionare, sostituire."},
 {speaker:"REGISTRO",text:"SUPERVISOR NODE: OCULO // SUCCESSOR SLOT: AVAILABLE"},
 {speaker:"OCULO",text:"Allora scegli tu. Cosa ne facciamo di questo ciclo — e di loro?"},
];
const TERMINAL_POS={x:ARCHIVIO_CX-ARCHIVIO_W/2+.9,z:ARCHIVIO_CZ+ARCHIVIO_D/2-2.5};
const CAPSULE_INTERACT_POS={x:ARCHIVIO_CX,z:CAPSULE_ZONE_Z-5};
let archiveState={terminalRead:false,capsuleRead:false,revealing:false};
let nearInteractable=null;
function doArchiveInteract(){
 if(nearInteractable==="terminal"&&!archiveState.terminalRead){archiveState.terminalRead=true;playDialogue(terminalLines,maybeStartOculoReveal);}
 else if(nearInteractable==="capsule"&&!archiveState.capsuleRead){archiveState.capsuleRead=true;playDialogue(capsuleLines,maybeStartOculoReveal);}
}
function doAnomalyInteract(){if(!postBossState)return;postBossState=false;missionHintEl.classList.remove("show");startArchiveSequence();}
function startArchiveSequence(){
 archiveState={terminalRead:false,capsuleRead:false,revealing:false};enterArchivio();saveCheckpoint("archivio");
 afterGame(600,()=>{missionHintEl.textContent="ESPLORA L'ARCHIVIO — CERCA IL TERMINALE, POI VAI IN FONDO";missionHintEl.classList.add("show");});
}
function maybeStartOculoReveal(){
 if(archiveState.terminalRead&&archiveState.capsuleRead&&!archiveState.revealing){archiveState.revealing=true;missionHintEl.classList.remove("show");afterGame(900,()=>playDialogue(oculoRevealLines,showChoiceScreen));}
}
const choiceScreenEl=document.getElementById("choiceScreen");
const choiceRowEl=document.getElementById("choiceRow");
const endingScreenEl=document.getElementById("endingScreen");
const cliffFlashEl=document.getElementById("cliffFlash");
const cliffEyeEl=document.getElementById("cliffEye");
const ENDINGS={
 good:{cls:"good",title:"CICLO INTERROTTO",text:"Apri le capsule. Meridiana e TIC ti coprono mentre i vecchi Ranger tornano a respirare da soli. Rinunci al protocollo e al potere che lo alimenta. Il ciclo, per ora, si ferma."},
 normal:{cls:"normal",title:"ARCHIVIO RICHIUSO",text:"Richiudi l'Archivio. Accetti che le perdite siano parte del protocollo. Le unita' restano in stasi e la Torre torna in silenzio. La missione continua."},
 evil:{cls:"evil",title:"SUPERVISORE AUTORIZZATO",text:"Assumi il nodo di supervisione. Oculo non viene distrutto: viene sostituito. Le capsule restano da amministrare, e alla porta della Torre qualcuno di nuovo sta per entrare."},
};
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
 const e=ENDINGS[kind];endingScreenEl.className=e.cls;endingScreenEl.querySelector("h1").textContent=e.title;endingScreenEl.querySelector("p").textContent=e.text;endingScreenEl.classList.add("show");
 stopAmbient(3.5);sfx.win();
 setTimeout(()=>{
  const h1=endingScreenEl.querySelector("h1"),p=endingScreenEl.querySelector("p"),code=endingScreenEl.querySelector(".code");[h1,p,code].forEach(el=>{el.style.transition="opacity .8s ease";el.style.opacity=0;});
  cliffFlashEl.style.transition="opacity .04s linear";cliffFlashEl.style.opacity=1;sfx.alarm();
  setTimeout(()=>{cliffFlashEl.style.transition="opacity 1.1s ease";cliffFlashEl.style.opacity=0;cliffEyeEl.classList.add("show");setTimeout(()=>{cliffEyeEl.style.transition="opacity 1.8s ease";cliffEyeEl.classList.remove("show");cliffEyeEl.style.opacity=0;},3400);},90);
 },4200);
}

function prepareStartedGame(){
 unlockAudio();gameStarted=true;paused=false;titleEl.style.display="none";hudEl.style.display="block";document.body.classList.add("started");clearKeys();
}
function beginNewGame(){
 if(gameStarted)return;clearCheckpoint();prepareStartedGame();player.transformed=false;player.helmet=false;player.hp=player.hpMax;player.energy=0;enterTorre();saveCheckpoint("torre");startIntro();
}
function continueGame(){
 if(gameStarted)return;const cp=readCheckpoint();if(!cp){beginNewGame();return;}prepareStartedGame();restoreCheckpoint(cp.id||"torre");
}
refreshContinueButton();
document.getElementById("newGameBtn").addEventListener("click",e=>{e.stopPropagation();beginNewGame();});
continueBtnEl.addEventListener("click",e=>{e.stopPropagation();if(!continueBtnEl.disabled)continueGame();});
const edgeKeys=new Set(["Space","KeyF","KeyC","ShiftLeft","ShiftRight","KeyP","Escape","KeyT","KeyM"]);
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
 if(e.code==="Space"&&zone==="archivio"&&nearInteractable){doArchiveInteract();return;}
 if(e.code==="Space"&&zone==="torre"&&nearInteractable==="anomaly"){doAnomalyInteract();return;}
 if(gameOverActive)return;
 if(DEV_MODE&&e.code==="KeyT")startTransformation();
 if(DEV_MODE&&e.code==="KeyM"&&gameStarted&&!transformState&&!dialogueActive){if(zone==="torre")enterArena();else enterTorre();}
 if(e.code==="KeyF"){if(zone==="colosso")colossoPunch();else tryAttack();}
 if(e.code==="KeyC"){if(zone==="colosso")colossoSpecial();else trySpecial();}
 if(e.code==="ShiftLeft"||e.code==="ShiftRight"){if(zone==="colosso")colossoGuard();else tryDodge();}
});
window.addEventListener("keyup",e=>{keys[e.code]=false;});
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
   if(Math.abs(RACC_SHORE_Z-en.z)<.06){en.z=RACC_SHORE_Z;en.state="idle";}
   continue;
  }
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
  if(en.cd>0)en.cd-=rawDtGlobal;
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
 const baseDpr=Math.min(window.devicePixelRatio||1,2);
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

// ombra a terra condivisa: un box scuro schiacciato, riusato sotto ogni
// personaggio invece di costruirne una per ciascuno. Senza, tutti
// sembravano leggermente "fluttuare" sul pavimento.
const shadowMesh=boxMesh([0,0,0]);
const shadowBuf=makeBuffer(shadowMesh);
function drawShadow(x,z,radius,vp,alpha){
 drawBuffer(shadowBuf, mul(mat4.translate(x,.012,z),mat4.scale(radius,.02,radius*.85)), vp, alpha===undefined?.35:alpha);
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
 const inputLocked=paused||!!transformState||!gameStarted||dialogueActive||gameOverActive||zone==="colosso"||(colosso&&colosso.phase==="converge")||choiceScreenEl.classList.contains("show")||endingScreenEl.classList.contains("show")||!!emergeCutscene;
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
 for(let i=specialBursts.length-1;i>=0;i--){specialBursts[i].t+=dt;if(specialBursts[i].t>.5)specialBursts.splice(i,1);}
 for(let i=splashBursts.length-1;i>=0;i--){splashBursts[i].t+=dt;if(splashBursts[i].t>.7)splashBursts.splice(i,1);}
 if(zone==="arena"&&gameStarted&&!transformState)updateEnemies(dt);
 if(colosso)updateColosso(dt);
 if(zone==="arena")updateEmergeCutscene(dt);

 // Archivio: mostra il prompt "SPAZIO — LEGGI" quando ci si avvicina al
 // terminale o alla sala delle capsule in fondo, cosi' l'esplorazione e'
 // guidata ma resta libera (il giocatore decide quando e se avvicinarsi).
 if(zone==="archivio"&&!dialogueActive){
  const dT=Math.hypot(player.x-TERMINAL_POS.x,player.z-TERMINAL_POS.z),dC=Math.hypot(player.x-CAPSULE_INTERACT_POS.x,player.z-CAPSULE_INTERACT_POS.z);
  if(dT<1.6&&!archiveState.terminalRead){nearInteractable="terminal";interactPromptEl.textContent="SPAZIO — LEGGI IL REGISTRO";interactPromptEl.classList.add("show");}
  else if(dC<2.4&&!archiveState.capsuleRead){nearInteractable="capsule";interactPromptEl.textContent="SPAZIO — GUARDA LE CAPSULE";interactPromptEl.classList.add("show");}
  else{nearInteractable=null;interactPromptEl.classList.remove("show");}
 }else if(zone==="torre"&&postBossState&&!dialogueActive){
  const dA=Math.hypot(player.x-ANOMALO_POS.x,player.z-ANOMALO_POS.z);
  if(dA<1.65){nearInteractable="anomaly";interactPromptEl.textContent="SPAZIO — ISPEZIONA IL PANNELLO ANOMALO";interactPromptEl.classList.add("show");}
  else{nearInteractable=null;interactPromptEl.classList.remove("show");}
 }else if(nearInteractable){nearInteractable=null;interactPromptEl.classList.remove("show");}

 player.walkPhase+=dt*(moving?8.5:0);
 const pal=player.transformed?PAL_ZERO:PAL_CIVILE;
 const zoomIn=transformState?Math.min(1,transformState.t/.35):0;
 const ATTACK_DUR=.34;
 const attackPhase=player.attackT>0?1-player.attackT/ATTACK_DUR:0;
 const charMesh=buildCharacterBuffers(pal,player.walkPhase,moving?1:0,player.helmet,"ranger",player.attackT>0?attackPhase:0,player.specialT>0);

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
 }else if(zone==="colosso"){
  const sh=colosso&&colosso.shakeT>0?colosso.shakeT:0;
  if(colosso&&colosso.phase==="combine"){
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
   // Camera 3/4 ricalcolata ogni frame sul midpoint dei due giganti.
   const mx=(colosso.robotX+colosso.giantX)*.5,mz=(colosso.robotZ+colosso.giantZ)*.5;
   eye=[mx+13.5+Math.sin(now/90)*sh*.30,11.8+Math.sin(now/75)*sh*.18,mz+18.0];
   target=[mx,4.6,mz-.8];
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
 const proj=mat4.perspective(60*Math.PI/180, c.width/c.height, .1, 140);
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
   const bump=isSpeaking?1.06:1;
   drawDynamicMesh(mesh,mul(mat4.translate(m.x,0,m.z),mat4.rotY(m.yaw+Math.sin(idlePhase*.4)*.05),mat4.scale(bump,bump,bump)),vp);
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
  drawBuffer(arenaSkyBuf,mat4.identity(),vp); // fallback
  drawTexturedMesh(arenaSkyTex,arenaPanoramaMesh,mat4.identity(),vp,1);
  drawBuffer(arenaFloorBuf,mat4.identity(),vp);
  drawBuffer(arenaSeaBuf,mat4.identity(),vp);
  drawBuffer(arenaPropBuf,mat4.identity(),vp);
  drawBuffer(arenaEdgeBuf,mat4.identity(),vp);
  // La squadra combatte con Zero: AI volutamente leggera, ma visivamente
  // presente per tutta la missione invece di sparire dopo il briefing.
  if(!colossoTeamPos){
   for(let ai=0;ai<arenaAllies.length;ai++){
    const a=arenaAllies[ai];drawShadow(a.x,a.z,.38,vp,.28);
    const ap=a.attackT>0?1-a.attackT/.38:0;
    const am=buildCharacterBuffers(a.pal,a.walk,1,true,"ranger",ap);
    drawDynamicMesh(am,mul(mat4.translate(a.x,0,a.z),mat4.rotY(a.yaw),mat4.scale(.96,.96,.96)),vp,.95);
   }
  }
  for(const en of enemies){
   if(en.dead||en.hidden)continue;
   drawShadow(en.x,en.z,.40*en.scale,vp,.35*(en.alpha!==undefined?en.alpha:1));
   const hitPulse=en.hitFlash>0?1+en.hitFlash*1.6:1;
   const s=en.scale*hitPulse;
   const enAttackPhase=en.attackFlashT>0?1-en.attackFlashT/.5:0;
   const enMoving=en.state!=="retreat"&&facingDot(en.x,en.z,en.yaw,player.x,player.z).dist>(en.type==="raccoglitore"?2.05:1.65);
   const enMesh=buildCharacterBuffers(en.pal,en.walkPhaseE,enMoving?1:0,true,en.type,en.attackFlashT>0?enAttackPhase:0);
   const enModel=mul(mat4.translate(en.x,en.y||0,en.z),mat4.rotY(en.yaw),mat4.scale(s,s,s));
   drawDynamicMesh(enMesh,enModel,vp,en.alpha);
   if(en.state!=="retreat"){
    const barYaw=Math.atan2(eye[0]-en.x,eye[2]-en.z);
    const barY=(en.y||0)+(en.type==="raccoglitore"?2.55*en.scale:1.95*s);
    drawEnemyHpBar(en.x,barY,en.z,en.hp/en.hpMax,barYaw,vp);
   }
  }
  if(colossoTeamPos){
   for(const tp of colossoTeamPos){
    const tMesh=buildCharacterBuffers(tp.pal,now/300,1,true,"ranger",0);
    const tYaw=Math.atan2(player.x-tp.x,player.z-tp.z);
    drawDynamicMesh(tMesh,mul(mat4.translate(tp.x,0,tp.z),mat4.rotY(tYaw)),vp);
   }
  }
 }else if(zone==="colosso"&&colosso){
  drawBuffer(arenaSkyBuf,mat4.identity(),vp); // fallback
  drawTexturedMesh(arenaSkyTex,arenaPanoramaMesh,mat4.identity(),vp,1);
  drawBuffer(arenaFloorBuf,mat4.identity(),vp);drawBuffer(arenaSeaBuf,mat4.identity(),vp);
  drawBuffer(giantCityBuf,mat4.identity(),vp,.98);

  const giantWobble=1+Math.sin(now/260)*.02;
  const finishTilt=colosso.phase==="finishing"?(colosso.finishTilt||0):0;
  const gAtk=colosso.giantAttackT>0?1-colosso.giantAttackT/.58:0;
  const gLunge=Math.sin(Math.max(0,Math.min(1,gAtk))*Math.PI)*1.2;
  const gx=colosso.giantX, gz=colosso.giantZ+gLunge;
  const gyaw=Math.atan2(colosso.robotX-gx,colosso.robotZ-gz);
  const gm=mul(mat4.translate(gx,0,gz),mat4.rotY(gyaw),mat4.rotX(finishTilt),mat4.scale(colosso.giantScale*giantWobble,colosso.giantScale,colosso.giantScale*giantWobble));
  const giantPal=colosso.phase2?PAL_RACCOGLITORE_OVERLOAD:PAL_RACCOGLITORE;
  const giantMesh=buildCharacterBuffers(giantPal,now/450,gAtk>0?1:.15,true,"raccoglitore",gAtk);
  drawDynamicMesh(giantMesh,gm,vp);

  // Colosso sempre visibile: cutscene + fight 3/4 + finisher.
  const rp=colosso.phase==="combine"?Math.min(1,colosso.t/8):1;
  const rYaw=Math.atan2(colosso.giantX-colosso.robotX,colosso.giantZ-colosso.robotZ);
  const rAtk=colosso.punchT>0?1-colosso.punchT/.48:0;
  const rGuard=colosso.guardT>0?Math.min(1,colosso.guardT/.58):0;
  drawColossoRobot(vp,rp,now,{x:colosso.robotX,z:colosso.robotZ,yaw:rYaw,targetX:gx,targetZ:gz,attack:rAtk,guard:rGuard});

  if(colosso.phase==="finishing"){
   const ep=Math.min(1,(colosso.finishT||0)/2);
   drawBuffer(burstBuf,mul(mat4.translate(gx,5.0,gz),mat4.scale(1+ep*8,.7+ep*5,1+ep*8)),vp,Math.max(0,1-ep*.55));
  }
  if(colosso.phase==="fight"||colosso.phase==="finishing"){
   for(const b of colosso.beamBursts){
    if(b.kind==="punch"){
     const p=b.t/.4,sc=.4+p*2.2,a=Math.max(0,1-p);
     const ix=(colosso.robotX+gx)/2+(b.ox||0)*.3, iz=(colosso.robotZ+gz)/2;
     drawBuffer(burstBuf,mul(mat4.translate(ix,5.1+(b.oy||0)*.25,iz),mat4.scale(sc,sc,sc)),vp,a*.9);
    }else if(b.kind==="enemyBeam"){
     const p=b.t/.4,a=Math.max(0,1-p),dx=colosso.robotX-gx,dz=colosso.robotZ-gz,len=Math.hypot(dx,dz)||1;
     const mx=(gx+colosso.robotX)/2,mz=(gz+colosso.robotZ)/2,yaw=Math.atan2(dx,dz);
     drawBuffer(burstBuf,mul(mat4.translate(mx,5.8,mz),mat4.rotY(yaw),mat4.scale(.48,.48,len)),vp,a*.72);
    }else{
     const p=b.t/.4,a=Math.max(0,1-p),dx=gx-colosso.robotX,dz=gz-colosso.robotZ,len=Math.hypot(dx,dz)||1;
     const mx=(gx+colosso.robotX)/2,mz=(gz+colosso.robotZ)/2,yaw=Math.atan2(dx,dz);
     drawBuffer(burstBuf,mul(mat4.translate(mx,5.3,mz),mat4.rotY(yaw),mat4.scale(.36,.36,len)),vp,a*.85);
    }
   }
  }
 }else if(zone==="archivio"){
  drawBuffer(archivioFloorBuf,mat4.identity(),vp);
  drawBuffer(archivioWallBuf,mat4.identity(),vp);
  drawBuffer(archivioHelmetBuf,mat4.identity(),vp);
  drawBuffer(archivioTerminalBuf,mat4.identity(),vp);
  drawBuffer(archivioOculoFrameBuf,mat4.identity(),vp);
  if(archiveState.revealing)drawTexturedQuad(oculoTex,mul(mat4.translate(ARCH_OCULO_POS.x,ARCH_OCULO_POS.y,ARCH_OCULO_POS.z+.02),mat4.scale(2.35,1.35,1)),vp,.92);
  drawBuffer(capsuleFrameBuf,mat4.identity(),vp);
  for(let ci=0;ci<CAPSULE_POS.length;ci++){
   const cp=CAPSULE_POS[ci];
   const pulse=.75+Math.sin(now/620+ci*1.3)*.25;
   drawBuffer(capsuleGlassBuf, mul(mat4.translate(cp.x,1.15,cp.z+.30),mat4.scale(1,1,1)), vp, .38);
   drawBuffer(capsuleBeamBuf, mul(mat4.translate(cp.x,3.6,cp.z),mat4.scale(.5*pulse,3.0,.5*pulse)), vp, .16*pulse);
   const rMesh=buildCharacterBuffers(capsuleRangerPals[ci],0,0,true,"ranger",0);
   drawDynamicMesh(rMesh,mul(mat4.translate(cp.x,0,cp.z+.05),mat4.rotY(Math.PI)),vp,.8);
  }
 }

 if(zone!=="colosso"){
  drawShadow(player.x,player.z,.42,vp);
  const charModel=mul(mat4.translate(player.x,0,player.z),mat4.rotY(player.yaw));
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
 startColossoSequence,startColossoFightDirect,colossoPunch,colossoSpecial,colossoGuard,startArchiveSequence,showChoiceScreen,triggerEnding,restoreCheckpoint,
 get enemies(){return enemies},get arenaAllies(){return arenaAllies},get arenaWave(){return arenaWave},get colossoTeamPos(){return colossoTeamPos},get zone(){return zone},get dialogueActive(){return dialogueActive},
 get dialogueIndex(){return dialogueIndex},get gameOverActive(){return gameOverActive},get colosso(){return colosso}};
})();
