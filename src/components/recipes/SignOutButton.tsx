"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button className="topbar-signout" onClick={() => void signOut()}>
      Sign out ↗
    </button>
  );
}
