import { test, expect, type Page } from '@playwright/test';
test.use({baseURL:process.env.FICHA_UI_BASE_URL ?? 'http://localhost:3005',channel:process.env.FICHA_UI_BROWSER});

async function fixture(page: Page) {
  await page.addInitScript(()=>localStorage.setItem('auth-storage',JSON.stringify({version:0,state:{user:{id:1,firstName:'Demo',lastName:'ARM',campusId:1,permissions:['*'],status:'active'},accessToken:'fixture',isAuthenticated:true}})));
  const campus={id:1,name:'Santiago',isActive:true,schedules:[{dia:'Domingo',hora:'11:00'}]};
  const data={meta:{desde:'2026-10-12',hasta:'2026-11-04',hora:'12:00',zona:'America/Santiago'},progreso:[
    {campusId:1,campus:'Santiago',pais:'Chile',desde:'2026-10-12',ultimoReporte:'2026-10-18',seguimiento:'horarios',pendientes:2,puedeRegistrar:true,puedeRevisar:true},
    {campusId:2,campus:'Puente Alto',pais:'Chile',desde:'2026-10-12',ultimoReporte:'2026-10-18',seguimiento:'horarios',pendientes:1,puedeRegistrar:true,puedeRevisar:true},
    {campusId:23,campus:'Miami',seguimiento:'sin_horarios',pendientes:0,ultimoReporte:'2025-09-28'},
  ],pendientes:[
    {campusId:1,campus:'Santiago',fecha:'2026-10-25',hora:'11:00',encuentro:'Encuentro Domingo 11:00 hrs'},
    {campusId:1,campus:'Santiago',fecha:'2026-11-01',hora:'11:00',encuentro:'Encuentro Domingo 11:00 hrs'},
    {campusId:2,campus:'Puente Alto',fecha:'2026-11-01',hora:'18:00',encuentro:'Encuentro Domingo 18:00 hrs'},
  ],reportes:[{id:'report1',campusId:1,campus:'Santiago',fecha:'2026-11-01',encuentro:'Encuentro Domingo 09:00 hrs',estado:'observado',puedeEditar:true,tipo:'encuentro'}],revisar:[]};
  await page.route('**/api/v1/**',route=>{
    const path=new URL(route.request().url()).pathname.replace('/api/v1','');
    if(path==='/encuentros/pendientes')return route.fulfill({json:data});
    if(path==='/encuentros/existente')return route.fulfill({json:{existente:null}});
    if(path==='/encuentros/revision')return route.fulfill({json:{campusIds:[1,2],items:[]}});
    if(path==='/campus')return route.fulfill({json:[campus]});
    if(path==='/arm-catalogos/active')return route.fulfill({json:[{key:'auditorio',label:'Auditorio'}]});
    return route.fulfill({json:[]});
  });
}

for(const width of [320,393,834,1440])test(`control ${width}px: filtros, pendientes y apertura de reporte`,async({page})=>{
  await fixture(page);await page.setViewportSize({width,height:852});
  await page.goto('/dashboard/produccion-general/estadisticas/operacion');
  await expect(page.getByRole('heading',{name:'Control de reportes',exact:true})).toBeVisible();
  await expect(page.getByText('Falta configurar horarios: Miami.')).toBeVisible();
  await expect(page.locator('.stats-control-row')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/control-reportes-${width}.png`,fullPage:true});
  await page.getByLabel('Campus',{exact:true}).selectOption('1');
  await expect(page.locator('.stats-control-row')).toHaveCount(2);
  await page.getByRole('button',{name:'Observados 1'}).click();
  await expect(page.getByRole('link',{name:'Corregir →'})).toHaveAttribute('href',/editar=report1/);
  await page.getByRole('button',{name:'Faltantes 2'}).click();
  await page.getByLabel('Semana',{exact:true}).selectOption('2026-10-19');
  await expect(page.locator('.stats-control-row')).toHaveCount(1);
  await page.getByRole('link',{name:'Registrar →',exact:true}).click();
  await expect(page.getByLabel('Fecha',{exact:true})).toHaveValue('2026-10-25');
  await expect(page.getByRole('combobox',{name:'Encuentro',exact:true})).toHaveValue('Encuentro Domingo 11:00 hrs');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('un error del servidor no se presenta como cero faltantes',async({page})=>{
  await fixture(page);
  await page.route('**/api/v1/encuentros/pendientes',route=>route.fulfill({status:500,json:{message:'fixture failure'}}));
  await page.goto('/dashboard/produccion-general/estadisticas/operacion');
  await expect(page.getByRole('alert').filter({hasText:'No pudimos consultar'})).toBeVisible({timeout:15000});
  await expect(page.locator('.stats-count')).toHaveCount(0);
});

test('un reporte de otra persona bloquea un segundo envío desde el formulario',async({page})=>{
  await fixture(page);
  await page.route('**/api/v1/encuentros/existente?**',route=>route.fulfill({json:{existente:{id:'other',estado:'enviado'}}}));
  await page.goto('/dashboard/produccion-general/estadisticas/registrar?campus=1&fecha=2026-10-25&encuentro=Encuentro%20Domingo%2011%3A00%20hrs');
  await expect(page.getByText('Este encuentro ya tiene un reporte. Consulta el control semanal o pide al administrador que lo revise.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Guardar registro',exact:true})).toBeDisabled();
});
