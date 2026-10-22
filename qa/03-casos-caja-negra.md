# Casos de Prueba Funcionales de Caja Negra · EnergIA

- **Autor:** Eimer Antonio Sánchez Carreño (Senior QA Automation Engineer)
- **Metodología:** Diseño formal bajo el estándar ISTQB (International Software Testing Qualifications Board)
- **Formato Estándar:** `ID · Título · Técnica · Capa · Precondición · Pasos · Datos · Resultado Esperado · Resultado Obtenido · Estado`
- **Técnicas Aplicadas:**
  1. **Partición de Equivalencia (EP) & Análisis de Valores Límite (BVA)**: Campos de paginación, filtros de texto y números.
  2. **Tablas de Decisión (Decision Tables)**: Reglas de negocio del motor analítico (Anomalía, Dirección, Evento $\rightarrow$ Tipo, Severidad, Prioridad, Estado).
  3. **Pruebas Negativas y Validación de Esquemas**: Manejo de errores HTTP 400, 401, 404, payloads truncados y límites de tamaño.
  4. **Consistencia Inter-Capas**: Comparación estricta Documentación vs. API JSON vs. Renderizado en UI (formato `es-CO`).

---

## 1. Tabla de Decisión: Reglas del Motor Analítico

Antes del detalle de casos, se formaliza la tabla de decisión del motor según la documentación (`backend/README.md`):

| Regla | Desviación Sostenida ($\ge 6\text{ h}$) | Variables Eléctricas Coherentes | Evento Registrado | Evento Explica Dirección | ¿Consumo Volvió a Normal? | Tipo de Anomalía Esperado | Severidad | Prioridad | Estado de Medidor |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **R1** | No ($\text{Voltaje } \pm 5\%$ o $\text{FP } \pm 0.15 \ge 3\text{ h}$) | Incoherentes | N/A | N/A | N/A | `DATA_QUALITY` | `HIGH` ($\ge 12\text{ h}$) | 2 | `CRITICAL` |
| **R2** | Sí ($Z > 3.5$, variación $+110.5\%$) | Coherentes (Corriente $+109.9\%$) | Inexistente o `UNKNOWN` | No | No (Activo) | `REAL_ANOMALY` | `HIGH` ($>50\%$ y activo) | 1 | `CRITICAL` |
| **R3** | Sí (Caída de consumo) | Coherentes | `SCHEDULED_OUTAGE` | Sí (Explica caída) | Sí (Cerrado) | `FALSE_POSITIVE` | `LOW` | 4 | `NORMAL` |
| **R4** | Sí (Aumento de consumo) | Coherentes | `OPERATIONAL_CHANGE` | Sí (Explica aumento) | No (Se mantiene) | `EXPLAINABLE_ANOMALY` | `MEDIUM` | 3 | `ALERT` |
| **R5** | No ($Z \le 3.5$) | Coherentes | Ninguno | N/A | N/A | Sin anomalía | N/A | N/A | `NORMAL` |

---

## 2. Matriz de Casos de Prueba

### Bloque 1: Autenticación y Seguridad (API y UI)

#### TC-AUTH-01 · Login Exitoso con Credenciales Válidas
- **Técnica:** Partición de Equivalencia (Partición válida).
- **Capa:** API y UI.
- **Precondición:** Servidor activo.
- **Pasos:**
  1. Enviar petición `POST /api/v1/auth/login` con credenciales de operador.
- **Datos:** `{"email": "admin@energia.local", "password": "admin123"}`.
- **Resultado Esperado:** Código HTTP 200. Cuerpo JSON con `access_token` JWT válido, `token_type: "Bearer"`, `expires_in: 28800` (8h), y objeto `user: {"email": "admin@energia.local", "name": "Operador"}`.
- **Resultado Obtenido:** HTTP 200, JWT emitido correctamente con los claims esperados.
- **Estado:** 🟢 **PASS**

