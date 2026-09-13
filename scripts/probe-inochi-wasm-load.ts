#!/usr/bin/env -S npx tsx
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  bootstrapInochiWebModule,
  type InochiWebBootstrapExports,
  type InochiWebScratchpad,
} from '../src/tooling/away-puppet/InochiWebModuleBootstrap';

const PINNED_UPSTREAM_COMMIT = 'ec702261dd6428141bfd0b174a015f8af872d3ed';
const PINNED_ARTIFACT_DIGEST = '59b0c88dafb93be310c2a0f965ab07f2a50fc675b241bb521065d64db648a178';
const PINNED_WASM_SHA256 = '49dd528af9e58341513f363ca5b0639da80a20f1c6f1a95f47c0c67da788dd0a';
const UPSTREAM_EMPTY08_SHA256 = 'b56a0377034fed6bf658820b1a009252605c1c47ffbb58168d011dc129d330fd';
const EMPTY08_LABEL = 'Inochi2D/inochi2d examples/empty08.inx';
const EMPTY08_BASE64 = `VFJOU1JUUwAAAAKmeyJtZXRhIjp7Im5hbWUiOiJUZXN0IFB1cHBldCIsInZl
cnNpb24iOiJ2MC44LjYiLCJyaWdnZXIiOiIiLCJhcnRpc3QiOiJJbm9jaGky
RCBQcm9qZWN0IiwicmlnaHRzIjpudWxsLCJjb3B5cmlnaHQiOiIiLCJsaWNl
bnNlVVJMIjoiIiwiY29udGFjdCI6IiIsInJlZmVyZW5jZSI6IiIsInRodW1i
bmFpbElkIjo0Mjk0OTY3Mjk1LCJwcmVzZXJ2ZVBpeGVscyI6ZmFsc2V9LCJw
aHlzaWNzIjp7InBpeGVsc1Blck1ldGVyIjoxMDAwLjAsImdyYXZpdHkiOjku
OH0sIm5vZGVzIjp7InV1aWQiOjM3NjA0Nzk3MjEsIm5hbWUiOiJSb290Iiwi
dHlwZSI6Ik5vZGUiLCJlbmFibGVkIjp0cnVlLCJ6c29ydCI6MC4wLCJ0cmFu
c2Zvcm0iOnsidHJhbnMiOlswLjAsMC4wLDAuMF0sInJvdCI6WzAuMCwwLjAs
MC4wXSwic2NhbGUiOlsxLjAsMS4wXX0sImxvY2tUb1Jvb3QiOmZhbHNlLCJj
aGlsZHJlbiI6W3sidXVpZCI6MTg3MjM3Mjk5LCJuYW1lIjoiTm9kZSIsInR5
cGUiOiJOb2RlIiwiZW5hYmxlZCI6dHJ1ZSwienNvcnQiOjAuMCwidHJhbnNm
b3JtIjp7InRyYW5zIjpbMC4wLDAuMCwwLjBdLCJyb3QiOlswLjAsMC4wLDAu
MF0sInNjYWxlIjpbMS4wLDEuMF19LCJsb2NrVG9Sb290IjpmYWxzZX1dfSwi
cGFyYW0iOm51bGwsImF1dG9tYXRpb24iOm51bGwsImFuaW1hdGlvbnMiOm51
bGwsImdyb3VwcyI6W119VEVYX1NFQ1QAAAAA`;

interface AllocatingWasmApi {
  nu_malloc(size: number): number | bigint;
}

interface LoadReadyWasmApi extends AllocatingWasmApi, InochiWebBootstrapExports {}

interface InochiWasmExports extends LoadReadyWasmApi {
  memory: WebAssembly.Memory;
  nu_free(ptr: number): void;
  in_puppet_load_from_memory(data: number, length: number, ioSink: number): number | bigint;
  in_puppet_free(ptr: number): void;
}

export interface BootstrappedPuppetInput {
  readonly sourcePointer: number;
  readonly scratchpad: InochiWebScratchpad;
}

export interface ProbeFixture {
  readonly path: string | undefined;
  readonly label: string;
}

export function allocatePuppetInputOrThrow(api: AllocatingWasmApi, byteLength: number): number {
  const pointer = Number(api.nu_malloc(byteLength));
  if (!Number.isSafeInteger(pointer) || pointer <= 0) {
    throw new Error(
      `Inochi WASM allocator refused ${byteLength} bytes; refusing to write puppet input at address 0 or grow exported memory manually`,
    );
  }
  return pointer;
}

export function assertAcceptedWasmHash(actualHash: string, allowCandidate: boolean): void {
  if (!allowCandidate && actualHash !== PINNED_WASM_SHA256) {
    throw new Error(
      `unexpected wasm sha256 ${actualHash}; expected ${PINNED_WASM_SHA256} from ${PINNED_UPSTREAM_COMMIT}`,
    );
  }
}

