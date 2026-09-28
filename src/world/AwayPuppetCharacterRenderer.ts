import type { SemanticPuppet } from '../tooling/away-puppet/SemanticPuppet';
import type {
  CharacterRenderer,
  CharacterRenderTransform,
  CharacterVisualState,
} from './characterRenderer';

export type AwayPuppetSemanticController = Pick<
  SemanticPuppet,
  | 'setMorph'
  | 'assignSlot'
  | 'setTint'
  | 'setExpression'
  | 'setPose'
  | 'setPartVisibility'
>;

export interface SemanticIdleMorph {
  readonly name: string;
  readonly center: number;
  readonly amplitude: number;
  readonly periodMs: number;
  readonly phase?: number;
}

export interface SemanticBlinkMotion {
  readonly morphName: string;
  readonly intervalMs: number;
  readonly durationMs: number;
  readonly closedValue: number;
  readonly openValue: number;
}

export interface AwayPuppetMotionProfile {
  readonly idleMorphs?: readonly SemanticIdleMorph[];
  readonly blink?: SemanticBlinkMotion;
}

export interface AwayPuppetCharacterSession {
  readonly puppet: AwayPuppetSemanticController;
  readonly motion?: AwayPuppetMotionProfile;
  dispose(): void;
}

export type AwayPuppetCharacterSessionLoader = (
  profileId: string,
) => AwayPuppetCharacterSession | Promise<AwayPuppetCharacterSession>;

export interface CharacterRenderSurface {
  setTransform(transform: Readonly<CharacterRenderTransform>): void;
  update(deltaMs: number): void;
  destroy(): void;
}

/**
 * Game-owned CharacterRenderer adapter over Away Puppet's semantic contract.
 *
 * The adapter deliberately knows semantic morph/slot/tint/expression names only.
 * Raw Inochi node ids, WASM pointers and Phaser objects remain behind the
 * Away-Puppet/session and render-surface boundaries.
 */
export class AwayPuppetCharacterRenderer implements CharacterRenderer {
  private session: AwayPuppetCharacterSession | null = null;
  private destroyed = false;
  private motionElapsedMs = 0;

  constructor(
    private readonly loadSession: AwayPuppetCharacterSessionLoader,
    private readonly surface: CharacterRenderSurface,
  ) {}

  async load(profileId: string): Promise<void> {
    this.assertAlive();
    const next = await this.loadSession(profileId);
    this.assertAlive();

    const previous = this.session;
    this.session = next;
    this.motionElapsedMs = 0;
    previous?.dispose();
  }

  apply(state: Readonly<CharacterVisualState>): void {
    this.assertAlive();
    this.requireSession();

    for (const [name, value] of Object.entries(state.morphs)) {
      this.setMorph(name, value);
    }
    for (const [slot, assetId] of Object.entries(state.parts)) {
      this.setPart(slot, assetId);
    }
    for (const [channel, color] of Object.entries(state.tints)) {
      this.setTint(channel, color);
    }
    if (state.expression) this.setExpression(state.expression);
    if (state.pose) this.setPose(state.pose);
    this.setTransform(state.transform);
  }

  setMorph(name: string, value: number): void {
    this.requireSession().puppet.setMorph(name, value);
  }

  setPart(slot: string, assetId: string): void {
    this.requireSession().puppet.assignSlot(slot, assetId);
  }

  setTint(channel: string, color: string): void {
    this.requireSession().puppet.setTint(channel, color);
  }

  setExpression(id: string): void {
    this.requireSession().puppet.setExpression(id);
  }

  setPose(id: string): void {
    this.requireSession().puppet.setPose(id);
  }

  setVisibility(partId: string, visible: boolean): void {
    this.requireSession().puppet.setPartVisibility(partId, visible);
  }

  setTransform(transform: Readonly<CharacterRenderTransform>): void {
    this.assertAlive();
    this.surface.setTransform(transform);
  }

  update(deltaMs: number): void {
    this.assertAlive();
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new Error('Character renderer delta must be a finite non-negative number');
    }
    this.motionElapsedMs += deltaMs;
    this.applyMotion(this.requireSession(), this.motionElapsedMs);
    this.surface.update(deltaMs);
  }

  private applyMotion(session: AwayPuppetCharacterSession, elapsedMs: number): void {
    for (const motion of session.motion?.idleMorphs ?? []) {
      if (!Number.isFinite(motion.periodMs) || motion.periodMs <= 0) continue;
      const phase = (elapsedMs / motion.periodMs) * Math.PI * 2 + (motion.phase ?? 0);
      const value = motion.center + Math.sin(phase) * Math.abs(motion.amplitude);
      session.puppet.setMorph(motion.name, value);
    }

    const blink = session.motion?.blink;
    if (!blink || blink.intervalMs <= 0 || blink.durationMs <= 0) return;

    const cycleMs = elapsedMs % blink.intervalMs;
    const halfBlink = blink.durationMs / 2;
    let value = blink.openValue;
    if (cycleMs < blink.durationMs) {
      const progress = cycleMs <= halfBlink
        ? cycleMs / halfBlink
        : (blink.durationMs - cycleMs) / halfBlink;
      value = blink.openValue + (blink.closedValue - blink.openValue) * progress;
    }
    session.puppet.setMorph(blink.morphName, value);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.session?.dispose();
    this.session = null;
    this.surface.destroy();
  }

  private requireSession(): AwayPuppetCharacterSession {
    this.assertAlive();
    if (!this.session) throw new Error('Character renderer has no loaded puppet profile');
    return this.session;
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error('Character renderer is destroyed');
  }
}