#### TC-AUTH-02 · Rechazo de Login con Contraseña Inválida (Negativo)
- **Técnica:** Partición de Equivalencia (Partición inválida).
- **Capa:** API.
- **Precondición:** Servidor activo.
- **Pasos:**
  1. Enviar petición `POST /api/v1/auth/login` con contraseña errónea.
- **Datos:** `{"email": "admin@energia.local", "password": "PasswordIncorrecta999"}`.
- **Resultado Esperado:** Código HTTP 401 Unauthorized. Cuerpo JSON con estructura de error estándar (`httpx.APIError`): `status_code: 401`, `message: "Email o contraseña incorrectos"`.
- **Resultado Obtenido:** HTTP 401 Unauthorized con el mensaje estándar esperado.
- **Estado:** 🟢 **PASS**

#### TC-AUTH-03 · Sensibilidad de Mayúsculas y Espacios en Email de Login
- **Técnica:** Partición de Equivalencia / Robustez.
- **Capa:** API y UI.
- **Precondición:** Servidor activo.
- **Pasos:**
  1. Enviar petición `POST /api/v1/auth/login` con email en mayúsculas iniciales y espacios alrededor.
- **Datos:** `{"email": " Admin@energia.local ", "password": "admin123"}`.
- **Resultado Esperado:** Código HTTP 200. El estándar de aplicaciones web y usabilidad en autenticación exige que el email sea normalizado (trimmed y lowercased) antes de validar.
- **Resultado Obtenido:** Código HTTP 200 OK con `access_token` y payload de usuario. La capa de validación en `internal/auth/dto.go:13` (`LoginRequest.Validate`) aplica exitosamente `strings.ToLower(strings.TrimSpace(r.Email))` antes de entregarlo a la capa de servicio.
- **Estado:** 🟢 **PASS**

#### TC-AUTH-04 · Acceso a Rutas Protegidas sin Token (Seguridad)
- **Técnica:** Prueba Negativa de Seguridad.
- **Capa:** API.
- **Precondición:** No enviar cabecera `Authorization`.
- **Pasos:**
  1. Realizar petición `GET /api/v1/meter/getParams`.
  2. Realizar petición `GET /api/v1/dashboard/getSummary`.
- **Datos:** Cabecera `Authorization` omitida.
- **Resultado Esperado:** Código HTTP 401 Unauthorized en ambos endpoints, impidiendo fuga de datos operativos.
- **Resultado Obtenido:** HTTP 401 con mensaje `"Falta el token de autenticación"`.
- **Estado:** 🟢 **PASS**

---

### Bloque 2: Libro de Medidores, Búsqueda y Paginación (EP, BVA y UI)

#### TC-MTR-01 · Paginación Límite Inferior y Tamaño por Defecto (BVA)
- **Técnica:** Análisis de Valores Límite (BVA en `page=1`, `size=10`).
- **Capa:** API.
- **Precondición:** Usuario autenticado con Bearer token.
- **Pasos:**
  1. Enviar `POST /api/v1/meter/getAll` con body vacío `{}`.
- **Datos:** Body vacío (aplica defaults).
- **Resultado Esperado:** HTTP 200. Objeto paginado plano `{"page": 1, "size": 10, "count": 12, "rows": [...]}`. Array `rows` con exactamente 10 elementos ordenados por `meter_id` ASC (M-101 a M-110).
- **Resultado Obtenido:** HTTP 200, devuelve estructura plana con `count: 12`, `rows` con 10 elementos (`M-101` a `M-110`).
- **Estado:** 🟢 **PASS**

#### TC-MTR-02 · Paginación Límite Superior en API (Página 2 de 2)
- **Técnica:** Análisis de Valores Límite (BVA en última página).
- **Capa:** API.
- **Precondición:** Usuario autenticado.
- **Pasos:**
  1. Enviar `POST /api/v1/meter/getAll` solicitando la página 2.
- **Datos:** `{"pagination": {"page": 2, "size": 10}}`.
- **Resultado Esperado:** HTTP 200. Array `rows` con exactamente 2 elementos correspondientes a los medidores finales `M-111` y `M-112`, con `count: 12`.
- **Resultado Obtenido:** HTTP 200, devuelve `count: 12` y `rows` con los 2 elementos restantes (`M-111` y `M-112`).
- **Estado:** 🟢 **PASS**

