export interface FieldError {
  table: string;
  rowId?: string;
  field?: string;
  index?: number;
  message: string;
  raw: string;
}

export function parseFieldError(error: string): FieldError {
  const colonIndex = error.indexOf(': ');
  const target = colonIndex === -1 ? error : error.slice(0, colonIndex);
  const message = colonIndex === -1 ? '' : error.slice(colonIndex + 2);

  const slashIndex = target.indexOf('/');
  if (slashIndex === -1) {
    return { table: target, message, raw: error };
  }

  const table = target.slice(0, slashIndex);
  const remainder = target.slice(slashIndex + 1);

  const dotIndex = remainder.indexOf('.');
  if (dotIndex === -1) {
    return { table, rowId: remainder, message, raw: error };
  }

  const rowId = remainder.slice(0, dotIndex);
  let field = remainder.slice(dotIndex + 1);
  let index: number | undefined;

  const bracketMatch = field.match(/^(.*?)\[(\d+)\](?:\.(.*))?$/);
  if (bracketMatch) {
    field = bracketMatch[1] + (bracketMatch[3] ? `.${bracketMatch[3]}` : '');
    index = Number(bracketMatch[2]);
  }

  return { table, rowId, field, index, message, raw: error };
}

export function getFieldErrors(
  allErrors: readonly string[],
  table: string,
  rowId: string,
  field?: string,
): string[] {
  return allErrors
    .map(parseFieldError)
    .filter(
      (e) =>
        e.table === table &&
        e.rowId === rowId &&
        (!field || e.field === field || e.field?.startsWith(`${field}.`) || e.field?.startsWith(`${field}[`)),
    )
    .map((e) => e.message || e.raw);
}

export function getRowErrors(
  allErrors: readonly string[],
  table: string,
  rowId: string,
): string[] {
  return allErrors
    .map(parseFieldError)
    .filter((e) => e.table === table && e.rowId === rowId)
    .map((e) => e.message || e.raw);
}
