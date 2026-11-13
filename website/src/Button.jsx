import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';

// shadcn/ui Button composition with Kafene's variants.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4',
  {
    variants: {
      variant: {
        default: 'bg-[#513124] text-[#fff9ef] hover:bg-[#704836]',
        outline: 'border border-[#cfc0ae] text-[#513124] hover:bg-[#f0e7db]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export function Button({ asChild, variant, className, ...props }) {
  const Component = asChild ? Slot : 'button';
  return <Component className={buttonVariants({ variant, className })} {...props} />;
}
