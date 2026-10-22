# Plan de Pruebas y Estrategia de Calidad · EnergIA

- **Autor:** Eimer Antonio Sánchez Carreño (Senior QA Automation Engineer)
- **Proyecto:** EnergIA (Plataforma de Monitoreo Eléctrico y Detección de Anomalías con IA)
- **Versión del Producto:** `v0.1.0-mvp`
- **Fecha de Emisión:** 22 de Octubre de 2026
- **Estándar:** Basado en ISO/IEC/IEEE 29119-3 e ISTQB Certified Tester Advanced Level

---

## 1. Alcance de las Pruebas (Scope)

El objetivo de este ciclo de aseguramiento de calidad es certificar la confiabilidad, precisión de cálculo y estabilidad funcional del MVP de EnergIA, una plataforma orientada a operadores de plantas industriales en Colombia para la toma de decisiones operativas sobre 12 medidores eléctricos (M-101 a M-112).

### 1.1 En Alcance (In-Scope)

- **Capa API (Go):**
  - Autenticación mediante JWT (`/api/v1/auth/login`, `/api/v1/auth/me`), validación de expiración y claims.
  - Catálogos y parámetros de filtrado (`/api/v1/meter/getParams`).
  - Consulta de medidores con paginación, filtros de estado y búsqueda parcial (`/api/v1/meter/getAll`).
  - Detalle técnico, variables eléctricas e históricos diario/horario (`/api/v1/meter/getById/{id}`).
  - Listado de anomalías priorizadas y evidencia calculada (`/api/v1/anomaly/getAll`).
  - KPIs globales y resumen de planta (`/api/v1/dashboard/getSummary`).
  - Ejecución asíncrona de pipeline analítico (`/api/v1/ai/analyze` y consulta de estado `/ai/analysis/{id}`).
  - Manejo uniforme de errores y esquemas de respuesta (`httpx.APIError`).
- **Capa UI (React 19 + TanStack Query + Vite):**
  - Pantallas de Login, Despacho (Dashboard), Libro de Medidores, Detalle de Medidor, Lista de Anomalías e Investigación.
  - Navegación, persistencia de filtros en URL (`useSearchParams`), reactividad ante cambios de página.
  - Formateo regional colombiano (`es-CO`, coma decimal, timestamps en hora local de planta sin conversión de zona).
  - Accesibilidad WCAG 2.1 AA (contraste, marcas no dependientes de color, navegación por teclado).
- **Consistencia Inter-Capas (End-to-End):**
  - Integridad de datos: CSV inmutable $\rightarrow$ Ingesta/Motor estadístico $\rightarrow$ Payload JSON API $\rightarrow$ Renderizado en UI.

### 1.2 Fuera de Alcance (Out-of-Scope) y Justificación

- **Pruebas de Carga y Rendimiento Masivo:** El dataset del MVP consta de 4.032 lecturas fijas procesadas en memoria (`internal/store`). No existe persistencia en base de datos transaccional (RDBMS/NoSQL) ni concurrencia masiva de operadores en planta.
- **Re-entrenamiento o Calidad Algorítmica de OpenAI:** La plataforma desacopla la detección estadística (determinística en Go) de la redacción opcional de LLM. Se valida la barrera de contención (*guardrail* de cifras), pero no el modelo predictivo externo de OpenAI.
- **Roles y Permisos Múltiples:** La especificación de producto define un único usuario operador (`admin@energia.local`). No existe RBAC implementado.

---

## 2. Análisis de Riesgos de Calidad (Risk-Based Testing - RBT)

Aplicando la metodología ISTQB de pruebas basadas en riesgos, se evalúa cada funcionalidad según su **Probabilidad de Falla (P: 1–5)** y su **Impacto en el Negocio (I: 1–5)**, calculando el Nivel de Riesgo ($R = P \times I$):

