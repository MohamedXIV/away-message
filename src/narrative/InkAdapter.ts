import { SimulationEngine } from '../engine/SimulationEngine';
import { NarrativeEngine } from './NarrativeEngine';
import {
  StoryKnot,
  StoryChoice,
  ParsedNarrativeTag,
  BeatTriggerEvaluationResult,
} from './types';
import { parseNarrativeTag } from './tagParser';
import { CORE_IDS } from '../engine/coreBuddies';

export class InkAdapter {
  public readonly engine: SimulationEngine;
  public readonly narrative: NarrativeEngine;
  private unsubscribeEvents: Array<() => void> = [];
  private triggeredKnots: Set<string> = new Set();
  private isProcessingKnot = false;

  constructor(engine: SimulationEngine, narrative: NarrativeEngine) {
    this.engine = engine;
    this.narrative = narrative;
    this.setupListeners();
    this.syncSnapshot();
  }

  public destroy(): void {
    for (const unsub of this.unsubscribeEvents) {
      unsub();
    }
    this.unsubscribeEvents = [];
  }

  private setupListeners(): void {
    const unsubTick = this.engine.events.on('time:tick', () => {
      this.syncSnapshot();
      this.evaluateAutomaticTriggers();
    });

    const unsubJump = this.engine.events.on('time:jump', () => {
      this.syncSnapshot();
      this.evaluateAutomaticTriggers();
    });

    const unsubDay = this.engine.events.on('time:day_changed', () => {
      this.syncSnapshot();
      this.evaluateAutomaticTriggers();
    });

    const unsubStatus = this.engine.events.on('social:status_changed', () => {
      this.syncSnapshot();
      this.evaluateAutomaticTriggers();
    });

    this.unsubscribeEvents.push(unsubTick, unsubJump, unsubDay, unsubStatus);
  }

  public syncSnapshot() {
    const state = this.engine.getState();
    return this.narrative.injectContext(state);
  }

  /**
   * Finds any knots eligible to trigger proactively for online buddies.
   */
  public evaluateEligibleKnots(): BeatTriggerEvaluationResult[] {
    const snapshot = this.syncSnapshot();
    const results: BeatTriggerEvaluationResult[] = [];
    const allKnots = this.narrative.getAllKnots();

    for (const knot of allKnots) {
      if (this.triggeredKnots.has(knot.id)) {
        continue;
      }

      // If tied to a buddy, verify presence
      if (knot.characterId && knot.characterId !== 'player' && knot.characterId !== 'system') {
        const presence = this.engine.social.getPresence(knot.characterId);
        // Only trigger if online or away
        if (!presence || presence.status === 'offline') {
          continue;
        }
      }

      const eligible = this.narrative.isKnotEligible(knot, snapshot);
      results.push({
        knot,
        characterId: knot.characterId,
        eligible,
      });
    }

    return results;
  }

  public evaluateAutomaticTriggers(): void {
    if (this.isProcessingKnot) return;

    const eligible = this.evaluateEligibleKnots().filter((r) => r.eligible);
    if (eligible.length === 0 || !eligible[0]) return;

    // Pick first eligible un-triggered knot
    const target = eligible[0].knot;
    this.triggerKnot(target.id);
  }

  public triggerKnot(knotId: string): StoryKnot | null {
    const knot = this.narrative.getKnot(knotId);
    if (!knot) return null;

    this.triggeredKnots.add(knotId);
    this.narrative.startKnot(knotId);

    // Apply knot tags
    if (knot.tags) {
      this.executeTags(knot.tags);
    }

    // Apply line tags across all lines
    knot.lines.forEach((line) => {
      if (line.tags) {
        this.executeTags(line.tags);
      }
    });

    // Deliver knot messages to SocialEngine
    if (knot.characterId && knot.characterId !== 'player' && knot.characterId !== 'system') {
      const currentMin = this.engine.clock.getTotalMinutes();
      knot.lines.forEach((line) => {
        if (line.speaker !== 'player') {
          this.engine.social.sendMessage(
            knot.characterId,
            knot.characterId,
            'player',
            line.text,
            currentMin,
            false,
            line.tags
          );
        }
      });
    }

    return knot;
  }