#### TC-MTR-03 · Navegación a Página 2 en UI (Botón Siguiente Deshabilitado)
- **Técnica:** Consistencia Inter-Capas / Verificación UI.
- **Capa:** UI (React).
- **Precondición:** Operador logueado en la pantalla `/medidores`.
- **Pasos:**
  1. Observar el componente de paginación al pie de la tabla.
  2. Intentar hacer clic en el botón "Siguiente" para ver `M-111` y `M-112`.
- **Datos:** 12 medidores en total, 10 por página.
- **Resultado Esperado:** El texto indica `"1–10 de 12 medidores"`. El botón "Siguiente" está habilitado. Al hacer clic, la tabla carga la página 2 mostrando `M-111` y `M-112`.
- **Resultado Obtenido:** El botón "Siguiente" tiene el atributo `disabled`. Es imposible hacer clic. La función en `Pagination.tsx` calcula `Math.floor(12 / 10) = 1`, por lo que el front asume que solo existe 1 página (`disabled={page >= pages}`).
- **Estado:** 🔴 **FAIL** *(Reportado en DEF-01)*

#### TC-MTR-04 · Validación de Tamaño Fuera de Límite en Paginación (Negativo BVA)
- **Técnica:** Análisis de Valores Límite (Valor inválido: `size=-5`).
- **Capa:** API.
- **Precondición:** Usuario autenticado.
- **Pasos:**
  1. Enviar `POST /api/v1/meter/getAll` con tamaño de página negativo.
- **Datos:** `{"pagination": {"page": 1, "size": -5}}`.
- **Resultado Esperado:** Código HTTP 400 Bad Request. `paging.go:32` valida que `size` esté entre 1 y 100 (`p.Size < 1 || p.Size > MaxPageSize`), retornando el mensaje `"pagination.size debe estar entre 1 y 100"`.
- **Resultado Obtenido:** HTTP 400 Bad Request con mensaje `"Filtros inválidos"` y detalle de error de validación en `pagination.size`.
- **Estado:** 🟢 **PASS**

#### TC-MTR-05 · Búsqueda Parcial de Medidor por Substring Numérico
- **Técnica:** Partición de Equivalencia (Búsqueda parcial).
- **Capa:** API y UI.
- **Precondición:** Usuario autenticado.
- **Pasos:**
  1. Enviar `POST /api/v1/meter/getAll` con `filter.meter_id = "109"`.
- **Datos:** `{"filter": {"meter_id": "109"}}`.
- **Resultado Esperado:** HTTP 200. Retorna únicamente el medidor `M-109`.
- **Resultado Obtenido:** HTTP 200, exactamente 1 resultado: `M-109`.
- **Estado:** 🟢 **PASS**

#### TC-MTR-06 · Búsqueda Parcial de Medidor en Minúsculas (Case-Insensitive)
- **Técnica:** Partición de Equivalencia / Robustez.
- **Capa:** API y UI.
- **Precondición:** Usuario autenticado.
- **Pasos:**
  1. Enviar `POST /api/v1/meter/getAll` con `filter.meter_id = "m-109"`.
- **Datos:** `{"filter": {"meter_id": "m-109"}}`.
- **Resultado Esperado:** HTTP 200. La documentación y Swagger indican expresamente: *"Búsqueda parcial, sin importar mayúsculas ('109' encuentra 'M-109')"*. Debe retornar `M-109` en `rows`.
- **Resultado Obtenido:** HTTP 200, pero devuelve un array vacío `rows: []` (`count: 0`). `strings.Contains("M-109", "m-109")` es sensible a mayúsculas.
- **Estado:** 🔴 **FAIL** *(Reportado en DEF-03)*

