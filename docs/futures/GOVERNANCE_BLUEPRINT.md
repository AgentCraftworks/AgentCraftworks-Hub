# AgentCraftworks Governance Blueprint
## Productized Consulting Offer — Purview + Agent 365 + Entra

**Offer type:** Consulting Offer (Microsoft AppSource / Azure Marketplace)  
**Offer code:** `ACW-GOV-001`  
**Strategy anchor:** Section 3.2 (Security & Governance Investments, EC103) of the AICraftworks FY27 Strategic Analysis.

> "Build AgentCraftworks Governance Blueprint — a productized offer bundling Purview labels + Agent 365 config + Entra permission audit." — FY27 Strategic Analysis §3.2

---

## Offer Overview

The **AgentCraftworks Governance Blueprint** is a fixed-scope consulting engagement that establishes a customer's Microsoft-native AI governance foundation in 4 weeks. It directly addresses the EC103 "Trusted and Secure Platform for AI" buyer conversation and is required for every enterprise customer deploying agents via AgentCraftworks.

**The offer is pre-funded:** Microsoft's Zero Trust Workshop and Secure AI Assessment are both MCI-funded pre-sales tools. Customers get a heavily subsidized engagement; AgentCraftworks earns MCI deployment incentives.

---

## Rate Card

| Phase | Duration | Fixed price (list) | MCI offset | Net customer cost | Deliverables |
|---|---|---|---|---|---|
| **Phase 1 — Assess** | 3 days | $4,500 | Up to -$2,500 (Secure AI Assessment) | ~$2,000 | AI Readiness Assessment report, current-state Purview/Entra/Agent 365 gap analysis |
| **Phase 2 — Design** | 5 days | $7,500 | — | $7,500 | Governance Architecture Blueprint (PDF + JSON schema), label taxonomy, RBAC model |
| **Phase 3 — Implement** | 10 days | $15,000 | Up to -$5,000 (Zero Trust Workshop funding) | ~$10,000 | Purview labels applied, Agent 365 configured, Entra SP audit complete, Hub dashboard live |
| **Phase 4 — Handover** | 2 days | $3,000 | — | $3,000 | Runbook, staff training (2-hour workshop), 30-day email support |
| **Full engagement (list)** | **20 days** | **$30,000** | **Up to -$7,500** | **~$22,500** | All deliverables below |

**Managed services add-on:** $2,500/month recurring — ongoing Hub monitoring, quarterly Purview label reviews, monthly Entra permission audit, kill-switch drill facilitation.

**Enterprise pricing (>500 seats):** $50,000–$75,000 depending on tenant complexity. Eligible for ECIF (End Customer Investment Funds) for strategic accounts.

---

## Deliverables List

### Phase 1 — AI Readiness Assessment (3 days)

**Tool:** Microsoft Secure AI Assessment (MCI-funded pre-sales tool)

| # | Deliverable | Format | Recipient |
|---|---|---|---|
| 1.1 | Current-state inventory: all deployed AI workloads (Copilot Studio agents, Azure OpenAI deployments, third-party AI tools) | Excel + JSON | Customer CISO |
| 1.2 | Purview maturity score (0–5 scale): label coverage %, DLP policy coverage, auto-labeling status | PDF dashboard | Customer DPO |
| 1.3 | Entra permission audit (preliminary): count of service principals, over-privileged apps, admin consent grants | Excel pivot table | Customer IAM team |
| 1.4 | Agent 365 gap analysis: current agent governance posture vs Agent 365 best practices | PDF | Customer CTO |
| 1.5 | Risk register: top 5 governance risks with likelihood × impact matrix | PDF | Customer CISO + CTO |

### Phase 2 — Governance Architecture Blueprint (5 days)

