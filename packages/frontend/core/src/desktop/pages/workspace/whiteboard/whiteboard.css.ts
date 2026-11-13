import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const title = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  fontWeight: 500,
});
export const status = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  selectors: { '&[data-error="true"]': { color: '#d65a5a' } },
});
export const board = style({
  display: 'block',
  width: '100%',
  height: '100%',
  minHeight: 0,
  flex: 1,
  border: 0,
  background: 'transparent',
  position: 'relative',
  overflow: 'hidden',
});
export const list = style({
  padding: '24px clamp(16px, 5vw, 64px)',
  overflow: 'auto',
  height: '100%',
  maxWidth: 1000,
  margin: '0 auto',
  width: '100%',
});
export const rows = style({ marginTop: 24 });
export const row = style({
  display: 'flex',
  alignItems: 'center',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  padding: '8px 0',
  gap: 8,
});
export const openBoard = style({
  flex: 1,
  justifyContent: 'flex-start',
  minWidth: 0,
  gap: 12,
});
export const hint = style({
  fontSize: 12,
  color: cssVarV2('text/secondary'),
  marginTop: 24,
});
export const actions = style({ display: 'flex', alignItems: 'center', gap: 8 });
export const message = style({
  padding: 24,
  margin: 'auto',
  textAlign: 'center',
});
export const nameInput = style({
  border: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  width: 'min(30vw, 360px)',
  minWidth: 100,
  padding: '4px 8px',
  borderRadius: 4,
});
