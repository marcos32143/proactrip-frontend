# ProacTrip — Frontend

Interfaz web de **ProacTrip**, una aplicación de viajes para buscar vuelos y hoteles, ver mapas y clima del destino y gestionar tu cuenta, con búsqueda asistida por IA.

Este repositorio contiene solo el **frontend** (Next.js). El backend (API en Go) vive en otro repositorio: [ProacTrip/Backend](https://github.com/ProacTrip/Backend).

> **Demo en vivo:** pendiente de desplegar.

## Tecnologías

| Área | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) y React 19 |
| Lenguaje | TypeScript 5 |
| Estilos | Tailwind CSS 4 |
| Datos del servidor | TanStack Query 5 |
| Animaciones | Framer Motion 12 y dotLottie |
| Componentes accesibles | Headless UI 2 |
| Mapas | Leaflet y react-leaflet (teselas de OpenStreetMap) |
| Iconos | lucide-react y react-icons |

## Qué incluye

- **Vuelos:** búsqueda por origen, destino y fechas, filtros y detalle del vuelo con sus opciones de reserva.
- **Hoteles:** búsqueda con filtros, mapa con precios, ficha del hotel y habitaciones.
- **Búsqueda con IA:** chat que interpreta una petición en lenguaje natural (requiere que el backend tenga la IA configurada).
- **Cuenta:** registro, inicio de sesión, verificación de correo, recuperación de contraseña, perfil, preferencias de viaje y documentos.
- **Entorno del usuario:** idioma, moneda, ubicación y clima según el visitante.
- **Tiempo real:** eventos del servidor mediante SSE.
- **Panel de administración:** gestión de usuarios y documentos.
- **Páginas en desarrollo:** checkout, compras, confirmación de reserva y favoritos.

La autenticación usa cookies `HttpOnly` (tokens PASETO) que envía el navegador con `credentials: 'include'`; el frontend nunca guarda los tokens.

## Puesta en marcha

### Requisitos

- Node.js 20.9 o superior.
- El backend de ProacTrip en marcha (por defecto en `http://localhost:8080`). Las instrucciones están en su repositorio.

### Pasos

```bash
git clone https://github.com/marcos32143/proactrip-frontend.git
cd proactrip-frontend
npm install
cp .env.example .env.local     # en Windows CMD: copy .env.example .env.local
npm run dev
```

Abre <http://localhost:3000>.

### Variables de entorno

Se definen en `.env.local`, que no se sube a git.

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Sí | URL del backend, por ejemplo `http://localhost:8080`. |
| `NEXT_PUBLIC_FEATURE_PASSWORD_RESET` | No | `true` activa la recuperación de contraseña en la interfaz. |
| `NEXT_PUBLIC_SIMULATE_IP` | No | Solo para desarrollo: IP pública que se envía al backend en la cabecera `X-Real-IP` para probar la detección de ubicación en local. |

Las variables con prefijo `NEXT_PUBLIC_` son visibles en el navegador: no pongas en ellas claves ni secretos.

### Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente. |
| `npm run build` | Compilación de producción. |
| `npm start` | Sirve la compilación de producción. |
| `npm run lint` | Revisa el código con ESLint. |
| `npm run typecheck` | Comprueba los tipos de TypeScript. |

## Estructura

```
src/
├── app/
│   ├── (site)/        # Páginas con la barra de navegación: vuelos, hoteles, búsqueda con IA,
│   │                  # perfil, documentos, favoritos, checkout, compras, contacto
│   ├── auth/          # Inicio de sesión, registro, verificación y recuperación
│   ├── admin/         # Panel de administración
│   ├── api/           # Rutas de servidor de Next.js (proxy de imágenes y gestión)
│   └── lib/           # Cliente de la API, tipos, constantes, utilidades y consultas
├── components/        # Componentes por dominio: navbar, home, auth, admin, ui, shared
├── contexts/          # Contextos de React (sesión y moneda)
└── hooks/             # Hooks de TanStack Query y utilidades (perfil, documentos, SSE...)
public/                # Imágenes, animaciones y recursos estáticos
```

## Despliegue

El proyecto está pensado para desplegarse en Vercel. En producción hay que definir `NEXT_PUBLIC_API_URL` con la URL pública del backend (por ejemplo `https://api.tudominio.com`) y alojar el backend en un dominio que comparta cookies con el frontend.

## Créditos

- **Frontend:** Marcos Casas.
- **Backend:** Marco Aurelio, en [ProacTrip/Backend](https://github.com/ProacTrip/Backend).
