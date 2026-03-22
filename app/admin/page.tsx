// src/app/admin/page.tsx
import type { Metadata } from "next";
import AdminClient from "./AdminClient";

export const metadata: Metadata = {
  title: "Admin — Arena Protocol",
};

export default function AdminPage() {
  return <AdminClient />;
}
