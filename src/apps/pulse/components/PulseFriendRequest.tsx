import React from 'react';

interface PulseFriendRequestProps {
  onAccept: () => void;
  onIgnore: () => void;
  onClose: () => void;
}

export const PulseFriendRequest: React.FC<PulseFriendRequestProps> = ({ onAccept, onIgnore, onClose }) => (
  <div className="absolute left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 border-2 border-[#38516e] bg-[#edf2f8] font-sans text-xs text-[#18283b] shadow-[7px_7px_0_rgba(15,35,60,0.3)]">
    <div className="flex items-center justify-between bg-gradient-to-r from-[#27456d] to-[#7099be] px-2 py-1 text-white">
      <span className="font-bold">New Friend Request</span>
      <button onClick={onClose} className="h-4 w-4 border border-white/70 text-[10px] leading-3 hover:bg-white/20">×</button>
    </div>
    <div className="flex gap-3 bg-white p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-[#7088a2] bg-gradient-to-br from-[#d78b57] to-[#753f2f] text-xl font-bold text-white">W</div>
      <div>
        <div className="font-bold text-[#183b61]">webmaster_2006</div>
        <div className="text-[11px] text-gray-600">The Local Web Ring</div>
        <p className="mt-2 leading-5 text-gray-700">“saw your page in FindIt. add me? i know where the good guestbooks are.”</p>
      </div>
    </div>
    <div className="flex items-center justify-end gap-2 border-t border-[#a8b7c7] bg-[#dbe5ef] px-3 py-2">
      <button onClick={onIgnore} className="border border-gray-500 bg-white px-3 py-1 hover:bg-gray-100">Ignore</button>
      <button onClick={onAccept} className="border border-[#3d5874] bg-[#d9e9f7] px-3 py-1 font-bold hover:bg-[#c6def1]">Accept Request</button>
    </div>
  </div>
);
