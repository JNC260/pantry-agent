import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "text" | "danger-text";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const base =
  "inline-flex items-center justify-center rounded-app text-[15px] font-medium leading-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

const variants: Record<Variant, string> = {
  primary:
    "px-5 py-3 bg-mulberry text-on-mulberry hover:bg-mulberry-deep",
  secondary:
    "px-5 py-3 border border-rosemary text-rosemary hover:bg-sage-wash",
  text: "text-sm text-walnut underline underline-offset-[3px] decoration-rule hover:text-rosemary hover:decoration-current",
  "danger-text":
    "text-sm text-walnut underline underline-offset-[3px] decoration-rule hover:text-paprika hover:decoration-current",
};

// For links that should look like buttons, so we don't nest <button> in <a>.
export function buttonClasses(variant: Variant = "primary") {
  return `${base} ${variants[variant]}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button className={`${buttonClasses(variant)} ${className}`} {...props} />
  );
}
