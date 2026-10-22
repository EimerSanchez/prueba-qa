import { test, expect } from '@playwright/test';
import { MetersPage } from '../../pages/MetersPage';

test.describe('Defectos Críticos de Negocio · EnergIA', () => {
    test('DEF-01: El botón siguiente de paginación debe estar habilitado para acceder a la página 2', { tag: ['@e2e', '@defect'] }, async ({ page }) => {
        test.fail(true, 'DEF-01: Pagination.tsx usa Math.floor en vez de Math.ceil, deshabilitando el botón siguiente');

        const metersPage = new MetersPage(page);
        await metersPage.goto();

        await expect(metersPage.paginationInfo).toContainText('1–10 de 12 medidores');

        await page.screenshot({
            path: '../qa/evidencias/def-01-paginacion-deshabilitada.png',
            fullPage: false,
        });

        await expect(metersPage.nextPageButton).toBeEnabled();
        await metersPage.nextPageButton.click();
        await expect(page.getByRole('link', { name: 'M-112', exact: true })).toBeVisible();
    });

    test('DEF-02: El medidor M-106 (Falso Positivo) debe catalogarse como NORMAL y no como ALERTA', { tag: ['@e2e', '@defect'] }, async ({ page }) => {
        test.fail(true, 'DEF-02: StatusOf en enums.go clasifica M-106 como ALERT en lugar de NORMAL');

        const metersPage = new MetersPage(page);
        await page.goto('/medidores?medidor=M-106');

        await page.screenshot({
            path: '../qa/evidencias/def-02-m106-falsa-alerta.png',
            fullPage: false,
        });

        const row = metersPage.tableRows.first();
        await expect(row).toContainText('M-106');
        await expect(row.getByText('NORMAL')).toBeVisible();
    });
});
