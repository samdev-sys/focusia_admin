# Focusia · Panel de contenido

Panel de administración de contenido de Focusia. Es una **app React independiente**
separada de la app de usuario: se compila y se despliega por su cuenta, y convive
en `/admin` sin mezclarse con la app normal.

## Qué administra

| Sección | Contenido |
|---|---|
| **Resumen** | Estado del contenido publicado y huecos por completar |
| **Tabla maestra** | Los 12 meses del programa: tema, capacitación, video y frases diarias |
| **Tribu** | Temas semanales (solo uno activo a la vez) |
| **Aprendizaje** | Categorías, módulos de referencia y bloques de la visita guiada de INICIO |
| **Avatares** | Imágenes, voces y mensajes de presentación del onboarding |
| **Juegos y retos** | Catálogo de enlaces a juegos, con portada, orden y categoría |
| **Usuarios e IA** | Nivel por mes alcanzado, membresías personalizadas y asistente IA (análisis + chat) |

Los medios aceptan **URL pegada o archivo subido**. Cuando hay ambos, gana la URL.

## Requisitos

- Node.js 18+
- El backend Django corriendo (el panel es una API, no guarda nada por su cuenta)

## Puesta en marcha

```bash
npm install
cp .env.example .env     # ajustar VITE_API_URL si el backend no está en :8000
npm run dev              # http://localhost:3001
```

Otros comandos:

```bash
npm run build      # genera dist/
npm run preview    # sirve dist/ para probar el build
npm run lint       # tsc --noEmit
```

## Acceso

Se entra con una cuenta que tenga **`is_staff`** activa en Django. La pantalla de
inicio de sesión usa el mismo endpoint de token que la app de usuario
(`POST /api/token/`), así que las cookies y el flujo son idénticos.

Si la contraseña es correcta pero la cuenta no es staff, el panel lo dice
explícitamente en vez de mostrar un error genérico.

## De qué depende del backend

El panel no tiene modelos propios: es cliente de la API `/api/admin/`, que exige
`is_staff` en cada endpoint. Recursos que administra:

- `program-months` · `trainings` · `program-days` — tabla maestra
- `tribu-themes` — temas semanales
- `learning-categories` · `learning-modules` · `guided-tour-blocks` — aprendizaje
- `avatars` — avatares
- `juegos` — catálogo de juegos
- `usuarios` — nivel y progreso por usuario (+ `analizar`)
- `membresias` — membresías personalizadas (inicio/fin por usuario)
- `asistente/chat` — chat del admin con la IA
- `session` · `overview` — perfil del admin y resumen

Los borrados que afectarían progreso ya registrado devuelven `409` con una
explicación en vez de dejar que el `CASCADE` rompa datos de otras personas.

## Estructura

```
src/
  AdminApp.tsx        flujo de sesión y cambio de sección
  main.tsx            punto de entrada
  index.css           Tailwind v4 + tema
  lib/adminApi.ts     cliente HTTP, tipos y endpoints
  components/         ui.tsx (piezas compartidas) y AdminLayout (menú)
  screens/            una pantalla por sección
```

## Notas de despliegue

- Se sirve en `/admin`: configurá el host estático para que `index.html` de este
  proyecto responda en esa ruta.
- Los archivos subidos salen de `MEDIA_URL` del backend. En desarrollo hay proxy
  de `/media` y `/api`; en producción ambos deben ser accesibles desde el panel.
- El backend sirve `/media/` solo con `DEBUG=True`. En producción hay que poner
  los archivos en un servicio estático (S3, nginx, etc.).
