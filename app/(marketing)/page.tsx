import { redirect } from "next/navigation";
import { Home } from "@/components/site/Home";
import { getSessionUser } from "@/lib/auth/session";
import { isNativeAppRequest } from "@/lib/native-app-server";

export default async function LandingPage() {
  if (await getSessionUser()) redirect("/events");
  return <Home inApp={await isNativeAppRequest()} />;
}
