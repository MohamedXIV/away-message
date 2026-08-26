import { Page, expect } from '@playwright/test';

export class CafePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async switchToCafe() {
    await this.page.evaluate(() => {
      (window as any).__simStore.getState().switchView('cafe');
    });
    await this.page.waitForTimeout(100);
  }

  async selectChoice(choiceText: string) {
    const choiceBtn = this.page.locator(`button:has-text("${choiceText}")`).first();
    await expect(choiceBtn).toBeVisible({ timeout: 5000 });
    await choiceBtn.click();
    await this.page.waitForTimeout(200);
  }

  async finishMeeting() {
    const finishBtn = this.page.locator('button:has-text("Finish Coffee & Return to Room")').first();
    await expect(finishBtn).toBeVisible({ timeout: 5000 });
    await finishBtn.click();
    await this.page.waitForTimeout(200);
  }
}
