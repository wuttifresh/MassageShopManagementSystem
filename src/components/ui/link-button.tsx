import Link, { type LinkProps } from "next/link";
import { buttonVariants, type ButtonVariant, type ButtonSize } from "./button";

export function LinkButton({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
  ...props
}: LinkProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link className={buttonVariants({ variant, size, fullWidth, className })} {...props}>
      {children}
    </Link>
  );
}
