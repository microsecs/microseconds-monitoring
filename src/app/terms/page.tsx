import type { Metadata } from "next";
export const metadata: Metadata = { title: "Terms of Service | MicroSECONDS Monitoring" };
const sections = [
  [
    "Agreement",
    "These Terms of Service govern use of MicroSECONDS Monitoring, a cloud-based service provided by MicroSECONDS Computer Consulting (“MicroSECONDS,” “we,” “us,” or “our”) for reviewing Microsoft 365 and Google Workspace authentication activity, identifying potentially suspicious sign-ins, generating incidents, and sending notifications. By creating an account, connecting an organization, or using the service, you agree to these Terms. If you act for an organization, you represent that you are authorized to bind it."
  ],
  [
    "Customer Accounts and Authority",
    "You are responsible for the security of your account, your authorized users, and the accuracy of information supplied to the service. You must have permission to connect and monitor each Microsoft 365 or Google Workspace tenant. You are responsible for applicable notices, employee privacy requirements, and lawful access to authentication records."
  ],
  [
    "Connected Tenants and Permissions",
    "Connecting a tenant may require administrator consent to permissions supplied by Microsoft or Google. You control which tenants are connected and are responsible for maintaining the necessary subscriptions, licenses, permissions, and provider configurations. Disconnecting a tenant may stop future synchronization but does not automatically erase previously collected records."
  ],
  [
    "Monitoring and Alerts",
    "The service may collect sign-in events, IP addresses, locations, user identifiers, provider information, and related security metadata. Automated analysis, risk scores, and incident classifications are advisory and may produce false positives or miss suspicious activity. Notifications and monitoring depend on provider availability, data freshness, your configuration, and successful email delivery. The service is not a guarantee of breach detection or prevention."
  ],
  [
    "Subscriptions, Trials, and Billing",
    "Plans, trial periods, and recurring charges are presented at signup or checkout. By subscribing, you authorize recurring billing until cancellation. Payments may be handled by Stripe. Failed payments, expiration, or cancellation may result in restricted monitoring access. Except as required by law or expressly stated otherwise, previously paid fees are nonrefundable."
  ],
  [
    "Cancellation and Data Retention",
    "You may cancel using available account or billing tools. Access generally continues until the end of the paid period unless otherwise specified. Sign-in history and incidents may be retained under configurable retention settings, operational requirements, and applicable law. You should export any records you need before closing your account."
  ],
  [
    "Acceptable Use",
    "You may not connect tenants without authorization, attempt to access another customer's information, interfere with the service, evade security controls, introduce malicious code, reverse engineer protected components, or use the service unlawfully."
  ],
  [
    "Third-Party Platforms",
    "The service depends on Microsoft, Google, hosting, database, email, IP intelligence, and payment providers. Their separate terms, licensing rules, rate limits, and outages may affect operation. We cannot control their availability or the accuracy of information they provide."
  ],
  [
    "Intellectual Property",
    "MicroSECONDS and its licensors retain ownership of the software, designs, branding, and related materials. You receive a limited, non-exclusive, non-transferable right to use the service for authorized internal business purposes while your account is in good standing."
  ],
  [
    "Availability and Changes",
    "We may maintain, improve, or modify the service. We do not guarantee uninterrupted, error-free, or continuous monitoring, and scheduled synchronization may be delayed by rate limits, technical failures, or external dependencies."
  ],
  [
    "Disclaimer of Warranties",
    "To the fullest extent permitted by law, the service is provided “as is” and “as available,” without express or implied warranties, including fitness for a particular purpose, merchantability, and any guarantee that security threats will be detected or prevented. The service does not replace professional security review or an incident-response program."
  ],
  [
    "Limitation of Liability",
    "To the fullest extent permitted by law, MicroSECONDS is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, including lost profits, business interruption, or lost data. To the fullest extent permitted by law, aggregate liability related to the service will not exceed the fees paid by the applicable customer for the service during the six months preceding the event giving rise to the claim."
  ],
  [
    "Indemnification",
    "To the extent permitted by law, you agree to defend and indemnify MicroSECONDS against claims and reasonable costs resulting from your unauthorized tenant connections, unlawful monitoring, misuse of third-party data, or material breach of these Terms."
  ],
  [
    "Suspension and Termination",
    "We may suspend or terminate access for nonpayment, security risks, unlawful conduct, or material violations of these Terms. Terms intended to survive termination, including intellectual property, disclaimers, and liability limits, will continue to apply."
  ],
  [
    "Governing Law",
    "These Terms are governed by California law, except where applicable law requires otherwise."
  ],
  [
    "Changes to These Terms",
    "We may revise these Terms from time to time. Material changes may be communicated through the service, by email, or by updating the effective date. Continued use after the effective date constitutes acceptance to the extent permitted by law."
  ],
  [
    "Contact",
    "For questions about these Terms, contact support@microseconds.com."
  ]
];
export default function Page(){
 return <article className="card legalPage">
  <h1>Terms of Service</h1>
  <div className="legalEffective">Effective: October 23, 2026</div>
  {sections.map(([heading,body],index)=><section key={heading}>
   <h2>{index+1}. {heading}</h2>
   <p>{body}</p>
  </section>)}
 </article>;
}
