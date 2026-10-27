import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Compiler } from 'inkjs/compiler/Compiler';
import { SimpleJson } from 'inkjs/engine/SimpleJson';
import { Story } from 'inkjs/engine/Story';

const dialogueFlows = [
  'pulse-nearby', 'pulse-remote', 'pulse-night', 'pulse-shift',
  'pulse-trusted', 'pulse-repair', 'pulse-reminisce',
  'pulse-followup-personal', 'pulse-followup-topic', 'pulse-followup-courtesy',
  'pulse-outreach-reply',
  'pulse-outreach-news-reply',
] as const;

describe('#223 authored contextual Ink consistency', () => {
  for (const slug of dialogueFlows) {
    it(`compiles ${slug} deterministically with source and generated JSON identical`, () => {
      const sourcePath = new URL(`../../src/narrative/ink/flows/${slug}.ink`, import.meta.url);
      const ink = readFileSync(fileURLToPath(sourcePath), 'utf8');
      const generated = JSON.parse(readFileSync(fileURLToPath(new URL(`${slug}.ink.json`, sourcePath)), 'utf8'));
      const compiler = new Compiler(ink);
      const story = compiler.Compile();
      expect(compiler.errors).toEqual([]);
      const writer = new SimpleJson.Writer();
      story.ToJson(writer);
      expect(JSON.parse(writer.toString())).toEqual(generated);
      // A generated JSON that parses is insufficient: the runtime must have
      // playable authored choices rather than a stale-but-valid dead branch.
      expect(() => new Story(generated)).not.toThrow();
    });
  }
});