| # | Deliverable | Format | Recipient |
|---|---|---|---|
| 2.1 | **Purview Sensitivity Label Taxonomy** — 5-tier label scheme (Public / General / Confidential / Highly Confidential / Restricted AI Output) with auto-labeling conditions | Purview policy JSON + PDF guide | Customer DPO + IT |
| 2.2 | **Agent 365 Configuration Blueprint** — agent registration schema, governance policy templates, lifecycle management procedures | JSON schema + markdown runbook | Customer IT admin |
| 2.3 | **Entra RBAC Model** — Hub roles (VIEWER / OPERATOR / ADMIN) mapped to Entra security groups; service principal permission matrix | Terraform or Bicep IaC + PDF | Customer IAM team |
| 2.4 | **Responsible AI Playbook** (v1) — 6-pillar RAI framework instantiated for the customer's agent estate | PDF + JSON (machine-readable) | Customer CEO/CISO |
| 2.5 | **Kill-Switch Runbook** — who can invoke, escalation chain, re-activation procedures, quarterly drill schedule | Markdown + PDF | Customer IT ops |

### Phase 3 — Implementation (10 days)

| # | Deliverable | Format | Outcome |
|---|---|---|---|
| 3.1 | Purview sensitivity labels applied to customer tenant — all 5 tiers, auto-labeling policies active | Live Purview config | DLP enforcement active |
| 3.2 | Agent 365 configured — all AgentCraftworks agents registered, governance policies applied, suspension tested | Live Agent 365 config | Agent estate visible in Hub |
| 3.3 | Entra service principal audit complete — over-privileged SPs remediated, admin consent reviewed, named owners assigned | Entra audit report + remediation log | Least-privilege posture |
| 3.4 | AgentCraftworks-Hub deployed — connected to customer's Agent 365, Purview, Defender, Entra | Running Hub desktop app | Live monitoring |
| 3.5 | Kill-switch tested — live drill: suspend all agents, verify operations log, re-activate within SLA | Test report | Kill-switch verified |
| 3.6 | Defender for Cloud baseline — alert policies configured for AI workloads | Defender policy export | Alert pipeline active |

### Phase 4 — Handover (2 days)

| # | Deliverable | Format | Recipient |
|---|---|---|---|
| 4.1 | Governance operations runbook — daily, weekly, monthly governance checklist | Markdown | IT ops team |
| 4.2 | Staff workshop (2 hours) — Hub dashboard walkthrough, kill-switch procedures, audit export, label management | Live workshop + recording | CISO + IT leads |
| 4.3 | 30-day email support — post-engagement questions, minor config adjustments | Email SLA: 4 business hours | Customer IT |
| 4.4 | Customer reference agreement — sign-off for AgentCraftworks case study and Microsoft co-sell reference | PDF | Customer marketing |

---

## Offer Positioning

### Target Buyer Profile

| Dimension | Profile |
|---|---|
| **Segment** | Corporate (150–2,000 seats) and SMB (25–150 seats with Compliance requirements) |
| **Buyer** | CISO, CTO, or IT Director |
| **Trigger** | Agent deployment underway; board / regulator asking about AI governance; M365 E5 renewal with Purview add-on in scope |
| **Urgency** | Regulated industries (FSI, Healthcare, Legal, Government) have immediate compliance drivers |
| **Budget** | EC103 has $54.35 PUPM partner opportunity; $30K engagement is easily justified against one regulatory penalty avoided |

### Conversation Anchors (EC103)

- "93% of customers say they'd pay more when partners share risk" — the Governance Blueprint is the risk-transfer offer.
- "Establish a Trusted and Secure Platform for AI" — EC103 is Microsoft's own conversation opener; Hub is the product that proves the narrative.
- "Agent 365 as the control plane" — this is what makes agentic transformation deployable in regulated industries. Without it, your CIO will block agent rollout.
- **Zero Trust Workshop** is a Microsoft-funded pre-sales tool — bring it to every conversation as the no-cost discovery; it positions Governance Blueprint as the natural next step.

### Competitive Differentiation

