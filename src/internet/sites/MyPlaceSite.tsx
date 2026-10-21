import React, { useState } from 'react';
import { SiteRouteProps } from '../types';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useMyPlacePageRead } from '../../store/useBoundedSimulationRead';
import { soundManager } from '../../audio/SoundManager';
import { getMyPlaceReleaseById } from '../../engine/MyPlaceCatalog';
import { findBoundSocialActor } from '../../engine/social/IdentityPromotion';

// MySpace 2005 heavily inspired — table layout, tiled bg, contact box, customizable per character, AI-mutable.

export const MyPlaceSite: React.FC<SiteRouteProps> = (props) => {
  const doNavigate = props.navigate || props.onNavigate || (() => {});
  const engine = useSimulationStore((s) => s.engine);
  const dispatchAction = useSimulationStore((s) => s.dispatchAction);
  const [friendNotice, setFriendNotice] = useState<string | null>(null);

  const effectiveParams = { ...props.params, ...props.routeParams };
  const requestedUsername = effectiveParams['username'] || '';
  const { userProfile, profile: selectedProfile, guestbook, time, currentMyPlaceId, locked: isLocked } = useMyPlacePageRead(requestedUsername);
  // Default to YOUR page (wanderer06) — not Maya — and routing is strict
  const currentUsername = requestedUsername || userProfile.username;
  const isOwnProfile = currentUsername === userProfile.username;

  const currentRelease = getMyPlaceReleaseById(currentMyPlaceId) ?? getMyPlaceReleaseById('myplace_1.0')!;
  const features = currentRelease.features;
  const isV1 = currentRelease.id === 'myplace_1.0';

  // Dynamic profiles — not hardcoded: read from MyPlaceEngine (AI-mutable), fallback generates a minimal profile for any username
  const getProfile = (username: string) => {
    if (selectedProfile) return selectedProfile;
    // Generate a lightweight profile for unknown usernames (dynamic, not hardcoded)
    const hash = username.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const avatars = ['🎸', '🎧', '📻', '💾', '🎮', '📚', '🎨', '🚲'];
    return {
      username,
      displayName: username.replace(/[_-]/g, ' '),
      headline: `MyPlace member • myplace.local/${username}`,
      bio: `Hi, I'm ${username}. Found via MyPlace directory.`,
      interests: ['MyPlace', 'Oakhaven', 'Music'],
      songTitle: '— none —',
      avatarGlyph: avatars[hash % avatars.length]!,
      top8: [],
      glitterIntensity: 0,
      visibility: 'public' as const,
      themeColor: '#6b7280',
    } as unknown as typeof userProfile;
  };

  const profile = getProfile(currentUsername);

  // Privacy: friendsOnly → only Top8 + self can view
  // Locking is enforced in the canonical player-visible read, not only JSX.
  // An inaccessible page never transfers its private bio or guestbook.
  const [commentInput, setCommentInput] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editBio, setEditBio] = useState(userProfile.bio);
  const [editInterests, setEditInterests] = useState(userProfile.interests.join(', '));
  const [editSong, setEditSong] = useState(userProfile.songTitle);
  const [editHeadline, setEditHeadline] = useState(userProfile.headline);
  const [glitter, setGlitter] = useState(userProfile.glitterIntensity);
  const [editTiledBackground, setEditTiledBackground] = useState(userProfile.tiledBackground);

  const availableUpdates = engine.myplace.getAvailableReleases(time.day);

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    if (engine.postMyPlaceComment(currentUsername, commentInput)) {
      setCommentInput('');
      soundManager.play('im_send');
    }
  };

  const handleSaveProfile = () => {
    engine.updateMyPlaceProfile({
      headline: editHeadline,
      bio: editBio,
      interests: editInterests.split(',').map((s) => s.trim()).filter(Boolean),
      songTitle: editSong,
      glitterIntensity: glitter,
      tiledBackground: editTiledBackground,
    });
    setEditMode(false);
    soundManager.play('im_send');
    // Notify NPCs? They will see and maybe comment via Pulse later (handled in SimulationEngine)
  };

  const handleUpdateMyPlace = () => {
    if (availableUpdates.length === 0) return;
    const target = availableUpdates[0]!;
    const res = engine.updateMyPlaceRelease(target.id);
    if (res.success) soundManager.play('im_recv');
  };

  // MySpace 2005 tiled background per user choice + version
  const tiledBg = features.tiler && profile.tiledBackground
    ? profile.tiledBackground === 'stars'
      ? 'repeating-linear-gradient(0deg, #0f0f2a 0 2px, #1a1a4a 2px 4px), repeating-linear-gradient(90deg, #1e1b4b 0 40px, #2e1065 40px 80px)'
      : 'repeating-linear-gradient(45deg, #2e0f3a 0 10px, #4a1a5a 10px 20px)'
    : undefined;

  // Views and last login - MySpace style
  const views = 1200 + currentUsername.length * 137 + time.day * 42;
  const lastLogin = `8/2${1 + (time.day % 9)}/2006`;

  // Privacy check
  if (isLocked) {
    return (
      <div className="w-full min-h-full bg-[#e5e5e5] text-black font-sans text-xs flex flex-col items-center p-8">
        <div className="w-full max-w-[600px] bg-white border border-gray-400 p-8 text-center space-y-3">
          <div className="text-4xl">🔒</div>
          <h2 className="font-bold text-sm">This profile is private</h2>
          <p className="text-xs text-gray-600">{profile.displayName} only shares their full profile with friends.</p>
          <p className="text-[11px] text-gray-500">You are viewing as <b>{userProfile.username}</b> — not in Top 8.</p>
          <button onClick={() => doNavigate(`myplace.local/${userProfile.username}`)} className="mt-2 px-3 py-1 bg-[#3b5998] hover:bg-[#2d4373] text-white font-bold rounded text-xs">Back to your profile</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-[#e5e5e5] text-black font-sans text-xs flex flex-col items-center p-0" style={tiledBg ? { background: tiledBg as string } : undefined}>
      {/* MySpace top nav — 2005 — stripped for 1.0: only Home/Browse/Search */}
      <div className="w-full bg-[#003399] text-white text-[11px] flex items-center justify-between px-2 py-1 font-sans">
        <div className="flex items-center gap-2">
          <span className="bg-white text-[#003399] font-black px-1.5 py-0.5 text-xs tracking-tight">myPlace</span>
          <span className="hidden sm:inline opacity-80">A place for friends • Oakhaven</span>
        </div>
        <div className="flex gap-3">
          <a className="hover:underline" href="#" onClick={(e) => e.preventDefault()}>Home</a>
          <a className="hover:underline" href="#" onClick={(e) => e.preventDefault()}>Browse</a>
          <a className="hover:underline" href="#" onClick={(e) => e.preventDefault()}>Search</a>
          {!isV1 && <a className="hover:underline" href="#" onClick={(e) => e.preventDefault()}>Invite</a>}
        </div>
      </div>

      {/* Profile header — network strip */}
      <div className="w-full max-w-[900px] bg-white border-x border-b border-gray-400">
        <div className="bg-[#f0f4ff] border-b border-gray-300 px-3 py-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-bold text-[#003399]">{profile.displayName} <span className="font-normal text-gray-600">• myplace.local/{profile.username}</span></span>
          <span className="text-gray-600">MyPlace {currentRelease.version} <span className={`ml-1 px-1 py-0.5 text-[9px] font-bold border ${currentRelease.channel === 'beta' ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-green-100 border-green-300 text-green-800'}`}>{currentRelease.version}</span> • Build {currentRelease.build}</span>
        </div>
        {!isOwnProfile && (() => {
          // P6.5 live footprint: presence straight from the buddy's schedule
          try {
            const buddy = engine.social.getBuddy(currentUsername) ?? engine.social.getBuddies().find((b) => b.handle === currentUsername);
            if (!buddy) return null;
            const pres = engine.social.getPresence(buddy.id);
            if (!pres) return null;
            const dot = pres.status === 'online' ? '🟢' : pres.status === 'away' ? '🟡' : '⚪';
            const label = pres.status === 'online' ? 'online now' : pres.status === 'away' ? `away: ${pres.awayMessage || 'be right back'}` : 'offline';
            return <div className="bg-white border-b border-gray-200 px-3 py-1 text-[10px] text-gray-600">{dot} {label} on Pulse</div>;
          } catch { return null; }
        })()}
        {availableUpdates.length > 0 && (
          <div className="bg-amber-100 border-b border-amber-300 px-3 py-1.5 flex items-center justify-between text-amber-900">
            <span className="text-xs">⬢ New MyPlace: <b>{availableUpdates[0]!.displayName}</b> — {availableUpdates[0]!.blurb}</span>
            <button onClick={handleUpdateMyPlace} className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs">Update</button>
          </div>
        )}

        {/* Contact box + main layout — MySpace table style */}
        <div className="grid grid-cols-[300px_1fr] gap-0">
          {/* Left column — Contact, pic, url, interests */}
          <div className="border-r border-gray-400 p-3 space-y-3 bg-white">
            {/* Pic + Contacting box — the MySpace core */}
            <div className="border border-gray-400">
              <div className="bg-[#e5eaf6] border-b border-gray-400 px-2 py-1 font-bold text-[#003399] text-xs">Contacting {profile.displayName.split(' ')[0]}</div>
              <div className="p-2 flex flex-col items-center">
                <div className="w-[200px] h-[200px] bg-[#2e1065] border border-gray-400 flex items-center justify-center text-5xl relative overflow-hidden">
                  <span>{profile.avatarGlyph}</span>
                  {features.glitter && profile.glitterIntensity > 2 && <span className="absolute top-1 right-1 text-yellow-300 animate-pulse text-lg">✨</span>}
                </div>
                <div className="mt-2 text-[11px] text-gray-600">View My: <a className="text-blue-700 underline" href="#" onClick={(e) => e.preventDefault()}>Pics</a> | <a className="text-blue-700 underline" href="#" onClick={(e) => e.preventDefault()}>Videos</a></div>
              </div>
              <div className="px-2 pb-2 space-y-1">
                <button
                  onClick={() => {
                    const handle = profile.username === userProfile.username ? 'maya_x' : profile.username;
                    engine.postMyPlaceComment(handle, 'Hey! Love the new look — what do you think of my page?');
                  }}
                  className="w-full bg-[#dbeafe] hover:bg-[#bfdbfe] border border-[#93c5fd] text-[#1e3a8a] font-bold py-1 text-xs flex items-center justify-center gap-1"
                >
                  ✉ Send Message
                </button>
                {(() => {
                  if (isOwnProfile) return null;
                  const existingActor = findBoundSocialActor(engine.social.getBuddies(), {
                    username: currentUsername,
                    handle: currentUsername,
                  });
                  if (existingActor && engine.social.isKnown(existingActor.id)) {
                    return (
                      <div className="w-full bg-green-50 border border-green-300 text-green-800 text-xs py-1 text-center font-bold">
                        ✓ In your Pulse list — say hi!
                      </div>
                    );
                  }
                  return (
                    <>
                      <button
                        onClick={() => {
                          try {
                            const npc = engine.myplace.getNpcProfile(currentUsername);
                            const res = dispatchAction({
                              type: 'SOCIAL_PROMOTE_SURFACE_IDENTITY',
                              identity: {
                                source: 'myplace',
                                username: currentUsername,
                                handle: currentUsername,
                                displayName: profile.displayName,
                                archetype: npc?.archetype,
                                createdDay: time.day,
                              },
                              silent: true,
                            });
                            if (res.success) {
                              const data = res.data as {
                                buddy?: { displayName?: string };
                                created?: boolean;
                              } | undefined;
                              const name = data?.buddy?.displayName ?? profile.displayName;
                              setFriendNotice(data?.created === false
                                ? `${name} is already in your Pulse contacts.`
                                : `${name} added! Say hi on Pulse.`);
                              soundManager.play('invite');
                            } else {
                              setFriendNotice(res.error ?? 'Could not add friend.');
                            }
                          } catch (err) {
                            setFriendNotice((err as Error).message);
                          }
                          window.setTimeout(() => setFriendNotice(null), 3000);
                        }}
                        className="w-full bg-[#fef3c7] hover:bg-[#fde68a] border border-[#fcd34d] text-[#92400e] font-bold py-1 text-xs"
                      >
                        + Add to Friends
                      </button>
                      {friendNotice && (
                        <div className="text-[11px] text-center text-[#1e3a8a] bg-blue-50 border border-blue-200 py-1">{friendNotice}</div>
                      )}
                    </>
                  );
                })()}
                <div className="grid grid-cols-2 gap-1 pt-1">
                  <a className="text-[11px] text-blue-700 hover:underline" href="#" onClick={(e) => e.preventDefault()}>Forward to Friend</a>
                  <a className="text-[11px] text-blue-700 hover:underline" href="#" onClick={(e) => e.preventDefault()}>Add to Favorites</a>
                  <a className="text-[11px] text-blue-700 hover:underline" href="#" onClick={(e) => e.preventDefault()}>Block User</a>
                  <a className="text-[11px] text-blue-700 hover:underline" href="#" onClick={(e) => e.preventDefault()}>Report</a>
                </div>
              </div>
            </div>

            {/* My URL */}
            <div className="border border-gray-400">
              <div className="bg-[#e5eaf6] border-b border-gray-400 px-2 py-1 font-bold text-[#003399] text-xs">MyPlace URL</div>
              <div className="p-2 text-[11px] font-mono bg-white">http://myplace.local/{profile.username}</div>
            </div>

            {/* Interests — stripped in 1.0: only General, no Music */}
            <div className="border border-gray-400">
              <div className="bg-[#e5eaf6] border-b border-gray-400 px-2 py-1 font-bold text-[#003399] text-xs">Interests</div>
              <div className="p-2">
                <div className="text-[11px] font-bold text-gray-700">General</div>
                <div className="text-[11px] text-gray-800 leading-tight">{profile.interests.join(', ')}</div>
                {!isV1 && (
                  <>
                    <div className="mt-2 text-[11px] font-bold text-gray-700">Music</div>
                    <div className="text-[11px] text-gray-800 flex items-center gap-1">
                      <span>♫ {profile.songTitle}</span>
                      {features.profileMusic && <button onClick={() => soundManager.play('im_recv')} className="ml-auto px-1.5 py-0.5 bg-[#e0e7ff] border border-gray-300 rounded text-[10px]">▶ Play</button>}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Profile views */}
            <div className="border border-gray-400 p-2 text-[11px] bg-[#f9fafb]">
              <div><b>Last Login:</b> {lastLogin}</div>
              <div><b>Views:</b> {views.toLocaleString()}</div>
            </div>

            {/* Edit own profile */}
            {isOwnProfile && (
              <div className="border border-blue-300 bg-blue-50 p-2">
                {!editMode ? (
                  <button onClick={() => { setEditMode(true); setEditHeadline(profile.headline); setEditBio(profile.bio); setEditInterests(profile.interests.join(', ')); setEditSong(profile.songTitle); setGlitter(profile.glitterIntensity); setEditTiledBackground(profile.tiledBackground); }} className="w-full bg-white hover:bg-gray-50 border border-gray-400 py-1 text-xs font-bold">Edit Profile</button>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase">Headline<input value={editHeadline} onChange={(e) => setEditHeadline(e.target.value)} className="w-full mt-1 p-1 border border-gray-400 text-xs" /></label>
                    <label className="block text-[10px] font-bold uppercase">Bio<textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} className="w-full mt-1 p-1 border border-gray-400 text-xs" /></label>
                    <label className="block text-[10px] font-bold uppercase">Interests<input value={editInterests} onChange={(e) => setEditInterests(e.target.value)} className="w-full mt-1 p-1 border border-gray-400 text-xs" /></label>
                    <label className="block text-[10px] font-bold uppercase">Song<input value={editSong} onChange={(e) => setEditSong(e.target.value)} className="w-full mt-1 p-1 border border-gray-400 text-xs" /></label>
                    {features.glitter && <label className="block text-[10px] font-bold uppercase">Glitter {glitter}<input type="range" min={0} max={5} value={glitter} onChange={(e) => setGlitter(parseInt(e.target.value, 10))} className="w-full" /></label>}
                    {features.tiler && <label className="block text-[10px] font-bold uppercase">Tiled BG<select value={editTiledBackground ?? ''} onChange={(e) => setEditTiledBackground(e.target.value || undefined)} className="w-full mt-1 p-1 border border-gray-400 text-xs"><option value="">None</option><option value="stars">Stars</option><option value="hearts">Hearts</option></select></label>}
                    <div className="flex gap-1">
                      <button onClick={handleSaveProfile} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 rounded text-xs">Save</button>
                      <button onClick={() => setEditMode(false)} className="flex-1 bg-white border border-gray-400 py-1 text-xs">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column — network, blurbs, friends, comments */}
          <div className="p-3 space-y-3 bg-white">
            {/* Network header */}
            <div className="border border-gray-400">
              <div className="bg-[#ffcc99] border-b border-gray-400 px-2 py-1 font-bold text-sm">Maya is in your extended network</div>
              <div className="p-2 text-[11px] text-gray-700 flex items-center justify-between">
                <span>{profile.displayName}'s Friend Space</span>
                <span className="text-gray-500">[view all]</span>
              </div>
            </div>

            {/* About / Blurbs — MySpace style */}
            <div className="border border-gray-400">
              <div className="bg-[#e5eaf6] px-2 py-1 font-bold text-[#003399] text-xs">About me</div>
              <div className="p-3 text-xs leading-relaxed whitespace-pre-wrap">{profile.bio}</div>
              <div className="px-3 pb-2 text-[11px] text-gray-500">Mood: hopeful • Headline: {profile.headline}</div>
              {features.glitter && userProfile.glitterIntensity > 2 && <div className="px-3 pb-2 text-[10px] text-yellow-600">✨ Glitter {userProfile.glitterIntensity}/5</div>}
            </div>

            {/* Top 8 — hidden entirely in 1.0 Stripped */}
            {isV1 ? (
              <div className="border border-dashed border-gray-300 p-2 text-[11px] text-gray-500 italic bg-white">Friends list coming in MyPlace 2.0 — check back Day 3.</div>
            ) : features.top8 ? (
              <div className="border border-gray-400">
                <div className="bg-[#e5eaf6] px-2 py-1 font-bold text-[#003399] text-xs flex justify-between"><span>{profile.displayName}'s Friends ({profile.top8.length})</span><span className="font-normal text-gray-600">Top 8</span></div>
                <div className="grid grid-cols-4 gap-0 border-t border-gray-400">
                  {profile.top8.map((fr, idx) => (
                    <div key={idx} onClick={() => doNavigate(`myplace.local/${fr.handle}`)} className="border-r border-b border-gray-300 p-2 text-center hover:bg-blue-50 cursor-pointer">
                      <div className="w-full aspect-square bg-gray-100 border border-gray-300 flex items-center justify-center text-2xl">{fr.avatar}</div>
                      <div className="text-[11px] font-bold text-blue-700 truncate mt-1">{fr.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">{fr.handle}</div>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 8 - profile.top8.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="border-r border-b border-gray-300 p-2 text-center bg-gray-50 text-gray-400 text-[11px] flex items-center justify-center h-[110px]">Empty</div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Comments / Guestbook */}
            <div className="border border-gray-400">
              <div className="bg-[#e5eaf6] px-2 py-1 font-bold text-[#003399] text-xs flex justify-between"><span>Friends' Comments</span><span className="font-normal text-gray-600">Displaying {guestbook.length} of {guestbook.length}</span></div>
              <div className="p-2 bg-[#f9fafb] border-b border-gray-300">
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Leave a comment..." className="flex-1 px-2 py-1 border border-gray-400 bg-white text-xs outline-none" />
                  <button type="submit" className="px-3 py-1 bg-[#3b5998] hover:bg-[#2d4373] text-white font-bold rounded text-xs">Post</button>
                </form>
              </div>
              <div className="divide-y divide-gray-300">
                {guestbook.map((cm, i) => (
                  <div key={i} className="p-2 flex gap-2 bg-white">
                    <div className="w-28 shrink-0">
                      <div className="font-bold text-blue-700 text-xs truncate">{cm.author}</div>
                      <div className="text-[10px] text-gray-500">{cm.date}</div>
                    </div>
                    <div className="flex-1 text-xs text-gray-800">{cm.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#e5eaf6] border-t border-gray-400 px-2 py-1 text-[10px] text-gray-500 flex justify-between">
          <span>MyPlace {currentRelease.version} • Build {currentRelease.build} • Day {currentRelease.releaseDay} • {currentRelease.changelog.join(' • ')}</span>
          <span className="font-mono">myplace.local/{currentUsername}</span>
        </div>
      </div>
    </div>
  );
};