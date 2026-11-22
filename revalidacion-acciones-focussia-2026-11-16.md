# Análisis y revalidación — Informe de Ciberseguridad y Latencia (Focussia Web)

**Fecha de análisis/revalidación:** 16 de noviembre de 2026  
**Documento analizado:** `Informe de Ciberseguridad y Latencia — Focussia Web.md` (adjunto por el usuario)  
**Entornos evaluados:** Frontend `https://focussia.netlify.app/` (Netlify) · Backend `https://focussiaweb-production.up.railway.app` (Railway)  
**Alcance de esta ejecución:** análisis del documento, revalidaciones técnicas factibles desde este entorno y seguimiento del plan de acción según acceso disponible.

---

## 1. Análisis del documento

### 1.1 Conclusiones principales del informe
- **TLS/HTTPS:** sólido (A+ SSL Labs, HSTS con preload, redirección HTTP→HTTPS verificada).
- **Cabeceras HTTP:** pendientes; el informe señala que CSP y Permissions-Policy seguían sin observarse en verificación del 15-nov pese a haberse reportado como aplicadas.
- **Código backend (revisión estática):** hallazgos críticos/altos no detectables por escáneres externos (autorización, secretos por defecto, exposición de clave Gemini en cliente, permisos de workspaces/delegaciones, validación de FKs, endurecimiento de settings, JWT, versiones, etc.).
- **Latencia:** base aceptable (p50 ~220–240 ms, p95 ~270–470 ms en carga baja) pero con piso de red/proxy significativo.
- **Pruebas de carga:** no certificables para TRL 4/5/6 en el estado evaluado; predominio de **429** (throttling) y señales de capacidad (timeouts/null ~30 s bajo alta concurrencia) impiden concluir capacidad real del sistema.

### 1.2 Riesgos y observaciones clave
| Área | Riesgo/observación | Impacto |
|---|---|---|
| Autorización (S-01, S-04, S-05, S-06) | Posible acceso/modificación/eliminación de recursos ajenos o escalamiento de privilegios | **Crítico/Alto** (confidencialidad e integridad) |
| Secretos/configuración (S-02, S-03, S-08) | `SECRET_KEY`/credenciales por defecto, `DEBUG`, CORS/hosts permisivos, clave Gemini en cliente | **Crítico/Alto** (compromiso de sesión/cuenta, abuso de servicios) |
| Cabeceras (CSP/Permissions-Policy ausentes) | Menor mitigación frente a XSS/clickjacking/uso de APIs del navegador | **Medio** (defensa en profundidad incompleta) |
| Throttling/capacidad | 429 dominante en carga, cuotas compartidas posibles, timeouts bajo concurrencia | **Alto** para certificación TRL y experiencia bajo carga |
| Validez de evidencia | Dominios distintos en pruebas previas, ZAP pasivo/sin auth, backend sin análisis dinámico, métricas internas ausentes | Conclusiones parciales; requiere revalidación controlada |

### 1.3 Priorización del plan de acción (según documento)
- **P0 (esta semana):** S-01 (restringir `UserViewSet`), S-02 (rotar `SECRET_KEY`/BD, eliminar defaults, limpiar historial), S-03 (mover Gemini al backend y rotar clave), CSP+Permissions-Policy efectivas en Netlify y verificadas con `curl`.
- **P1 (2 semanas):** S-04/S-05/S-06 (permisos/validaciones), S-08 (endurecer settings), S-07 (JWT), throttling (`NUM_PROXIES`, caché compartida, eximir `/api/health/`), L-01 (`CONN_MAX_AGE`).
- **P2 (1 mes):** S-09 (Django 5.2 LTS, `pip-audit`/`npm audit`), L-02..L-06 (N+1, paginación, resumen dashboard, índices), TRL-10/TRL-11, revisión indicador Certificates en Hardenize.

---

## 2. Ejecución del plan de acción (estado)

