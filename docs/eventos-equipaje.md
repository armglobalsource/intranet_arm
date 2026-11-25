# Equipaje en eventos

Cada bolso recibe una etiqueta impresa con QR que queda ligada a la entrada de su dueño. Al final, el bolso se entrega escaneando **la etiqueta y la entrada del dueño**: si no coinciden, no se entrega.

## Dónde se usa

- **En la puerta** (*Control de acceso*): al escanear una entrada válida aparece **Registrar equipaje**. También está el botón **Equipaje** al buscar a alguien por nombre.
- **En la mesa de equipaje** (*Eventos → evento → Equipaje*, o el enlace **Equipaje** de la puerta). Tiene tres pestañas:
  - **Recibir:** escanea la entrada o busca a la persona por nombre, elige cuántos bolsos trae y pulsa **Registrar e imprimir**.
  - **Entregar:** sigue estos pasos.
    1. Escanea la etiqueta del bolso.
    2. Escanea la entrada del dueño (del correo o de su Wallet).
    3. Si la persona no trae su entrada, usa **verificar con carnet**. Así queda registrado.
    4. Después de mostrar su entrada, los demás bolsos de la misma persona salen solo con su etiqueta durante 2 minutos.
  - **Lista:** muestra todos los bolsos, guardados, entregados y anulados, con opción de reimprimir.

Pueden usarlo quienes administran el evento y quienes tienen el permiso de puerta (`eventos:checkin`).

Si una etiqueta se imprimió mal, **anúlala**: deja de servir para retirar el bolso.

## Impresora y etiquetas

Funciona con cualquier impresora de etiquetas que tenga driver para el computador o notebook de la mesa. Se imprime con el diálogo de impresión del navegador.

En el selector **Etiqueta** elige el tamaño que tengas cargado. El mismo tamaño debe estar en la configuración de la impresora.

| Tamaño | Uso típico |
|---|---|
| 62 × 100 mm | Rollo continuo de 62 mm (por ejemplo, impresoras Brother QL) |
| 102 × 51 mm (4 × 2") | Rollos de etiquetas térmicas de 4 pulgadas |
| 102 × 152 mm (4 × 6") | Etiquetas grandes, tipo envío |
| Hoja carta | Impresora normal: 10 etiquetas por hoja para recortar y pegar con cinta |

La etiqueta trae:
- el evento;
- el nombre del dueño, su campus y su tipo de entrada;
- el número de bolso, por ejemplo «BOLSO 2 DE 3»;
- la descripción, si se escribió una;
- el código, para escribirlo a mano si el QR se daña.

Va en blanco y negro, pensada para impresión térmica.

### Imprimir sin el diálogo (más rápido en la mesa)

En el computador de la mesa:
1. Deja la impresora de etiquetas como **predeterminada**.
2. Abre Chrome con la opción `--kiosk-printing`. Por ejemplo, crea un acceso directo con este destino:

   ```text
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing https://ecosistema.armglobal.org/dashboard/eventos
   ```

Con eso, cada etiqueta sale directo a la impresora sin abrir el diálogo.

## Consejos para el día

- Prueba la impresora con un evento de prueba antes del retiro.
- Pega la etiqueta en una cara plana del bolso o envuélvela en el asa, con el QR hacia afuera.
- En la entrega, si el QR de la entrada no se lee, escribe su código en el campo de abajo del lector.
