import { describe, expect, it } from 'vitest';
import { SimulationKernel } from '../../src/engine/kernel/SimulationKernel';
import { createSimulationWorkerRuntime } from '../../src/simulation/host/SimulationWorkerRuntime';
import { projectActiveModifiers } from '../../src/engine/WorldModifiers';
import { projectLifeInfluences } from '../../src/engine/semantic/ActorSemantics';
import type {
  SimulationWorkerCommand, SimulationWorkerReply, SimulationWorkerRequest,
} from '../../src/simulation/host/SimulationHostProtocol';

/**
 * #177 EDUCATION-READINESS PROOF ONLY. No school product content is installed,
 * no teaching rules are added, and no parallel scheduler/knowledge store exists.
 * All records are written via the current canonical domain owners.
 */
function educationFixture() {
  const game = new SimulationKernel();
  const example = game.social.getBuddies()[0]!;
  const roles = [
    { role: 'student', reach: 'local' },
    { role: 'student', reach: 'local' },
    { role: 'online_friend', reach: 'remote' },
    { role: 'teacher', reach: 'local' },
  ] as const;
  const actors = roles.map(({ role, reach }, i) => {
    const id = `readiness_actor_${i + 1}`;
    game.social.registerBuddy({
      ...example, id, handle: id, displayName: `Fixture Actor ${i + 1}`,
      roles: [role], reach, status: 'friend', isProcedural: true,
    });
    game.social.learnHandle(id, id);
    return id;
  });
  const [studentOne, studentTwo, remoteFriend, teacher] = actors;
  const examId = 'readiness_exam';
  const factId = 'fact:readiness:exam';
  const claimId = 'claim:readiness:exam_rumor';
  const situationId = 'finals_week_fixture';

  // One class, one exam, and an overlapping shift use the EXISTING
  // appointment/work ownership and route-planning vocabulary.
  const appointment = (
    id: string, characterId: string, startMinute: number,
    endMinute: number, locationId: string, description: string,
    origin?: { kind: 'job'; id: string },
  ) => game.world.scheduleAppointment({
    id, characterId, locationId, targetDay: 1, startMinute, endMinute,
    description, ...(origin ? { origin } : {}),
  });
  appointment('readiness_class_one', studentOne!, 540, 600, 'school', 'Non-product class');
  appointment(examId, studentOne!, 630, 690, 'school', 'Non-product exam');
  appointment('readiness_class_two', studentTwo!, 540, 600, 'school', 'Non-product class');
  appointment('readiness_shift', studentTwo!, 620, 700, 'work', 'Non-product shift',
    { kind: 'job', id: 'readiness_shift_job' });
  appointment('readiness_teaching', teacher!, 540, 600, 'school', 'Non-product class');

  game.social.setAgenda(studentOne!, [
    { id: 'readiness_study', kind: 'errand', label: 'Study block',
      day: 1, startMinute: 510, endMinute: 535 },
  ]);
  game.social.setAgenda(studentTwo!, [
    { id: 'readiness_work', kind: 'work', label: 'Shift preparation',
      day: 1, startMinute: 600, endMinute: 615 },
  ]);
  expect(game.world.injectProceduralEvents([{
    id: situationId, title: 'Finals Week', category: 'system',
    description: 'Non-product situation with an upcoming assessment.',
    knowledgePrompt: 'Assessment week is approaching.',
    triggerDay: 1, triggerHour: 8,
  }])).toEqual([situationId]);
  expect(game.world.triggerEventById(situationId, game.clock.getTotalMinutes())).not.toBeNull();

  expect(game.world.establishSemanticFact({
    id: factId, subjectId: examId, predicate: 'is_cancelled', value: false,
    established: { kind: 'school_notice', sourceId: 'readiness_school_notice', atMinute: 480 },
  })).toBe(true);
  expect(game.world.publishSemanticClaim({
    id: claimId, factId, assertedValue: true,
    published: { kind: 'nightboard_post', sourceId: 'readiness_false_post', atMinute: 480 },
  })).toBe(true);

  // Actor-specific awareness: hearing a rumor does not transfer the
  // underlying fact, even though the claim references it.
  expect(game.world.learnSemanticReference(studentOne!, {
    kind: 'fact', refId: factId,
    learned: { kind: 'teacher', sourceId: teacher!, atMinute: 480 },
  })).toBe(true);
  expect(game.world.learnSemanticReference(teacher!, {
    kind: 'fact', refId: factId,
    learned: { kind: 'school_notice', sourceId: 'readiness_school_notice', atMinute: 480 },
  })).toBe(true);
  expect(game.world.learnSemanticReference(studentTwo!, {
    kind: 'claim', refId: claimId,
    learned: { kind: 'nightboard_post', sourceId: 'readiness_false_post', atMinute: 480 },
  })).toBe(true);
  expect(game.world.learnSemanticReference(remoteFriend!, {
    kind: 'claim', refId: claimId,
    learned: { kind: 'friend', sourceId: studentTwo!, atMinute: 480 },
  })).toBe(true);

  const memory = game.social.addCoreMemory(studentOne!, {
    text: 'Shared notes during a revision session.',
    kind: 'shared_moment', day: 1,
    meaning: {
      participants: [studentOne!, studentTwo!],
      subject: { kind: 'fact', id: factId },
      source: { kind: 'scenario', refId: 'readiness_revision_session' },
      salience: 'high', valence: 'positive',
    },
  });
  expect(memory?.meaning?.subject.id).toBe(factId);
  return {
    game, actors, studentOne: studentOne!, studentTwo: studentTwo!,
    remoteFriend: remoteFriend!, teacher: teacher!, examId, factId, claimId,
    situationId, memoryId: memory!.id,
  };
}