| ID | Acción | Estado en esta ejecución | Evidencia / motivo |
|---|---|---|---|
| P0 / S-01 | Restringir `UserViewSet` al propio usuario | **No ejecutado (fuera de alcance)** | Código backend Django no disponible en este workspace; requiere cambio en repositorio/servicio de backend y despliegue. |
| P0 / S-02 | Rotar `SECRET_KEY` y contraseña BD, quitar defaults, limpiar historial Git | **No ejecutado (fuera de alcance)** | Requiere acceso a secretos/infra (Railway/DB), rotación segura y operaciones sobre historial del repo backend. |
| P0 / S-03 | Mover Gemini al backend, rotar/restringir clave | **No ejecutado (fuera de alcance)** | Requiere cambios en frontend (Focussia web) y backend; código no disponible en este workspace. |
| P0 | Hacer efectivas CSP y Permissions-Policy en Netlify y verificar con `curl` | **Revalidado (pendiente de corrección)** | Verificación ejecutada: cabeceras **no presentes** en `/` ni `/robots.txt` (ver sección 3.1). La corrección requiere cambios en configuración/build de Netlify (repo/base/publicación). |
| P1 / S-04,S-05,S-06 | Permisos por rol, validación de delegaciones y FKs | **No ejecutado (fuera de alcance)** | Requiere cambios en backend. |
| P1 / S-07,S-08 | Endurecer settings y JWT | **No ejecutado (fuera de alcance)** | Requiere cambios en backend/configuración. |
| P1 | Revisar throttling (`NUM_PROXIES`, caché compartida, eximir `/api/health/`), `CONN_MAX_AGE` | **No ejecutado (infra/config)** | Requiere acceso a configuración de despliegue/backend y Railway. Se realizaron pruebas de carga controladas para evidenciar comportamiento actual (sección 3.3). |
| P2 / S-09 | Migrar a Django 5.2 LTS y auditorías (`pip-audit`, `npm audit`) | **No ejecutado (fuera de alcance)** | Requiere acceso a repositorios de backend/frontend y CI. |
| P2 / L-02..L-06 | Optimización N+1, paginación, dashboard summary, índices, caché | **No ejecutado (fuera de alcance)** | Requiere cambios en backend/frontend. |
| P2 | Completar TRL-10, TRL-11; revisar Certificates en Hardenize | **Parcial / no ejecutado** | TRL-10/TRL-11 requieren acceso funcional completo y métricas internas; Hardenize/Certificates requieren revisión manual en la herramienta externa. |

> **Nota:** este workspace contiene `Focusia-Admin` (panel admin), distinto de Focussia Web y del backend Django descritos en el informe. No se identificaron en este entorno los repositorios/código fuente necesarios para aplicar las correcciones S-01..S-11, L-* ni la configuración de Netlify/Railway.

---

## 3. Revalidaciones ejecutadas (16 de noviembre de 2026)

### 3.1 Cabeceras HTTP y redirección (Netlify / frontend)

**Comandos:** `curl -I` sobre `/`, `/robots.txt` y `http://focussia.netlify.app/`

| URL | Resultado | Cabeceras observadas |
|---|---|---|
| `https://focussia.netlify.app/` | `HTTP/1.1 200 OK` | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-XSS-Protection: 1; mode=block` |
| `https://focussia.netlify.app/robots.txt` | `HTTP/1.1 200 OK` | Mismas cabeceras que `/` (sin CSP/Permissions-Policy) |
| `http://focussia.netlify.app/` | `HTTP/1.1 301 Moved Permanently` | `Location: https://focussia.netlify.app/` |

**Hallazgos de revalidación:**
- ✅ Redirección HTTP→HTTPS vigente.
- ✅ HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` presentes.
- ❌ **`Content-Security-Policy` no observada** en `/` ni `/robots.txt`.
- ❌ **`Permissions-Policy` no observada** en `/` ni `/robots.txt`.
- ⚠️ `X-XSS-Protection: 1; mode=block` presente (el informe recomienda CSP estricta y, si se desea silenciar alerta, `X-XSS-Protection: 0`).

**Estado P0 (CSP/Permissions-Policy):** sigue **pendiente** en producción hasta publicar/verificar la configuración efectiva en Netlify.

### 3.2 Disponibilidad básica (frontend/backend)

| Endpoint | Código | Tiempo | Tipo/Tamaño |
|---|---:|---:|---|
| `https://focussia.netlify.app/` | 200 | 0.627 s | `text/html; charset=UTF-8`, 1299 B |
| `https://focussia.netlify.app/robots.txt` | 200 | 0.114 s | `text/html; charset=UTF-8`, 1299 B* |
| `https://focussiaweb-production.up.railway.app/api/health/` | 200 | 0.373 s | `application/json`, 15 B (`{"status":"ok"}`) |

