import type { PcBootState } from '../engine/SimulationEngine';

export type RoomDeskPresentation = 'empty' | 'package' | 'assembled_off' | 'assembled_on';

export function getRoomDeskPresentation(state: PcBootState): RoomDeskPresentation {
  switch (state) {
    case 'no_computer':
      return 'empty';
    case 'awaiting_setup':
      return 'package';
    case 'powered_off':
      return 'assembled_off';
    case 'no_boot_device':
    case 'desktop':
      return 'assembled_on';
  }
}
