# Plan de remediación ejecutable — Focussia Web

Fecha: 16 de noviembre de 2026  
Base: `Informe de Ciberseguridad y Latencia — Focussia Web.md` + revalidaciones del 16-nov-2026.

> **Alcance de esta ejecución:** se prepararon artefactos y verificaciones factibles desde este entorno. Los cambios de código/infra en los repos de Focussia Web (frontend), backend Django y Railway/Netlify deben aplicarse por el equipo con acceso a esos sistemas.

---

## 1. Estado de verificación (16-nov-2026)

| Verificación | Resultado |
|---|---|
| `https://focussia.netlify.app/` headers (`curl -I`) | **Faltan:** `Content-Security-Policy`, `Permissions-Policy`. **Presentes:** `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-XSS-Protection: 1; mode=block`. |
| Redirección HTTP→HTTPS | OK (`301` a `https://focussia.netlify.app/`). |
| `/api/health/` backend Railway | OK (`200 {"status":"ok"}`). |
| Latencia 2xx controlada (baja tasa, auth) | ~249–286 ms avg, p95 ~336–404 ms; sin 429 con tasa baja. |
| Rampa (conc 2/5/10, 1 cuenta) | 100% 200 en conc 2 y 5; en conc 10 apareció 429 solo en `/api/health/` (10/40). |
| Nuclei (tags misconfig,headers,exposure,tech) | Sin hallazgos en escaneo silencioso contra `https://focussia.netlify.app`. |

---

## 2. P0 — Acciones inmediatas (equipo con acceso)

### 2.1 Frontend Netlify: CSP y Permissions-Policy (P0)
**Objetivo:** publicar cabeceras efectivas y verificarlas.

**Estado (17-nov-2026):** se corrigió la configuración en `C:\Users\Lenovo\Desktop\Onix Solutions\clientes\HIGEA\Focussia web\netlify.toml`:
- Se reparó la sección `[[headers]]` (estaba malformada, lo que impedía aplicar CSP/Permissions-Policy).
- Se configuró `Permissions-Policy` permitiendo `geolocation=(self)` y `X-XSS-Protection: 0`.
- Se añadió `Content-Security-Policy-Report-Only` con `connect-src` incluyendo `https://focussiaweb-production.up.railway.app`, Open-Meteo, Nominatim y Google APIs (ajustar si es necesario).
- Se añadieron redirecciones HTTP→HTTPS para `focussia.netlify.app` y `focusia.netlify.app`.

**Pendiente:** desplegar/publicar este cambio en Netlify (commit/push o deploy según flujo del repo) y verificar en producción:
```bash
curl -sI https://focussia.netlify.app/ | grep -iE 'content-security|permissions-policy|strict-transport|x-frame|x-content-type-options|referrer-policy|x-xss-protection'
curl -sI https://focussia.netlify.app/robots.txt | grep -iE 'content-security|permissions-policy'
```
Tras validar sin violaciones, cambiar `Content-Security-Policy-Report-Only` a `Content-Security-Policy`.

> **Nota:** `robots.txt` actualmente responde con HTML (fallback SPA). Revisar configuración de archivos estáticos/redirecciones si se requiere un `robots.txt` textual.

### 2.2 Backend Django: S-01 (autorización crítica)
**Riesgo:** cualquier usuario autenticado podría listar/editar/eliminar cuentas ajenas si `UserViewSet` expone `User.objects.all()` sin restricción.

**Cambio recomendado (ejemplo):**
```python
# views.py
class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']  # excluir delete si no aplica

    def get_queryset(self):
        return User.objects.filter(pk=self.request.user.pk)

    # Si existe list, deshabilitarlo o devolver solo el propio usuario
```
- Añadir pruebas: usuario A no puede GET/PATCH/DELETE `/api/users/{id_de_B}/` (esperar 403/404).

### 2.3 Backend/Infra: S-02 (secretos y configuración)
**Acciones (requieren acceso a Railway/repos/DB):**
- Rotar `SECRET_KEY` y contraseña de PostgreSQL; exigir por variables de entorno **sin valores por defecto**.
- `DEBUG=False` por defecto en producción.
- Depurar historial de Git si hubo exposición (`git filter-repo`/BFG) y rotar cualquier secreto comprometido.
- Revisar y rotar credenciales de prueba expuestas en conversaciones.

