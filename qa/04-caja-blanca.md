# Pruebas de Caja Blanca y Auditoría de Código · EnergIA

- **Autor:** Eimer Antonio Sánchez Carreño (Senior QA Automation Engineer)
- **Objetivo:** Análisis estructural, cobertura de ramas, validación de condiciones de borde y auditoría crítica de las suites de prueba existentes en Backend (`Go`) y Frontend (`React/Vitest`).

---

## 1. Módulos de Alto Riesgo Seleccionados

Para esta revisión estructural se seleccionaron dos módulos nucleares para la operación y el negocio:
1. **Módulo A: `backend/internal/meter` (`enums.go`, `service.go`, `dto.go`)**  
   *Justificación:* Es la interfaz central entre el motor de datos y el operador. Controla la lógica de presentación del estado de alerta (`StatusOf`), la búsqueda textual, el ordenamiento multi-criterio y la paginación.
2. **Módulo B: `backend/internal/analysis/classify` (`classify.go`, `events.go`)**  
   *Justificación:* Es el núcleo de toma de decisiones del motor analítico. Determina si una desviación eléctrica es una anomalía real, explicable, falso positivo o falla de calidad, pondera los pesos de evidencia y define la acción recomendada.

---

## 2. Análisis Estructural y Casos Borde

### 2.1 Módulo A: `backend/internal/meter`

#### A. Lógica de Decisión en `enums.go:StatusOf`
```go
// Líneas 29-38 de backend/internal/meter/enums.go
func StatusOf(a *model.Anomaly) Status {
    switch {
    case a == nil:
        return StatusNormal
    case a.Severity == model.SeverityHigh:
        return StatusCritical
    default:
        return StatusAlert
    }
}
```
- **Análisis de Ramas y Condiciones:**
  - Rama 1 (`a == nil`): Maneja correctamente los medidores sin anomalía $\rightarrow$ `StatusNormal`.
  - Rama 2 (`a.Severity == model.SeverityHigh`): Maneja correctamente anomalías severas (M-109 y M-112) $\rightarrow$ `StatusCritical`.
  - Rama 3 (`default`): Asume erróneamente que cualquier otra anomalía es `StatusAlert`.
- **Caso Borde Ignorado (Causa Raíz de DEF-02):**
  - Para `M-106`, el motor genera un objeto `model.Anomaly` con `a.Type = model.TypeFalsePositive`, `a.Severity = model.SeverityLow` y `a.Anomaly = false`.
  - Al no ser `nil` y tener severidad `LOW`, cae en `default: return StatusAlert`.
  - **Falta la rama explícita:**
    ```go
    case a.Type == model.TypeFalsePositive || !a.Anomaly:
        return StatusNormal
    ```

#### B. Búsqueda y Filtrado en `service.go:GetAll`
```go
// Líneas 58-61 de backend/internal/meter/service.go
for _, sm := range s.Summaries() {
    if search != "" && !strings.Contains(sm.MeterID, search) {
        continue
    }
    // ...
}
```
- **Análisis de Condiciones:**
  - `sm.MeterID` almacena valores como `"M-109"`.
  - Si `search` contiene `"m-109"`, `strings.Contains("M-109", "m-109")` evalúa a `false`.
  - No existe normalización ni en `dto.go:Normalize` ni en `service.go`.
  - **Remediación Requerida:**
    ```go
    if search != "" && !strings.Contains(strings.ToUpper(sm.MeterID), strings.ToUpper(search)) {
        continue
    }
    ```

#### C. Lógica de Paginación en Frontend: `Pagination.tsx`
```typescript
// Línea 13 de frontend/src/features/meters/components/Pagination.tsx
const pages = Math.max(1, Math.floor(count / size))
```
- **Análisis Matemático de Borde:**
  - `count = 12`, `size = 10`.
  - `count / size = 1.2`.
  - `Math.floor(1.2) = 1` $\rightarrow$ `pages = 1`.
  - La condición de deshabilitación del botón "Siguiente" es `page >= pages` (`1 >= 1` $\rightarrow$ `true`).
  - **Resultado:** El botón se bloquea permanentemente en la página 1, amputando el 16.6% del dataset al operador.
  - **Corrección Obligatoria:** `Math.ceil(count / size)`.

