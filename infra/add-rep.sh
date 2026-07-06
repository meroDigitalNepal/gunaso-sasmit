#!/usr/bin/env bash
# Add a new Representative to the gunaso platform.
# Run from the repo root after provision-shared.sh has been run.
#
# Usage:
#   ./infra/add-rep.sh <name> <uuid>
#
# Example:
#   ./infra/add-rep.sh john "$(uuidgen | tr '[:upper:]' '[:lower:]')"
#
# What this script does:
#   1. Seeds the Representative row in the database
#   2. Creates an Azure Container App for the backend + frontend
#   3. Creates a GitHub environment (with required-reviewer approval) and sets its secrets
#   4. Prints the remaining fork-based deploy setup steps (see CONTRIBUTING.md)

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <rep-name> <rep-uuid>"
  echo "  Example: $0 john 550e8400-e29b-41d4-a716-446655440000"
  exit 1
fi

REP="$1"
MP_ID="$2"

# ─── Must match provision-shared.sh ──────────────────────────────────────────
RESOURCE_GROUP="gunaso-rg"
LOCATION="centralindia"
CONTAINER_ENV="gunaso-env"
ACR_NAME="gunasoregistry"
# Shared across all Representative deployments — one Graph app registration + sender mailbox
MAIL_SENDER_ADDRESS="noreply@sachivalaya.org"
# Shared across all Representative deployments — one Storage Account + container
AZURE_STORAGE_CONTAINER="submission-attachments"
# ─────────────────────────────────────────────────────────────────────────────

CONTAINER_APP_NAME="gunaso-${REP}"
GITHUB_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

echo "=== Adding Representative: ${REP} ==="
echo "Container App : $CONTAINER_APP_NAME"
echo "GitHub env    : $REP"
echo ""

read -rp "Representative display name (e.g. 'John Doe'): " REP_DISPLAY_NAME
read -rp "CORS_ORIGIN (e.g. https://${REP}.sachivalaya.org): " CORS_ORIGIN
read -rp "PUBLIC_APP_URL (e.g. https://${REP}.sachivalaya.org/gunaso): " PUBLIC_APP_URL
read -rsp "DATABASE_URL (from provision-shared.sh output): " DATABASE_URL
echo ""
read -rsp "GRAPH_CLIENT_SECRET (from the gunaso-mail app registration): " GRAPH_CLIENT_SECRET
echo ""
read -rsp "TURNSTILE_SECRET_KEY (from the Cloudflare Turnstile dashboard): " TURNSTILE_SECRET_KEY
echo ""
read -rsp "AZURE_STORAGE_CONNECTION_STRING (from the shared Storage Account): " AZURE_STORAGE_CONNECTION_STRING
echo ""
echo ""

# Look up shared values from Azure
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)
ENTRA_CLIENT_ID=$(az ad app list --display-name "gunaso" --query "[0].appId" -o tsv)
ENTRA_TENANT_ID=$(az ad sp show --id "$ENTRA_CLIENT_ID" --query "appOwnerOrganizationId" -o tsv)
GRAPH_CLIENT_ID=$(az ad app list --display-name "gunaso-mail" --query "[0].appId" -o tsv)

# 1. Seed Representative row in database ──────────────────────────────────────
echo "→ [1/4] Seeding Representative in database..."
if command -v psql &>/dev/null; then
  psql "$DATABASE_URL" -c "
    INSERT INTO mps (id, name, subdomain)
    VALUES ('${MP_ID}', '${REP_DISPLAY_NAME}', '${REP}')
    ON CONFLICT (id) DO NOTHING;
  "
else
  echo "   psql not found. Run this SQL manually, then press Enter:"
  echo ""
  echo "   INSERT INTO mps (id, name, subdomain)"
  echo "   VALUES ('${MP_ID}', '${REP_DISPLAY_NAME}', '${REP}')"
  echo "   ON CONFLICT (id) DO NOTHING;"
  echo ""
  read -rp "   Press Enter once done..."
fi

# 2. Create Container App ─────────────────────────────────────────────────────
echo "→ [2/4] Creating Container App..."

