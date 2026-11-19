import { Dashboard } from "@/components/Dashboard";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white" aria-hidden>
            DI
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-slate-900">Healthcare Document Ingestion</h1>
            <p className="text-xs text-slate-500">837 EDI claims &amp; EOB / 835 images</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Dashboard />
      </main>
    </div>
  );
}
