import type Phaser from 'phaser';
import {
  AwayPuppetCharacterRenderer,
  type AwayPuppetCharacterSession,
  type AwayPuppetCharacterSessionLoader,
  type AwayPuppetSemanticController,
} from '../AwayPuppetCharacterRenderer';
import type {
  CharacterMeshBatch,
  CharacterMeshFrame,
  CharacterVisualState,
} from '../characterRenderer';
import { PhaserCharacterSurface } from './PhaserCharacterSurface';
import type { WorldSceneCharacterMount } from './WorldSceneCharacters';

export const TECHNICAL_AWAY_PUPPET_PROFILE = 'profile.away-human-technical-v1';

type RigPartSlot =
  | 'hair.front'
  | 'face.eyes'
  | 'face.brows'
  | 'face.mouth'
  | 'wardrobe.top'
  | 'wardrobe.outer';

const SLOT_ASSETS: Readonly<Record<RigPartSlot, readonly string[]>> = {
  'hair.front': ['hair.short-layered', 'hair.medium-wave'],
  'face.eyes': ['eyes.round', 'eyes.narrow'],
  'face.brows': ['brows.soft', 'brows.straight'],
  'face.mouth': ['mouth.soft', 'mouth.full'],
  'wardrobe.top': ['top.crew-neck', 'top.knit'],
  'wardrobe.outer': ['outer.none', 'outer.light-jacket'],
};

const MORPH_BOUNDS: Readonly<Record<string, readonly [number, number]>> = {
  'body.mass': [-1, 1],
  'body.frame': [-1, 1],
  'face.roundness': [-1, 1],
  'idle.breath': [-1, 1],
  'face.blink': [0, 1],
  'secondary.hair': [-1, 1],
  'secondary.cloth': [-1, 1],
};

interface MutableRigState {
  morphs: Record<string, number>;
  parts: Record<RigPartSlot, string>;
  tints: Record<string, string>;
  visibility: Record<RigPartSlot, boolean>;
  expression: string;
  pose: string;
}

const WHITE_TEXTURE = {
  id: 'technical-white',
  width: 1,
  height: 1,
  rgba: new Uint8ClampedArray([255, 255, 255, 255]),
} as const;

function requireHex(color: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error(`Technical Away Puppet tint must be #RRGGBB: ${color}`);
  return color.toLowerCase();
}

function quad(
  id: string,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  tint: string,
  alpha = 1,
): CharacterMeshBatch {
  const left = centerX - width / 2;
  const right = centerX + width / 2;
  const top = centerY - height / 2;
  const bottom = centerY + height / 2;
  return {
    id,
    textureId: WHITE_TEXTURE.id,
    vertices: [
      left, top, 0, 0,
      right, top, 1, 0,
      right, bottom, 1, 1,
      left, bottom, 0, 1,
    ],
    triangles: [0, 1, 2, 0, 2, 3],
    tint,
    alpha,
  };
}

