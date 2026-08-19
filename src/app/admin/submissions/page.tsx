import Link from "next/link";

import { SubmissionQueueTable } from "@/components/admin/submission-queue-table";
import { requireStaff } from "@/lib/auth/dal";
import { listSubmissionPage } from "@/lib/moderation/data.server";

const labels: Record<string, string> = { pending_review: "Needs Review", rejection_pending_admin: "Admin Decisions", published: "Published", rejected: "Rejected", trashed: "Trash", test: "Test Records", all: "All Active" };

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; cursor?: string; result?: string }> }) {
  const session = await requireStaff();
  const query = await searchParams;
  const requested = query.status ?? "pending_review";
  const status = requested === "trashed" && session.role !== "admin" ? "pending_review" : requested;
  const page = await listSubmissionPage(status, query.q ?? "", query.cursor);
  const submissions = page.items;
  const filters = ["pending_review", ...(session.role === "admin" ? ["rejection_pending_admin"] : []), "published", "rejected", "test", ...(session.role === "admin" ? ["trashed"] : [])];
  return <>
    <header className="admin-page-header"><div><p>Review Queue</p><h1>{labels[status] ?? "Submissions"}</h1><span>Review, publish, and manage participant promises from one place.</span></div></header>
    {query.result === "trashed" && <div className="admin-success" role="status">Submission moved to Trash.</div>}
    {query.result === "deleted" && <div className="admin-success" role="status">Trashed submission permanently deleted.</div>}
    <nav className="admin-filters" aria-label="Submission filters">{filters.map(filter => <Link aria-current={filter === status ? "page" : undefined} href={`/admin/submissions?status=${filter}`} key={filter}>{labels[filter]}</Link>)}</nav>
    <form className="admin-search"><label><span className="sr-only">Search by display name, Guardian number{session.role === "admin" ? ", or exact email" : ""}</span><input name="q" type="search" placeholder={`Search name, Guardian number${session.role === "admin" ? ", or exact email" : ""}`} defaultValue={query.q} /></label><input type="hidden" name="status" value={status} /><button className="button button--light">Search</button></form>
    <section className="admin-panel admin-queue-panel" aria-label={`${labels[status] ?? "Submission"} queue`}>
      {submissions.length ? <SubmissionQueueTable submissions={submissions} labels={labels} /> : <p className="admin-empty">No submissions match this queue.</p>}
    </section>
    {page.nextCursor && <nav className="admin-pagination" aria-label="Queue pages"><Link href={{ pathname: "/admin/submissions", query: { status, ...(query.q ? { q: query.q } : {}), cursor: page.nextCursor } }}>Next 25 submissions</Link></nav>}
  </>;
}
