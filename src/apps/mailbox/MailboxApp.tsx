import React, { useState } from 'react';
import { soundManager } from '../../audio/SoundManager';
import { useSimulationStore } from '../../store/useSimulationStore';
import { buildNpcMailForDay, buildRentMailHistory, gameDayToMailDate, type NpcMail } from '../../engine/BoardDirector';
import { buddyWithRole } from '../../engine/coreBuddies';
import { locationLabel } from '../../engine/AppointmentDirector';

interface EmailMessage {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  date: string;
  body: string;
  isRead: boolean;
  folder: 'inbox' | 'sent' | 'drafts' | 'trash';
  attachment?: {
    name: string;
    sizeBytes: number;
  };
}

const INITIAL_EMAILS: EmailMessage[] = [
  {
    id: 'em_1',
    sender: 'Mr. Henderson (Front Desk)',
    senderEmail: 'desk@starlitemotel.local',
    subject: 'Room 104 Check-In Notice & Rent Schedule',
    date: 'Aug 22, 2006 08:30 AM',
    folder: 'inbox',
    isRead: false,
    body: `Welcome to Starlite Motel, Room 104.\n\nYour weekly rent of $140.00 is due every Sunday by 11:59 PM. Please make payment via TechMart cash deposit or directly at the front desk.\n\nNote: The DSL wall port is active on connection line 2. Do not tamper with the telephone junction box outside your door.\n\n- Front Desk Management`,
  },
  {
    id: 'em_2',
    sender: 'Maya Lin',
    senderEmail: 'maya@myplace.local',
    subject: 'diner shift / rain photos',
    date: 'Aug 22, 2006 10:15 AM',
    folder: 'inbox',
    isRead: false,
    body: `hey! hope you got settled into Room 104.\n\ni uploaded the 35mm photos of the motel neon sign to myplace.local/maya_x if you wanna see them. Also if you smell fried onion rings drifting across the parking lot later tonight, come over to 4th Street Diner and i will save you a seat!\n\n- maya`,
    attachment: {
      name: 'motel_neon_35mm.jpg',
      sizeBytes: 840000,
    },
  },
  {
    id: 'em_3',
    sender: 'TechMart Online',
    senderEmail: 'orders@techmart.local',
    subject: 'Order #TM-89412 Confirmation',
    date: 'Aug 21, 2006 16:45 PM',
    folder: 'inbox',
    isRead: true,
    body: `Thank you for shopping at TechMart!\n\nYour order TM-89412 has been processed and is scheduled for courier delivery to Starlite Motel Room 104.\n\nItems:\n- 1x 256MB High-Speed SDRAM Module ($45.00)\n- 1x FlashFetch Download Accelerator License ($0.00)\n\nThank you for choosing TechMart!`,
  },
  {
    id: 'em_4',
    sender: 'NightBoard Digest',
    senderEmail: 'mailer@nightboard.local',
    subject: '[NightBoard] Thread #104 New Replies',
    date: 'Aug 22, 2006 03:12 AM',
    folder: 'inbox',
    isRead: true,
    body: `3 new anonymous replies in Thread #104: "Sub-Canal Infrastructure Hum and Electrical Anomalies".\n\nVisit nightboard.local/thread/104 to view the thread.`,
  },
];

