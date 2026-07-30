import { redirect } from "next/navigation";

// The middleware routes unauthenticated users to /login; authenticated users
// land on the dashboard.
export default function RootPage() {
  redirect("/dashboard");
}
