import Link from "next/link";
import { isCurrentUserProductAdmin } from "@/lib/productAdmin";

export default async function ProductAdminNavLink() {
  if (!(await isCurrentUserProductAdmin())) return null;
  return <Link href="/admin">Product Admin</Link>;
}