function buildTechnicalFrame(state: Readonly<MutableRigState>): CharacterMeshFrame {
  const mass = state.morphs['body.mass'] ?? 0;
  const frame = state.morphs['body.frame'] ?? 0;
  const roundness = state.morphs['face.roundness'] ?? 0;
  const breath = state.morphs['idle.breath'] ?? 0;
  const blink = state.morphs['face.blink'] ?? 0;
  const hairSway = state.morphs['secondary.hair'] ?? 0;
  const clothSway = state.morphs['secondary.cloth'] ?? 0;

  const skin = state.tints.skin ?? '#bd866d';
  const hair = state.tints.hair ?? '#2b211d';
  const iris = state.tints.iris ?? '#5d746c';
  const clothing = state.tints.clothing ?? '#596d7d';
  const outerwear = state.tints.outerwear ?? '#68705b';

  const torsoWidth = 92 + mass * 22 + frame * 14;
  const shoulderWidth = torsoWidth + frame * 18;
  const torsoHeight = 132 + breath * 5;
  const headWidth = 88 + roundness * 14;
  const hairAsset = state.parts['hair.front'];
  const mediumHair = hairAsset === 'hair.medium-wave';
  const hairWidth = headWidth + (mediumHair ? 30 : 18);
  const hairHeight = mediumHair ? 118 : 82;
  const hairY = mediumHair ? -245 : -263;
  const hairX = hairSway * (mediumHair ? 9 : 5);
  const eyeHeight = Math.max(1.4, 7 * (1 - blink));
  const narrowEyes = state.parts['face.eyes'] === 'eyes.narrow';
  const eyeWidth = narrowEyes ? 16 : 12;
  const browWidth = state.parts['face.brows'] === 'brows.straight' ? 22 : 17;
  const fullMouth = state.parts['face.mouth'] === 'mouth.full';
  const expressionSmile = state.expression === 'expression.soft-smile';
  const expressionSurprised = state.expression === 'expression.surprised';
  const mouthWidth = expressionSurprised ? 11 : (fullMouth ? 25 : 20) + (expressionSmile ? 7 : 0);
  const mouthHeight = expressionSurprised ? 13 : (expressionSmile ? 5 : 3);
  const topKnitted = state.parts['wardrobe.top'] === 'top.knit';
  const clothX = clothSway * 4;

  const batches: CharacterMeshBatch[] = [];

  if (state.visibility['hair.front']) {
    batches.push(quad('hair.back', hairX, hairY + 20, hairWidth, hairHeight, hair));
  }

  batches.push(
    quad('neck', 0, -176, 28 + mass * 3, 42, skin),
    quad('legs', 0, -52, 65 + mass * 8, 104, '#303743'),
  );

  if (state.visibility['wardrobe.top']) {
    batches.push(quad('wardrobe.top', clothX, -121, shoulderWidth, torsoHeight, clothing));
    if (topKnitted) {
      batches.push(quad('wardrobe.top.detail', clothX, -113, shoulderWidth * 0.75, 5, '#728392', 0.75));
    }
  }

  if (state.visibility['wardrobe.outer'] && state.parts['wardrobe.outer'] !== 'outer.none') {
    batches.push(
      quad('wardrobe.outer.left', -shoulderWidth * 0.27 + clothX, -119, shoulderWidth * 0.45, torsoHeight + 12, outerwear, 0.92),
      quad('wardrobe.outer.right', shoulderWidth * 0.27 + clothX, -119, shoulderWidth * 0.45, torsoHeight + 12, outerwear, 0.92),
    );
  }

  batches.push(
    quad('head', 0, -234, headWidth, 105 + roundness * 5, skin),
    quad('ear.left', -headWidth * 0.53, -233, 10, 24, skin),
    quad('ear.right', headWidth * 0.53, -233, 10, 24, skin),
  );

  if (state.visibility['face.eyes']) {
    batches.push(
      quad('eye.left.white', -21, -244, eyeWidth + 7, eyeHeight + 3, '#f1eee9'),
      quad('eye.right.white', 21, -244, eyeWidth + 7, eyeHeight + 3, '#f1eee9'),
      quad('eye.left.iris', -21, -244, 5, eyeHeight, iris),
      quad('eye.right.iris', 21, -244, 5, eyeHeight, iris),
    );
  }

  if (state.visibility['face.brows']) {
    batches.push(
      quad('brow.left', -21, -261, browWidth, 3, hair),
      quad('brow.right', 21, -261, browWidth, 3, hair),
    );
  }

  if (state.visibility['face.mouth']) {
    batches.push(quad('mouth', 0, -207, mouthWidth, mouthHeight, '#7b4142'));
  }

  if (state.visibility['hair.front']) {
    batches.push(
      quad('hair.front.top', hairX, -288, hairWidth * 0.94, mediumHair ? 38 : 31, hair),
      quad('hair.front.left', -headWidth * 0.48 + hairX, -252, mediumHair ? 24 : 16, mediumHair ? 88 : 55, hair),
      quad('hair.front.right', headWidth * 0.48 + hairX, -252, mediumHair ? 24 : 16, mediumHair ? 88 : 55, hair),
    );
  }

  return { textures: [WHITE_TEXTURE], batches };
}

