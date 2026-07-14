import { redirect } from "next/navigation";

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect("/home");
}
