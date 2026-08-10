import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/dal";

export default async function AdminTrashPage() {
  await requireRole("admin");
  redirect("/admin/submissions?status=trashed");
}
