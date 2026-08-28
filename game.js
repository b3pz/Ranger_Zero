(() => {
"use strict";
const c=document.getElementById("c"),gl=c.getContext("webgl",{antialias:false,alpha:false});
if(!gl){document.body.innerHTML="<pre style='color:#fff'>WebGL non disponibile.</pre>";return}
gl.clearColor(.035,.04,.055,1);

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
  upperArm:boxMesh(pal.suit), lowerArm:boxMesh(pal.skin), glove:boxMesh(pal.accent),
  upperLeg:boxMesh(pal.suit), lowerLeg:boxMesh(pal.boot),
 };
 meshCache[key]=m;
 return m;
}
function buildBodyParts(pal,walkPhase,speedFactor,helmet){
 const pm=partMeshFor(pal);
 const swing=Math.sin(walkPhase)*.55*speedFactor;
 const swingOpp=Math.sin(walkPhase+Math.PI)*.55*speedFactor;
 const bob=Math.abs(Math.cos(walkPhase))*.045*speedFactor;
 const parts=[
  {mesh:pm.torso, mtx:mul(mat4.translate(0,1.05+bob,0),mat4.scale(.46,.62,.28))},
  {mesh:pm.belt,  mtx:mul(mat4.translate(0,.76+bob,0),mat4.scale(.48,.10,.30))},
 ];
 if(helmet){
  parts.push({mesh:pm.helmetShell, mtx:mul(mat4.translate(0,1.57+bob,0),mat4.scale(.33,.33,.33))});
  parts.push({mesh:pm.helmetVisor, mtx:mul(mat4.translate(0,1.55+bob,.155),mat4.scale(.26,.14,.05))});
  parts.push({mesh:pm.helmetCrest, mtx:mul(mat4.translate(0,1.80+bob,-.02),mat4.scale(.08,.10,.34))});
 }else{
  parts.push({mesh:pm.head,  mtx:mul(mat4.translate(0,1.55+bob,0),mat4.scale(.30,.30,.30))});
  parts.push({mesh:pm.hair,  mtx:mul(mat4.translate(0,1.665+bob,-.01),mat4.scale(.305,.14,.30))});
  parts.push({mesh:pm.eye,   mtx:mul(mat4.translate(-.08,1.565+bob,.148),mat4.scale(.045,.045,.03))});
  parts.push({mesh:pm.eye,   mtx:mul(mat4.translate(.08,1.565+bob,.148),mat4.scale(.045,.045,.03))});
 }
 parts.push(
  {mesh:pm.upperArm, mtx:mul(mat4.translate(.34,1.30+bob,0),mat4.rotX(swing*.8),mat4.translate(0,-.20,0),mat4.scale(.16,.40,.16))},
  {mesh:pm.lowerArm, mtx:mul(mat4.translate(.34,1.30+bob,0),mat4.rotX(swing*.8),mat4.translate(0,-.46,0),mat4.scale(.14,.30,.14))},
  {mesh:pm.upperArm, mtx:mul(mat4.translate(-.34,1.30+bob,0),mat4.rotX(swingOpp*.8),mat4.translate(0,-.20,0),mat4.scale(.16,.40,.16))},
  {mesh:pm.lowerArm, mtx:mul(mat4.translate(-.34,1.30+bob,0),mat4.rotX(swingOpp*.8),mat4.translate(0,-.46,0),mat4.scale(.14,.30,.14))},
  {mesh:pm.upperLeg, mtx:mul(mat4.translate(.16,.74+bob,0),mat4.rotX(swingOpp),mat4.translate(0,-.24,0),mat4.scale(.19,.48,.19))},
  {mesh:pm.lowerLeg, mtx:mul(mat4.translate(.16,.74+bob,0),mat4.rotX(swingOpp),mat4.translate(0,-.56,0),mat4.scale(.17,.34,.19))},
  {mesh:pm.upperLeg, mtx:mul(mat4.translate(-.16,.74+bob,0),mat4.rotX(swing),mat4.translate(0,-.24,0),mat4.scale(.19,.48,.19))},
  {mesh:pm.lowerLeg, mtx:mul(mat4.translate(-.16,.74+bob,0),mat4.rotX(swing),mat4.translate(0,-.56,0),mat4.scale(.17,.34,.19))},
 );
 return parts;
}
function buildCharacterBuffers(pal,walkPhase,speedFactor,helmet){
 return bakeParts(buildBodyParts(pal,walkPhase,speedFactor,helmet));
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

const scagnozzoBuf=makeBuffer(buildCharacterBuffers(PAL_SCAGNOZZO,0,0,true));
const raccoglitoreBuf=makeBuffer(buildCharacterBuffers(PAL_RACCOGLITORE,0,0,true));

let enemies=[];
function spawnWave(){
 enemies=[
  {type:"scagnozzo",buf:scagnozzoBuf,x:ARENA_CX-4,z:ARENA_CZ-2,yaw:0,hp:30,hpMax:30,state:"idle",cd:0,scale:1,alpha:1,dead:false},
  {type:"scagnozzo",buf:scagnozzoBuf,x:ARENA_CX+4,z:ARENA_CZ-2,yaw:0,hp:30,hpMax:30,state:"idle",cd:0,scale:1,alpha:1,dead:false},
  {type:"scagnozzo",buf:scagnozzoBuf,x:ARENA_CX,z:ARENA_CZ-6,yaw:0,hp:30,hpMax:30,state:"idle",cd:1.2,scale:1,alpha:1,dead:false},
  // Il Raccoglitore parte vicino alla riva — non ancora "uscito dal mare"
  // in senso vero e proprio (quello arriva con la fase 2), ma gia'
  // posizionato li' per quando costruiremo l'emersione.
  {type:"raccoglitore",buf:raccoglitoreBuf,x:ARENA_CX,z:SEA_EDGE_Z+1.5,yaw:0,hp:160,hpMax:160,state:"idle",cd:2,scale:1.55,alpha:1,dead:false,retreated:false},
 ];
}

// ============================================================
// stato di gioco
// ============================================================
const player={x:0,z:5.5,yaw:0,speed:2.6,walkPhase:0,transformed:false,helmet:false,
 hp:100,hpMax:100,energy:0,energyMax:100,attackT:0,dodgeT:0,dodgeCd:0,invuln:0,hitFlashT:0};
const camState={dist:4.2,height:2.1,yawOffset:0};
const keys={};
const flashEl=document.getElementById("flash");
const transformCardEl=document.getElementById("transformCard");
const titleEl=document.getElementById("titleScreen");
const hudEl=document.getElementById("gameHud");
const energyFillEl=document.getElementById("energyFill");
const hpFillEl=document.getElementById("hpFill");
const missionHintEl=document.getElementById("missionHint");
let gameStarted=false;

// Zone: "torre" (sala di comando) oppure "arena" (missione di combattimento).
// Ognuna ha i propri confini per il movimento/telecamera, cosi' non serve
// un'unica stanza enorme che le contenga entrambe.
let zone="torre";
const ZONES={
 torre:{w:ROOM_W,d:ROOM_D,cx:0,cz:0},
 arena:{w:26,d:26,cx:0,cz:-60},
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
}
function enterTorre(){
 zone="torre";
 player.x=0; player.z=5.5; player.yaw=0;
 missionHintEl.classList.remove("show");
}

function beginGame(){
 if(gameStarted)return;
 gameStarted=true;
 titleEl.style.display="none";
 hudEl.style.display="block";
 document.body.classList.add("started");
}
titleEl.addEventListener("click",beginGame);
window.addEventListener("keydown",e=>{
 keys[e.code]=true;
 if(e.code==="Space"&&!gameStarted){beginGame();return;}
 if(e.code==="KeyT")startTransformation();
 if(e.code==="KeyM"&&gameStarted&&!transformState){ if(zone==="torre")enterArena(); else enterTorre(); }
 if(e.code==="KeyF")tryAttack();
 if(e.code==="KeyC")trySpecial();
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
}
function updateTransformation(dt){
 if(!transformState){transformCardEl.classList.remove("show");return;}
 transformState.t+=dt;
 const t=transformState.t;
 // due lampi rapidi, poi la palette cambia, poi un lampo finale piu' lungo
 flashEl.style.opacity =
  (t>.15&&t<.28)?.85 :
  (t>.45&&t<.55)?.9 :
  (t>1.35&&t<1.75)?Math.max(0,1-(t-1.35)/.4) : 0;
 // la card eroica compare solo diventando Ranger (non tornando civile),
 // tra il secondo lampo e l'ultimo, cosi' accompagna il cambio invece di
 // saltare fuori a caso.
 if(transformState.toRanger&&t>.55&&t<1.55)transformCardEl.classList.add("show");
 else transformCardEl.classList.remove("show");
 if(t>.9&&player.transformed!==transformState.toRanger){
  player.transformed=transformState.toRanger;
  player.helmet=transformState.toRanger;
 }
 if(t>2.1)transformState=null;
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
 for(const en of enemies){
  if(en.dead)continue;
  const f=facingDot(player.x,player.z,player.yaw,en.x,en.z);
  if(f.dist<1.7&&f.dot>.55){
   damageEnemy(en,16);
   player.energy=Math.min(player.energyMax,player.energy+9);
  }
 }
}
function trySpecial(){
 if(!player.transformed||transformState||player.energy<player.energyMax||player.attackT>0)return;
 player.attackT=.5;
 player.energy=0;
 for(const en of enemies){
  if(en.dead)continue;
  const f=facingDot(player.x,player.z,player.yaw,en.x,en.z);
  if(f.dist<2.6&&f.dot>.25)damageEnemy(en,42);
 }
}
function tryDodge(){
 if(!player.transformed||transformState||player.dodgeCd>0)return;
 player.dodgeT=.28;player.dodgeCd=.85;player.invuln=.34;
}
function damageEnemy(en,amt){
 en.hp-=amt;en.hitFlash=.15;
 if(en.hp<=0){
  if(en.type==="raccoglitore"&&!en.retreated){
   // Il Raccoglitore non muore qui: si ritira, come da copione — tornera'
   // in scala gigante nella fase successiva (non ancora costruita).
   en.retreated=true;en.state="retreat";
  }else{
   en.dead=true;
  }
 }
}
function updateEnemies(dt){
 for(const en of enemies){
  if(en.dead)continue;
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
  }else if(en.cd<=0){
   en.cd=en.type==="raccoglitore"?1.7:2.1;
   en.attackFlashT=.5;
   if(player.invuln<=0){
    const dmg=en.type==="raccoglitore"?14:7;
    player.hp=Math.max(0,player.hp-dmg);
    player.hitFlashT=.3;
   }
  }
  if(en.attackFlashT>0)en.attackFlashT-=dt;
 }
}

function resize(){
 c.width=innerWidth*devicePixelRatio;c.height=innerHeight*devicePixelRatio;
 c.style.width=innerWidth+"px";c.style.height=innerHeight+"px";
 gl.viewport(0,0,c.width,c.height);
}
window.addEventListener("resize",resize);
resize();

let last=performance.now();
function frame(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;
 updateTransformation(dt);
 const inputLocked=!!transformState||!gameStarted;
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

 // timer di combattimento
 player.attackT=Math.max(0,player.attackT-dt);
 player.dodgeT=Math.max(0,player.dodgeT-dt);
 player.dodgeCd=Math.max(0,player.dodgeCd-dt);
 player.invuln=Math.max(0,player.invuln-dt);
 player.hitFlashT=Math.max(0,player.hitFlashT-dt);
 if(zone==="arena"&&gameStarted&&!transformState)updateEnemies(dt);

 player.walkPhase+=dt*(moving?8.5:0);
 const pal=player.transformed?PAL_ZERO:PAL_CIVILE;
 const zoomIn=transformState?Math.min(1,transformState.t/.6):0;
 const attackLean=player.attackT>0?Math.sin((.34-player.attackT)/.34*Math.PI)*.35:0;
 const charMesh=buildCharacterBuffers(pal,player.walkPhase,moving?1:0,player.helmet);
 const charBuf=makeBuffer(charMesh);

 // camera terza persona dietro il personaggio, con collisione contro i
 // muri: prima "sbatteva" dentro la geometria quando ci si girava vicino
 // a una parete. Ora la posizione ideale viene bloccata dentro i bordi
 // della zona attuale con un margine, cosi' l'occhio non entra mai nel muro.
 const camYaw=player.yaw+camState.yawOffset;
 const dist=camState.dist*(1-zoomIn*.55);
 let eyeX=player.x - Math.sin(camYaw)*dist;
 let eyeZ=player.z - Math.cos(camYaw)*dist;
 eyeX=Math.max(zb.camXmin,Math.min(zb.camXmax,eyeX));
 eyeZ=Math.max(zb.camZmin,Math.min(zb.camZmax,eyeZ));
 const eye=[eyeX,camState.height,eyeZ];
 const target=[player.x,1.1+zoomIn*.35,player.z];
 const view=mat4.lookAt(eye,target,[0,1,0]);
 const proj=mat4.perspective(60*Math.PI/180, c.width/c.height, .1, 100);
 const vp=mat4.multiply(proj,view);

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

  // squadra: 4 Ranger fermi, con casco, colori da bibbia personaggi
  for(const m of teamMembers)drawBuffer(m.buf, mul(mat4.translate(m.x,0,m.z),mat4.rotY(m.yaw)), vp);

  // TIC: fluttua con un piccolo su-e-giu' e rotazione lenta
  const ticY=ticHome.y+Math.sin(now/500)*.10;
  const ticModel=mul(mat4.translate(ticHome.x,ticY,ticHome.z),mat4.rotY(now/900));
  drawBuffer(ticBuf,ticModel,vp);
 }else{
  drawBuffer(arenaFloorBuf,mat4.identity(),vp);
  drawBuffer(arenaSeaBuf,mat4.identity(),vp);
  drawBuffer(arenaPropBuf,mat4.identity(),vp);
  drawBuffer(arenaEdgeBuf,mat4.identity(),vp);
  for(const en of enemies){
   if(en.dead)continue;
   const hitPulse=en.hitFlash>0?1+en.hitFlash*1.6:1;
   const s=en.scale*hitPulse;
   const enModel=mul(mat4.translate(en.x,0,en.z),mat4.rotY(en.yaw),mat4.scale(s,s,s));
   drawBuffer(en.buf,enModel,vp,en.alpha);
  }
 }

 const charModel=mul(mat4.translate(player.x,0,player.z),mat4.rotY(player.yaw),mat4.rotX(-attackLean*0));
 drawBuffer(charBuf,charModel,vp);

 gl.deleteBuffer(charBuf.posB);gl.deleteBuffer(charBuf.nrmB);gl.deleteBuffer(charBuf.colB);

 // HUD: barra energia + barra vita
 if(gameStarted){
  energyFillEl.style.width=(player.energy/player.energyMax*100)+"%";
  hpFillEl.style.width=Math.max(0,player.hp/player.hpMax*100)+"%";
 }

 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// esposto per test/debug
window.__rz={player,camState,startTransformation,enterArena,enterTorre,get enemies(){return enemies},get zone(){return zone}};
})();
