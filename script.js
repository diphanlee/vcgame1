'use strict';

// 게임 규칙: 주문을 최대 6건 판매하여 목표 매출 24,000원에 도달하면 승리합니다.
// 커피 원액 9개, 우유 5개가 주어지며 재료가 부족한 주문은 처리할 수 없습니다.
const CONFIG = Object.freeze({ target: 24000, maxOrders: 6, initialCoffee: 9, initialMilk: 5 });
const MENU = Object.freeze([
  { id: 'americano', name: '아메리카노', icon: '☕', coffee: 1, milk: 0, price: 3000 },
  { id: 'latte', name: '카페라떼', icon: '🥛', coffee: 1, milk: 1, price: 4500 },
  { id: 'double', name: '더블 라떼', icon: '🧋', coffee: 2, milk: 1, price: 6000 }
]);

const el = {
  sales: document.getElementById('salesValue'), target: document.getElementById('targetValue'),
  coffee: document.getElementById('coffeeValue'), milk: document.getElementById('milkValue'),
  served: document.getElementById('servedValue'), progress: document.getElementById('salesProgress'),
  fill: document.getElementById('progressFill'), progressText: document.getElementById('progressText'),
  orders: document.getElementById('ordersList'), toast: document.getElementById('toast'),
  modal: document.getElementById('resultModal'), resultEmoji: document.getElementById('resultEmoji'),
  resultTitle: document.getElementById('resultTitle'), resultDescription: document.getElementById('resultDescription'),
  finalSales: document.getElementById('finalSales')
};
let state;
let toastTimer;
const money = value => `${value.toLocaleString('ko-KR')}원`;
const canMake = drink => state.coffee >= drink.coffee && state.milk >= drink.milk;

function newOrder() {
  // 현재 재고로 제작 가능한 음료 중 하나를 선택합니다.
  const available = MENU.filter(canMake);
  return available.length ? available[Math.floor(Math.random() * available.length)] : null;
}

function startGame() {
  state = { coffee: CONFIG.initialCoffee, milk: CONFIG.initialMilk, sales: 0, served: 0, finished: false, orders: [MENU[0], MENU[1], MENU[2]] };
  el.modal.classList.add('hidden');
  el.target.textContent = money(CONFIG.target);
  render();
}

function render() {
  el.sales.textContent = state.sales.toLocaleString('ko-KR');
  el.coffee.textContent = state.coffee;
  el.milk.textContent = state.milk;
  el.served.textContent = state.served;
  const percent = Math.min(100, Math.round(state.sales / CONFIG.target * 100));
  el.fill.style.width = `${percent}%`;
  el.progress.setAttribute('aria-valuenow', String(percent));
  el.progressText.textContent = `${percent}%`;
  el.orders.replaceChildren();
  state.orders.forEach((drink, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'order-card';
    card.disabled = state.finished || !drink || !canMake(drink);
    if (!drink) {
      card.innerHTML = '<div class="order-name">주문 없음</div><div class="order-recipe">처리 가능한 주문이 없습니다.</div>';
    } else {
      card.innerHTML = `<div class="order-top"><span class="order-icon" aria-hidden="true">${drink.icon}</span><span class="order-num">ORDER 0${index + 1}</span></div><div class="order-name">${drink.name}</div><div class="order-recipe">커피 ${drink.coffee}개 · 우유 ${drink.milk}개</div><div class="order-bottom"><span class="order-price">${money(drink.price)}</span><span class="order-action">${canMake(drink) ? '판매하기 ↗' : '재고 부족'}</span></div>`;
      card.addEventListener('click', () => processOrder(index));
    }
    el.orders.append(card);
  });
}

function processOrder(index) {
  if (state.finished) return;
  const drink = state.orders[index];
  if (!drink || !canMake(drink)) return;
  state.coffee -= drink.coffee;
  state.milk -= drink.milk;
  state.sales += drink.price;
  state.served += 1;
  state.orders[index] = newOrder();
  // 재고가 부족한 주문도 남을 수 있지만 다른 주문을 선택할 수 있습니다.
  render();
  const won = state.sales >= CONFIG.target;
  const noPossibleOrder = !state.orders.some(order => order && canMake(order));
  const noPossibleDrink = !MENU.some(canMake);
  if (won || state.served >= CONFIG.maxOrders || noPossibleOrder || noPossibleDrink) {
    finishGame(won);
  } else {
    showToast(`${drink.name} 판매 완료! +${money(drink.price)}`);
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.add('show');
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1700);
}

function finishGame(won) {
  state.finished = true;
  render();
  el.resultEmoji.textContent = won ? '🎉' : '🌙';
  el.resultTitle.textContent = won ? '영업 성공!' : '영업 종료';
  el.resultDescription.textContent = won ? '목표 매출을 달성하셨습니다! 재료 선택이 빛났네요.' : '목표 매출에 도달하지 못했습니다. 다른 주문 조합으로 다시 도전해 보세요.';
  el.finalSales.textContent = money(state.sales);
  el.modal.classList.remove('hidden');
  document.getElementById('playAgainBtn').focus();
}

document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('playAgainBtn').addEventListener('click', startGame);
startGame();
