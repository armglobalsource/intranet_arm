import {test,expect,Page} from '@playwright/test';
test.use({baseURL:'http://localhost:3005',channel:'msedge'});
const id='59b904e0-b55a-4363-b3db-dfe43d08f468';
const categoryId='5b7e370e-198c-4d68-8cc2-f47304c6aa22';
const details={summary:'Un tiempo para construir, fortalecer y renovar nuestra vida en Dios.',description:'Nos reunimos para compartir un tiempo de crecimiento, comunidad y propósito.',bannerUrl:'',color:'#102b40',timezone:'America/Santiago',modality:'onsite',location:'Centro de encuentros',address:'Lugar de prueba',registrationOpensAt:null,registrationClosesAt:null,paymentDueAt:null,waitlist:false,minimumAge:18,conditions:'Trae tu identificación.',cancellationPolicy:'Contacta al equipo organizador.',pricing:'free',faqs:[{question:'¿Qué debo llevar?',answer:'Ropa cómoda y tu identificación.'}]};
async function fixture(page:Page,permissions=['*']){
 await page.addInitScript(({permissions})=>localStorage.setItem('auth-storage',JSON.stringify({version:0,state:{user:{id:1,campusId:10,firstName:'Prueba',lastName:'ARM',permissions,role:{name:'user'},status:'active'},accessToken:'fixture',isAuthenticated:true}})),{permissions});
 let event:any={id,version:1,title:'Retiro de Hombres',slug:'retiro-hombres',categoryId,campusId:10,organizerId:1,startsAt:'2027-01-10T12:00:00Z',endsAt:'2027-01-10T21:00:00Z',status:'draft',registrationStatus:'pending',capacity:120,campusIds:[10],details,ticketTypes:[],audit:[]};
 const calls:any[]=[];
 await page.route('**/api/v1/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname.replace('/api/v1','');
  if(path==='/event-management/options')return route.fulfill({json:{categories:[{id:categoryId,name:'Retiros',active:true}],campuses:[{id:10,name:'Santiago',country:'Chile'}],organizers:[{id:1,name:'Prueba ARM'}],access:{global:permissions.includes('*'),campus:permissions.includes('eventos:manageCampus'),assigned:false}}});
  if(path.startsWith('/public-events/'))return route.fulfill({json:{...event,status:'published',campusName:'Santiago',categoryName:'Retiros',campuses:['Santiago'],registrationEnabled:false}});
  if(path==='/event-management'&&req.method()==='GET')return route.fulfill({json:[{...event,campusName:'Santiago',country:'Chile',categoryName:'Retiros',bannerUrl:''}]});
  if((path==='/event-management'||path===`/event-management/${id}`)&&req.method()!=='GET'){const data=req.postDataJSON();calls.push(data);event={...data,id,version:event.version+1};return route.fulfill({json:{id,version:event.version}});}
  if(path===`/event-management/${id}`)return route.fulfill({json:event});
  return route.fulfill({json:[]});
 });
 return calls;
}
test('portada anuncia cuándo abren las inscripciones',async({page})=>{
 await page.route('**/api/v1/public-events/**',route=>route.fulfill({json:{id,version:1,title:'Retiro de Hombres',slug:'retiro-hombres',startsAt:'2027-03-10T12:00:00Z',endsAt:'2027-03-10T21:00:00Z',status:'published',registrationStatus:'open',capacity:120,details:{...details,registrationOpensAt:'2027-02-25T14:28:00Z'},ticketTypes:[],campusName:'Santiago',categoryName:'Retiros',campuses:['Santiago'],registrationEnabled:false}}));
 await page.setViewportSize({width:320,height:852});
 await page.goto('/eventos/retiro-hombres');
 await expect(page.getByText('Inscripciones desde el 25 de febrero, 11:28 hrs',{exact:true}).first()).toBeVisible();
 await expect(page.getByText('Vuelve el 25 de febrero, 11:28 hrs (hora de Santiago) para reservar tu cupo.')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const width of [320,393,834,1440])test(`portada y editor sin desbordes ${width}`,async({page})=>{
 await fixture(page);await page.setViewportSize({width,height:852});
 await page.goto('/eventos/retiro-hombres');await expect(page.getByRole('heading',{name:'Retiro de Hombres',exact:true})).toBeVisible();
 await expect(page.getByText('Inscripciones próximamente',{exact:true}).first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-public-${width}.png`,fullPage:true});
 await page.goto(`/dashboard/eventos/${id}`);await expect(page.getByLabel('Nombre del evento *',{exact:true})).toHaveValue('Retiro de Hombres');
 for(const name of ['Lo esencial','Portada y contenido','Inscripción y entradas','Revisar y publicar']){
  await page.getByRole('tab',{name:new RegExp(name)}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('main').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 }
 await page.getByRole('tab',{name:/Lo esencial/}).click();await page.locator('main').evaluate(e=>e.scrollTo(0,0));
 await page.screenshot({path:`test-results/event-editor-${width}.png`,fullPage:true});
});
test('edición, publicación y persistencia del payload',async({page})=>{
 const calls=await fixture(page);await page.goto(`/dashboard/eventos/${id}`);
 await page.getByLabel('Nombre del evento *',{exact:true}).fill('Retiro actualizado');
 await page.getByRole('tab',{name:/Revisar y publicar/}).click();await page.getByLabel('Estado del evento',{exact:true}).selectOption('published');
 await page.getByRole('button',{name:'Guardar y publicar',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Cambios guardados');
 expect(calls[0]).toMatchObject({title:'Retiro actualizado',status:'published',version:1});expect(calls[0].audit).toBeUndefined();expect(calls[0].id).toBeUndefined();
});
test('gestor de campus ve Eventos y no la configuración global',async({page})=>{
 await fixture(page,['eventos:manageCampus']);await page.setViewportSize({width:1440,height:900});await page.goto('/dashboard/eventos');
 await expect(page.getByRole('heading',{name:'Todos tus eventos, en un solo lugar'})).toBeVisible();await expect(page.getByRole('link',{name:'Categorías',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Crear evento',exact:true})).toBeVisible();
});
test('cuenta sin permisos no carga administración',async({page})=>{
 await fixture(page,[]);await page.goto('/dashboard/eventos');await expect(page.getByText(/No tienes permisos para administrar eventos/)).toBeVisible();await expect(page.getByRole('link',{name:'Crear evento',exact:true})).toHaveCount(0);
});

const receiptOf=(status:string,o:{amount?:number;tickets?:{name:string;ticketName:string;amount:number}[];testPayment?:boolean;discount?:number;code?:string|null}={})=>{
 const tickets=(o.tickets??[{name:'Prueba ARM',ticketName:'General',amount:o.amount??1000}]).map((t,i)=>({id:i?`${id.slice(0,-1)}${i}`:id,status,code:status==='confirmed'?(i?`${id.slice(0,-1)}${i}`:id):null,...t}));
 const amount=o.amount??tickets.reduce((s,t)=>s+t.amount,0);
 return {id,token:'b'.repeat(64),status,buyerName:'Prueba ARM',title:'Encuentro de prueba',startsAt:'2027-01-10T12:00:00Z',timezone:'America/Santiago',testPayment:!!o.testPayment,subtotal:amount+(o.discount??0),discount:o.discount??0,amount,currency:'CLP',code:o.code??null,summary:null,expiresAt:'2027-01-09T12:00:00Z',emailSent:true,tickets};
};
for(const mode of ['free','test','production'])test(`inscripción móvil ${mode}`,async({page})=>{
 const paid=mode!=='free';
 await page.setViewportSize({width:393,height:852});
 const captured:any[]=[];
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/registrations')){captured.push(route.request().postDataJSON());return route.fulfill({json:receiptOf(paid?'pending_payment':'confirmed',{amount:paid?1000:0})});}
  if(path.endsWith('/status'))return route.fulfill({json:receiptOf(paid?'pending_payment':'confirmed',{amount:paid?1000:0,testPayment:mode==='test'})});
  return route.fulfill({json:{title:'Encuentro de prueba',slug:'prueba',startsAt:'2027-01-10T12:00:00Z',endsAt:'2027-01-10T21:00:00Z',status:'published',registrationStatus:'open',paymentMode:mode,capacity:100,capacityLeft:100,details:{...details,pricing:paid?'paid':'free'},campusName:'Santiago',campuses:['Santiago'],campusOptions:[{id:10,name:'Santiago'}],ticketTypes:paid?[{id:categoryId,name:'General',price:1000,currency:'CLP',maxPerOrder:10,remaining:null,sale:'on'}]:[],registrationEnabled:true}});
 });
 await page.goto('/eventos/prueba');await page.getByRole('link',{name:'Inscribirme ahora'}).first().click();
 await expect(page.getByLabel(paid?'Cantidad de General':'Cantidad de Entrada gratuita')).toHaveText('1');
 await page.getByLabel('Nombre',{exact:true}).fill('Prueba');await page.getByLabel('Apellido',{exact:true}).fill('ARM');await page.getByLabel('Correo electrónico',{exact:true}).fill('prueba@example.com');
 await page.getByLabel('Edad (entrada 1)').fill('30');
 await page.getByLabel('Teléfono / WhatsApp').fill('+56912345678');await page.getByLabel('Campus',{exact:true}).selectOption('10');
 await expect(page.getByRole('checkbox',{name:'Esta entrada es para mí'})).toBeChecked();
 await page.getByRole('checkbox',{name:/Acepto las condiciones/}).check();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-registration-${mode}-393.png`,fullPage:true});
 await page.getByRole('button',{name:paid?/^Continuar al pago/:'Confirmar mi inscripción'}).click();
 await expect(page.getByRole('heading',{name:paid?'Último paso: paga tu entrada':'¡Tu entrada está lista!',exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/event-receipt-${mode}-393.png`,fullPage:true});
 expect(captured[0]).toMatchObject({campusId:10,consent:true,firstName:'Prueba',items:[{firstName:'Prueba',lastName:'ARM',age:30,...(paid?{ticketTypeId:categoryId}:{})}]});expect(captured[0].amount).toBeUndefined();
 if(paid){await expect(page.getByRole('article',{name:'Tu entrada'})).toHaveCount(0);await expect(page.getByRole('button',{name:mode==='test'?'Pagar con Mercado Pago · Prueba':'Pagar con Mercado Pago',exact:true})).toBeVisible();if(mode==='production')await expect(page.getByText('Modo de prueba · No utilices tarjetas ni cuentas reales.')).toHaveCount(0);}else await expect(page.getByRole('button',{name:'Imprimir / Guardar PDF'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const width of [393,1280])test(`regreso desde Mercado Pago confirma la entrada ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 let checks=0;
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/status')){checks++;return route.fulfill({json:receiptOf(checks<3?'pending_payment':'confirmed')});}
  return route.fulfill({json:{title:'Encuentro de prueba',slug:'prueba',startsAt:'2027-01-10T12:00:00Z',endsAt:'2027-01-10T21:00:00Z',status:'published',registrationStatus:'open',paymentMode:'production',capacity:100,details:{...details,pricing:'paid'},campusName:'Santiago',campuses:['Santiago'],ticketTypes:[{id:categoryId,name:'General',price:1000,currency:'CLP'}],registrationEnabled:true}});
 });
 await page.goto(`/eventos/prueba/inscripcion?collection_status=approved&payment_id=123#id=${id}&token=${'b'.repeat(64)}`);
 await expect(page.getByRole('heading',{name:'Estamos confirmando tu pago'})).toBeVisible();
 await page.screenshot({path:`test-results/event-receipt-checking-${width}.png`,fullPage:true});
 await expect(page.getByRole('heading',{name:'¡Tu entrada está lista!'})).toBeVisible({timeout:15000});
 await expect(page.getByRole('article',{name:'Tu entrada'})).toContainText('General');
 await expect(page.getByAltText('Código QR de tu entrada')).toBeVisible();
 expect(page.url()).not.toContain('collection_status');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-receipt-confirmed-${width}.png`,fullPage:true});
});

// Fase 2: compra familiar con cantidades, código de descuento, entrada oculta y preguntas.
const GENERAL='a1b2c3d4-0000-4000-8000-000000000001',KIDS='a1b2c3d4-0000-4000-8000-000000000002',STAFF='a1b2c3d4-0000-4000-8000-000000000003';
const familyEvent={title:'Retiro de Familias',slug:'familias',startsAt:'2027-01-10T12:00:00Z',endsAt:'2027-01-10T21:00:00Z',status:'published',registrationStatus:'open',paymentMode:'production',capacity:100,capacityLeft:40,codesEnabled:true,
 details:{...details,pricing:'paid',minimumAge:null,questions:[{id:'talla',label:'Talla de polera',type:'select',options:['S','M','L'],required:true},{id:'alergia',label:'Alergias',type:'text',required:false}]},
 campusName:'Santiago',campuses:['Santiago'],campusOptions:[{id:10,name:'Santiago'}],registrationEnabled:true,
 ticketTypes:[{id:GENERAL,name:'General',description:'Incluye almuerzo',price:10000,currency:'CLP',maxPerOrder:4,remaining:5,sale:'on'},{id:KIDS,name:'Niños',description:'Hasta 12 años',price:0,currency:'CLP',maxPerOrder:10,remaining:null,sale:'on'},{id:'a1b2c3d4-0000-4000-8000-000000000009',name:'Preventa',price:8000,currency:'CLP',maxPerOrder:4,remaining:0,soldOut:true,sale:'on'}]};
for(const width of [393,1280])test(`compra familiar con código y preguntas ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const captured:any[]=[];
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/code')){const code=route.request().postDataJSON().code.toUpperCase();if(code!=='FAMILIA')return route.fulfill({status:400,json:{message:'El código no es válido para este evento.'}});return route.fulfill({json:{code:'FAMILIA',kind:'percent',value:25,ticketTypeIds:[GENERAL],unlockedTickets:[]}});}
  if(path.endsWith('/registrations')){captured.push(route.request().postDataJSON());return route.fulfill({json:receiptOf('pending_payment')});}
  if(path.endsWith('/status'))return route.fulfill({json:receiptOf('pending_payment',{discount:5000,code:'FAMILIA',tickets:[{name:'Prueba ARM',ticketName:'General',amount:7500},{name:'Ana ARM',ticketName:'General',amount:7500},{name:'Tomás ARM',ticketName:'Niños',amount:0}]})});
  return route.fulfill({json:familyEvent});
 });
 await page.goto('/eventos/familias');
 await page.getByRole('link',{name:'Inscribirme ahora'}).first().click();
 await expect(page.getByText('Agotada').first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Agregar una entrada Preventa'})).toBeDisabled();
 await page.getByRole('button',{name:'Agregar una entrada General'}).click();await page.getByRole('button',{name:'Agregar una entrada General'}).click();
 await page.getByRole('button',{name:'Agregar una entrada Niños'}).click();
 await expect(page.getByLabel('Resumen de la compra')).toContainText('2 × General');
 // Un código equivocado se explica; el correcto aplica el descuento solo a General.
 await page.getByRole('button',{name:'¿Tienes un código?'}).click();
 await page.getByLabel('Código',{exact:true}).fill('otro');await page.getByRole('button',{name:'Aplicar'}).click();
 await expect(page.getByText('El código no es válido para este evento.')).toBeVisible();
 await page.getByLabel('Código',{exact:true}).fill('familia');await page.getByRole('button',{name:'Aplicar'}).click();
 await expect(page.getByText('25 % de descuento en General')).toBeVisible();
 await expect(page.getByLabel('Resumen de la compra')).toContainText('−$5.000');
 await expect(page.getByRole('button',{name:/Continuar al pago · \$15\.000/})).toBeVisible();
 // Quien compra y cada asistente.
 await page.getByLabel('Nombre',{exact:true}).fill('Prueba');await page.getByLabel('Apellido',{exact:true}).fill('ARM');await page.getByLabel('Correo electrónico',{exact:true}).fill('prueba@example.com');
 await page.getByLabel('Teléfono / WhatsApp').fill('+56912345678');
 await page.getByLabel('Talla de polera (entrada 1)').selectOption('M');
 await page.getByLabel('Nombre (entrada 2)').fill('Ana');await page.getByLabel('Apellido (entrada 2)').fill('ARM');await page.getByLabel('Talla de polera (entrada 2)').selectOption('S');
 await page.getByLabel('Nombre (entrada 3)').fill('Tomás');await page.getByLabel('Apellido (entrada 3)').fill('ARM');await page.getByLabel('Talla de polera (entrada 3)').selectOption('S');await page.getByLabel('Alergias (entrada 3)').fill('Maní');
 await page.getByRole('checkbox',{name:/Acepto las condiciones/}).check();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-family-form-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:/Continuar al pago/}).click();
 await expect(page.getByRole('heading',{name:'Último paso: paga tus entradas'})).toBeVisible();
 expect(captured[0]).toMatchObject({firstName:'Prueba',email:'prueba@example.com',campusId:10,code:'FAMILIA',items:[
  {ticketTypeId:GENERAL,firstName:'Prueba',lastName:'ARM',answers:{talla:'M'}},
  {ticketTypeId:GENERAL,firstName:'Ana',lastName:'ARM',answers:{talla:'S'}},
  {ticketTypeId:KIDS,firstName:'Tomás',lastName:'ARM',answers:{talla:'S',alergia:'Maní'}},
 ]});
 await expect(page.getByText('Incluye $5.000 de descuento con el código FAMILIA.')).toBeVisible();
 await expect(page.getByText('Tomás ARM').first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-family-receipt-${width}.png`,fullPage:true});
});
test('entrada oculta: aparece al ingresar su código',async({page})=>{
 await page.setViewportSize({width:393,height:852});
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/code'))return route.fulfill({json:{code:'EQUIPO',kind:'percent',value:0,ticketTypeIds:[STAFF],unlockedTickets:[{id:STAFF,name:'Equipo de servicio',price:0,currency:'CLP',maxPerOrder:1,remaining:null,sale:'on'}]}});
  return route.fulfill({json:{...familyEvent,ticketTypes:familyEvent.ticketTypes.slice(0,1)}});
 });
 await page.goto('/eventos/familias');await page.getByRole('link',{name:'Inscribirme ahora'}).first().click();
 await expect(page.getByText('Equipo de servicio')).toHaveCount(0);
 await page.getByRole('button',{name:'¿Tienes un código?'}).click();
 await page.getByLabel('Código',{exact:true}).fill('equipo');await page.keyboard.press('Enter');
 await expect(page.getByText('desbloquea «Equipo de servicio»')).toBeVisible();
 await expect(page.getByLabel('Cantidad de Equipo de servicio')).toBeVisible();
 await page.getByRole('button',{name:'Quitar',exact:true}).click();
 await expect(page.getByText('Equipo de servicio')).toHaveCount(0);
});
test('comprobante con varias entradas: una entrada con QR por asistente',async({page})=>{
 await page.setViewportSize({width:393,height:852});
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/status'))return route.fulfill({json:receiptOf('confirmed',{tickets:[{name:'Prueba ARM',ticketName:'General',amount:10000},{name:'Tomás ARM',ticketName:'Niños',amount:0}]})});
  return route.fulfill({json:familyEvent});
 });
 await page.goto(`/eventos/familias/inscripcion#id=${id}&token=${'b'.repeat(64)}`);
 await expect(page.getByRole('heading',{name:'¡Tus entradas están listas!'})).toBeVisible();
 await expect(page.getByRole('article',{name:'Entrada de Tomás ARM'})).toContainText('Niños');
 await expect(page.getByAltText('Código QR de tu entrada')).toHaveCount(2);
 await page.screenshot({path:'test-results/event-family-tickets-393.png',fullPage:true});
});

