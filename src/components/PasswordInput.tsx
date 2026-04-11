import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
}

export function PasswordInput({ className, wrapperClassName, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  const value = typeof props.value === "string" ? props.value : "";

  return (
    <div className={`relative ${wrapperClassName || ""}`}>
      <input
        {...props}
        type={show ? "text" : "password"}
        className={className}
      />
      {value.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
