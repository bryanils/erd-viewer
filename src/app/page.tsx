import Link from "next/link";

import { api, HydrateClient } from "~/trpc/server";
import ErdViewer from "./_components/ErdViewer";

export default async function Home() {


  return (
    <HydrateClient>
      <main className="min-h-screen p-4">
        <ErdViewer />
      </main>
    </HydrateClient>
  );
}