test('crear evento: enlace automático, pasos guiados y vista previa en vivo',async({page})=>{
 await fixture(page);await page.setViewportSize({width:1440,height:900});await page.goto('/dashboard/eventos/nuevo');
 await page.getByLabel('Nombre del evento *',{exact:true}).fill('Retiro de Hombres 2027');
 await expect(page.getByLabel('Enlace público *',{exact:true})).toHaveValue('retiro-de-hombres-2027');
 const live=page.getByRole('complementary',{name:'Vista previa en vivo'});
 await expect(live.getByRole('heading',{name:'Retiro de Hombres 2027'})).toBeVisible();
 await expect(live).toContainText('ecosistema.armglobal.org/eventos/retiro-de-hombres-2027');
 await page.getByRole('radio',{name:/Online/}).click();
 await expect(page.getByLabel('Lugar *')).toHaveCount(0);
 await page.getByRole('button',{name:/Siguiente: Portada y contenido/}).click();
 await page.getByRole('radio',{name:'Terracota'}).click();
 await page.getByRole('tab',{name:/Revisar y publicar/}).click();
 await expect(page.getByText(/Faltan \d+ de \d+ puntos/)).toBeVisible();
 await page.screenshot({path:'test-results/event-editor-nuevo-1440.png',fullPage:true});
});