export function resolveProbeFixture(args: readonly string[]): ProbeFixture {
  const fixtureFlagIndex = args.indexOf('--fixture');
  if (fixtureFlagIndex < 0) return { path: undefined, label: EMPTY08_LABEL };
  const fixturePath = args[fixtureFlagIndex + 1];
  if (!fixturePath || fixturePath.startsWith('--')) {
    throw new Error('--fixture requires a puppet file path');
  }
  return { path: fixturePath, label: fixturePath };
}

/**
 * Applies the corrected two-phase Web bootstrap before asking the allocator for
 * puppet input storage. Keeping both operations in one helper makes it harder
 * for future probes/loaders to accidentally regress to upstream's broken
 * one-phase scratchpad initialization order.
 */
export function bootstrapAndAllocatePuppetInput(
  api: LoadReadyWasmApi,
  byteLength: number,
): BootstrappedPuppetInput {
  const { scratchpad } = bootstrapInochiWebModule(api);
  return {
    sourcePointer: allocatePuppetInputOrThrow(api, byteLength),
    scratchpad,
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function wasiImports(): WebAssembly.Imports {
  const ok = (): number => 0;
  return {
    wasi_snapshot_preview1: {
      fd_close: ok,
      fd_fdstat_get: ok,
      fd_fdstat_set_flags: ok,
      fd_prestat_get: ok,
      fd_prestat_dir_name: ok,
      fd_read: ok,
      fd_seek: ok,
      fd_write: ok,
      path_open: ok,
      proc_exit: ok,
    },
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const wasmPath = args[0];
  const expectBlocked = args.includes('--expect-blocked');
  const allowCandidate = args.includes('--allow-candidate-wasm');
  if (!wasmPath || wasmPath.startsWith('--')) {
    throw new Error(
      'usage: npx tsx scripts/probe-inochi-wasm-load.ts <inochi2d.wasm> [--fixture <puppet.inx>] [--expect-blocked] [--allow-candidate-wasm]',
    );
  }

  const fixture = resolveProbeFixture(args);
  const wasm = await readFile(wasmPath);
  const wasmHash = sha256(wasm);
  assertAcceptedWasmHash(wasmHash, allowCandidate);

  const puppetBytes = fixture.path
    ? await readFile(fixture.path)
    : Buffer.from(EMPTY08_BASE64.replace(/\s+/g, ''), 'base64');
  const puppetHash = sha256(puppetBytes);
  if (!fixture.path && puppetHash !== UPSTREAM_EMPTY08_SHA256) {
    throw new Error('embedded upstream empty08.inx fixture digest mismatch');
  }

  const { instance } = await WebAssembly.instantiate(wasm, wasiImports());
  const api = instance.exports as unknown as InochiWasmExports;

  const baseEvidence = {
    upstreamCommit: PINNED_UPSTREAM_COMMIT,
    artifactDigest: allowCandidate ? undefined : `sha256:${PINNED_ARTIFACT_DIGEST}`,
    candidateWasm: allowCandidate,
    wasmSha256: wasmHash,
    fixture: fixture.label,
    fixtureSha256: puppetHash,
    fixtureBytes: puppetBytes.byteLength,
  };

  let sourcePtr: number;
  let scratchpad: InochiWebScratchpad;
  try {
    const prepared = bootstrapAndAllocatePuppetInput(api, puppetBytes.byteLength);
    sourcePtr = prepared.sourcePointer;
    scratchpad = prepared.scratchpad;
  } catch (error) {
    console.log(JSON.stringify({
      ...baseEvidence,
      blockedAt: 'bootstrap-or-input-allocation',
      requestedBytes: puppetBytes.byteLength,
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    if (expectBlocked) return;
    throw error;
  }

  let puppetPtr = 0;
  try {
    new Uint8Array(api.memory.buffer, sourcePtr, puppetBytes.byteLength).set(puppetBytes);
    puppetPtr = Number(api.in_puppet_load_from_memory(sourcePtr, puppetBytes.byteLength, 0));
  } finally {
    api.nu_free(sourcePtr);
  }

  console.log(JSON.stringify({ ...baseEvidence, scratchpad, puppetPtr }, null, 2));

  if (puppetPtr) {
    api.in_puppet_free(puppetPtr);
    if (expectBlocked) {
      throw new Error('upstream WASM load unexpectedly succeeded; re-evaluate the documented blocker');
    }
    return;
  }

  if (expectBlocked) return;
  throw new Error(`upstream WASM in_puppet_load_from_memory returned null for ${fixture.label}`);
}

const argvEntry = process.argv[1];
if (argvEntry && import.meta.url === pathToFileURL(argvEntry).href) {
  await main();
}