### 2.4 Frontend/Backend: S-03 (Gemini)
- Mover llamadas a Gemini a un endpoint backend autenticado con throttling propio.
- Rotar/restringir la clave API; eliminar su uso/exposición en el bundle del cliente.

---

## 3. P1 — Endurecimiento y estabilidad

| ID | Acción | Responsable/Acceso |
|---|---|---|
| S-04 | Permisos por rol en workspaces; restringir PATCH/DELETE/invite/update_member_role; validar roles permitidos (excluir `owner` en asignaciones indebidas) | Backend |
| S-05 | Validar `request.user` en delegaciones, transiciones de estado, expiración de token y asignación real al aceptar | Backend |
| S-06 | Validar pertenencia/rol en serializers (`workspace`, `assigned_to`) y filtrar por membership | Backend |
| S-07 | JWT: access corto (15–30 min), rotación/blacklist de refresh, considerar cookie `HttpOnly` + CSP | Backend/Frontend |
| S-08 | `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` restringidos; `AUTH_PASSWORD_VALIDATORS`; banderas `SECURE_*`, `SECURE_PROXY_SSL_HEADER`, cookies seguras | Backend/Infra |
| Throttling | Revisar cuotas, `NUM_PROXIES`, caché compartida (Redis) consistente entre workers, eximir `/api/health/` si aplica | Backend/Infra |
| L-01 | `CONN_MAX_AGE=60` (y PgBouncer si crece la concurrencia) | Backend/Infra/DB |

**Ejemplo de endurecimiento `settings.py` (adaptar al entorno):**
```python
SECRET_KEY = os.environ['SECRET_KEY']
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')
# CORS_ALLOWED_ORIGINS = ['https://focussia.netlify.app']
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
# DATABASES['default']['CONN_MAX_AGE'] = 60
```

---

## 4. P2 — Optimización, mantenimiento y certificación

| ID | Acción | Notas |
|---|---|---|
| S-09 | Migrar a Django 5.2 LTS; ejecutar `pip-audit` y `npm audit` en CI | Requiere acceso a repos/CI |
| L-02..L-06 | Corregir N+1 (`select_related`/`prefetch_related`), paginación, endpoint resumen dashboard, índices, caché/`Cache-Control` | Priorizar según métricas y endpoints lentos |
| TRL-10/TRL-11 | Completar flujos funcionales internos y observabilidad (CPU/RAM/BD/workers) | Requiere acceso operativo y cuentas de prueba |
| Revalidaciones externas | SecurityHeaders, Hardenize (revisar indicador Certificates), SSL Labs (reporte completo), ZAP activo/autenticado (incl. API Railway), Nuclei en dominio correcto | Tras aplicar correcciones |

---

## 5. Revalidación de carga recomendada (post-ajustes)

1. Usar **múltiples usuarios de prueba** y rampa gradual (p. ej. 10 → 50 → 100).
2. Registrar latencias **solo de respuestas 2xx** y contabilizar `429`/errores por separado.
3. Monitorear CPU, RAM, conexiones PostgreSQL y workers en Railway durante la prueba.
4. Ajustar throttling/capacidad y repetir para comparar p50/p95/RPS efectivo.
5. Para pruebas de capacidad sin cuota, usar staging con throttling relajado.

---

## 6. Resumen de lo ejecutado en esta sesión
- Revalidación de cabeceras HTTP y redirección en producción.
- Verificación de `/api/health/`.
- Pruebas de latencia 2xx a baja tasa y prueba escalonada (conc 2/5/10) con separación de 2xx/429.
- Escaneo Nuclei (`misconfig,headers,exposure,tech`) contra `https://focussia.netlify.app`: sin hallazgos.
- Preparación de artefactos de remediación (`plan-remediacion-focussia.md`, `netlify-headers-recomendado.txt`).

**Pendiente de ejecución por el equipo:** cambios de código/config/infra en los repositorios y servicios reales (frontend Focussia, backend Django, Netlify, Railway), rotación de secretos y revalidaciones externas/autenticadas con métricas internas.