az containerapp create \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --environment "$CONTAINER_ENV" \
  --image "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest" \
  --target-port 3001 \
  --ingress external \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --cpu 0.25 \
  --memory 0.5Gi \
  --min-replicas 0 \
  --max-replicas 3 \
  --secrets \
    "database-url=${DATABASE_URL}" \
    "graph-client-secret=${GRAPH_CLIENT_SECRET}" \
    "turnstile-secret-key=${TURNSTILE_SECRET_KEY}" \
    "azure-storage-connection-string=${AZURE_STORAGE_CONNECTION_STRING}" \
  --env-vars \
    "DATABASE_URL=secretref:database-url" \
    "MP_ID=${MP_ID}" \
    "MP_NAME=${REP_DISPLAY_NAME}" \
    "CORS_ORIGIN=${CORS_ORIGIN}" \
    "PUBLIC_APP_URL=${PUBLIC_APP_URL}" \
    "ENTRA_TENANT_ID=${ENTRA_TENANT_ID}" \
    "ENTRA_CLIENT_ID=${ENTRA_CLIENT_ID}" \
    "GRAPH_CLIENT_ID=${GRAPH_CLIENT_ID}" \
    "GRAPH_CLIENT_SECRET=secretref:graph-client-secret" \
    "MAIL_SENDER_ADDRESS=${MAIL_SENDER_ADDRESS}" \
    "TURNSTILE_SECRET_KEY=secretref:turnstile-secret-key" \
    "AZURE_STORAGE_CONNECTION_STRING=secretref:azure-storage-connection-string" \
    "AZURE_STORAGE_CONTAINER=${AZURE_STORAGE_CONTAINER}" \
    "NODE_ENV=production" \
    "PORT=3001" \
  --output none

CONTAINER_APP_FQDN=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "   Container App URL: https://$CONTAINER_APP_FQDN"

# 3. Create GitHub environment with required reviewer, and set secrets ─────────
echo "→ [3/4] Creating GitHub environment..."
ORG="${GITHUB_REPO%/*}"
DEFAULT_REVIEWER_TEAM="maintainers"
read -rp "GitHub team required to approve ${REP}'s deploys [${DEFAULT_REVIEWER_TEAM}]: " REVIEWER_TEAM
REVIEWER_TEAM="${REVIEWER_TEAM:-$DEFAULT_REVIEWER_TEAM}"
REVIEWER_TEAM_ID="$(gh api "orgs/${ORG}/teams/${REVIEWER_TEAM}" --jq .id)"
gh api --method PUT "repos/${GITHUB_REPO}/environments/${REP}" \
  -f 'reviewers[][type]=Team' -F "reviewers[][id]=${REVIEWER_TEAM_ID}" --silent
echo "   Deploys to '${REP}' now require approval from any '${REVIEWER_TEAM}' team member."

gh secret set AZURE_CONTAINER_APP_NAME \
  --env "$REP" --repo "$GITHUB_REPO" --body "$CONTAINER_APP_NAME"

# 4. Fork-based deploy setup ───────────────────────────────────────────────────
# This repo has no branch-push deploy trigger anymore — ${REP} deploys from
# their own fork via repository_dispatch. Forking and PAT issuance can't be
# scripted (they require a human on GitHub's website), so print the checklist.
echo "→ [4/4] Remaining setup (manual — see CONTRIBUTING.md):"
echo "   1. Fork ${GITHUB_REPO} — to ${REP}'s personal account, or an org-owned"
echo "      fork (e.g. ${GITHUB_REPO%/*}/${GITHUB_REPO#*/}-${REP})."
echo "   2. Enable Actions on that fork: Settings → Actions → General."
echo "   3. Generate a fine-grained PAT scoped to only ${GITHUB_REPO} with"
echo "      'Contents: Read and write' permission:"
echo "      https://github.com/settings/personal-access-tokens/new"
echo "   4. On the fork, set repository variable REP_NAME=${REP} and repository"
echo "      secret UPSTREAM_DISPATCH_TOKEN=<the PAT from step 3>."

echo ""
echo "✅ ${REP} setup complete."
echo ""
echo "Once the fork is set up, a push to its main branch triggers a deploy that"
echo "pauses for '${REVIEWER_TEAM}' team approval. Until then, deploy manually via:"
echo "  gh workflow run azure-deploy.yml -f rep=${REP}"
echo "App will be available at: https://${CONTAINER_APP_FQDN}/gunaso"
echo ""
echo "To add a custom domain (${REP}.sachivalaya.org), configure it in:"
echo "  Azure Portal → Container Apps → $CONTAINER_APP_NAME → Custom domains"
echo ""
echo "To add staff, insert into the users table:"
echo "  INSERT INTO users (id, entra_oid, mp_id, role)"
echo "  VALUES (gen_random_uuid(), '<entra-object-id>', '${MP_ID}', 'admin');"
