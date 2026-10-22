import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { STORAGE_STATE } from '../playwright.config';

setup('Autenticar operador y guardar sesión', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('admin@energia.local', 'admin123');

    await expect(page).toHaveURL('/');
    await expect(page.getByText('Operador')).toBeVisible();

    await page.context().storageState({ path: STORAGE_STATE });
});
