import { describe, expect, it } from 'vitest';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { RentCoordination } from '../../src/engine/kernel/RentCoordination';

function fixture() {
  const owners = createCoreDomainOwners();
  let publishes = 0;
  const rent = new RentCoordination(owners, () => { publishes += 1; });
  return { owners, rent, publishes: () => publishes };
}

describe('RentCoordination', () => {
  it('records a reminder once and keeps the world paper trail authoritative', () => {
    const { owners, rent } = fixture();
    const due = owners.economy.getState().rentDueDay;
    expect(due).toBeGreaterThan(2);
    const reminderDay = due - 2;
    owners.clock.setTotalMinutes((reminderDay - 1) * 1440 + 480);

    rent.processRentDaily(reminderDay);
    expect(owners.world.getFlag(`rent_reminded_${due}`)).toBe(true);
    expect(owners.world.getFlag(`rentmail_due_${due}`))
      .toBe(Math.round(owners.economy.getState().rentAmount * 100));

    const before = owners.social.getState().conversations;
    rent.processRentDaily(reminderDay);
    expect(owners.social.getState().conversations).toEqual(before);
  });

  it('stamps the overdue mail once and clears overdue on successful payment', () => {
    const { owners, rent, publishes } = fixture();
    const due = owners.economy.getState().rentDueDay;
    owners.clock.setTotalMinutes(due * 1440 + 480);
    rent.processRentDaily(due + 1);

    expect(owners.world.getFlag('rent_overdue')).toBe(true);
    expect(owners.world.getFlag(`rentmail_overdue_${due}`))
      .toBe(Math.round(owners.economy.getState().rentAmount * 100));

    const cashNeeded = owners.economy.getState().rentAmount + 100;
    owners.economy.earnCash(cashNeeded, 'fixture:rent');
    const payment = rent.payRent();

    expect(payment.success).toBe(true);
    expect(publishes()).toBe(1);
    expect(owners.economy.getState().rentPaid).toBe(true);
    expect(owners.world.getFlag('rent_overdue')).toBe(false);
    expect(rent.payRent().success).toBe(false);
    expect(publishes()).toBe(1);
  });

  it('never treats an unavailable landlord as authority over rent liability', () => {
    const { owners, rent } = fixture();
    const due = owners.economy.getState().rentDueDay;
    owners.clock.setTotalMinutes((due - 1) * 1440 + 480);
    rent.processRentDaily(due);
    expect(owners.world.getFlag(`rent_warned_${due}`)).toBe(true);
  });
});
