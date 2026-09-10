import { describe, expect, it } from 'vitest';
import {
  parseFieldError,
  getFieldErrors,
  getRowErrors,
} from '../../src/tools/studio/validationFeedback';

describe('Content Studio validation feedback', () => {
  it('parses field-qualified error strings from codegen validation', () => {
    const error1 = "places/place_a1.districtId: unknown district 'missing_district'.";
    expect(parseFieldError(error1)).toEqual({
      table: 'places',
      rowId: 'place_a1',
      field: 'districtId',
      index: undefined,
      message: "unknown district 'missing_district'.",
      raw: error1,
    });

    const error2 = "busLines/line_ab.segmentMinutes[0]: must be a positive number of minutes.";
    expect(parseFieldError(error2)).toEqual({
      table: 'busLines',
      rowId: 'line_ab',
      field: 'segmentMinutes',
      index: 0,
      message: 'must be a positive number of minutes.',
      raw: error2,
    });

    const error3 = "characters/ryan: Character id 'ryan' is reserved.";
    expect(parseFieldError(error3)).toEqual({
      table: 'characters',
      rowId: 'ryan',
      field: undefined,
      index: undefined,
      message: "Character id 'ryan' is reserved.",
      raw: error3,
    });
  });

  it('filters errors by table, rowId, and field', () => {
    const allErrors = [
      "places/place_a1.districtId: unknown district 'bad'.",
      'places/place_a1.name: must be a non-empty string <= 60 chars.',
      "places/place_b1.districtId: unknown district 'bad2'.",
      "districts/district_a.name: must be a non-empty string <= 60 chars.",
    ];

    expect(getFieldErrors(allErrors, 'places', 'place_a1', 'districtId')).toEqual([
      "unknown district 'bad'.",
    ]);
    expect(getFieldErrors(allErrors, 'places', 'place_a1', 'name')).toEqual([
      'must be a non-empty string <= 60 chars.',
    ]);
    expect(getFieldErrors(allErrors, 'places', 'place_a1', 'transitAccess')).toEqual([]);
    expect(getRowErrors(allErrors, 'places', 'place_a1')).toEqual([
      "unknown district 'bad'.",
      'must be a non-empty string <= 60 chars.',
    ]);
  });

  it('resolves field aliases such as bus service windows and supports multi-field queries', () => {
    const allErrors = [
      'busLines/line_express.service: serviceEndMinute (300) must be after serviceStartMinute (360).',
      'busLines/line_express.headwayMinutes: must be a positive integer <= 240.',
    ];

    // Querying with serviceStartMinute should find the .service error via field alias mapping
    expect(getFieldErrors(allErrors, 'busLines', 'line_express', 'serviceStartMinute')).toEqual([
      'serviceEndMinute (300) must be after serviceStartMinute (360).',
    ]);
    expect(getFieldErrors(allErrors, 'busLines', 'line_express', 'serviceEndMinute')).toEqual([
      'serviceEndMinute (300) must be after serviceStartMinute (360).',
    ]);
    // Array of fields
    expect(getFieldErrors(allErrors, 'busLines', 'line_express', ['headwayMinutes', 'service'])).toHaveLength(2);
  });

  it('filters errors by specific array index when provided', () => {
    const allErrors = [
      'busLines/line_loop.segmentMinutes[0]: must be a positive number of minutes.',
      'busLines/line_loop.segmentMinutes[2]: must be a positive number of minutes.',
    ];

    expect(getFieldErrors(allErrors, 'busLines', 'line_loop', 'segmentMinutes', 0)).toEqual([
      'must be a positive number of minutes.',
    ]);
    expect(getFieldErrors(allErrors, 'busLines', 'line_loop', 'segmentMinutes', 1)).toEqual([]);
    expect(getFieldErrors(allErrors, 'busLines', 'line_loop', 'segmentMinutes', 2)).toEqual([
      'must be a positive number of minutes.',
    ]);
    // Without index, returns all errors for that field
    expect(getFieldErrors(allErrors, 'busLines', 'line_loop', 'segmentMinutes')).toHaveLength(2);
  });
});
