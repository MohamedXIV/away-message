import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { soundManager } from '../../audio/SoundManager';
import { useSimulationStore } from '../../store/useSimulationStore';
import { getNightBoardDynamicThreads } from '../worldSiteHelpers';

interface PostRecord {
  id: number;
  author: string;
  tripcode?: string;
  date: string;
  content: string;
  isOp?: boolean;
}

interface ThreadRecord {
  id: number;
  title: string;
  category: string;
  replyCount: number;
  lastReplyDate: string;
  posts: PostRecord[];
}

const INITIAL_THREADS: ThreadRecord[] = [
  {
    id: 104,
    title: 'Sub-Canal Infrastructure Hum and Electrical Anomalies',
    category: '/tech/ - Infrastructure & Audio Forensics',
    replyCount: 3,
    lastReplyDate: 'Aug 22, 2006 03:15 AM',
    posts: [
      {
        id: 1,
        author: 'Anonymous',
        tripcode: '!nocturne87',
        date: 'Aug 21, 2006 23:45 PM',
        content: 'Anyone else living within 500m of the industrial canal notice that 60Hz resonant drone between 2 AM and 4 AM? It vibrates through the cast-iron plumbing. Attached acoustic spectral recording from Room 104.',
        isOp: true,
      },
      {
        id: 2,
        author: 'Anonymous',
        date: 'Aug 22, 2006 00:12 AM',
        content: 'It has been doing that since the city modernized the pumping station switches back in July. They are running secondary generators under the canal bed.',
      },
      {
        id: 3,
        author: 'Anonymous',
        tripcode: '!tacocart',
        date: 'Aug 22, 2006 01:20 AM',
        content: 'I smell ozone every time the diner neon flickers across the asphalt. It is definitely drawing excessive grid current.',
      },
      {
        id: 4,
        author: 'Anonymous',
        tripcode: '!nocturne87',
        date: 'Aug 22, 2006 03:15 AM',
        content: 'If you connect a terminal line to the port behind the motel junction box, you can capture raw telemetry packets on port 8080.',
      },
    ],
  },
  {
    id: 89,
    title: 'Late Night Diner Sightings & Courier Activity',
    category: '/lounge/ - District Nightlife',
    replyCount: 2,
    lastReplyDate: 'Aug 21, 2006 18:20 PM',
    posts: [
      {
        id: 1,
        author: 'Anonymous',
        date: 'Aug 21, 2006 14:00 PM',
        content: '4th Street Diner has the best onion rings in the city, but who is that guy in the trench coat ordering black coffee every night at 3 AM?',
        isOp: true,
      },
      {
        id: 2,
        author: 'Anonymous',
        tripcode: '!maya',
        date: 'Aug 21, 2006 15:30 PM',
        content: 'Haha that is just Mr. Henderson from the motel front desk taking his night shift break!',
      },
    ],
  },
  {
    id: 52,
    title: 'Dialup 56k Modem Optimization & String Init Strings',
    category: '/modems/ - Telephony & Hardware',
    replyCount: 1,
    lastReplyDate: 'Aug 20, 2006 11:10 AM',
    posts: [
      {
        id: 1,
        author: 'Anonymous',
        date: 'Aug 20, 2006 10:00 AM',
        content: 'AT&FX3S11=50 works wonders for locking clean 53333 bps V.90 connections on noisy motel copper lines.',
        isOp: true,
      },
    ],
  },
];

