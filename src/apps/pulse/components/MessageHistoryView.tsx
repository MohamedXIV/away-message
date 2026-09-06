import React, { useEffect, useRef } from 'react';
import { MessageRecord, BuddyCharacter } from '../../../engine/types';
import { formatSimulationMinutes } from '../utils/timeFormat';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { useWindowStore } from '../../../store/useWindowStore';
import { renderWithLinksAndEmoticons } from '../utils/linkDetector';
import { pulseHasFeature } from '../../../engine/PulseCatalog';
import { buddySignatureColor, resolveArchetype } from '../../../engine/characterTemplates';
import { getFileInfoFromUrl } from '../../../engine/fileUtils';
import { soundManager } from '../../../audio/SoundManager';

interface MessageHistoryViewProps {
  messages: MessageRecord[];
  buddy: BuddyCharacter;
}

export const MessageHistoryView: React.FC<MessageHistoryViewProps> = ({ messages, buddy }) => {
  const isOrion60 = useSimulationStore((s) => s.state.hardware.osVersion === 'Orion_6.0');
  // Pulse 6 generation: buddies tint their own names + animated emoticons move.
  const pulse6 = useSimulationStore((s) => pulseHasFeature(s.state.pulse.currentPulseId, 'buddy-colors'));
  const pulse6Animated = useSimulationStore((s) => pulseHasFeature(s.state.pulse.currentPulseId, 'animated-emoticons'));
  const openWindow = useWindowStore((s) => s.openWindow);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleOpenLink = (url: string) => {
    openWindow('browser', { initialUrl: url });
  };

  const handleDownloadLink = (url: string) => {
    const info = getFileInfoFromUrl(url);
    if (!info) {
      openWindow('browser', { initialUrl: url });
      return;
    }
    dispatchAction({
      type: 'DOWNLOAD_START',
      sourceId: `pulse_${buddy.id}_${info.fileName}`,
      url: info.downloadUrl,
      fileName: info.fileName,
      totalBytes: info.totalBytes,
      sourceMaxKbps: info.sourceMaxKbps,
      fileKind: info.fileKind as any,
      appAssociation: info.appAssociation,
    });
    soundManager.play('im_send');
  };

  const handleSaveLog = () => {
    if (messages.length === 0) return;
    const day = Math.floor((messages[0]?.timestampMinute || 0) / 1440) + 1;
    const fileName = `Pulse_${buddy.handle}_Day${day}.txt`;
    const logContent = messages.map((msg) => {
      const time = formatSimulationMinutes(msg.timestampMinute);
      const sender = msg.senderId === 'player' ? 'wanderer06' : buddy.displayName;
      const offlineMark = msg.deliveredAway ? ' [offline]' : '';
      return `(${time}) ${sender}${offlineMark}: ${msg.text}`;
    }).join('\n');
    dispatchAction({
      type: 'VFS_CREATE_FILE',
      file: {
        name: fileName,
        path: `C:/Documents/${fileName}`,
        parentPath: 'C:/Documents',
        kind: 'text',
        sizeBytes: logContent.length,
        content: logContent,
        metadata: { textContent: logContent },
      },
    });
    soundManager.play('im_send');
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-300 bg-[#ece9d8] px-2 py-1">
        <span className="text-[11px] font-bold text-gray-600">{messages.length} messages • {buddy.displayName}</span>
        <button onClick={handleSaveLog} disabled={messages.length === 0} className="rounded border border-gray-400 bg-white px-2 py-0.5 text-[11px] hover:bg-blue-50 disabled:opacity-40">💾 Save log</button>
      </div>
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-3 bg-white border border-gray-300 rounded font-sans text-xs space-y-2 select-text"
    >
      {messages.length === 0 ? (
        <div className="text-gray-400 italic text-center py-6">
          --- Conversation started with {buddy.displayName} ({buddy.handle}) ---
        </div>
      ) : (
        messages.map((msg) => {
          const isPlayer = msg.senderId === 'player';
          const senderName = isPlayer ? 'wanderer06' : buddy.displayName;
          // Buddies color their own names — but only on Pulse 6.x (their upgrade, their paint).
          const senderColor = isPlayer
            ? '#000080'
            : pulse6 ? buddySignatureColor(buddy.id, resolveArchetype(buddy.id, buddy.archetype)) : '#800080';
          const isOffline = Boolean(msg.deliveredAway || msg.tags?.includes('offline-message') || msg.tags?.includes('offline'));
          const isUnread = !msg.isRead && !isPlayer;

          return (
            <div key={msg.id} className={`leading-relaxed rounded px-1 py-0.5 ${isOffline ? 'bg-[#fff7cc] border border-[#e6d88a]' : ''} ${isUnread ? 'bg-[#e8f1ff]' : ''}`}>
              <span className="text-[10px] text-gray-500 font-mono mr-1.5">
                ({formatSimulationMinutes(msg.timestampMinute)})
              </span>
              {isOffline && <span className="mr-1 rounded bg-[#c39a35] px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">offline</span>}
              {isUnread && !isOffline && <span className="mr-1 h-1.5 w-1.5 inline-block rounded-full bg-[#d96c3b]" />}
              <span
                style={{ color: senderColor }}
                className="font-bold mr-1.5"
              >
                {senderName}:
              </span>
              <span className="text-gray-900">
                {renderWithLinksAndEmoticons(msg.text, isOrion60, handleOpenLink, handleDownloadLink, pulse6Animated)}
              </span>
              {msg.imageUrl && (
                <div className="mt-1.5 ml-6 max-w-[320px]">
                  <img
                    src={msg.imageUrl}
                    alt={msg.imageCaption || msg.imagePrompt || 'shared photo'}
                    className="max-h-48 w-auto rounded border border-gray-400 bg-white object-contain shadow-sm"
                    loading="lazy"
                  />
                  {msg.imageCaption && <div className="mt-1 text-[10px] italic text-gray-600">{msg.imageCaption}</div>}
                  <div className="mt-1 flex gap-1">
                    <button
                      onClick={() => {
                        // Save image to Pictures
                        const fileName = `Pulse_${buddy.handle}_${msg.timestampMinute}.jpg`;
                        // For data URLs, estimate size; for http, use fileUtils
                        const isData = msg.imageUrl!.startsWith('data:');
                        dispatchAction({
                          type: 'VFS_CREATE_FILE',
                          file: {
                            name: fileName,
                            path: `C:/Pictures/${fileName}`,
                            parentPath: 'C:/Pictures',
                            kind: 'image',
                            sizeBytes: isData ? Math.ceil((msg.imageUrl!.length * 3) / 4) : 45 * 1024,
                            content: msg.imageUrl,
                            metadata: { textContent: msg.imagePrompt || '' },
                          },
                        });
                        soundManager.play('im_send');
                      }}
                      className="rounded border border-gray-400 bg-white px-2 py-0.5 text-[10px] hover:bg-blue-50"
                    >
                      💾 Save
                    </button>
                    <button
                      onClick={() => window.open(msg.imageUrl, '_blank')}
                      className="rounded border border-gray-400 bg-white px-2 py-0.5 text-[10px] hover:bg-blue-50"
                    >
                      🔍 View
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
    </div>
  );
};