class TechnicalAwayPuppetController implements AwayPuppetSemanticController {
  readonly state: MutableRigState = {
    morphs: {
      'body.mass': 0,
      'body.frame': 0,
      'face.roundness': 0,
      'idle.breath': 0,
      'face.blink': 0,
      'secondary.hair': 0,
      'secondary.cloth': 0,
    },
    parts: {
      'hair.front': 'hair.short-layered',
      'face.eyes': 'eyes.round',
      'face.brows': 'brows.soft',
      'face.mouth': 'mouth.soft',
      'wardrobe.top': 'top.crew-neck',
      'wardrobe.outer': 'outer.light-jacket',
    },
    tints: {
      skin: '#bd866d',
      hair: '#2b211d',
      iris: '#5d746c',
      clothing: '#596d7d',
      outerwear: '#68705b',
    },
    visibility: {
      'hair.front': true,
      'face.eyes': true,
      'face.brows': true,
      'face.mouth': true,
      'wardrobe.top': true,
      'wardrobe.outer': true,
    },
    expression: 'expression.neutral',
    pose: 'pose.relaxed',
  };

  setMorph(name: string, value: number): void {
    const bounds = MORPH_BOUNDS[name];
    if (!bounds) throw new Error(`Unknown technical Away Puppet morph: ${name}`);
    if (!Number.isFinite(value) || value < bounds[0] || value > bounds[1]) {
      throw new Error(`Technical Away Puppet morph ${name} is outside [${bounds[0]}, ${bounds[1]}]`);
    }
    this.state.morphs[name] = value;
  }

  assignSlot(slot: string, assetId: string): void {
    const assets = SLOT_ASSETS[slot as RigPartSlot];
    if (!assets) throw new Error(`Unknown technical Away Puppet slot: ${slot}`);
    if (!assets.includes(assetId)) throw new Error(`Unknown technical Away Puppet asset ${assetId} for ${slot}`);
    this.state.parts[slot as RigPartSlot] = assetId;
  }

  setTint(channel: string, color: string): void {
    if (!['skin', 'hair', 'iris', 'clothing', 'outerwear'].includes(channel)) {
      throw new Error(`Unknown technical Away Puppet tint: ${channel}`);
    }
    this.state.tints[channel] = requireHex(color);
  }

  setExpression(id: string): void {
    if (!['expression.neutral', 'expression.soft-smile', 'expression.surprised'].includes(id)) {
      throw new Error(`Unknown technical Away Puppet expression: ${id}`);
    }
    this.state.expression = id;
  }

  setPose(id: string): void {
    if (!['pose.relaxed', 'pose.attentive'].includes(id)) {
      throw new Error(`Unknown technical Away Puppet pose: ${id}`);
    }
    this.state.pose = id;
  }

  setPartVisibility(slot: string, visible: boolean): void {
    if (!(slot in SLOT_ASSETS)) throw new Error(`Unknown technical Away Puppet slot: ${slot}`);
    this.state.visibility[slot as RigPartSlot] = visible;
  }
}

export function createTechnicalAwayPuppetSession(): AwayPuppetCharacterSession {
  const controller = new TechnicalAwayPuppetController();
  return {
    puppet: controller,
    motion: {
      idleMorphs: [
        { name: 'idle.breath', center: 0, amplitude: 0.12, periodMs: 2400 },
        { name: 'secondary.hair', center: 0, amplitude: 0.45, periodMs: 1800, phase: 0.35 },
        { name: 'secondary.cloth', center: 0, amplitude: 0.24, periodMs: 2200, phase: 0.9 },
      ],
      blink: {
        morphName: 'face.blink',
        intervalMs: 3600,
        durationMs: 150,
        closedValue: 1,
        openValue: 0,
      },
    },
    renderFrame: () => buildTechnicalFrame(controller.state),
    dispose: () => undefined,
  };
}

export const createTechnicalAwayPuppetSessionLoader = (): AwayPuppetCharacterSessionLoader =>
  (profileId) => {
    if (profileId !== TECHNICAL_AWAY_PUPPET_PROFILE) {
      throw new Error(`Unknown technical Away Puppet profile: ${profileId}`);
    }
    return createTechnicalAwayPuppetSession();
  };

