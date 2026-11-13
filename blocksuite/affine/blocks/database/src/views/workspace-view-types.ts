import { svg } from 'lit';

export const workspaceViews = [
  ['map', 'Map view', 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16'],
  [
    'vertical-bar',
    'Vertical bar chart',
    'M3 21v-9h4v9zm7 0V7h4v14zm7 0V3h4v18z',
  ],
  [
    'horizontal-bar',
    'Horizontal bar chart',
    'M3 3h15v4H3zm0 7h10v4H3zm0 7h18v4H3z',
  ],
  ['line', 'Line chart', 'M3 3v18h18M6 15l5-5 4 3 6-7'],
  [
    'donut',
    'Donut chart',
    'M11 3a9 9 0 1 0 10 10h-4a5 5 0 1 1-6-6zm3 0v7h7a9 9 0 0 0-7-7z',
  ],
  ['number', 'Number chart', 'M10 3L6 21M18 3l-4 18M4 9h17M2 15h17'],
  ['form', 'Form', 'M3 3h15v4H3zm0 7h18v4H3zm0 7h10v4H3z'],
  [
    'linked-source',
    'Linked view of data source',
    'M3 4h18v15H3zm0 5h18M3 14h9M10 4v15m4 2 7-7m-5 0h5v5',
  ],
] as const;

export const workspaceViewIcon = (path: string) => svg`
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true"><path d=${path} /></svg>
`;
