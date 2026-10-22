import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class MetersPage extends BasePage {
    readonly pageHeading: Locator;
    readonly searchInput: Locator;
    readonly searchButton: Locator;
    readonly tabTodos: Locator;
    readonly tabNormales: Locator;
    readonly tabAlertas: Locator;
    readonly tabCriticas: Locator;
    readonly tableRows: Locator;
    readonly paginationInfo: Locator;
    readonly prevPageButton: Locator;
    readonly nextPageButton: Locator;

    constructor(page: Page) {
        super(page);
        this.pageHeading = page.getByRole('heading', { name: 'Libro de medidores', level: 1 });
        this.searchInput = page.getByLabel('Medidor');
        this.searchButton = page.getByRole('button', { name: 'Buscar medidor' });
        this.tabTodos = page.getByText('Todos', { exact: true });
        this.tabNormales = page.getByText('Normales', { exact: true });
        this.tabAlertas = page.getByText('Alertas', { exact: true });
        this.tabCriticas = page.getByText('Críticas', { exact: true });
        this.tableRows = page.getByRole('row').filter({ has: page.getByRole('cell') });
        this.paginationInfo = page.getByRole('navigation', { name: 'Paginación' }).getByText(/medidores/i);
        this.prevPageButton = page.getByRole('button', { name: /anterior/i });
        this.nextPageButton = page.getByRole('button', { name: /siguiente/i });
    }

    async goto(): Promise<void> {
        await this.page.goto('/medidores');
    }

    async searchMeter(query: string): Promise<void> {
        await this.searchInput.fill(query);
        await this.searchButton.click();
    }

    async filterByStatus(status: 'NORMAL' | 'ALERT' | 'CRITICAL' | 'ALL'): Promise<void> {
        switch (status) {
            case 'NORMAL':
                await this.tabNormales.click();
                break;
            case 'ALERT':
                await this.tabAlertas.click();
                break;
            case 'CRITICAL':
                await this.tabCriticas.click();
                break;
            case 'ALL':
                await this.tabTodos.click();
                break;
        }
    }

    async openMeterDetail(meterId: string): Promise<void> {
        await this.page.getByRole('link', { name: meterId, exact: true }).click();
    }
}
