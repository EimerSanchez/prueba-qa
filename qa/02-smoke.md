# Suite de Pruebas de Humo (Smoke Test Suite) · EnergIA

- **Autor:** Eimer Antonio Sánchez Carreño (Senior QA Automation Engineer)
- **Objetivo:** Verificar el conjunto **mínimo y crítico** de verificaciones que certifican si el build desplegado en Docker está en condiciones operativas para iniciar un ciclo formal de pruebas de regresión y funcionales.
- **Criterio de Aceptación:** Si cualquiera de estos casos falla con severidad bloqueante, el build es rechazado de inmediato (*Build Rejected*).

---

## 1. Definición y Justificación de Casos de Humo

| ID | Componente / Capa | Verificación Clave | Justificación de Selección |
|:---:|:---:|---|---|
| **SMK-01** | Backend / Infra | Disponibilidad básica del servidor HTTP (`GET /health`) | Si el servicio no responde un estado HTTP 200 y JSON válido, la infraestructura base está caída y ninguna prueba posterior puede ejecutarse. |
| **SMK-02** | Backend / Auth | Autenticación con credenciales por defecto (`POST /api/v1/auth/login`) | EnergIA protege todas sus rutas de negocio tras un JWT. Sin login funcional, la plataforma queda 100% inaccesible para el operador y para la UI. |
| **SMK-03** | Backend / Data | Ingesta de datos e integridad del Store (`POST /api/v1/meter/getAll`) | Verifica que el archivo `readings.csv` se haya leído y parseado en memoria sin fallas de arranque, devolviendo el catálogo de medidores. |
| **SMK-04** | Backend / Motor | Disponibilidad de anomalías calculadas (`GET /api/v1/anomaly/getAll`) | Comprueba que el motor analítico se haya ejecutado durante el arranque (*startup*) y haya generado las anomalías esperadas sin colapsar. |
| **SMK-05** | Backend / Dashboard | Métricas consolidadas de planta (`GET /api/v1/dashboard/getSummary`) | Verifica que el agregador de KPIs y órdenes de prioridad responda de forma coherente para alimentar la pantalla principal. |
| **SMK-06** | Frontend / Web | Carga de la aplicación web y redirección segura (`GET http://localhost:3000/`) | Comprueba que el contenedor de Nginx sirva los assets compilados de React (HTML, JS, CSS) y que el enrutador redirija a `/login` ante la ausencia de sesión. |
| **SMK-07** | Frontend / UI | Login interactivo y renderizado del Despacho | Valida el ciclo completo de interacción en el navegador: ingreso de credenciales en el formulario, almacenamiento de token en memoria/contexto y despliegue del AppShell. |

---

## 2. Matriz de Ejecución y Resultados

**Entorno de Ejecución:**
- Host: Windows 11 / Docker Desktop 29.9.1 (Docker Compose v5.6.0)
- Backend: Go 1.26 (distroless container, puerto 8080)
- Frontend: React 19 + Nginx 1.27 (puerto 3000)
- Fecha de Ejecución: 21 de Octubre de 2026, 12:03 COT (`America/Bogota`)

| ID | Caso de Prueba | Entrada / Request | Salida Esperada | Salida Obtenida | Estado |
|:---:|---|---|---|---|:---:|
| **SMK-01** | Healthcheck del Backend | `curl -s http://localhost:8080/health` | HTTP 200 `{"status":"ok"}` | HTTP 200 `{"status":"ok"}` | 🟢 **PASS** |
| **SMK-02** | Generación de JWT | `POST /api/v1/auth/login`<br>`{"email":"admin@energia.local","password":"admin123"}` | HTTP 200, JWT no vacío, `token_type: "Bearer"`, usuario `Operador` | HTTP 200, JWT emitido con claims de `Operador` y TTL 8h | 🟢 **PASS** |
| **SMK-03** | Lectura del catálogo de medidores | `POST /api/v1/meter/getAll`<br>`Header: Authorization: Bearer <token>` | HTTP 200, `count: 12`, lista con medidores M-101 a M-112 | HTTP 200, array de 10 elementos (página 1 de 12), `count: 12` | 🟢 **PASS** |
| **SMK-04** | Consulta de anomalías del motor | `GET /api/v1/anomaly/getAll`<br>`Header: Authorization: Bearer <token>` | HTTP 200, exactamente 4 anomalías detectadas ordenadas por prioridad | HTTP 200, 4 anomalías (M-109, M-112, M-104, M-106) con evidencia completa | 🟢 **PASS** |
| **SMK-05** | Consolidado del Dashboard | `GET /api/v1/dashboard/getSummary`<br>`Header: Authorization: Bearer <token>` | HTTP 200, `total_meters: 12`, `anomalies_detected: 4`, consumo y KPI válidos | HTTP 200, `total_meters: 12`, `anomalies_detected: 4`, `ai_confidence: 0.9` | 🟢 **PASS** |
| **SMK-06** | Carga de assets estáticos Frontend | `GET http://localhost:3000/` | HTTP 200, HTML válido conteniendo bundle JS y estilos compilados | HTTP 200, Nginx sirve `index.html` con assets cacheados | 🟢 **PASS** |
| **SMK-07** | Flujo Login UI en Navegador | Navegar a `http://localhost:3000/login`, ingresar credenciales y pulsar "Iniciar sesión" | Redirección a `/` (Despacho), presencia de tabla de medidores y panel de KPI | Redirección inmediata a Despacho, tabla renderizada con 10 medidores y KPIs visibles | 🟢 **PASS** |

---

## 3. Conclusión de la Suite de Humo

Todos los 7 casos fundamentales de humo resultaron **exitosos (7/7 PASS)**. La aplicación demuestra estabilidad de arranque, comunicación fluida entre el proxy de Nginx y la API en Go, y persistencia de datos en memoria sin cuelgues.

**Veredicto:** El build cumple con los criterios mínimos de aceptación técnica para ser sometido al ciclo formal de pruebas funcionales de caja negra y pruebas automatizadas E2E.
