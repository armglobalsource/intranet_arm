import { expect, test, type Page } from '@playwright/test';
test.use({baseURL:process.env.FICHA_UI_BASE_URL ?? 'http://localhost:3005',channel:process.env.FICHA_UI_BROWSER ?? 'msedge'});
const requestId='00000000-0000-4000-8000-000000000001';
async function fixture(page:Page,mode:'requester'|'ti'|'manager'='requester') {
  await page.addInitScript(({mode})=>localStorage.setItem('auth-storage',JSON.stringify({version:0,state:{user:{id:mode==='manager'?2:mode==='ti'?3:1,firstName:'Demo',lastName:'ARM',permissions:mode==='requester'?[]:['*'],role:{name:'user'},status:'active'},accessToken:'fixture',isAuthenticated:true}})),{mode});
  let r:any={id:requestId,version:1,status:mode==='ti'?'validation':'approval',manager_id:'2',requester_name:'Demo ARM',manager_name:'Jefatura Demo',canApprove:mode==='manager',canManage:mode==='ti',canRevise:false,details:{operation:'create',company:'arm',kind:'collaborator',name:'Demo ARM',employeeId:'DEMO-123',area:'Comunicación',jobTitle:'Coordinador',startsOn:'2026-11-05',suggestedName:'demo.arm',groups:'Comunicación',reason:''},events:[]};
  const calls:any[]=[];
  await page.route('**/api/v1/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/v1','');
    if(path==='/institutional-mail/options')return route.fulfill({json:{canManage:mode==='ti',canApprove:mode==='manager',dueReviews:mode==='ti'?1:0,managers:[{id:2,name:'Jefatura Demo'}]}});
    if(path==='/institutional-mail/accounts')return route.fulfill({json:[{id:'account',email:'temporal@armglobal.org',owner_name:'Demo ARM',kind:'temporary',active:true,expires_on:'2026-11-07',review_on:'2026-10-31',license:'Starter',last_request_id:requestId,total:'1',request_details:{...r.details,kind:'temporary'}}]});
    if(path==='/institutional-mail'&&req.method()==='POST') {const body=req.postDataJSON();calls.push(body);r={...r,details:body.details};return route.fulfill({json:{id:requestId}});}
    if(path==='/institutional-mail')return route.fulfill({json:{items:[{...r,...r.details,created_at:'2026-11-05T12:00:00Z'}],total:1}});
    if(path.endsWith('/actions')) {const body=req.postDataJSON();calls.push(body);r={...r,status:body.action==='start'?'creating':body.action==='complete'?'delivered':body.action==='approve'?'validation':'observed',version:r.version+1,assigned_to:'3',assignee_name:'TI Demo',events:[...r.events,{id:String(r.version),action:body.action,note:body.note,actor_name:'Demo',created_at:'2026-11-05T12:00:00Z',snapshot:body}]};return route.fulfill({json:{id:requestId}});}
    if(path===`/institutional-mail/${requestId}`)return route.fulfill({json:r});
    return route.fulfill({json:[]});
  });
  return calls;
}
for(const width of [320,393,834,1440]) test(`solicitud responsive ${width}px`,async({page})=>{
  const calls=await fixture(page);
  await page.setViewportSize({width,height:852});
  await page.goto('/dashboard/correos');
  await expect(page.getByRole('heading',{name:'Correos y accesos',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Gestión TI',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'+ Nueva solicitud',exact:true}).click();
  await page.getByLabel('Empresa / unidad').selectOption('school');
  await page.getByLabel('Jefatura directa').selectOption('2');
  await page.getByLabel('RUT o ID de colaborador').fill('DEMO-123');
  await page.getByLabel('Área',{exact:true}).fill('Comunicaciones');
  await page.getByLabel('Cargo',{exact:true}).fill('Coordinador');
  await page.getByRole('button',{name:'Sugerir a partir del nombre'}).click();
  await page.getByLabel('Grupos o accesos requeridos').fill('Ninguno');
  await expect(page.getByText('demo.arm@arschoolglobal.com',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('main').evaluate(element=>element.scrollTo(0,0));
  await page.screenshot({path:`test-results/mail-form-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Enviar a aprobación',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Historial de la solicitud'})).toBeVisible();
  expect(calls[0].details.company).toBe('school');
  expect(calls[0].details.domain).toBeUndefined();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('TI toma la solicitud y registra entrega solo con verificaciones explícitas',async({page})=>{
  const calls=await fixture(page,'ti');await page.setViewportSize({width:393,height:852});
  await page.goto(`/dashboard/correos?request=${requestId}`);
  await expect(page.getByRole('button',{name:'Tomar solicitud e iniciar'})).toBeDisabled();
  await page.getByLabel(/Verifiqué identidad/).check();
  await page.getByRole('button',{name:'Tomar solicitud e iniciar'}).click();
  await expect(page.getByRole('heading',{name:'Registrar resultado de TI'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirmar gestión realizada'})).toBeDisabled();
  await page.getByLabel(/Verifiqué identidad/).check();
  await page.getByLabel('Licencia aplicada').fill('Starter');
  await page.getByLabel(/MFA obligatorio verificado/).check();
  await page.getByLabel(/Acceso entregado por un canal seguro/).check();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/mail-delivery-393.png',fullPage:true});
  await page.getByRole('button',{name:'Confirmar gestión realizada'}).click();
  await expect(page.getByText('Completada / entregada',{exact:true})).toBeVisible();
  expect(calls[1]).toMatchObject({mfaConfirmed:true,secureDelivery:true,workspaceChecked:true});
  await page.getByRole('button',{name:'Cuentas institucionales',exact:true}).click();
  await page.getByRole('button',{name:'Revisiones por vencimiento'}).click();
  await expect(page.getByText('temporal@armglobal.org',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Solicitar cambio / renovación'}).click();
  await expect(page.getByLabel('Correo existente')).toHaveValue('temporal@armglobal.org');
  await expect(page.getByLabel('RUT o ID de colaborador')).toHaveValue('DEMO-123');
  await expect(page.getByLabel('Tipo de cuenta')).toHaveValue('temporary');
});
test('jefatura exige un motivo para observar y puede aprobar',async({page})=>{
  await fixture(page,'manager');await page.goto(`/dashboard/correos?request=${requestId}`);
  await page.getByRole('button',{name:'Solicitar corrección'}).click();
  await expect(page.getByRole('alert').filter({hasText:'Escribe el motivo'})).toBeVisible();
  await page.getByRole('button',{name:'Aprobar y enviar a TI'}).click();
  await expect(page.getByText('Validación TI',{exact:true})).toBeVisible();
});
