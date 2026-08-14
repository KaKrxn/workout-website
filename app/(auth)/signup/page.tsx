import { AuthForm } from "../auth-form";

export const metadata = { title: "สมัครใช้งาน · FitTrack" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  return <AuthForm mode="signup" next={typeof next === "string" ? next : "/today"} />;
}
