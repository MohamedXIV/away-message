#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const PINNED_UPSTREAM_COMMIT = 'ec702261dd6428141bfd0b174a015f8af872d3ed';
const PINNED_ARTIFACT_DIGEST = '59b0c88dafb93be310c2a0f965ab07f2a50fc675b241bb521065d64db648a178';
const PINNED_WASM_SHA256 = '49dd528af9e58341513f363ca5b0639da80a20f1c6f1a95f47c0c67da788dd0a';
const UPSTREAM_EMPTY08_SHA256 = 'b56a0377034fed6bf658820b1a009252605c1c47ffbb58168d011dc129d330fd';
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

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function wasiImports() {
  const ok = () => 0;
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

async function main() {
  const [wasmPath, expectation] = process.argv.slice(2);
  if (!wasmPath) {
    throw new Error(
      'usage: node scripts/probe-inochi-wasm-load.mjs <inochi2d.wasm> [--expect-blocked]',
    );
  }

  const wasm = await readFile(wasmPath);
  const wasmHash = sha256(wasm);
  if (wasmHash !== PINNED_WASM_SHA256) {
    throw new Error(
      `unexpected wasm sha256 ${wasmHash}; expected ${PINNED_WASM_SHA256} from ${PINNED_UPSTREAM_COMMIT}`,
    );
  }

  const puppetBytes = Buffer.from(EMPTY08_BASE64.replace(/\s+/g, ''), 'base64');
  if (sha256(puppetBytes) !== UPSTREAM_EMPTY08_SHA256) {
    throw new Error('embedded upstream empty08.inx fixture digest mismatch');
  }

  const { instance } = await WebAssembly.instantiate(wasm, wasiImports());
  const api = instance.exports;
  api.in_init();

  const sourcePtr = api.nu_malloc(puppetBytes.byteLength);
  new Uint8Array(api.memory.buffer, sourcePtr, puppetBytes.byteLength).set(puppetBytes);
  const puppetPtr = api.in_puppet_load_from_memory(sourcePtr, puppetBytes.byteLength, 0);
  api.nu_free(sourcePtr);

  const evidence = {
    upstreamCommit: PINNED_UPSTREAM_COMMIT,
    artifactDigest: `sha256:${PINNED_ARTIFACT_DIGEST}`,
    wasmSha256: wasmHash,
    fixture: 'Inochi2D/inochi2d examples/empty08.inx',
    fixtureSha256: UPSTREAM_EMPTY08_SHA256,
    puppetPtr: Number(puppetPtr),
  };
  console.log(JSON.stringify(evidence, null, 2));

  if (puppetPtr) {
    api.in_puppet_free(puppetPtr);
    if (expectation === '--expect-blocked') {
      throw new Error('upstream WASM load unexpectedly succeeded; re-evaluate the documented blocker');
    }
    return;
  }

  if (expectation === '--expect-blocked') return;
  throw new Error('upstream WASM in_puppet_load_from_memory returned null for its own empty08 fixture');
}

await main();
