import { isKafeneDesktop, kafeneIcon } from '@affine/i18n';
import { Logo1Icon } from '@blocksuite/icons/rc';

export function ProductLogo({ className }: { className?: string }) {
  return isKafeneDesktop ? (
    <img
      className={className}
      src={kafeneIcon}
      alt=""
      style={{ width: '1em', height: '1em' }}
    />
  ) : (
    <Logo1Icon className={className} />
  );
}