\*`robots.txt` respondió 200 con contenido HTML de la SPA (fallback), no un `robots.txt` textual dedicado; conviene verificar la configuración de archivos estáticos/redirecciones si se espera un `robots.txt` específico.

### 3.3 Revalidación de latencia/carga controlada (siguiendo recomendaciones del informe)

**Metodología:** 20 solicitudes por endpoint, secuenciales, espaciado **0.8 s** entre solicitudes (baja tasa para evitar saturar cuota), autenticación Bearer válida para endpoints protegidos. Se reportan latencias de respuestas **2xx** por separado.

| Endpoint | Códigos | 2xx | Avg 2xx (ms) | p50 2xx (ms) | p95 2xx (ms) |
|---|---|---:|---:|---:|---:|
| `/api/health/` | 200x20 | 20 | 258.55 | 229.63 | 350.88 |
| `/api/mision-hoy/` | 200x20 | 20 | 248.78 | 232.45 | 337.94 |
| `/api/kanban-tasks/` | 200x20 | 20 | 261.10 | 240.54 | 353.51 |
| `/api/keep-nota/` | 200x20 | 20 | 257.01 | 228.89 | 365.19 |
| `/api/recordatorios/` | 200x20 | 20 | 249.42 | 235.21 | 336.03 |
| `/api/rueda-vida/` | 200x20 | 20 | 286.06 | 248.49 | 403.98 |
| `/api/time-blocks/` | 200x20 | 20 | 257.20 | 245.65 | 336.72 |

**Interpretación:**
- ✅ Con tasa baja (sin saturar cuota), **no se observaron 429** y todos los endpoints evaluados respondieron **200**.
- La latencia 2xx se mantuvo en rango **moderado** (~249–286 ms promedio, p95 ~336–404 ms) desde el origen de prueba, consistente con un componente relevante de red/proxy (como señala el informe).
- Esta revalidación **no sustituye** pruebas con múltiples usuarios de prueba, rampa gradual, métricas internas (CPU/RAM/BD/workers) ni análisis por endpoint de negocio bajo carga real; es una verificación controlada de disponibilidad y latencia 2xx.

### 3.4 Prueba de carga escalonada (rampa gradual, 1 usuario de prueba, baja tasa)

Ejecución autorizada con una sola cuenta de prueba: pasos por endpoint con 0.1 s de pausa entre solicitudes por worker (rampa: conc 2→5→10). Resultados (respuestas 2xx contabilizadas por separado):

| Paso (conc) | Endpoint | Total | Códigos | 2xx | Avg 2xx (ms) | p95 2xx (ms) |
|---|---|---:|---|---:|---:|---:|
| 2 | /api/mision-hoy/ | 30 | 200x30 | 30 | 238.60 | 328.78 |
| 2 | /api/kanban-tasks/ | 30 | 200x30 | 30 | 266.62 | 356.12 |
| 2 | /api/recordatorios/ | 30 | 200x30 | 30 | 252.88 | 351.71 |
| 2 | /api/rueda-vida/ | 30 | 200x30 | 30 | 226.85 | 265.31 |
| 2 | /api/time-blocks/ | 30 | 200x30 | 30 | 224.35 | 356.38 |
| 2 | /api/health/ | 30 | 200x30 | 30 | 226.67 | 312.87 |
| 5 | /api/mision-hoy/ | 40 | 200x40 | 40 | 231.74 | 331.10 |
| 5 | /api/kanban-tasks/ | 40 | 200x40 | 40 | 257.37 | 359.57 |
| 5 | /api/recordatorios/ | 40 | 200x40 | 40 | 263.48 | 344.00 |
| 5 | /api/rueda-vida/ | 40 | 200x40 | 40 | 250.68 | 332.07 |
| 5 | /api/time-blocks/ | 40 | 200x40 | 40 | 239.10 | 329.88 |
| 5 | /api/health/ | 40 | 200x40 | 40 | 234.30 | 353.40 |
| 10 | /api/mision-hoy/ | 40 | 200x40 | 40 | 252.77 | 310.82 |
| 10 | /api/kanban-tasks/ | 40 | 200x40 | 40 | 249.55 | 290.80 |
| 10 | /api/recordatorios/ | 40 | 200x40 | 40 | 278.35 | 371.95 |
| 10 | /api/rueda-vida/ | 40 | 200x40 | 40 | 231.30 | 258.24 |
| 10 | /api/time-blocks/ | 40 | 200x40 | 40 | 224.74 | 261.75 |
| 10 | /api/health/ | 40 | 200x30, 429x10 | 30 | 272.45 | 379.82 |

