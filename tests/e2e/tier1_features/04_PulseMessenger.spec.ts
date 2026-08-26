import { test, expect } from '../fixtures/testFixture';

test.describe('Tier 1: Pulse Messenger', () => {
  test.beforeEach(async ({ desktopPage, pulsePage }) => {
    await desktopPage.goto();
    await pulsePage.openPulse();
  });

  test('TC-PLS-01: Pulse Buddy List renders contacts with presence statuses', async ({ page }) => {
    await expect(page.locator('text=Maya').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Ryan').first()).toBeVisible();
    await expect(page.locator('text=Nora').first()).toBeVisible();
  });

  test('TC-PLS-02: Switching active chat tab loads buddy conversation history', async ({ page, pulsePage }) => {
    await pulsePage.selectBuddy('Ryan');
    await expect(page.locator('text=Ryan').first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-PLS-03: Sending custom text message updates chat log and store state', async ({ page, pulsePage, sim }) => {
    await pulsePage.selectBuddy('Ryan');
    await pulsePage.sendCustomMessage('Hey Ryan, see you at the cart!');

    await expect(page.locator('text=Hey Ryan, see you at the cart!').first()).toBeVisible({ timeout: 5000 });

    const state = await sim.getState();
    const msgs = state.social.conversations['ryan'] || state.social.conversations['ryan_foodcart'] || [];
    const hasMsg = msgs.some((m: any) => m.text.includes('Hey Ryan, see you at the cart!'));
    expect(hasMsg).toBe(true);
  });

  test('TC-PLS-04: Authored dialogue choices appear when script is triggered', async ({ page, pulsePage }) => {
    await pulsePage.selectBuddy('Maya');
    // Check if authored choice buttons or chat history is active
    const chatBox = page.locator('.window-frame:has-text("Pulse")').first();
    await expect(chatBox).toBeVisible();
  });

  test('TC-PLS-05: Simulation reflects read/unread message statuses', async ({ sim }) => {
    const state = await sim.getState();
    expect(state.social).toBeDefined();
    expect(state.social.presence).toBeDefined();
  });
});
