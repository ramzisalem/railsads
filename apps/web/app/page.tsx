import { redirect } from "next/navigation";

/**
 * Root URL — there is no standalone marketing page in this app (see apps/marketing).
 * Authenticated users are sent here from /login and /signup by middleware; send them
 * straight into the product.
 */
export default function HomePage() {
  redirect("/dashboard");
}
