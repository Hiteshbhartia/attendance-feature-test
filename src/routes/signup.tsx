import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthFormLayout, AuthNavLink } from "@/components/AuthFormLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Create account — Gharpayy Arena" }] }),
});

function SignupPage() {
  const { signup, isLoading, error, clearError, apiEnabled } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setPendingMessage(null);
    try {
      const result = await signup({
        email: email.trim(),
        password,
        name: name.trim(),
      });
      if (result === "authenticated") {
        navigate({ to: "/", replace: true });
        return;
      }
      setPendingMessage(
        "Account created. An admin must approve your access before you can sign in.",
      );
    } catch {
      // error in context
    }
  }

  return (
    <AuthFormLayout
      title="Create account"
      subtitle="First signup on a fresh database becomes admin. Others await approval."
      footer={
        <>
          Already have an account? <AuthNavLink to="/login">Sign in</AuthNavLink>
        </>
      }
    >
      {!apiEnabled && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Set <code className="font-mono text-xs">VITE_API_URL</code> (e.g.
          http://localhost:4000/api) and restart the dev server.
        </p>
      )}

      {pendingMessage ? (
        <p
          className="rounded-md border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-foreground"
          role="status"
        >
          {pendingMessage}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">At least 8 characters.</p>
          </div>

          {error && (
            <p
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading || !apiEnabled}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating…
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>
      )}
    </AuthFormLayout>
  );
}
