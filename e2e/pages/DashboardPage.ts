import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
    readonly pageHeading: Locator;
    readonly kpiPanel: Locator;
    readonly kpiMedidoresCount: Locator;
    readonly kpiAnomaliasCount: Locator;
    readonly kpiAltaPrioridadCount: Locator;
    readonly leadOrderCard: Locator;
    readonly openLedgerLink: Locator;

    constructor(page: Page) {
        super(page);
        this.pageHeading = page.getByRole('heading', { name: 'Despacho', level: 1 });
        this.kpiPanel = page.getByRole('heading', { name: 'Estado de la planta', level: 2 });
        this.kpiMedidoresCount = page.getByText('Medidores', { exact: true }).locator('..');
        this.kpiAnomaliasCount = page.getByText('Anomalías IA', { exact: true }).locator('..');
        this.kpiAltaPrioridadCount = page.getByText('Alta prioridad', { exact: true }).locator('..');
        this.leadOrderCard = page.getByRole('article').first();
        this.openLedgerLink = page.getByRole('link', { name: /abrir el libro completo/i });
    }

    async goto(): Promise<void> {
        await this.page.goto('/');
    }

    async clickLeadOrder(): Promise<void> {
        await this.leadOrderCard.getByRole('link', { name: /M-109/i }).first().click();
    }
}
