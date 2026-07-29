# AgentCraftworks-Hub — Marketplace Listing Architecture
## Transactable SaaS on Microsoft AppSource / Azure Marketplace

**Strategy anchor:** Section 3.3 (Marketplace Listing Strategy) and Section 2.6 (ISV/Partner Co-sell Alignment) of the AICraftworks FY27 Strategic Analysis.

**Goal:** ≥ 3 live Marketplace listings by end of FY27 H1; ≥ 5 listings by end of FY27. Listings unlock the $300B Marketplace opportunity, 3× faster sales cycles, co-sell eligibility, and Frontier Accelerate for Marketplace incentives (launching September 2026).

---

## Listing Portfolio

| # | Offer type | Offer name | Anchor | Target listing date |
|---|---|---|---|---|
| 1 | **Consulting offer** | "Founder's Advantage AgentCraftworks Discovery Workshop" | EC100 / SMB100 | Q1 FY27 |
| 2 | **Consulting offer** | "AgentCraftworks Modernization Sprint (SMB)" | EC106 / OD210 SMB track | Q1 FY27 |
| 3 | **Transactable SaaS** | "Founder's Advantage AgentCraftworks Platform" | EC101 / EC103 / Agent 365 | Q2 FY27 |
| 4 | **Solution accelerator** | "AgentCraftworks Support Triage Agent" | EC105 / OD203 / SMB101 | Q2 FY27 |
| 5 | **Solution accelerator** | "60MinCFO" | SMB103 / EC107 | Q3 FY27 |

---

## Transactable SaaS Offer Architecture — "Founder's Advantage AgentCraftworks Platform"

This is the central listing: AgentCraftworks-Hub packaged as a subscription SaaS product with per-seat metering.

### Subscription Plans

| Plan ID | Plan name | Target buyer | Seats | Price (PUPM) |
|---|---|---|---|---|
| `starter` | Starter | SMB (25–150 seats) | Up to 50 managed agents | $49 |
| `professional` | Professional | SMB-Corporate (150–500) | Up to 200 managed agents | $99 |
| `enterprise` | Enterprise | Corporate / Majors | Unlimited; SLA | $249 |
| `gov` | Government | Public sector / Sovereign | Custom pricing | Contact sales |

> Price anchored to Microsoft's `$104 PUPM per SMB customer` services benchmark (SMB100) and `$47.2 PUPM` M365 Copilot Deployment Accelerator floor (M365 Copilot Spec).

### Metering Dimensions