export const MailboxApp: React.FC = () => {
  const [emails, setEmails] = useState<EmailMessage[]>(INITIAL_EMAILS);
  // P5.6 NPC mail chains: deterministic per day from live sharp/appointment history
  // (farewell/welcome on transition days, thanks/apology the morning after meetings).
  const engine = useSimulationStore((s) => s.engine);
  const today = useSimulationStore((s) => s.state.time.day);
  const npcMails: NpcMail[] = (() => {
    try {
      const buddies = engine.social.getBuddies().map((b) => ({
        id: b.id,
        displayName: b.displayName,
        handle: b.handle,
        archetype: b.archetype,
        stage: engine.social.getRelationshipStage(b.id),
        status: b.status,
      }));
      const sharps = engine.social.getBuddies().map((b) => {
        const state = engine.world.getFlag(`sharp_${b.id}`);
        const stateDay = engine.world.getFlag(`sharp_${b.id}_day`);
        return {
          buddyId: b.id,
          state: typeof state === 'string' ? state : '',
          stateDay: typeof stateDay === 'number' ? stateDay : 0,
        };
      });
      const meetings = engine.world.getAppointments().map((a) => ({
        buddyId: a.characterId,
        targetDay: a.targetDay,
        status: a.status,
        npcShowed: a.npcShowed,
        playerShowed: a.playerShowed,
        locationLabel: locationLabel(a.locationId),
      }));
      const collected: NpcMail[] = [];
      for (let d = 1; d <= Math.max(1, today); d++) {
        collected.push(...buildNpcMailForDay({ day: d, buddies, sharps, meetings }));
      }
      const trimmed = collected.slice(-10);
      // P6.4 rent paper trail (survives payment — reconstructed from flags; never trimmed away)
      try {
        const landlord = buddyWithRole('landlord');
        const landlordId = landlord ? engine.social.getBuddy(landlord.id)?.id : undefined;
        for (const rent of buildRentMailHistory(engine.world.getFlags(), landlordId)) {
          if (!trimmed.some((m) => m.key === rent.key)) trimmed.push(rent);
        }
      } catch { /* rent mail is best-effort */ }
      return trimmed.slice(-12);
    } catch { return []; }
  })();
  const toEmail = (m: NpcMail): EmailMessage => ({
    id: m.key,
    sender: m.sender,
    senderEmail: m.senderEmail,
    subject: m.subject,
    date: gameDayToMailDate(m.day),
    body: m.body,
    folder: 'inbox',
    isRead: readNpcIds.has(m.key),
  });
  const allEmails = [...npcMails.map(toEmail).reverse(), ...emails];
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'drafts' | 'trash'>('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<string>('em_1');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  // NPC mail is derived (deterministic per day), so read flags live separately
  const [readNpcIds, setReadNpcIds] = useState<Set<string>>(new Set());

  const currentFolderEmails = allEmails.filter((e) => e.folder === activeFolder);
  const selectedEmail = allEmails.find((e) => e.id === selectedEmailId) || currentFolderEmails[0];

  const handleSelectEmail = (email: EmailMessage) => {
    setSelectedEmailId(email.id);
    // Derived mail (NPC chains + rent notices) tracks reads separately from local state
    if (!emails.some((e) => e.id === email.id)) {
      setReadNpcIds((prev) => {
        if (prev.has(email.id)) return prev;
        const next = new Set(prev);
        next.add(email.id);
        return next;
      });
      return;
    }
    if (!email.isRead) {
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, isRead: true } : e))
      );
    }
  };

  const handleSendCompose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim()) return;

    const newEmail: EmailMessage = {
      id: `em_${Date.now()}`,
      sender: 'wanderer06',
      senderEmail: 'wanderer06@mailbox.local',
      subject: composeSubject.trim(),
      date: new Date().toLocaleString(),
      body: composeBody.trim(),
      folder: 'sent',
      isRead: true,
    };

    setEmails((prev) => [newEmail, ...prev]);
    setIsComposeOpen(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    soundManager.play('im_send');
  };

  const handleDeleteSelected = () => {
    if (!selectedEmail) return;
    setEmails((prev) =>
      prev.map((e) => (e.id === selectedEmail.id ? { ...e, folder: 'trash' } : e))
    );
  };

  const unreadInboxCount = allEmails.filter((e) => e.folder === 'inbox' && !e.isRead).length;

  return (
    <div className="w-full h-full bg-[#ece9d8] text-black font-sans text-xs select-none flex flex-col border border-gray-400 overflow-hidden">
      {/* Top Menu Bar */}
      <div className="flex gap-3 px-2 py-0.5 bg-[#dfdfdf] border-b border-gray-400 text-xs">
        <span className="hover:underline cursor-pointer">File</span>
        <span className="hover:underline cursor-pointer">Edit</span>
        <span className="hover:underline cursor-pointer">View</span>
        <span className="hover:underline cursor-pointer">Message</span>
        <span className="hover:underline cursor-pointer">Tools</span>
        <span className="hover:underline cursor-pointer">Help</span>
      </div>

      {/* Main Toolbar */}
      <div className="bg-[#f0f0f0] border-b border-gray-300 p-1.5 flex items-center gap-1.5">
        <button
          onClick={() => setIsComposeOpen(true)}
          className="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-400 rounded text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer text-blue-900"
        >
          ✉️ New Message
        </button>
        <button
          onClick={handleDeleteSelected}
          disabled={!selectedEmail}
          className="px-2.5 py-1 bg-white hover:bg-gray-100 disabled:opacity-50 border border-gray-400 rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer text-red-700"
        >
          🗑️ Delete
        </button>
        <button
          onClick={() => soundManager.play('im_recv')}
          className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-400 rounded text-xs flex items-center gap-1 shadow-xs cursor-pointer"
        >
          🔄 Send / Receive
        </button>
      </div>

      {/* Main Layout: Left Folder Tree, Right Message List & Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Folders Pane */}
        <div className="w-40 bg-[#f7f7f7] border-r border-gray-400 p-2 flex flex-col gap-1 overflow-y-auto">
          <span className="font-bold text-[10px] text-gray-500 uppercase tracking-wide mb-1">
            Local Folders
          </span>
          <button
            onClick={() => setActiveFolder('inbox')}
            className={`w-full text-left px-2 py-1 rounded text-xs flex justify-between items-center ${
              activeFolder === 'inbox' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-200 text-gray-800'
            }`}
          >
            <span>📥 Inbox</span>
            {unreadInboxCount > 0 && (
              <span className="bg-red-600 text-white text-[9px] font-bold px-1 py-0.2 rounded-full">
                {unreadInboxCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveFolder('sent')}
            className={`w-full text-left px-2 py-1 rounded text-xs ${
              activeFolder === 'sent' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-200 text-gray-800'
            }`}
          >
            📤 Sent Items
          </button>
          <button
            onClick={() => setActiveFolder('drafts')}
            className={`w-full text-left px-2 py-1 rounded text-xs ${
              activeFolder === 'drafts' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-200 text-gray-800'
            }`}
          >
            📝 Drafts
          </button>
          <button
            onClick={() => setActiveFolder('trash')}
            className={`w-full text-left px-2 py-1 rounded text-xs ${
              activeFolder === 'trash' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-gray-200 text-gray-800'
            }`}
          >
            🗑️ Trash
          </button>
        </div>

        {/* Right: Message List (Top) & Email Preview (Bottom) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* P6 parcels: pending courier orders with ETA + recent arrivals */}
          {(() => {
            let orders: Array<{ id: string; items: Array<{ sku: string; qty: number }>; fulfillment: string; readyMinute: number; status: string }> = [];
            try { orders = (engine.delivery.getState().orders as typeof orders) ?? []; } catch { orders = []; }
            if (orders.length === 0) return null;
            const fmtEta = (minute: number): string => {
              const day = Math.floor(minute / 1440) + 1;
              const hh = String(Math.floor((minute % 1440) / 60)).padStart(2, '0');
              const mm = String(minute % 60).padStart(2, '0');
              return `Day ${day}, ${hh}:${mm}`;
            };
            const pending = orders.filter((o) => o.status === 'transit');
            const done = orders.filter((o) => o.status === 'done').slice(-3).reverse();
            return (
              <div className="border-b border-gray-400 bg-amber-50 px-2 py-1.5 text-[11px] space-y-0.5 max-h-20 overflow-y-auto">
                <div className="font-bold text-amber-900">📦 CornerMart parcels</div>
                {pending.map((o) => (
                  <div key={o.id} className="text-gray-700">🚚 {o.items.map((i) => `${i.sku}×${i.qty}`).join(', ')} — arriving {fmtEta(o.readyMinute)}</div>
                ))}
                {done.map((o) => (
                  <div key={o.id} className="text-green-800">✓ {o.items.map((i) => `${i.sku}×${i.qty}`).join(', ')} — {o.fulfillment === 'pickup' ? 'picked up' : 'delivered to pantry'}</div>
                ))}
              </div>
            );
          })()}
          {/* Messages Table */}
          <div className="h-44 border-b border-gray-400 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="bg-[#e4e4e4] border-b border-gray-300 font-bold text-gray-700 sticky top-0">
                <tr>
                  <th className="p-1.5 w-6 text-center">!</th>
                  <th className="p-1.5 border-r border-gray-300">From</th>
                  <th className="p-1.5 border-r border-gray-300">Subject</th>
                  <th className="p-1.5">Received</th>
                </tr>
              </thead>
              <tbody>
                {currentFolderEmails.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-400 italic">
                      Folder is empty.
                    </td>
                  </tr>
                ) : (
                  currentFolderEmails.map((em) => {
                    const isSelected = em.id === selectedEmail?.id;
                    return (
                      <tr
                        key={em.id}
                        onClick={() => handleSelectEmail(em)}
                        className={`border-b border-gray-100 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-100 font-semibold text-blue-950'
                            : !em.isRead
                            ? 'bg-yellow-50 font-bold'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <td className="p-1.5 text-center text-xs">
                          {!em.isRead ? '✉️' : '📭'}
                        </td>
                        <td className="p-1.5 truncate max-w-[140px]">{em.sender}</td>
                        <td className="p-1.5 truncate max-w-[220px] flex items-center gap-1">
                          {em.attachment && <span>📎</span>}
                          <span>{em.subject}</span>
                        </td>
                        <td className="p-1.5 text-[11px] text-gray-500">{em.date}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Email Body Preview Pane */}
          {selectedEmail ? (
            <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2 bg-white select-text">
              <div className="bg-[#f7f9fa] border border-gray-300 rounded p-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-gray-900 text-sm">{selectedEmail.subject}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{selectedEmail.date}</span>
                </div>
                <div className="text-[11px] text-gray-600">
                  <strong>From:</strong> {selectedEmail.sender} &lt;{selectedEmail.senderEmail}&gt;
                </div>
                {selectedEmail.attachment && (
                  <div className="pt-1 border-t border-gray-200 flex items-center gap-2 text-[11px] text-blue-800">
                    <span>📎 Attachment: <strong>{selectedEmail.attachment.name}</strong> ({(selectedEmail.attachment.sizeBytes / 1024).toFixed(0)} KB)</span>
                    <button
                      onClick={() => alert(`Downloaded ${selectedEmail.attachment?.name} to C:/Downloads/`)}
                      className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded text-[10px] font-bold"
                    >
                      Save Attachment
                    </button>
                  </div>
                )}
              </div>

              <div className="p-2 whitespace-pre-wrap font-sans text-xs text-gray-800 leading-relaxed">
                {selectedEmail.body}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 italic text-xs">
              Select an email from the list above to view.
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSendCompose}
            className="bg-[#ece9d8] border-2 border-gray-500 rounded shadow-2xl p-3 w-full max-w-lg text-black font-sans text-xs flex flex-col gap-2.5"
          >
            <div className="flex justify-between items-center bg-blue-900 text-white px-2 py-1 rounded font-bold text-xs">
              <span>New Message</span>
              <button type="button" onClick={() => setIsComposeOpen(false)} className="hover:bg-red-600 px-1.5 rounded">
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-12 font-bold text-gray-700">To:</label>
              <input
                type="text"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@domain.local"
                className="flex-1 px-2 py-1 bg-white border border-gray-400 rounded text-xs outline-none"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-12 font-bold text-gray-700">Subject:</label>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject line"
                className="flex-1 px-2 py-1 bg-white border border-gray-400 rounded text-xs outline-none"
                required
              />
            </div>

            <div>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={8}
                placeholder="Type your message here..."
                className="w-full p-2 bg-white border border-gray-400 rounded text-xs outline-none resize-none font-sans"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-gray-300">
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 border border-gray-400 rounded text-xs"
              >
                Discard
              </button>
              <button
                type="submit"
                className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow text-xs cursor-pointer"
              >
                Send Message
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Footer Status Bar */}
      <div className="bg-[#dfdfdf] border-t border-gray-400 px-2 py-1 flex justify-between items-center text-[10px] text-gray-600">
        <span>{allEmails.length} total messages ({unreadInboxCount} unread)</span>
        <span>Connected to POP3/SMTP mail.starlitemotel.local</span>
      </div>
    </div>
  );
};
