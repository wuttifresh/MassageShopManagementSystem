"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useTranslation } from "@/i18n/locale-provider";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const { dict } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setIsSubmitting(false);

    if (!result || result.error) {
      setError(dict.login.error);
      return;
    }

    window.location.href = result.url ?? callbackUrl;
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-card">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label={dict.login.emailLabel} required>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={dict.login.emailPlaceholder}
          />
        </Field>
        <Field label={dict.login.passwordLabel} required>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        {error && <Alert variant="danger">{error}</Alert>}

        <Button type="submit" isLoading={isSubmitting} fullWidth>
          {dict.login.submit}
        </Button>
      </form>
    </div>
  );
}
