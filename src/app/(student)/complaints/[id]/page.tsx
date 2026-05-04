import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ComplaintUpdates } from "@/components/shared/ComplaintUpdates";
import { StudentComplaintDetailClient } from "@/components/student/StudentComplaintDetailClient";
import { categoryLabels, statusLabels } from "@/lib/validations";
import { resolveEvidenceListUrls } from "@/lib/storage/evidence";

export default async function StudentComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (String(session.user.role ?? "").toUpperCase() !== "STUDENT") {
    redirect("/dashboard");
  }

  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!studentProfile) {
    redirect("/dashboard/student");
  }

  const complaint = await db.complaint.findFirst({
    where: {
      id,
      studentProfileId: studentProfile.id,
    },
    include: {
      room: { select: { roomNumber: true, floor: true } },
      hostel: { select: { name: true } },
      evidences: { select: { id: true, fileUrl: true, fileType: true } },
    },
  });

  if (!complaint) {
    notFound();
  }

  const evidenceWithAccess = await resolveEvidenceListUrls(complaint.evidences);

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="surface-hero p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{complaint.title}</h1>
              <p className="text-sm text-slate-600">Ticket #{complaint.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <Link href="/complaints" className="nav-pill px-3 py-2">
              Back
            </Link>
          </div>
        </header>

        <section className="surface-card p-4">
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p>
              <span className="font-medium">Status:</span> {statusLabels[complaint.status]}
            </p>

            <p>
              <span className="font-medium">Category:</span> {categoryLabels[complaint.category]}
            </p>
            <p>
              <span className="font-medium">Hostel / Room:</span> {complaint.hostel.name} -{" "}
              {complaint.room.roomNumber} (Floor {complaint.room.floor})
            </p>
            <p>
              <span className="font-medium">Anonymous:</span> {complaint.isAnonymous ? "Yes" : "No"}
            </p>
            <p>
              <span className="font-medium">Submitted:</span>{" "}
              {new Date(complaint.createdAt).toLocaleString()}
            </p>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{complaint.description}</p>
        </section>

        <section className="surface-card p-4">
          <h2 className="mb-2 text-base font-semibold text-slate-900">Evidence</h2>
          {evidenceWithAccess.length === 0 ? (
            <p className="text-sm text-slate-600">No evidence uploaded.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {evidenceWithAccess.map((file) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-blue-700 underline hover:bg-sky-50"
                >
                  {file.fileType.startsWith("image/") ? "Open image evidence" : "Open file evidence"}
                </a>
              ))}
            </div>
          )}
        </section>

        <StudentComplaintDetailClient
          complaintId={complaint.id}
          status={complaint.status}
          initialTitle={complaint.title}
          initialDescription={complaint.description}
          initialCategory={complaint.category}
          initialAnonymous={complaint.isAnonymous}
          initialAttachments={evidenceWithAccess.map((e) => e.fileUrl)}
          location={`${complaint.hostel.name} - ${complaint.room.roomNumber}`}
        />
        <ComplaintUpdates complaintId={complaint.id} />
      </div>
    </main>
  );
}
