import type { Metadata } from "next";
import { AuthPending } from "@/components/site/AuthPending";

export const metadata: Metadata = { title: "Create an account" };

export default function Signup() {
  return <AuthPending title="Create an account" />;
}
