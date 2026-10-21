import { Page, Locator, expect } from '@playwright/test';

export class DesktopPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/');
    // The staged root selector resolves mutually-exclusive dynamic bundles.
    // DOM navigation can complete before the legacy test fixture is mounted.
    // Await the actual legacy boot contract instead of evaluating undefined
    // debug globals or using an arbitrary fixed delay.
    await this.page.waitForFunction(() =>
      !!(window as any).__simStore && !!(window as any).__simEngine,
      { timeout: 15_000 },
    );
    // E2E starts from a clean browser with no boot request. Enter the live
    // game explicitly rather than mutating simulation state behind MainMenu.
    const skip = this.page.getByRole('button', { name: 'skip to desktop' });
    if (await skip.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await skip.click();
      await this.page.waitForTimeout(100);
    }
  }

  async openApp(appId: string) {
    await this.page.evaluate((id) => {
      if ((window as any).__windowStore) {
        (window as any).__windowStore.getState().openWindow(id);
      }
    }, appId);
    // Give brief frame for React render
    await this.page.waitForTimeout(100);
  }

  async doubleClickDesktopIcon(label: string) {
    const icon = this.page.locator(`.desktop-icon:has-text("${label}")`).first();
    await expect(icon).toBeVisible({ timeout: 5000 });
    await icon.dblclick();
    await this.page.waitForTimeout(100);
  }

  async closeWindow(appIdOrTitle: string) {
    await this.page.evaluate((id) => {
      if ((window as any).__windowStore) {
        (window as any).__windowStore.getState().closeWindow(id);
      }
    }, appIdOrTitle);
    await this.page.waitForTimeout(100);
  }

  async minimizeWindow(appIdOrTitle: string) {
    await this.page.evaluate((id) => {
      if ((window as any).__windowStore) {
        (window as any).__windowStore.getState().minimizeWindow(id);
      }
    }, appIdOrTitle);
    await this.page.waitForTimeout(100);
  }

  async restoreWindow(appIdOrTitle: string) {
    await this.page.evaluate((id) => {
      if ((window as any).__windowStore) {
        (window as any).__windowStore.getState().restoreWindow(id);
      }
    }, appIdOrTitle);
    await this.page.waitForTimeout(100);
  }

  async maximizeWindow(appIdOrTitle: string) {
    await this.page.evaluate((id) => {
      if ((window as any).__windowStore) {
        (window as any).__windowStore.getState().maximizeWindow(id);
      }
    }, appIdOrTitle);
    await this.page.waitForTimeout(100);
  }

  async getOpenWindowCount(): Promise<number> {
    return await this.page.locator('.window-frame').count();
  }

  async getWindowLocator(titleOrSubtext: string): Promise<Locator> {
    return this.page.locator(`.window-frame:has-text("${titleOrSubtext}")`).first();
  }

  async openStartMenu() {
    const startButton = this.page.locator('button:has-text("Start"), button:has-text("start")').first();
    await startButton.click();
    await this.page.waitForTimeout(100);
  }

  async clickStartMenuItem(label: string) {
    const item = this.page.locator(`button:has-text("${label}")`).first();
    await item.click();
    await this.page.waitForTimeout(100);
  }

  async switchToRoom() {
    const roomBtn = this.page.locator('button[title="Step Away to Room"]').first();
    if (await roomBtn.isVisible()) {
      await roomBtn.click();
    } else {
      await this.page.evaluate(() => {
        (window as any).__simStore.getState().switchView('room');
      });
    }
    await this.page.waitForTimeout(100);
  }
}
