import type { Metadata } from "next";
import { AuthPending } from "@/components/site/AuthPending";

export const metadata: Metadata = { title: "Sign in" };

export default function Login() {
  return <AuthPending title="Sign in" />;
}