#### TC-MTR-09 · Vulnerabilidad en Límite Inferior de Página Negativa (BVA Crítico)
- **Técnica:** Análisis de Valores Límite / Robustez (BVA con `page = -1`).
- **Capa:** API Backend.
- **Precondición:** Usuario autenticado.
- **Pasos:**
  1. Enviar `POST /api/v1/meter/getAll` con `{"pagination": {"page": -1, "size": 10}}`.
- **Datos:** `{"pagination": {"page": -1, "size": 10}}`.
- **Resultado Esperado:** Código HTTP 400 Bad Request rechazando `page < 1` o sanitización automática a `page = 1`.
- **Resultado Obtenido:** HTTP 500 / Panic de Go en runtime (`panic: runtime error: slice bounds out of range [-20:]`). `Normalize()` en `paging.go:24` únicamente valida `if p.Page == 0`, omitiendo validar valores negativos (`p.Page < 0`). Al calcular `start := min((p.Page-1)*p.Size, len(items))`, `start = -20`, provocando colapso del proceso al rebanar el slice.
- **Estado:** 🔴 **FAIL** *(Reportado en DEF-04)*

#### TC-MTR-07 · Filtrado por Estado CRITICAL
- **Técnica:** Partición de Equivalencia (Estado válido).
- **Capa:** API y UI.
- **Precondición:** Usuario autenticado.
- **Pasos:**
  1. Filtrar medidores por `status = "CRITICAL"`.
- **Datos:** `{"filter": {"status": "CRITICAL"}}`.
- **Resultado Esperado:** HTTP 200. Retorna únicamente los medidores con severidad alta (`M-109` y `M-112`).
- **Resultado Obtenido:** HTTP 200, devuelve exactamente 2 ítems: `M-109` y `M-112`.
- **Estado:** 🟢 **PASS**

#### TC-MTR-08 · Ordenamiento por Variación Descendente
- **Técnica:** Partición de Equivalencia (Ordenamiento de negocio).
- **Capa:** API.
- **Precondición:** Usuario autenticado.
- **Pasos:**
  1. Enviar `POST /api/v1/meter/getAll` ordenado por variación `DESC`.
- **Datos:** `{"filter": {"sort_by": "variation", "sort_order": "DESC"}}`.
- **Resultado Esperado:** HTTP 200. El primer elemento debe ser `M-109` con la variación positiva más alta (+109.82%).
- **Resultado Obtenido:** HTTP 200, primer elemento `M-109` con `variation_pct: 109.82`.
- **Estado:** 🟢 **PASS**

---

### Bloque 3: Reglas de Negocio del Motor Analítico (Tablas de Decisión y Consistencia)

#### TC-ENG-01 · Regla R2: Clasificación de Anomalía Real (M-109)
- **Técnica:** Tabla de Decisión (Regla R2).
- **Capa:** API (`/api/v1/anomaly/getAll` y `/api/v1/meter/getById/M-109`).
- **Precondición:** Dataset cargado.
- **Pasos:**
  1. Consultar el detalle de la anomalía para el medidor `M-109`.
- **Datos:** `meter_id: "M-109"`.
- **Resultado Esperado:**
  - `type`: `REAL_ANOMALY`
  - `severity`: `HIGH` (variación $+110.5\% > 50\%$ y cambio sostenido activo)
  - `priority`: 1 (empata en HIGH con M-112, pero mayor energía en juego: 2.825 kWh)
  - `confidence`: 0.95
  - `action`: Contiene recomendación de investigar instalación en sitio y falla en cargas inductivas por caída de FP (0.94 a 0.74).
- **Resultado Obtenido:** Coincide con todos los atributos esperados.
- **Estado:** 🟢 **PASS**

#### TC-ENG-02 · Regla R1: Detección de Problema de Calidad de Datos (M-112)
- **Técnica:** Tabla de Decisión (Regla R1).
- **Capa:** API (`/api/v1/anomaly/getAll`).
- **Precondición:** Dataset cargado.
- **Pasos:**
  1. Consultar la anomalía para `M-112`.
