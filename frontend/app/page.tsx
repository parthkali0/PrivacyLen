import Analyzer from "@/components/Analyzer";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Privacy Lens</h1>
        <p className="mt-2 text-slate-600">
          Uncover what a privacy policy really means before you click{" "}
          <span className="font-semibold">&ldquo;I Agree&rdquo;</span>.
        </p>
      </header>
      <Analyzer />
      <footer className="mt-10 text-center text-xs text-slate-400">
        Privacy Lens runs locally with Ollama &mdash; your policy text never leaves your machine.
      </footer>
    </main>
  );
}