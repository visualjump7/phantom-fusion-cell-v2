import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[var(--tap-target-min)] w-full rounded-md border border-input bg-background px-3 py-2 text-[length:var(--font-size-body)] font-[var(--font-weight-body)] leading-[var(--line-height-body)] ring-offset-background file:border-0 file:bg-transparent file:text-[length:var(--font-size-body)] file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[var(--focus-ring-width)] focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