export const NightBoardSite: React.FC<SiteRouteProps> = (props) => {
  const world = useSimulationStore((s) => s.state.world);
  const time = useSimulationStore((s) => s.state.time);
  const dynamicThreads = getNightBoardDynamicThreads(world, time.day);
  // Build merged list: static + dynamic procedural
  const buildMerged = (): ThreadRecord[] => [
    ...INITIAL_THREADS,
    ...dynamicThreads.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      replyCount: d.replyCount,
      lastReplyDate: d.lastReplyDate,
      posts: [{
        id: 1,
        author: 'CityWire Bot',
        date: `Day ${world.triggeredEvents.find((e) => e.id === d.eventId)?.triggerDay ?? time.day}, ${String(world.triggeredEvents.find((e) => e.id === d.eventId)?.triggerHour ?? 10).padStart(2, '0')}:00`,
        content: `${world.triggeredEvents.find((e) => e.id === d.eventId)?.description ?? d.title}\n\n— ${world.triggeredEvents.find((e) => e.id === d.eventId)?.knowledgePrompt ?? ''}`,
        isOp: true,
      }],
    } as ThreadRecord)),
  ];
  const [threads, setThreads] = useState<ThreadRecord[]>(() => buildMerged());
  // Keep dynamic threads in sync when world advances (without losing user replies)
  React.useEffect(() => {
    setThreads((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const toAdd = dynamicThreads
        .filter((d) => !existingIds.has(d.id))
        .map((d) => ({
          id: d.id,
          title: d.title,
          category: d.category,
          replyCount: d.replyCount,
          lastReplyDate: d.lastReplyDate,
          posts: [{
            id: 1,
            author: 'CityWire Bot',
            date: `Day ${world.triggeredEvents.find((e) => e.id === d.eventId)?.triggerDay ?? time.day}, ${String(world.triggeredEvents.find((e) => e.id === d.eventId)?.triggerHour ?? 10).padStart(2, '0')}:00`,
            content: `${world.triggeredEvents.find((e) => e.id === d.eventId)?.description ?? d.title}\n\n— ${world.triggeredEvents.find((e) => e.id === d.eventId)?.knowledgePrompt ?? ''}`,
            isOp: true,
          }],
        } as ThreadRecord));
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
  }, [dynamicThreads, world.triggeredEvents, time.day]);
  const effectiveParams = { ...props.params, ...props.routeParams };
  const threadIdParam = effectiveParams['threadId'];
  const activeThreadId = threadIdParam ? parseInt(threadIdParam, 10) : null;

  const [activeThread, setActiveThread] = useState<ThreadRecord | null>(
    activeThreadId ? threads.find((t) => t.id === activeThreadId) || null : null
  );

  const [replyInput, setReplyInput] = useState('');
  const [authorInput, setAuthorInput] = useState('');

  const handleSelectThread = (thread: ThreadRecord) => {
    setActiveThread(thread);
  };

  const handlePostReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !activeThread) return;

    const newPost: PostRecord = {
      id: activeThread.posts.length + 1,
      author: authorInput.trim() || 'Anonymous',
      date: 'Aug 22, 2006 (Today)',
      content: replyInput.trim(),
    };

    const updatedThread = {
      ...activeThread,
      replyCount: activeThread.replyCount + 1,
      posts: [...activeThread.posts, newPost],
    };

    setActiveThread(updatedThread);
    setThreads((prev) =>
      prev.map((t) => (t.id === updatedThread.id ? updatedThread : t))
    );
    setReplyInput('');
    soundManager.play('im_send');
  };

  return (
    <div className="w-full min-h-full bg-[#111827] text-gray-200 font-mono text-xs p-4 flex flex-col items-center">
      {/* Board Banner */}
      <div className="max-w-4xl w-full border-b border-gray-700 pb-3 mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-emerald-400 tracking-wider">
            [NightBoard] Anonymous Underground Textboard
          </h1>
          <span className="text-[10px] text-gray-500">
            Node: nightboard.local // Encoding: UTF-8 // Unfiltered Nocturne Network
          </span>
        </div>

        {activeThread && (
          <button
            onClick={() => setActiveThread(null)}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-gray-600 rounded text-xs"
          >
            ← Return to Board Index
          </button>
        )}
      </div>

      {/* Live Wire Banner */}
      {dynamicThreads.length > 0 && (
        <div className="max-w-4xl w-full mb-3 bg-emerald-950 border border-emerald-700 px-3 py-1.5 text-[11px] font-bold text-emerald-300 flex items-center gap-2">
          <span>⬢ Live Wire:</span>
          <span className="font-normal">{dynamicThreads.length} new threads mirrored from CityWire</span>
          <span className="ml-auto text-[10px] font-mono opacity-60">Day {time.day} • procedural</span>
        </div>
      )}

      {/* Main Board Container */}
      <div className="max-w-4xl w-full">
        {!activeThread ? (
          /* Board Index View */
          <div className="space-y-4">
            <div className="bg-[#1f2937] border border-gray-700 p-2.5 rounded text-emerald-300 text-xs">
              Welcome to NightBoard. Read the room rules before posting. No commercial spam. Keep infrastructure discussions on /tech/.
            </div>

            <div className="bg-[#1f2937] border border-gray-700 rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#374151] border-b border-gray-600 text-emerald-400 font-bold">
                  <tr>
                    <th className="p-2 w-16">No.</th>
                    <th className="p-2 border-r border-gray-600">Thread Subject</th>
                    <th className="p-2 border-r border-gray-600">Category</th>
                    <th className="p-2 border-r border-gray-600">Replies</th>
                    <th className="p-2">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {threads.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => handleSelectThread(t)}
                      className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer"
                    >
                      <td className="p-2 font-bold text-emerald-500">#{t.id}</td>
                      <td className="p-2 font-semibold text-white hover:underline truncate max-w-sm">
                        {t.title}
                      </td>
                      <td className="p-2 text-gray-400">{t.category}</td>
                      <td className="p-2 font-bold text-cyan-400">{t.replyCount}</td>
                      <td className="p-2 text-gray-500 text-[11px]">{t.lastReplyDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Single Thread View */
          <div className="space-y-4">
            <div className="bg-[#1f2937] border border-emerald-700 p-3 rounded shadow">
              <h2 className="text-sm font-bold text-emerald-300">
                Thread #{activeThread.id}: {activeThread.title}
              </h2>
              <span className="text-[10px] text-gray-400 font-mono">{activeThread.category}</span>
            </div>

            {/* Posts Stream */}
            <div className="space-y-3">
              {activeThread.posts.map((post) => (
                <div
                  key={post.id}
                  className={`p-3 rounded border ${
                    post.isOp
                      ? 'bg-[#1e293b] border-emerald-600'
                      : 'bg-[#18202f] border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center border-b border-gray-700/50 pb-1 mb-2 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <strong className="text-white">{post.author}</strong>
                      {post.tripcode && (
                        <span className="text-emerald-400 font-mono font-bold text-[10px]">
                          {post.tripcode}
                        </span>
                      )}
                      {post.isOp && (
                        <span className="bg-emerald-900 text-emerald-300 text-[9px] px-1 rounded font-bold">
                          OP
                        </span>
                      )}
                    </div>
                    <span className="text-gray-500 font-mono">{post.date} No.{post.id}</span>
                  </div>

                  <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Reply Form */}
            <form onSubmit={handlePostReply} className="bg-[#1f2937] border border-gray-700 p-3 rounded space-y-2">
              <h3 className="text-xs font-bold text-emerald-400">Post Anonymous Reply:</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={authorInput}
                  onChange={(e) => setAuthorInput(e.target.value)}
                  placeholder="Anonymous (optional name/tripcode)"
                  className="w-56 p-1.5 bg-black border border-gray-600 rounded text-xs text-white outline-none"
                />
              </div>
              <textarea
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                rows={4}
                placeholder="Type your response to this thread..."
                className="w-full p-2 bg-black border border-gray-600 rounded text-xs text-white outline-none resize-none font-mono"
                required
              />
              <button
                type="submit"
                className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-black font-bold rounded text-xs cursor-pointer shadow"
              >
                Post Reply
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