Per the [Azure Marketplace custom metering API](https://learn.microsoft.com/azure/marketplace/partner-center-portal/saas-metered-billing), Hub will emit usage events for dimensions beyond the flat seat subscription:

| Dimension ID | Description | Unit | Included in plan | Overage price |
|---|---|---|---|---|
| `agent_run` | Individual agent execution (Agent 365 run event) | per 1,000 runs | 50K / month (Professional) | $0.005 / run |
| `audit_export` | Signed audit package export | per export | 5 / month | $10 / export |
| `kill_switch_event` | Emergency kill-switch invocation (T1 action) | per event | Unlimited | Free |
| `purview_scan` | Purview DLP scan of agent output | per 1,000 scans | 10K / month | $0.003 / scan |
| `rai_report` | RAI Playbook status report (MCP tool call) | per report | 10 / month | $2 / report |
| `foundry_token` | Azure AI Foundry tokens proxied through Hub | per 1M tokens | None (pass-through) | Cost + 12% margin |

### Metering Implementation

```
src/main/marketplace/
├── MeteringService.ts        ← Azure Marketplace metering API client
├── MeteringBuffer.ts         ← Batches events; flushes every 1 hour (API requirement)
├── SubscriptionStore.ts      ← Stores active subscriptions (SaaS subscription ID, plan, seat count)
└── WebhookHandler.ts         ← Handles Azure Marketplace SaaS webhook events
```

**`MeteringService.ts` key interface:**
```typescript
interface MeteringEvent {
  resourceId: string          // SaaS subscription resource ID from Azure
  quantity: number
  dimension: MeteringDimension
  effectiveStartTime: string  // ISO 8601, UTC
  planId: string
}

class MeteringService {
  async emitUsage(event: MeteringEvent): Promise<void>
  async batchEmitUsage(events: MeteringEvent[]): Promise<void>
  async getSubscription(subscriptionId: string): Promise<SaasSubscription>
}
```

**Webhook events to handle** (Azure sends these to `POST /api/marketplace/webhook`):

| Event type | Handler action |
|---|---|
| `Subscribed` | Create local subscription record; provision Hub tenant config |
| `Unsubscribed` | Suspend tenant; retain data 90 days per GDPR |
| `SuspendedSubscription` | Soft-suspend; disable metering emission |
| `ReinstatedSubscription` | Re-activate; resume metering |
| `ChangePlan` | Update plan ID + recalculate included quantities |
| `ChangeQuantity` | Update seat count |
| `Renew` | Log renewal; reset monthly counters |

### SaaS Landing Page

Required by Azure Marketplace for transactable offers.

```
src/renderer/marketplace/
├── LandingPage.tsx     ← Post-purchase activation page (token exchange → provision)
├── AccountPage.tsx     ← Subscription management (plan, seats, usage, invoices)
└── api/
    └── saas-activate.ts  ← Exchange marketplace token for subscription details
```

Landing page flow:
1. Buyer clicks "Get it now" on Marketplace → redirected to `https://hub.agentcraftworks.com/activate?token=<MP_TOKEN>`
2. `LandingPage.tsx` exchanges token via `GET /saas/subscriptions/{token}` (Azure SaaS Fulfillment API v2)
3. Buyer completes onboarding (Entra tenant ID, admin email, plan confirmation)
4. Hub calls `POST /saas/subscriptions/{subscriptionId}/activate`
5. Tenant config provisioned; user redirected to Hub dashboard

---

## ISV Success Enrollment Checklist

**Program:** [ISV Success](https://aka.ms/ISVSuccess)  
**What it unlocks:** Azure credits ($2,500–$150K), ISV engagement manager, GTM support, co-sell eligibility, Marketplace Rewards, Frontier Accelerate for Marketplace (September 2026).

### Pre-enrollment Requirements

- [ ] Active Microsoft AI Cloud Partner Program (MAICPP) membership
- [ ] Company account in Partner Center (`partner.microsoft.com`)
- [ ] At least one Solutions Partner Designation (Modern Work recommended first — Q1 FY27)
- [ ] DUNS number (required for legal entity validation)
- [ ] Signed Microsoft Publisher Agreement (MPA) in Partner Center

### Enrollment Steps

1. **Register** at `aka.ms/ISVSuccess` → select "Build and Sell on the Microsoft Cloud"
2. **Create publisher profile** in Partner Center → Commercial Marketplace → Overview
3. **Verify identity** → Microsoft validates company identity via DUNS + business email domain
4. **Accept MPA** (Microsoft Publisher Agreement) — required before any listing
5. **Set up payout account** → bank account + tax profile (W-9 for US, W-8BEN-E for international)
6. **Request engagement manager** → assigned within 5 business days of enrollment
7. **Activate Azure credits** → $2,500 dev/test credits available immediately on enrollment
8. **Schedule technical consultation** → ISV Success includes 2 × 1-hour architecture reviews

### Listing Creation Checklist

For each offer:

- [ ] Offer type selected (Consulting / Transactable SaaS / Solution accelerator)
- [ ] Offer name, description (160-char summary + 3,000-char long description)
- [ ] Logo assets: 48×48 (icon), 90×90 (small), 216×216 (medium), 255×115 (wide), 815×290 (hero)
- [ ] Screenshots: min 5 × 1280×720, showing real product (not mockups)
- [ ] Supplemental PDFs: solution brief, data sheet
- [ ] Video (optional but strongly recommended): <90 seconds, hosted on YouTube
- [ ] Categories: `AI + Machine Learning` + `Developer Tools` (AppSource); `AI + Machine Learning` (Azure MP)
- [ ] Industries: `Financial Services`, `Professional Services`
- [ ] Legal: Privacy Policy URL, Terms of Use URL
- [ ] Support: Support URL, Engineering contact email, CSP opt-in (recommended for SMB reach)
- [ ] **For transactable SaaS:** plans configured (see above), metering dimensions published, webhook endpoint validated, landing page URL confirmed reachable by Microsoft
- [ ] Preview audience configured (internal test before go-live)
- [ ] Co-sell ready status: Partner Solution registered, reference architecture diagram, co-sell pitch deck

### Co-sell Eligibility Milestones

| Milestone | Requirement | Unlocks |
|---|---|---|
| **Marketplace Ready** | Active listing, any offer type | Marketplace Rewards tier 1 |
| **Co-sell Ready** | Partner Solution + reference architecture + 1 customer reference | Microsoft seller referrals |
| **Azure IP Co-sell** | Transactable offer + $100K ACR threshold | Field incentivized co-sell; Frontier Accelerate for Marketplace (Sept 2026) |
| **Business Applications Premium** | D365/Power Platform transactable offer | BizApps co-sell + Dynamics 365 deployment accelerator |

### Frontier Accelerate for Marketplace (September 2026)

Microsoft is unifying ISV Success + Marketplace Rewards + Azure IP co-sell + Certified Software Designation into **Frontier Accelerate for Marketplace** launching September 2026. Actions before September:

- [ ] Transactable SaaS offer live (required for Azure IP co-sell eligibility)
- [ ] Marketplace Rewards enrolled (`partner.microsoft.com/rewards`)
- [ ] Co-sell Ready status achieved
- [ ] Certified Software Designation pursued (announced alongside Frontier Accelerate for MP)

---

## Multiparty Private Offer (MPO) Strategy

Per OD211: MPOs deliver 80% larger channel deals. AgentCraftworks-Hub should use MPOs for enterprise deals going through CSP partners.

**MPO flow:**
1. Hub creates private offer in Partner Center → targets specific CSP partner + end customer
2. Custom pricing (discount from list price, or extended payment terms)
3. CSP partner re-sells to end customer through their procurement channel
4. Hub retains metering revenue; CSP partner gets margin
5. Available in 30+ markets, 15+ currencies, 50+ tax regions

**When to use MPO:** Any deal > $50K ACV or with a named CSP partner relationship.

---

## Technical Prerequisites

### Azure SaaS Fulfillment API v2

```typescript
// Authentication: service principal (client_credentials grant)
// Base URL: https://marketplaceapi.microsoft.com/api/saas

// Key endpoints:
GET  /subscriptions/{subscriptionId}          // Get subscription details
POST /subscriptions/{subscriptionId}/activate // Activate after purchase
GET  /subscriptions/{subscriptionId}/operations  // List pending operations
PATCH /subscriptions/{subscriptionId}/operations/{operationId}  // Ack operation
```

### Azure Marketplace Metering API

```typescript
// Authentication: Azure AD managed identity (preferred) or service principal
// Base URL: https://marketplaceapi.microsoft.com/api

POST /usageEvent            // Single usage event
POST /usageEventBatch       // Batch (up to 25 events per call)
```

**Implementation notes:**
- Emit usage events within 1 hour of the chargeable activity (API enforces 24-hour tolerance; bill for hours missed)
- Store `resourceId` (SaaS subscription ID) in `SubscriptionStore` — never use tenant ID or user ID
- Idempotency: include `correlationId` per event; API deduplicates within 24 hours
- Test in Marketplace sandbox before production listing (`isTest: true` flag)

### Environment Variables Required

```env
AZURE_MARKETPLACE_CLIENT_ID=<service-principal-app-id>
AZURE_MARKETPLACE_CLIENT_SECRET=<sp-secret>
AZURE_MARKETPLACE_TENANT_ID=<publisher-tenant-id>
AZURE_MARKETPLACE_PUBLISHER_ID=<partner-center-publisher-id>
MARKETPLACE_WEBHOOK_SECRET=<hmac-secret-for-webhook-validation>
```

---

## Revenue Model (SaaS Offer)

Based on Microsoft OD211 benchmarks and SMB101 economics:

| Scenario | Year 1 revenue | Year 2 ARR |
|---|---|---|
| 10 SMB customers (Starter plan, avg 25 agents) | $14,700 | $14,700 |
| 5 Professional customers (avg 100 agents) | $59,400 | $59,400 |
| 2 Enterprise customers | $71,640 | $71,640 |
| Overage metering (conservative) | $18,000 | $36,000 |
| **Total** | **$163,740** | **$181,740** |

With co-sell and Multiparty Private Offers, Microsoft's benchmark projects 3× faster sales cycles and 80% larger deals → Year 2 target with 5 Enterprise + 15 Professional + 20 SMB = **~$750K ARR**.

---

*Document owner: AgentCraftworks-Hub team*
*Last updated: 2026-07-28*
*Strategy reference: AICraftworks FY27 Strategic Analysis, Sections 3.3, 2.6*
