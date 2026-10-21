import { useEffect, useState } from 'react';
import type { SimulationLabPageRead } from '../../engine/kernel/SimulationPublication';
import type { WorkerGameSession } from './WorkerGameSession';
import type { LabProceduralCategory, LabProceduralResult } from './SimulationHostProtocol';

const control = 'rounded border border-[#808080] bg-[#ece9d8] px-2 py-1 disabled:opacity-40';

/** Opt-in developer Lab diagnostic, never a local SimulationEngine. */
export function WorkerLabInspectorPanel({ session, revision }: {
  session: WorkerGameSession;
  revision: number;
}) {
  const [actorPage, setActorPage] = useState(0);
  const [meetingPage, setMeetingPage] = useState(0);
  const [read, setRead] = useState<SimulationLabPageRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState('oakhaven-lab');
  const [count, setCount] = useState(2);
  const [category, setCategory] = useState<LabProceduralCategory>('mixed');
  const [preview, setPreview] = useState<LabProceduralResult | null>(null);
  const [labBusy, setLabBusy] = useState(false);
  const [labNotice, setLabNotice] = useState<string | null>(null);
  const previewCurrent = preview !== null && preview.revision === revision;

  const generate = async (mode: 'preview' | 'inject'): Promise<void> => {
    if (labBusy || (mode === 'inject' && !previewCurrent)) return;
    setLabBusy(true);
    setLabNotice(null);
    try {
      const result = await session.labProcedural({
        mode, seed, count, category,
        ...(mode === 'inject' ? { expectedRevision: preview!.revision } : {}),
      });
      if (mode === 'preview') {
        setPreview(result);
        setLabNotice('Offline template preview ready. Confirm to inject into the canonical Worker world.');
      } else {
        setPreview(null);
        setLabNotice('Injected ' + result.injectedIds.length + ' canonical world events. Pending queue updated.');
      }
    } catch (cause) {
      setLabNotice(cause instanceof Error ? cause.message : String(cause));
      if (mode === 'inject') setPreview(null);
    } finally {
      setLabBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    void session.read({ kind: 'labPage', actorPage, meetingPage })
      .then(next => {
        if (!alive || next.revision !== revision) return;
        setRead(next);
        setError(null);
      })
      .catch(cause => { if (alive) setError(String(cause)); });
    return () => { alive = false; };
  }, [session, revision, actorPage, meetingPage]);

  return <section data-testid="worker-lab-inspector"
    className="flex h-full min-h-0 flex-col bg-[#ece9d8] text-black text-xs">
    <header className="shrink-0 border-b border-gray-500 bg-[#dfdfdf] p-3">
      <h2 className="font-bold text-sm">AI Lab · Worker Diagnostic Inspector</h2>
      <p className="mt-1 text-[11px] text-gray-700">
        Owner diagnostics and offline template event generation. AI-provider generation,
        OS/character generation and provider benchmarks are not yet migrated.
      </p>
    </header>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {error && <p role="alert">{error}</p>}
      {!read && !error && <p role="status">Reading bounded Lab diagnostics…</p>}
      {read && <>
        <section data-testid="worker-lab-procedural" className="rounded border border-gray-400 bg-white p-2">
          <h3 className="font-bold">Procedural World Events · Offline templates</h3>
          <p className="mt-1 text-gray-600">Preview is read-only. Injection requires the unchanged Worker revision;
            any intervening world update requires a fresh preview. No API keys are sent.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label>Seed <input aria-label="Procedural seed" className="rounded border px-1 py-1"
              maxLength={64} value={seed} onChange={e => { setSeed(e.target.value); setPreview(null); }} /></label>
            <label>Events <select aria-label="Procedural event count" className={control} value={count}
              onChange={e => { setCount(Number(e.target.value)); setPreview(null); }}>
              <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
            </select></label>
            <label>Category <select aria-label="Procedural category" className={control}
              value={category} onChange={e => { setCategory(e.target.value as LabProceduralCategory); setPreview(null); }}>
              {(['mixed', 'city_news', 'site_launch', 'economy', 'culture', 'system', 'os_release'] as const)
                .map(c => <option key={c} value={c}>{c}</option>)}
            </select></label>
          </div>
          <div className="mt-2 flex gap-2">
            <button className={control} disabled={labBusy || !seed.trim()}
              onClick={() => { void generate('preview'); }}>Preview events</button>
            <button className={control} disabled={labBusy || !previewCurrent}
              onClick={() => { void generate('inject'); }}>Inject preview</button>
          </div>
          {preview && <>
            {!previewCurrent && <p role="status">World changed — preview again before injecting.</p>}
            <div data-testid="worker-lab-preview">
              {preview.events.map(event => <article data-testid="worker-lab-preview-event"
                key={event.id} className="mt-2 border-t border-gray-200 pt-2">
                <strong>{event.title}</strong> · {event.category} · Day {event.triggerDay}
                <p>{event.description}</p>
                <p className="text-gray-600">NPC knowledge: {event.knowledgePrompt}</p>
              </article>)}
            </div>
          </>}
          {labNotice && <p data-testid="worker-lab-generation-result" role="status" className="mt-2">{labNotice}</p>}
        </section>
        <section data-testid="worker-lab-summary" className="rounded border border-gray-400 bg-white p-2">
          Day {read.day} · OS {read.currentOsId ?? 'none'} ·
          Actors {read.roster.total} ({read.roster.procedural} procedural) ·
          World events: {read.eventCounts.pending} pending,
          {read.eventCounts.triggered} triggered, {read.eventCounts.pendingOs} OS pending
        </section>
        <section data-testid="worker-lab-body" className="rounded border border-gray-400 bg-white p-2">
          <h3 className="font-bold">Body and rent</h3>
          <p>Energy {read.body.energy}/{read.body.maxEnergy} ·
            Hunger {read.body.hunger} · Health {read.body.health} ·
            Sleep debt {read.body.sleepDebt}</p>
          <p>Cash USD {read.body.cash} · Rent USD {read.body.rentAmount} due Day {read.body.rentDueDay} ·
            {read.body.rentOverdue ? 'overdue' : read.body.rentPaid ? 'paid' : 'outstanding'}</p>
        </section>
        <section data-testid="worker-lab-actors" className="rounded border border-gray-400 bg-white p-2">
          <h3 className="font-bold">Relationship Lab · 16 actors/page</h3>
          {read.actors.map(actor => <div key={actor.id} data-testid="worker-lab-actor"
            className="mt-2 border-b border-gray-200 pb-2">
            <strong>{actor.displayName}</strong> @{actor.handle} · {actor.stage} /
            {actor.dailyMood} / {actor.status ?? 'unknown'}
            {actor.relationship && <p>
              Familiarity {actor.relationship.familiarity} · Trust {actor.relationship.trust} ·
              Comfort {actor.relationship.comfort} · Respect {actor.relationship.respect} ·
              Annoyance {actor.relationship.annoyance}
            </p>}
            <p>Memories {actor.memoryCount} · Open promises {actor.promiseCount}</p>
            {actor.recentMemories.map(memory => <p key={memory.id} className="text-gray-600">
              [{memory.kind} day {memory.day}] {memory.text}
            </p>)}
          </div>)}
          {read.actors.length === 0 && <p>No actors on this page.</p>}
          <div className="mt-2 flex items-center gap-2">
            <button className={control} disabled={actorPage === 0}
              onClick={() => setActorPage(p => p - 1)}>Previous actors</button>
            <span>Page {actorPage + 1} / {Math.max(1, Math.ceil(read.roster.total / 16))}</span>
            <button className={control} disabled={(actorPage + 1) * 16 >= read.roster.total}
              onClick={() => setActorPage(p => p + 1)}>Next actors</button>
          </div>
        </section>
        <section data-testid="worker-lab-meetings" className="rounded border border-gray-400 bg-white p-2">
          <h3 className="font-bold">Meeting Board · 16 appointments/page</h3>
          <p>{read.appointments.todayCount} today / {read.appointments.total} total</p>
          {read.appointments.page.map(appt => <p key={appt.id}
            data-testid="worker-lab-appointment" className="border-b border-gray-200 p-1">
            {appt.characterId} @ {appt.locationId} · Day {appt.targetDay} ·
            {appt.status ?? 'scheduled'} · RSVP {appt.rsvp ?? 'unknown'}
          </p>)}
          {read.appointments.page.length === 0 && <p>No appointments on this page.</p>}
          <div className="mt-2 flex items-center gap-2">
            <button className={control} disabled={meetingPage === 0}
              onClick={() => setMeetingPage(p => p - 1)}>Previous meetings</button>
            <span>Page {meetingPage + 1} / {Math.max(1, Math.ceil(read.appointments.total / 16))}</span>
            <button className={control} disabled={(meetingPage + 1) * 16 >= read.appointments.total}
              onClick={() => setMeetingPage(p => p + 1)}>Next meetings</button>
          </div>
        </section>
      </>}
    </div>
  </section>;
}
