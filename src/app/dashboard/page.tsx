import { Send, ShieldCheck } from "lucide-react";

export default function DashboardPage() {
  const timeline = [
    { title: "Submitted", time: "2024-15 10:00 AM", active: true },
    { title: "Acknowledged", time: "2024-15 11:30", active: true },
    { title: "Under Review", time: "11:30-18 09:00 AM", active: true },
    { title: "Under Review", time: "2024-18 09:00 AM", active: true },
    { title: "Resolved", time: "", active: false, current: true },
  ];

  return (
    <main className="min-h-screen bg-slate-200 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4 rounded-sm bg-slate-100 p-4 md:p-6">
        <header className="rounded-lg bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-5">
          <h1 className="text-2xl font-semibold text-slate-100">
            Complaint Tracking Dashboard - Student View
          </h1>
        </header>

        <section className="rounded-lg bg-slate-200 p-5">
          <h2 className="mb-4 text-3xl font-semibold text-slate-700">Key Metrics</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-slate-100 p-4">
              <p className="mb-2 text-lg text-slate-700">Status</p>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-base font-medium text-slate-700">Under Review</p>
                  <p className="text-sm text-slate-500">Acknowledged</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-100 p-4">
              <p className="mb-2 text-lg text-slate-700">Submitted Date</p>
              <p className="text-2xl font-semibold text-slate-700">2024-03-15</p>
            </div>

            <div className="rounded-xl bg-slate-100 p-4">
              <p className="mb-2 text-lg text-slate-700">Ticket ID</p>
              <p className="text-2xl font-semibold text-slate-700">#20240315-007B</p>
            </div>

            <div className="rounded-xl bg-slate-100 p-4">
              <p className="mb-2 text-lg text-slate-700">Days Pending</p>
              <p className="text-2xl font-semibold text-slate-700">10</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-slate-200 p-5">
          <h2 className="mb-6 text-3xl font-semibold text-slate-700">
            Complaint Timeline
          </h2>

          <div className="mb-4 flex items-center justify-between px-4">
            {timeline.map((step, index) => (
              <div key={`${step.title}-${index}`} className="relative flex-1">
                {index < timeline.length - 1 && (
                  <span className="absolute left-5 right-0 top-4 block h-[2px] bg-slate-300" />
                )}
                <span
                  className={`relative z-10 block h-8 w-8 rounded-full border-4 ${
                    step.current
                      ? "border-orange-400 bg-slate-100"
                      : step.active
                        ? "border-slate-600 bg-slate-100"
                        : "border-slate-400 bg-slate-100"
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-5">
            {timeline.map((step, index) => (
              <div key={`${step.title}-${step.time}-${index}`} className="text-left">
                <p className="text-sm font-medium text-slate-700">{step.title}</p>
                <p className="text-xs text-slate-500">{step.time || "-"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-slate-200 p-5">
          <h2 className="mb-5 text-3xl font-semibold text-slate-700">Message Exchange</h2>

          <div className="space-y-4">
            <div className="flex justify-start">
              <div className="max-w-[70%] rounded-2xl rounded-bl-sm bg-blue-500 px-4 py-3 text-sm text-white shadow-sm">
                <p>
                  Hi, I submitted a complaint about the noisy construction near the dorms.
                  Any updates?
                </p>
                <p className="mt-1 text-right text-xs text-blue-100">2024-15 10:05 AM</p>
              </div>
            </div>

            <p className="text-sm font-medium text-slate-700">Student (You)</p>

            <div className="flex justify-end">
              <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-slate-300 px-4 py-3 text-sm text-slate-700 shadow-sm">
                <p>
                  Thank for your submission. Your complaint #730 has been archived and is
                  under review. We will provide updates shortly.
                </p>
                <p className="mt-1 text-right text-xs text-slate-500">2024-18 09:15 AM</p>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-slate-300 px-4 py-3 text-sm text-slate-700 shadow-sm">
                <p>
                  Our team investigating the construction schedule and potential mitigation.
                  Expect information by the end of week.
                </p>
                <p className="mt-1 text-right text-xs text-slate-500">2024-18 09:15 AM</p>
              </div>
            </div>
          </div>

          <form className="mt-6 flex items-center gap-2 rounded-lg border border-slate-300 bg-white p-2">
            <input
              type="text"
              placeholder="Type your message..."
              className="w-full bg-transparent px-2 py-2 text-sm text-slate-700 outline-none"
            />
            <button
              type="submit"
              className="rounded-md p-2 text-slate-600 transition hover:bg-slate-100"
              aria-label="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
