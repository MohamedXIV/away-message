import { Page, expect } from '@playwright/test';

export class Day14ModalPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async isModalVisible(): Promise<boolean> {
    const banner = this.page.locator('text=AWAY MESSAGE — 14-DAY EVALUATION COMPLETE').first();
    return await banner.isVisible();
  }

  async exportTelemetry() {
    const exportBtn = this.page.locator('button:has-text("Export Telemetry (.JSON)")').first();
    await expect(exportBtn).toBeVisible({ timeout: 5000 });

    const downloadPromise = this.page.waitForEvent('download');
    await exportBtn.click();
    return await downloadPromise;
  }

  async continueFreePlay() {
    const freePlayBtn = this.page.locator('button:has-text("Continue in Free-Play Mode")').first();
    await expect(freePlayBtn).toBeVisible({ timeout: 5000 });
    await freePlayBtn.click();
    await this.page.waitForTimeout(200);
  }
}
