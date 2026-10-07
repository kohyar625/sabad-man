/* سبد من — v6.8 patch
   این فایل بعد از app.js لود شود.
   شامل: قیمت تاریخی اعلان‌ها، Sales by Monthly روزانه، مقیاس محور عمودی، مرتب‌سازی محصولات.
*/
(function(){
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const q=id=>document.getElementById(id);
  const escV=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

  /* ---------- shared product order ---------- */
  async function ensureProductOrder(){
    const r=await db.from("products").select("id,category_id,created_at,sort_order").order("created_at",{ascending:true});
    if(r.error)return;
    const rows=r.data||[];
    const groups=new Map();
    rows.forEach(p=>{const k=String(p.category_id||"__other");if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p)});
    for(const list of groups.values()){
      let changed=false;
      list.sort((a,b)=>{
        const aa=a.sort_order==null?Infinity:Number(a.sort_order),bb=b.sort_order==null?Infinity:Number(b.sort_order);
        return aa-bb||new Date(a.created_at)-new Date(b.created_at)||String(a.id).localeCompare(String(b.id));
      });
      list.forEach((p,i)=>{if(Number(p.sort_order)!==i+1)changed=true;p.sort_order=i+1});
      if(changed){
        for(const p of list){await db.from("products").update({sort_order:p.sort_order}).eq("id",p.id)}
      }
    }
    const fresh=await db.from("products").select("id,sort_order");
    if(!fresh.error){const map=new Map((fresh.data||[]).map(x=>[String(x.id),x.sort_order]));products.forEach(p=>p.sort_order=map.get(String(p.id))??null)}
  }

  function ordered(list){return [...list].sort((a,b)=>Number(a.sort_order??999999)-Number(b.sort_order??999999)||new Date(a.created_at)-new Date(b.created_at)||String(a.name).localeCompare(String(b.name),'fa'))}

  const oldOpenCategory=window.openCategory;
  if(typeof oldOpenCategory==='function'){
    window.openCategory=function(c){
      current=c;
      const input=q("salesProductSearch");if(input)input.value="";
      q("categories")?.classList.add("hidden");q("products")?.classList.remove("hidden");q("back")?.classList.remove("hidden");
      if(q("title"))q("title").textContent=c.name;
      if(q("subtitle"))q("subtitle").textContent="One tap = sale · Long press = cancel";
      renderProducts(ordered(products.filter(p=>String(p.category_id)===String(c.id)||p.category===c.code)));
    };
  }

  async function moveProduct(id,dir){
    const p=products.find(x=>String(x.id)===String(id));if(!p)return;
    const catId=p.category_id??"__other";
    const list=ordered(products.filter(x=>String(x.category_id??"__other")===String(catId)));
    const i=list.findIndex(x=>String(x.id)===String(id));
    const j=i+dir;if(i<0||j<0||j>=list.length)return;
    const a=list[i],b=list[j],tmp=Number(a.sort_order||i+1),target=Number(b.sort_order||j+1);
    const r1=await db.from("products").update({sort_order:0}).eq("id",a.id);
    if(r1.error){showToast("تغییر ترتیب انجام نشد",true);return}
    const r2=await db.from("products").update({sort_order:tmp}).eq("id",b.id);
    if(r2.error){await db.from("products").update({sort_order:tmp}).eq("id",a.id);showToast("تغییر ترتیب انجام نشد",true);return}
    const r3=await db.from("products").update({sort_order:target}).eq("id",a.id);
    if(r3.error){showToast("تغییر ترتیب انجام نشد",true);return}
    a.sort_order=target;b.sort_order=tmp;
    renderProductManager();
    if(current)renderProducts(ordered(products.filter(x=>String(x.category_id)===String(current.id)||x.category===current.code)));
  }

  function renderProductManagerV68(){
    const box=q("productCards"),input=q("productsSearch");if(!box)return;
    const query=typeof searchNormalize==='function'?searchNormalize(input?.value||""):String(input?.value||"").toLowerCase();
    const filtered=products.filter(p=>!query||searchNormalize(p.name).includes(query));
    if(!filtered.length){box.innerHTML=`<div class="empty">${query?"محصولی با این نام پیدا نشد.":"هنوز محصولی ثبت نشده است."}</div>`;return}
    const groups=[];
    categories.forEach(c=>{const list=ordered(filtered.filter(p=>String(p.category_id)===String(c.id)||p.category===c.code));if(list.length)groups.push({cat:c,items:list})});
    const assigned=new Set(groups.flatMap(g=>g.items.map(p=>String(p.id))));
    const other=ordered(filtered.filter(p=>!assigned.has(String(p.id))));if(other.length)groups.push({cat:{id:"__other",name:"Other",icon:"🛍️"},items:other});
    box.innerHTML=groups.map(g=>`<div class="productManagerGroup"><div class="productManagerGroupTitle"><span>${escV(g.cat.icon||"🛍️")}</span><strong>${escV(g.cat.name||"Other")}</strong><small>${num(g.items.length)} محصول</small></div><div class="productManagerGroupItems">${g.items.map((p,i)=>{const low=Number(p.quantity||0)<=Number(p.min_quantity||0),c=catForProduct(p),im=p.image_url?`<img src="${escV(p.image_url)}" alt="">`:c?.icon||"🛍️";return `<div class="productRow"><div class="productInfo"><div class="thumb">${im}</div><div><h3>${escV(p.name)}</h3><small>خرید: ${fmt(p.purchase_price)} · فروش: ${fmt(p.unit_price)}</small><br><small class="${low?"stockLow":""}">موجودی: ${num(p.quantity)} · حداقل: ${num(p.min_quantity)}</small></div></div><div class="productRowActions orderActions"><button class="ghost small moveProduct" data-dir="-1" data-id="${escV(p.id)}" ${i===0?'disabled':''}>▲</button><button class="ghost small moveProduct" data-dir="1" data-id="${escV(p.id)}" ${i===g.items.length-1?'disabled':''}>▼</button><button class="ghost editProduct" data-id="${escV(p.id)}">Edit</button><button class="danger small deleteProduct" data-id="${escV(p.id)}">Delete</button></div></div>`}).join("")}</div></div>`).join("");
    box.querySelectorAll(".editProduct").forEach(b=>b.onclick=()=>openProduct(b.dataset.id));
    box.querySelectorAll(".deleteProduct").forEach(b=>b.onclick=()=>deleteProductV67(b.dataset.id));
    box.querySelectorAll(".moveProduct").forEach(b=>b.onclick=()=>moveProduct(b.dataset.id,Number(b.dataset.dir)));
  }
  window.renderProductManager=renderProductManagerV68;

  /* ---------- historical prices in action notifications ---------- */
  const oldRegisterSale=window.registerSale;
  window.registerSale=async function(p,d){
    if(Number(p.quantity||0)<=0){setStatus(`موجودی «${p.name}» تمام شده است.`,true);return}
    const oldQty=Number(p.quantity||0);p.quantity=Math.max(0,oldQty-1);
    const r=await db.rpc("sale_product",{p_product_id:p.id});
    if(r.error){p.quantity=oldQty;setStatus("ثبت فروش انجام نشد: "+r.error.message,true);return}
    const sr=await db.from("sales").select("unit_price,purchase_price,profit_amount").eq("id",r.data?.sale_id).maybeSingle();
    const sale=sr.data||{unit_price:p.unit_price,purchase_price:p.purchase_price,profit_amount:Number(p.unit_price||0)-Number(p.purchase_price||0)};
    playSaleSound();showActionNotification("فروش ثبت شد",`${p.name} · خرید: ${fmt(sale.purchase_price)} · فروش: ${fmt(sale.unit_price)} · سود: ${fmt(sale.profit_amount)}`,"sale");
    await loadToday();if(current)renderProducts(ordered(products.filter(x=>String(x.category_id)===String(current.id)||x.category===current.code)));await loadDashboard();await loadLatestSales();await createStockNotifications();await loadNotifications();
  };

  window.openCancel=async function(p){
    const r=await db.rpc("cancel_product",{p_product_id:p.id});
    if(r.error){showActionNotification("لغو فروش ناموفق",r.error.message,"cancel");setStatus("لغو فروش انجام نشد: "+r.error.message,true);return}
    const saleId=r.data?.sale_id;
    const sr=saleId?await db.from("sales").select("product_name,unit_price,purchase_price,profit_amount").eq("id",saleId).maybeSingle():null;
    const sale=sr?.data||{product_name:p.name,unit_price:p.unit_price,purchase_price:p.purchase_price,profit_amount:Number(p.unit_price||0)-Number(p.purchase_price||0)};
    p.quantity=Number(p.quantity||0)+1;playCancelSound();showActionNotification("فروش لغو شد",`${sale.product_name} · خرید: ${fmt(sale.purchase_price)} · فروش: ${fmt(sale.unit_price)} · سود برگشتی: ${fmt(sale.profit_amount)}`,"cancel");
    await loadToday();if(current)renderProducts(ordered(products.filter(x=>String(x.category_id)===String(current.id)||x.category===current.code)));await loadDashboard();await loadLatestSales();await loadNotifications();if(q("calendarModal")&&!q("calendarModal").classList.contains("hidden"))loadCalendarSales(calendarDate);
  };

  /* ---------- charts with vertical scale ---------- */
  window.drawBars=function(id,labels,values,unit="عدد"){
    const c=q(id);if(!c)return;const ctx=c.getContext("2d"),ratio=window.devicePixelRatio||1,w=Math.max(c.clientWidth,360),h=260,left=64,bottom=34,top=12,right=10;c.width=w*ratio;c.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
    const max=Math.max(1,...values.map(v=>Math.abs(Number(v)||0)));const step=Math.max(1,Math.ceil(max/5));const yMax=step*5;const plotH=h-top-bottom,plotW=w-left-right;
    ctx.font="10px Tahoma";ctx.textAlign="right";ctx.fillStyle="#69755d";
    for(let i=0;i<=5;i++){const v=step*i,y=top+plotH-(i/5)*plotH;ctx.fillText(num(v),left-8,y+3);ctx.strokeStyle="#e3ead7";ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke()}
    ctx.save();ctx.translate(12,h/2);ctx.rotate(-Math.PI/2);ctx.textAlign="center";ctx.fillText(unit,0,0);ctx.restore();
    const slot=plotW/Math.max(1,values.length),bw=Math.max(3,slot*.68);values.forEach((v,i)=>{const n=Math.max(0,Number(v)||0),bh=n/yMax*plotH,x=left+i*slot+(slot-bw)/2,y=top+plotH-bh;ctx.fillStyle="#6f9630";ctx.fillRect(x,y,bw,bh);ctx.fillStyle="#333";ctx.textAlign="center";ctx.fillText(labels[i],x+bw/2,h-10)});
  };

  function monthDayCount(y,m){return [1,2,3,4,5,6].includes(m)?31:30}
  async function loadAnalyticsV68(){
    const start30=new Date(Date.now()-30*864e5).toISOString(),startYear=new Date(Date.now()-365*864e5).toISOString();
    const r=await db.from("sales").select("product_id,product_name,quantity,action,created_at").gte("created_at",startYear).order("created_at",{ascending:true});if(r.error){setStatus("خطای تحلیل: "+r.error.message,true);return}
    const hour=Array(24).fill(0),dow=Array(7).fill(0),productHour=new Map(),productTotal=new Map(),daily=new Map();
    for(const x of r.data||[]){const qv=Number(x.quantity||1)*(x.action==="cancel"?-1:1),p=localParts(x.created_at),h=Math.min(23,Number(p.hour)),iso=new Date(x.created_at),recent=iso>=new Date(start30);if(recent){hour[h]+=qv;const wi=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(p.weekday);if(wi>=0)dow[wi]+=qv;productTotal.set(x.product_name,(productTotal.get(x.product_name)||0)+qv);const key=x.product_id||x.product_name;if(!productHour.has(key))productHour.set(key,{name:x.product_name,hours:Array(24).fill(0)});productHour.get(key).hours[h]+=qv}const mp=persianParts(x.created_at);const k=`${mp.year}-${String(mp.month).padStart(2,"0")}-${String(mp.day).padStart(2,"0")}`;daily.set(k,(daily.get(k)||0)+qv)}
    drawBars("hourChart",Array.from({length:24},(_,i)=>String(i)),hour,"تعداد");drawBars("dowChart",days,dow,"تعداد");
    const nowP=persianParts(new Date().toISOString()),daysInMonth=monthDayCount(nowP.year,nowP.month),vals=Array.from({length:daysInMonth},(_,i)=>daily.get(`${nowP.year}-${String(nowP.month).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`)||0);
    const title=q("monthlySalesTitle");if(title)title.textContent=`${monthNames[nowP.month-1]} ${num(nowP.year)} — ${num(daysInMonth)} روز`;
    const max=Math.max(1,...vals.map(v=>Math.abs(v))),scale=Math.max(1,Math.ceil(max/5)),yMax=scale*5;
    const table=q("monthlySalesTable");if(table)table.innerHTML=`<div class="monthlyScroll"><div class="monthlyChart" style="--days:${daysInMonth}">${vals.map((v,i)=>{const h=Math.max(0,Math.round((Math.max(0,v)/yMax)*150));return `<div class="monthlyCol"><div class="monthlyValue">${num(v)}</div><div class="monthlyBarArea"><div class="monthlyBar" style="height:${h}px"></div></div><div class="monthlyDay">${num(i+1)}</div></div>`}).join("")}</div><div class="monthlyAxis"><span>۰</span><span>${num(scale)}</span><span>${num(scale*2)}</span><span>${num(scale*3)}</span><span>${num(scale*4)}</span><span>${num(scale*5)}</span><b>تعداد فروش</b></div></div>`;
    const ph=[...productHour.values()].map(x=>{const mx=Math.max(...x.hours);return{name:x.name,hour:x.hours.indexOf(mx),qty:mx}}).filter(x=>x.qty>0).sort((a,b)=>b.qty-a.qty),pt=[...productTotal.entries()].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
    q("peakHour").textContent=`اوج ساعت کل: ${num(hour.indexOf(Math.max(...hour)))}:00`;q("peakDay").textContent=`اوج روز هفته: ${days[dow.indexOf(Math.max(...dow))]}`;q("peakProduct").textContent=pt.length?`پرفروش‌ترین محصول: ${escV(pt[0][0])} — ${num(pt[0][1])} عدد`:`پرفروش‌ترین محصول: —`;q("productPeaks").innerHTML=ph.length?`<table class="table"><thead><tr><th>Product</th><th>Peak Hour</th><th>Qty</th></tr></thead><tbody>${ph.map(x=>`<tr><td>${escV(x.name)}</td><td>${num(x.hour)}:00</td><td>${num(x.qty)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No data.</div>`;
  }
  window.loadAnalytics=loadAnalyticsV68;

  const css=document.createElement("style");css.textContent=`.orderActions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}.orderActions button:disabled{opacity:.3;cursor:not-allowed}.monthlyScroll{position:relative;overflow-x:auto;padding:12px 0 6px;-webkit-overflow-scrolling:touch}.monthlyChart{display:flex;align-items:flex-end;gap:5px;min-width:max(760px,calc(var(--days)*31px));height:205px;padding:12px 8px 0}.monthlyCol{width:26px;flex:0 0 26px;height:190px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}.monthlyValue{font-size:9px;color:#69755d;height:18px;white-space:nowrap}.monthlyBarArea{height:150px;width:100%;display:flex;align-items:flex-end;justify-content:center}.monthlyBar{width:18px;min-height:2px;border-radius:7px 7px 2px 2px;background:#6f9630}.monthlyDay{font-size:11px;font-weight:800;color:#365019;margin-top:5px}.monthlyAxis{display:flex;align-items:center;gap:12px;color:#69755d;font-size:10px;padding:2px 10px;border-top:1px solid #e3ead7}.monthlyAxis b{margin-right:auto;color:#365019}.productManagerGroupItems{display:flex;flex-direction:column}.productManagerGroupTitle{display:flex;align-items:center;gap:7px;margin:14px 0 8px;color:#365019}.productManagerGroupTitle small{color:#69755d}.productRowActions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.monthlySalesPanel{overflow:hidden}@media(max-width:600px){.orderActions{max-width:150px}.orderActions .editProduct{order:3}.orderActions .deleteProduct{order:4}.monthlyChart{min-width:max(930px,calc(var(--days)*31px))}}`;
  document.head.appendChild(css);

  async function initV68(){
    for(let i=0;i<30;i++){if(window.db&&Array.isArray(window.products)){break}await wait(100)}
    try{await ensureProductOrder();renderProductManager();if(current)renderProducts(ordered(products.filter(p=>String(p.category_id)===String(current.id)||p.category===current.code)));}catch(e){console.warn("v6.8 order init",e)}
    if(!$('analyticsView')?.classList.contains('hidden'))loadAnalyticsV68();
  }
  setTimeout(initV68,500);
})();
