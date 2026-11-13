import { isKafeneDesktop, kafeneIcon, productName } from '@affine/i18n';

if (isKafeneDesktop) {
  document.title = productName;
  document.head
    .querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    )
    .forEach(link => link.remove());

  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.type = 'image/svg+xml';
  icon.href = kafeneIcon;
  document.head.append(icon);

  const manifest = document.head.querySelector<HTMLLinkElement>(
    'link[rel="manifest"]'
  );
  if (manifest) manifest.href = '/kafene.webmanifest';
}
