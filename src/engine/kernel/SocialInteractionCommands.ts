import type {
  ActionResult,
  BuddyCharacter,
  SimulationAction,
  SurfaceIdentityPromotion,
  SurfacePromotionResult,
} from '../types';
import type { CoreDomainOwners } from './CoreDomainOwners';
import type { PlayerContactCoordination } from './PlayerContactCoordination';
import type { RelationshipContinuity } from './RelationshipContinuity';
import { validatePersistedBuddy } from '../CharacterEngine';
import { pickMediationThanks } from '../characterTemplates';
import { buildPromotedSurfaceCharacter } from '../social/IdentityPromotion';
import { isOnlineOriginSource } from '../social/ReachPolicy';

/**
 * All Social commands (inbound/outbound messages, contacts, relationship
 * actions, mediation and lifecycle registrations) modify the ONE SocialEngine.
 * Its registration events still fan out to MyPlace/World in the shared bus.
 */
export class SocialInteractionCommands {
  constructor(
    private readonly owners: Pick<CoreDomainOwners, 'social' | 'myplace' | 'clock' | 'telemetry'>,
    private readonly playerContacts: PlayerContactCoordination,
    private readonly relationshipContinuity: RelationshipContinuity,
    private readonly publishState: () => void,
  ) {}

  /**
   * Register one canonical actor plus the social consequences of meeting.
   * Identity registration, origin memory and handle discovery stay together
   * whether the actor came from a generated newcomer or a surface promotion.
   */
  private admitBuddy(
    definition: BuddyCharacter,
    introText: string | undefined,
    silent: boolean,
    currentMinutes: number,
  ): BuddyCharacter {
    const registered = this.owners.social.registerBuddy(definition);
    // P3 origin memory: every buddy remembers how you met (immortal, shown in prompts)
    const meetDay = this.owners.clock.getTime().day;
    this.owners.social.addCoreMemory(registered.id, {
      text: `First met on Day ${meetDay} via ${registered.metVia ?? 'intro'}.`,
      kind: 'first_meeting',
      day: meetDay,
    });
    // Free roster: meeting someone IS learning their handle (contacts are earned).
    this.owners.social.learnHandle(registered.id, registered.handle);
    if (!silent) {
      const text = (introText?.trim() || `hey, i'm ${registered.displayName} — nice meeting you!`).slice(0, 500);
      this.owners.social.sendMessage(registered.id, registered.id, 'player', text, currentMinutes, true, ['intro', 'newcomer']);
    }
    return registered;
  }

