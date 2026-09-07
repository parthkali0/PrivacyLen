"""Ultra-fast regex/rule-based privacy policy analysis engine.

This module is the default analysis path for ``/api/v1/analyze``. It uses pure
Python :mod:`re` matching over the supplied text — no network, no model load —
so a response is produced in well under 50 ms regardless of Ollama availability.

Results are structurally identical to the LLM path (they both construct
:class:`app.models.AnalysisCore`), so the response contract consumed by the
Next.js dashboard and the browser extension is unchanged.
"""

import re
from typing import Optional

from app.models import AnalysisCore, RedFlag

# --------------------------------------------------------------------------- #
# Rule definitions
# --------------------------------------------------------------------------- #
# Each rule carries a compiled regex, a plain-English label, and a penalty
# applied to the trust score. Red-flag rules additionally carry a severity and
# an explanation.

DATA_COLLECTED_RULES: list[dict] = [
    {
        "key": "gps_location",
        "label": "GPS / precise location",
        "severity": "High",
        "explanation": "Your precise GPS location is tracked and stored.",
        "patterns": [
            r"\bprecise (?:gps |geo)?location\b",
            r"\bgps (?:data|coordinates|location)\b",
            r"\bgeolocation\b",
            r"\breal[- ]time location\b",
            r"\blocation (?:data|tracking|information)\b",
        ],
    },
    {
        "key": "microphone_audio",
        "label": "Microphone / audio recordings",
        "severity": "High",
        "explanation": "Your microphone and audio recordings may be accessed.",
        "patterns": [
            r"\bmicrophone\b",
            r"\baudio (?:recordings?|samples?|data)\b",
            r"\bvoice (?:recordings?|data)\b",
            r"\bsound recordings?\b",
        ],
    },
    {
        "key": "contacts",
        "label": "Contacts / address book",
        "severity": "Low",
        "explanation": "Your contacts and address book data may be collected.",
        "patterns": [
            r"\bcontacts?\s+(?:list|data|information)\b",
            r"\baddress book\b",
            r"\bcontact\s+list\b",
            r"\bphone\s+(?:numbers?|contacts?)\b",
        ],
    },
    {
        "key": "browsing_history",
        "label": "Browsing / search history",
        "severity": "Medium",
        "explanation": "Your browsing and search history is tracked.",
        "patterns": [
            r"\b(?:browsing|browser|web)\s+history\b",
            r"\bsearch history\b",
            r"\bsites? (?:you |they |we )?visit(?:ed)?\b",
        ],
    },
    {
        "key": "device_identifiers",
        "label": "Device identifiers / IP address",
        "severity": "Medium",
        "explanation": "Your device identifiers and IP address are collected for tracking.",
        "patterns": [
            r"\bdevice (?:identifiers?|ids?|fingerprint)\b",
            r"\b(?:ip address|ipv4|ipv6)\b",
            r"\badvertising id\b",
            r"\bidentifier[s]? for advertisers\b",
            r"\bbattery (?:level|status)\b",
            r"\bhardware (?:id|serial)\b",
        ],
    },
]

DATA_SHARED_RULES: list[dict] = [
    {
        "key": "sells_personal_data",
        "label": "Selling personal data",
        "severity": "High",
        "explanation": "Your personal data may be sold to third parties.",
        "patterns": [
            r"\bsell(?:s|ing)?\s+(?:your |our |user\s)?(?:personal |private )?data\b",
            r"\bsale of (?:your )?personal data\b",
            r"\bshares? .*?\bsell(?:s|ing)?\b",
        ],
    },
    {
        "key": "third_party_brokers",
        "label": "Third-party data brokers / marketing agencies",
        "severity": "High",
        "explanation": "Your data is shared with data brokers and marketing agencies.",
        "patterns": [
            r"\bdata brokers?\b",
            r"\bthird[- ]part(?:y|ies)\s+(?:companies|providers|services|processors)\b",
            r"\bmarketing (?:agencies|partners|companies)\b",
        ],
    },
]

RIGHTS_FORFEITED_RULES: list[dict] = [
    {
        "key": "arbitration",
        "label": "Mandatory binding arbitration",
        "patterns": [
            r"\bbinding arbitration\b",
            r"\barbitration (?:clause|agreement)\b",
            r"\barbitrate\b",
        ],
        "severity": "High",
        "explanation": "Disputes are decided outside of court; you give up the right to sue or join a class action.",
    },
    {
        "key": "class_action_waiver",
        "label": "Class-action waiver",
        "patterns": [
            r"\bclass[- ]action (?:waiver|action)?\b",
            r"\bwaiv(?:e|es|ing)\s+(?:the right to )?(?:a )?class action\b",
            r"\bcannot (?:bring|join) (?:a )?class action\b",
        ],
        "severity": "High",
        "explanation": "You cannot join or bring a class-action lawsuit against the service.",
    },
    {
        "key": "ai_training",
        "label": "Using your content to train AI models",
        "patterns": [
            r"\btrain(?:ing)?\s+(?:our )?(?:ai|AI|machine learning|LLM|models)\b",
            r"\buse .*?\bcontent\b.*?\btrain\b",
            r"\btrain\b.*?\bmodels\b",
        ],
        "severity": "Medium",
        "explanation": "Your submitted content may be used to train AI models without additional consent.",
    },
    {
        "key": "unilateral_changes",
        "label": "Unilateral changes to terms",
        "patterns": [
            r"\b(?:we|company)\s+(?:may|can|reserve the right to)\s+(?:change|modify|amend|update)\b",
            r"\bchange[ds]?\s+(?:the )?(?:terms|agreement)\s+(?:at any time|without notice)\b",
            r"\bnotice (?:period|requirement)\b",
        ],
        "severity": "Medium",
        "explanation": "Terms may change without prior notice; you may not be informed of material changes.",
    },
]

