import { Page } from '@playwright/test';

export class RoomPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async switchToRoom() {
    await this.page.evaluate(() => {
      (window as any).__simStore.getState().switchView('room');
    });
    await this.page.waitForTimeout(100);
  }

  async switchToPc() {
    const pcBtn = this.page.locator('button:has-text("Sit at PC")').first();
    if (await pcBtn.isVisible()) {
      await pcBtn.click();
    } else {
      await this.page.evaluate(() => {
        (window as any).__simStore.getState().switchView('pc');
      });
    }
    await this.page.waitForTimeout(100);
  }

  async makeTea() {
    await this.page.evaluate(() => {
      (window as any).__simStore.getState().interactRoom('tea');
    });
    await this.page.waitForTimeout(100);
  }

  async makeCoffee() {
    await this.page.evaluate(() => {
      (window as any).__simStore.getState().interactRoom('coffee');
    });
    await this.page.waitForTimeout(100);
  }

  async takeShower() {
    await this.page.evaluate(() => {
      (window as any).__simStore.getState().interactRoom('shower');
    });
    await this.page.waitForTimeout(100);
  }

  async observeWindow() {
    await this.page.evaluate(() => {
      (window as any).__simStore.getState().interactRoom('window');
    });
    await this.page.waitForTimeout(100);
  }

  async sleepUntilMorning() {
    await this.page.evaluate(() => {
      (window as any).__simStore.getState().restOrSleep(8);
    });
    await this.page.waitForTimeout(100);
  }

  async workShift() {
    await this.page.evaluate(() => {
      (window as any).__simStore.getState().workShift(240, 62);
    });
    await this.page.waitForTimeout(100);
  }
}