| Componente / Característica                                      | P | I | Riesgo ($P \times I$) |       Nivel       | Mitigación y Estrategia de Prueba                                                                                                     |
| ----------------------------------------------------------------- | :-: | :-: | :---------------------: | :----------------: | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Detección y Priorización de Anomalías (M-109, M-112)** | 3 | 5 |      **15**      | **CRÍTICO** | Pruebas de integración estadística y caja negra sobre orden de prioridad, severidad y energía en juego (kWh).                       |
| **Clasificación de Estados (Motor vs. UI)**                | 4 | 4 |      **16**      | **CRÍTICO** | Tablas de decisión para validar mapeo de Falsos Positivos (M-106) y anomalías explicables (M-104) hacia `NORMAL` y `ALERT`.      |
| **Paginación y Filtrado del Libro de Medidores**           | 4 | 4 |      **16**      | **CRÍTICO** | BVA en índices de página y EP en filtros (`meter_id`, `status`). Verificación cruzada entre totalizadores y filas renderizadas. |
| **Autenticación y Seguridad de Endpoints**                 | 2 | 5 |      **10**      |   **ALTO**   | Pruebas negativas con tokens manipulados, cabeceras faltantes y validación de credenciales (mayúsculas/espacios).                    |
| **Consistencia de Cifras y Formato Regional (`es-CO`)**   | 3 | 3 |       **9**       |  **MEDIO**  | Aserciones web-first en Playwright verificando separadores de miles y decimales en consumos y voltajes.                                |
| **Ejecución Asíncrona de Run AI Analysis**                | 2 | 3 |       **6**       |  **MEDIO**  | Validación del polling en UI (`GET /ai/analysis/{id}`) hasta estado `COMPLETED`.                                                  |

---

## 3. Estrategia y Tipos de Prueba por Capa

Se implementa una estrategia alineada a la Pirámide de Automatización:

```
          / \
         / E2E \         UI & Flujos de Operador (Playwright TS, POM)
        /-------\
       /   API   \       Contratos REST, Códigos HTTP, DTOs (Playwright API / cURL)
      /-----------\
     / Integración \     Ingesta CSV + Motor Estadístico + Store en Memoria
    /---------------\
   /    Unitarias    \   Estadística (Mediana, MAD, Z), Normalización, Formato
  /-------------------\
```

1. **Capa Unitaria (Backend Go & Frontend Vitest):**
   - Lógica determinística: cálculo de $Z$ robusto, ventana deslizante de 6 h para cambios sostenidos, normalización de DTOs y formateadores de fecha/hora.
2. **Capa de Integración / API:**
   - Pruebas de contrato y respuesta HTTP sobre endpoints protegidos.
   - Validación de códigos de estado HTTP (200, 202, 400, 401, 404, 500) y consistencia del payload JSON.
3. **Capa E2E (UI Playwright):**
   - Automatización de los flujos de trabajo clave del operador: Inicio de sesión $\rightarrow$ Evaluación de Despacho $\rightarrow$ Búsqueda y filtrado en Libro de Medidores $\rightarrow$ Inspección de detalle técnico y recomendación.
   - Reutilización de sesión mediante `storageState` para minimizar sobrecarga.

---

## 4. Criterios de Entrada y Salida (Entry & Exit Criteria)

### 4.1 Criterios de Entrada (Entry Criteria)

- [X] Contenedores de Backend y Frontend construidos e iniciados exitosamente en Docker (`docker compose ps` en estado `Up`).
- [X] Endpoint `GET /health` responde `HTTP 200 {"status":"ok"}`.
- [X] Endpoint `POST /api/v1/auth/login` emite tokens JWT funcionales para `admin@energia.local`.
- [X] Dataset de 4.032 lecturas y 4 eventos cargado sin excepciones de parsing en logs.

### 4.2 Criterios de Salida (Exit Criteria)

