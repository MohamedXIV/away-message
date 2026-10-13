import type { CoreDomainOwners } from './CoreDomainOwners';
import { generateNewcomer, shouldAutoDiscover, NEWCOMER_METVIA_ROTATION } from '../CharacterDirector';

type NewcomerDefinition = Awaited<ReturnType<typeof generateNewcomer>>['definition'];

/**
 * Bounded world/newcomer async generation; canonical state still belongs to
 * the existing Social roster and World event queue. Does not tick by itself.
 */
export class ProceduralWorldCycle {
  private pending = false;
  private lastGeneratedDay = 0;

  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'world' | 'social' | 'clock'>,
    private readonly registerNewcomer: (buddy: NewcomerDefinition, introText: string) => boolean,
    private readonly notifySubscribers: () => void,
  ) {}

  public processNewDay(day: number): void {
    this.maybeScheduleProceduralGeneration();
    this.maybeAutoDiscoverNewcomer(day);
  }

  private maybeScheduleProceduralGeneration(): void {
    const pending = this.owners.world.getPendingEvents().length;
    if (pending >= 3) return;
    const currentDay = this.owners.clock.getTime().day;
    if (this.pending || this.lastGeneratedDay === currentDay) return;
    this.pending = true;
    this.lastGeneratedDay = currentDay;
    const totalMinutes = this.owners.clock.getTotalMinutes();
    // Fire-and-forget, never blocks simulation
    import('../ProceduralDirector')
      .then(({ ProceduralDirector }) => {
        const dir = new ProceduralDirector(this.owners.world);
        return dir.generateNextBatch(currentDay, totalMinutes, { maxEvents: 2, useAI: true });
      })
      .catch(() => {})
      .finally(() => {
        this.pending = false;
        // Notify so UI (CityWire) updates pending count
        try { this.notifySubscribers(); } catch {}
      });
  }

  /**
   * Sandbox auto-discovery: every few days a stranger can appear from the net
   * or work, register as a buddy, and say hi. Throttled + deterministic
   * (see shouldAutoDiscover); AI enriches when a key exists, templates otherwise.
   * Fire-and-forget — never blocks the simulation tick.
   */
  private maybeAutoDiscoverNewcomer(day: number): void {
    try {
      const lastRaw = this.owners.world.getFlag('newcomer_last_day');
      const lastDay = typeof lastRaw === 'number' ? lastRaw : 0;
      if (!shouldAutoDiscover(day, lastDay)) return;
      const proceduralCount = this.owners.social.getBuddies().filter((b) => b.isProcedural).length;
      const metVia = NEWCOMER_METVIA_ROTATION[proceduralCount % NEWCOMER_METVIA_ROTATION.length]!;
      const existingIds = this.owners.social.getBuddies().map((b) => b.id);
      void generateNewcomer({ metVia, day, seed: `auto-day-${day}`, useAI: true }, { existingIds })
        .then((res) => {
          const added = { success: this.registerNewcomer(res.definition, res.introText) };
          if (!added.success) return;
          // NightBoard meetings leave a public trace → auto thread via existing machinery
          if (metVia === 'nightboard') {
            try {
              this.owners.world.injectProceduralEvents([{
                id: `met_${res.definition.id}`.replace(/[^a-z0-9_]/g, '_').slice(0, 40),
                title: `New voice on NightBoard: ${res.definition.displayName}`,
                description: `${res.definition.displayName} (${res.definition.handle}) showed up asking about the canal hum thread.`,
                category: 'city_news',
                triggerDay: day,
                triggerHour: 22,
                knowledgePrompt: `A newcomer (${res.definition.displayName}) appeared on NightBoard and added you on Pulse.`,
                siteUrl: 'http://nightboard.local/',
              }]);
            } catch { /* trace is best-effort */ }
          }
          this.owners.world.setFlag('newcomer_last_day', day);
          this.notifySubscribers();
        })
        .catch(() => {});
    } catch { /* auto-discovery never breaks the tick */ }
  }

}