#### D. Análisis de Robustez en Backend: `internal/httpx/paging.go` (Vulnerabilidad BVA / Pánico por Índice Negativo)
```go
// Líneas 23-36 y 47-56 de backend/internal/httpx/paging.go
func (p *Pagination) Normalize() []string {
    if p.Page == 0 {
        p.Page = DefaultPage
    }
    // ... omite validar p.Page < 0
}

func Paginate[T any](items []T, p Pagination) PaginatedResult[T] {
    start := min((p.Page-1)*p.Size, len(items))
    end := min(start+p.Size, len(items))
    return PaginatedResult[T]{
        Rows: append([]T{}, items[start:end]...),
    }
}
```
- **Riesgo Crítico de Robustez (Panic en Runtime):**
  - Si un cliente envía un valor límite inferior negativo (`p.Page = -1`, `p.Size = 10`), `Normalize()` solo evalúa `if p.Page == 0`, permitiendo que el número negativo pase sin error de validación.
  - Al ejecutar `Paginate()`:
    $$\text{start} = \min((-1 - 1) \times 10, 12) = \min(-20, 12) = -20$$
  - Al rebanar el slice en `items[start:end]` con `start = -20`, Go arroja un pánico fatal en tiempo de ejecución:
    `panic: runtime error: slice bounds out of range [-20:]`
  - Esto provoca la degradación del hilo del servidor y responde HTTP 500 no controlado en lugar de un rechazo limpio.
- **Corrección Propuesta en `Normalize()`:**
  ```go
  if p.Page < 1 {
      p.Page = DefaultPage // O agregar a errs: "pagination.page debe ser mayor o igual a 1"
  }
  ```

---

### 2.2 Módulo B: `backend/internal/analysis/classify`

#### A. Ventanas de Correlación de Eventos en `events.go`
```go
// Líneas 41-47 de backend/internal/analysis/classify/events.go
func matchesWindow(e data.Event, changeStart time.Time) bool {
    diff := changeStart.Sub(e.Timestamp)
    // El evento puede ocurrir hasta 24 h antes del cambio o hasta 6 h después.
    return diff >= -6*time.Hour && diff <= 24*time.Hour
}
```
- **Análisis:**
  - Si un evento ocurre en $t = \text{changeStart} - 24\text{ h}$, $\text{diff} = 24\text{ h}$ (Válido).
  - Si un evento se reporta tardíamente por el operador hasta $6\text{ h}$ después del inicio del cambio físico, $\text{diff} = -6\text{ h}$ (Válido).
  - La lógica temporal es robusta y previene que eventos lejanos (> 24 h antes) contaminen la clasificación de anomalías recientes.

#### B. Ponderación de Confianza Heurística en `classify.go`
```go
// Línea 292 de backend/README.md y lógica en confidence.go
confianza = 0.5 + (0.95 - 0.5) * puntaje
```
- **Rango Teórico:** Mínimo garantizado 0.50 y techo máximo 0.95.
- Si la clasificación depende de un reporte humano (evento operativo), se aplica el factor de descuento `eventTrust = 0.9` (`confidence(ev.Checks, eventTrust)`).
- **Fortaleza:** Nunca promete certeza estadística absoluta ($1.0$), obligando a la validación en campo.
- **Riesgo:** Si no se detectan checks de evidencia (`len(checks) == 0`), la división podría generar valores espurios si no se controla adecuadamente.

---

## 3. Auditoría Crítica de las Suites de Prueba Existentes

### 3.1 Suite de Backend (`go test ./...`)

| Paquete | Tests Existentes | ¿Qué Cubren? | ¿Qué NO Cubren? (Puntos Ciegos) | Nivel de Confianza |
|---|:---:|---|---|:---:|
| `internal/analysis/stats` | `stats_test.go` | Mediana impar/par, MAD, cálculo de Z robusto. | Arrays vacíos o con valores `NaN`/`Inf`. | **Alto** (95%) |
| `internal/analysis/baseline`| `baseline_test.go` | Cálculo de mediana horaria y diaria sobre 7 días. | Semanas con horas faltantes o lecturas desordenadas. | **Alto** (90%) |
| `internal/analysis/quality` | `quality_test.go` | Voltaje $\pm 5\%$, factor de potencia fuera de rango. | Caídas simultáneas de voltaje en múltiples medidores (red vs. medidor). | **Medio** (75%) |
| `internal/analysis/changes` | `changes_test.go` | Detección de tramos continuos $\ge 6\text{ h}$ con $\|z\| > 3.5$. | Tramos interrumpidos por 1 sola hora normal de ruido. | **Alto** (85%) |
| `internal/analysis/classify`| `events_test.go` | Matriz de eventos (`OPERATIONAL_CHANGE`, `SCHEDULED_OUTAGE`). | No hay test unitario para la severidad y confianza en casos borde. | **Medio** (70%) |
| `internal/meter` | `service_test.go` | Filtros básicos de ordenamiento y paginación. | **GRAVE:** No prueba que `StatusOf` retorne `NORMAL` para `FALSE_POSITIVE`, ni prueba búsquedas en minúsculas. | **Bajo** (40%) |
| `internal/auth` | `service_test.go` | Generación y expiración de JWT, contraseñas incorrectas. | Normalización de email (mayúsculas y espacios en blanco). | **Medio** (65%) |