| Competitor approach | AgentCraftworks Governance Blueprint advantage |
|---|---|
| Microsoft Professional Services | Faster (4 weeks vs 12+); AgentCraftworks IP layer on top of native tools |
| Generic SI governance engagements | Microsoft-native (Purview + Agent 365 + Entra); co-sell backed |
| DIY customer implementation | Fixed price, Frontier-Partner-audited methodology, ongoing managed services option |

---

## Marketplace Listing Details

**Offer type on AppSource:** Consulting offer  
**Duration:** 4 weeks  
**Delivery method:** Remote (with optional on-site for enterprise clients at premium)  
**Industries:** Financial Services, Healthcare, Legal, Government, Professional Services  
**Products:** Microsoft 365, Microsoft Entra, Microsoft Purview, Azure AI  
**Certification badge:** Requires Data Security Specialization (see SPECIALIZATION_TRACKER.md §7) for the certification badge on AppSource listing

### Listing copy (AppSource description — 3,000 char max)

> **Establish AI governance in 4 weeks — with Purview, Agent 365, and Entra, implemented by Frontier AI experts.**
>
> The AgentCraftworks Governance Blueprint is a fixed-scope, 20-day consulting engagement that gives your organization a complete, Microsoft-native AI governance foundation before regulators and boards demand it.
>
> **What you get:**
> - Purview sensitivity label taxonomy applied to your tenant — 5 tiers, auto-labeling active, DLP policies enforced
> - Agent 365 configured as the control plane for every AI agent in your estate — with kill-switch, versioning, and approval workflows
> - Entra permission audit — every over-privileged service principal identified, remediated, and documented
> - AgentCraftworks-Hub deployed — live dashboard showing agent health, API consumption, billing, and governance posture
> - Responsible AI Playbook (v1) — a 6-pillar RAI framework instantiated for your agents, satisfying most enterprise compliance questionnaires
>
> **Pre-funded by Microsoft:** The Secure AI Assessment ($2,500 value) and Zero Trust Workshop ($5,000 value) are included at no additional cost through Microsoft MCI funding.
>
> **Delivered by certified specialists:** Our team holds SC-401, AI-103, and AB-620 certifications and is on the path to the Frontier Partner Specialization.
>
> Regulated industries (FSI, Healthcare, Legal) served. SOC 2 Type II documentation available. GDPR-compliant data handling.

---

## Revenue & Incentive Stacking

| Revenue stream | Amount per engagement | Notes |
|---|---|---|
| Fixed consulting fee | $22,500–$50,000 (net of MCI offset) | Customer pays |
| MCI: Secure AI Assessment | Up to $2,500 | Microsoft pays to partner |
| MCI: Zero Trust Workshop | Up to $5,000 | Microsoft pays to partner |
| MCI: ME5 Usage Accelerator (if customer upgrades to ME5) | Up to $50,000 | Post-deployment incentive |
| Managed services annuity | $2,500–$5,000/month | Recurring; $30K–$60K/year per customer |
| AgentCraftworks-Hub SaaS subscription | $49–$249/month | Marketplace metering |
| **Per-engagement total (Year 1)** | **~$100K–$130K** | Consulting + incentives + managed + SaaS |

With 5 Governance Blueprint engagements per year: **~$500K–$650K revenue**, plus $250K+ recurring managed services ARR building over time.

---

## Quality Assurance & Reference Program

Every Governance Blueprint engagement generates:
1. **Customer reference** (signed in Phase 4.4) → used for M365 Copilot Specialization and Data Security Specialization evidence
2. **Case study** → published on AgentCraftworks website + Microsoft co-sell reference library
3. **Telemetry data** → Hub `TelemetryService` sends anonymized governance posture metrics to AICraftworks internal dashboard (with customer consent) → Customer Zero flywheel

**Target:** 3 completed Governance Blueprints by end of Q2 FY27 → satisfies reference requirements for Data Security Specialization (§7).

---

*Document owner: AgentCraftworks-Hub team + Jen (Founder)*  
*Last updated: 2026-07-28*  
*Offer code: ACW-GOV-001*  
*Strategy reference: AICraftworks FY27 Strategic Analysis, Section 3.2 (EC103)*
