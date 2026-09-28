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

export interface AwayPuppetCharacterSession {
  readonly puppet: AwayPuppetSemanticController;
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
    this.surface.update(deltaMs);
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