  public dispatch(action: SimulationAction, currentMinutes: number): ActionResult | null {
    switch (action.type) {
      case 'SOCIAL_SEND_MESSAGE': {
        try {
          // Social battery gate (introvert meter): every send costs, bold sends
          // cost more, and an empty meter refuses (apologies always pass).
          const gate = this.playerContacts.gatePlayerMessage(action.buddyId, action.text, action.tags);
          if (!gate.ok) return { success: false, error: gate.error };
          const msg = this.owners.social.sendMessage(
            action.buddyId,
            'player',
            action.buddyId,
            action.text,
            currentMinutes,
            false,
            action.tags,
            (action as any).imageUrl,
            (action as any).imagePrompt,
            (action as any).imageCaption
          );
          this.publishState();
          return { success: true, data: msg };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'SOCIAL_RECEIVE_MESSAGE': {
        const msg = this.owners.social.sendMessage(
          action.buddyId,
          action.buddyId,
          'player',
          action.text,
          action.timestampMinute ?? currentMinutes,
          action.deliveredAway ?? false,
          action.tags,
          (action as any).imageUrl,
          (action as any).imagePrompt,
          (action as any).imageCaption
        );
        this.publishState();
        return { success: true, data: msg };
      }

      case 'SOCIAL_APPLY_ACTION': {
        try {
          const rels = this.owners.social.applySocialAction(action.buddyId, action.socialAction);
          // P3 sharp-event ladder: sustained dismissiveness has consequences (rules only)
          this.relationshipContinuity.checkSharpRelationship(action.buddyId, currentMinutes);
          this.publishState();
          return { success: true, data: rels };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'MEDIATION_RESPOND': {
        try {
          const res = this.owners.social.respondMediation(action.mediationId, action.choice, this.owners.clock.getTime().day);
          if (!res) return { success: false, error: `Mediation not found or closed: ${action.mediationId}` };
          // A helped requester says thanks out loud (rules-picked line, capped by resolve-once).
          if (action.choice === 'help') {
            this.owners.social.sendMessage(res.requesterId, res.requesterId, 'player', pickMediationThanks(`${res.id}:${res.resolvedDay ?? 1}`), currentMinutes, false, ['mediation', res.id]);
          }
          this.owners.telemetry.logEvent('social', 'mediation_responded', currentMinutes, { mediationId: res.id, choice: action.choice, status: res.status });
          this.publishState();
          return { success: true, data: res };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'ADD_CONTACT': {
        try {
          return this.playerContacts.addContactByHandle(String((action as { handle?: unknown }).handle ?? ''), currentMinutes);
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'NIGHTBOARD_MEET': {
        try {
          return this.playerContacts.meetOnNightBoard(currentMinutes);
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'SOCIAL_ADD_BUDDY': {
        try {
          const checked = validatePersistedBuddy(action.buddy);
          if (!checked.ok || !checked.definition) return { success: false, error: checked.error ?? 'Invalid buddy definition.' };
          const registered = this.admitBuddy(
            checked.definition,
            action.introText,
            !!action.silent,
            currentMinutes,
          );
          // 'social:buddy_registered' fans out to attitudes + MyPlace stub (see registerInternalEventHandlers)
          this.owners.telemetry.logEvent('social', 'buddy_added', currentMinutes, {
            buddyId: registered.id,
            metVia: registered.metVia ?? 'intro',
            silent: !!action.silent,
          });
          this.publishState();
          return { success: true, data: registered };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'SOCIAL_PROMOTE_SURFACE_IDENTITY': {
        try {
          const identity = action.identity;
          const username = String(identity?.username ?? '').trim().slice(0, 40);
          if (!username) return { success: false, error: 'A surface identity needs a username.' };
          if (!identity || !isOnlineOriginSource(identity.source)) {
            return { success: false, error: 'Only online surface identities can be promoted here.' };
          }
          const handle = String(identity.handle ?? '').trim().slice(0, 40) || username;
          const normalized: SurfaceIdentityPromotion = {
            source: identity.source,
            username,
            handle,
            ...(typeof identity.displayName === 'string' ? { displayName: identity.displayName } : {}),
            ...(identity.archetype ? { archetype: identity.archetype } : {}),
            ...(typeof identity.createdDay === 'number' ? { createdDay: identity.createdDay } : {}),
          };

          // Binding evidence comes only from canonical owners:
          // 1) a MyPlace page's generated/authored actor provenance;
          // 2) a handle the player has actually learned.
          // Request fields such as ids or aliases are never identity proof.
          let existing: BuddyCharacter | undefined;
          if (normalized.source === 'myplace') {
            const boundActorId = this.owners.myplace.getBoundActorIdForProfile(username);
            if (boundActorId) {
              existing = this.owners.social.getBuddy(boundActorId);
              if (!existing) {
                return {
                  success: false,
                  error: 'This MyPlace profile is no longer linked to a contact.',
                };
              }
            }
          }
          if (!existing) {
            existing = this.owners.social.findKnownActorByHandle(handle)
              ?? (username !== handle
                ? this.owners.social.findKnownActorByHandle(username)
                : undefined);
          }
          if (existing) {
            const wasKnown = this.owners.social.isKnown(existing.id);
            this.owners.social.learnHandle(existing.id, existing.handle);
            if (!wasKnown && this.owners.social.isKnown(existing.id)) {
              this.owners.telemetry.logEvent('social', 'surface_identity_bound', currentMinutes, {
                buddyId: existing.id,
                source: normalized.source,
              });
              this.publishState();
            }
            const result: SurfacePromotionResult = {
              actorId: existing.id,
              created: false,
              alreadyKnown: this.owners.social.isKnown(existing.id),
            };
            return { success: true, data: result };
          }

          const built = buildPromotedSurfaceCharacter(
            normalized,
            this.owners.clock.getTime().day,
          );
          const conflictingId = this.owners.social.getBuddy(built.definition.id);
          const conflictingHandle = conflictingId
            ?? this.owners.social.getBuddies().find(buddy =>
              buddy.handle.toLowerCase() === built.definition.handle.toLowerCase());
          if (conflictingHandle) {
            return {
              success: false,
              error: 'This surface identity conflicts with an existing contact.',
            };
          }
          const registered = this.admitBuddy(built.definition, undefined, true, currentMinutes);
          this.owners.telemetry.logEvent('social', 'surface_identity_promoted', currentMinutes, {
            buddyId: registered.id,
            source: normalized.source,
            reach: registered.reach ?? 'local',
          });
          this.publishState();
          const result: SurfacePromotionResult = {
            actorId: registered.id,
            created: true,
            alreadyKnown: true,
          };
          return { success: true, data: result };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      case 'SOCIAL_REMOVE_BUDDY': {
        try {
          const ok = this.owners.social.removeBuddy(action.buddyId);
          if (!ok) return { success: false, error: `Buddy not found: ${action.buddyId}` };
          this.owners.telemetry.logEvent('social', 'buddy_removed', currentMinutes, { buddyId: action.buddyId });
          this.publishState();
          return { success: true };
        } catch (err: unknown) {
          return { success: false, error: (err as Error).message };
        }
      }

      default:
        return null;
    }
  }
}
