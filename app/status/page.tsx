// src/app/status/page.tsx
import { Metadata } from "next";
import StatusClient from "@/components/status/StatusClient";

export const metadata: Metadata = {
  title: "System Status — Arena Protocol",
  description: "Live database and system health for Arena Protocol",
};

export default function StatusPage() {
  return <StatusClient />;
}
