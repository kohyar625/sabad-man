const SUPABASE_URL="https://qgmudtsqehzewhrjasib.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_3NGkyJlSoCcFguJswz8rCg_nQ-QA9Uu";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

const $=id=>document.getElementById(id);

let products=[],current=null,pending=null,editingProduct=null;

const cats=[
 ["tea","چای","🍵",/چای/],
 ["coffee","قهوه","☕",/قهوه|اسپرسو/],
 ["cold","نوشیدنی سرد","🥤",/آب|نوشابه|دلستر|نوشیدنی|آبمیوه/],
 ["snack","خوراکی","🍫",/شکلات|آدامس|بیسکویت|کیک|چیپس/],
 ["tobacco","دخانیات","🚬",/سیگار|توتون/],
 ["other","سایر","🛍️",/.*/]
];

const fmt=n=>Number(n||0).toLocaleString("fa-IR")+" تومان";
const num=n=>Number(n||0).toLocaleString("fa-IR");

const esc=v=>String(v??"")
 .replaceAll("&","&amp;")
 .replaceAll("<","&lt;")
 .replaceAll(">","&gt;")
 .replaceAll('"',"&quot;");

const cat=p=>cats.find(c=>c[3].test(p.name||""))||cats.at(-1);

function localDate(d=new Date()){
 return new Intl.DateTimeFormat("en-CA",{
  timeZone:"Asia/Tehran"
 }).format(d);
}

function dayBounds(s){
 let d=new Date(s+"T00:00:00+03:30");
 let e=new Date(s+"T00:00:00+03:30");
 e.setDate(e.getDate()+1);
 return [d.toISOString(),e.toISOString()];
}

function stat(x,e=false){
 $("status").textContent=x;
 $("status").style.color=e?"#c84b4b":"#5f850d";
}

function switchView(id){
 document.querySelectorAll(".view").forEach(v=>{
  v.classList.toggle("hidden",v.id!==id);
 });

 document.querySelectorAll(".tab").forEach(b=>{
  b.classList.toggle("active",b.dataset.view===id);
 });

 if(id==="dashboardView")loadDashboard();
 if(id==="reportView")loadReport();
 if(id==="productsView")renderProductManager();
}

document.querySelectorAll(".tab").forEach(b=>{
 b.onclick=()=>switchView(b.dataset.view);
});

async function load(){
 stat("در حال خواندن محصولات…");

 let r=await db
  .from("products")
  .select("id,name,image_url,unit_price,purchase_price,quantity,min_quantity,created_at")
  .order("created_at",{ascending:true});

 if(r.error){
  stat("خطا در خواندن محصولات: "+r.error.message,true);
  return;
 }

 products=r.data||[];

 renderCats();
 renderProductManager();
 loadDashboard();

 stat("آماده است ✅");
}

function renderCats(){
 $("categories").classList.remove("hidden");
 $("products").classList.add("hidden");
 $("back").classList.add("hidden");
 $("empty").classList.add("hidden");

 $("title").textContent="محصولات";
 $("subtitle").textContent="یک دسته را انتخاب کنید";
 $("categories").innerHTML="";

 let a=cats
  .map(c=>({
   ...c,
   count:products.filter(p=>cat(p)[0]===c[0]).length
  }))
  .filter(c=>c.count);

 if(!a.length){
  $("empty").classList.remove("hidden");
  return;
 }

 a.forEach(c=>{
  let d=document.createElement("div");
  d.className="card";

  d.innerHTML=`
   <div class="pic">${c[2]}</div>
   <div class="name">${c[1]}</div>
   <div class="meta">${num(c.count)} محصول</div>
  `;

  d.onclick=()=>openCat(c);

  $("categories").appendChild(d);
 });
}

function openCat(c){
 current=c;

 $("categories").classList.add("hidden");
 $("products").classList.remove("hidden");
 $("back").classList.remove("hidden");

 $("title").textContent=c[1];
 $("subtitle").textContent="یک ضربه = فروش · نگه‌داشتن = لغو";

 renderProducts(
  products.filter(p=>cat(p)[0]===c[0])
 );
}

