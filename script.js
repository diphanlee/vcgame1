'use strict';
// 레시피와 목표값은 이곳에서 수정할 수 있습니다.
const CONFIG = Object.freeze({target:24000,maxOrders:6,coffee:9,milk:5});
const MENU = Object.freeze({
 americano:{name:'아메리카노',coffee:1,milk:0,price:3000},
 latte:{name:'카페라떼',coffee:1,milk:1,price:4500},
 double:{name:'더블 라떼',coffee:2,milk:1,price:6000}
});
// 3명의 손님으로 시작하며 판매 시 다음 손님이 한 명씩 입장합니다.
const LINE = ['americano','latte','double','double','latte','double','americano','double','latte'];
const FACES = ['👩🏻','👨🏽','👩🏾','👨🏻','👩🏼','🧑🏽','👨🏼','👩🏽','🧑🏻'];
const $ = id => document.getElementById(id);
const money = n => n.toLocaleString('ko-KR')+'원';
let state, audioContext, toastTimer, transitionTimer, animationTimer;
function sound(){
 try{
  const Audio = window.AudioContext || window.webkitAudioContext;
  if(!Audio)return;
  audioContext ||= new Audio();
  if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  const t=audioContext.currentTime, osc=audioContext.createOscillator(),gain=audioContext.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(520,t);osc.frequency.exponentialRampToValueAtTime(790,t+.105);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.12,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+.16);
  osc.connect(gain).connect(audioContext.destination);osc.start(t);osc.stop(t+.17);
 }catch(err){/* 소리를 지원하지 않는 환경에서도 게임은 진행됩니다. */}
}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2100)}
function current(){return state.guests.find(g=>g.id===state.selectedId)}
function startGame(){
 clearTimeout(transitionTimer);clearTimeout(animationTimer);
 state={coffee:CONFIG.coffee,milk:CONFIG.milk,sales:0,served:0,selectedId:null,cup:{coffee:0,milk:0},guests:[],next:0,busy:false,finished:false};
 for(let i=0;i<3;i++)state.guests.push(createGuest());
 $('resultModal').classList.add('hidden');$('targetValue').textContent=money(CONFIG.target);
 $('pour').className='pour';$('toast').classList.remove('show');render();
}
function createGuest(){if(state.next>=LINE.length)return null;const i=state.next++;return{id:i,type:LINE[i],face:FACES[i]}}
function refund(){state.coffee+=state.cup.coffee;state.milk+=state.cup.milk;state.cup={coffee:0,milk:0}}
function selectGuest(id){if(state.busy||state.finished)return;if(state.selectedId!==id){refund();state.selectedId=id;sound();render()}}
function renderGuests(enterId=null){
 const root=$('customers');root.replaceChildren();
 for(let slot=0;slot<3;slot++){
  const guest=state.guests[slot];if(!guest){const empty=document.createElement('div');empty.className='empty';empty.textContent='빈 자리';root.append(empty);continue}
  const drink=MENU[guest.type],btn=document.createElement('button');btn.type='button';btn.className='customer'+(guest.id===state.selectedId?' active':'')+(guest.id===enterId?' enter':'');btn.dataset.guestId=guest.id;btn.disabled=state.busy||state.finished;
  btn.innerHTML=`<span class="avatar" aria-hidden="true">${guest.face}</span><strong>${drink.name}</strong><span class="recipe">🫘 ${drink.coffee}개 · 🥛 ${drink.milk}개</span><span class="price">${money(drink.price)}</span>`;
  btn.setAttribute('aria-label',`${slot+1}번 손님, ${drink.name}, ${money(drink.price)}`);btn.addEventListener('click',()=>selectGuest(guest.id));root.append(btn);
 }
}
function render(){
 $('salesValue').textContent=state.sales.toLocaleString('ko-KR');$('coffeeValue').textContent=state.coffee;$('milkValue').textContent=state.milk;$('servedValue').textContent=state.served;
 $('progressFill').style.width=Math.min(100,state.sales/CONFIG.target*100)+'%';
 renderGuests();const guest=current(),drink=guest?MENU[guest.type]:null;
 $('selectedLabel').textContent=drink?'선택 주문: '+drink.name:'손님을 선택해 주세요';
 $('cupCount').textContent=`🫘 커피 ${state.cup.coffee}개 · 🥛 우유 ${state.cup.milk}개`;
 const total=state.cup.coffee+state.cup.milk;
 $('coffeeLiquid').style.height=total?Math.min(90,state.cup.coffee*22)+'%':'0%';
 $('milkLiquid').style.height=total?Math.min(90,state.cup.milk*20)+'%':'0%';
 $('addCoffee').disabled=!guest||state.finished||state.busy||state.coffee<=0;
 $('addMilk').disabled=!guest||state.finished||state.busy||state.milk<=0;
 $('resetCup').disabled=state.busy||state.finished||!total;
 $('serveBtn').disabled=!guest||state.busy||state.finished||state.cup.coffee!==drink.coffee||state.cup.milk!==drink.milk;
 $('hint').textContent=drink?`필요한 재료: 커피 ${drink.coffee}개, 우유 ${drink.milk}개 · 컵에 정확히 넣으면 전달할 수 있습니다.`:'손님을 선택하면 필요한 재료가 표시됩니다.';
}
function addIngredient(kind){
 if(state.busy||state.finished||!current()||state[kind]<=0)return;
 state[kind]--;state.cup[kind]++;sound();render();
 const pour=$('pour');pour.className='pour';void pour.offsetWidth;pour.className='pour '+(kind==='coffee'?'coffee':'milk')+' play';
 clearTimeout(animationTimer);animationTimer=setTimeout(()=>{pour.className='pour'},500);
}
function resetCup(){if(state.busy||state.finished)return;refund();sound();render();toast('재료를 재고로 되돌렸습니다.')}
function serve(){
 const guest=current();if(!guest||state.busy||state.finished)return;
 const drink=MENU[guest.type];if(state.cup.coffee!==drink.coffee||state.cup.milk!==drink.milk)return;
 sound();state.busy=true;state.sales+=drink.price;state.served++;state.cup={coffee:0,milk:0};state.selectedId=null;
 render();const departing=document.querySelector(`[data-guest-id="${guest.id}"]`);if(departing)departing.classList.add('leave');toast(`${drink.name} 전달 완료! +${money(drink.price)}`);
 transitionTimer=setTimeout(()=>{
  const slot=state.guests.findIndex(g=>g.id===guest.id);
  if(slot!==-1)state.guests[slot]=createGuest();
  state.busy=false;render();const newcomer=state.guests[slot];if(newcomer){const node=document.querySelector(`[data-guest-id="${newcomer.id}"]`);if(node)node.classList.add('enter')}
  checkResult();
 },460);
}
function checkResult(){
 if(state.sales>=CONFIG.target)return finish(true);
 if(state.served>=CONFIG.maxOrders)return finish(false);
 const remaining=state.guests.filter(Boolean);
 if(!remaining.length||remaining.every(g=>MENU[g.type].coffee>state.coffee||MENU[g.type].milk>state.milk))finish(false);
}
function finish(won){state.finished=true;render();$('resultEmoji').textContent=won?'🎉':'🌙';$('resultTitle').textContent=won?'영업 성공!':'영업 종료';$('resultDescription').textContent=won?'목표 매출을 달성했습니다! 훌륭한 바리스타입니다.':'목표 매출에 도달하지 못했습니다. 주문 순서를 바꿔 다시 도전해 보세요.';$('finalSales').textContent=money(state.sales);$('resultModal').classList.remove('hidden');$('playAgainBtn').focus()}
$('addCoffee').addEventListener('click',()=>addIngredient('coffee'));
$('addMilk').addEventListener('click',()=>addIngredient('milk'));
$('resetCup').addEventListener('click',resetCup);
$('serveBtn').addEventListener('click',serve);
$('restartBtn').addEventListener('click',()=>{sound();startGame()});
$('playAgainBtn').addEventListener('click',()=>{sound();startGame()});
startGame();
