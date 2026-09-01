import React, { useEffect, useRef, useState } from 'react';
import type { PulseRoom } from '../data/pulseRooms';
import { EmoticonPalette } from './EmoticonPalette';
import { useSimulationStore } from '../../../store/useSimulationStore';
import { useWindowStore } from '../../../store/useWindowStore';
import { renderWithLinksAndEmoticons } from '../utils/linkDetector';
import { getFileInfoFromUrl } from '../../../engine/fileUtils';
import { soundManager } from '../../../audio/SoundManager';

export interface PulseRoomMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  minute: number;
  kind?: 'chat' | 'system' | 'whisper';
  targetId?: string;
}

interface PulseRoomWindowProps {
  room: PulseRoom;
  messages: PulseRoomMessage[];
  participantNames: Record<string, string>;
  username: string;
  topic?: string;
  isTyping?: boolean;
  isJoined: boolean;
  onSend: (text: string) => void;
  onWhisper: (targetId: string, text: string) => void;
  onTopicChange: (topic: string) => void;
  onJoin: () => void;
  onLeave: () => void;
}

export const PulseRoomWindow: React.FC<PulseRoomWindowProps> = ({ room, messages, participantNames, username, topic, isTyping = false, isJoined, onSend, onWhisper, onTopicChange, onJoin, onLeave }) => {
  const [text, setText] = useState('');
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [whisperTarget, setWhisperTarget] = useState('');
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState(topic || room.topic);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const isOrion60 = useSimulationStore((s) => s.state.hardware.osVersion === 'Orion_6.0');
  const openWindow = useWindowStore((s) => s.openWindow);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const handleOpenLink = (url: string) => openWindow('browser', { initialUrl: url });
  const handleDownloadLink = (url: string) => {
    const info = getFileInfoFromUrl(url);
    if (!info) {
      openWindow('browser', { initialUrl: url });
      return;
    }
    dispatchAction({
      type: 'DOWNLOAD_START',
      sourceId: `room_${room.id}_${info.fileName}`,
      url: info.downloadUrl,
      fileName: info.fileName,
      totalBytes: info.totalBytes,
      sourceMaxKbps: info.sourceMaxKbps,
      fileKind: info.fileKind as any,
      appAssociation: info.appAssociation,
    });
    soundManager.play('im_send');
  };

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [messages]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || !isJoined || isTyping) return;
    if (whisperTarget) onWhisper(whisperTarget, cleanText);
    else onSend(cleanText);
    setText('');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden border border-gray-400 bg-[#ece9d8]">
      <div className="flex items-center justify-between border-b border-gray-500 px-2 py-1 text-white" style={{ backgroundColor: room.color }}>
        <div>
          <div className="font-bold">{room.name}</div>
          {isEditingTopic ? <form onSubmit={(event) => { event.preventDefault(); const nextTopic = topicDraft.trim().slice(0, 120); if (nextTopic) onTopicChange(nextTopic); setIsEditingTopic(false); }}><input autoFocus value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} className="w-72 border border-white/70 bg-white/90 px-1 text-[10px] text-black outline-none" /></form> : <button onClick={() => { setTopicDraft(topic || room.topic); setIsEditingTopic(true); }} className="text-left text-[10px] opacity-85 hover:underline">{topic || room.topic}</button>}
        </div>
        {isJoined ? <button onClick={onLeave} className="border border-white/70 px-2 py-0.5 text-[10px] hover:bg-white/15">Leave room</button> : <button onClick={onJoin} className="border border-white/70 px-2 py-0.5 text-[10px] hover:bg-white/15">Join room</button>}
      </div>

      <div className="flex min-h-0 flex-1 bg-white">
        <div ref={transcriptRef} className="min-w-0 flex-1 overflow-y-auto p-2 font-sans text-xs">
          <div className="mb-2 border-b border-dotted border-gray-300 pb-2 text-[10px] text-gray-500">{room.description}</div>
          {messages.map((message) => message.kind === 'system' ? (
            <div key={message.id} className="mb-1.5 border-y border-dotted border-[#cad2da] bg-[#f3f5f7] px-2 py-1 text-center text-[10px] italic text-gray-500">{message.text}</div>
          ) : message.kind === 'whisper' ? (
            <div key={message.id} className="mb-1.5 border border-dashed border-[#a88bbd] bg-[#faf3ff] px-2 py-1 text-[11px] text-[#653b7e]"><span className="font-bold">private whisper{message.targetId ? ` → ${participantNames[message.targetId] || message.targetId}` : ''}:</span> {renderWithLinksAndEmoticons(message.text, isOrion60, handleOpenLink, handleDownloadLink)}</div>
          ) : (
            <div key={message.id} className="mb-1.5 leading-5">
              <span className="mr-1 text-[10px] text-gray-400">[{String(Math.floor(message.minute / 60)).padStart(2, '0')}:{String(message.minute % 60).padStart(2, '0')}]</span>
              <button className="font-bold hover:underline" style={{ color: message.senderId === 'player' ? room.color : '#174a7c' }}>{message.senderName}:</button>
              <span className="ml-1">{renderWithLinksAndEmoticons(message.text, isOrion60, handleOpenLink, handleDownloadLink)}</span>
            </div>
          ))}
          {isTyping && <div className="mt-3 border-t border-dotted border-gray-300 pt-2 text-[10px] italic text-gray-500">someone in the room is typing...</div>}
        </div>

        <aside className="w-36 shrink-0 border-l border-gray-300 bg-[#f4f4f4] p-2">
          <div className="mb-2 border-b border-gray-300 pb-1 text-[10px] font-bold text-gray-600">Room members ({room.participantIds.length + 1})</div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[11px] font-bold text-[#2c6e49]"><span className="h-2 w-2 rounded-full bg-green-500" />{username}</div>
            {room.participantIds.map((participantId) => (
              <div key={participantId} className="flex items-center gap-1 truncate text-[11px] text-gray-700"><span className="h-2 w-2 rounded-full bg-green-500" />{participantNames[participantId] || participantId}</div>
            ))}
          </div>
        </aside>
      </div>

      <form onSubmit={submit} className="relative flex gap-1 border-t border-gray-400 bg-[#e2e2e2] p-1.5">
        <select value={whisperTarget} onChange={(event) => setWhisperTarget(event.target.value)} disabled={!isJoined || isTyping} className="max-w-28 border border-gray-500 bg-white px-1 text-[10px] disabled:opacity-50"><option value="">Room</option>{room.participantIds.map((participantId) => <option key={participantId} value={participantId}>Whisper {participantNames[participantId] || participantId}</option>)}</select>
        <button type="button" onClick={() => setIsPaletteOpen((open) => !open)} disabled={!isJoined || isTyping} className="border border-gray-500 bg-white px-1.5 py-1 text-sm disabled:opacity-50" title="Emoticons">:)</button>
        <EmoticonPalette isOpen={isPaletteOpen && isJoined && !isTyping} onSelectEmoticon={(code) => setText((current) => `${current}${current ? ' ' : ''}${code}`)} onClose={() => setIsPaletteOpen(false)} />
        <input value={text} onChange={(event) => setText(event.target.value)} disabled={!isJoined || isTyping} placeholder={!isJoined ? 'Join the room to chat...' : isTyping ? 'Waiting for a room reply...' : `Message ${room.name}...`} className="min-w-0 flex-1 border border-gray-500 bg-white px-2 py-1 outline-none disabled:bg-gray-100" />
        <button type="submit" disabled={!isJoined || isTyping || !text.trim()} className="border border-gray-600 bg-[#d9e7f5] px-3 py-1 font-bold hover:bg-[#c4d9ed] disabled:opacity-50">Send</button>
      </form>
    </div>
  );
};