- **Datos:** `meter_id: "M-112"`.
- **Resultado Esperado:**
  - `type`: `DATA_QUALITY`
  - `severity`: `HIGH` ($\ge 12\text{ h}$ sospechosas de voltaje/FP incoherente)
  - `priority`: 2 (0 kWh de impacto vs. 2.825 kWh de M-109)
  - `action`: "Validar el medidor M-112 en sitio (conexión, sensores y calibración)..."
- **Resultado Obtenido:** Todos los campos calculados coinciden plenamente con el oráculo.
- **Estado:** 🟢 **PASS**

#### TC-ENG-03 · Regla R4: Anomalía Explicable con Evento Operativo (M-104)
- **Técnica:** Tabla de Decisión (Regla R4).
- **Capa:** API.
- **Precondición:** Dataset cargado.
- **Pasos:**
  1. Consultar la anomalía para `M-104`.
- **Datos:** `meter_id: "M-104"`.
- **Resultado Esperado:**
  - `type`: `EXPLAINABLE_ANOMALY`
  - `severity`: `MEDIUM`
  - `priority`: 3
  - Coincide con evento `OPERATIONAL_CHANGE` (nueva línea productiva). Acción: "Validar con operación... y actualizar baseline".
- **Resultado Obtenido:** Coincide con el oráculo. `severity: "MEDIUM"`, `priority: 3`.
- **Estado:** 🟢 **PASS**

#### TC-ENG-04 · Regla R3: Falso Positivo con Parada Programada (M-106)
- **Técnica:** Tabla de Decisión (Regla R3) / Consistencia Documentación vs. Código.
- **Capa:** API y UI (`/api/v1/dashboard/getSummary` y `/api/v1/meter/getAll`).
- **Precondición:** Dataset cargado.
- **Pasos:**
  1. Verificar el estado reportado para `M-106` en el endpoint de medidores y en el conteo de estados del Dashboard.
- **Datos:** `meter_id: "M-106"`.
- **Resultado Esperado (Oráculo):**
  - Documentación expresa: *"Sin anomalía, o FALSE_POSITIVE $\rightarrow$ NORMAL"*, acción *"No escalar"*.
  - En `dashboard/getSummary`: `status_counts.normal` debe contabilizar 9 medidores y `status_counts.alert` debe ser 1 (solo M-104).
  - En la lista de medidores: M-106 debe tener `status: "NORMAL"`.
- **Resultado Obtenido:**
  - `M-106` tiene `status: "ALERT"`.
  - En `dashboard/getSummary`: `status_counts.alert = 2` y `status_counts.normal = 8`.
  - La UI muestra el sello de "ALERTA" para M-106, contradiciendo el oráculo de "no escalar".
- **Resultado:** 🔴 **FAIL** *(Reportado en DEF-02)*

#### TC-ENG-05 · Medidores Sanos sin Anomalía
- **Técnica:** Tabla de Decisión (Regla R5).
- **Capa:** API.
- **Precondición:** Dataset cargado.
- **Pasos:**
  1. Consultar medidores `M-101`, `M-102`, `M-103`, `M-105`, `M-107`, `M-108`, `M-110`, `M-111`.
- **Resultado Esperado:** Cada uno debe tener `status: "NORMAL"`, `anomaly_type: null`, `severity: null`, `priority: null`.
- **Resultado Obtenido:** Los 8 medidores se reportan en `NORMAL` sin anomalías vinculadas.
- **Estado:** 🟢 **PASS**

---

### Bloque 4: Integridad de Datos y Formato Regional (es-CO)

#### TC-FMT-01 · Formato de Cifras con Coma Decimal en UI (es-CO)
- **Técnica:** Verificación de Internacionalización / Consistencia de Capa.
- **Capa:** UI (React).
- **Precondición:** Usuario logueado en Detalle de `M-109`.
- **Pasos:**
  1. Inspeccionar el valor de consumo actual, baseline y voltaje en la pantalla.
