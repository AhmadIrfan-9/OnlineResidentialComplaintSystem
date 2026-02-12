import { redirect } from "next/navigation";

export default function SubmitComplaintRedirectPage() {
  redirect("/student/new");
}
