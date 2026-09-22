import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";
import { redirectIfLoggedIn } from "../actions";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage() {
  await redirectIfLoggedIn();
  return <SignupForm />;
}