> **Veredicto Backend:** La suite de Go es matemáticamente rigurosa en el motor estadístico, pero presenta **falsos positivos de confianza** en la capa de servicios de negocio (`meter` y `auth`). Los tests existentes pasaron en verde porque nadie escribió aserciones sobre los requisitos explícitos de `FALSE_POSITIVE` ni sobre el comportamiento *case-insensitive* documentado en Swagger.

---

### 3.2 Suite de Frontend (`pnpm test` / Vitest)

| Archivo de Test | Cobertura | Evaluación Crítica |
|---|---|---|
| `lib/format.test.ts` | Formato numérico, porcentajes y fechas de planta. | Bien planteado para asegurar formato `es-CO` y preservación de hora local. |
| `features/meters/hooks/useMeterFilters.test.ts` | Parsing de URLSearchParams a objeto de filtros. | Prueba la sincronización de query params, pero con datos ideales. |
| `components/ui/marks.test.tsx` | Renderizado de badges y marcas visuales. | Pruebas de renderizado estático de componentes visuales aislados. |

> **Veredicto Frontend:** **Cobertura extremadamente deficiente (< 20%).**  
> No existen pruebas unitarias ni de componentes para `Pagination.tsx`, `MeterLedger.tsx` ni `LoginForm.tsx`. El defecto crítico de paginación que rompe la navegación en producción pasó completamente inadvertido porque no existe un solo test que monte `Pagination` con `count = 12` y `size = 10`.

---

## 4. Tests Unitarios Propuestos para Remediación

A continuación se presentan los tests unitarios formales que deben incorporarse al código fuente para evitar regresiones de los defectos identificados:

### 4.1 Test Unitario Backend: `internal/meter/status_test.go`
Valida el cumplimiento estricto del oráculo de negocio para estados de alerta.

```go
package meter_test

import (
    "testing"
    "energyai/internal/analysis/model"
    "energyai/internal/meter"
)

func TestStatusOf_BusinessRules(t *testing.T) {
    tests := []struct {
        name     string
        anomaly  *model.Anomaly
        expected meter.Status
    }{
        {
            name:     "Medidor sin anomalía es NORMAL",
            anomaly:  nil,
            expected: meter.StatusNormal,
        },
        {
            name: "Falso Positivo con acción no escalar DEBE ser NORMAL",
            anomaly: &model.Anomaly{
                Anomaly:  false,
                Type:     model.TypeFalsePositive,
                Severity: model.SeverityLow,
            },
            expected: meter.StatusNormal, // Falla actualmente: devuelve ALERT
        },
        {
            name: "Anomalía Real con severidad HIGH es CRITICAL",
            anomaly: &model.Anomaly{
                Anomaly:  true,
                Type:     model.TypeReal,
                Severity: model.SeverityHigh,
            },
            expected: meter.StatusCritical,
        },
        {
            name: "Anomalía Explicable con severidad MEDIUM es ALERT",
            anomaly: &model.Anomaly{
                Anomaly:  true,
                Type:     model.TypeExplainable,
                Severity: model.SeverityMedium,
            },
            expected: meter.StatusAlert,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := meter.StatusOf(tt.anomaly)
            if got != tt.expected {
                t.Errorf("StatusOf() = %v, esperado %v", got, tt.expected)
            }
        })
    }
}
```

### 4.2 Test Unitario Frontend: `features/meters/components/Pagination.test.tsx`
Valida el cálculo de páginas y habilitación del botón de navegación.

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from './Pagination'

describe('Pagination Component', () => {
  it('habilita el botón Siguiente cuando hay elementos en la página 2 (12 items / 10 por página)', async () => {
    const handlePage = vi.fn()
    render(<Pagination page={1} size={10} count={12} onPage={handlePage} />)

    // Debe indicar 1–10 de 12 medidores
    expect(screen.getByText(/1–10/)).toBeInTheDocument()
    expect(screen.getByText(/12/)).toBeInTheDocument()

    // El botón Siguiente DEBE estar habilitado
    const nextButton = screen.getByRole('button', { name: /siguiente/i })
    expect(nextButton).not.toBeDisabled()

    await userEvent.click(nextButton)
    expect(handlePage).toHaveBeenCalledWith(2)
  })

  it('deshabilita el botón Siguiente únicamente al estar en la última página', () => {
    const handlePage = vi.fn()
    render(<Pagination page={2} size={10} count={12} onPage={handlePage} />)

    const nextButton = screen.getByRole('button', { name: /siguiente/i })
    expect(nextButton).toBeDisabled()

    const prevButton = screen.getByRole('button', { name: /anterior/i })
    expect(prevButton).not.toBeDisabled()
  })
})
```
