import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class MeterDetailPage extends BasePage {
    readonly meterHeading: Locator;
    readonly statusMark: Locator;
    readonly consumptionValue: Locator;
    readonly baselineValue: Locator;
    readonly variationValue: Locator;
    readonly anomalyOrderCard: Locator;
    readonly openInvestigationLink: Locator;

    constructor(page: Page) {
        super(page);
        this.meterHeading = page.getByRole('heading', { level: 1 });
        this.statusMark = page.getByRole('heading', { level: 1 }).locator('..').getByText(/crítica|normal|alerta/i);
        this.consumptionValue = page.getByText('Consumo actual · 24 h', { exact: true }).locator('..');
        this.baselineValue = page.getByText('Baseline diario', { exact: true }).locator('..');
        this.variationValue = page.getByText('Variación', { exact: true }).locator('..');
        this.anomalyOrderCard = page.getByRole('heading', { level: 2, name: /orden \d+/i }).locator('..');
        this.openInvestigationLink = page.getByRole('link', { name: /abrir investigación/i });
    }

    async goto(meterId: string): Promise<void> {
        await this.page.goto(`/medidores/${meterId}`);
    }
}