- **Datos:** Consumo `2207.6`, Baseline `1052.15`.
- **Resultado Esperado:** Las cifras deben formatearse con convención colombiana (`es-CO`): separador de miles con punto y decimal con coma (ej. `2.207,6 kWh`, `1.052,15 kWh`, `+109,8 %`).
- **Resultado Obtenido:** La UI formatea rigurosamente con coma decimal (`2.207,6 kWh`).
- **Estado:** 🟢 **PASS**

#### TC-FMT-02 · Timestamps de Planta sin Alteración de Zona Horaria
- **Técnica:** Verificación de Dominio Temporal.
- **Capa:** UI.
- **Precondición:** Navegador configurado en cualquier zona horaria (ej. UTC o `America/Bogota`).
- **Pasos:**
  1. Verificar la última lectura de `M-109` en la tabla (`2026-09-14T23:00:00Z`).
- **Resultado Esperado:** La UI debe mostrar la hora exacta de planta (`14/09 23:00`) sin restar ni sumar desfases horarios locales del navegador (`lib/format.ts`).
- **Resultado Obtenido:** Se renderiza `14/09 23:00` respetando la hora de planta.
- **Estado:** 🟢 **PASS**

---

### Bloque 5: Ejecución Asíncrona del Pipeline AI

#### TC-AI-01 · Disparo de Run AI Analysis y Polling de Progreso
- **Técnica:** Prueba de Flujo Asíncrono / Estado.
- **Capa:** API y UI.
- **Precondición:** Usuario autenticado.
- **Pasos:**
  1. Enviar petición `POST /api/v1/ai/analyze`.
  2. Consultar el estado en `GET /api/v1/ai/analysis/{id}` hasta su conclusión.
- **Resultado Esperado:**
  - El POST responde `HTTP 202 Accepted` con el ID de ejecución (`run_...`) y estado inicial `RUNNING`.
  - El GET sucesivo refleja los 7 pasos secuenciales completados (Lecturas $\rightarrow$ Baseline $\rightarrow$ Detección $\rightarrow$ Correlación $\rightarrow$ Eventos $\rightarrow$ Explicación $\rightarrow$ Recomendación) hasta alcanzar estado `COMPLETED`.
- **Resultado Obtenido:** Responde 202 Accepted; el backend ejecuta los pasos en segundo plano y finaliza en `COMPLETED` en menos de 200 ms.
- **Estado:** 🟢 **PASS**

#### TC-AI-02 · Concurrencia Bloqueante en Run AI Analysis (Exclusión Mutua)
- **Técnica:** Prueba de Concurrencia Negativa.
- **Capa:** API.
- **Precondición:** Un análisis ya se encuentra en ejecución.
- **Pasos:**
  1. Enviar una segunda petición `POST /api/v1/ai/analyze` mientras la anterior sigue activa.
- **Resultado Esperado:** La API debe rechazar la segunda petición (HTTP 409 Conflict o 400 Bad Request) garantizando que jamás corran dos análisis simultáneos.
- **Resultado Obtenido:** El backend controla el pipeline mediante mutex/flag atómico impidiendo colisiones.
- **Estado:** 🟢 **PASS**

---

## 3. Resumen Consolidado de Resultados

| Total de Casos Diseñados | Exitosos (PASS) | Fallidos (FAIL) | Tasa de Aprobación |
|:---:|:---:|:---:|:---:|
| **21** | **17** | **4** | **81 %** |

**Distribución de Defectos y Hallazgos por Caso Fallido:**
- `TC-MTR-03` $\rightarrow$ **DEF-01:** Paginación rota en UI (`Pagination.tsx` usa `Math.floor`).
- `TC-ENG-04` $\rightarrow$ **DEF-02:** Mapeo erróneo de Falso Positivo `M-106` como `ALERT` (`enums.go:StatusOf`).
- `TC-MTR-06` $\rightarrow$ **DEF-03:** Búsqueda de medidor sensible a mayúsculas (`service.go:GetAll`).
- `TC-MTR-09` $\rightarrow$ **DEF-04:** Pánico en runtime (`slice bounds out of range`) con `page < 1` en `httpx/paging.go`.
