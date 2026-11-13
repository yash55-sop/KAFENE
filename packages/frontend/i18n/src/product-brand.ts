// The Kafene desktop shell serves the shared web bundle on this fixed origin.
export const isKafeneDesktop =
  globalThis.location?.origin === 'http://127.0.0.1:49327';

export const productName = isKafeneDesktop ? 'Kafene' : 'AFFiNE';
export const kafeneIcon = '/imgs/kafene.svg';
