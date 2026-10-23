import { useEffect, useState } from 'react';
import { MailboxView } from '../../apps/mailbox/MailboxView';
import type { SimulationMailboxRead } from '../../engine/kernel/SimulationPublication';
import type { WorkerGameSession } from './WorkerGameSession';

/** Original authored mailbox, read from the Worker-owned bounded projection. */
export function WorkerMailboxPanel({ session, revision }: {
  session: WorkerGameSession;
  revision: number;
}) {
  const [mail, setMail] = useState<SimulationMailboxRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void session.read({ kind: 'mailbox' })
      .then(read => {
        if (!active || read.revision !== revision) return;
        setMail(read);
        setError(null);
      }).catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => { active = false; };
  }, [session, revision]);

  if (error) return <p role="alert" className="p-3 text-red-800">{error}</p>;
  if (!mail) return <p role="status" className="p-3 text-xs">Loading mailbox from Worker…</p>;
  return <MailboxView mailbox={mail} />;
}