export function createTechnicalAwayPuppetVisualState(actorId: string): Omit<CharacterVisualState, 'transform'> {
  return {
    actorId,
    profileId: TECHNICAL_AWAY_PUPPET_PROFILE,
    morphs: {
      'body.mass': 0.15,
      'body.frame': -0.1,
      'face.roundness': 0.18,
    },
    parts: {
      'hair.front': 'hair.medium-wave',
      'face.eyes': 'eyes.round',
      'face.brows': 'brows.soft',
      'face.mouth': 'mouth.soft',
      'wardrobe.top': 'top.knit',
      'wardrobe.outer': 'outer.light-jacket',
    },
    tints: {
      skin: '#b98265',
      hair: '#30231f',
      iris: '#59746a',
      clothing: '#6b596f',
      outerwear: '#596354',
    },
    expression: 'expression.soft-smile',
    pose: 'pose.relaxed',
  };
}

/**
 * Creates one generic test actor through the exact same semantic
 * CharacterRenderer contract production characters use. It deliberately
 * contains no canonical-character id/name and exists only in technical-fixture
 * mode until an authored current-format INP2 + browser WASM bundle replaces it.
 */
export function createTechnicalAwayPuppetCharacterMount(
  anchorId: string,
  actorId = 'actor-away-puppet-technical',
  visualState: Omit<CharacterVisualState, 'transform'> = createTechnicalAwayPuppetVisualState(actorId),
): WorldSceneCharacterMount {
  const surface = new PhaserCharacterSurface();
  const renderer = new AwayPuppetCharacterRenderer(createTechnicalAwayPuppetSessionLoader(), surface);
  // Technical loader is synchronous; AwayPuppetCharacterRenderer installs it
  // before returning the resolved Promise.
  void renderer.load(TECHNICAL_AWAY_PUPPET_PROFILE);

  return {
    actorId,
    anchorId,
    renderer,
    visualState,
    scale: 1.15,
    depth: 31,
    attach: (scene: Phaser.Scene, parent: Phaser.GameObjects.Container) => surface.attach(scene, parent),
  };
}


/**
 * Three actors reuse one generic rig/profile while varying only semantic
 * morphology, slots and tints. This is the representative small-group fixture
 * used for browser/performance evidence in #25.
 */
export function createTechnicalAwayPuppetCharacterGroup(): WorldSceneCharacterMount[] {
  const firstId = 'actor-away-puppet-technical-a';
  const secondId = 'actor-away-puppet-technical-b';
  const thirdId = 'actor-away-puppet-technical-c';

  const first = createTechnicalAwayPuppetVisualState(firstId);
  const secondBase = createTechnicalAwayPuppetVisualState(secondId);
  const thirdBase = createTechnicalAwayPuppetVisualState(thirdId);

  const customer = createTechnicalAwayPuppetCharacterMount(
    'fixture_cafe_customer_anchor',
    firstId,
    first,
  );

  return [
    { ...customer, scale: 0.9 },
    createTechnicalAwayPuppetCharacterMount('fixture_cafe_staff_anchor', secondId, {
      ...secondBase,
      morphs: {
        'body.mass': -0.35,
        'body.frame': 0.45,
        'face.roundness': -0.2,
      },
      parts: {
        ...secondBase.parts,
        'hair.front': 'hair.short-layered',
        'face.eyes': 'eyes.narrow',
        'face.brows': 'brows.straight',
        'wardrobe.top': 'top.crew-neck',
        'wardrobe.outer': 'outer.none',
      },
      tints: {
        skin: '#8f624d',
        hair: '#161311',
        iris: '#3d5f75',
        clothing: '#526374',
        outerwear: '#526374',
      },
      expression: 'expression.neutral',
    }),
    createTechnicalAwayPuppetCharacterMount('anchor_a1', thirdId, {
      ...thirdBase,
      morphs: {
        'body.mass': 0.55,
        'body.frame': -0.4,
        'face.roundness': 0.5,
      },
      parts: {
        ...thirdBase.parts,
        'hair.front': 'hair.medium-wave',
        'face.mouth': 'mouth.full',
        'wardrobe.top': 'top.crew-neck',
        'wardrobe.outer': 'outer.light-jacket',
      },
      tints: {
        skin: '#d2a082',
        hair: '#7a5036',
        iris: '#6a7047',
        clothing: '#7b5c52',
        outerwear: '#3f4c46',
      },
      expression: 'expression.surprised',
    }),
  ];
}
