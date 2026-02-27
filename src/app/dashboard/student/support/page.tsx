import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { StudentSupportChat } from "@/components/messaging/StudentSupportChat";

export default async function StudentSupportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (String(session.user.role ?? "").toUpperCase() !== "STUDENT") {
    redirect("/dashboard");
  }

  const latestComplaint = await db.complaint.findFirst({
    where: {
      studentProfile: {
        userId: session.user.id,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
    },
  });

  if (!latestComplaint) {
    return (
      <main className="min-h-screen p-4 md:p-6">
        <section className="surface-card mx-auto max-w-3xl p-5">
          <h1 className="text-lg font-semibold text-red-700">Support Chat Unavailable</h1>
          <p className="mt-2 text-sm text-slate-700">
            Submit a complaint first to start a support conversation.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <StudentSupportChat complaintId={latestComplaint.id} />
      </div>
    </main>
  );
}
