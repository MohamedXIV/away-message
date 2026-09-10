import React from 'react';
import { getFieldErrors, getRowErrors } from '../validationFeedback';

interface FieldErrorDisplayProps {
  errors?: string[];
  allErrors?: readonly string[];
  table?: string;
  rowId?: string;
  field?: string;
}

export const FieldErrorDisplay: React.FC<FieldErrorDisplayProps> = ({
  errors: directErrors,
  allErrors,
  table,
  rowId,
  field,
}) => {
  const errors =
    directErrors ??
    (allErrors && table && rowId && field
      ? getFieldErrors(allErrors, table, rowId, field)
      : []);

  if (!errors || errors.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5" role="alert">
      {errors.map((err, idx) => (
        <div key={idx} className="text-[11px] font-medium text-red-400 flex items-center gap-1.5">
          <span className="text-red-500 font-bold">⚠</span>
          <span>{err}</span>
        </div>
      ))}
    </div>
  );
};

interface RowErrorBannerProps {
  allErrors: readonly string[];
  table: string;
  rowId: string;
}

export const RowErrorBanner: React.FC<RowErrorBannerProps> = ({ allErrors, table, rowId }) => {
  const errors = getRowErrors(allErrors, table, rowId);
  if (!errors || errors.length === 0) return null;

  return (
    <div className="rounded border border-red-800/80 bg-red-950/40 p-3 space-y-1" role="alert">
      <div className="text-xs font-bold text-red-300 flex items-center gap-1.5">
        <span className="text-red-400 font-bold">!</span>
        <span>Validation issues on this record ({errors.length}):</span>
      </div>
      <ul className="list-disc list-inside text-xs text-red-300/90 font-mono space-y-0.5 pl-1">
        {errors.map((err, idx) => (
          <li key={idx} className="truncate">
            {err}
          </li>
        ))}
      </ul>
    </div>
  );
};
