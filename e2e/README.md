# Suite de Automatización E2E y API · EnergIA

Suite de pruebas automatizadas construida con **Playwright**, **TypeScript** y el patrón de diseño **Page Object Model (POM)**.

---

## 1. Requisitos Previos

- **Node.js:** v20+ o v22+
- **Aplicación en ejecución:**
  - Frontend: `http://localhost:3000`
  - Backend API: `http://localhost:8080` (o Docker Compose activo)

---

## 2. Instalación y Ejecución en Un Solo Comando

Desde la carpeta raíz del proyecto o dentro de `e2e/`:

```bash
# 1. Instalar dependencias y navegadores soportados (Chromium y Firefox)
cd e2e
npm install
npx playwright install chromium firefox

# 2. Ejecutar toda la suite de pruebas (E2E, API y Defectos)
npm test
```

---

## 3. Comandos Útiles y Ejecución por Tags (`--grep`)

La suite implementa **tags nativos de Playwright** para ejecutar selectivamente cualquier grupo de pruebas:

| Tag | Propósito | Comando de Ejecución |
|---|---|---|
| `@smoke` | Suite de humo rápida (disponibilidad de API y login) | `npx playwright test --grep "@smoke"` |
| `@regression` | Flujos de negocio completos y contratos de API | `npx playwright test --grep "@regression"` |
| `@defect` | Tests que reproducen y evidencian los defectos (DEF-01 a DEF-04) | `npx playwright test --grep "@defect"` |
| `@api` | Pruebas de contrato y endpoints de Backend | `npx playwright test --grep "@api"` |
| `@e2e` | Flujos visuales de usuario en navegador | `npx playwright test --grep "@e2e"` |

### Scripts directos de `package.json`:

```bash
npm test              # Ejecuta todos los tests en modo headless
npm run test:ui       # Abre la interfaz gráfica interactiva (Time Travel Debugger)
npm run test:headed   # Ejecuta con el navegador visible en pantalla
npm run test:debug    # Modo depuración paso a paso (Playwright Inspector)
npm run test:e2e      # Ejecuta solo los flujos E2E de navegador
npm run test:api      # Ejecuta solo las pruebas de API REST
npm run report        # Abre el reporte visual HTML con trazas y videos
```

---

## 4. Arquitectura de la Solución

```
e2e/
├── pages/                     # Page Object Models (POM)
│   ├── BasePage.ts            # AppShell compartido (navegación y cabecera)
│   ├── LoginPage.ts           # Pantalla de acceso y autenticación
│   ├── DashboardPage.ts       # Despacho y panel de KPIs
│   ├── MetersPage.ts          # Libro de medidores, filtros y paginación
│   └── MeterDetailPage.ts     # Detalle técnico, variables eléctricas y recomendación
├── tests/
│   ├── auth.setup.ts          # Setup global: genera storageState reusable
│   ├── e2e/
│   │   └── business-flow.spec.ts   # Flujo E2E de negocio completo (Happy path)
│   ├── defects/
│   │   └── defects.spec.ts    # Reproducción de DEF-01 y DEF-02 (test.fail + capturas)
│   └── api/
│       └── meters-api.spec.ts # Pruebas de contrato API, DEF-03 y DEF-04
├── playwright.config.ts       # Timezone America/Bogota, storageState, reporters
└── tsconfig.json              # Tipado estricto con paths alias (@/*)
```

---

## 5. Decisiones Técnicas y Buenas Prácticas

1. **Autenticación Reutilizable (`storageState`):** El proyecto `setup` ejecuta el login una única vez y persiste el JWT en `playwright/.auth/user.json`. Los tests E2E inician sesión instantáneamente sin rellenar el formulario en cada prueba.
2. **Zona Horaria de Planta (`timezoneId: 'America/Bogota'`):** Se garantiza que los timestamps de las lecturas se evalúen con hora de Colombia sin desfases de huso horario del navegador.
3. **Manejo de Bugs Conocidos (`test.fail()`):** Los tests que documentan los defectos reportados en `qa/05-defectos.md` usan `test.fail()`. Esto permite documentar formalmente la falla esperada sin romper el pipeline de CI/CD.
4. **Evidencias Automáticas:** La suite genera capturas visuales en `qa/evidencias/` y adjunta trazas y videos en caso de fallo al reporte HTML.
5. **Cero `waitForTimeout`:** Uso exclusivo de web-first assertions (`expect(locator).toBeVisible()`) y esperas automáticas de red de Playwright.
