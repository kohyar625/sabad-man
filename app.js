const SUPABASE_URL="https://qgmudtsqehzewhrjasib.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_3NGkyJlSoCcFguJswz8rCg_nQ-QA9Uu";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id),TZ="Asia/Tehran";
let products=[],categories=[],current=null,pending=null,editingProduct=null,loading=false,selectedImageData=null;
const days=["یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه","شنبه"];
const fallbackCats=[
 {code:"tea",name:"Tea",image_url:null,sort_order:1,icon:"🍵"},{code:"coffee",name:"Coffee",image_url:null,sort_order:2,icon:"☕"},{code:"cold_drink",name:"Cold Drinks",image_url:null,sort_order:3,icon:"🥤"},{code:"juice_milk",name:"Juice & Milk",image_url:null,sort_order:4,icon:"🧃"},{code:"chocolate_snacks",name:"Chocolate & Snacks",image_url:null,sort_order:5,icon:"🍫"},{code:"biscuits_cake",name:"Biscuits & Cake",image_url:null,sort_order:6,icon:"🍪"},{code:"cig",name:"Cig",image_url:null,sort_order:7,icon:"🚬"},{code:"ice_cream",name:"Ice Cream",image_url:null,sort_order:8,icon:"🍦"},{code:"water",name:"Mineral Water",image_url:null,sort_order:9,icon:"💧"},{code:"ready_food",name:"Ready Food",image_url:null,sort_order:10,icon:"🍔"},{code:"gum",name:"Gum",image_url:null,sort_order:11,icon:"🟢"},{code:"other",name:"Other",image_url:null,sort_order:12,icon:"🛍️"}
];
const fmt=n=>Number(n||0).toLocaleString("fa-IR")+" تومان";const num=n=>Number(n||0).toLocaleString("fa-IR");
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:TZ}).format(new Date());
function bounds(s){let a=new Date(s+"T00:00:00+03:30"),b=new Date(a);b.setDate(b.getDate()+1);return[a.toISOString(),b.toISOString()]}
function setStatus(x,error=false){const el=$("status");if(el){el.textContent=x;el.style.color=error?"#c44":"#5f850d"}}
function catForProduct(p){return categories.find(c=>String(c.id)===String(p.category_id))||categories.find(c=>c.code===p.category)||categories.find(c=>c.code==="other")||fallbackCats.at(-1)}
function catImage(c){return c?.image_url?`<img src="${esc(c.image_url)}" alt="${esc(c.name)}" loading="lazy">`:`<span>${c?.icon||"🛍️"}</span>`}
function switchView(id){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden",v.id!==id));document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===id));if(id==="dashboardView")loadDashboard();if(id==="reportView")loadReport();if(id==="analyticsView")loadAnalytics();if(id==="productsView"){renderProductManager();renderCategoryManager()}}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchView(b.dataset.view));
async function load(){if(loading)return;loading=true;setStatus("در حال خواندن محصولات…");const [pr,cr]=await Promise.all([db.from("products").select("id,name,image_url,unit_price,purchase_price,quantity,min_quantity,created_at,updated_at,category_id").order("created_at",{ascending:true}),db.from("categories").select("id,code,name,image_url,sort_order,created_at,updated_at").order("sort_order",{ascending:true})]);loading=false;if(pr.error){setStatus("خطا در خواندن محصولات: "+pr.error.message,true);return}if(cr.error){setStatus("خطا در خواندن دسته‌ها: "+cr.error.message,true);return}products=pr.data||[];categories=cr.data?.length?cr.data:fallbackCats;renderCategories();renderProductManager();renderCategoryManager();await loadToday();setStatus("آماده است ✅")}
function renderCategories(){const box=$("categories");box.innerHTML="";$("categories").classList.remove("hidden");$("products").classList.add("hidden");$("back").classList.add("hidden");const list=categories.map(c=>({...c,count:products.filter(p=>String(p.category_id)===String(c.id)||p.category===c.code).length}));$("empty").classList.toggle("hidden",list.length>0);list.forEach(c=>{const d=document.createElement("div");d.className="card";d.innerHTML=`<div class="pic">${catImage(c)}</div><div class="name">${esc(c.name)}</div><div class="meta">${num(c.count)} product${c.count===1?"":"s"}</div>`;d.onclick=()=>openCategory(c);box.appendChild(d)})}
function openCategory(c){current=c;$("categories").classList.add("hidden");$("products").classList.remove("hidden");$("back").classList.remove("hidden");$("title").textContent=c.name;$("subtitle").textContent="One tap = sale · Long press = cancel";renderProducts(products.filter(p=>String(p.category_id)===String(c.id)||p.category===c.code))}
$("back").onclick=renderCategories;
function renderProducts(list){const box=$("products");box.innerHTML="";list.forEach(p=>{const d=document.createElement("div");d.className="card productCard";const image=p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:`<span>${catForProduct(p)?.icon||"🛍️"}</span>`;const low=Number(p.quantity||0)<=Number(p.min_quantity||0);d.innerHTML=`<div class="pic">${image}</div><div class="name">${esc(p.name)}</div><div class="price">${fmt(p.unit_price)}</div><div class="meta ${low?"stockLow":""}">Stock: ${num(p.quantity)}${low?" · Low":""}</div>`;let timer=null,moved=false,longPressed=false;d.onpointerdown=e=>{moved=false;longPressed=false;d.setPointerCapture?.(e.pointerId);timer=setTimeout(()=>{timer=null;longPressed=true;openCancel(p)},650)};d.onpointermove=()=>{moved=true;if(timer){clearTimeout(timer);timer=null}};d.onpointerup=()=>{if(timer){clearTimeout(timer);timer=null;if(!moved&&!longPressed)registerSale(p,d)}};d.onpointercancel=()=>{if(timer)clearTimeout(timer);timer=null};box.appendChild(d)})}
async function registerSale(p,d){if(Number(p.quantity||0)<=0){setStatus(`موجودی «${p.name}» تمام شده است.`,true);return}d.style.transform="scale(.97)";const r=await db.rpc("sale_product",{p_product_id:p.id});setTimeout(()=>d.style.transform="",120);if(r.error){setStatus("ثبت فروش انجام نشد: "+r.error.message,true);return}p.quantity=Math.max(0,Number(p.quantity||0)-1);setStatus(`فروش «${p.name}» ثبت شد ✅`);await loadToday();if(current)renderProducts(products.filter(x=>String(x.category_id)===String(current.id)||x.category===current.code));loadDashboard()}
function openCancel(p){pending=p;$("modalText").textContent=`آخرین فروش قابل لغو «${p.name}» لغو شود؟ موجودی هم یک عدد برمی‌گردد.`;$("modal").classList.remove("hidden")}
function closeModal(){$("modal").classList.add("hidden");pending=null}
$("no").onclick=closeModal;$("modal").onclick=e=>{if(e.target===$("modal"))closeModal()};
$("yes").onclick=async()=>{if(!pending)return;const p=pending;$("yes").disabled=true;const r=await db.rpc("cancel_product",{p_product_id:p.id});$("yes").disabled=false;closeModal();if(r.error){setStatus("لغو فروش ثبت نشد: "+r.error.message,true);return}p.quantity=Number(p.quantity||0)+1;setStatus(`یک فروش «${p.name}» لغو شد ↩️`);await loadToday();if(current)renderProducts(products.filter(x=>String(x.category_id)===String(current.id)||x.category===current.code));loadDashboard()};
async function getDay(s){const[a,b]=bounds(s);return db.from("sales").select("id,product_id,product_name,unit_price,purchase_price,quantity,total_amount,profit_amount,action,cancel_of_sale_id,created_at").gte("created_at",a).lt("created_at",b).order("created_at",{ascending:true})}
function aggregate(rows){const map=new Map();for(const x of rows){const key=x.product_id||x.product_name,o=map.get(key)||{name:x.product_name,qty:0,cancel:0,sales:0,profit:0},q=Number(x.quantity||1),v=Number(x.total_amount||0),pr=Number(x.profit_amount??((Number(x.unit_price||0)-Number(x.purchase_price||0))*q));if(x.action==="cancel"){o.qty-=q;o.cancel+=q;o.sales-=v;o.profit-=pr}else{o.qty+=q;o.sales+=v;o.profit+=pr}map.set(key,o)}return[...map.values()].filter(x=>x.qty!==0||x.cancel!==0)}
function summary(rows){const a=aggregate(rows);return{rows,a,sales:a.reduce((n,x)=>n+x.sales,0),items:a.reduce((n,x)=>n+x.qty,0),cancels:a.reduce((n,x)=>n+x.cancel,0),profit:a.reduce((n,x)=>n+x.profit,0)}}
function makeTable(rows){if(!rows.length)return`<div class="empty">No data.</div>`;return`<table class="table"><thead><tr><th>Product</th><th>Net Qty</th><th>Cancel</th><th>Sales</th><th>Profit</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${num(x.qty)}</td><td>${num(x.cancel)}</td><td>${fmt(x.sales)}</td><td class="profit">${fmt(x.profit)}</td></tr>`).join("")}</tbody></table>`}
function makeReportProductTable(rows){if(!rows.length)return`<div class="empty">هنوز محصولی ثبت نشده است.</div>`;return`<div class="reportTableScroll"><table class="table"><thead><tr><th>Product</th><th>Category</th><th>Purchase Price</th><th>Sale Price</th><th>Sold</th><th>Current Stock</th><th>Sales Amount</th><th>Profit</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.category)}</td><td>${fmt(x.purchase_price)}</td><td>${fmt(x.unit_price)}</td><td>${num(x.sold)}</td><td>${num(x.stock)}</td><td>${fmt(x.sales)}</td><td class="profit">${fmt(x.profit)}</td></tr>`).join("")}</tbody></table></div>`}

