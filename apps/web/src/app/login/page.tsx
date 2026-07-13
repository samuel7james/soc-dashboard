"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { useCurrentUser, useLogin } from "@/lib/api/use-auth";

export default function LoginPage() {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const loginMutation = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (currentUser) {
      router.replace("/overview");
    }
  }, [currentUser, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await loginMutation.mutateAsync({ email, password });
      router.replace("/overview");
    } catch {
      // error state is surfaced via loginMutation.error below
    }
  }

  const errorMessage = loginMutation.error instanceof ApiError ? loginMutation.error.message : undefined;

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <ShieldCheck className="text-primary mb-2 size-8" aria-hidden />
          <CardTitle className="text-base">Sign in to SOC Platform</CardTitle>
          <CardDescription>Enter your credentials to access the security operations center.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {errorMessage && (
              <p role="alert" className="text-destructive text-sm">
                {errorMessage}
              </p>
            )}
            <Button type="submit" disabled={loginMutation.isPending} className="mt-1">
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
