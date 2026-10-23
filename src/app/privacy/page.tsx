import type { Metadata } from "next";
export const metadata: Metadata = { title: "Privacy Policy | MicroSECONDS Monitoring" };
const sections = [
  [
    "Overview",
    "This Privacy Policy describes how MicroSECONDS Computer Consulting (“MicroSECONDS,” “we,” “us,” or “our”) collects, uses, retains, and shares information in connection with MicroSECONDS Monitoring, a service for Microsoft 365 and Google Workspace sign-in monitoring and security incident analysis."
  ],
  [
    "Account Information",
    "We may collect names, email addresses, organization names, account identifiers, authentication and account-security information, subscription status, support communications, and preferences needed to operate the service."
  ],
  [
    "Connected-Tenant Security Data",
    "When an authorized administrator connects a Microsoft 365 or Google Workspace tenant, the service may retrieve sign-in events and related metadata, including user names and email addresses, timestamps, IP addresses, approximate geographic locations, application identifiers, device or browser details, authentication results, and risk indicators available from the provider. We may enrich IP addresses using third-party intelligence providers and generate risk scores, incidents, dispositions, and audit information."
  ],
  [
    "How We Use Information",
    "We use information to authenticate users; synchronize connected tenants; display sign-in history; analyze potential security risks; generate incidents and alerts; operate configurable monitoring; provide support; administer subscriptions; investigate failures and abuse; improve reliability; and comply with applicable legal obligations."
  ],
  [
    "Customer Control and Responsibilities",
    "Customer administrators determine which tenants to connect, configure monitoring and retention settings, and manage authorized access. Customers are responsible for the legal authority and notices required to monitor users and process workplace sign-in information. Authorized customer users may view their organization's monitoring records."
  ],
  [
    "Billing",
    "Payments are handled by Stripe or another payment processor. We receive billing identifiers, subscription status, and transaction details needed to manage service access. We do not need to store full payment-card numbers."
  ],
  [
    "Service Providers and Sharing",
    "We use service providers for hosting, database and authentication services, email delivery, payment processing, and IP intelligence. Information may be disclosed to them as needed to operate the service, subject to their roles and applicable agreements. We may also disclose information when required by law, to protect rights and security, or as part of a lawful business transaction. We do not sell personal information in the ordinary meaning of that term."
  ],
  [
    "Cookies and Local Storage",
    "We may use essential cookies, session storage, and similar technologies for authentication, account security, interface preferences, and service operation."
  ],
  [
    "Retention and Deletion",
    "Sign-in history and incidents may be subject to configurable retention periods. Some account, billing, security, or operational records may be retained longer where reasonably necessary for legitimate business needs, disputes, or legal obligations. Disconnecting a tenant does not necessarily delete historical data. Contact support for account deletion requests."
  ],
  [
    "Security",
    "We use reasonable administrative, technical, and organizational safeguards designed to protect information, including access controls. No networked service can guarantee absolute security."
  ],
  [
    "Privacy Rights",
    "Depending on applicable law, individuals may have rights to request access, correction, or deletion of certain personal information, or to object to certain processing. Because monitoring records are typically controlled by the subscribing organization, employees may need to direct requests to their employer or organization administrator. Requests can also be sent to support@microseconds.com."
  ],
  [
    "International Processing",
    "The service and its providers may process or store information in locations where they operate, subject to applicable legal requirements and contractual safeguards where required."
  ],
  [
    "Children's Privacy",
    "The service is designed for business and organizational use and is not directed to children under 13. We do not knowingly solicit personal information from children under 13."
  ],
  [
    "Changes to This Policy",
    "We may update this policy as the service evolves. Material changes may be communicated through the service, by email, or by revising the effective date."
  ],
  [
    "Contact",
    "For privacy questions or requests, contact support@microseconds.com."
  ]
];
export default function Page(){
 return <article className="card legalPage">
  <h1>Privacy Policy</h1>
  <div className="legalEffective">Effective: October 23, 2026</div>
  {sections.map(([heading,body],index)=><section key={heading}>
   <h2>{index+1}. {heading}</h2>
   <p>{body}</p>
  </section>)}
 </article>;
}
