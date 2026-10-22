import { type Page, type Locator } from '@playwright/test';

//BasePage encapsula el AppShell compartido y métodos comunes a todas las pantallas de EnergIA.

export abstract class BasePage {
    readonly page: Page;
    readonly navDespacho: Locator;
    readonly navMedidores: Locator;
    readonly navAnomalias: Locator;
    readonly userBadge: Locator;
    readonly runAiButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.navDespacho = page.getByRole('link', { name: 'Despacho' });
        this.navMedidores = page.getByRole('link', { name: 'Medidores' });
        this.navAnomalias = page.getByRole('link', { name: 'Anomalías IA' });
        this.userBadge = page.getByText('Operador');
        this.runAiButton = page.getByRole('button', { name: /run ai analysis/i });
    }

    async waitForUrl(urlOrRegExp: string | RegExp): Promise<void> {
        await this.page.waitForURL(urlOrRegExp);
    }

    async goToDespacho(): Promise<void> {
        await this.navDespacho.click();
        await this.page.waitForURL('/');
    }

    async goToMedidores(): Promise<void> {
        await this.navMedidores.click();
        await this.page.waitForURL(/\/medidores/);
    }

    async goToAnomalias(): Promise<void> {
        await this.navAnomalias.click();
        await this.page.waitForURL(/\/anomalias/);
    }
}