test('portada: sube la imagen desde el equipo y se ve en la vista previa',async({page})=>{
 await fixture(page);await page.setViewportSize({width:1440,height:900});
 // PNG de 1×1 px.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=','base64');
 const cover='https://cdn.example.test/event-covers/portada.jpg';
 const seen:{ticket?:any;put?:boolean;complete?:any}={};
 await page.route('**/api/v1/uploads/ticket',r=>{seen.ticket=r.request().postDataJSON();return r.fulfill({json:{signedUrl:'https://storage.example.test/upload',ticket:'ticket-1'}});});
 await page.route('https://storage.example.test/upload',r=>{seen.put=r.request().method()==='PUT';return r.fulfill({status:200,json:{}});});
 await page.route('**/api/v1/uploads/event-cover/complete',r=>{seen.complete=r.request().postDataJSON();return r.fulfill({json:{url:cover}});});
 await page.route(cover,r=>r.fulfill({body:png,contentType:'image/png'}));
 await page.goto(`/dashboard/eventos/${id}`);
 await page.getByRole('tab',{name:/Portada y contenido/}).click();
 await page.getByLabel('Subir imagen de portada').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:png});
 await expect(page.getByAltText('Imagen de portada actual')).toHaveAttribute('src',cover);
 expect(seen.ticket).toMatchObject({purpose:'event-cover',contentType:'image/jpeg'});
 expect(seen.put).toBe(true);
 expect(seen.complete).toEqual({ticket:'ticket-1'});
 await expect(page.getByRole('complementary',{name:'Vista previa en vivo'}).locator(`img[src="${cover}"]`)).toHaveCount(1);
 await page.screenshot({path:'test-results/event-cover-upload-1440.png'});
});

