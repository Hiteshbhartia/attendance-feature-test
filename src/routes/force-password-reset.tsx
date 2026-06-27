import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Eye, EyeOff, Check, X, KeyRound, Copy, LogOut } from "lucide-react";
import { AuthFormLayout } from "@/components/AuthFormLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/force-password-reset")({
  component: ForcePasswordResetPage,
  head: () => ({ meta: [{ title: "Update Password — Gharpayy Arena" }] }),
});

function ForcePasswordResetPage() {
  const { changePassword, logout, isLoading, error } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Strength Checks
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const matches = password === confirmPassword && confirmPassword.length > 0;

  const requirements = [
    { label: "At least 8 characters", met: hasMinLength },
    { label: "Contains uppercase & lowercase", met: hasUpper && hasLower },
    { label: "Contains number & special character", met: hasNumber && hasSpecial },
    { label: "Passwords match", met: matches },
  ];

  const allMet = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial && matches;

  function handleGeneratePassword() {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,./?";
    const allChars = uppercase + lowercase + numbers + symbols;

    let generated = "";
    // Ensure at least one of each class
    generated += uppercase[Math.floor(Math.random() * uppercase.length)];
    generated += lowercase[Math.floor(Math.random() * lowercase.length)];
    generated += numbers[Math.floor(Math.random() * numbers.length)];
    generated += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = 0; i < 10; i++) {
      generated += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle characters
    generated = generated
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");

    setPassword(generated);
    setConfirmPassword(generated);
    toast.success("Strong password generated!");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied to clipboard!");
    } catch {
      toast.error("Failed to copy password.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allMet) {
      toast.error("Please meet all password requirements first.");
      return;
    }

    setSubmitLoading(true);
    try {
      await changePassword(password);
      toast.success("Password updated successfully! Welcome to the Arena.");
      navigate({ to: "/", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password.";
      toast.error(message);
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <AuthFormLayout
      title="Secure your account"
      subtitle="This is your first login. You must change your temporary password to continue."
      footer={
        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-3 border border-border rounded-full hover:bg-muted"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">New Password</Label>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs text-primary"
              onClick={handleGeneratePassword}
            >
              Generate Strong Password
            </Button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="pr-10 font-mono"
            />
            <div className="absolute right-0 top-0 h-full flex items-center pr-3 gap-1.5">
              {password && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                  title="Copy password"
                >
                  <Copy className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Retype password"
              className="pr-10 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-0 h-full flex items-center text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Requirements indicator list */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3.5 space-y-2 text-xs">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
            Requirements
          </div>
          {requirements.map((req, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 transition-colors ${
                req.met ? "text-emerald-500 font-medium" : "text-muted-foreground"
              }`}
            >
              {req.met ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              )}
              <span>{req.label}</span>
            </div>
          ))}
        </div>

        {error && (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full flex items-center justify-center gap-2 mt-2"
          disabled={!allMet || submitLoading || isLoading}
        >
          {submitLoading || isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating password…
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" />
              Reset & Unlock App
            </>
          )}
        </Button>
      </form>
    </AuthFormLayout>
  );
}
