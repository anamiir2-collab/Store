/* Demo grocery store dataset. Seeded once only when the local database is empty. */
const DemoData = (() => {
  const catalog = [
    ["أرز الضحى 1 كجم","حبوب",28,34,"كيس"],["أرز بلدي 1 كجم","حبوب",24,30,"كيس"],["مكرونة قلم 400 جم","مكرونة",10,14,"كيس"],["مكرونة اسباجتي 400 جم","مكرونة",10,14,"كيس"],["دقيق فاخر 1 كجم","حبوب",25,31,"كيس"],
    ["سكر أبيض 1 كجم","أساسيات",30,36,"كيس"],["ملح طعام 700 جم","أساسيات",5,8,"كيس"],["شاي العروسة 40 جم","مشروبات",15,20,"علبة"],["شاي ليبتون 100 فتلة","مشروبات",75,89,"علبة"],["قهوة سريعة 2 في 1","مشروبات",4,6,"ظرف"],
    ["زيت عباد الشمس 1 لتر","زيوت",65,78,"زجاجة"],["زيت خليط 700 مل","زيوت",48,59,"زجاجة"],["سمنة نباتي 700 جم","زيوت",68,82,"علبة"],["خل أبيض 1 لتر","معلبات",12,17,"زجاجة"],["صلصة طماطم 300 جم","معلبات",14,19,"علبة"],
    ["فول مدمس 400 جم","معلبات",18,24,"علبة"],["تونة مفتتة 140 جم","معلبات",32,40,"علبة"],["جبنة مطبوخة 8 قطع","ألبان",27,34,"علبة"],["جبنة بيضاء 500 جم","ألبان",38,47,"علبة"],["لبن كامل الدسم 1 لتر","ألبان",38,45,"عبوة"],
    ["زبادي سادة","ألبان",6,9,"علبة"],["بيض أبيض 10 قطع","ألبان",58,68,"عبوة"],["بسكويت سادة","بسكويت",4,6,"قطعة"],["بسكويت ويفر شوكولاتة","بسكويت",5,8,"قطعة"],["كيك مغلف","حلويات",7,10,"قطعة"],
    ["شيبسي ملح وخل","تسالي",5,8,"كيس"],["شيبسي جبنة","تسالي",5,8,"كيس"],["فشار ميكروويف","تسالي",22,29,"كيس"],["شوكولاتة صغيرة","حلويات",8,12,"قطعة"],["لبان نعناع","حلويات",2,3,"قطعة"],
    ["مياه معدنية 1.5 لتر","مشروبات",8,12,"زجاجة"],["مياه معدنية 600 مل","مشروبات",4,6,"زجاجة"],["عصير مانجو 1 لتر","مشروبات",25,32,"عبوة"],["عصير برتقال 250 مل","مشروبات",7,10,"عبوة"],["مشروب غازي 1 لتر","مشروبات",18,24,"زجاجة"],
    ["مشروب غازي 330 مل","مشروبات",9,13,"علبة"],["قهوة تركي 100 جم","مشروبات",55,68,"عبوة"],["نسكافيه 50 جم","مشروبات",65,78,"برطمان"],["كاكاو بودرة 100 جم","مشروبات",35,44,"عبوة"],["كريمة طبخ 200 مل","ألبان",28,36,"عبوة"],
    ["منظف أرضيات 1 لتر","منظفات",35,45,"زجاجة"],["سائل أطباق 600 مل","منظفات",24,32,"زجاجة"],["مسحوق غسيل 1 كجم","منظفات",58,72,"كيس"],["كلور 1 لتر","منظفات",18,25,"زجاجة"],["معطر جو","منظفات",42,55,"عبوة"],
    ["صابون تواليت","عناية شخصية",9,13,"قطعة"],["شامبو صغير","عناية شخصية",18,25,"زجاجة"],["معجون أسنان","عناية شخصية",25,34,"عبوة"],["فرشاة أسنان","عناية شخصية",15,22,"قطعة"],["مناديل وجه 200 منديل","ورقيات",28,36,"علبة"],
    ["مناديل جيب","ورقيات",4,6,"عبوة"],["ورق تواليت 4 لفات","ورقيات",32,42,"عبوة"],["أكياس قمامة","منظفات",18,25,"لفة"],["إسفنجة أطباق","منظفات",5,8,"قطعة"],["سلك مواعين","منظفات",6,9,"قطعة"],
    ["عدس أصفر 500 جم","بقوليات",28,35,"كيس"],["فول مدشوش 500 جم","بقوليات",22,29,"كيس"],["فاصوليا بيضاء 500 جم","بقوليات",35,44,"كيس"],["حمص 500 جم","بقوليات",32,40,"كيس"],["لوبيا 500 جم","بقوليات",30,38,"كيس"],
    ["كمون مطحون 50 جم","توابل",12,17,"عبوة"],["فلفل أسود 50 جم","توابل",18,25,"عبوة"],["كركم 50 جم","توابل",10,15,"عبوة"],["شطة 50 جم","توابل",9,14,"عبوة"],["بهارات مشكلة 50 جم","توابل",14,20,"عبوة"],
    ["خميرة فورية","مخبوزات",7,10,"ظرف"],["بيكنج بودر","مخبوزات",5,8,"ظرف"],["فانيليا","مخبوزات",3,5,"ظرف"],["عسل أسود 350 جم","معلبات",25,33,"برطمان"],["مربى فراولة 350 جم","معلبات",38,48,"برطمان"],
    ["حلاوة طحينية 250 جم","حلويات",32,42,"علبة"],["طحينة 250 جم","أساسيات",28,37,"برطمان"],["دبس رمان صغير","معلبات",35,45,"زجاجة"],["ذرة حلوة 340 جم","معلبات",25,33,"علبة"],["بسلة وجزر 400 جم","معلبات",22,30,"علبة"],
    ["لانشون 250 جم","ألبان",35,45,"عبوة"],["موتزاريلا مبشورة 200 جم","ألبان",48,60,"عبوة"],["قشطة 170 جم","ألبان",20,27,"علبة"],["لبن بودرة 250 جم","ألبان",65,79,"عبوة"],["زبدة 100 جم","ألبان",25,33,"عبوة"],
    ["عيش توست","مخبوزات",28,36,"كيس"],["بقسماط مطحون 250 جم","مخبوزات",18,25,"كيس"],["كورن فليكس 250 جم","حبوب",42,54,"علبة"],["شوفان 500 جم","حبوب",38,48,"كيس"],["ذرة فشار 500 جم","حبوب",20,28,"كيس"],
    ["مخلل خيار 500 جم","معلبات",22,30,"برطمان"],["زيتون أخضر 350 جم","معلبات",32,42,"برطمان"],["ليمون معصفر 500 جم","معلبات",25,34,"برطمان"],["كاتشب 340 جم","معلبات",22,29,"زجاجة"],["مايونيز 250 جم","معلبات",35,45,"برطمان"],
    ["منظف زجاج 500 مل","منظفات",28,37,"زجاجة"],["مطهر متعدد الاستخدام","منظفات",32,42,"زجاجة"],["مناديل مطبخ","ورقيات",22,30,"لفة"],["فويل ألومنيوم","أدوات منزلية",28,38,"لفة"],["استرتش تغليف","أدوات منزلية",22,30,"لفة"],
    ["ولاعة","أدوات منزلية",8,12,"قطعة"],["بطاريات AA قطعتين","أدوات منزلية",25,34,"عبوة"],["كيس ساندوتش","أدوات منزلية",12,18,"عبوة"],["أكواب بلاستيك","أدوات منزلية",18,25,"عبوة"],["أطباق فوم","أدوات منزلية",20,28,"عبوة"],
    ["شمع أبيض","أدوات منزلية",5,8,"قطعة"],["مياه غازية","مشروبات",12,17,"زجاجة"],["عصير جوافة 1 لتر","مشروبات",24,31,"عبوة"],["لبن رايب 1 لتر","ألبان",30,38,"عبوة"],["قشطة طبخ 200 مل","ألبان",25,33,"عبوة"]
  ];

  const customerNames = ["محمد أحمد","محمود علي","أحمد حسن","سارة محمد","منى إبراهيم","خالد محمود","مصطفى السيد","أسماء عادل","إبراهيم فتحي","نورهان سمير","حسن عبد الله","علي رجب"];
  const supplierNames = ["شركة النيل للمواد الغذائية","مؤسسة البركة للتجارة","مخازن الأمانة","توزيع القاهرة","شركة الصفوة","تجار الجملة الحديثة","مؤسسة الخير","مخازن الفجر"];
  const uid = (prefix, n) => "demo-" + prefix + "-" + String(n).padStart(4,"0");
  const isoDaysAgo = n => { const d = new Date(); d.setDate(d.getDate()-n); d.setHours(10+(n%9), (n*7)%60, 0, 0); return d.toISOString(); };

  async function seedIfEmpty() {
    const settings = await DB.getSettings();
    if (settings.demoDataLoaded) return false;
    // Do not overwrite user records. Demo rows use their own IDs and can coexist with real data.
    const [existingProducts, existingInvoices] = await Promise.all([DB.getAll("products"), DB.getAll("invoices")]);
    if (existingProducts.some(p => String(p.id).startsWith("demo-product-")) || existingInvoices.some(i => String(i.id).startsWith("demo-invoice-"))) {
      await DB.saveSetting("demoDataLoaded", true);
      return false;
    }

    const suppliers = supplierNames.map((name,i)=>({id:uid("supplier",i+1),name,phone:"010"+String(10000000+i*13791).slice(0,8),address:"القاهرة - مصر",balance:0,totalPurchases:0,totalPaid:0,notes:"مورد تجريبي"}));
    const customers = customerNames.map((name,i)=>({id:uid("customer",i+1),name,phone:"011"+String(20000000+i*11371).slice(0,8),address:"القاهرة - مصر",balance:0,totalPurchases:0,totalPaid:0,notes:"عميل تجريبي"}));
    const products = catalog.slice(0,100).map((r,i)=>({
      id:uid("product",i+1),sku:"GROC-"+String(i+1).padStart(4,"0"),barcode:"622"+String(100000000+i).slice(-9),
      name:r[0],category:r[1],purchasePrice:r[2],sellingPrice:r[3],quantity:35+(i*17)%75,minStock:5+(i%5),
      unit:r[4],expirationDate:(()=>{const d=new Date();d.setDate(d.getDate()+35+(i*13)%300);return d.toISOString().slice(0,10)})(),
      supplierId:uid("supplier",(i%8)+1),notes:"بيانات تجريبية لمحل بقالة",costMethod:"weighted",archived:false,createdAt:isoDaysAgo(90),updatedAt:isoDaysAgo(0)
    }));

    const invoiceRows=[], itemRows=[], paymentRows=[], movements=[];
    products.forEach(p=>movements.push({id:uid("move-open",Number(p.sku.slice(-4))),productId:p.id,date:isoDaysAgo(90),type:"opening",qtyBefore:0,qtyChange:p.quantity,qtyAfter:p.quantity,reason:"رصيد افتتاحي تجريبي",source:"demo",ref:null,unitCost:p.purchasePrice,notes:""}));
    for(let n=1;n<=50;n++){
      const date=isoDaysAgo((n*3)%50);
      const customerIndex=(n*7)%customers.length;
      const customer=customers[customerIndex];
      const lineCount=2+(n%3);
      const chosen=[];
      for(let j=0;j<lineCount;j++){
        const pi=(n*11+j*17+(n%7))%products.length;
        if(!chosen.includes(pi))chosen.push(pi);
      }
      let subtotal=0;
      const snap=[];
      chosen.forEach((pi,j)=>{
        const p=products[pi], qty=1+((n+j*2)%4), unitPrice=p.sellingPrice;
        const lineTotal=qty*unitPrice;
        subtotal+=lineTotal;
        p.quantity=Math.max(0,p.quantity-qty);
        const item={id:uid("item",n*10+j+1),invoiceId:uid("invoice",n),productId:p.id,name:p.name,sku:p.sku,unit:p.unit,quantity:qty,unitPrice,cost:p.purchasePrice,discount:0,tax:0,total:lineTotal};
        snap.push(item);itemRows.push(item);
        movements.push({id:uid("move-sale",n*10+j+1),productId:p.id,date,type:"sale",qtyBefore:p.quantity+qty,qtyChange:-qty,qtyAfter:p.quantity,reason:"بيع تجريبي "+("DEMO-"+String(n).padStart(4,"0")),source:"demo",ref:uid("invoice",n),unitCost:p.purchasePrice,notes:""});
      });
      const discount=n%6===0?Math.round(subtotal*0.03*100)/100:0;
      const total=Math.max(0,subtotal-discount);
      const paid=n%10===0?Math.round(total*0.5*100)/100:(n%13===0?0:total);
      const remaining=Math.max(0,total-paid);
      const number="DEMO-"+String(n).padStart(4,"0");
      const id=uid("invoice",n);
      // Ensure item invoice ids match their parent.
      snap.forEach(it=>{it.invoiceId=id;});
      const method=remaining>0&&paid===0?"credit":["cash","vodafone_cash","instapay","cash","bank"][n%5];
      const invoice={id,number,date,customerId:customer.id,customerName:customer.name,customerPhone:customer.phone,items:snap.map(it=>({...it})),subtotal,lineDiscounts:0,discount,tax:0,total,paid,remaining,change:0,paymentMethod:method,status:remaining>0?(paid>0?"partial":"unpaid"):"paid",notes:"فاتورة تجريبية - بيانات تدريبية فقط",returns:[],returnAmount:0,createdAt:date,updatedAt:date};
      invoiceRows.push(invoice);
      paymentRows.push({id:uid("payment",n),invoiceId:id,customerId:customer.id,date,amount:paid,method,notes:"دفعة تجريبية"});
      customer.totalPurchases+=total;customer.totalPaid+=paid;customer.balance+=remaining;
    }
    // Recompute all stock after the simulated sales; opening movements retain the initial stock.
    const initialProducts=products.map(p=>({...p,quantity:p.quantity}));
    // Opening movements need opening quantities, recovered from the recorded movement trail.
    const openingQty=new Map();
    movements.filter(m=>m.type==="opening").forEach(m=>openingQty.set(m.productId,m.qtyAfter));
    products.forEach(p=>{p.quantity=openingQty.get(p.id)||p.quantity;});
    movements.filter(m=>m.type==="sale").forEach(m=>{const p=products.find(x=>x.id===m.productId);if(p)p.quantity=m.qtyAfter;});
    const finalProducts=products;
    // Keep supplier and customer records consistent with the sample invoices.
    await DB.bulkPut("suppliers",suppliers);
    await DB.bulkPut("customers",customers);
    await DB.bulkPut("products",finalProducts);
    await DB.bulkPut("invoices",invoiceRows);
    await DB.bulkPut("invoiceItems",itemRows);
    await DB.bulkPut("payments",paymentRows);
    await DB.bulkPut("inventoryMoves",movements);
    await DB.saveSetting("demoDataLoaded",true);
    return true;
  }
  return { seedIfEmpty };
})();