// Día del evento: inscritos y control de acceso con una API simulada que guarda el estado.
const people=[
 {id:'3520053e-72a6-48c2-b38a-e077bda942bc',firstName:'Ana',lastName:'Pérez',email:'ana@example.com',phone:'+56911111111',age:30,campusId:10,campusName:'Santiago',ticketName:'General',status:'pending_payment',amount:100,currency:'CLP',paymentId:null,testPayment:false,source:'public',note:null,createdAt:'2026-11-23T13:20:08Z',checkedInAt:null,checkedInBy:null,emailSent:true},
 {id:'4cf1c2a8-0d5e-4f7e-9a51-6a1b2c3d4e5f',firstName:'José',lastName:'Muñoz',email:'jose@example.com',phone:'+56922222222',age:41,campusId:10,campusName:'Santiago',ticketName:'General',status:'confirmed',amount:100,currency:'CLP',paymentId:'987654',testPayment:false,source:'public',note:null,createdAt:'2026-11-22T10:00:00Z',checkedInAt:null,checkedInBy:null,emailSent:true},
 {id:'7d9e8f10-1a2b-4c3d-8e4f-5a6b7c8d9e0f',firstName:'Marta',lastName:'Díaz',email:'marta@example.com',phone:'',age:null,campusId:20,campusName:'Viña del Mar',ticketName:'General',status:'waitlisted',amount:100,currency:'CLP',paymentId:null,testPayment:false,source:'public',note:null,createdAt:'2026-11-21T10:00:00Z',checkedInAt:null,checkedInBy:null,emailSent:true},
];
async function attendance(page:Page,permissions=['*'],manage=true){
 await fixture(page,permissions);
 const regs:any[]=people.map(p=>({...p}));const calls:{path:string;body:any}[]=[];
 const counts=()=>({confirmed:regs.filter(r=>r.status==='confirmed').length,checkedIn:regs.filter(r=>r.status==='confirmed'&&r.checkedInAt).length});
 await page.route(/\/api\/v1\/(event-management\/[^/]+\/(attendees|check-in|registrations.*)|event-door\/events)$/,async route=>{
  const req=route.request(),path=new URL(req.url()).pathname.replace('/api/v1','');const body=req.method()==='POST'?req.postDataJSON():null;calls.push({path,body});
  if(path==='/event-door/events')return route.fulfill({json:[{id,slug:'retiro-hombres',title:'Retiro de Hombres',startsAt:new Date(Date.now()-3600_000).toISOString(),endsAt:new Date(Date.now()+3600_000).toISOString(),capacity:120,campusName:'Santiago',timezone:'America/Santiago',confirmed:counts().confirmed,checkedIn:counts().checkedIn}]});
  if(path.endsWith('/attendees'))return route.fulfill({json:{event:{id,slug:'retiro-hombres',title:'Retiro de Hombres',status:'published',startsAt:'2027-01-10T12:00:00Z',endsAt:'2027-01-10T21:00:00Z',capacity:120,timezone:'America/Santiago',pricing:'paid',color:'#102b40',tickets:[{id:categoryId,name:'General',price:100,currency:'CLP'}],campuses:[{id:10,name:'Santiago'},{id:20,name:'Viña del Mar'}]},manage,registrations:regs}});
  if(path.endsWith('/check-in')){
   const r=regs.find(x=>String(body.code).toLowerCase().includes(x.id));
   if(!r)return route.fulfill({json:{result:'not_found',message:'Esta entrada no corresponde a este evento.',attendee:null,counts:counts()}});
   if(r.status!=='confirmed')return route.fulfill({json:{result:'invalid',message:'El pago de esta entrada no está confirmado.',attendee:r,counts:counts()}});
   if(r.checkedInAt)return route.fulfill({json:{result:'already',message:'Esta entrada ya se usó para ingresar.',attendee:r,counts:counts()}});
   Object.assign(r,{checkedInAt:'2027-01-10T22:42:00Z',checkedInBy:'Prueba ARM'});return route.fulfill({json:{result:'ok',message:`Bienvenida/o, ${r.firstName}.`,attendee:r,counts:counts()}});
  }
  const m=/registrations\/([^/]+)\/([a-z-]+)$/.exec(path);
  if(m){const r=regs.find(x=>x.id===m[1])!;
   if(m[2]==='undo-check-in'){Object.assign(r,{checkedInAt:null,checkedInBy:null});return route.fulfill({json:{attendee:r,counts:counts()}});}
   if(m[2]==='cancel'){r.status='cancelled';return route.fulfill({json:{attendee:r,message:'Inscripción anulada y cupo liberado.'}});}
   if(m[2]==='resend')return route.fulfill({json:{message:`Entrada reenviada a ${r.email}.`}});
   if(m[2]==='verify-payment'){r.status='confirmed';r.paymentId='111';return route.fulfill({json:{status:'confirmed',message:'Pago aprobado verificado con Mercado Pago. La inscripción quedó confirmada.'}});}
  }
  if(path.endsWith('/registrations')){const r={...people[1],id:'9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',firstName:body.firstName,lastName:body.lastName,email:body.email,campusId:body.campusId,campusName:'Viña del Mar',ticketName:'Cortesía',amount:0,paymentId:null,source:'manual',createdBy:'Prueba ARM',note:body.note??null};regs.unshift(r);return route.fulfill({json:{attendee:r,emailSent:body.sendEmail}});}
  return route.fulfill({status:404,json:{message:'No encontrado'}});
 });
 return {regs,calls};
}
for(const width of [393,1280])test(`inscritos: buscar, verificar, marcar ingreso, anular y agregar ${width}`,async({page})=>{
 const {calls}=await attendance(page);await page.setViewportSize({width,height:900});
 await page.goto(`/dashboard/eventos/${id}/inscritos`);
 await expect(page.getByRole('heading',{name:'3 inscripciones'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-attendees-${width}.png`,fullPage:true});
 // Verificar el pago pendiente con Mercado Pago lo confirma.
 await page.getByRole('button',{name:'Verificar pago'}).click();
 await expect(page.getByRole('status').filter({hasText:'La inscripción quedó confirmada.'})).toBeVisible();
 // Buscar sin tildes y marcar ingreso.
 await page.getByPlaceholder('Buscar por nombre, correo, teléfono o código').fill('jose munoz');
 await expect(page.getByText('1 de 3 personas')).toBeVisible();
 await page.getByRole('button',{name:'Marcar ingreso'}).click();
 await expect(page.getByText('Ingreso registrado.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Deshacer'})).toBeVisible();
 // Anular pide confirmación en la misma fila.
 await page.getByRole('button',{name:'Anular'}).click();
 await page.getByRole('button',{name:'Sí, anular'}).click();
 await expect(page.getByText('Inscripción anulada y cupo liberado.')).toBeVisible();
 await page.getByPlaceholder('Buscar por nombre, correo, teléfono o código').fill('');
 // Agregar una cortesía.
 await page.getByRole('button',{name:'Agregar persona'}).click();
 const dialog=page.getByRole('dialog',{name:'Agregar persona'});
 await dialog.getByLabel('Nombre',{exact:true}).fill('Luis');await dialog.getByLabel('Apellido').fill('Soto');
 await dialog.getByLabel('Correo electrónico').fill('luis@example.com');await dialog.getByLabel('Campus').selectOption('20');
 await dialog.getByLabel(/Nota interna/).fill('Equipo de alabanza');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-add-person-${width}.png`});
 await dialog.getByRole('button',{name:'Agregar persona'}).click();
 await expect(page.getByText('Luis Soto quedó inscrita/o con entrada confirmada. Le enviamos la entrada a luis@example.com.')).toBeVisible();
 expect(calls.find(c=>c.path.endsWith('/registrations'))?.body).toEqual({firstName:'Luis',lastName:'Soto',email:'luis@example.com',campusId:20,sendEmail:true,note:'Equipo de alabanza'});
 // Descarga a Excel.
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Excel'}).click();
 expect((await download).suggestedFilename()).toBe('inscritos-retiro-de-hombres.xlsx');
});
test('puerta: busca por nombre, registra el ingreso y rechaza entradas no válidas',async({page})=>{
 await attendance(page);await page.setViewportSize({width:393,height:852});
 await page.goto('/dashboard/eventos/acceso');
 await page.getByRole('link',{name:'Abrir control de acceso'}).click();
 await expect(page.getByText('de 1 ingresaron')).toBeVisible();
 await expect(page.getByRole('button',{name:'Activar cámara'})).toBeVisible();
 await page.screenshot({path:'test-results/event-door-scan-393.png',fullPage:true});
 // Código escrito a mano de una entrada sin pago.
 await page.getByLabel('Código de la entrada').fill(people[0].id);await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'No puede entrar'})).toBeVisible();
 await expect(page.getByText('El pago de esta entrada no está confirmado.')).toBeVisible();
 await page.screenshot({path:'test-results/event-door-denied-393.png'});
 await page.getByRole('button',{name:'Siguiente'}).click();
 // Búsqueda por nombre.
 await page.getByRole('tab',{name:'Buscar por nombre'}).click();
 await page.getByPlaceholder('Nombre, correo o código de la entrada').fill('jose');
 await page.getByRole('button',{name:'Marcar ingreso'}).click();
 await expect(page.getByRole('heading',{name:'Puede entrar'})).toBeVisible();
 await expect(page.getByText('de 1 ingresaron · 100%')).toBeVisible();
 await page.screenshot({path:'test-results/event-door-ok-393.png',fullPage:true});
 // La misma entrada otra vez avisa que ya ingresó.
 await page.getByRole('button',{name:'Cerrar'}).click();
 await page.getByRole('tab',{name:'Escanear QR'}).click();
 await page.getByLabel('Código de la entrada').fill(`ARM:${people[1].id}`);await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Ya ingresó'})).toBeVisible();
 await expect(page.getByText(/Ingresó a las 19:42/).first()).toBeVisible();
 await expect(page.getByRole('region',{name:'Últimos registros'})).toContainText('José Muñoz');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('quien solo registra ingresos ve la puerta, sin acciones de gestión',async({page})=>{
 await attendance(page,['eventos:checkin'],false);await page.setViewportSize({width:1280,height:900});
 await page.goto('/dashboard/eventos/acceso');
 await expect(page.getByRole('link',{name:'Abrir control de acceso'})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Eventos'}).getByRole('link',{name:'Gestión de eventos'})).toHaveCount(0);
 await page.goto(`/dashboard/eventos/${id}/inscritos`);
 await expect(page.getByRole('heading',{name:'3 inscripciones'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Agregar persona'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Anular'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Marcar ingreso'})).toBeVisible();
});
test('editor: reglas por entrada y preguntas se guardan con el evento',async({page})=>{
 const calls=await fixture(page);await page.setViewportSize({width:1280,height:900});
 await page.goto(`/dashboard/eventos/${id}`);
 await page.getByRole('tab',{name:/Inscripción y entradas/}).click();
 await page.getByRole('radio',{name:/Pagado/}).click();
 const general=page.getByRole('group',{name:'Entrada Entrada general'});
 await general.getByLabel('Valor (CLP)').fill('15000');
 await general.getByLabel('Cupos de esta entrada').fill('80');
 await general.getByLabel('Máximo por compra').selectOption('4');
 await page.getByRole('button',{name:'Agregar tipo de entrada'}).click();
 const second=page.getByRole('group',{name:'Entrada Entrada general'}).nth(1);
 await second.getByLabel('Nombre',{exact:true}).fill('Equipo');
 await page.getByRole('group',{name:'Entrada Equipo'}).getByRole('checkbox',{name:/Entrada oculta/}).check();
 await page.getByRole('button',{name:'Agregar pregunta'}).click();
 const q=page.getByRole('group',{name:'Pregunta 1'});
 await q.getByLabel('Pregunta',{exact:true}).fill('Talla de polera');
 await q.getByLabel('Tipo de respuesta').selectOption('select');
 await q.getByLabel('Opciones').fill('S\nM\n\nL');
 await q.getByRole('checkbox',{name:'Respuesta obligatoria'}).check();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/event-editor-tickets-1280.png',fullPage:true});
 await page.getByRole('button',{name:'Guardar evento'}).click();
 await expect(page.getByRole('status')).toContainText('Cambios guardados');
 expect(calls[0].ticketTypes).toEqual([
  expect.objectContaining({name:'Entrada general',price:15000,capacity:80,maxPerOrder:4}),
  expect.objectContaining({name:'Equipo',price:0,hidden:true}),
 ]);
 expect(calls[0].details.questions).toEqual([expect.objectContaining({label:'Talla de polera',type:'select',options:['S','M','L'],required:true})]);
});
test('códigos: crear un descuento para una entrada y desactivarlo',async({page})=>{
 await fixture(page);await page.setViewportSize({width:393,height:852});
 const codes:any[]=[];const posted:any[]=[];
 await page.route(/\/api\/v1\/event-management\/[^/]+(\/codes.*)?$/,async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path.endsWith('/codes')&&req.method()==='GET')return route.fulfill({json:codes});
  if(path.endsWith('/codes')&&req.method()==='POST'){const b=req.postDataJSON();posted.push(b);codes.push({...b,id:'c1',code:b.code.toUpperCase(),uses:0,given:0});return route.fulfill({json:codes[0]});}
  if(path.includes('/codes/')&&req.method()==='PATCH'){const b=req.postDataJSON();posted.push(b);Object.assign(codes[0],b);return route.fulfill({json:codes[0]});}
  if(req.method()==='GET')return route.fulfill({json:{id,version:1,title:'Retiro de Hombres',slug:'retiro-hombres',details,status:'published',ticketTypes:[{id:'t1',name:'General',price:10000,currency:'CLP'},{id:'t2',name:'Equipo',price:0,currency:'CLP',hidden:true}]}});
  return route.continue();
 });
 await page.goto(`/dashboard/eventos/${id}/codigos`);
 await expect(page.getByRole('heading',{name:'Aún no hay códigos'})).toBeVisible();
 await page.getByRole('button',{name:'Crear código'}).click();
 await page.getByRole('textbox',{name:/^Código/}).fill('familia2027');
 await page.getByLabel('Porcentaje (%)').fill('25');
 await page.getByLabel('Usos máximos').fill('30');
 await page.getByRole('group',{name:'Entradas a las que aplica'}).getByRole('button',{name:'General'}).click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/event-codes-form-393.png',fullPage:true});
 await page.getByRole('button',{name:'Guardar código'}).click();
 await expect(page.getByText('Código FAMILIA2027 guardado.')).toBeVisible();
 expect(posted[0]).toEqual({code:'familia2027',kind:'percent',value:25,maxUses:30,startsAt:null,endsAt:null,ticketTypeIds:['t1'],active:true});
 await expect(page.getByText('25 % de descuento')).toBeVisible();
 await expect(page.getByText('0 de 30 usos')).toBeVisible();
 await page.getByRole('button',{name:'Desactivar'}).click();
 await expect(page.getByText('Código FAMILIA2027 desactivado.')).toBeVisible();
 expect(posted[1].active).toBe(false);
 await page.screenshot({path:'test-results/event-codes-list-393.png',fullPage:true});
});
// Fase 3: autogestión desde el comprobante, «Mis entradas» y catálogo público.
const policy={transfer:true,cancel:true,until:'2027-01-09T12:00:00Z',open:true};
test('comprobante: transferir una entrada y cancelar otra',async({page})=>{
 await page.setViewportSize({width:393,height:852});
 const T2=`${id.slice(0,-1)}1`;let state='two';const calls:any[]=[];
 const receipt=()=>{const r:any=receiptOf('confirmed',{tickets:[{name:'Ana Soto',ticketName:'General',amount:0},{name:state==='transferred'||state==='cancelled'?'Luis Rojas':'Tomás Soto',ticketName:'General',amount:0}]});r.selfService=policy;
  if(state!=='two'){r.tickets[1].transferred=true;r.tickets[1].code='99999999-9999-4999-8999-999999999999';}
  if(state==='cancelled'){r.tickets[0].status='cancelled';r.tickets[0].code=null;}return r;};
 await page.route('**/api/v1/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path.endsWith('/status'))return route.fulfill({json:receipt()});
  if(path.endsWith('/transfer')){calls.push({path,body:req.postDataJSON()});state='transferred';return route.fulfill({json:receipt()});}
  if(path.endsWith('/cancel')){calls.push({path,body:req.postDataJSON()});state='cancelled';return route.fulfill({json:receipt()});}
  return route.fulfill({json:familyEvent});
 });
 await page.goto(`/eventos/familias/inscripcion#id=${id}&token=${'b'.repeat(64)}`);
 await expect(page.getByText('Puedes transferir o cancelar tus entradas hasta el')).toBeVisible();
 const tomas=page.getByRole('article',{name:'Entrada de Tomás Soto'});
 await tomas.getByRole('button',{name:'Transferir a otra persona'}).click();
 await tomas.getByLabel('Nombre de quien recibe').fill('Luis');await tomas.getByLabel('Apellido de quien recibe').fill('Rojas');await tomas.getByLabel('Correo de quien recibe').fill('luis@example.com');
 await page.screenshot({path:'test-results/event-transfer-393.png',fullPage:true});
 await tomas.getByRole('button',{name:'Transferir entrada'}).click();
 await expect(page.getByText('Entrada transferida a Luis Rojas. Le enviamos su entrada a luis@example.com.')).toBeVisible();
 await expect(page.getByRole('article',{name:'Entrada de Luis Rojas'})).toContainText('Entrada transferida: este es su nuevo código.');
 expect(calls[0]).toEqual({path:`/api/v1/event-registrations/${id}/tickets/${T2}/transfer`,body:{token:'b'.repeat(64),firstName:'Luis',lastName:'Rojas',email:'luis@example.com'}});
 const ana=page.getByRole('article',{name:'Entrada de Ana Soto'});
 await ana.getByRole('button',{name:'Cancelar esta entrada'}).click();
 await ana.getByRole('button',{name:'Sí, cancelar entrada'}).click();
 await expect(page.getByText('Cancelamos la entrada de Ana Soto. El cupo quedó libre para otra persona.')).toBeVisible();
 expect(calls[1].body).toEqual({token:'b'.repeat(64),ticketId:id});
 await expect(page.getByRole('heading',{name:'¡Tu entrada está lista!'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('reserva pendiente: se puede cancelar completa',async({page})=>{
 await page.setViewportSize({width:393,height:852});let cancelled=false;
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/cancel')){cancelled=true;expect(route.request().postDataJSON()).toEqual({token:'b'.repeat(64)});}
  if(path.endsWith('/status')||path.endsWith('/cancel'))return route.fulfill({json:receiptOf(cancelled?'cancelled':'pending_payment')});
  return route.fulfill({json:familyEvent});
 });
 await page.goto(`/eventos/familias/inscripcion#id=${id}&token=${'b'.repeat(64)}`);
 await page.getByRole('button',{name:'Cancelar reserva'}).click();
 await page.getByRole('button',{name:'Sí, cancelar reserva'}).click();
 await expect(page.getByRole('heading',{name:'Inscripción cancelada'})).toBeVisible();
});
for(const width of [393,1280])test(`mis entradas: pedir el enlace y ver las compras ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const asked:any[]=[];
 await page.route('**/api/v1/my-tickets**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/link')){asked.push(route.request().postDataJSON());return route.fulfill({json:{message:'Si ese correo tiene inscripciones, te enviamos un enlace para verlas. Revisa tu bandeja de entrada.'}});}
  if(route.request().postDataJSON().token!=='firmado.123.abc')return route.fulfill({status:401,json:{message:'El enlace venció. Pide uno nuevo.'}});
  return route.fulfill({json:{email:'ana@example.com',orders:[
   {id,token:'b'.repeat(64),status:'confirmed',tickets:3,summary:'2 × General, Niños',amount:20000,upcoming:true,event:{title:'Retiro de Familias',slug:'familias',startsAt:'2027-01-10T12:00:00Z',endsAt:'2027-01-10T21:00:00Z',timezone:'America/Santiago',color:'#102b40',location:'Centro de encuentros'}},
   {id:`${id.slice(0,-1)}9`,token:'c'.repeat(64),status:'confirmed',tickets:1,summary:'Entrada gratuita',amount:0,upcoming:false,event:{title:'Noche de Alabanza',slug:'alabanza',startsAt:'2026-10-10T23:00:00Z',endsAt:'2026-10-11T01:00:00Z',timezone:'America/Santiago',color:'#96523f',location:'Campus Santiago'}},
  ]}});
 });
 await page.goto('/mis-entradas');
 await page.getByLabel('Correo electrónico').fill('ana@example.com');
 await page.getByRole('button',{name:'Enviarme el enlace'}).click();
 await expect(page.getByText(/te enviamos un enlace/)).toBeVisible();
 expect(asked).toEqual([{email:'ana@example.com'}]);
 await page.screenshot({path:`test-results/event-my-tickets-request-${width}.png`,fullPage:true});
 await page.goto('/mis-entradas#token=firmado.123.abc');await page.reload();
 await expect(page.getByRole('heading',{name:'Retiro de Familias'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Eventos anteriores'})).toContainText('Noche de Alabanza');
 await expect(page.getByText('3 entradas · 2 × General, Niños')).toBeVisible();
 await expect(page.getByRole('link',{name:'Ver entradas'}).first()).toHaveAttribute('href',`/eventos/familias/inscripcion#id=${id}&token=${'b'.repeat(64)}`);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-my-tickets-${width}.png`,fullPage:true});
 await page.goto('/mis-entradas#token=otro.1.x');await page.reload();
 await expect(page.getByText('El enlace venció. Pide uno nuevo.')).toBeVisible();
});
for(const width of [393,1280])test(`catálogo público de eventos ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const ev=(o:any)=>({slug:'retiro',title:'Retiro de Familias',startsAt:'2027-01-10T12:00:00Z',endsAt:'2027-01-10T21:00:00Z',timezone:'America/Santiago',color:'#102b40',modality:'onsite',location:'Centro de encuentros',campusName:'Santiago',categoryName:'Retiros',campuses:['Santiago'],pricing:'paid',minPrice:8000,maxPrice:12000,registrationEnabled:true,soldOut:false,capacityLeft:20,...o});
 await page.route('**/api/v1/public-events',r=>r.fulfill({json:[ev({}),ev({slug:'alabanza',title:'Noche de Alabanza',campusName:'Viña del Mar',campuses:['Viña del Mar'],categoryName:'Alabanza',pricing:'free',minPrice:null,maxPrice:null}),ev({slug:'jovenes',title:'Congreso Jóvenes',soldOut:true,minPrice:15000,maxPrice:15000})]}));
 await page.goto('/eventos');
 await expect(page.getByRole('heading',{name:'Próximos eventos'})).toBeVisible();
 await expect(page.getByRole('link',{name:/Retiro de Familias/})).toContainText('Desde $8.000');
 await expect(page.getByRole('link',{name:/Noche de Alabanza/})).toContainText('Gratis');
 await expect(page.getByRole('link',{name:/Congreso Jóvenes/})).toContainText('Cupos agotados');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-catalog-${width}.png`,fullPage:true});
 await page.getByLabel('Campus').selectOption('Viña del Mar');
 await expect(page.getByRole('link',{name:/Retiro de Familias/})).toHaveCount(0);
 await page.getByLabel('Campus').selectOption('');
 await page.getByPlaceholder('Buscar retiro, conferencia, campus…').fill('congreso');
 await expect(page.getByRole('link',{name:/Congreso Jóvenes/})).toHaveAttribute('href','/eventos/jovenes');
 await expect(page.getByRole('link',{name:/Noche de Alabanza/})).toHaveCount(0);
});
test('editor: autogestión y recordatorios se guardan con el evento',async({page})=>{
 const calls=await fixture(page);await page.setViewportSize({width:1280,height:900});
 await page.goto(`/dashboard/eventos/${id}`);
 await page.getByRole('tab',{name:/Inscripción y entradas/}).click();
 await page.getByRole('checkbox',{name:/Puede cancelar su entrada/}).uncheck();
 await page.getByLabel('Hasta cuántas horas antes del inicio').fill('48');
 await page.getByRole('checkbox',{name:/recordatorios automáticos/}).uncheck();
 await page.getByRole('button',{name:'Guardar evento'}).click();
 await expect(page.getByRole('status')).toContainText('Cambios guardados');
 expect(calls[0].details).toMatchObject({selfCancel:false,selfServiceHours:48,reminders:false});
});
// Fase 4: ventas, devoluciones, mensajes y encuesta.
const sales={event:{title:'Retiro de Hombres',startsAt:'2027-01-10T12:00:00Z',timezone:'America/Santiago',capacity:120,pricing:'paid'},
 totals:{collected:450000,testCollected:0,discounts:25000,refunded:10000,pendingAmount:30000,pendingOrders:2,waitlistedOrders:1,reviewOrders:0,orders:30,tickets:45,checkedIn:12,pendingTickets:3,waitlisted:2,cancelled:1,courtesy:4},
 byDay:[{day:'2026-11-18',tickets:8,amount:80000},{day:'2026-11-19',tickets:3,amount:30000},{day:'2026-11-21',tickets:20,amount:200000},{day:'2026-11-22',tickets:14,amount:140000}],
 byTicket:[{name:'General',capacity:100,price:10000,sold:41,pending:3,revenue:410000},{name:'Cortesías y otras',capacity:null,price:0,sold:4,pending:0,revenue:0}],
 byCampus:[{name:'Santiago',tickets:30,revenue:300000},{name:'Viña del Mar',tickets:15,revenue:150000}],
 codes:[{code:'FAMILIA',kind:'percent',value:25,active:true,uses:5,given:25000}]};
