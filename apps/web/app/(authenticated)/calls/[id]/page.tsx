import { CallScreen } from "@/features/calls";

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CallScreen callId={id} />;
}
