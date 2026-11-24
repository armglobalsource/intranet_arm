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

for(const mode of ['free','test','production'])test(`inscripción móvil ${mode}`,async({page})=>{
 const paid=mode!=='free';
 await page.setViewportSize({width:393,height:852});
 const captured:any[]=[];
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/registrations')){captured.push(route.request().postDataJSON());return route.fulfill({json:{id,token:'b'.repeat(64),status:paid?'pending_payment':'confirmed'}});}
  if(path.endsWith('/status'))return route.fulfill({json:{id,token:'b'.repeat(64),status:paid?'pending_payment':'confirmed',participantName:'Prueba ARM',title:'Encuentro de prueba',startsAt:'2027-01-10T12:00:00Z',timezone:'America/Santiago',testPayment:mode==='test',amount:paid?1000:0,currency:'CLP',expiresAt:'2027-01-09T12:00:00Z',emailSent:true,ticketCode:paid?null:id}});
  return route.fulfill({json:{title:'Encuentro de prueba',slug:'prueba',startsAt:'2027-01-10T12:00:00Z',endsAt:'2027-01-10T21:00:00Z',status:'published',registrationStatus:'open',paymentMode:mode,capacity:100,details:{...details,pricing:paid?'paid':'free'},campusName:'Santiago',campuses:['Santiago'],campusOptions:[{id:10,name:'Santiago'}],ticketTypes:paid?[{id:categoryId,name:'General',price:1000,currency:'CLP'}]:[],registrationEnabled:true}});
 });
 await page.goto('/eventos/prueba');await page.getByRole('link',{name:'Inscribirme ahora'}).first().click();
 await page.getByLabel('Nombre',{exact:true}).fill('Prueba');await page.getByLabel('Apellido',{exact:true}).fill('ARM');await page.getByLabel('Correo electrónico',{exact:true}).fill('prueba@example.com');await page.getByLabel('Edad',{exact:true}).fill('30');
 await page.getByLabel('Teléfono / WhatsApp').fill('+56912345678');await page.getByLabel('Campus',{exact:true}).selectOption('10');
 if(paid)await expect(page.getByRole('radio',{name:/General/})).toBeChecked();
 await page.getByRole('checkbox').check();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-registration-${mode}-393.png`,fullPage:true});
 await page.getByRole('button',{name:paid?/^Continuar al pago/:'Confirmar mi inscripción'}).click();
 await expect(page.getByRole('heading',{name:paid?'Último paso: paga tu entrada':'¡Tu entrada está lista!',exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/event-receipt-${mode}-393.png`,fullPage:true});
 expect(captured[0]).toMatchObject({campusId:10,consent:true});expect(captured[0].amount).toBeUndefined();
 if(paid){await expect(page.getByRole('article',{name:'Tu entrada'})).toHaveCount(0);await expect(page.getByRole('button',{name:mode==='test'?'Pagar con Mercado Pago · Prueba':'Pagar con Mercado Pago',exact:true})).toBeVisible();if(mode==='production')await expect(page.getByText('Modo de prueba · No utilices tarjetas ni cuentas reales.')).toHaveCount(0);}else await expect(page.getByRole('button',{name:'Imprimir / Guardar PDF'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const width of [393,1280])test(`regreso desde Mercado Pago confirma la entrada ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 let checks=0;
 const receipt=(status:string)=>({id,token:'b'.repeat(64),status,participantName:'Prueba ARM',title:'Encuentro de prueba',startsAt:'2027-01-10T12:00:00Z',timezone:'America/Santiago',testPayment:false,amount:1000,currency:'CLP',ticketName:'General',expiresAt:'2027-01-09T12:00:00Z',emailSent:true,ticketCode:status==='confirmed'?id:null});
 await page.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/status')){checks++;return route.fulfill({json:receipt(checks<3?'pending_payment':'confirmed')});}
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
