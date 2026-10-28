import { expect, test } from '@playwright/test';
import { installOrion48FromDos } from './workerDosTestHelper';

test('#214 fresh Orion acquires Pulse only through real internet → VFS setup → install, then uninstalls', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-runtime', 'worker');
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByTestId('worker-phase')).toHaveText('game');
  await page.getByRole('button', { name: 'Pause clock' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const desktop = await installOrion48FromDos(page);
  await expect(desktop.getByRole('button', { name: 'Open Pulse Messenger' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'pulse', exact: true })).toHaveCount(0);
  await expect(desktop.getByRole('button', { name: 'Open FlashFetch' })).toHaveCount(0);

  await desktop.getByRole('button', { name: 'Open Voyager Browser' }).dblclick();
  const browser = page.getByTestId('worker-window-browser');
  await expect(browser.getByText('DownloadHub.local — Software Archive')).toBeVisible();
  const pulse = browser.getByRole('row').filter({ hasText: 'Pulse Messenger 5.2 Classic' });
  await pulse.getByRole('button', { name: /Download/ }).click();

  // DownloadHub must open the system's real download queue, not the optional
  // third-party FlashFetch that this player has not downloaded.
  const system = page.getByTestId('worker-window-system');
  await expect(system.getByTestId('worker-system-panel')).toContainText('pulse52_setup.exe');
  await expect(page.getByTestId('worker-window-flashfetch')).toHaveCount(0);

  // Real canonical bandwidth: the 6 MiB Pulse installer needs world minutes
  // on the starter connection, not an instant faux UI progress animation.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Advance 15 minutes' }).click();
  }
  await expect(system.getByTestId('worker-system-panel')).toContainText('pulse52_setup.exe · complete');
  await desktop.getByRole('button', { name: 'Close Computer & Setup' }).click();
  await desktop.getByRole('button', { name: 'Close Voyager Browser' }).click();

  await desktop.getByRole('button', { name: 'Open My Computer' }).dblclick();
  const explorer = page.getByTestId('worker-window-fileexplorer');
  await explorer.getByRole('button', { name: 'Downloads', exact: true }).click();
  await explorer.getByRole('button', { name: 'Open file: pulse52_setup.exe' }).dblclick();
  const installer = page.getByTestId('worker-installer');
  await expect(installer).toContainText('Pulse Messenger');
  for (let step=0; step<4; step++) {
    await installer.getByRole('button', { name: /Next/ }).click();
  }
  await installer.getByRole('button', { name: 'Finish' }).click();
  await expect(desktop.getByRole('button', { name: 'Open Pulse Messenger' })).toHaveCount(1);
  await expect(page.getByTestId('worker-window-pulse')).toBeVisible();
  // Real Worker now exposes the original retro Pulse account onboarding,
  // instead of opening a permanently signed-in engineering chat panel.
  const messenger = page.getByTestId('worker-pulse-panel');
  await expect(messenger).toHaveAttribute('data-pulse-phase', 'sign-in');
  // Signed-out Pulse really closes, so Quick Launch must cold-start and
  // charge the same Worker hardware time as desktop and Start Menu.
  const taskbar = desktop.getByTestId('worker-desktop-taskbar');
  const quickPulse = taskbar.getByRole('group', { name: 'Quick Launch' })
    .getByRole('button', { name: 'Pulse Messenger', exact: true });
  await expect(quickPulse).toBeVisible();
  await desktop.getByRole('button', { name: 'Close Pulse Messenger' }).click();
  const beforeCold = Number(await page.getByTestId('worker-minute').textContent());
  await quickPulse.click();
  await expect(messenger).toBeVisible();
  expect(Number(await page.getByTestId('worker-minute').textContent())).toBeGreaterThan(beforeCold);
  await messenger.getByText('Get a new Pulse ID').click();
  await messenger.getByLabel('Pulse ID').fill('new_player06');
  await messenger.getByLabel('Password', { exact: true }).fill('localtest123');
  await messenger.getByLabel('Confirm password').fill('localtest123');
  await messenger.getByRole('button', { name: 'Create Pulse ID' }).click();
  await expect(messenger).toHaveAttribute('data-pulse-phase', 'signed-in');
  await expect(messenger).toContainText('new_player06');
  await messenger.getByRole('button', { name: 'Sign out' }).click();
  await expect(messenger).toHaveAttribute('data-pulse-phase', 'sign-in');
  await messenger.getByLabel('Pulse ID').fill('new_player06');
  await messenger.getByLabel('Password', { exact: true }).fill('localtest123');
  await messenger.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(messenger).toHaveAttribute('data-pulse-phase', 'signed-in');
  await expect(messenger).toHaveAttribute('data-pulse-layout', 'split');
  const contacts = messenger.getByTestId('worker-pulse-contacts');
  await expect(contacts).toBeVisible();
  // A brand-new online identity starts with no buddies even though the
  // physical player's world has known people. Contacts must be added by this ID.
  await expect(contacts).toContainText('No buddies yet');
  // Adding a buddy is a period-style typed Pulse ID flow, not a roster dropdown.
  await messenger.getByRole('button', { name: 'Add a buddy' }).click();
  const addDialog = messenger.getByRole('dialog', { name: 'Add a buddy' });
  const idInput = addDialog.getByRole('combobox', { name: "Buddy's Pulse ID" });
  await expect(idInput).toBeFocused();
  await idInput.fill('@not_a_learned_buddy');
  await addDialog.getByRole('button', { name: 'Add Buddy', exact: true }).click();
  await expect(addDialog.getByRole('alert')).toContainText('not among the handles');
  await expect(contacts.locator('[data-testid^="worker-pulse-contact-"]')).toHaveCount(0);
  const firstKnownHandle = await addDialog.locator('datalist option').first().getAttribute('value');
  if (!firstKnownHandle) throw new Error('Expected a learned Pulse ID suggestion');
  await idInput.fill('@' + firstKnownHandle.toUpperCase());
  await addDialog.getByRole('button', { name: 'Add Buddy', exact: true }).click();
  await expect(addDialog).toHaveCount(0);
  await expect(contacts.locator('[data-testid^="worker-pulse-contact-"]')).toHaveCount(1);

  // A signed-in identity can inspect its own learned buddy. Profiles only
  // show account-visible fields, never hidden Social relationship scores.
  const inspectProfile = messenger.getByRole('button', { name: /^View profile for / });
  await inspectProfile.click();
  const buddyProfile = messenger.getByRole('dialog', { name: 'Buddy profile' });
  await expect(buddyProfile).toBeVisible();
  await expect(buddyProfile).toContainText('Pulse ID');
  await expect(buddyProfile).toContainText('Current status');
  await expect(buddyProfile).toContainText('Last IM');
  await page.keyboard.press('Escape');
  await expect(buddyProfile).toHaveCount(0);
  await expect(inspectProfile).toBeFocused();

  // Offline dialogue is choice-driven and Worker-authored. No free textbox
  // invites arbitrary messages to a keyword bot.
  const choices = messenger.getByTestId('worker-pulse-choices');
  await expect(choices.getByRole('button', { name: 'Hey! How have you been lately?' })).toBeVisible();
  await expect(messenger.getByRole('textbox', { name: 'Pulse message' })).toHaveCount(0);
  await choices.getByRole('button', { name: 'Hey! How have you been lately?' }).click();
  await expect(messenger.getByTestId('worker-pulse-messages'))
    .toContainText('Hey! How have you been lately?');
  await expect(messenger.getByTestId('worker-pulse-messages'))
    .toContainText(/\d{1,2}:\d{2} (AM|PM)/);
  await expect(messenger.getByTestId('worker-pulse-messages').locator('[data-sender="buddy"]')).toHaveCount(0);

  // The Worker client restores the classic tabbed IM workflow without
  // creating a second chat owner. Switching, closing and reopening tabs must
  // never lose the Social-owned transcript or automatically reopen a closed tab.
  const tabs = messenger.getByTestId('worker-pulse-chat-tabs');
  await expect(messenger.getByTestId('worker-pulse-messages'))
    .toHaveAttribute('data-pulse-transcript-style', 'classic');
  await expect(tabs.getByRole('button', { name: /^Switch to / })).toHaveCount(1);
  // Fresh worlds have two known ordinary acquaintances, not a fixed cast.
  // Capture the original ID: presence/unread sorting can reorder the list.
  const contactRows = contacts.locator('[data-testid^="worker-pulse-contact-"]');
  const originalContactTestId = await contactRows.first().getAttribute('data-testid');
  if (!originalContactTestId) throw new Error('Expected the original Pulse contact');
  await messenger.getByRole('button', { name: 'Add a buddy' }).click();
  const addSecondDialog = messenger.getByRole('dialog', { name: 'Add a buddy' });
  const secondKnownHandle = await addSecondDialog.locator('datalist option').first().getAttribute('value');
  if (!secondKnownHandle) throw new Error('Expected a second learned Pulse ID');
  await addSecondDialog.getByRole('combobox', { name: "Buddy's Pulse ID" }).fill(secondKnownHandle);
  await addSecondDialog.getByRole('button', { name: 'Add Buddy', exact: true }).click();
  await expect(addSecondDialog).toHaveCount(0);
  await expect(contactRows).toHaveCount(2);
  const newContactRow = contacts.locator(
    `[data-testid^="worker-pulse-contact-"]:not([data-testid="${originalContactTestId}"])`,
  );
  // Classic buddy list actions work with the mouse and a visible touch target.
  // Looking at another person's profile must not switch the current IM.
  await newContactRow.click({ button: 'right' });
  const buddyActions = messenger.getByRole('menu', { name: /^Buddy actions for / });
  await expect(buddyActions).toBeVisible();
  await buddyActions.getByRole('menuitem', { name: 'View Profile' }).click();
  const otherBuddyProfile = messenger.getByRole('dialog', { name: 'Buddy profile' });
  await expect(otherBuddyProfile).toBeVisible();
  await expect(tabs.getByRole('button', { name: /^Switch to / })).toHaveCount(1);
  await expect(messenger.getByTestId('worker-pulse-messages'))
    .toContainText('Hey! How have you been lately?');
  await page.keyboard.press('Escape');
  await expect(otherBuddyProfile).toHaveCount(0);
  await expect(newContactRow).toBeFocused();
  await newContactRow.locator('..').getByRole('button', { name: /^Actions for / }).click();
  await buddyActions.getByRole('menuitem', { name: 'Send IM' }).click();
  await expect(tabs.getByRole('button', { name: /^Switch to / })).toHaveCount(2);
  await expect(tabs.getByRole('button', { name: /^Switch to / }).last()).toHaveAttribute('aria-current', 'page');
  await tabs.getByRole('button', { name: /^Close conversation with / }).last().click();
  await expect(tabs.getByRole('button', { name: /^Switch to / })).toHaveCount(1);
  await expect(messenger.getByTestId('worker-pulse-messages'))
    .toContainText('Hey! How have you been lately?');
  await newContactRow.click();
  await expect(tabs.getByRole('button', { name: /^Switch to / })).toHaveCount(2);
  await tabs.getByRole('button', { name: /^Close conversation with / }).first().click();
  await expect(tabs.getByRole('button', { name: /^Switch to / })).toHaveCount(1);
  await tabs.getByRole('button', { name: /^Close conversation with / }).first().click();
  await expect(tabs.getByRole('button', { name: /^Switch to / })).toHaveCount(0);
  await expect(messenger.getByTestId('worker-pulse-messages')).toHaveCount(0);
  await contacts.getByTestId(originalContactTestId).click();
  await expect(tabs.getByRole('button', { name: /^Switch to / })).toHaveCount(1);
  await expect(messenger.getByTestId('worker-pulse-messages'))
    .toContainText('Hey! How have you been lately?');

  // A second account is a separate identity, not a shared device-local buddy list.
  await messenger.getByRole('button', { name: 'Sign out' }).click();
  await messenger.getByText('Get a new Pulse ID').click();
  await messenger.getByLabel('Pulse ID').fill('second_player06');
  await messenger.getByLabel('Password', { exact: true }).fill('secondpass123');
  await messenger.getByLabel('Confirm password').fill('secondpass123');
  await messenger.getByRole('button', { name: 'Create Pulse ID' }).click();
  await expect(messenger).toHaveAttribute('data-pulse-phase', 'signed-in');
  await expect(messenger.getByTestId('worker-pulse-contacts')).toContainText('No buddies yet');
  await expect(messenger.getByTestId('worker-pulse-messages')).toHaveCount(0);

  await messenger.getByRole('button', { name: 'Sign out' }).click();
  await messenger.getByLabel('Pulse ID').fill('new_player06');
  await messenger.getByLabel('Password', { exact: true }).fill('localtest123');
  await messenger.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(messenger.getByTestId('worker-pulse-messages')).toContainText('Hey! How have you been lately?');

  // Signed-in Pulse closes to tray (still running), so quick launch
  // restores the existing session immediately without a second startup cost.
  const beforeWarm = Number(await page.getByTestId('worker-minute').textContent());
  await desktop.getByRole('button', { name: 'Close Pulse Messenger' }).click();
  await expect(messenger).toHaveCount(0);
  await quickPulse.click();
  await expect(messenger).toBeVisible();
  await expect(messenger).toHaveAttribute('data-pulse-phase', 'signed-in');
  await expect(messenger.getByTestId('worker-pulse-messages'))
    .toContainText('Hey! How have you been lately?');
  expect(Number(await page.getByTestId('worker-minute').textContent())).toBe(beforeWarm);

  await page.getByRole('button', { name: 'Save game' }).click();
  await expect(page.getByText('Saved to slot_1')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue last save' }).click();
  await page.getByRole('button', { name: 'desktop', exact: true }).click();
  const loaded = page.getByTestId('worker-desktop');
  await expect(loaded.getByRole('button', { name: 'Open Pulse Messenger' })).toHaveCount(1);

  // A cold reload requires the real remembered account sign-in again, but the
  // canonical transcript must restore exactly from the saved social state.
  await loaded.getByRole('button', { name: 'Open Pulse Messenger' }).dblclick();
  const restored = page.getByTestId('worker-pulse-panel');
  await expect(restored).toHaveAttribute('data-pulse-phase', 'sign-in');
  await restored.getByLabel('Pulse ID').fill('new_player06');
  await restored.getByLabel('Password', { exact: true }).fill('localtest123');
  await restored.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(restored).toHaveAttribute('data-pulse-phase', 'signed-in');
  await expect(restored.getByTestId('worker-pulse-messages'))
    .toContainText('Hey! How have you been lately?');

  // The player message survives a cold save; no NPC answer materializes
  // immediately just because Pulse has been reopened on this device.
  await expect(restored.getByTestId('worker-pulse-messages')
    .locator('[data-sender="buddy"]')).toHaveCount(0);
  await expect(restored.getByTestId('worker-pulse-conversation-state'))
    .toContainText(/waiting|reply/i);

  await loaded.getByRole('button', { name: 'Close Pulse Messenger' }).click();

  await loaded.getByRole('button', { name: 'Open Computer & Setup' }).dblclick();
  await page.getByTestId('worker-system-panel').getByRole('button', { name: 'Uninstall Pulse Messenger' }).click();
  await expect(loaded.getByRole('button', { name: 'Open Pulse Messenger' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'pulse', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !('__simEngine' in window) && !('__simStore' in window))).toBe(true);
});
