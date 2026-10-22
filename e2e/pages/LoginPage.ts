import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
    readonly page: Page;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly submitButton: Locator;
    readonly errorMessage: Locator;

    constructor(page: Page) {
        this.page = page;
        this.emailInput = page.getByLabel(/email/i);
        this.passwordInput = page.getByLabel(/contraseña/i);
        this.submitButton = page.getByRole('button', { name: /entrar/i });
        this.errorMessage = page.getByRole('alert');
    }

    async goto(): Promise<void> {
        await this.page.goto('/login');
    }

    async login(email: string, pass: string): Promise<void> {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(pass);
        await this.submitButton.click();
    }
}
