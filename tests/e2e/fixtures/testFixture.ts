import { test as base, expect } from '@playwright/test';
import { DesktopPage } from './pageObjects/DesktopPage';
import { BrowserPage } from './pageObjects/BrowserPage';
import { PulsePage } from './pageObjects/PulsePage';
import { RoomPage } from './pageObjects/RoomPage';
import { CafePage } from './pageObjects/CafePage';
import { Day14ModalPage } from './pageObjects/Day14ModalPage';

export interface SimHelpers {
  getState: () => Promise<any>;
  advanceGameMinutes: (minutes: number, reason?: string) => Promise<void>;
  jumpToDay: (targetDay: number) => Promise<void>;
  earnCash: (amount: number, reason?: string) => Promise<void>;
  spendCash: (amount: number, reason?: string) => Promise<void>;
  upgradeRam: (ramMB: number, cost?: number) => Promise<void>;
  upgradeOs: (targetOs: 'Orion_4.8' | 'Orion_6.0', cost?: number) => Promise<void>;
  upgradeConnection: (connType: string, cost?: number) => Promise<void>;
  installSoftware: (appId: string, options?: any) => Promise<void>;
  uninstallSoftware: (installedId: string) => Promise<void>;
  setNarrativeFlag: (key: string, value: any) => Promise<void>;
  openWindow: (appId: string, title?: string, customState?: any) => Promise<string>;
  closeWindow: (id: string) => Promise<void>;
  resetDatabase: () => Promise<void>;
}

export interface TestFixtures {
  desktopPage: DesktopPage;
  browserPage: BrowserPage;
  pulsePage: PulsePage;
  roomPage: RoomPage;
  cafePage: CafePage;
  day14Page: Day14ModalPage;
  sim: SimHelpers;
}

export const test = base.extend<TestFixtures>({
  desktopPage: async ({ page }, use) => {
    const desktopPage = new DesktopPage(page);
    await use(desktopPage);
  },
  browserPage: async ({ page }, use) => {
    const browserPage = new BrowserPage(page);
    await use(browserPage);
  },
  pulsePage: async ({ page }, use) => {
    const pulsePage = new PulsePage(page);
    await use(pulsePage);
  },
  roomPage: async ({ page }, use) => {
    const roomPage = new RoomPage(page);
    await use(roomPage);
  },
  cafePage: async ({ page }, use) => {
    const cafePage = new CafePage(page);
    await use(cafePage);
  },
  day14Page: async ({ page }, use) => {
    const day14Page = new Day14ModalPage(page);
    await use(day14Page);
  },
  sim: async ({ page }, use) => {
    const helpers: SimHelpers = {
      getState: async () => {
        return await page.evaluate(() => {
          return (window as any).__simStore ? (window as any).__simStore.getState().state : null;
        });
      },
      advanceGameMinutes: async (minutes: number, reason?: string) => {
        await page.evaluate(({ m, r }) => {
          if ((window as any).__simStore) {
            (window as any).__simStore.getState().advanceTime(m, r);
          }
        }, { m: minutes, r: reason });
        await page.waitForTimeout(50);
      },
      jumpToDay: async (targetDay: number) => {
        await page.evaluate((tDay) => {
          if ((window as any).__simStore) {
            const store = (window as any).__simStore.getState();
            let currentDay = store.state.time.day;
            while (currentDay < tDay) {
              store.restOrSleep(8);
              currentDay = (window as any).__simStore.getState().state.time.day;
            }
          }
        }, targetDay);
        await page.waitForTimeout(100);
      },
      earnCash: async (amount: number, reason = 'Test bonus') => {
        await page.evaluate(({ a, r }) => {
          if ((window as any).__simStore) {
            (window as any).__simStore.getState().earnCash(a, r);
          }
        }, { a: amount, r: reason });
        await page.waitForTimeout(50);
      },
      spendCash: async (amount: number, reason = 'Test spend') => {
        await page.evaluate(({ a, r }) => {
          if ((window as any).__simStore) {
            (window as any).__simStore.getState().spendCash(a, r);
          }
        }, { a: amount, r: reason });
        await page.waitForTimeout(50);
      },
      upgradeRam: async (ramMB: number, cost = 0) => {
        await page.evaluate(({ ram, c }) => {
          if ((window as any).__simStore) {
            (window as any).__simStore.getState().upgradeRam(ram, c);
          }
        }, { ram: ramMB, c: cost });
        await page.waitForTimeout(50);
      },
      upgradeOs: async (targetOs: 'Orion_4.8' | 'Orion_6.0', cost = 0) => {
        await page.evaluate(({ os, c }) => {
          if ((window as any).__simStore) {
            (window as any).__simStore.getState().upgradeOs(os, c);
          }
        }, { os: targetOs, c: cost });
        await page.waitForTimeout(50);
      },
      upgradeConnection: async (connType: string, cost = 0) => {
        await page.evaluate(({ conn, c }) => {
          if ((window as any).__simStore) {
            (window as any).__simStore.getState().upgradeConnection(conn, c);
          }
        }, { conn: connType, c: cost });
        await page.waitForTimeout(50);
      },
      installSoftware: async (appId: string, options?: any) => {
        await page.evaluate(({ id, opt }) => {
          if ((window as any).__simStore) {
            (window as any).__simStore.getState().installSoftware(id, opt);
          }
        }, { id: appId, opt: options });
        await page.waitForTimeout(50);
      },
      uninstallSoftware: async (installedId: string) => {
        await page.evaluate((id) => {
          if ((window as any).__simStore) {
            (window as any).__simStore.getState().uninstallSoftware(id);
          }
        }, installedId);
        await page.waitForTimeout(50);
      },
      setNarrativeFlag: async (key: string, value: any) => {
        await page.evaluate(({ k, v }) => {
          if ((window as any).__simStore) {
            (window as any).__simStore.getState().setNarrativeFlag(k, v);
          }
        }, { k: key, v: value });
        await page.waitForTimeout(50);
      },
      openWindow: async (appId: string, title?: string, customState?: any) => {
        const winId = await page.evaluate(({ id, t, c }) => {
          if ((window as any).__windowStore) {
            return (window as any).__windowStore.getState().openWindow(id, t, c);
          }
          return id;
        }, { id: appId, t: title, c: customState });
        await page.waitForTimeout(100);
        return winId;
      },
      closeWindow: async (id: string) => {
        await page.evaluate((winId) => {
          if ((window as any).__windowStore) {
            (window as any).__windowStore.getState().closeWindow(winId);
          }
        }, id);
        await page.waitForTimeout(50);
      },
      resetDatabase: async () => {
        await page.evaluate(() => {
          try {
            if (typeof indexedDB !== 'undefined') {
              indexedDB.deleteDatabase('AwayMessageDB');
            }
          } catch {}
        });
      },
    };
    await use(helpers);
  },
});

export { expect };
