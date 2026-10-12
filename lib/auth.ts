import { cookies } from "next/headers";

const COOKIE_NAME = "podcast_radar_admin";

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return !!value && value === process.env.ADMIN_PASSWORD;
}

export async function setAdminCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, process.env.ADMIN_PASSWORD!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
