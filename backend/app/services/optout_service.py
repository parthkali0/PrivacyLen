"""Legal opt-out email template generator (CCPA / CPRA and GDPR).

Produces a plain-text email the user can copy, paste, or launch in their
default mail client via ``mailto:``. References California's CCPA/CPRA (the
right to opt out of the sale/sharing of personal information) and the EU/UK
GDPR (right to object and withdraw consent).
"""

from typing import Optional

LEGAL_REFERENCES = [
    "California Consumer Privacy Act (CCPA) — Cal. Civ. Code § 1798.120 (right to opt out of sale/sharing)",
    "California Privacy Rights Act (CPRA) — § 1798.135 (opt-out of sharing / cross-context behavioral advertising)",
    "GDPR (EU) — Article 21 (right to object) and Article 7(3) (withdraw consent)",
    "UK GDPR — Articles 21 and 7(3)",
]


def build_opt_out_email(company_name: str, flagged_items: Optional[list[str]] = None) -> dict:
    """Return a ``{subject, body, references}`` dict for the /optout endpoint."""
    company = company_name.strip() or "the company"
    items = [item.strip() for item in (flagged_items or []) if item and item.strip()]
    items = list(dict.fromkeys(items))

    if items:
        concerns = "\n".join(f"- {item}" for item in items)
        concerns_block = (
            "I am specifically concerned about the following practices identified "
            "during my review of your policies:\n\n" + concerns
        )
    else:
        concerns_block = (
            "I am specifically concerned about practices related to the sale, "
            "sharing, or processing of my personal information as described in "
            "your privacy policy."
        )

    subject = f"Opt-Out Request under CCPA/GDPR — {company}"

    body = "\n".join(
        [
            f"To the Privacy Team / Data Protection Officer,",
            "",
            f"I am writing to formally exercise my data protection rights with {company}.",
            "",
            concerns_block,
            "",
            "Pursuant to the California Consumer Privacy Act (CCPA/CPRA), I request that "
            "my personal information not be sold or shared, and that any sale/sharing "
            "arrangements for my data cease immediately. If I am a California resident, "
            "this also serves as a request to know and delete my personal information "
            "under Cal. Civ. Code § 1798.110 and § 1798.105.",
            "",
            "Pursuant to the GDPR / UK GDPR, I object to the processing of my personal "
            "data for the purposes described above (Article 21) and withdraw any consent "
            "I previously provided (Article 7(3)). Please stop processing my data for "
            "those purposes without requiring any further action from me.",
            "",
            "Please confirm in writing within the legally required timeframes that:",
            "  1. My personal information will not be sold or shared.",
            "  2. My data will not be used for the flagged practices above.",
            "  3. My request has been processed and the Company has updated its records.",
            "",
            "If you believe this request does not apply, please explain the legal basis "
            "for your position and how I may appeal your decision.",
            "",
            "Sincerely,",
            "",
            "Your Name: ____________________________",
            "Your Email Address: ____________________________",
            "Your Account Identifier (if any): ____________________________",
            "",
            "—",
            "This request was drafted by Privacy Lens based on your selected concerns.",
        ]
    )

    return {
        "subject": subject,
        "body": body,
        "references": LEGAL_REFERENCES,
    }