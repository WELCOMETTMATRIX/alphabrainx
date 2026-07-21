import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./about";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Alpha Brain" },
      { name: "description", content: "Terms governing your use of Alpha Brain." },
    ],
  }),
  component: () => (
    <LegalShell title="Terms of Service">
      <p><em>Last updated: 2026</em></p>
      <h2>Acceptance</h2>
      <p>By using Alpha Brain (the "Service"), you agree to these Terms. If you disagree, do not use the Service.</p>
      <h2>No financial advice</h2>
      <p>All content is informational. Alpha Brain, its authors and its data providers are not licensed financial advisors. Nothing in the Service constitutes a recommendation to buy, sell or hold any asset.</p>
      <h2>Assumption of risk</h2>
      <p>Trading stocks, crypto and on-chain tokens carries substantial risk of loss. You accept full responsibility for every decision you make while using the Service.</p>
      <h2>Availability</h2>
      <p>The Service is provided "as is" with no uptime guarantees. Data may be delayed, incomplete or incorrect.</p>
      <h2>Acceptable use</h2>
      <p>Do not attempt to abuse rate limits, reverse-engineer server functions, or use the Service for automated high-frequency trading systems without permission.</p>
      <h2>Limitation of liability</h2>
      <p>To the maximum extent permitted by law, Alpha Brain shall not be liable for any indirect, incidental or consequential damages arising from your use of the Service.</p>
      <h2>Changes</h2>
      <p>We may update these Terms at any time. Continued use constitutes acceptance.</p>
      <h2>Contact</h2>
      <p><a href="mailto:xapp431@gmail.com">xapp431@gmail.com</a></p>
    </LegalShell>
  ),
});
