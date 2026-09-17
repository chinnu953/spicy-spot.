const prices = { dum: 160, plain: 120 };
const names = { dum: "Chicken Dum Biryani", plain: "Plain Biryani Rice" };
const cart = { dum: 0, plain: 0 };
const form = document.getElementById("orderForm");
const totalEl = document.getElementById("total");
const cartItemsEl = document.getElementById("cartItems");
const statusEl = document.getElementById("formStatus");
const submitBtn = document.getElementById("submitBtn");
const cartCountEl = document.getElementById("cartCount");
const barTotalEl = document.getElementById("barTotal");

function money(n){ return `₹${Number(n).toLocaleString("en-IN")}`; }
function cartTotal(){ return Object.keys(cart).reduce((sum,id)=>sum + prices[id] * cart[id], 0); }
function cartCount(){ return Object.values(cart).reduce((sum,n)=>sum+n,0); }

function change(id, delta){
  cart[id] = Math.max(0, Math.min(20, cart[id] + delta));
  renderCart();
}
function addToCart(id){
  cart[id] = Math.min(20, cart[id] + 1);
  renderCart();
  document.getElementById("order").scrollIntoView({behavior:"smooth", block:"center"});
}

function renderCart(){
  const items = Object.keys(cart).filter(id=>cart[id] > 0);
  if(!items.length){
    cartItemsEl.innerHTML = '<p class="cart-empty">Add food from the menu above.</p>';
  } else {
    cartItemsEl.innerHTML = items.map(id => `
      <div class="cart-item-row">
        <div><b>${names[id]}</b><small>${money(prices[id])} each</small></div>
        <div class="mini-stepper"><button type="button" data-minus="${id}">−</button><b>${cart[id]}</b><button type="button" data-plus="${id}">+</button></div>
        <strong>${money(prices[id]*cart[id])}</strong>
      </div>`).join("");
  }
  const total = cartTotal();
  totalEl.textContent = money(total);
  barTotalEl.textContent = money(total);
  cartCountEl.textContent = cartCount();
}

document.querySelectorAll(".choose-btn").forEach(btn=>{
  btn.textContent = "+ Add to Cart";
  btn.addEventListener("click",()=>addToCart(btn.dataset.item));
});

cartItemsEl.addEventListener("click", e=>{
  const minus=e.target.dataset.minus, plus=e.target.dataset.plus;
  if(minus) change(minus,-1);
  if(plus) change(plus,1);
});

document.getElementById("cartBarButton").addEventListener("click",()=>{
  document.getElementById("order").scrollIntoView({behavior:"smooth", block:"start"});
});

form.addEventListener("submit", async e=>{
  e.preventDefault();
  statusEl.className="form-status";
  statusEl.textContent="Sending your order…";
  if(cartCount()===0){ statusEl.className="form-status error"; statusEl.textContent="❌ Please add at least one food item to your cart."; return; }
  const data = Object.fromEntries(new FormData(form).entries());
  const phone = String(data.phone||"").replace(/\D/g,"");
  if(!/^\d{10}$/.test(phone)){ statusEl.className="form-status error"; statusEl.textContent="❌ Enter a valid 10-digit phone number."; return; }
  const items=Object.keys(cart).filter(id=>cart[id]>0).map(id=>({id, quantity:cart[id]}));
  submitBtn.disabled=true;
  try{
    const response=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:data.name,phone,room:data.room,items})});
    const text=await response.text();
    let result; try{result=JSON.parse(text);}catch{throw new Error("Server did not return a valid order response. Please make sure the Spicy Spot server is running with npm start.");}
    if(!response.ok) throw new Error(result.error||"Could not place order.");
    statusEl.className="form-status success";
    statusEl.innerHTML=`✅ Order <b>${result.order.id}</b> received! Total: <b>${money(result.order.total)}</b>`;
    cart.dum=0; cart.plain=0; renderCart(); form.reset();
  }catch(err){ statusEl.className="form-status error"; statusEl.textContent="❌ "+err.message; }
  finally{ submitBtn.disabled=false; }
});
renderCart();