for(const width of [393,1280])test(`ventas: totales, gráfico por día y desgloses ${width}`,async({page})=>{
 await fixture(page);await page.setViewportSize({width,height:900});
 await page.route(`**/api/v1/event-management/${id}/sales`,r=>r.fulfill({json:sales}));
 await page.goto(`/dashboard/eventos/${id}/ventas`);
 await expect(page.getByText('$450.000')).toBeVisible();
 await expect(page.getByText('Después de $10.000 devueltos')).toBeVisible();
 await expect(page.getByText('40 %')).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Secciones del evento'}).getByRole('link',{name:'Ventas'})).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('img',{name:/Entradas por día: 18 nov: 8 entradas/})).toBeVisible();
 if(width>600){await page.getByRole('img',{name:/Entradas por día/}).hover({position:{x:width>600?560:300,y:120}});}
 await page.getByRole('button',{name:'Ver como tabla'}).click();
 await expect(page.getByRole('cell',{name:'21 nov'})).toBeVisible();
 await page.getByRole('button',{name:'Ver gráfico'}).click();
 await expect(page.getByRole('cell',{name:'FAMILIA'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-sales-${width}.png`,fullPage:true});
});
test('inscritos: devolver una entrada con Mercado Pago',async({page})=>{
 await fixture(page);await page.setViewportSize({width:1280,height:900});
 const paid={...people[1],amount:15000,orderAmount:20000,orderRefunded:0,paymentId:'987654',buyerName:'José Muñoz',refundedAt:null as string|null};
 const calls:any[]=[];
 await page.route(/\/api\/v1\/event-management\/[^/]+\/(attendees|registrations\/[^/]+\/refund)$/,async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/refund')){calls.push(route.request().postDataJSON());paid.refundedAt='2026-11-24T12:00:00Z';(paid as any).status='cancelled';return route.fulfill({json:{message:'Devolvimos $20.000 a José Muñoz con Mercado Pago y anulamos las entradas de la compra.'}});}
  return route.fulfill({json:{event:{id,slug:'retiro',title:'Retiro de Hombres',status:'published',startsAt:'2027-01-10T12:00:00Z',endsAt:'2027-01-10T21:00:00Z',capacity:120,timezone:'America/Santiago',pricing:'paid',tickets:[],campuses:[{id:10,name:'Santiago'}]},manage:true,canRefund:true,registrations:[paid]}});
 });
 await page.goto(`/dashboard/eventos/${id}/inscritos`);
 await page.getByRole('button',{name:'Devolver $15.000'}).click();
 const box=page.getByRole('group',{name:'Devolver el pago de José Muñoz'});
 await expect(box).toContainText('¿Devolver $15.000 a José Muñoz con Mercado Pago?');
 await box.getByRole('checkbox',{name:'Devolver toda la compra ($20.000)'}).check();
 await expect(box).toContainText('¿Devolver $20.000');
 await page.screenshot({path:'test-results/event-refund-1280.png'});
 await box.getByRole('button',{name:'Sí, devolver'}).click();
 await expect(page.getByText('Devolvimos $20.000 a José Muñoz con Mercado Pago')).toBeVisible();
 expect(calls).toEqual([{wholeOrder:true}]);
 await expect(page.getByText('Devuelta')).toBeVisible();
 await expect(page.getByRole('button',{name:/^Devolver/})).toHaveCount(0);
});
test('inscritos: sin permiso de devolución no aparece el botón',async({page})=>{
 await attendance(page);await page.setViewportSize({width:1280,height:900});
 await page.goto(`/dashboard/eventos/${id}/inscritos`);
 await expect(page.getByRole('heading',{name:'3 inscripciones'})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Devolver/})).toHaveCount(0);
});
test('mensajes: cuenta destinatarios, prueba y envío confirmado',async({page})=>{
 await fixture(page);await page.setViewportSize({width:393,height:852});
 const posts:any[]=[];const history:any[]=[];
 await page.route(`**/api/v1/event-management/${id}/messages`,async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:history});
  const b=route.request().postDataJSON();posts.push(b);
  if(b.dryRun)return route.fulfill({json:{recipients:b.audience==='checked_in'?12:45}});
  if(b.test)return route.fulfill({json:{test:true,to:'equipo@armglobal.org',message:'Te enviamos una prueba a equipo@armglobal.org.'}});
  history.push({id:'m1',subject:b.subject,body:b.body,audience:{audience:b.audience},recipients:45,sent:45,failed:0,createdAt:'2026-11-24T15:00:00Z',sentBy:'Prueba ARM'});
  return route.fulfill({json:{recipients:45,sent:45,failed:0,message:'Mensaje enviado a 45 personas.'}});
 });
 await page.goto(`/dashboard/eventos/${id}/mensajes`);
 await expect(page.getByText('Llegará a 45 personas.')).toBeVisible();
 await page.getByLabel('Para').selectOption('checked_in');
 await expect(page.getByText('Llegará a 12 personas.')).toBeVisible();
 await page.getByLabel('Para').selectOption('confirmed');
 await page.getByLabel('Asunto').fill('Cambio de horario');
 await page.getByRole('textbox',{name:/^Mensaje/}).fill('Hola:\n\nEmpezamos a las 10:00.');
 await page.getByRole('button',{name:'Enviarme una prueba'}).click();
 await expect(page.getByText('Te enviamos una prueba a equipo@armglobal.org.')).toBeVisible();
 await page.getByRole('button',{name:'Revisar y enviar'}).click();
 await expect(page.getByRole('group',{name:'Confirmar envío'})).toContainText('a 45 personas');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/event-messages-393.png',fullPage:true});
 await page.getByRole('button',{name:'Sí, enviar ahora'}).click();
 await expect(page.getByText('Mensaje enviado a 45 personas.')).toBeVisible();
 expect(posts.filter(p=>!p.dryRun)).toEqual([{subject:'Cambio de horario',body:'Hola:\n\nEmpezamos a las 10:00.',audience:'confirmed',test:true},{subject:'Cambio de horario',body:'Hola:\n\nEmpezamos a las 10:00.',audience:'confirmed'}]);
 await expect(page.getByRole('region',{name:'Enviados'})).toContainText('45 de 45 enviados');
});
test('encuesta: resultados y envío manual',async({page})=>{
 await fixture(page);await page.setViewportSize({width:1280,height:900});
 let sent=false;
 await page.route(`**/api/v1/event-management/${id}/survey**`,async route=>{
  if(route.request().method()==='POST'){sent=true;return route.fulfill({json:{message:'Encuesta enviada a 12 personas.'}});}
  return route.fulfill({json:{enabled:true,question:'¿Qué tema quieres para el próximo?',sentAt:sent?'2026-11-24T15:00:00Z':null,ended:true,recipients:12,onlyCheckedIn:true,responses:4,rating:4,distribution:[0,1,0,1,2],
   nps:{score:25,promoters:2,passives:1,detractors:1,answered:4},comments:[{rating:5,liked:'La alabanza',improve:null,extra:'Familia',createdAt:'2026-11-24T16:00:00Z'}]}});
 });
 await page.goto(`/dashboard/eventos/${id}/encuesta`);
 await expect(page.getByText('4 / 5')).toBeVisible();
 await expect(page.getByText('25',{exact:true})).toBeVisible();
 await expect(page.getByText('La alabanza')).toBeVisible();
 await page.getByRole('button',{name:'Enviar encuesta ahora'}).click();
 await expect(page.getByText('Encuesta enviada a 12 personas.')).toBeVisible();
 await page.screenshot({path:'test-results/event-survey-results-1280.png',fullPage:true});
});
test('encuesta pública: responder una vez',async({page})=>{
 await page.setViewportSize({width:393,height:852});
 const answers:any[]=[];
 await page.route('**/api/v1/public-events/retiro/survey**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/check'))return route.fulfill({json:{title:'Retiro de Hombres',startsAt:'2027-01-10T12:00:00Z',color:'#102b40',question:'¿Qué tema quieres para el próximo?',answered:false}});
  answers.push(route.request().postDataJSON());return route.fulfill({json:{message:'¡Gracias por responder!'}});
 });
 await page.goto('/eventos/retiro/encuesta#e=YW5hQGV4YW1wbGUuY29t&t=firma-de-prueba-123456789012');
 await expect(page.getByRole('heading',{name:'Retiro de Hombres'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Enviar respuestas'})).toBeDisabled();
 await page.getByRole('radio',{name:'4 de 5'}).click();
 await page.getByRole('radio',{name:'9',exact:true}).click();
 await page.getByLabel('¿Qué fue lo que más te gustó?').fill('La alabanza');
 await page.getByLabel('¿Qué tema quieres para el próximo?').fill('Familia');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/event-survey-form-393.png',fullPage:true});
 await page.getByRole('button',{name:'Enviar respuestas'}).click();
 await expect(page.getByRole('heading',{name:'¡Gracias por responder!'})).toBeVisible();
 expect(answers).toEqual([{e:'YW5hQGV4YW1wbGUuY29t',t:'firma-de-prueba-123456789012',rating:4,nps:9,liked:'La alabanza',extra:'Familia'}]);
});