async function loadToday(){const r=await getDay(today());if(r.error){setStatus("خطا در خواندن فروش امروز: "+r.error.message,true);return}const s=summary(r.data||[]);$("totalSales").textContent=fmt(s.sales);$("saleCount").textContent=num(s.items);$("cancelCount").textContent=num(s.cancels)}
async function loadDashboard(){const r=await getDay(today());if(r.error)return;const s=summary(r.data||[]);$("dSales").textContent=fmt(s.sales);$("dItems").textContent=num(s.items);$("dCancels").textContent=num(s.cancels);$("dProfit").textContent=fmt(s.profit);$("productStats").innerHTML=makeTable([...s.a].sort((a,b)=>b.sales-a.sales));const low=products.filter(p=>Number(p.quantity||0)<=Number(p.min_quantity||0));$("stockAlerts").innerHTML=low.length?low.map(p=>`<div class="alert">⚠️ ${esc(p.name)} — موجودی ${num(p.quantity)} عدد</div>`).join(""):`<div class="ok">موجودی محصولی زیر حداقل تعیین‌شده نیست.</div>`}
function tehranTime(x){return new Date(x).toLocaleTimeString("fa-IR",{timeZone:TZ,hour:"2-digit",minute:"2-digit"})}
async function loadReport(){const sdate=$("reportDate").value||today();$("reportDate").value=sdate;const r=await getDay(sdate);if(r.error){$("reportRows").innerHTML=`<div class="empty">خطا: ${esc(r.error.message)}</div>`;return}const s=summary(r.data||[]);$("rSales").textContent=fmt(s.sales);$("rItems").textContent=num(s.items);$("rCancels").textContent=num(s.cancels);$("rProfit").textContent=fmt(s.profit);const reportProducts=products.map(p=>{const a=s.a.find(x=>String(x.name)===String(p.name));const c=catForProduct(p);return{name:p.name,category:c?.name||"Other",purchase_price:Number(p.purchase_price||0),unit_price:Number(p.unit_price||0),sold:Number(a?.qty||0),stock:Number(p.quantity||0),sales:Number(a?.sales||0),profit:Number(a?.profit||0)}}).sort((a,b)=>b.sales-a.sales||a.name.localeCompare(b.name));$("reportProductStats").innerHTML=makeReportProductTable(reportProducts);$("reportRows").innerHTML=s.rows.length?`<table class="table"><thead><tr><th>Time</th><th>Product</th><th>Action</th><th>Amount</th></tr></thead><tbody>${s.rows.map(x=>`<tr><td>${tehranTime(x.created_at)}</td><td>${esc(x.product_name)}</td><td>${x.action==="cancel"?"↩️ Cancel":"🛒 Sale"}</td><td>${fmt(x.total_amount)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No sales for this day.</div>`}
function moveReport(n){const d=new Date($("reportDate").value+"T12:00:00");d.setDate(d.getDate()+n);$("reportDate").value=d.toISOString().slice(0,10);loadReport()}$("prevDay").onclick=()=>moveReport(-1);$("nextDay").onclick=()=>moveReport(1);$("todayBtn").onclick=()=>{$("reportDate").value=today();loadReport()};$("reportDate").onchange=loadReport;
function localParts(iso){const parts=new Intl.DateTimeFormat("en-US",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hour12:false,weekday:"short"}).formatToParts(new Date(iso));const o={};parts.forEach(p=>o[p.type]=p.value);return o}
async function loadAnalytics(){const start=new Date(Date.now()-30*864e5).toISOString(),r=await db.from("sales").select("product_id,product_name,quantity,action,created_at").gte("created_at",start).order("created_at",{ascending:true});if(r.error){setStatus("خطای تحلیل: "+r.error.message,true);return}const hour=Array(24).fill(0),dow=Array(7).fill(0),productHour=new Map(),productTotal=new Map();for(const x of r.data||[]){const q=Number(x.quantity||1)*(x.action==="cancel"?-1:1),p=localParts(x.created_at),h=Math.min(23,Number(p.hour)),wi=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(p.weekday);hour[h]+=q;if(wi>=0)dow[wi]+=q;productTotal.set(x.product_name,(productTotal.get(x.product_name)||0)+q);const key=x.product_id||x.product_name;if(!productHour.has(key))productHour.set(key,{name:x.product_name,hours:Array(24).fill(0)});productHour.get(key).hours[h]+=q}drawBars("hourChart",Array.from({length:24},(_,i)=>String(i)),hour);drawBars("dowChart",days,dow);const ph=[...productHour.values()].map(x=>{const mx=Math.max(...x.hours);return{name:x.name,hour:x.hours.indexOf(mx),qty:mx}}).filter(x=>x.qty>0).sort((a,b)=>b.qty-a.qty),pt=[...productTotal.entries()].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);$("peakHour").textContent=`اوج ساعت کل: ${num(hour.indexOf(Math.max(...hour)))}:00`;$("peakDay").textContent=`اوج روز هفته: ${days[dow.indexOf(Math.max(...dow))]}`;$("peakProduct").textContent=pt.length?`پرفروش‌ترین محصول: ${esc(pt[0][0])} — ${num(pt[0][1])} عدد`:`پرفروش‌ترین محصول: —`;$("productPeaks").innerHTML=ph.length?`<table class="table"><thead><tr><th>Product</th><th>Peak Hour</th><th>Qty</th></tr></thead><tbody>${ph.map(x=>`<tr><td>${esc(x.name)}</td><td>${num(x.hour)}:00</td><td>${num(x.qty)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No data.</div>`}
function drawBars(id,labels,values){const c=$(id);if(!c)return;const ctx=c.getContext("2d"),ratio=window.devicePixelRatio||1,w=Math.max(c.clientWidth,300),h=240;c.width=w*ratio;c.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);const max=Math.max(1,...values),slot=w/values.length,bw=slot*.7;ctx.font="11px Tahoma";values.forEach((v,i)=>{const bh=Math.max(0,v/max*(h-50)),x=i*slot+(slot-bw)/2,y=h-bh-30;ctx.fillStyle="#6f9630";ctx.fillRect(x,y,bw,bh);ctx.fillStyle="#333";ctx.textAlign="center";ctx.fillText(labels[i],x+bw/2,h-10)})}
function renderProductManager(){$("productCards").innerHTML=products.length?products.map(p=>{const low=Number(p.quantity||0)<=Number(p.min_quantity||0),c=catForProduct(p),im=p.image_url?`<img src="${esc(p.image_url)}" alt="">`:c?.icon||"🛍️";return`<div class="productRow"><div class="productInfo"><div class="thumb">${im}</div><div><h3>${esc(p.name)}</h3><small>${esc(c?.name||"Other")} · خرید: ${fmt(p.purchase_price)} · فروش: ${fmt(p.unit_price)}</small><br><small class="${low?"stockLow":""}">موجودی: ${num(p.quantity)} · حداقل: ${num(p.min_quantity)}</small></div></div><button class="ghost editProduct" data-id="${esc(p.id)}">Edit</button></div>`}).join(""):`<div class="empty">هنوز محصولی ثبت نشده است.</div>`;document.querySelectorAll(".editProduct").forEach(b=>b.onclick=()=>openProduct(b.dataset.id))}
async function fileToDataURL(file){if(!file)return null;if(!file.type.startsWith("image/"))throw new Error("لطفاً یک فایل تصویری انتخاب کنید.");if(file.size>8*1024*1024)throw new Error("حجم عکس باید کمتر از ۸ مگابایت باشد.");const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error("خواندن عکس ناموفق بود."));r.readAsDataURL(file)});return await new Promise(resolve=>{const im=new Image();im.onload=()=>{const max=900,scale=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(im.width*scale));c.height=Math.max(1,Math.round(im.height*scale));c.getContext("2d").drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.78))};im.onerror=()=>resolve(src);im.src=src})}
function showImagePreview(data){$("imagePreview").innerHTML=data?`<img src="${esc(data)}" alt="preview">`:`<span>No image</span>`}
function fillCategorySelect(selected){$("pCategory").innerHTML=categories.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected)?"selected":""}>${esc(c.name)}</option>`).join("")}
function openProduct(id=null){editingProduct=id?products.find(p=>String(p.id)===String(id)):null;selectedImageData=editingProduct?.image_url||null;$("productModalTitle").textContent=editingProduct?"Edit Product":"New Product";$("pName").value=editingProduct?.name||"";fillCategorySelect(editingProduct?.category_id||categories[0]?.id);$("pImage").value="";$("pBuy").value=editingProduct?.purchase_price??0;$("pSell").value=editingProduct?.unit_price??0;$("pQty").value=editingProduct?.quantity??0;$("pMin").value=editingProduct?.min_quantity??0;$("productFormStatus").textContent="";showImagePreview(selectedImageData);$("productModal").classList.remove("hidden")}
function closeProduct(){$("productModal").classList.add("hidden");editingProduct=null;selectedImageData=null;$("pImage").value=""}
$("newProduct").onclick=()=>openProduct();$("pCancel").onclick=closeProduct;$("productModal").onclick=e=>{if(e.target===$("productModal"))closeProduct()};$("pImage").onchange=async()=>{const file=$("pImage").files?.[0];if(!file)return;$("productFormStatus").textContent="در حال آماده‌سازی عکس…";try{selectedImageData=await fileToDataURL(file);showImagePreview(selectedImageData);$("productFormStatus").textContent="عکس آماده شد ✅"}catch(e){selectedImageData=null;showImagePreview(null);$("productFormStatus").textContent=e.message}};
$("pSave").onclick=async()=>{const name=$("pName").value.trim(),category_id=$("pCategory").value;if(!name){$("productFormStatus").textContent="نام محصول را وارد کنید.";return}if(!category_id){$("productFormStatus").textContent="دسته را انتخاب کنید.";return}const data={name,category_id,image_url:selectedImageData||null,purchase_price:Number($("pBuy").value||0),unit_price:Number($("pSell").value||0),quantity:Math.max(0,Number($("pQty").value||0)),min_quantity:Math.max(0,Number($("pMin").value||0)),updated_at:new Date().toISOString()};if(!editingProduct)data.created_at=new Date().toISOString();$("pSave").disabled=true;$("productFormStatus").textContent="در حال ذخیره…";const r=editingProduct?await db.from("products").update(data).eq("id",editingProduct.id):await db.from("products").insert([data]);$("pSave").disabled=false;if(r.error){$("productFormStatus").textContent="ذخیره نشد: "+r.error.message;return}closeProduct();await load();setStatus("محصول با موفقیت ذخیره شد ✅")};
let pendingCategoryImages={};
function renderCategoryManager(){
  const box=$("categoryCards");
  box.innerHTML=categories.map(c=>{
    const preview=pendingCategoryImages[c.id]||c.image_url;
    return `<div class="catManage" data-cat-card="${esc(c.id)}">
      <strong>${esc(c.name)}</strong>
      <div class="catImg">${preview?`<img src="${esc(preview)}" alt="${esc(c.name)}">`:`<span>${c.icon||"🛍️"}</span>`}</div>
      <label class="fileButton">Choose File
        <input type="file" accept="image/*" data-cat-file="${esc(c.id)}">
      </label>
      <button type="button" class="primary small" data-cat-save="${esc(c.id)}">Save Category Image</button>
      <div class="formStatus" data-cat-status="${esc(c.id)}"></div>
    </div>`;
  }).join("");

  box.querySelectorAll("[data-cat-file]").forEach(inp=>inp.onchange=async()=>{
    const id=inp.dataset.catFile;
    const card=inp.closest(".catManage");
    const status=card.querySelector("[data-cat-status]");
    const file=inp.files?.[0];
    if(!file)return;
    status.textContent="در حال آماده‌سازی عکس دسته…";
    try{
      pendingCategoryImages[id]=await fileToDataURL(file);
      const c=categories.find(x=>String(x.id)===String(id));
      card.querySelector(".catImg").innerHTML=catImage({...c,image_url:pendingCategoryImages[id]});
      status.textContent="عکس آماده شد ✅ — حالا Save را بزنید.";
    }catch(e){
      delete pendingCategoryImages[id];
      status.textContent=e.message;
    }
  });

  box.querySelectorAll("[data-cat-save]").forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.catSave;
    const c=categories.find(x=>String(x.id)===String(id));
    const card=btn.closest(".catManage");
    const status=card.querySelector("[data-cat-status]");
    const image=pendingCategoryImages[id];
    if(!image){status.textContent="ابتدا برای همین دسته یک عکس انتخاب کنید.";return;}
    btn.disabled=true;
    status.textContent="در حال ذخیره عکس دسته…";
    const r=await db.from("categories").update({image_url:image,updated_at:new Date().toISOString()}).eq("id",id);
    btn.disabled=false;
    if(r.error){status.textContent="ذخیره نشد: "+r.error.message;return;}
    c.image_url=image;
    delete pendingCategoryImages[id];
    status.textContent="عکس دسته با موفقیت ذخیره شد ✅";
    renderCategories();
    renderCategoryManager();
  });
}
function openCategoryManager(){
  pendingCategoryImages={};
  renderCategoryManager();
  $("categoryImageModal").classList.remove("hidden");
}
function closeCategoryManager(){
  pendingCategoryImages={};
  $("categoryImageModal").classList.add("hidden");
}
$("manageCategories").onclick=openCategoryManager;
$("categoryImageClose").onclick=closeCategoryManager;
$("categoryImageModal").onclick=e=>{if(e.target===$("categoryImageModal"))closeCategoryManager()};

function monthBounds(month){const[y,m]=month.split("-").map(Number),start=new Date(`${month}-01T00:00:00+03:30`),next=m===12?`${y+1}-01-01T00:00:00+03:30`:`${y}-${String(m+1).padStart(2,"0")}-01T00:00:00+03:30`;return[start.toISOString(),new Date(next).toISOString()]}
async function monthlyPdf(){const month=$("monthInput")?.value||today().slice(0,7),[start,end]=monthBounds(month),r=await db.from("sales").select("product_id,product_name,unit_price,purchase_price,quantity,total_amount,profit_amount,action,created_at").gte("created_at",start).lt("created_at",end).order("created_at",{ascending:true});if(r.error){setStatus("گزارش ماهانه آماده نشد: "+r.error.message,true);return}const s=summary(r.data||[]),html=`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>گزارش ${month}</title><style>body{font-family:Tahoma;padding:25px}.table{width:100%;border-collapse:collapse}.table th,.table td{border:1px solid #aaa;padding:7px;text-align:center}</style><h1>گزارش ماهانه سبد من — ${month}</h1><p>فروش خالص: ${fmt(s.sales)} | تعداد: ${num(s.items)} | لغو: ${num(s.cancels)} | سود: ${fmt(s.profit)}</p>${makeTable([...s.a].sort((a,b)=>b.sales-a.sales))}<h2>جزئیات</h2><table class="table"><tr><th>زمان</th><th>محصول</th><th>عملیات</th><th>مبلغ</th></tr>${s.rows.map(x=>`<tr><td>${tehranTime(x.created_at)}</td><td>${esc(x.product_name)}</td><td>${x.action==="cancel"?"لغو":"فروش"}</td><td>${fmt(x.total_amount)}</td></tr>`).join("")}</table><script>window.onload=()=>setTimeout(()=>window.print(),400)</script>`;const w=window.open("","_blank");if(!w){setStatus("پنجره PDF توسط مرورگر مسدود شد.",true);return}w.document.open();w.document.write(html);w.document.close()}
$("monthlyPdf")?.addEventListener("click",monthlyPdf);$("dashRefresh").onclick=loadDashboard;$("refreshButton")?.addEventListener("click",load);
$("loginButton").onclick=async()=>{const e=$("email").value.trim(),p=$("password").value;if(!e||!p){$("loginStatus").textContent="ایمیل و رمز عبور را وارد کنید.";return}$("loginButton").disabled=true;const r=await db.auth.signInWithPassword({email:e,password:p});$("loginButton").disabled=false;if(r.error){$("loginStatus").textContent=r.error.message;return}show();await boot()};$("password").onkeydown=e=>{if(e.key==="Enter")$("loginButton").click()};$("logoutButton").onclick=async()=>{await db.auth.signOut();location.reload()};
function show(){$("loginView").classList.add("hidden");$("appView").classList.remove("hidden")}
async function boot(){const u=await db.auth.getUser();$("userEmail").textContent=u.data?.user?.email||"";$("reportDate").value=today();await load()}
(async()=>{const r=await db.auth.getSession();if(r.data?.session){show();await boot()}})();
db.channel("sabadman-final-v5-5").on("postgres_changes",{event:"*",schema:"public",table:"sales"},async()=>{await loadToday();await loadDashboard();if(!$("reportView").classList.contains("hidden"))loadReport();if(!$("analyticsView").classList.contains("hidden"))loadAnalytics()}).on("postgres_changes",{event:"*",schema:"public",table:"products"},()=>load()).on("postgres_changes",{event:"*",schema:"public",table:"categories"},()=>load()).subscribe();
