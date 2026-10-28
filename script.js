'use strict';
const $ = id => document.getElementById(id);

const ITEMS = {
  coffee: { name: '커피 원액', image: 'coffee.png' },
  milk: { name: '우유', image: 'milk.png' },
  caramel: { name: '카라멜 시럽', image: 'caramel.png' },
  cream: { name: '휘핑 크림', image: 'cream.png' }
};
const MENU = [
  { id:'americano', name:'아메리카노', image:'drink_americano.png', price:3000, recipe:{coffee:2} },
  { id:'latte', name:'카페라떼', image:'drink_latte.png', price:4500, recipe:{coffee:1,milk:1} },
  { id:'double', name:'더블 라떼', image:'drink_double.png', price:6000, recipe:{coffee:2,milk:1} },
  { id:'caramel', name:'카라멜 라떼', image:'drink_caramel.png', price:6500, recipe:{coffee:1,milk:1,caramel:1,cream:1} }
];
const CHARACTERS = [
  {label:'양복 입은 남성 직장인',file:'guest_office_male.png'},
  {label:'양복 입은 여성 직장인',file:'guest_office_female.png'},
  {label:'안경 쓴 남학생',file:'guest_student_male.png'},
  {label:'안경 쓴 여학생',file:'guest_student_female.png'},
  {label:'젊은 남성',file:'guest_young_male.png'},
  {label:'젊은 여성',file:'guest_young_female.png'}
];
const STAGES = [
  {name:'1단계',hint:'기본 영업',goal:18000,maxOrders:6,undoLimit:3,stock:{coffee:12,milk:7,caramel:4,cream:4}},
  {name:'2단계',hint:'바쁜 점심',goal:30000,maxOrders:7,undoLimit:2,stock:{coffee:14,milk:8,caramel:5,cream:5}},
  {name:'3단계',hint:'피크 타임',goal:42000,maxOrders:9,undoLimit:1,stock:{coffee:18,milk:10,caramel:6,cream:6}}
];
const ENDLESS = {name:'무한 모드',hint:'60초 추가 영업',undoLimit:2,stock:{coffee:20,milk:12,caramel:8,cream:8}};
const ENDLESS_SECONDS = 60;
const RANK_KEY = 'oneDayCafeRankingsV1';
const AUDIO_KEY = 'oneDayCafeAudioSettingsV1';

const SFX = Object.fromEntries(['button','order','ingredient','sale','stage','finish'].map(name=>[name,new Audio(`assets/sounds/${name}.wav`)]));
const BGM = new Audio('assets/music/cafe_bgm.wav');
BGM.loop=true;BGM.preload='auto';
let sfxVolume=.58,bgmVolume=.24,bgmEnabled=true;
Object.values(SFX).forEach(a=>{a.preload='auto';a.volume=sfxVolume});
BGM.volume=bgmVolume;

let stock={},cup={},history=[],guests=[];
let stageIndex=0,served=0,stageRevenue=0,totalRevenue=0;
let stageUndoUsed=0,totalUndoCount=0;
let sound=true,locked=false,gameOver=false,mode='stage',modalMode='start-menu';
let gameStarted=false,runStartedAt=0,stage3ClearedAt=0,endlessEndsAt=0,timerHandle=null,endlessServed=0;
let tutorialIndex=-1,tutorialResumeAfter=false,tutorialPausedAt=0,tutorialFromCover=false;

const byId=id=>MENU.find(m=>m.id===id);
const fmt=n=>n.toLocaleString('ko-KR')+'원';
const currentUndoLimit=()=>mode==='endless'?ENDLESS.undoLimit:STAGES[stageIndex].undoLimit;
const undoRemaining=()=>Math.max(0,currentUndoLimit()-stageUndoUsed);
const recipeKey=recipe=>Object.keys(ITEMS).map(k=>recipe[k]||0).join('|');
const matchedMenu=()=>MENU.find(m=>recipeKey(m.recipe)===recipeKey(cup))||null;
const matchingGuestIndexes=menu=>menu?guests.map((g,i)=>g.menuId===menu.id?i:-1).filter(i=>i>=0):[];

