import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { soundManager } from '../../audio/SoundManager';

interface ProfileData {
  username: string;
  displayName: string;
  headline: string;
  avatarGlyph: string;
  bio: string;
  interests: string[];
  themeColor: string;
  top8: Array<{ name: string; avatar: string; handle: string }>;
  songTitle: string;
}

const PROFILES: Record<string, ProfileData> = {
  maya_x: {
    username: 'maya_x',
    displayName: 'Maya Lin',
    headline: 'Taking 35mm photos in the rain // 4th St Diner shifts',
    avatarGlyph: '📷',
    bio: '21. Part-time diner waitress, full-time analogue photography enthusiast. Obsessed with wet pavement neon reflections and motel sign lettering.',
    interests: ['Film Cameras', 'Darkrooms', 'French Fries', 'Lo-Fi Tape Hiss', 'Rain'],
    themeColor: '#7c3aed',
    top8: [
      { name: 'Ryan', avatar: '🌮', handle: 'tacocart_ryan' },
      { name: 'Nora', avatar: '🦉', handle: 'nightowl87' },
      { name: 'wanderer06', avatar: '💻', handle: 'wanderer06' },
      { name: 'Sam', avatar: '🎸', handle: 'sam_guitar' },
    ],
    songTitle: 'Track 03 - Rain Over Motel (Lo-Fi Cut)',
  },
  tacocart_ryan: {
    username: 'tacocart_ryan',
    displayName: 'Ryan (Street Tacos)',
    headline: 'Corner of 4th & Industrial // Best salsa in the district',
    avatarGlyph: '🌮',
    bio: 'Grilling al pastor and carnitas from 11am to midnight. Overclocking PCs and tuning engines when the grill cools down.',
    interests: ['Custom Coolers', 'SDRAM Overclocking', 'Spicy Salsa', 'Motorbikes'],
    themeColor: '#d97706',
    top8: [
      { name: 'Maya', avatar: '📷', handle: 'maya_x' },
      { name: 'wanderer06', avatar: '💻', handle: 'wanderer06' },
      { name: 'Nora', avatar: '🦉', handle: 'nightowl87' },
    ],
    songTitle: '4th Street Diner Echoes (Instrumental)',
  },
  nightowl87: {
    username: 'nightowl87',
    displayName: 'Nora // Nocturne',
    headline: 'Documenting the sub-canal infrastructure hum',
    avatarGlyph: '🦉',
    bio: 'Late night net archivist. If you listen closely at 3 AM near the sluice gates, you can hear the frequency modulation.',
    interests: ['Audio Forensics', 'Hydroelectric Canals', 'NightBoard Threads', 'Urban Exploration'],
    themeColor: '#0f766e',
    top8: [
      { name: 'Maya', avatar: '📷', handle: 'maya_x' },
      { name: 'Ryan', avatar: '🌮', handle: 'tacocart_ryan' },
    ],
    songTitle: 'Sub-Canal Infrastructure Hum (Field Recording 01)',
  },
};

