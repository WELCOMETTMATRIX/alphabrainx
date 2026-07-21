import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./about";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Alpha Brain" },
      { name: "description", content: "Get in touch with the Alpha Brain team." },
    ],
  }),
  component: () => (
    <LegalShell title="Contact">
      <p>Questions, feedback, partnership ideas, or bug reports? We reply personally.</p>
      <h2>Email</h2>
      <p><a href="mailto:xapp431@gmail.com">xapp431@gmail.com</a></p>
      <h2>Product Hunt</h2>
      <p><a href="https://www.producthunt.com/@dogekingmike" target="_blank" rel="noopener">@dogekingmike</a> — upvotes and comments welcome.</p>
      <h2>Support hours</h2>
      <p>We aim to respond within 48 hours, Mon–Fri.</p>
    </LegalShell>
  ),
});
