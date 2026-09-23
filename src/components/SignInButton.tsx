"use client";

import { signIn } from "next-auth/react";
import Icon from "./Icon";

export default function SignInButton() {
  return (
    <button className="button button-primary signin-button" onClick={() => signIn("kanidm")}>
      Sign in with Kanidm <Icon name="arrow" size={16} />
    </button>
  );
}
