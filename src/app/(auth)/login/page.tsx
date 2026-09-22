import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { redirectIfLoggedIn } from "../actions";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  await redirectIfLoggedIn();
  return <LoginForm />;
}
