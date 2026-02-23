import * as React from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

// ── Password Strength Logic ──
export type PasswordStrength = "empty" | "weak" | "medium" | "strong";

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "empty";

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return "weak";
  if (score <= 3) return "medium";
  return "strong";
}

export function getStrengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case "weak": return "Fraca";
    case "medium": return "Média";
    case "strong": return "Forte";
    default: return "";
  }
}

export function getStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case "weak": return "bg-destructive";
    case "medium": return "bg-warning";
    case "strong": return "bg-success";
    default: return "bg-muted";
  }
}

// ── Password Strength Meter ──
interface PasswordStrengthMeterProps {
  strength: PasswordStrength;
}

export const PasswordStrengthMeter = ({ strength }: PasswordStrengthMeterProps) => {
  if (strength === "empty") return null;

  const segments = 3;
  const filledSegments = strength === "weak" ? 1 : strength === "medium" ? 2 : 3;
  const color = getStrengthColor(strength);
  const label = getStrengthLabel(strength);

  return (
    <div className="space-y-1.5 mt-2" role="status" aria-label={`Força da senha: ${label}`}>
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-500 ease-out",
              i < filledSegments ? color : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className={cn(
        "text-xs font-medium transition-colors duration-300",
        strength === "weak" && "text-destructive",
        strength === "medium" && "text-warning-foreground",
        strength === "strong" && "text-success",
      )}>
        {label}
      </p>
    </div>
  );
};

// ── Password Input ──
export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  showStrengthMeter?: boolean;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showStrengthMeter = false, value, onChange, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const internalValue = typeof value === "string" ? value : "";
    const strength = getPasswordStrength(internalValue);

    return (
      <div className="w-full">
        <div className="relative">
          <input
            ref={ref}
            type={visible ? "text" : "password"}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            value={value}
            onChange={onChange}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-0 top-0 h-full px-3 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-r-md"
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            tabIndex={0}
          >
            {visible ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {showStrengthMeter && <PasswordStrengthMeter strength={strength} />}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
