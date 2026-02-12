import * as React from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface TextFieldWithCounterProps {
  value: string;
  onChange: (value: string) => void;
  maxChars: number;
  minChars?: number;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}

const TextFieldWithCounter = ({
  value,
  onChange,
  maxChars,
  minChars,
  disabled,
  placeholder = "Resposta...",
  rows = 4,
}: TextFieldWithCounterProps) => {
  const charCount = value.length;
  const isAtWarning = maxChars > 0 && charCount >= maxChars * 0.9 && charCount <= maxChars;
  const isOverMax = maxChars > 0 && charCount > maxChars;
  const isBelowMin = minChars != null && minChars > 0 && charCount > 0 && charCount < minChars;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (maxChars > 0 && newValue.length > maxChars) return;
    onChange(newValue);
  };

  return (
    <div className="space-y-1">
      <Textarea
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
      />
      <div className="flex items-center justify-between text-xs">
        <div>
          {isAtWarning && !isOverMax && (
            <span className="text-yellow-600 dark:text-yellow-400">
              Você está próximo do limite de caracteres.
            </span>
          )}
          {isBelowMin && (
            <span className="text-destructive">
              Mínimo de {minChars} caracteres necessários.
            </span>
          )}
        </div>
        <span
          className={cn(
            "tabular-nums",
            isOverMax
              ? "text-destructive font-medium"
              : isAtWarning
              ? "text-yellow-600 dark:text-yellow-400 font-medium"
              : "text-muted-foreground"
          )}
        >
          {charCount} / {maxChars} caracteres
        </span>
      </div>
    </div>
  );
};

export { TextFieldWithCounter };