function assertReadiness(
  input: ReturnType<typeof educationFixture>,
  game: SimulationKernel,
) {
  const {
    studentOne, studentTwo, remoteFriend, teacher, examId,
    factId, claimId, situationId, memoryId,
  } = input;
  const obligations = game.getCharacterObligations(studentOne);
  expect(obligations.filter(o => o.sourceKind === 'appointment').map(o => o.sourceId))
    .toEqual(['readiness_class_one', examId]);
  expect(obligations.some(o => o.sourceKind === 'routine' && o.sourceId === 'readiness_study'))
    .toBe(true);
  expect(game.getCharacterObligations(studentTwo)
    .some(o => o.sourceKind === 'job' && o.sourceId === 'readiness_shift_job')).toBe(true);
  expect(game.getCharacterObligations(teacher).some(o => o.sourceId === 'readiness_teaching'))
    .toBe(true);
  expect(game.getCharacterObligations(remoteFriend)
    .some(o => o.sourceKind === 'appointment' || o.sourceKind === 'job')).toBe(false);

  const intent = game.getCharacterIntent(studentOne);
  expect(intent?.sourceKind).toBe('appointment');
  expect(intent?.sourceId).toBe('readiness_class_one');
  expect(intent?.targetPlaceId).toBe('school');
  expect(intent?.blockers).toEqual([]);
  expect(intent?.reasons).toContain('starts_soon');

  const distance = game.getActorSemanticView(remoteFriend, true)!;
  expect(distance.fidelity).toBe('remote_known');
  expect(distance.canMeetInPerson).toEqual({
    allowed: false, reasons: ['remote_reach'],
  });
  expect(game.getNpcTrip(remoteFriend)).toBeNull();
  expect(game.getActorSpatialProjection(remoteFriend)).toBeNull();

  const known = game.world.getActorSemanticKnowledge(studentOne);
  const hears = game.world.getActorSemanticKnowledge(studentTwo);
  expect(known.facts.map(f => f.id)).toContain(factId);
  expect(known.claims).toEqual([]);
  expect(hears.facts).toEqual([]);
  expect(hears.claims.map(c => c.id)).toContain(claimId);
  expect(game.world.getActorSemanticKnowledge(remoteFriend).facts).toEqual([]);
  expect(game.world.getActorSemanticKnowledge(teacher).facts[0]?.value).toBe(false);
  expect(game.world.getActorSemanticKnowledge('player')).toEqual({
    actorId: 'player', facts: [], claims: [],
  });
  expect(game.world.getState().semanticKnowledge?.facts[factId]?.value).toBe(false);

  const memories = game.social.getCoreMemories(studentOne);
  const session = memories.find(m => m.id === memoryId)!;
  expect(session.meaning).toEqual({
    participants: [studentOne, studentTwo],
    subject: { kind: 'fact', id: factId },
    source: { kind: 'scenario', refId: 'readiness_revision_session' },
    salience: 'high', valence: 'positive',
  });

  // "Finals Week"-style situation is canonical World event truth.
  // The influence is a PURE, test-only authored specification projected
  // from that source; it is NOT a new product mode or stored duplicate.
  const effects = projectActiveModifiers([{
    id: 'readiness_influence', eventId: situationId,
    domain: 'life', kind: 'festival_opportunity',
    durationMinutes: 180, targetIds: [studentOne, studentTwo], value: 65,
  }], game.world.getTriggeredEvents(), game.clock.getTotalMinutes(), {
    domain: 'life', targetId: studentOne,
  });
  expect(projectLifeInfluences(effects)).toEqual([{
    kind: 'festival_opportunity', value: 65,
    sourceEventId: situationId, validFromMinute: 480,
    validUntilMinute: 660,
  }]);
  expect(projectActiveModifiers([{
    id: 'readiness_influence', eventId: situationId,
    domain: 'life', kind: 'festival_opportunity',
    durationMinutes: 180, targetIds: [studentOne], value: 65,
  }], game.world.getTriggeredEvents(), 700, { domain: 'life' })).toEqual([]);
}