- [X] 100% de los casos de la Suite de Humo ejecutados y documentados.
- [X] Mínimo 20 casos de prueba funcionales de caja negra diseñados, ejecutados y registrados con evidencia.
- [X] Análisis estático de caja blanca completado sobre al menos 2 módulos de alto riesgo con diagnóstico de cobertura de tests.
- [X] 100% de los defectos identificados reportados con causa raíz técnica (archivo y línea), impacto y pasos de reproducción.
- [X] Suite de Playwright automatizada implementada con Page Object Model, timezone `America/Bogota`, reporte HTML y al menos un test con `test.fail()` que documente un defecto activo.

---

## 5. Resumen Ejecutivo y Dictamen de Liberación

### Dictamen de Calidad: 🔴 NO GO (NO LIBERAR A PRODUCCIÓN)

Como QA Engineer responsable del aseguramiento de calidad del producto EnergIA, **no autorizo la liberación del build v0.1.0-mvp a producción**.

A pesar de que el motor analítico central en Go demuestra una base matemática sólida y determinística para el cálculo de medianas, desviaciones y detección de variaciones eléctricas, la versión evaluada presenta defectos bloqueantes y de alta severidad que comprometen la operación:

1. **Inaccesibilidad Crítica de Medidores en UI (DEF-01):**
   La lógica de paginación en el componente frontend calcula el número total de páginas con truncamiento entero (`Math.floor(12 / 10) = 1`), provocando que el control de paginación considere que solo existe una página. Esto **bloquea completamente el acceso del operador a la página 2**, impidiendo visualizar en pantalla medidores críticos como `M-112` (el segundo medidor con mayor severidad por problemas de calidad de datos).
2. **Fatiga de Alarmas por Clasificación Errónea de Falsos Positivos (DEF-02):**
   El medidor `M-106` corresponde formalmente a una parada programada (`SCHEDULED_OUTAGE`) cuyo dictamen de motor es "no escalar" y cuya regla de negocio estipula estado `NORMAL`. Sin embargo, la función de clasificación del servicio (`enums.go:StatusOf`) omite evaluar el tipo de anomalía, catalogándolo como `ALERT`. Esto altera los KPIs de la planta (mostrando 2 alertas en lugar de 1) y expone al personal operativo a alarmas espurias.
3. **Degradación Funcional en Búsqueda de Medidores en API (DEF-03):**
   El endpoint `POST /api/v1/meter/getAll` carece de normalización de cadenas (`service.go:59`), provocando que búsquedas en minúsculas (e.g., `m-109`) retornen 0 resultados a pesar de estar explícitamente documentado como insensible a mayúsculas en la especificación OpenAPI/Swagger.
4. **Vulnerabilidad de Robustez y Pánico en Runtime en Backend (DEF-04):**
   La capa de paginación (`internal/httpx/paging.go:24-48`) omite validar límites inferiores en `Normalize()`, provocando un pánico no controlado en tiempo de ejecución (`panic: runtime error: slice bounds out of range [-20:]`) y respondiendo HTTP 500 ante consultas con `page < 1`.

### Riesgos Abiertos para el Negocio

- **Riesgo Operativo:** Ceguera parcial del despachador ante fallas de infraestructura en medidores relegados a páginas subsiguientes.
- **Riesgo de Adopción:** Desconfianza del operador hacia el motor de IA al observar que eventos operacionales programados y cerrados siguen marcándose como alertas activas.
- **Riesgo de Estabilidad:** Exposición a caídas de servicio (DoS) por peticiones no sanitizadas en endpoints públicos paginados.

### Plan de Acción Inmediato para Pase a Producción

1. Corregir el redondeo de páginas en `Pagination.tsx` usando `Math.ceil(count / size)`.
2. Ajustar `StatusOf` en `enums.go` para retornar explícitamente `StatusNormal` cuando `a.Type == model.TypeFalsePositive`.
3. Aplicar normalización `strings.ToUpper` en el filtro de búsqueda de medidores en `service.go` (`GetAll`).
4. Añadir validación `if p.Page < 1 { p.Page = DefaultPage }` en `internal/httpx/paging.go` para prevenir pánicos de memoria en Go.
5. Re-ejecutar la suite de regresión en Playwright verificando que los tests marcados con `test.fail()` pasen a estado verde.