  public executeChoice(buddyId: string, choice: StoryChoice): void {
    // 1. Send player message if tied to a buddy
    if (buddyId && buddyId !== 'system') {
      this.engine.dispatchAction({
        type: 'SOCIAL_SEND_MESSAGE',
        buddyId,
        text: choice.text,
        tags: choice.tags,
      });

      // 2. Apply social action if defined
      if (choice.socialAction) {
        this.engine.dispatchAction({
          type: 'SOCIAL_APPLY_ACTION',
          buddyId,
          socialAction: choice.socialAction,
        });
      }
    }

    // 3. Process choice tags
    if (choice.tags) {
      this.executeTags(choice.tags);
    }

    // 4. Advance to target knot or nextScriptId
    const nextKnotId = choice.targetKnot || choice.nextScriptId;
    if (nextKnotId) {
      this.triggerKnot(nextKnotId);
    }
  }

  public executeTags(rawTags: string[]): void {
    // Roster-first fallback: tags without an explicit buddy resolve to whoever is around.
    const fallback = this.engine.social.getBuddies()[0]?.id;
    for (const rawTag of rawTags) {
      const parsed = parseNarrativeTag(rawTag, fallback);
      this.dispatchParsedTagAction(parsed);
    }
  }

  public dispatchParsedTagAction(tag: ParsedNarrativeTag): void {
    switch (tag.type) {
      case 'beat': {
        this.engine.dispatchAction({
          type: 'NARRATIVE_TRIGGER_BEAT',
          beatId: tag.beatId,
        });
        this.narrative.markBeatCompleted(tag.beatId);
        break;
      }

      case 'effect_flag': {
        this.engine.dispatchAction({
          type: 'NARRATIVE_SET_FLAG',
          key: tag.key,
          value: tag.value,
        });
        this.narrative.setFlag(tag.key, tag.value);
        break;
      }

      case 'effect_money': {
        if (tag.action === 'earn') {
          this.engine.dispatchAction({
            type: 'PLAYER_EARN_CASH',
            amount: tag.amount,
            reason: tag.reason,
          });
        } else {
          this.engine.dispatchAction({
            type: 'PLAYER_SPEND_CASH',
            amount: tag.amount,
            reason: tag.reason,
          });
        }
        break;
      }

      case 'effect_file': {
        if (tag.action === 'create') {
          const parent = tag.path.substring(0, tag.path.lastIndexOf('/')) || 'C:/Downloads';
          const name = tag.path.substring(tag.path.lastIndexOf('/') + 1) || 'file.dat';
          this.engine.dispatchAction({
            type: 'VFS_CREATE_FILE',
            file: {
              name,
              path: tag.path,
              parentPath: parent,
              kind: (tag.kind || 'text') as any,
              sizeBytes: 1024,
            },
          });
        } else if (tag.action === 'delete') {
          this.engine.dispatchAction({
            type: 'VFS_DELETE_FILE',
            path: tag.path,
          });
        }
        break;
      }

      case 'effect_view': {
        this.engine.dispatchAction({
          type: 'VIEW_SWITCH',
          view: tag.view,
        });
        break;
      }

      case 'social': {
        this.engine.dispatchAction({
          type: 'SOCIAL_APPLY_ACTION',
          buddyId: tag.buddyId,
          socialAction: tag.action,
        });
        break;
      }

      case 'schedule_appointment': {
        this.engine.dispatchAction({
          type: 'NARRATIVE_SCHEDULE_APPOINTMENT',
          appointment: {
            id: tag.appointmentId,
            characterId: tag.characterId || this.engine.social.getBuddies()[0]?.id || CORE_IDS.MAYA,
            locationId: tag.location,
            targetDay: tag.day,
            startMinute: tag.startMinute,
            endMinute: tag.endMinute,
            description: tag.description,
          },
        });
        break;
      }

      case 'unlock': {
        this.engine.dispatchAction({
          type: 'NARRATIVE_SET_FLAG',
          key: `unlock_${tag.targetType}_${tag.targetId}`,
          value: true,
        });
        this.narrative.setFlag(`unlock_${tag.targetType}_${tag.targetId}`, true);
        break;
      }

      case 'unknown':
      default:
        break;
    }
  }

  public getTriggeredKnotIds(): string[] {
    return Array.from(this.triggeredKnots);
  }

  public resetTriggeredKnots(): void {
    this.triggeredKnots.clear();
  }
}
