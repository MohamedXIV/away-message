import { Story } from 'inkjs';
import type { Story as InkStory } from 'inkjs';
import { Compiler } from 'inkjs/compiler/Compiler';
import { SimpleJson } from 'inkjs/engine/SimpleJson';

export type InkJsonValue = boolean | number | string | null;

export interface InkChoice {
  index: number;
  text: string;
  tags: string[];
}

export interface InkContinuation {
  text: string;
  tags: string[];
  choices: InkChoice[];
  canContinue: boolean;
  hasError: boolean;
  errors: string[];
}

import type { InkRuntimeState as ContractInkRuntimeState } from '../contracts';
export type InkRuntimeState = ContractInkRuntimeState;

export type InkCompiledContent = string | Record<string, unknown>;

/**
 * Small, engine-independent wrapper around an inkjs Story.
 *
 * Owns ONLY local narrative-flow state (continuation point, Ink variables,
 * visit counts). It never touches canonical world/money/relationships/
 * knowledge/location. All of those must arrive via bound external functions
 * or be requested through typed effect requests handled by the host.
 */
export class InkRuntime {
  private readonly story: InkStory;

  constructor(compiled: InkCompiledContent) {
    const payload = typeof compiled === 'string' ? JSON.parse(compiled) : compiled;
    this.story = new Story(payload as any);
  }

  /** Compile authored Ink source into a runtime. Reproducible, offline. */
  static compile(source: string): InkRuntime {
    const compiler = new Compiler(source);
    const story = compiler.Compile();
    if (compiler.errors && compiler.errors.length > 0) {
      throw new Error(`Ink compilation failed:\n${compiler.errors.join('\n')}`);
    }
    const writer = new SimpleJson.Writer();
    (story as any).ToJson(writer);
    const jsonText = (writer as any).toString ? (writer as any).toString() : JSON.stringify(writer);
    return new InkRuntime(JSON.parse(jsonText));
  }

  /** For environments where require is unavailable (Vite/browser), use this. */
  static fromCompiledJson(json: InkCompiledContent): InkRuntime {
    return new InkRuntime(json);
  }

  get currentFlowName(): string {
    return this.story.currentFlowName;
  }

  get hasError(): boolean {
    return this.story.hasError;
  }

  continue(): InkContinuation {
    if (!this.story.canContinue) {
      const choices: InkChoice[] = (this.story.currentChoices ?? []).map((c: any, i: number) => ({ index: i, text: c.text ?? '', tags: c.tags ? [...c.tags] : [] }));
      return { text: '', tags: [], choices, canContinue: false, hasError: this.story.hasError, errors: this.story.currentErrors ? [...this.story.currentErrors] : [] };
    }
    const text = this.story.Continue() ?? '';
    const tags = this.story.currentTags ? [...this.story.currentTags] : [];
    const choices: InkChoice[] = (this.story.currentChoices ?? []).map((c: any, i: number) => ({
      index: i,
      text: c.text ?? '',
      tags: c.tags ? [...c.tags] : [],
    }));
    return {
      text,
      tags,
      choices,
      canContinue: this.story.canContinue,
      hasError: this.story.hasError,
      errors: this.story.currentErrors ? [...this.story.currentErrors] : [],
    };
  }

  continueMaximally(): InkContinuation {
    if (!this.story.canContinue) {
      const choices: InkChoice[] = (this.story.currentChoices ?? []).map((c: any, i: number) => ({ index: i, text: c.text ?? '', tags: c.tags ? [...c.tags] : [] }));
      return { text: this.story.currentText ?? '', tags: this.story.currentTags ? [...this.story.currentTags] : [], choices, canContinue: false, hasError: this.story.hasError, errors: this.story.currentErrors ? [...this.story.currentErrors] : [] };
    }
    const text = this.story.ContinueMaximally() ?? '';
    const tags = this.story.currentTags ? [...this.story.currentTags] : [];
    const choices: InkChoice[] = (this.story.currentChoices ?? []).map((c: any, i: number) => ({
      index: i,
      text: c.text ?? '',
      tags: c.tags ? [...c.tags] : [],
    }));
    return {
      text,
      tags,
      choices,
      canContinue: this.story.canContinue,
      hasError: this.story.hasError,
      errors: this.story.currentErrors ? [...this.story.currentErrors] : [],
    };
  }

  choose(choiceIndex: number): void {
    this.story.ChooseChoiceIndex(choiceIndex);
  }

  choosePath(path: string, ...args: unknown[]): void {
    this.story.ChoosePathString(path, true, args as any);
  }

  getVariable(name: string): unknown {
    try {
      return (this.story.variablesState as any).$(name);
    } catch {
      return undefined;
    }
  }

  setVariable(name: string, value: InkJsonValue): void {
    (this.story.variablesState as any).$(name, value as any);
  }

  bindExternalFunction(name: string, fn: (...args: any[]) => any, lookaheadSafe = false): void {
    this.story.BindExternalFunction(name, fn as any, lookaheadSafe);
  }

  unbindExternalFunction(name: string): void {
    this.story.UnbindExternalFunction(name);
  }

  observeVariable(name: string, observer: (variableName: string, newValue: unknown) => void): void {
    this.story.ObserveVariable(name, observer as any);
  }

  saveState(): InkRuntimeState {
    return { version: 1, storyStateJson: this.story.state.ToJson() };
  }

  loadState(state: InkRuntimeState | string): void {
    const json = typeof state === 'string' ? state : state.storyStateJson;
    if (typeof state !== 'string' && state.version !== 1) {
      throw new Error(`Unsupported InkRuntimeState version: ${(state as any).version}`);
    }
    this.story.state.LoadJson(json);
  }

  reset(): void {
    this.story.ResetState();
  }

  get globalTags(): string[] | null {
    return this.story.globalTags ? [...this.story.globalTags] : null;
  }

  get currentText(): string | null {
    return this.story.currentText;
  }

  get canContinue(): boolean {
    return this.story.canContinue;
  }

  get currentChoicesCount(): number {
    return this.story.currentChoices ? this.story.currentChoices.length : 0;
  }
}
