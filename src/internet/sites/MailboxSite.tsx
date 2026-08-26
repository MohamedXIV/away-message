import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { soundManager } from '../../audio/SoundManager';

interface WebmailMessage {
  id: string;
  sender: string;
  subject: string;
  date: string;
  body: string;
  isRead: boolean;
}

const DEFAULT_WEBMAIL_MESSAGES: WebmailMessage[] = [
  {
    id: 'wm_1',
    sender: 'desk@starlitemotel.local',
    subject: 'Room 104 Check-In Confirmation & DSL Settings',
    date: 'Aug 22, 2006 08:30',
    isRead: false,
    body: 'Welcome to Starlite Motel, Room 104. Weekly rent: $140.00 due Sunday midnight. DSL wall jack is live.',
  },
  {
    id: 'wm_2',
    sender: 'maya@myplace.local',
    subject: 'diner shift / rain photos',
    date: 'Aug 22, 2006 10:15',
    isRead: false,
    body: 'hey! uploaded neon motel photos to myplace.local/maya_x. See you at 4th St Diner later tonight!',
  },
  {
    id: 'wm_3',
    sender: 'orders@techmart.local',
    subject: 'Order #TM-89412 Processed',
    date: 'Aug 21, 2006 16:45',
    isRead: true,
    body: 'Your order for SDRAM and PC components has been processed and dispatched for courier delivery.',
  },
];

export const MailboxSite: React.FC<SiteRouteProps> = () => {
  const [messages, setMessages] = useState<WebmailMessage[]>(DEFAULT_WEBMAIL_MESSAGES);
  const [selectedMessageId, setSelectedMessageId] = useState<string>('wm_1');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  const selectedMessage = messages.find((m) => m.id === selectedMessageId) || messages[0];

  const handleSelectMessage = (msg: WebmailMessage) => {
    setSelectedMessageId(msg.id);
    if (!msg.isRead) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m))
      );
    }
  };

  const handleSendCompose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim()) return;

    const newMsg: WebmailMessage = {
      id: `wm_${Date.now()}`,
      sender: 'wanderer06@mailbox.local',
      subject: composeSubject.trim(),
      date: 'Just now',
      body: composeBody.trim(),
      isRead: true,
    };

    setMessages((prev) => [newMsg, ...prev]);
    setIsComposeOpen(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    soundManager.play('im_send');
  };

  return (
    <div className="w-full min-h-full bg-[#f0f4f8] text-black font-sans text-xs flex flex-col">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📬</span>
          <div>
            <h1 className="text-base font-bold leading-none">Mailbox.local Webmail Portal</h1>
            <span className="text-[10px] text-blue-200">User: wanderer06@mailbox.local (15 MB / 50 MB Used)</span>
          </div>
        </div>

        <button
          onClick={() => setIsComposeOpen(true)}
          className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow text-xs cursor-pointer"
        >
          ✉️ Compose
        </button>
      </div>

      {/* Main Mail Layout */}
      <div className="flex-1 flex max-w-5xl w-full mx-auto p-3 gap-3">
        {/* Left: Folders & Actions */}
        <div className="w-44 bg-white border border-gray-300 rounded shadow-xs p-2 flex flex-col gap-1">
          <span className="font-bold text-[10px] text-gray-500 uppercase tracking-wide mb-1">
            Mail Folders
          </span>
          <button className="w-full text-left px-2 py-1 bg-blue-100 text-blue-900 font-bold rounded flex justify-between items-center">
            <span>📥 Inbox</span>
            <span className="bg-blue-600 text-white text-[9px] px-1.5 rounded-full">
              {messages.filter((m) => !m.isRead).length}
            </span>
          </button>
          <button className="w-full text-left px-2 py-1 hover:bg-gray-100 text-gray-700 rounded">
            📤 Sent Mail
          </button>
          <button className="w-full text-left px-2 py-1 hover:bg-gray-100 text-gray-700 rounded">
            🗑️ Trash
          </button>
          <button className="w-full text-left px-2 py-1 hover:bg-gray-100 text-gray-700 rounded">
            🚫 Junk E-Mail
          </button>
        </div>

        {/* Right: Message List & Body */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Table */}
          <div className="bg-white border border-gray-300 rounded shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100 border-b border-gray-300 font-bold text-gray-700">
                <tr>
                  <th className="p-1.5 w-6 text-center">!</th>
                  <th className="p-1.5 border-r border-gray-300">From</th>
                  <th className="p-1.5 border-r border-gray-300">Subject</th>
                  <th className="p-1.5">Date</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg) => {
                  const isSelected = msg.id === selectedMessage?.id;
                  return (
                    <tr
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`border-b border-gray-100 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-100 font-bold text-blue-950'
                          : !msg.isRead
                          ? 'bg-yellow-50 font-bold'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <td className="p-1.5 text-center">{!msg.isRead ? '✉️' : '📭'}</td>
                      <td className="p-1.5 truncate max-w-[140px]">{msg.sender}</td>
                      <td className="p-1.5 truncate max-w-[240px]">{msg.subject}</td>
                      <td className="p-1.5 text-[11px] text-gray-500">{msg.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Reading Pane */}
          {selectedMessage && (
            <div className="bg-white border border-gray-300 rounded shadow-xs p-3 flex flex-col gap-2 flex-1">
              <div className="border-b border-gray-200 pb-2">
                <h3 className="font-bold text-sm text-gray-900">{selectedMessage.subject}</h3>
                <div className="text-[11px] text-gray-600 mt-0.5">
                  From: <span className="font-semibold text-gray-800">{selectedMessage.sender}</span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">{selectedMessage.date}</span>
              </div>
              <div className="p-2 whitespace-pre-wrap font-sans text-xs text-gray-800 leading-relaxed">
                {selectedMessage.body}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSendCompose}
            className="bg-white border-2 border-blue-600 rounded shadow-2xl p-4 w-full max-w-md text-black flex flex-col gap-2.5"
          >
            <div className="flex justify-between items-center border-b pb-1 font-bold text-sm text-blue-900">
              <span>Compose Webmail Message</span>
              <button type="button" onClick={() => setIsComposeOpen(false)} className="text-gray-400 hover:text-red-600">
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700">To:</label>
              <input
                type="text"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@domain.local"
                className="w-full p-1.5 border border-gray-300 rounded text-xs outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700">Subject:</label>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject line"
                className="w-full p-1.5 border border-gray-300 rounded text-xs outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700">Message:</label>
              <textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={6}
                placeholder="Type your message..."
                className="w-full p-1.5 border border-gray-300 rounded text-xs outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t">
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