function renderProducts(list){
 $("products").innerHTML="";

 list.forEach(p=>{
  let d=document.createElement("div");
  d.className="card";

  let im=p.image_url
   ?`<img src="${esc(p.image_url)}" alt="">`
   :`${current?.[2]||"🛍️"}`;

  let low=
   Number(p.quantity||0)<=Number(p.min_quantity||0);

  d.innerHTML=`
   <div class="pic">${im}</div>
   <div class="name">${esc(p.name)}</div>
   <div class="price">${fmt(p.unit_price)}</div>
   <div class="meta ${low?"stockLow":""}">
    موجودی: ${num(p.quantity)}${low?" · کم":" "}
   </div>
  `;

  let t=null;
  let long=false;

  d.onpointerdown=()=>{
   long=false;

   t=setTimeout(()=>{
    long=true;
    openCancel(p);
   },650);
  };

  d.onpointerup=()=>{
   clearTimeout(t);

   if(!long){
    sale(p,d);
   }
  };

  d.onpointerleave=()=>{
   clearTimeout(t);
  };

  d.onpointercancel=()=>{
   clearTimeout(t);
  };

  $("products").appendChild(d);
 });
}

async function sale(p,d){
 if(Number(p.quantity||0)<=0){
  stat(`موجودی «${p.name}» تمام شده است.`,true);
  return;
 }

 d.style.transform="scale(.97)";

 let r=await db.rpc("sale_product",{
  p_product_id:p.id
 });

 setTimeout(()=>{
  d.style.transform="";
 },130);

 if(r.error){
  stat("ثبت فروش انجام نشد: "+r.error.message,true);
  return;
 }

 p.quantity=Math.max(
  0,
  Number(p.quantity||0)-1
 );

 stat(`فروش «${p.name}» ثبت شد ✅`);

 await sales();

 renderProducts(
  products.filter(x=>cat(x)[0]===current[0])
 );

 loadDashboard();
}

function openCancel(p){
 pending=p;

 $("modalText").textContent=
  `یک فروش از «${p.name}» کم شود؟ موجودی هم یک عدد برمی‌گردد.`;

 $("modal").classList.remove("hidden");
}

function closeModal(){
 $("modal").classList.add("hidden");
 pending=null;
}

$("no").onclick=closeModal;

$("modal").onclick=e=>{
 if(e.target===$("modal")){
  closeModal();
 }
};

$("yes").onclick=async()=>{
 if(!pending)return;

 let p=pending;

 $("yes").disabled=true;

 let r=await db.rpc("cancel_product",{
  p_product_id:p.id
 });

 $("yes").disabled=false;

 closeModal();

 if(r.error){
  stat("لغو فروش ثبت نشد: "+r.error.message,true);
  return;
 }

 p.quantity=
  Number(p.quantity||0)+1;

 stat(`یک فروش «${p.name}» لغو شد ↩️`);

 await sales();

 renderProducts(
  products.filter(x=>cat(x)[0]===current[0])
 );

 loadDashboard();
};

async function fetchDay(s){
 let [a,b]=dayBounds(s);

 return await db
  .from("sales")
  .select(`
   product_id,
   product_name,
   unit_price,
   purchase_price,
   quantity,
   total_amount,
   profit_amount,
   action,
   created_at
  `)
  .gte("created_at",a)
  .lt("created_at",b)
  .order("created_at",{ascending:true});
}

async function sales(){
 let r=await fetchDay(localDate());

 if(r.error){
  $("totalSales").textContent="—";
  $("saleCount").textContent="—";
  $("cancelCount").textContent="—";
  return;
 }

 let total=0;
 let items=0;
 let cancels=0;

 (r.data||[]).forEach(x=>{
  let q=Number(x.quantity||1);
  let n=Number(x.total_amount||0);

  if(x.action==="cancel"){
   total-=n;
   items-=q;
   cancels+=q;
  }else{
   total+=n;
   items+=q;
  }
 });

 $("totalSales").textContent=fmt(total);
 $("saleCount").textContent=num(items);
 $("cancelCount").textContent=num(cancels);
}

function aggregate(rows){
 let m=new Map();

 rows.forEach(x=>{
  let k=x.product_id||x.product_name;

  let old=m.get(k)||{
   name:x.product_name,
   qty:0,
   cancel:0,
   sales:0,
   profit:0
  };

  let q=Number(x.quantity||1);
  let v=Number(x.total_amount||0);

  let pr=Number(
   x.profit_amount ??
   (
    (Number(x.unit_price||0)-
    Number(x.purchase_price||0))*q
   )
  );

  if(x.action==="cancel"){
   old.qty-=q;
   old.cancel+=q;
   old.sales-=v;
   old.profit-=pr;
  }else{
   old.qty+=q;
   old.sales+=v;
   old.profit+=pr;
  }

  m.set(k,old);
 });

 return [...m.values()]
  .filter(x=>x.qty||x.cancel);
}

