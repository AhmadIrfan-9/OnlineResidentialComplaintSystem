/** Validates room labels in the format C[1-3]-[01-10]-[01-08], e.g. "C1-04-02" */
export const ROOM_LABEL_RE = /^C[1-3]-(?:0[1-9]|10)-0[1-8]$/;