describe('#177 non-product Education readiness on canonical owners', () => {
  it('coordinates two students, remote contact, teacher, class/exam/work and epistemic provenance without new state', () => {
    const fixture = educationFixture();
    const original = fixture.game.exportSnapshot();
    assertReadiness(fixture, fixture.game);
    expect(fixture.game.exportSnapshot()).toEqual(original);
    const cold = new SimulationKernel(structuredClone(original));
    assertReadiness(fixture, cold);
    expect(cold.exportSnapshot()).toEqual(original);
  }, 90_000);

  it('round-trips the tiny authored obligations, rumor and shared-study memory through the real Worker FIFO', async () => {
    const fixture = educationFixture();
    const snapshot = fixture.game.exportSnapshot();
    const messages: SimulationWorkerReply[] = [];
    const runtime = createSimulationWorkerRuntime(value => messages.push(value));
    let seq = 0;
    const ask = async (command: SimulationWorkerCommand): Promise<unknown> => {
      const id = ++seq;
      await runtime.receive({ ...command, id } as SimulationWorkerRequest);
      const response = messages.find(m => m.type === 'result' && m.id === id);
      if (!response || response.type !== 'result') throw new Error('No Worker response');
      if (!response.ok) throw new Error(response.error.message);
      return response.value;
    };
    try {
      await ask({ op: 'init', initialState: structuredClone(snapshot) });
      const actual = await ask({ op: 'export' }) as ReturnType<SimulationKernel['exportSnapshot']>;
      const fromWorker = new SimulationKernel(actual);
      assertReadiness(fixture, fromWorker);
      expect(actual.world.semanticKnowledge).toEqual(snapshot.world.semanticKnowledge);
      expect(actual.social.coreMemories).toEqual(snapshot.social.coreMemories);
      expect(actual.world.appointments).toEqual(snapshot.world.appointments);
      expect(actual.social.agendas).toEqual(snapshot.social.agendas);
      const lab = await ask({ op: 'query', query: { kind: 'labPage', actorPage: 0, meetingPage: 0 } }) as {
        appointments: { total: number; page: unknown[] };
        roster: { total: number };
      };
      expect(lab.roster.total).toBeGreaterThanOrEqual(4);
      expect(lab.appointments.total).toBeGreaterThanOrEqual(5);
      expect(lab.appointments.page.length).toBeLessThanOrEqual(16);
    } finally {
      runtime.close();
    }
  }, 90_000);
});
