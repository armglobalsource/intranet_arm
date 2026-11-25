# Entradas en Apple Wallet y Google Wallet

Cada entrada confirmada puede guardarse en el celular. Los botones aparecen bajo el QR:

- en el comprobante de la compra (`/eventos/<evento>/inscripcion`), que también se abre desde **Mis entradas**;
- en el correo de confirmación y en los recordatorios.

El pase lleva **el mismo QR** que lee el Control de acceso, así que en la puerta no cambia nada. En iPhone y Mac se muestra «Agregar a Apple Wallet»; en Android, «Guardar en Google Wallet»; en un computador, los dos.

Cada billetera se activa sola cuando sus variables están en Vercel (Production) y se hace un redeploy. Sin ellas, los botones no aparecen y el resto del módulo funciona igual.

## Seguridad

- Los enlaces van firmados con `EVENT_REGISTRATION_SECRET`, el ID de la entrada y su código vigente. No caducan, pero dejan de servir si la entrada se **transfiere** (cambia el código), se **anula**, se **devuelve** o el evento se **cancela**.
- Un pase ya guardado en el celular no se actualiza solo: si la entrada se transfiere, el QR antiguo queda rechazado en la puerta y la persona nueva recibe su propio pase.
- Ninguna clave se muestra en pantalla ni se guarda en el repositorio: van solo en las variables de Vercel.

## Google Wallet (gratis)

1. Entra a la [Google Pay & Wallet Console](https://pay.google.com/business/console) con la cuenta de la organización y crea la cuenta de emisor (*Issuer*). Copia el **Issuer ID** (un número largo).
2. En [Google Cloud Console](https://console.cloud.google.com/), en un proyecto de la organización:
   - activa la **Google Wallet API**;
   - crea una **cuenta de servicio** (sin roles de proyecto) y genera una **clave JSON**.
3. En la Wallet Console, en **Users**, invita el correo de la cuenta de servicio (`…@….iam.gserviceaccount.com`) con permiso de **Developer**.
4. En Vercel → *Settings → Environment Variables* (Production):
   - `GOOGLE_WALLET_ISSUER_ID` = el Issuer ID.
   - `GOOGLE_WALLET_SERVICE_ACCOUNT` = el contenido del archivo JSON (puede ir tal cual o en base64).
5. Redeploy.

Mientras la cuenta de emisor está en **modo demo**, solo pueden guardar pases las cuentas de prueba que agregues en la consola. Para que funcione con todas las personas, en la Wallet Console pide **acceso de publicación** (*Request publishing access*) para la API de *Event tickets*. Google lo revisa en unos días.

## Apple Wallet (requiere Apple Developer Program, US$99 al año)

1. Inscribe a la organización en el [Apple Developer Program](https://developer.apple.com/programs/). Anota el **Team ID** (10 caracteres, en *Membership*).
2. En *Certificates, Identifiers & Profiles → Identifiers*, crea un **Pass Type ID**, por ejemplo `pass.org.armglobal.eventos`.
3. Crea el certificado de ese Pass Type ID:
   - Genera una solicitud CSR. En Windows, con OpenSSL (incluido con Git):
     ```powershell
     openssl req -new -newkey rsa:2048 -nodes -keyout pass.key -out pass.csr -subj "/CN=ARM Global Wallet"
     ```
     Si PowerShell no reconoce `openssl`, usa `& "C:\Program Files\Git\usr\bin\openssl.exe"` en su lugar.
   - En el portal, en el Pass Type ID, elige *Create Certificate*, sube `pass.csr` y descarga `pass.cer`.
   - Conviértelo a PEM:
     ```powershell
     openssl x509 -inform DER -in pass.cer -out pass.pem
     ```
4. Descarga el certificado intermedio **Apple WWDR G4** desde [Apple PKI](https://www.apple.com/certificateauthority/) (`AppleWWDRCAG4.cer`) y conviértelo:
   ```powershell
   openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
   ```
5. En Vercel (Production):
   - `APPLE_WALLET_PASS_TYPE_ID` = `pass.org.armglobal.eventos`
   - `APPLE_WALLET_TEAM_ID` = el Team ID
   - `APPLE_WALLET_CERT` = el contenido de `pass.pem`
   - `APPLE_WALLET_KEY` = el contenido de `pass.key`
   - `APPLE_WALLET_WWDR` = el contenido de `wwdr.pem`

   Si en vez de esto exportas el certificado desde un Mac como `.p12`, puedes usar `APPLE_WALLET_P12` (el archivo en base64) y `APPLE_WALLET_P12_PASSWORD` en lugar de `APPLE_WALLET_CERT` y `APPLE_WALLET_KEY`.
6. Redeploy. Guarda `pass.key` en un lugar seguro y bórralo del equipo: es la clave que firma los pases.

El sistema revisa que la clave corresponda al certificado. Si no corresponde, Apple Wallet queda desactivado en vez de entregar pases que el iPhone rechazaría.

## Cómo probar

1. Inscríbete a un evento gratuito de prueba.
2. Abre el comprobante en el celular y toca el botón de Wallet.
3. En el Control de acceso, escanea el QR desde Wallet: debe registrar el ingreso igual que el QR del correo.
