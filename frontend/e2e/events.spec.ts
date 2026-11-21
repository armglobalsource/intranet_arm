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
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.getByLabel('Teléfono / WhatsApp').fill('+56912345678');await page.getByLabel('Campus',{exact:true}).selectOption('10');
 if(paid)await page.getByLabel('Entrada',{exact:true}).selectOption(categoryId);
 await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByRole('checkbox').check();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/event-registration-${mode}-393.png`,fullPage:true});
 await page.getByRole('button',{name:paid?'Registrar y continuar al pago':'Confirmar inscripción gratuita'}).click();
 await expect(page.getByRole('heading',{name:paid?'Pendiente de pago':'Inscripción confirmada',exact:true})).toBeVisible();
 expect(captured[0]).toMatchObject({campusId:10,consent:true});expect(captured[0].amount).toBeUndefined();
 if(paid){await expect(page.getByText('Tu entrada',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:mode==='test'?'Pagar con Mercado Pago · Prueba':'Pagar con Mercado Pago',exact:true})).toBeVisible();if(mode==='production')await expect(page.getByText('Modo de prueba · No utilices tarjetas ni cuentas reales.')).toHaveCount(0);}else await expect(page.getByRole('button',{name:'Imprimir / Guardar PDF'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
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
 await page.getByRole('radio',{name:'Morado profundo'}).click();
 await page.getByRole('tab',{name:/Revisar y publicar/}).click();
 await expect(page.getByText(/Faltan \d+ de \d+ puntos/)).toBeVisible();
 await page.screenshot({path:'test-results/event-editor-nuevo-1440.png',fullPage:true});
});
