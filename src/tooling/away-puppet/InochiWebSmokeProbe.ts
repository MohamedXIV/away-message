export interface InochiWebParameter {
  readonly name: string;
  readonly lowerBounds: readonly number[];
  readonly upperBounds: readonly number[];
  value: number[];
}

export interface InochiWebNode {
  readonly name: string;
  readonly children: ReadonlyArray<InochiWebNode | null>;
}

export interface InochiWebPuppet {
  readonly name: string;
  readonly author: string;
  readonly parameters: readonly InochiWebParameter[];
  readonly root: InochiWebNode | null;
  update(deltaSeconds: number): void;
  draw(deltaSeconds: number): void;
  free(): void;
}

export interface InochiWebModule {
  readonly Puppet: new (bytes: ArrayBufferLike) => InochiWebPuppet;
}

export interface InochiWebParameterMutation {
  readonly parameter: string;
  readonly before: number[];
  readonly after: number[];
}

export interface InochiWebProbeResult {
  readonly name: string;
  readonly author: string;
  readonly parameterNames: string[];
  readonly nodeNames: string[];
  readonly mutations: InochiWebParameterMutation[];
}

function collectNodeNames(node: InochiWebNode | null, names: string[]): void {
  if (!node) return;
  names.push(node.name);
  for (const child of node.children) collectNodeNames(child, names);
}

function mutationTarget(parameter: InochiWebParameter): number[] {
  const current = [...parameter.value];
  return current.map((value, index) => {
    const upper = parameter.upperBounds[index];
    if (typeof upper === 'number' && Number.isFinite(upper)) return upper;
    const lower = parameter.lowerBounds[index];
    if (typeof lower === 'number' && Number.isFinite(lower) && lower !== value) return lower;
    return value;
  });
}

/**
 * Exercises only the stable, high-level surface exposed by upstream
 * `web/inochi2d-ts`: construct from bytes, inspect parameters/node tree,
 * mutate parameters, update/draw, then free deterministically.
 *
 * This does not claim host-renderer draw-list readiness. The upstream
 * draw-list bridge must be proven separately against the real WASM module.
 */
export function probeInochiWebPuppet(module: InochiWebModule, bytes: ArrayBufferLike): InochiWebProbeResult {
  const puppet = new module.Puppet(bytes);

  try {
    const parameters = [...puppet.parameters];
    if (parameters.length < 2) {
      throw new Error('Inochi Web/WASM smoke probe requires at least two parameters');
    }

    const nodeNames: string[] = [];
    collectNodeNames(puppet.root, nodeNames);

    const mutations = parameters.slice(0, 2).map((parameter): InochiWebParameterMutation => {
      const before = [...parameter.value];
      const after = mutationTarget(parameter);
      parameter.value = [...after];
      return { parameter: parameter.name, before, after };
    });

    puppet.update(0);
    puppet.draw(0);

    return {
      name: puppet.name,
      author: puppet.author,
      parameterNames: parameters.map((parameter) => parameter.name),
      nodeNames,
      mutations,
    };
  } finally {
    puppet.free();
  }
}
