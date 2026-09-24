import { AuthForm } from "../auth-form";

export const metadata = { title: "เข้าสู่ระบบ · FitTrack" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <AuthForm
      mode="login"
      next={typeof next === "string" ? next : "/today"}
      googleError={error === "google"}
    />
  );
}
