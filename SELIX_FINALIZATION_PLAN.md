# Selix Finalization Plan

## Product target

Selix is finalized around these fixed rules:

- Client intake is mandatory before account access.
- A client `like` creates an immediate match.
- A chat is opened automatically with the commercial responsible for the matched project.
- A `pass` keeps the project in an ignored history.
- Commercials manage visits and post-visit qualification.
- Promoters only access their business space with an active subscription.
- Admin remains the central operator for users, projects, assignments, subscriptions, and validation workflows.

## Current implementation added

### Backend foundations

- Added promoter subscription domain:
  - `promoter_accounts`
  - `subscription_plans`
  - `promoter_subscriptions`
  - `promoter_payment_requests`
- Added project-level assignments:
  - `project_commercial_assignments`
- Converted promoter-commercial assignment model toward many-to-many by removing the old one-commercial-to-one-promoter constraint.
- Added promoter access restriction helpers based on subscription/account state.
- Added admin APIs for:
  - promoter subscriptions
  - promoter payment requests
  - promoter account status changes
  - project-commercial assignments
- Added promoter APIs for:
  - subscription overview
  - payment request creation
  - payment request history

### Frontend contract

- Added API client methods for new promoter/admin subscription and assignment routes.
- Added promoter summary typing for subscription state.
- Added a first subscription status block in the promoter dashboard.

## Remaining implementation phases

### Phase 1

- Normalize inventory from `projects + unitsJson + properties` into:
  - `projects`
  - `project_units`
  - `project_unit_media`
- Replace `properties` progressively with a read model derived from real units.

### Phase 2

- Replace `swipes/favorites` with a unified `client_project_actions` model.
- Add explicit `matches` and `ignored_projects` tables if a full domain split is preferred.

### Phase 3

- Add post-visit workflow objects:
  - `interest_confirmations`
  - `lead_transfers`
  - `visit_status_history`
- Expose dedicated screens and actions for:
  - confirm interest
  - decline interest
  - request another follow-up

### Phase 4

- Expand admin dashboard sections:
  - payment validation queue
  - expired promoters
  - pending payment promoters
  - project assignment matrix

### Phase 5

- Add support dashboard and ticket triage UX.
- Add audit trail surfaces and business analytics.

## Suggested next coding order

1. Normalize project units and matching source of truth.
2. Add explicit project assignment UI in admin.
3. Add promoter subscription admin UI and payment validation UI.
4. Add client timeline and post-visit interest confirmation UI.
5. Refactor CRM statuses into a clean lead lifecycle state machine.
