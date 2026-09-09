import { describe, expect, it } from 'vitest';
import { resolveHostNetworkState } from '../../src/desktop/host/OsHostContext';

describe('OsHost network state', () => {
  it('reports offline without a usable physical + OS environment', () => {
    expect(
      resolveHostNetworkState({
        computerAssembled: false,
        computerPoweredOn: false,
        activeOs: null,
        connectionType: null,
        connectionSpeedKbps: 0,
      }),
    ).toEqual({ status: 'offline', effectiveKbps: 0 });

    expect(
      resolveHostNetworkState({
        computerAssembled: true,
        computerPoweredOn: false,
        activeOs: 'Orion_6.0',
        connectionType: 'dsl_256k',
        connectionSpeedKbps: 256,
      }),
    ).toEqual({ status: 'offline', effectiveKbps: 0 });

    expect(
      resolveHostNetworkState({
        computerAssembled: true,
        computerPoweredOn: true,
        activeOs: null,
        connectionType: 'dsl_256k',
        connectionSpeedKbps: 256,
      }),
    ).toEqual({ status: 'offline', effectiveKbps: 0 });
  });

  it('reports connected with effective speed from the installed network hardware', () => {
    expect(
      resolveHostNetworkState({
        computerAssembled: true,
        computerPoweredOn: true,
        activeOs: 'Orion_4.8',
        connectionType: 'dialup_56k',
        connectionSpeedKbps: 56,
      }),
    ).toEqual({ status: 'connected', effectiveKbps: 56 });

    expect(
      resolveHostNetworkState({
        computerAssembled: true,
        computerPoweredOn: true,
        activeOs: 'Orion_7.0',
        connectionType: 'dsl_512k',
        connectionSpeedKbps: 512,
      }),
    ).toEqual({ status: 'connected', effectiveKbps: 512 });
  });
});