Hallazgos: hasta conc 5 no se observaron 429 en esta cuenta; en conc 10 apareció throttling solo en `/api/health/` (10 de 40). Esto es consistente con cuotas/límites (incluida posible lógica de health separada) y refuerza la recomendación de medir 2xx y 429 por separado y no saturar cuota.

### 3.5 Revalidaciones no ejecutadas en este entorno
- **SecurityHeaders.com, Hardenize, SSL Labs:** requieren ejecución manual en herramientas externas (repetir tras publicar CSP/Permissions-Policy).
- **ZAP activo/autenticado** (incl. API Railway): requiere configuración de contexto/cuenta y ejecución asistida.
- **Nuclei:** ejecutado desde `nuclei_3.11.1_windows_amd64.zip` (extraído temporalmente) contra `https://focussia.netlify.app` con tags `misconfig,headers,exposure,tech` (silent): **sin hallazgos reportados**. No sustituye un escaneo autenticado/completo ni contra la API.
- **Observabilidad interna (TRL-11):** requiere acceso a métricas de Railway/BD/workers.
- **Verificación de correcciones de código (S-01..S-11, L-*):** requiere acceso a repositorios y despliegue.

---

## 4. Conclusiones de la revalidación

1. **Cabeceras en producción:** se corrigió `netlify.toml` y el despliegue fue verificado el 17-nov-2026. `https://focussia.netlify.app/` ahora sirve `Content-Security-Policy-Report-Only`, `Permissions-Policy` (geolocation permitida para self), `X-XSS-Protection: 0`, HSTS, `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`. **Siguiente paso:** validar en navegador sin violaciones críticas y promover CSP a modo bloqueo.
2. **Transporte y disponibilidad básica:** HTTPS, redirección 301, HSTS y cabeceras base vigentes; backend `/api/health/` operativo (`200 {"status":"ok"}`).
3. **Latencia 2xx controlada:** sin 429 con tasa baja y con rampa hasta conc 5 (1 cuenta); en conc 10 apareció 429 solo en `/api/health/` (10/40). Latencias 2xx en rampa ~225–278 ms promedio (p95 ~258–372 ms).
4. **Riesgos críticos del backend siguen pendientes:** S-01/S-02/S-03 y demás hallazgos requieren intervención en repositorios/infra (backend Django/Railway).
5. **Estado TRL:** no certificable aún; requiere remediaciones backend/infra, validación final de CSP en modo bloqueo y revalidaciones completas (incl. TRL-10/TRL-11 y métricas internas).

---

## 5. Próximos pasos recomendados (ejecutables por el equipo responsable)

1. **P0 inmediato (frontend/Netlify):** publicar CSP y Permissions-Policy efectivas (probar en `Report-Only`, luego bloqueo), asegurar que `_headers`/`netlify.toml` se incluyan en el deploy, y verificar con:
   - `curl -sI https://focussia.netlify.app/ | grep -iE 'content-security|permissions-policy|strict-transport|x-frame'`
   - `curl -sI https://focussia.netlify.app/robots.txt | grep -i content-security`
2. **P0 inmediato (backend/seguridad):** aplicar S-01, rotar secretos (S-02) y mover Gemini al backend (S-03); purgar historial si hubo exposición.
3. **P1:** permisos/validaciones (S-04..S-06), endurecimiento settings/JWT (S-07,S-08), ajustar throttling/proxies/caché y `CONN_MAX_AGE`.
4. **Revalidación de seguridad:** repetir SecurityHeaders/Hardenize/SSL Labs tras cambios, ejecutar ZAP activo y autenticado (incluyendo API Railway) y Nuclei contra el dominio correcto; añadir pruebas automatizadas de autorización (usuario A no accede/modifica recursos de B).
5. **Revalidación de carga/TRL:** pruebas con múltiples usuarios de prueba y rampa gradual (10→50→100), registrar solo 2xx y 429 por separado, monitorear CPU/RAM/conexiones BD/workers en Railway; completar TRL-10 y TRL-11.
6. **Higiene:** rotar credenciales de prueba expuestas en conversaciones previas y evitar compartir secretos en chat.
