import { getReleaseById } from '../../engine/OsCatalog';
import type { OsVersion } from '../../engine/types';

/**
 * The release's real owner-side identity chooses a presentation-only installer
 * skin. DOS, disks, clock and eligibility remain single-Worker domain truths.
 */
export interface OrionInstallerPresentation {
  edition: 'orion48' | 'orion50' | 'orion60' | 'orion70';
  heading: string;
  subtitle: string;
  frameClass: string;
  titleClass: string;
  buttonClass: string;
  stages: readonly [string, string, string, string];
}
const INSTALLERS: Record<OrionInstallerPresentation['edition'], OrionInstallerPresentation> = {
  orion48: {
    edition: 'orion48', heading: 'Orion 4.8 Text-Mode Setup', subtitle: 'Blue-screen setup · keyboard era',
    frameClass: 'bg-[#000080] text-white font-mono border-[6px] border-[#aaa] rounded-none',
    titleClass: 'bg-[#c0c0c0] text-[#000080] px-3 py-2 font-bold',
    buttonClass: 'bg-[#bcbcbc] text-[#000080] border border-white px-4 py-2 font-bold',
    stages: ['Welcome to Setup', 'License and destination', 'Storage and media check', 'Begin file copying'],
  },
  orion50: {
    edition: 'orion50', heading: 'Orion 5.0 Setup', subtitle: 'Aperture · classic graphical installer',
    frameClass: 'bg-[#ddd7c9] text-[#213047] font-sans border-[5px] border-[#677a8e] rounded-sm',
    titleClass: 'bg-[#38617e] text-white px-3 py-3 font-bold',
    buttonClass: 'bg-[#f4f1ea] text-[#20364d] border border-[#627b8d] px-4 py-2 font-bold',
    stages: ['Welcome to Aperture', 'Review agreement', 'Choose system drive', 'Install Orion 5.0'],
  },
  orion60: {
    edition: 'orion60', heading: 'Orion 6.0 Setup', subtitle: 'Canal · guided installation',
    frameClass: 'bg-gradient-to-br from-[#d5eaf7] to-[#ecf7e7] text-[#143452] font-sans border-[5px] border-[#2467ac] rounded-lg',
    titleClass: 'bg-gradient-to-r from-[#2359b8] to-[#50a478] text-white px-4 py-3 font-bold',
    buttonClass: 'bg-white text-[#24589a] border-2 border-[#6aa0d2] px-4 py-2 font-bold rounded',
    stages: ['Welcome to Canal', 'Installation choices', 'Disk and compatibility', 'Ready to install'],
  },
  orion70: {
    edition: 'orion70', heading: 'Orion 7.0 Setup', subtitle: 'Lumen Gloss · system installation',
    frameClass: 'bg-gradient-to-br from-[#202735] to-[#080d17] text-[#edf5ff] font-sans border border-[#658aab] rounded-xl shadow-2xl',
    titleClass: 'bg-gradient-to-r from-[#344b76] to-[#005d70] text-[#efffff] px-5 py-4 font-semibold',
    buttonClass: 'bg-gradient-to-b from-[#cde4fa] to-[#8cb5df] text-[#12283b] border border-[#e9f6ff] px-4 py-2 font-semibold rounded-lg',
    stages: ['Welcome to Lumen', 'Accept and customize', 'Verify your computer', 'Confirm installation'],
  },
};

export function getOrionInstallerPresentation(osId: OsVersion): OrionInstallerPresentation {
  const release = getReleaseById(osId);
  if (!release) throw new Error('Unknown verified installer release: ' + osId);
  return INSTALLERS[release.theme];
}
