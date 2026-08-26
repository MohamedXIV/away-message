import { Page, expect } from '@playwright/test';

export class BrowserPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async openBrowser() {
    await this.page.evaluate(() => {
      (window as any).__windowStore.getState().openWindow('browser');
    });
    await this.page.waitForTimeout(100);
  }

  async navigate(url: string) {
    const addressInput = this.page.locator('input[placeholder*="findit.local"]').first();
    await expect(addressInput).toBeVisible({ timeout: 5000 });
    await addressInput.fill(url);
    await addressInput.press('Enter');
    await this.page.waitForTimeout(300);
  }

  async clickBookmark(bookmarkName: string) {
    const bookmark = this.page.locator(`span:has-text("${bookmarkName}")`).first();
    await expect(bookmark).toBeVisible({ timeout: 5000 });
    await bookmark.click();
    await this.page.waitForTimeout(300);
  }

  async isToolbarVisible(): Promise<boolean> {
    const toolbar = this.page.locator('text=SearchMate:').first();
    return await toolbar.isVisible();
  }

  async getCurrentUrl(): Promise<string> {
    const addressInput = this.page.locator('input[placeholder*="findit.local"]').first();
    return await addressInput.inputValue();
  }
}
