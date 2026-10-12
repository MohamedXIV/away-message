import { describe, expect, it } from 'vitest';
import { createCoreDomainOwners } from '../../src/engine/kernel/CoreDomainOwners';
import { SocialPresenceCycle } from '../../src/engine/kernel/SocialPresenceCycle';

describe('SocialPresenceCycle', () => {
  it('recharges solitude from canonical Needs once per day', () => {
    const owners = createCoreDomainOwners();
    const cycle = new SocialPresenceCycle(owners);
    owners.needs.spendSocialBattery(35);
    const before = owners.needs.getSocialBattery();
    const day = 250;
    owners.clock.setTotalMinutes((day - 1) * 1440 + 480);

    cycle.processPlayerBatteryDaily(day);
    expect(owners.needs.getSocialBattery()).toBe(before + 10);
    expect(owners.world.getFlag(`quietrecharge_${day}`)).toBe(true);

    cycle.processPlayerBatteryDaily(day);
    expect(owners.needs.getSocialBattery()).toBe(before + 10);
  });

  it('does not invent leave messages for buddies without recent real activity', () => {
    const owners = createCoreDomainOwners();
    const cycle = new SocialPresenceCycle(owners);
    const before = owners.social.getState().conversations;
    const atMinute = owners.clock.getTotalMinutes();

    cycle.sweepBusyLeaveLines(atMinute);

    expect(owners.social.getState().conversations).toEqual(before);
  });
});
