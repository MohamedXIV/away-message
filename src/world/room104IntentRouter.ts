import type { WorldInteractionIntent } from './phaser/types';

export type Room104Modal = 'window' | 'beverage' | 'door' | 'sleep';
export type Room104StorageTarget = 'desk' | 'wardrobe' | 'bedside' | 'kitchen';

export type Room104IntentRoute =
  | { kind: 'none' }
  | { kind: 'view'; targetViewId: string }
  | { kind: 'computer' }
  | { kind: 'modal'; modal: Room104Modal }
  | { kind: 'room-action'; activity: 'window' | 'shower'; modal?: Room104Modal }
  | { kind: 'inspect-storage'; storage: Room104StorageTarget }
  | { kind: 'inspect-delivery' };

/**
 * Pure presentation boundary for Room 104. Phaser emits semantic intents;
 * this function classifies them for the React integration layer. It owns no
 * simulation state and deliberately fails closed on unknown capabilities.
 */
export function routeRoom104Intent(intent: WorldInteractionIntent): Room104IntentRoute {
  if (intent.type === 'VIEW_TRANSITION') {
    return intent.targetViewId
      ? { kind: 'view', targetViewId: intent.targetViewId }
      : { kind: 'none' };
  }

  if (intent.type !== 'INTERACTION') return { kind: 'none' };

  switch (intent.capability) {
    case 'use_computer':
      return { kind: 'computer' };
    case 'observe_window':
      return { kind: 'room-action', activity: 'window', modal: 'window' };
    case 'prepare_drink':
      return { kind: 'modal', modal: 'beverage' };
    case 'sleep':
      return { kind: 'modal', modal: 'sleep' };
    case 'leave_room':
      return { kind: 'modal', modal: 'door' };
    case 'shower':
      return { kind: 'room-action', activity: 'shower' };
    case 'inspect_desk_storage':
      return { kind: 'inspect-storage', storage: 'desk' };
    case 'open_wardrobe':
      return { kind: 'inspect-storage', storage: 'wardrobe' };
    case 'inspect_bedside_storage':
      return { kind: 'inspect-storage', storage: 'bedside' };
    case 'open_kitchen_storage':
      return { kind: 'inspect-storage', storage: 'kitchen' };
    case 'inspect_delivery_anchor':
      return { kind: 'inspect-delivery' };
    default:
      return { kind: 'none' };
  }
}
