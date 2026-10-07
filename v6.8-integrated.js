/* سبد من v6.8 — integrated runtime layer
   This file is concatenated with the existing app.js by index.html,
   so all original lexical functions/variables remain available.
*/
(function(){
  "use strict";

  const v68Wait=ms=>new Promise(r=>setTimeout(r,ms));
  const v68Esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

  // ---------- shared product order ----------
  function v68Ordered(list){
    return [...list].sort((a,b)=>
      Number(a.sort_order??999999)-Number(b.sort_order??999999) ||
      new Date(a.created_at||0)-new Date(b.created_at||0) ||
      String(a.name||"").localeCompare(String(b.name||""),"fa")
    );
  }

  async function v68EnsureOrder(){
    const r=await db.from("products")
      .select("id,category_id,created_at,sort_order")
      .order("created_at",{ascending:true});
    if(r.error)return;
    const groups=new Map();
    for(const p of (r.data||[])){
      const k=String(p.category_id||"__other");
      if(!groups.has(k))groups.set(k,[]);
      groups.get(k).push(p);
    }
    for(const list of groups.values()){
      list.sort((a,b)=>
        Number(a.sort_order??999999)-Number(b.sort_order??999999) ||
        new Date(a.created_at||0)-new Date(b.created_at||0) ||
        String(a.id).localeCompare(String(b.id))
      );
      let needs=false;
      list.forEach((p,i)=>{const n=i+1;if(Number(p.sort_order)!==n)needs=true;p.sort_order=n});
      if(needs){
        for(const p of list){
          const u=await db.from("products").update({sort_order:p.sort_order}).eq("id",p.id);
          if(u.error)console.warn("sort_order init",u.error.message);
        }
      }
    }
    const fresh=await db.from("products").select("id,sort_order");
    if(!fresh.error){
      const m=new Map((fresh.data||[]).map(x=>[String(x.id),x.sort_order]));
      products.forEach(p=>p.sort_order=m.get(String(p.id))??null);
    }
  }

  function v68CategoryList(catId){
    const key=String(catId??"__other");
    return v68Ordered(products.filter(p=>String(p.category_id??"__other")===key));
  }

  async function v68MoveProduct(id,dir){
    const p=products.find(x=>String(x.id)===String(id));
    if(!p)return;
    const list=v68CategoryList(p.category_id);
    const i=list.findIndex(x=>String(x.id)===String(id)),j=i+dir;
    if(i<0||j<0||j>=list.length)return;
    const a=list[i],b=list[j];
    const av=Number(a.sort_order||i+1),bv=Number(b.sort_order||j+1);
    const t=-(Date.now()%1000000+1);

    let r=await db.from("products").update({sort_order:t}).eq("id",a.id);
    if(r.error){showToast("تغییر ترتیب انجام نشد",true);return}
    r=await db.from("products").update({sort_order:av}).eq("id",b.id);
    if(r.error){
      await db.from("products").update({sort_order:av}).eq("id",a.id);
      showToast("تغییر ترتیب انجام نشد",true); return;
    }
    r=await db.from("products").update({sort_order:bv}).eq("id",a.id);
    if(r.error){showToast("تغییر ترتیب انجام نشد",true);return}
    a.sort_order=bv;b.sort_order=av;
    renderProductManager();
    if(current){
      renderProducts(v68Ordered(products.filter(x=>String(x.category_id)===String(current.id)||x.category===current.code)));
    }
  }

  function v68RenderProductManager(){
    const box=$("productCards"),input=$("productsSearch");
    if(!box)return;
    const q=typeof searchNormalize==="function"
      ?searchNormalize(input?.value||"")
      :String(input?.value||"").toLocaleLowerCase("fa-IR").trim();
    const filtered=products.filter(p=>{
      const n=typeof searchNormalize==="function"?searchNormalize(p.name):String(p.name||"").toLocaleLowerCase("fa-IR");
      return !q||n.includes(q);
    });
    if(!filtered.length){
      box.innerHTML=`<div class="empty">${q?"محصولی با این نام پیدا نشد.":"هنوز محصولی ثبت نشده است."}</div>`;
      return;
    }
    const groups=[];
    categories.forEach(c=>{
      const list=v68Ordered(filtered.filter(p=>String(p.category_id)===String(c.id)||p.category===c.code));
      if(list.length)groups.push({cat:c,items:list});
    });
    const assigned=new Set(groups.flatMap(g=>g.items.map(p=>String(p.id))));
    const other=v68Ordered(filtered.filter(p=>!assigned.has(String(p.id))));
    if(other.length)groups.push({cat:{id:"__other",name:"Other",icon:"🛍️"},items:other});

    box.innerHTML=groups.map(g=>`
      <div class="productManagerGroup">
        <div class="productManagerGroupTitle"><span>${v68Esc(g.cat.icon||"🛍️")}</span><strong>${v68Esc(g.cat.name||"Other")}</strong><small>${num(g.items.length)} محصول</small></div>
        <div class="productManagerGroupItems">
          ${g.items.map((p,i)=>{
            const low=Number(p.quantity||0)<=Number(p.min_quantity||0),c=catForProduct(p);
            const im=p.image_url?`<img src="${v68Esc(p.image_url)}" alt="">`:c?.icon||"🛍️";
            return `<div class="productRow">
              <div class="productInfo"><div class="thumb">${im}</div><div>
                <h3>${v68Esc(p.name)}</h3>
                <small>خرید: ${fmt(p.purchase_price)} · فروش: ${fmt(p.unit_price)}</small><br>
                <small class="${low?"stockLow":""}">موجودی: ${num(p.quantity)} · حداقل: ${num(p.min_quantity)}</small>
              </div></div>
              <div class="productRowActions orderActions">
                <button class="ghost small moveProduct" data-dir="-1" data-id="${v68Esc(p.id)}" ${i===0?"disabled":""}>▲</button>
                <button class="ghost small moveProduct" data-dir="1" data-id="${v68Esc(p.id)}" ${i===g.items.length-1?"disabled":""}>▼</button>
                <button class="ghost editProduct" data-id="${v68Esc(p.id)}">Edit</button>
                <button class="danger small deleteProduct" data-id="${v68Esc(p.id)}">Delete</button>
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>`).join("");

    box.querySelectorAll(".editProduct").forEach(b=>b.onclick=()=>openProduct(b.dataset.id));
    box.querySelectorAll(".deleteProduct").forEach(b=>b.onclick=()=>deleteProductV67(b.dataset.id));
    box.querySelectorAll(".moveProduct").forEach(b=>b.onclick=()=>v68MoveProduct(b.dataset.id,Number(b.dataset.dir)));
  }
  renderProductManager=v68RenderProductManager;

  // New products are appended to the end of their selected category.
  const v68OldSave=document.getElementById("pSave")?.onclick;
  if(document.getElementById("pSave")){
    document.getElementById("pSave").onclick=async()=>{
      const name=$("pName").value.trim(),category_id=$("pCategory").value;
      if(!name){$("productFormStatus").textContent="نام محصول را وارد کنید.";return}
      if(!category_id){$("productFormStatus").textContent="دسته را انتخاب کنید.";return}
      const data={
        name,category_id,image_url:selectedImageData||null,
        purchase_price:Number($("pBuy").value||0),
        unit_price:Number($("pSell").value||0),
        quantity:Math.max(0,Number($("pQty").value||0)),
        min_quantity:Math.max(0,Number($("pMin").value||0)),
        updated_at:new Date().toISOString()
      };
      if(!editingProduct){
        const list=v68CategoryList(category_id);
        data.sort_order=list.length?Math.max(...list.map(x=>Number(x.sort_order)||0))+1:1;
        data.created_at=new Date().toISOString();
      }
      $("pSave").disabled=true;$("productFormStatus").textContent="در حال ذخیره…";
      const r=editingProduct
        ?await db.from("products").update(data).eq("id",editingProduct.id)
        :await db.from("products").insert([data]);
      $("pSave").disabled=false;
      if(r.error){$("productFormStatus").textContent="ذخیره نشد: "+r.error.message;return}
      closeProduct();await load();setStatus("محصول با موفقیت ذخیره شد ✅");
    };
  }

  // ---------- historical prices / operation notifications ----------
  async function v68HistoricalSaleById(id){
    if(!id)return null;
    const r=await db.from("sales")
      .select("id,product_id,product_name,unit_price,purchase_price,quantity,total_amount,profit_amount,action,created_at,cancel_of_sale_id")
      .eq("id",id).maybeSingle();
    return r.error?null:r.data;
  }

  async function v68FindHistoricalSale(productId){
    const r=await db.from("sales")
      .select("id,product_id,product_name,unit_price,purchase_price,quantity,total_amount,profit_amount,action,created_at,cancel_of_sale_id")
      .eq("product_id",productId)
      .eq("action","sale")
      .order("created_at",{ascending:false})
      .limit(1);
    return r.error||!r.data?.length?null:r.data[0];
  }

  registerSale=async function(p,d){
    if(Number(p.quantity||0)<=0){setStatus(`موجودی «${p.name}» تمام شده است.`,true);return}
    if(d)d.style.transform="scale(.97)";
    const oldQty=Number(p.quantity||0);
    const r=await db.rpc("sale_product",{p_product_id:p.id});
    if(d)setTimeout(()=>d.style.transform="",120);
    if(r.error){setStatus("ثبت فروش انجام نشد: "+r.error.message,true);return}

    const historical=await v68HistoricalSaleById(r.data?.sale_id);
    const sale=historical||{
      product_name:p.name,unit_price:p.unit_price,purchase_price:p.purchase_price,
      profit_amount:Number(p.unit_price||0)-Number(p.purchase_price||0),quantity:1
    };
    p.quantity=Math.max(0,oldQty-1);
    playSaleSound();
    const q=Number(sale.quantity||1);
    const profit=Number(sale.profit_amount??((Number(sale.unit_price||0)-Number(sale.purchase_price||0))*q));
    showActionNotification("فروش ثبت شد",
      `${sale.product_name||p.name} · خرید: ${fmt(sale.purchase_price)} · فروش: ${fmt(sale.unit_price)} · سود: ${fmt(profit)}`,"sale");
    setStatus(`فروش «${p.name}» ثبت شد ✅`);
    await loadToday();
    if(current)renderProducts(v68Ordered(products.filter(x=>String(x.category_id)===String(current.id)||x.category===current.code)));
    await loadDashboard();await loadLatestSales();await createStockNotifications();await loadNotifications();
  };

  openCancel=async function(p){
    const r=await db.rpc("cancel_product",{p_product_id:p.id});
    if(r.error){
      showActionNotification("لغو فروش ناموفق",r.error.message,"cancel");
      setStatus("لغو فروش انجام نشد: "+r.error.message,true);return;
    }

    let historical=null;
    const saleId=r.data?.sale_id;
    if(saleId)historical=await v68HistoricalSaleById(saleId);
    if(!historical)historical=await v68FindHistoricalSale(p.id);
    if(historical?.cancel_of_sale_id){
      const original=await v68HistoricalSaleById(historical.cancel_of_sale_id);
      if(original)historical=original;
    }

    p.quantity=Number(p.quantity||0)+1;
    playCancelSound();
    const q=Number(historical?.quantity||1);
    const profit=Number(historical?.profit_amount??((Number(historical?.unit_price??p.unit_price||0)-Number(historical?.purchase_price??p.purchase_price||0))*q));
    showActionNotification("فروش لغو شد",
      `${historical?.product_name||p.name} · خرید: ${fmt(historical?.purchase_price??p.purchase_price)} · فروش: ${fmt(historical?.unit_price??p.unit_price)} · سود برگشتی: ${fmt(profit)}`,"cancel");
    setStatus(`فروش «${p.name}» لغو شد ↩️`);
    await loadToday();
    if(current)renderProducts(v68Ordered(products.filter(x=>String(x.category_id)===String(current.id)||x.category===current.code)));
    await loadDashboard();await loadLatestSales();await loadNotifications();
    if(!$("calendarModal").classList.contains("hidden"))loadCalendarSales(calendarDate);
  };

  // ---------- charts: vertical numerical scale + unit ----------
  drawBars=function(id,labels,values,unit="تعداد"){
    const c=$(id);if(!c)return;
    const ctx=c.getContext("2d"),ratio=window.devicePixelRatio||1;
    const w=Math.max(c.clientWidth,360),h=260,left=62,bottom=34,top=14,right=10;
    c.width=w*ratio;c.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,w,h);
    const max=Math.max(0,...values.map(v=>Math.max(0,Number(v)||0)));
    const step=Math.max(1,Math.ceil(Math.max(1,max)/5)),yMax=step*5;
    const plotH=h-top-bottom,plotW=w-left-right;
    ctx.font="10px Tahoma";ctx.fillStyle="#69755d";ctx.textAlign="right";
    for(let i=0;i<=5;i++){
      const v=step*i,y=top+plotH-(i/5)*plotH;
      ctx.fillText(num(v),left-8,y+3);
      ctx.strokeStyle="#e3ead7";ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();
    }
    ctx.save();ctx.translate(13,h/2);ctx.rotate(-Math.PI/2);ctx.textAlign="center";ctx.fillText(unit,0,0);ctx.restore();
    const slot=plotW/Math.max(1,values.length),bw=Math.max(3,slot*.68);
    values.forEach((v,i)=>{
      const n=Math.max(0,Number(v)||0),bh=n/yMax*plotH,x=left+i*slot+(slot-bw)/2,y=top+plotH-bh;
      ctx.fillStyle="#6f9630";ctx.fillRect(x,y,bw,bh);
      ctx.fillStyle="#333";ctx.textAlign="center";ctx.fillText(labels[i],x+bw/2,h-10);
    });
  };

  function v68PersianMonthDays(y,m){
    if(m<=6)return 31;
    if(m<=11)return 30;
    // Esfand can be 29 or 30. Current UI may show 30 when applicable.
    const a=findPersianDate(y,12,30,new Date());
    return a?30:29;
  }

  loadAnalytics=async function(){
    const startYear=new Date(Date.now()-365*864e5).toISOString();
    const start30=new Date(Date.now()-30*864e5).toISOString();
    const r=await db.from("sales").select("product_id,product_name,quantity,action,created_at")
      .gte("created_at",startYear).order("created_at",{ascending:true});
    if(r.error){setStatus("خطای تحلیل: "+r.error.message,true);return}

    const hour=Array(24).fill(0),dow=Array(7).fill(0),productHour=new Map(),productTotal=new Map(),daily=new Map();
    for(const x of r.data||[]){
      const q=Number(x.quantity||1)*(x.action==="cancel"?-1:1);
      const p=localParts(x.created_at),h=Math.min(23,Number(p.hour));
      if(new Date(x.created_at)>=new Date(start30)){
        hour[h]+=q;
        const wi=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(p.weekday);
        if(wi>=0)dow[wi]+=q;
        productTotal.set(x.product_name,(productTotal.get(x.product_name)||0)+q);
        const key=x.product_id||x.product_name;
        if(!productHour.has(key))productHour.set(key,{name:x.product_name,hours:Array(24).fill(0)});
        productHour.get(key).hours[h]+=q;
      }
      const mp=persianParts(x.created_at);
      const key=`${mp.year}-${String(mp.month).padStart(2,"0")}-${String(mp.day).padStart(2,"0")}`;
      daily.set(key,(daily.get(key)||0)+q);
    }

    drawBars("hourChart",Array.from({length:24},(_,i)=>String(i)),hour,"تعداد");
    drawBars("dowChart",days,dow,"تعداد");

    const nowP=persianParts(new Date().toISOString());
    const daysInMonth=v68PersianMonthDays(nowP.year,nowP.month);
    const vals=Array.from({length:daysInMonth},(_,i)=>
      daily.get(`${nowP.year}-${String(nowP.month).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`)||0
    );
    const title=$("monthlySalesTitle");
    if(title)title.textContent=`${monthNames[nowP.month-1]} ${num(nowP.year)} — ${num(daysInMonth)} روز`;

    const max=Math.max(0,...vals.map(v=>Math.max(0,Number(v)||0)));
    const step=Math.max(1,Math.ceil(Math.max(1,max)/5)),yMax=step*5;
    const table=$("monthlySalesTable");
    if(table)table.innerHTML=`
      <div class="monthlyScroll">
        <div class="monthlyChart" style="--days:${daysInMonth}">
          ${vals.map((v,i)=>{
            const h=Math.round(Math.max(0,Number(v)||0)/yMax*150);
            return `<div class="monthlyCol"><div class="monthlyValue">${num(v)}</div>
              <div class="monthlyBarArea"><div class="monthlyBar" style="height:${h}px"></div></div>
              <div class="monthlyDay">${num(i+1)}</div></div>`;
          }).join("")}
        </div>
        <div class="monthlyAxis"><span>۰</span><span>${num(step)}</span><span>${num(step*2)}</span><span>${num(step*3)}</span><span>${num(step*4)}</span><span>${num(step*5)}</span><b>تعداد فروش</b></div>
      </div>`;

    const ph=[...productHour.values()].map(x=>{
      const mx=Math.max(...x.hours);return{name:x.name,hour:x.hours.indexOf(mx),qty:mx};
    }).filter(x=>x.qty>0).sort((a,b)=>b.qty-a.qty);
    const pt=[...productTotal.entries()].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
    $("peakHour").textContent=`اوج ساعت کل: ${num(hour.indexOf(Math.max(...hour)))}:00`;
    $("peakDay").textContent=`اوج روز هفته: ${days[dow.indexOf(Math.max(...dow))]}`;
    $("peakProduct").textContent=pt.length?`پرفروش‌ترین محصول: ${v68Esc(pt[0][0])} — ${num(pt[0][1])} عدد`:`پرفروش‌ترین محصول: —`;
    $("productPeaks").innerHTML=ph.length
      ?`<table class="table"><thead><tr><th>Product</th><th>Peak Hour</th><th>Qty</th></tr></thead><tbody>${ph.map(x=>`<tr><td>${v68Esc(x.name)}</td><td>${num(x.hour)}:00</td><td>${num(x.qty)}</td></tr>`).join("")}</tbody></table>`
      :`<div class="empty">No data.</div>`;
  };

  // v6.8 order + styling
  const st=document.createElement("style");
  st.textContent=`
    .orderActions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}
    .orderActions button:disabled{opacity:.3;cursor:not-allowed}
    .monthlyScroll{position:relative;overflow-x:auto;padding:12px 0 6px;-webkit-overflow-scrolling:touch}
    .monthlyChart{display:flex;align-items:flex-end;gap:5px;min-width:max(760px,calc(var(--days)*31px));height:205px;padding:12px 8px 0}
    .monthlyCol{width:26px;flex:0 0 26px;height:190px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
    .monthlyValue{font-size:9px;color:#69755d;height:18px;white-space:nowrap}
    .monthlyBarArea{height:150px;width:100%;display:flex;align-items:flex-end;justify-content:center}
    .monthlyBar{width:18px;min-height:2px;border-radius:7px 7px 2px 2px;background:#6f9630}
    .monthlyDay{font-size:11px;font-weight:800;color:#365019;margin-top:5px}
    .monthlyAxis{display:flex;align-items:center;gap:12px;color:#69755d;font-size:10px;padding:2px 10px;border-top:1px solid #e3ead7}
    .monthlyAxis b{margin-right:auto;color:#365019}
    .productManagerGroupItems{display:flex;flex-direction:column}
    .productManagerGroupTitle{display:flex;align-items:center;gap:7px;margin:14px 0 8px;color:#365019}
    .productManagerGroupTitle small{color:#69755d}
    .productRowActions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
    .monthlySalesPanel{overflow:hidden}
    @media(max-width:600px){.orderActions{max-width:155px}.monthlyChart{min-width:max(930px,calc(var(--days)*31px))}}
  `;
  document.head.appendChild(st);

  // Make the currently-open category respect the shared order.
  const v68OpenCategory=openCategory;
  openCategory=function(c){
    current=c;
    const input=$("salesProductSearch");if(input)input.value="";
    $("categories").classList.add("hidden");$("products").classList.remove("hidden");$("back").classList.remove("hidden");
    $("title").textContent=c.name;$("subtitle").textContent="One tap = sale · Long press = cancel";
    renderProducts(v68Ordered(products.filter(p=>String(p.category_id)===String(c.id)||p.category===c.code)));
  };

  // Load order after the original boot/load cycle, without touching login.
  (async()=>{
    for(let i=0;i<50;i++){
      if(typeof db!=="undefined" && Array.isArray(products))break;
      await v68Wait(100);
    }
    try{
      await v68EnsureOrder();
      renderProductManager();
      if(current)renderProducts(v68Ordered(products.filter(x=>String(x.category_id)===String(current.id)||x.category===current.code)));
      if(!$("analyticsView")?.classList.contains("hidden"))await loadAnalytics();
    }catch(e){console.warn("v6.8 initialization",e)}
  })();
})();
