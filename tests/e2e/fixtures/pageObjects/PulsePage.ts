import { Page, expect } from '@playwright/test';

export class PulsePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async openPulse() {
    await this.page.evaluate(() => {
      (window as any).__windowStore.getState().openWindow('pulse');
    });
    await this.page.waitForTimeout(100);
  }

  async selectBuddy(buddyName: string) {
    const buddyBtn = this.page.locator(`div:has-text("${buddyName}")`).last();
    await expect(buddyBtn).toBeVisible({ timeout: 5000 });
    await buddyBtn.dblclick();
    await this.page.waitForTimeout(100);
  }

  async selectChoice(choiceText: string) {
    const choiceBtn = this.page.locator(`button:has-text("${choiceText}")`).first();
    await expect(choiceBtn).toBeVisible({ timeout: 8000 });
    await choiceBtn.click();
    await this.page.waitForTimeout(200);
  }

  async sendCustomMessage(text: string) {
    const input = this.page.locator('input[placeholder*="Type a message"]').first();
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill(text);
    await input.press('Enter');
    await this.page.waitForTimeout(100);
  }

  async isTypingIndicatorVisible(): Promise<boolean> {
    const typing = this.page.locator('text=is typing').first();
    return await typing.isVisible();
  }
}
