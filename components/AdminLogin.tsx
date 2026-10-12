"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-8 fade-slide-in">
      <h1 className="text-xl font-bold text-white mb-1">Admin Access</h1>
      <p className="text-sm text-[var(--text-dim)] mb-5">Enter the admin password to manage shows and run the pipeline.</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full px-4 py-2.5 rounded-xl bg-[#0a0e1a] border border-[var(--border)] text-white placeholder-[var(--text-dim)] outline-none focus:border-[var(--violet)] mb-3"
      />
      {error && <p className="text-sm text-rose-400 mb-3">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-[#a855f7] to-[#7c3aed] disabled:opacity-60"
      >
        {loading ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}