export const MyPlaceSite: React.FC<SiteRouteProps> = (props) => {
  const doNavigate = props.navigate || props.onNavigate || (() => {});
  const effectiveParams = { ...props.params, ...props.routeParams };
  const currentUsername = effectiveParams['username'] || 'maya_x';
  const profile = PROFILES[currentUsername] || PROFILES['maya_x']!;

  const [guestbookComments, setGuestbookComments] = useState<Array<{ author: string; text: string; date: string }>>([
    { author: 'tacocart_ryan', text: 'Left some tacos at the counter for you!', date: 'Aug 22, 11:30 AM' },
    { author: 'nightowl87', text: 'Check the new recordings on NightBoard thread 104.', date: 'Aug 21, 02:40 AM' },
  ]);

  const [commentInput, setCommentInput] = useState('');

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    setGuestbookComments((prev) => [
      {
        author: 'wanderer06',
        text: commentInput.trim(),
        date: 'Just now',
      },
      ...prev,
    ]);
    setCommentInput('');
    soundManager.play('im_send');
  };

  return (
    <div className="w-full min-h-full bg-[#1e1b4b] text-white font-sans text-xs p-4 flex flex-col items-center">
      {/* Top Profile Header Bar */}
      <div className="max-w-4xl w-full bg-[#2e1065] border-2 border-purple-400 rounded-t p-3 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌟</span>
          <div>
            <h1 className="text-base font-bold leading-none font-serif text-purple-200">
              MyPlace Profile: {profile.displayName}
            </h1>
            <span className="text-[10px] text-purple-300 font-mono">myplace.local/{profile.username}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => doNavigate('myplace.local/maya_x')}
            className="px-2 py-1 bg-purple-800 hover:bg-purple-700 text-xs rounded border border-purple-500"
          >
            Maya's Page
          </button>
          <button
            onClick={() => doNavigate('myplace.local/tacocart_ryan')}
            className="px-2 py-1 bg-purple-800 hover:bg-purple-700 text-xs rounded border border-purple-500"
          >
            Ryan's Page
          </button>
          <button
            onClick={() => doNavigate('myplace.local/nightowl87')}
            className="px-2 py-1 bg-purple-800 hover:bg-purple-700 text-xs rounded border border-purple-500"
          >
            Nora's Page
          </button>
        </div>
      </div>

      {/* Main Profile Layout */}
      <div className="max-w-4xl w-full bg-[#18181b] border-2 border-t-0 border-purple-400 p-4 grid grid-cols-3 gap-4 text-gray-200 shadow-2xl">
        {/* Left Column: Avatar & Bio */}
        <div className="col-span-1 space-y-3">
          <div className="bg-[#27272a] border border-gray-700 p-3 rounded text-center">
            <div className="w-24 h-24 mx-auto bg-purple-900 border-2 border-purple-400 rounded flex items-center justify-center text-4xl shadow-inner mb-2">
              {profile.avatarGlyph}
            </div>
            <strong className="text-sm text-white block">{profile.displayName}</strong>
            <span className="text-[11px] text-purple-400 block italic">{profile.headline}</span>
            <div className="mt-2 text-[10px] text-gray-400">
              <span>Status: </span>
              <span className="text-green-400 font-bold">Online 🟢</span>
            </div>
          </div>

          {/* Song Player Widget */}
          <div className="bg-[#0f172a] border border-blue-900 rounded p-2.5 space-y-1">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide block">
              Profile Music:
            </span>
            <div className="text-[11px] text-white font-mono truncate">
              ♫ {profile.songTitle}
            </div>
            <div className="flex gap-1 pt-1">
              <button
                onClick={() => soundManager.play('im_recv')}
                className="px-2 py-0.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-[10px] font-bold"
              >
                ▶ Play
              </button>
              <button className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-[10px]">
                ⏸ Pause
              </button>
            </div>
          </div>

          {/* Interests */}
          <div className="bg-[#27272a] border border-gray-700 p-3 rounded space-y-1.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">
              Interests & Hobbies:
            </span>
            <div className="flex flex-wrap gap-1">
              {profile.interests.map((int, i) => (
                <span key={i} className="bg-purple-950 text-purple-200 border border-purple-700 px-1.5 py-0.5 rounded text-[10px]">
                  {int}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Center & Right Column: About, Top 8, Guestbook */}
        <div className="col-span-2 space-y-4">
          {/* About Me */}
          <div className="bg-[#27272a] border border-gray-700 p-3 rounded space-y-1.5">
            <h3 className="font-bold text-sm text-purple-300 border-b border-gray-700 pb-1">
              About Me
            </h3>
            <p className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap">
              {profile.bio}
            </p>
          </div>

          {/* Top 8 Friends Grid */}
          <div className="bg-[#27272a] border border-gray-700 p-3 rounded space-y-2">
            <div className="flex justify-between items-center border-b border-gray-700 pb-1">
              <h3 className="font-bold text-xs text-purple-300">
                {profile.displayName}'s Friend Space ({profile.top8.length})
              </h3>
              <span className="text-[10px] text-gray-400">Top 8</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              {profile.top8.map((fr, idx) => (
                <div
                  key={idx}
                  onClick={() => doNavigate(`myplace.local/${fr.handle}`)}
                  className="bg-[#18181b] border border-gray-800 p-1.5 rounded hover:border-purple-500 cursor-pointer transition-colors"
                >
                  <div className="text-2xl mb-1">{fr.avatar}</div>
                  <strong className="text-[11px] text-white block truncate">{fr.name}</strong>
                  <span className="text-[9px] text-gray-400 block font-mono truncate">{fr.handle}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Guestbook Comments */}
          <div className="bg-[#27272a] border border-gray-700 p-3 rounded space-y-3">
            <div className="flex justify-between items-center border-b border-gray-700 pb-1">
              <h3 className="font-bold text-xs text-purple-300">
                Guestbook ({guestbookComments.length} Comments)
              </h3>
            </div>

            {/* Post comment form */}
            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Leave a comment on this profile..."
                className="flex-1 px-2.5 py-1 bg-[#18181b] border border-gray-600 rounded text-xs text-white outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded text-xs shadow cursor-pointer"
              >
                Post
              </button>
            </form>

            {/* Comments List */}
            <div className="space-y-2">
              {guestbookComments.map((cm, i) => (
                <div key={i} className="bg-[#18181b] p-2 rounded border border-gray-800 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-400 text-xs">@{cm.author}</span>
                    <span className="text-[10px] text-gray-500 font-mono">{cm.date}</span>
                  </div>
                  <p className="text-xs text-gray-300">{cm.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