# --------------------------------------------------------------------------- #
# Compile everything up front once at import time for speed.
# --------------------------------------------------------------------------- #
_COLLECTED = [
    {
        "key": rule["key"],
        "label": rule["label"],
        "severity": rule["severity"],
        "explanation": rule["explanation"],
        "regex": re.compile("|".join(f"(?:{p})" for p in rule["patterns"]), re.IGNORECASE),
    }
    for rule in DATA_COLLECTED_RULES
]

_SHARED = [
    {
        "key": rule["key"],
        "label": rule["label"],
        "severity": rule["severity"],
        "explanation": rule["explanation"],
        "regex": re.compile("|".join(f"(?:{p})" for p in rule["patterns"]), re.IGNORECASE),
    }
    for rule in DATA_SHARED_RULES
]

_RIGHTS = [
    {
        "key": rule["key"],
        "label": rule["label"],
        "severity": rule["severity"],
        "explanation": rule["explanation"],
        "regex": re.compile("|".join(f"(?:{p})" for p in rule["patterns"]), re.IGNORECASE),
    }
    for rule in RIGHTS_FORFEITED_RULES
]

# Trust score penalties: High red flag deducts 3, Medium deducts 2, Low deducts 1.
SEVERITY_PENALTY = {"High": 3, "Medium": 2, "Low": 1}

# Fallback inference when the platform name is not obvious from surrounding text.
_FALLBACK_PLATFORM = "This platform"


def _infer_platform(text: str, source: Optional[str]) -> str:
    """Best-effort platform name from the policy text or the source URL."""
    if source:
        match = re.search(r"https?://(?:www\.)?([^/:?#]+)", source)
        if match:
            host = match.group(1)
            labels = [part for part in host.split(".") if part and part not in ("com", "org", "net", "co", "io", "app", "www")]
            return labels[0].replace("-", " ").title() if labels else host

    match = re.search(
        r"\b(?:this )?(?:Privacy Policy|Terms of Service|Terms and Conditions)"
        r"\s+(?:of|for)\s+([A-Z][A-Za-z0-9_ &.-]{2,40})",
        text,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    return _FALLBACK_PLATFORM


def _infer_summary(text: str, collected: list[str], shared: list[str], rights: list[str]) -> str:
    """Build a two-sentence plain-English executive summary from the findings."""
    if collected:
        collected_phrase = _human_join(list(dict.fromkeys(collected)))
        first = f"This policy collects {collected_phrase}."
    else:
        first = "This policy collects little or no personal data."

    parts: list[str] = []
    if shared:
        shared_clean = [s.lower() for s in dict.fromkeys(shared)]
        parts.append(f"it flags {_human_join(shared_clean)}")
    if rights:
        rights_clean = [s.lower() for s in dict.fromkeys(rights)]
        parts.append(f"you give up {_human_join(rights_clean)}")

    if parts:
        second = "Watch out: " + ", and ".join(parts) + "."
    else:
        second = "No major third-party sharing or rights surrenders were detected."

    return f"{first} {second}"


def _human_join(items: list[str]) -> str:
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return ", ".join(items[:-1]) + ", and " + items[-1]


def analyze_fast(text: str, source: Optional[str] = None) -> AnalysisCore:
    """Run the regex/rule engine over ``text`` and return a validated model.

    This is a pure synchronous function; callers wrap it in a thread via
    :func:`asyncio.to_thread` if needed. It performs no I/O and completes in
    microseconds-to-milliseconds.
    """
    collected: list[str] = []
    shared: list[str] = []
    rights: list[str] = []
    red_flags: list[RedFlag] = []
    penalty = 0

    for rule in _COLLECTED:
        if rule["regex"].search(text):
            collected.append(rule["label"])
            penalty += SEVERITY_PENALTY[rule["severity"]]
            red_flags.append(
                RedFlag(
                    clause=_find_clause_context(text, rule["regex"]),
                    severity=rule["severity"],
                    explanation=rule["explanation"],
                )
            )

    for rule in _SHARED:
        if rule["regex"].search(text):
            shared.append(rule["label"])
            penalty += SEVERITY_PENALTY[rule["severity"]]
            red_flags.append(
                RedFlag(
                    clause=_find_clause_context(text, rule["regex"]),
                    severity=rule["severity"],
                    explanation=rule["explanation"],
                )
            )

    for rule in _RIGHTS:
        if rule["regex"].search(text):
            rights.append(rule["label"])
            penalty += SEVERITY_PENALTY[rule["severity"]]
            red_flags.append(
                RedFlag(
                    clause=_find_clause_context(text, rule["regex"]),
                    severity=rule["severity"],
                    explanation=rule["explanation"],
                )
            )

    # Rank red flags: High → Medium → Low (stable within a tier).
    order = {"High": 0, "Medium": 1, "Low": 2}
    red_flags.sort(key=lambda flag: order[flag.severity])

    trust_score = max(1, 10 - penalty)
    summary = _infer_summary(text, collected, shared, rights)

    return AnalysisCore(
        trust_score=trust_score,
        platform_name=_infer_platform(text, source),
        summary=summary,
        data_collected=collected,
        data_shared_or_sold=shared,
        rights_forfeited=rights,
        red_flags=red_flags,
    )


def _find_clause_context(text: str, regex: re.Pattern, radius: int = 240) -> str:
    """Return a short quoted snippet around the first rule match."""
    match = regex.search(text)
    if not match:
        return "Relevant clause"
    start = max(0, match.start() - radius // 2)
    end = min(len(text), match.end() + radius // 2)
    snippet = re.sub(r"\s+", " ", text[start:end]).strip()
    if end < len(text):
        snippet += "…"
    return f"…{snippet}"