function table(rows,empty="داده‌ای وجود ندارد."){
 if(!rows.length){
  return `<div class="empty">${empty}</div>`;
 }

 return `
  <table class="table">
   <thead>
    <tr>
     <th>محصول</th>
     <th>تعداد خالص</th>
     <th>لغو</th>
     <th>فروش</th>
     <th>سود</th>
    </tr>
   </thead>
   <tbody>
    ${rows.map(x=>`
     <tr>
      <td>${esc(x.name)}</td>
      <td>${num(x.qty)}</td>
      <td>${num(x.cancel)}</td>
      <td>${fmt(x.sales)}</td>
      <td class="profit">${fmt(x.profit)}</td>
     </tr>
    `).join("")}
   </tbody>
  </table>
 `;
}

async function loadDashboard(){
 let r=await fetchDay(localDate());

 if(r.error)return;

 let rows=r.data||[];
 let a=aggregate(rows);

 let s=a.reduce((n,x)=>n+x.sales,0);
 let q=a.reduce((n,x)=>n+x.qty,0);
 let c=a.reduce((n,x)=>n+x.cancel,0);
 let p=a.reduce((n,x)=>n+x.profit,0);

 $("dSales").textContent=fmt(s);
 $("dItems").textContent=num(q);
 $("dCancels").textContent=num(c);
 $("dProfit").textContent=fmt(p);

 $("productStats").innerHTML=
  table(a.sort((x,y)=>y.sales-x.sales));

 let alerts=products.filter(x=>
  Number(x.quantity||0)<=Number(x.min_quantity||0)
 );

 $("stockAlerts").innerHTML=
  alerts.length
   ?alerts.map(x=>`
    <div class="alert">
     ⚠️ موجودی ${esc(x.name)} رو به اتمام است — ${num(x.quantity)} عدد باقی مانده
    </div>
   `).join("")
   :`<div class="ok">
     موجودی محصولی زیر حداقل تعیین‌شده نیست.
    </div>`;
}

async function loadReport(){
 let s=$("reportDate").value||localDate();

 $("reportDate").value=s;

 let r=await fetchDay(s);

 if(r.error){
  $("reportRows").innerHTML=
   "خطا در دریافت گزارش";
  return;
 }

 let rows=r.data||[];
 let a=aggregate(rows);

 let salesAmount=
  a.reduce((n,x)=>n+x.sales,0);

 let items=
  a.reduce((n,x)=>n+x.qty,0);

 let c=
  a.reduce((n,x)=>n+x.cancel,0);

 let p=
  a.reduce((n,x)=>n+x.profit,0);

 $("rSales").textContent=fmt(salesAmount);
 $("rItems").textContent=num(items);
 $("rCancels").textContent=num(c);
 $("rProfit").textContent=fmt(p);

 $("reportProductStats").innerHTML=
  table(a.sort((x,y)=>y.sales-x.sales));

 $("reportRows").innerHTML=
  rows.length
   ?`
    <table class="table">
     <thead>
      <tr>
       <th>ساعت</th>
       <th>محصول</th>
       <th>عملیات</th>
       <th>مبلغ</th>
      </tr>
     </thead>
     <tbody>
      ${rows.map(x=>`
       <tr>
        <td>
         ${new Date(x.created_at)
          .toLocaleTimeString("fa-IR",{
           hour:"2-digit",
           minute:"2-digit"
          })}
        </td>
        <td>${esc(x.product_name)}</td>
        <td>
         ${x.action==="cancel"
          ?"↩️ لغو"
          :"🛒 فروش"}
        </td>
        <td>${fmt(x.total_amount)}</td>
       </tr>
      `).join("")}
     </tbody>
    </table>
   `
   :`
    <div class="empty">
     برای این روز ثبت فروشی وجود ندارد.
    </div>
   `;
}

$("prevDay").onclick=()=>{
 let d=new Date(
  $("reportDate").value+"T00:00:00"
 );

 d.setDate(d.getDate()-1);

 $("reportDate").value=
  d.toISOString().slice(0,10);

 loadReport();
};

$("nextDay").onclick=()=>{
 let d=new Date(
  $("reportDate").value+"T00:00:00"
 );

 d.setDate(d.getDate()+1);

 $("reportDate").value=
  d.toISOString().slice(0,10);

 loadReport();
};

$("todayBtn").onclick=()=>{
 $("reportDate").value=localDate();
 loadReport();
};

$("reportDate").onchange=loadReport;

