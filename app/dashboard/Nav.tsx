import Link from "next/link";
import { signOut } from "./actions";

export function Nav() {
  return (
    <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
      <nav className="flex items-center gap-4 text-sm font-medium">
        <Link href="/dashboard">Avisos</Link>
        <Link href="/dashboard/patients">Pacientes</Link>
        <Link href="/dashboard/history">Historial</Link>
      </nav>
      <form action={signOut}>
        <button className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
          Cerrar sesión
        </button>
      </form>
    </header>
  );
}
