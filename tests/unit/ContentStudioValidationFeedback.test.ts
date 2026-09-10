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
});
