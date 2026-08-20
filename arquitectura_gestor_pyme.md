# Arquitectura y Stack Tecnológico - Gestor PyME

Este documento detalla la arquitectura actual, la estructura del proyecto y el stack tecnológico del sistema **Gestor PyME**. Su propósito es servir de guía para ingenieros de desarrollo que requieran implementar nuevas funcionalidades, como la integración de un Avatar de IA de Tavus en el módulo de cobranza.

---

## 1. Stack Tecnológico Frontend

El frontend del proyecto está construido con tecnologías modernas que garantizan una experiencia reactiva y de alto rendimiento:

- **Framework principal:** **Svelte 5** (utilizando el compilador de Svelte y la sintaxis de **Runes** como `$props()`, `$state()`, `$derived()` y `$effect()`).
- **Framework de Aplicación/Enrutador:** **SvelteKit 2** (el framework oficial de Svelte para el manejo de rutas y renderizado híbrido).
- **Sistema de Estilos:**
  - **TailwindCSS v4** está configurado en el proyecto a través del plugin oficial de Vite (`@tailwindcss/vite`).
  - Sin embargo, los componentes de la interfaz de usuario actuales utilizan principalmente **Vanilla CSS (CSS plano)** encapsulado dentro de los bloques `<style>` de los archivos `.svelte`, apoyándose en **Variables CSS (Propiedades personalizadas)** globales definidas en [layout.css](file:///c:/Repositorios/GestorPyme/src/routes/layout.css) para el sistema de diseño (colores, bordes, espaciados y temas).
- **Librería de Autenticación (Frontend):** **svelte-clerk** para gestionar el inicio de sesión y la sesión del usuario en el navegador a través del componente `<ClerkProvider>`.

---

## 2. Stack Tecnológico Backend

**Importante:** **No existe un framework de Python** (como FastAPI, Flask o Django) en este repositorio. 

El backend es completamente **serveless / server-side JS** integrado nativamente en **SvelteKit** corriendo bajo **Node.js**:
- **Endpoints de API:** Definidos mediante archivos `+server.js` (por ejemplo, [+server.js (chat)](file:///c:/Repositorios/GestorPyme/src/routes/api/chat/+server.js)), los cuales actúan como controladores de API que responden a verbos HTTP estándar (POST, GET, etc.).
- **Lógica de Carga y Acciones del Servidor:** Archivos `+page.server.js` que manejan la obtención de datos (`load()`) y el procesamiento de formularios (`actions`) en el servidor antes del renderizado.
- **ORM/Base de Datos:** **Prisma ORM** (versión 7) utilizando el cliente de Node.js (`@prisma/client`) con un adaptador nativo de PostgreSQL (`@prisma/adapter-pg` y el paquete `pg`) para realizar consultas eficientes a la base de datos de **Supabase**.

---

## 3. Estructura de Directorios Relevante

El árbol de directorios más relevante del proyecto (omitiendo directorios de compilación, temporales y dependencias como `node_modules` y `.svelte-kit`) se presenta a continuación:

```
GestorPyme/
├── prisma/
│   └── schema.prisma              # Esquema de base de datos de Prisma (PostgreSQL / Supabase)
├── src/
│   ├── app.html                   # Plantilla HTML base del frontend
│   ├── hooks.server.js            # Middleware del servidor (Clerk Autenticación y Guardia de Rutas)
│   ├── lib/
│   │   ├── components/
│   │   │   └── FloatingAssistant.svelte # Asistente flotante de IA (chat client-side con API backend)
│   │   ├── server/
│   │   │   ├── prisma.js          # Inicialización y exportación del cliente Prisma (exclusivo servidor)
│   │   │   └── agentPrompt.js     # Constructor de prompts de sistema con datos del negocio en tiempo real
│   │   ├── prisma.js              # Cliente alternativo Prisma
│   │   ├── resend.js              # Configuración y helpers para envíos de correo con Resend
│   │   └── schemas/
│   │       └── cotizacion.js      # Esquemas de validación Zod y configuraciones de estado de cotización
│   └── routes/
│       ├── +layout.server.js      # Carga de la sesión de Clerk en el servidor
│       ├── +layout.svelte         # Layout principal con Sidebar, Header y ClerkProvider
│       ├── layout.css             # Estilos CSS globales, reset y variables del sistema de diseño
│       ├── api/
│       │   └── chat/
│       │       └── +server.js     # Endpoint POST de chat con la API de Anthropic (Claude)
│       ├── clientes/              # Vista y lógica para administración de clientes
│       ├── cotizaciones/          # Vista y lógica para cotizaciones
│       ├── dashboard/             # Panel general de control y KPIs
│       ├── sign-in/               # Página de Login integrada con Clerk
│       └── cobranza/              # Módulo de Cobranza (Cartera Pendiente)
│           ├── +page.server.js    # Carga de cuentas por cobrar y acción de enviar recordatorio
│           └── +page.svelte       # Interfaz gráfica de cobranza con tabla y botones
├── .env                           # Variables de entorno locales (Excluida de Git)
├── package.json                   # Definición de dependencias de Node.js y scripts npm
├── prisma.config.js               # Configuración de Prisma (DATABASE_URL y migraciones)
└── vite.config.js                 # Configuración de Vite con plugins de SvelteKit y Tailwind
```

### Detalle de Puntos Clave:
*   **Vistas/Componentes de Cobranza:** Se ubican en [src/routes/cobranza/](file:///c:/Repositorios/GestorPyme/src/routes/cobranza/).
*   **Controladores/Rutas Backend:** Los endpoints se definen como subcarpetas en `src/routes/` que contienen archivos `+server.js` (como `src/routes/api/chat/+server.js`), y la lógica asociada a páginas en `+page.server.js`.
*   **Conexión con Supabase:** Inicializada a nivel de servidor Node.js en [prisma.js](file:///c:/Repositorios/GestorPyme/src/lib/server/prisma.js) y definida a nivel de schema en [schema.prisma](file:///c:/Repositorios/GestorPyme/prisma/schema.prisma).

---

## 4. Módulo de Cobranza

El módulo de cobranza permite monitorizar la cartera de clientes con saldo pendiente y ejecutar acciones de cobro. Actualmente está compuesto por los siguientes archivos:

1.  **[+page.server.js](file:///c:/Repositorios/GestorPyme/src/routes/cobranza/+page.server.js) (Lógica del Servidor):**
    *   **Función `load()`:** Ejecuta una consulta de Prisma para extraer cotizaciones en estados `ENVIADA`, `ACEPTADA` o `VENCIDA` junto con los datos de sus clientes y los pagos registrados. Calcula el saldo pendiente (`total` - `suma de pagos`) y los días transcurridos desde su emisión. Filtra cotizaciones con saldo pendiente mayor a `$0.01` y las ordena cronológicamente (las más antiguas primero). Retorna el objeto `cartera` y `totalCartera`.
    *   **Acciones del Servidor (`actions`):** Define la acción `enviarRecordatorio`. Obtiene el ID de la cotización, email del cliente y datos de saldo mediante un `FormData`. Actualmente, esta acción funciona como un **placeholder** que imprime en los logs de la consola del servidor el envío ficticio a través de Resend y retorna un estado de éxito simulado:
        ```javascript
        console.log(`[Resend] Recordatorio de pago → ${emailCliente}`, { cotizacionId, folio, pendiente, nombreCliente });
        return { success: true, flash: `Recordatorio enviado a ${emailCliente}`, recordatorioId: cotizacionId };
        ```

2.  **[+page.svelte](file:///c:/Repositorios/GestorPyme/src/routes/cobranza/+page.svelte) (Vista Frontend):**
    *   Muestra un banner resumen con chips de urgencia (Vencidas >30 días, Alerta 15-30 días, Al día <15 días).
    *   Renderiza una tabla (`cartera-table`) con los datos del cliente, folio, estado de la cotización, monto pagado, monto pendiente y días transcurridos.
    *   **Envío de Recordatorios:** Cada fila de la tabla contiene un botón de recordatorio implementado dentro de un formulario HTML nativo que apunta al endpoint de la acción:
        ```html
        <form method="POST" action="?/enviarRecordatorio" use:enhance>
          <input type="hidden" name="cotizacionId"  value={c.id} />
          <!-- Otros campos ocultos de metadata del cobro -->
          <button type="submit" class="btn-recordatorio">📧 Recordatorio</button>
        </form>
        ```
    *   Al hacer clic en el botón, se dispara el envío y tras recibir la respuesta de éxito, se muestra un Toast flotante temporal con el mensaje `"Recordatorio enviado a [email]"`.

---

## 5. Comunicación Frontend-Backend

El frontend de Gestor PyME interactúa con el servidor de SvelteKit utilizando dos patrones principales de comunicación sin recurrir a Axios ni librerías externas de gestión de estado global:

1.  **Form Actions de SvelteKit (con `use:enhance`):**
    *   Para acciones mutadoras (como `enviarRecordatorio`), se envían formularios nativos con el atributo `method="POST"` que apuntan a una acción específica del servidor (`action="?/enviarRecordatorio"`).
    *   Se utiliza la directiva `use:enhance` importada de `$app/forms`. Esto realiza un comportamiento de **Progressive Enhancement**, interceptando el envío por JS para hacer una petición `fetch` asíncrona de fondo sin recargar la página completa, actualizando automáticamente el objeto reactivo `form` con los datos de respuesta devueltos por el backend.

2.  **Peticiones HTTP Asíncronas (Native `fetch`):**
    *   Para llamadas asíncronas directas basadas en JSON, el frontend realiza solicitudes asíncronas utilizando el `fetch` nativo del navegador.
    *   *Ejemplo actual:* El componente [FloatingAssistant.svelte](file:///c:/Repositorios/GestorPyme/src/lib/components/FloatingAssistant.svelte) implementa una llamada POST directa al endpoint `/api/chat` enviando el historial de mensajes:
        ```javascript
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, currentPath, userDetails })
        });
        ```

---

## 6. Manejo de Variables de Entorno

Las variables de entorno se definen localmente en el archivo [.env](file:///c:/Repositorios/GestorPyme/.env) ubicado en la raíz del proyecto. Estas variables se dividen y exponen según las políticas de SvelteKit:

1.  **Variables del Servidor (Privadas):**
    *   Se importan en el backend usando el módulo estático `$env/static/private` de SvelteKit. Esto garantiza que las credenciales **nunca se expongan en el código del cliente (navegador)**.
    *   *Ejemplos:* 
        *   `DATABASE_URL`: Utilizada por Prisma Client en [prisma.js (server)](file:///c:/Repositorios/GestorPyme/src/lib/server/prisma.js) para conectarse a Supabase.
        *   `CLERK_SECRET_KEY`: Utilizada por el middleware en `hooks.server.js`.
        *   `RESEND_API_KEY`: Usada para la API de correo en `resend.js`.
        *   `ANTHROPIC_API_KEY`: Usada para llamadas directas a Claude API en `+server.js`.
        *   `TAVUS_GPYME_API_KEY` y `PAL_ID`: Reservadas para el avatar de cobranza de Tavus.

2.  **Variables del Cliente (Públicas):**
    *   Se declaran en el archivo `.env` con el prefijo `PUBLIC_` y se importan usando `$env/static/public`. SvelteKit permite que el navegador tenga acceso a estas variables en tiempo de ejecución.
    *   *Ejemplo:* `PUBLIC_CLERK_PUBLISHABLE_KEY`: Utilizada por el proveedor de autenticación frontend en `+layout.svelte`.

3.  **Herramientas Externas de Servidor (Prisma):**
    *   Herramientas que corren en el CLI de Node fuera de SvelteKit (como `prisma db push` o `prisma generate`) cargan las variables de entorno leyendo directamente el `.env` mediante la librería `dotenv/config` configurada en [prisma.config.js](file:///c:/Repositorios/GestorPyme/prisma.config.js).
