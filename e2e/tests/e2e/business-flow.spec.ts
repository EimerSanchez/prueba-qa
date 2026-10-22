import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { MetersPage } from '../../pages/MetersPage';
import { MeterDetailPage } from '../../pages/MeterDetailPage';

test.describe('Flujo E2E de Negocio · EnergIA', () => {
    test('Atención e inspección de anomalía crítica en medidor M-109', { tag: ['@e2e', '@regression'] }, async ({ page }) => {
        const dashboardPage = new DashboardPage(page);
        const metersPage = new MetersPage(page);
        const detailPage = new MeterDetailPage(page);

        await test.step('1. El operador ingresa al Despacho y visualiza el estado de planta', async () => {
            await dashboardPage.goto();
            await expect(dashboardPage.pageHeading).toBeVisible();
            await expect(dashboardPage.kpiPanel).toBeVisible();
            await expect(dashboardPage.leadOrderCard).toContainText('M-109');
        });

        await test.step('2. Navega al Libro de Medidores y filtra por estado CRITICAL', async () => {
            await dashboardPage.goToMedidores();
            await expect(metersPage.pageHeading).toBeVisible();

            await metersPage.filterByStatus('CRITICAL');
            await expect(page).toHaveURL(/estado=CRITICAL/);
            await expect(metersPage.tableRows).toHaveCount(2);
            await expect(metersPage.tableRows.first()).toContainText('M-109');
        });

        await test.step('3. Abre el detalle técnico del medidor M-109', async () => {
            await metersPage.openMeterDetail('M-109');
            await expect(page).toHaveURL(/\/medidores\/M-109/);
            await expect(detailPage.meterHeading).toHaveText('M-109');
        });

        await test.step('4. Valida las métricas de negocio y la recomendación del motor', async () => {
            await expect(detailPage.statusMark).toContainText(/crítica/i);
            await expect(detailPage.consumptionValue).toContainText('2.207,6 kWh');
            await expect(detailPage.baselineValue).toContainText('1.052,2 kWh');
            await expect(detailPage.variationValue).toContainText('+109,8 %');
            await expect(detailPage.anomalyOrderCard).toContainText(/Orden 1 · Anomalía real · Investigar/i);
            await expect(detailPage.anomalyOrderCard).toContainText(/sin evento operativo que lo explique/i);
        });
    });
});
