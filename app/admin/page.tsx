import { isAdminAuthed } from "@/lib/auth";
import AdminLogin from "@/components/AdminLogin";
import AdminPanel from "@/components/AdminPanel";
import { db } from "@/lib/db";
import { shows } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authed = await isAdminAuthed();

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <AdminLogin />
      </div>
    );
  }

  const allShows = await db.select().from(shows).orderBy(desc(shows.createdAt));

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">Manage monitored shows and trigger the pipeline manually.</p>
      </header>
      <AdminPanel initialShows={allShows} />
    </div>
  );
}
