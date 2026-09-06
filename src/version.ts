// Single source of truth for the game version (mirrors package.json).
// Bump only on release batches, never per feature — see CHANGELOG.md.
import { version } from '../package.json';

export const APP_VERSION: string = version;