function loadAudioSettings(){
  try{
    const saved=JSON.parse(localStorage.getItem(AUDIO_KEY)||'null');
    if(saved){
      if(typeof saved.sound==='boolean')sound=saved.sound;
      if(typeof saved.bgmEnabled==='boolean')bgmEnabled=saved.bgmEnabled;
      if(Number.isFinite(saved.sfxVolume))sfxVolume=Math.min(1,Math.max(0,saved.sfxVolume));
      if(Number.isFinite(saved.bgmVolume))bgmVolume=Math.min(1,Math.max(0,saved.bgmVolume));
    }
  }catch(e){}
}
function saveAudioSettings(){
  try{localStorage.setItem(AUDIO_KEY,JSON.stringify({sound,bgmEnabled,sfxVolume,bgmVolume}))}catch(e){}
}
function applyAudioSettings(){
  Object.values(SFX).forEach(a=>a.volume=sfxVolume);
  BGM.volume=bgmVolume;
  if($('soundBtn'))$('soundBtn').textContent='♫ 효과음: '+(sound?'켜짐':'꺼짐');
  if($('bgmBtn'))$('bgmBtn').textContent='♬ 배경음악: '+(bgmEnabled?'켜짐':'꺼짐');
  if($('sfxVolume'))$('sfxVolume').value=String(Math.round(sfxVolume*100));
  if($('bgmVolume'))$('bgmVolume').value=String(Math.round(bgmVolume*100));
  if($('sfxVolumeValue'))$('sfxVolumeValue').textContent=Math.round(sfxVolume*100)+'%';
  if($('bgmVolumeValue'))$('bgmVolumeValue').textContent=Math.round(bgmVolume*100)+'%';
}
function tryStartBgm(){
  if(!bgmEnabled)return;
  BGM.volume=bgmVolume;
  const p=BGM.play();
  if(p&&p.catch)p.catch(()=>{});
}
function setBgmEnabled(enabled){
  bgmEnabled=enabled;
  if(bgmEnabled)tryStartBgm();else BGM.pause();
  applyAudioSettings();saveAudioSettings();
}
function playSfx(name){if(!sound||!SFX[name])return;const a=SFX[name];a.volume=sfxVolume;a.currentTime=0;a.play().catch(()=>{})}
function toast(text){$('toast').textContent=text}
function shuffled(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function randomMenu(){return MENU[Math.floor(Math.random()*MENU.length)].id}
function createGuest(characterIndex){return{characterIndex,menuId:randomMenu()}}
function nextCharacterIndex(replacingIndex){const used=new Set(guests.filter((_,i)=>i!==replacingIndex).map(g=>g.characterIndex));const choices=CHARACTERS.map((_,i)=>i).filter(i=>!used.has(i));return choices[Math.floor(Math.random()*choices.length)]}
function emptyCup(){cup={};history=[]}
function formatSec(sec){return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function setStage(index){
  stageIndex=index;mode='stage';served=0;stageRevenue=0;stageUndoUsed=0;stock={...STAGES[index].stock};emptyCup();
  const chars=shuffled(CHARACTERS.map((_,i)=>i)).slice(0,3);guests=chars.map(createGuest);locked=false;gameOver=false;render();
}
function resetGame(){
  stopTimer();totalRevenue=0;totalUndoCount=0;endlessServed=0;runStartedAt=0;stage3ClearedAt=0;endlessEndsAt=0;gameStarted=false;setStage(0);$('timerText').textContent='00:00';toast('게임 시작 전입니다.');renderRankingSection();
}
function startRun(){if(gameStarted)return;gameStarted=true;runStartedAt=Date.now();startClock();toast('1단계 시작! 원하는 주문을 보고 자유롭게 음료를 만들어 주세요.');render()}
function restartImmediately(){closeTutorial();resetGame();gameStarted=true;runStartedAt=Date.now();startClock();toast('1단계부터 다시 시작했습니다.');render();playSfx('button')}
function render(){renderGuests();renderIngredients();renderCup();renderHeader()}
function renderHeader(){
  const stage=STAGES[stageIndex];
  $('stageName').textContent=mode==='endless'?'무한 모드':stage.name;
  $('stageHint').textContent=mode==='endless'?`${ENDLESS.name} · ${ENDLESS.hint}`:`${stage.name} · ${stage.hint}`;
  $('goalRevenue').textContent=mode==='endless'?'제한 없음':fmt(stage.goal);
  $('revenue').textContent=mode==='endless'?fmt(totalRevenue):fmt(stageRevenue);
  $('served').textContent=mode==='endless'?`${endlessServed}건`:`${served} / ${stage.maxOrders}`;
  $('undoCount').textContent=`${undoRemaining()} / ${currentUndoLimit()}`;
  $('progressDots').innerHTML=STAGES.map((_,i)=>`<i class="${mode==='endless'||i<stageIndex?'done':i===stageIndex?'active':''}"></i>`).join('')+`<i class="${mode==='endless'?'active':''}"></i>`;
  const noUndo=undoRemaining()<=0;
  $('undoBtn').disabled=noUndo||!history.length||locked||gameOver||!gameStarted;
  $('resetCup').disabled=noUndo||!history.length||locked||gameOver||!gameStarted;
  $('undoBtn').textContent=`↶ 한 단계 취소 (${undoRemaining()})`;
}
function renderGuests(){
  const area=$('guests');area.innerHTML='';
  guests.forEach((guest,i)=>{
    const menu=byId(guest.menuId),character=CHARACTERS[guest.characterIndex],card=document.createElement('div');
    card.className='guest';card.dataset.guestIndex=String(i);card.setAttribute('aria-label',`${character.label}, ${menu.name} 주문`);
    const ingredients=Object.entries(menu.recipe).map(([key,count])=>`<span class="order-ingredient"><img src="assets/${ITEMS[key].image}" alt="${ITEMS[key].name}"><span>×${count}</span></span>`).join('');
    card.innerHTML=`<div class="speech"><img class="drink-icon" src="assets/${menu.image}" alt="${menu.name}"><span class="speech-copy"><b>${menu.name}</b><small class="order-ingredients">${ingredients}</small><small>${fmt(menu.price)}</small></span></div><div class="portrait-wrap"><img class="portrait" src="assets/${character.file}" alt="${character.label}"></div>`;
    area.appendChild(card)
  })
}
function renderIngredients(){
  const box=$('ingredients');box.innerHTML='';
  Object.entries(ITEMS).forEach(([key,item])=>{
    const b=document.createElement('button');b.className='ingredient';b.type='button';b.dataset.ingredient=key;b.disabled=!gameStarted||locked||gameOver||stock[key]<=0;
    b.innerHTML=`<span class="ingredient-image-wrap"><img src="assets/${item.image}" alt="${item.name}"></span><span class="ingredient-name">${item.name}</span><span class="count">× ${stock[key]||0}</span>`;
    b.addEventListener('click',()=>addIngredient(key));box.appendChild(b)
  })
}
function recipePossibleWithStock(menu){return Object.entries(menu.recipe).every(([k,n])=>(stock[k]||0)>=n)}
function anyGuestOrderPossible(){return guests.some(g=>recipePossibleWithStock(byId(g.menuId)))}
function anyRecipeStillPossibleFromCup(){
  return MENU.some(menu=>Object.keys(ITEMS).every(key=>{
    const inCup=cup[key]||0,need=menu.recipe[key]||0;
    return inCup<=need && inCup+(stock[key]||0)>=need;
  }));
}
function addIngredient(key){
  if(!gameStarted||locked||gameOver||(stock[key]||0)<=0)return;
  stock[key]--;cup[key]=(cup[key]||0)+1;history.push(key);playSfx('ingredient');render();
  const p=$('pour');p.classList.remove('hidden');p.style.background=key==='milk'?'#fff8e8':key==='cream'?'#fff1df':key==='caramel'?'#d9903d':'#6b321d';p.style.animation='none';void p.offsetWidth;p.style.animation='';setTimeout(()=>p.classList.add('hidden'),420);
  const match=matchedMenu();
  if(match){
    const count=matchingGuestIndexes(match).length;
    if(!count&&undoRemaining()<=0){finishRun(mode==='endless',`${match.name}을 완성했지만 현재 해당 주문 손님이 없고 되돌리기 횟수도 남아 있지 않아 영업이 종료되었습니다.`);return}
    toast(count?`${match.name} 완성! 현재 주문 ${count}건과 일치합니다.`:`${match.name} 완성! 현재 이 메뉴를 주문한 손님은 없습니다. 되돌리기로 컵을 비워 주세요.`);
  }else if(!anyRecipeStillPossibleFromCup()){
    if(undoRemaining()<=0){finishRun(mode==='endless','현재 컵으로 어떤 메뉴도 완성할 수 없고 되돌리기 횟수도 남아 있지 않아 영업이 종료되었습니다.');return}
    toast('현재 조합으로는 어떤 메뉴도 완성할 수 없습니다. 되돌리기를 사용해 주세요.');
  }else toast(`${ITEMS[key].name} 추가 · 남은 재고 ${stock[key]}개`)
}
function consumeUndo(){if(undoRemaining()<=0){toast('이 단계의 되돌리기 횟수를 모두 사용했습니다.');return false}stageUndoUsed++;totalUndoCount++;return true}
function refundCup(){if(!history.length||locked||gameOver)return;if(!consumeUndo())return;history.forEach(k=>stock[k]++);emptyCup();playSfx('button');render();toast(`컵을 비우고 재고를 복구했습니다. 되돌리기 ${undoRemaining()}회 남음.`)}
function undoOne(){if(!history.length||locked||gameOver)return;if(!consumeUndo())return;const k=history.pop();stock[k]++;cup[k]--;if(cup[k]===0)delete cup[k];playSfx('button');render();toast(`${ITEMS[k].name} 1개를 되돌렸습니다. 되돌리기 ${undoRemaining()}회 남음.`)}
function renderCup(){
  const n=history.length,hasMilk=(cup.milk||0)>0,liquid=$('cupLiquid');
  liquid.style.height=Math.min(88,n*22)+'%';liquid.style.background=hasMilk?'linear-gradient(#e9cfa7,#a26741,#e5c69e)':'linear-gradient(#9c5732,#40251c)';
  $('cupFoam').style.height=(cup.cream||0)>0?'22px':hasMilk?'12px':'0';
  $('mixInfo').textContent=n?Object.entries(cup).map(([k,v])=>`${ITEMS[k].name} ${v}`).join(' · '):'빈 컵 · 만들고 싶은 메뉴의 재료를 넣어 주세요.';
  const menu=matchedMenu(),ordered=matchingGuestIndexes(menu).length>0;
  $('finishedArt').innerHTML=menu?`<img src="assets/${menu.image}" alt="${menu.name}">`:'<span class="empty-cup">☕</span>';
  $('finishedName').textContent=menu?(ordered?`${menu.name} 완성!`:`${menu.name} · 현재 주문 없음`):'음료 제조 중';
  $('serveBtn').disabled=!gameStarted||!menu||!ordered||locked||gameOver;
  $('mixTitle').textContent=menu?`제조 중 · 완성 메뉴: ${menu.name}`:'제조 중 · 자유 제조';
}
function serve(){
  if(!gameStarted||locked||gameOver)return;
  const menu=matchedMenu();if(!menu)return;
  const matches=matchingGuestIndexes(menu);if(!matches.length){toast(`${menu.name}을 주문한 손님이 현재 없습니다.`);return}
  const target=matches[0];locked=true;stageRevenue+=menu.price;totalRevenue+=menu.price;if(mode==='endless')endlessServed++;else served++;playSfx('sale');renderHeader();
  const departing=$('guests').children[target];if(departing)departing.classList.add('exit');toast(`${menu.name} 주문 손님에게 전달 완료! +${fmt(menu.price)}`);
  setTimeout(()=>{guests[target]=createGuest(nextCharacterIndex(target));emptyCup();locked=false;render();const entered=$('guests').children[target];if(entered)entered.classList.add('enter');checkProgress()},340)
}
function checkProgress(){
  if(gameOver)return;
  if(mode==='endless'){
    if(!anyGuestOrderPossible()){finishRun(true,'남은 재료로 현재 손님 3명의 주문을 더 이상 만들 수 없어 무한 모드가 종료되었습니다.');return}
    toast('무한 모드 진행 중 · 원하는 주문을 골라 만들어 판매하세요!');return
  }
  const stage=STAGES[stageIndex];
  if(stageRevenue>=stage.goal){if(stageIndex<2)showStageClear();else{stage3ClearedAt=Date.now();enterEndless()}return}
  if(served>=stage.maxOrders){finishRun(false,`${stage.name} 주문 한도 ${stage.maxOrders}건을 모두 사용했지만 목표 매출에 도달하지 못했습니다.`);return}
  if(!anyGuestOrderPossible()){finishRun(false,'남은 재료로 현재 손님 3명의 주문을 하나도 만들 수 없습니다.');return}
  toast('새 손님이 입장했습니다!')
}
function showStageClear(){playSfx('stage');const s=STAGES[stageIndex];showModal(`🎉 ${s.name} 성공!`,`<div class="stage-card"><div class="big">${fmt(stageRevenue)}</div><p>${s.name} 목표 ${fmt(s.goal)} 달성</p><p>다음 단계에서는 되돌리기 가능 횟수가 줄어듭니다.</p></div>`,'다음 단계 시작','stage-clear',false)}
function enterEndless(){
  mode='endless';stock={...ENDLESS.stock};served=0;stageRevenue=0;stageUndoUsed=0;emptyCup();endlessEndsAt=Date.now()+ENDLESS_SECONDS*1000;playSfx('stage');render();toast('♾️ 3단계 클리어! 무한 모드 60초가 시작되었습니다.');startClock();
  if(!anyGuestOrderPossible())finishRun(true,'무한 모드 시작 직후 만들 수 있는 주문이 없어 종료되었습니다.')
}
function startClock(){stopTimer();timerHandle=setInterval(updateTimer,250);updateTimer()}
function stopTimer(){if(timerHandle){clearInterval(timerHandle);timerHandle=null}}
function updateTimer(){
  if(!gameStarted||!runStartedAt)return;
  if(mode==='endless'){
    const remain=Math.max(0,Math.ceil((endlessEndsAt-Date.now())/1000));$('timerText').textContent=`${String(Math.floor(remain/60)).padStart(2,'0')}:${String(remain%60).padStart(2,'0')}`;
    if(remain<=0&&!gameOver)finishRun(true,'무한 모드 제한 시간 60초가 종료되었습니다.')
  }else{const sec=Math.floor((Date.now()-runStartedAt)/1000);$('timerText').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
}
function elapsedClearSeconds(){return stage3ClearedAt&&runStartedAt?Math.max(0,Math.floor((stage3ClearedAt-runStartedAt)/1000)):0}
function calculateScore(){const clearSec=elapsedClearSeconds();const revenuePoints=Math.floor(totalRevenue/10);const timeBonus=stage3ClearedAt?Math.max(0,300-clearSec)*20:0;const undoPenalty=totalUndoCount*250;return{score:Math.max(0,revenuePoints+timeBonus-undoPenalty),revenuePoints,timeBonus,undoPenalty,clearSec}}
function finishRun(cleared,reason){if(gameOver)return;gameOver=true;locked=true;stopTimer();playSfx(cleared?'finish':'button');render();showFinal(cleared,reason)}
function getRankings(){try{return JSON.parse(localStorage.getItem(RANK_KEY)||'[]')}catch(e){return[]}}
function saveRanking(name){const s=calculateScore();const list=getRankings();const entry={id:Date.now(),name:name.slice(0,12),score:s.score,revenue:totalRevenue,clearSec:s.clearSec,undos:totalUndoCount,cleared:!!stage3ClearedAt,mode:mode==='endless'?'무한 모드':`${stageIndex+1}단계`,date:new Date().toISOString()};list.push(entry);list.sort((a,b)=>b.score-a.score||b.revenue-a.revenue||a.clearSec-b.clearSec);const top=list.slice(0,20);try{localStorage.setItem(RANK_KEY,JSON.stringify(top))}catch(e){}return{list:top,id:entry.id}}
function rankingTable(list,meId){return `<table class="ranking"><thead><tr><th>순위</th><th>닉네임</th><th>점수</th><th>총매출</th><th>3단계 클리어</th><th>되돌리기</th><th>도달 구간</th></tr></thead><tbody>${list.slice(0,10).map((r,i)=>`<tr class="${r.id===meId?'me':''}"><td>${i+1}</td><td>${escapeHtml(r.name)}</td><td>${Number(r.score).toLocaleString()}</td><td>${fmt(Number(r.revenue)||0)}</td><td>${r.cleared?formatSec(Number(r.clearSec)||0):'-'}</td><td>${r.undos??0}회</td><td>${escapeHtml(r.mode||'-')}</td></tr>`).join('')||'<tr><td colspan="7">아직 등록된 기록이 없습니다.</td></tr>'}</tbody></table>`}
function renderRankingSection(meId){$('globalRankingArea').innerHTML=rankingTable(getRankings(),meId)}
function showFinal(cleared,reason){
  const s=calculateScore();
  const body=`<p class="rule" style="text-align:center"><b>${reason}</b><br>최종 총매출 ${fmt(totalRevenue)} · 되돌리기 ${totalUndoCount}회</p><div class="score-breakdown"><b>최종 점수 ${s.score.toLocaleString()}점</b><br>총매출 점수: ${s.revenuePoints.toLocaleString()}점 (총매출 ÷ 10)<br>시간 보너스: ${s.timeBonus.toLocaleString()}점 (3단계까지 300초보다 빠른 1초당 +20점)<br>되돌리기 감점: -${s.undoPenalty.toLocaleString()}점 (1회당 -250점)<br>3단계 클리어 시간: ${stage3ClearedAt?formatSec(s.clearSec):'미클리어'}</div><div class="rank-form"><input id="nicknameInput" maxlength="12" placeholder="닉네임 입력" aria-label="랭킹 닉네임"><button id="rankSubmit" class="primary">랭킹 등록</button></div><p class="hint">등록한 순위는 게임 화면 아래의 랭킹 창에서도 확인할 수 있습니다.</p>`;
  showModal(cleared?'🏆 영업 종료 · 최종 결과':'🌙 영업 실패',body,'처음부터 다시 플레이','final',false);
  setTimeout(()=>{const btn=$('rankSubmit');if(btn)btn.addEventListener('click',()=>{const input=$('nicknameInput');const name=input.value.trim();if(!name){input.focus();return}const saved=saveRanking(name);renderRankingSection(saved.id);btn.disabled=true;input.disabled=true;playSfx('finish')})},0)
}
function setModalStartLayout(isStart){
  $('modalHelpBtn').classList.toggle('hidden',!isStart);
  $('modalActions').classList.toggle('single',!isStart);
  document.querySelector('.modal').classList.toggle('start-modal',isStart);
}


const GAME_DESIGN_WIDTH=1600;
const GAME_DESIGN_HEIGHT=900;
function fitGameCanvas(){
  const shell=$('gameScaleShell');
  const game=$('game');
  if(!shell||!game)return;
  const availableW=Math.max(320,window.innerWidth);
  const availableH=Math.max(420,window.innerHeight);
  const scale=Math.min(1,availableW/GAME_DESIGN_WIDTH,availableH/GAME_DESIGN_HEIGHT);
  shell.style.width=`${Math.round(GAME_DESIGN_WIDTH*scale)}px`;
  shell.style.height=`${Math.round(GAME_DESIGN_HEIGHT*scale)}px`;
  game.style.transform=`scale(${scale})`;
}

function showCover(){
  stopTimer();
  $('coverScreen').classList.remove('hidden');
  $('gameScaleShell').classList.add('hidden');
  $('game').classList.add('hidden');
  $('rankingSection').classList.add('hidden');
  $('modalLayer').classList.add('hidden');
  $('settingsMenu').classList.add('hidden');
  window.scrollTo({top:0,behavior:'auto'});
}
function showGameShell(){
  $('coverScreen').classList.add('hidden');
  $('gameScaleShell').classList.remove('hidden');
  $('game').classList.remove('hidden');
  fitGameCanvas();
  $('rankingSection').classList.remove('hidden');
  window.scrollTo({top:0,behavior:'auto'});
}
function startFromCover(){
  showGameShell();
  startRun();
}
function tutorialFromMainCover(){
  resetGame();
  showGameShell();
  tutorialFromCover=true;
  startTutorial();
}

function showStartMenu(){
  modalMode='start-menu';$('modalTitle').textContent='☕ 오늘의 카페';$('modalBody').innerHTML='<p class="start-copy">카페 영업을 시작할 준비가 되셨나요?</p>';$('modalConfirm').textContent='☕ 게임 시작';$('modalHelpBtn').textContent='📖 게임 방법';$('modalClose').classList.add('hidden');setModalStartLayout(true);$('modalLayer').classList.remove('hidden');
}
function showModal(title,body,button='확인',modeName='help',closable=true){
  $('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modalConfirm').textContent=button;modalMode=modeName;$('modalClose').classList.toggle('hidden',!closable);setModalStartLayout(false);$('modalLayer').classList.remove('hidden');$('settingsMenu').classList.add('hidden')
}

const TUTORIAL = [
  {target:'#guests .speech',title:'1. 손님 주문 확인',text:'상단 말풍선에서 세 손님의 메뉴와 필요한 재료를 확인하세요. 손님을 선택할 필요는 없습니다.'},
  {target:'#ingredients .ingredient',title:'2. 재료 선택',text:'왼쪽 재료 이미지를 클릭하면 제조대 컵에 바로 추가되고 재고가 1개 줄어듭니다.'},
  {target:'#cupArea',title:'3. 제조 상태 확인',text:'넣은 재료는 이 제조대에 표시됩니다. 정확한 레시피가 완성되면 오른쪽에 완성 음료가 나타납니다.'},
  {target:'#resetCup',title:'4. 되돌리기',text:'실수했다면 컵 비우기·재고 복구 또는 한 단계 취소를 사용할 수 있습니다. 단계별 사용 횟수 제한이 있습니다.'},
  {target:'#serveBtn',title:'5. 음료 전달',text:'완성된 메뉴를 주문한 손님이 있으면 전달 버튼이 활성화됩니다. 누르면 해당 주문 손님이 자동으로 완료 처리됩니다.'}
];
function startTutorial(){
  $('modalLayer').classList.add('hidden');$('settingsMenu').classList.add('hidden');tutorialResumeAfter=gameStarted&&!gameOver;tutorialPausedAt=Date.now();tutorialIndex=0;if(tutorialResumeAfter)stopTimer();render();$('tutorialLayer').classList.remove('hidden');positionTutorial();
}
function positionTutorial(){
  if(tutorialIndex<0||tutorialIndex>=TUTORIAL.length){finishTutorial();return}
  const step=TUTORIAL[tutorialIndex],target=document.querySelector(step.target);if(!target){tutorialIndex++;positionTutorial();return}
  const rect=target.getBoundingClientRect(),pad=7,hl=$('tutorialHighlight');
  hl.style.left=`${Math.max(4,rect.left-pad)}px`;hl.style.top=`${Math.max(4,rect.top-pad)}px`;hl.style.width=`${Math.min(innerWidth-8,rect.width+pad*2)}px`;hl.style.height=`${Math.min(innerHeight-8,rect.height+pad*2)}px`;
  $('tutorialStep').textContent=`${tutorialIndex+1} / ${TUTORIAL.length}`;$('tutorialTitle').textContent=step.title;$('tutorialText').textContent=step.text;
  const card=$('tutorialCard'),cardW=Math.min(360,innerWidth-24);card.style.width=`${cardW}px`;const below=rect.bottom+18;const top=below+170<innerHeight?below:Math.max(12,rect.top-190);let left=Math.min(innerWidth-cardW-12,Math.max(12,rect.left+rect.width/2-cardW/2));card.style.left=`${left}px`;card.style.top=`${top}px`;
}
function tutorialNext(){if(tutorialIndex<0)return;playSfx('button');tutorialIndex++;if(tutorialIndex>=TUTORIAL.length){finishTutorial();return}positionTutorial()}
function finishTutorial(){
  const resume=tutorialResumeAfter,paused=Math.max(0,Date.now()-tutorialPausedAt),fromCover=tutorialFromCover;closeTutorial();
  if(resume){if(runStartedAt)runStartedAt+=paused;if(stage3ClearedAt)stage3ClearedAt+=paused;if(endlessEndsAt)endlessEndsAt+=paused;startClock();toast('게임으로 돌아왔습니다.');render();return}
  if(fromCover){tutorialFromCover=false;showCover();return}
  showCover();
}
function closeTutorial(){tutorialIndex=-1;tutorialResumeAfter=false;tutorialPausedAt=0;$('tutorialLayer').classList.add('hidden')}

$('coverStartBtn').addEventListener('click',()=>{tryStartBgm();playSfx('button');startFromCover()});
$('coverHelpBtn').addEventListener('click',()=>{tryStartBgm();playSfx('button');tutorialFromMainCover()});
$('serveBtn').addEventListener('click',serve);
$('resetCup').addEventListener('click',refundCup);
$('undoBtn').addEventListener('click',undoOne);
$('restartBoardBtn').addEventListener('click',restartImmediately);
$('settingsBtn').addEventListener('click',()=>{$('settingsMenu').classList.toggle('hidden');playSfx('button')});
$('helpBtn').addEventListener('click',()=>{playSfx('button');startTutorial()});
$('soundBtn').addEventListener('click',()=>{sound=!sound;applyAudioSettings();saveAudioSettings();if(sound)playSfx('button')});
$('bgmBtn').addEventListener('click',()=>{setBgmEnabled(!bgmEnabled);if(sound)playSfx('button')});
$('sfxVolume').addEventListener('input',e=>{sfxVolume=Number(e.target.value)/100;applyAudioSettings();saveAudioSettings()});
$('sfxVolume').addEventListener('change',()=>{if(sound)playSfx('button')});
$('bgmVolume').addEventListener('input',e=>{bgmVolume=Number(e.target.value)/100;applyAudioSettings();saveAudioSettings();if(bgmEnabled)tryStartBgm()});
$('clearRankingBtn').addEventListener('click',()=>{if(confirm('이 브라우저에 저장된 랭킹 기록을 모두 삭제할까요?')){try{localStorage.removeItem(RANK_KEY)}catch(e){}renderRankingSection();playSfx('button')}});
$('modalHelpBtn').addEventListener('click',()=>{playSfx('button');startTutorial()});
$('modalConfirm').addEventListener('click',()=>{
  $('modalLayer').classList.add('hidden');playSfx('button');
  if(modalMode==='start-menu')startRun();
  else if(modalMode==='stage-clear'){setStage(stageIndex+1);toast(`${STAGES[stageIndex].name} 시작! 되돌리기 ${currentUndoLimit()}회 사용 가능.`)}
  else if(modalMode==='final'){restartImmediately()}
});
$('modalClose').addEventListener('click',()=>{$('modalLayer').classList.add('hidden');playSfx('button')});
$('tutorialHighlight').addEventListener('click',tutorialNext);
$('tutorialHighlight').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tutorialNext()}});
$('tutorialNext').addEventListener('click',tutorialNext);
$('tutorialExit').addEventListener('click',finishTutorial);
window.addEventListener('resize',()=>{fitGameCanvas();if(tutorialIndex>=0)positionTutorial()});
window.addEventListener('scroll',()=>{if(tutorialIndex>=0)positionTutorial()},{passive:true});
document.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('#serveBtn,#resetCup,#undoBtn,#restartBoardBtn,#settingsBtn,#helpBtn,#soundBtn,#bgmBtn,#sfxVolume,#bgmVolume,#modalHelpBtn,#modalConfirm,#modalClose,#rankSubmit,#clearRankingBtn,#tutorialNext,#tutorialExit,.ingredient'))playSfx('button')});

loadAudioSettings();
applyAudioSettings();
resetGame();
fitGameCanvas();
showCover();
tryStartBgm();