function renderProductManager(){
 $("productCards").innerHTML=
  products.length
   ?products.map(p=>{
    let low=
     Number(p.quantity||0)<=
     Number(p.min_quantity||0);

    let im=
     p.image_url
      ?`<img src="${esc(p.image_url)}">`
      :cat(p)[2];

    return `
     <div class="productRow">
      <div class="productInfo">
       <div class="thumb">${im}</div>

       <div>
        <h3>${esc(p.name)}</h3>

        <small>
         فروش: ${fmt(p.unit_price)}
         · خرید: ${fmt(p.purchase_price)}
        </small>

        <br>

        <small class="${low?"stockLow":""}">
         موجودی: ${num(p.quantity)}
         · حداقل: ${num(p.min_quantity)}
        </small>
       </div>
      </div>

      <div>
       <button
        class="ghost editProduct"
        data-id="${esc(p.id)}"
       >
        ویرایش
       </button>
      </div>
     </div>
    `;
   }).join("")
   :`
    <div class="empty">
     هنوز محصولی ثبت نشده است.
    </div>
   `;

 document
  .querySelectorAll(".editProduct")
  .forEach(b=>{
   b.onclick=()=>{
    openProduct(b.dataset.id);
   };
  });
}

function openProduct(id=null){
 editingProduct=
  id
   ?products.find(
    p=>String(p.id)===String(id)
   )
   :null;

 $("productModalTitle").textContent=
  editingProduct
   ?"ویرایش محصول"
   :"محصول جدید";

 $("pName").value=
  editingProduct?.name||"";

 $("pImage").value=
  editingProduct?.image_url||"";

 $("pBuy").value=
  editingProduct?.purchase_price||0;

 $("pSell").value=
  editingProduct?.unit_price||0;

 $("pQty").value=
  editingProduct?.quantity||0;

 $("pMin").value=
  editingProduct?.min_quantity||0;

 $("productFormStatus").textContent="";

 $("productModal").classList.remove("hidden");
}

function closeProduct(){
 $("productModal").classList.add("hidden");
 editingProduct=null;
}

$("newProduct").onclick=()=>{
 openProduct();
};

$("pCancel").onclick=closeProduct;

$("productModal").onclick=e=>{
 if(e.target===$("productModal")){
  closeProduct();
 }
};

$("pSave").onclick=async()=>{
 let name=$("pName").value.trim();

 if(!name){
  $("productFormStatus").textContent=
   "نام محصول را وارد کنید.";
  return;
 }

 let payload={
  name:name,
  image_url:$("pImage").value.trim()||null,
  purchase_price:Number($("pBuy").value||0),
  unit_price:Number($("pSell").value||0),
  quantity:Number($("pQty").value||0),
  min_quantity:Number($("pMin").value||0)
 };

 $("pSave").disabled=true;

 let r;

 if(editingProduct){
  r=await db
   .from("products")
   .update(payload)
   .eq("id",editingProduct.id);
 }else{
  r=await db
   .from("products")
   .insert([payload]);
 }

 $("pSave").disabled=false;

 if(r.error){
  $("productFormStatus").textContent=
   r.error.message;
  return;
 }

 closeProduct();

 await load();
};

$("dashRefresh").onclick=loadDashboard;

$("refreshButton").onclick=()=>{
 load();
 sales();
};

$("back").onclick=renderCats;

$("logoutButton").onclick=async()=>{
 await db.auth.signOut();
 location.reload();
};

$("loginButton").onclick=async()=>{
 let e=$("email").value.trim();
 let p=$("password").value;

 if(!e||!p){
  $("loginStatus").textContent=
   "ایمیل و رمز عبور را وارد کنید.";
  return;
 }

 $("loginButton").disabled=true;

 let r=await db.auth.signInWithPassword({
  email:e,
  password:p
 });

 $("loginButton").disabled=false;

 if(r.error){
  $("loginStatus").textContent=
   "ورود ناموفق بود.";
  return;
 }

 show();

 await boot();
};

$("password").onkeydown=e=>{
 if(e.key==="Enter"){
  $("loginButton").click();
 }
};

function show(){
 $("loginView").classList.add("hidden");
 $("appView").classList.remove("hidden");
}

async function boot(){
 let u=await db.auth.getUser();

 $("userEmail").textContent=
  u.data?.user?.email||"";

 $("reportDate").value=
  localDate();

 await load();
 await sales();
}

(async()=>{
 let r=await db.auth.getSession();

 if(r.data?.session){
  show();
  boot();
 }
})();
