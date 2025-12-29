import { Suspense } from "react";
import GuildWarClient from "./GuildWarClient";

export default function GuildWarPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-center text-white">Loading...</div>}
    >
      <GuildWarClient />
    </Suspense>
  );
}
