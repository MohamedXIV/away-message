import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { db } from '../src/persistence/db';

beforeEach(async () => {
  // Clear fake-indexeddb tables before every unit/integration test for complete test isolation
  try {
    if (db) {
      await db.saves?.clear();
      await db.vfs_files?.clear();
      await db.downloads?.clear();
      await db.installed_software?.clear();
      await db.messages?.clear();
      await db.relationships?.clear();
      await db.narrative_state?.clear();
      await db.telemetry_logs?.clear();
      await db.ai_cache?.clear();
    }
  } catch {
    // Graceful fallback if tables are not initialized
  }
});
