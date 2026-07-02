#!/usr/bin/env bash
# Add a new MP to the gunaso platform.
# Run from the repo root after provision-shared.sh has been run.
#
# Usage:
#   ./infra/add-mp.sh <name> <uuid>
#
# Example:
#   ./infra/add-mp.sh john "$(uuidgen | tr '[:upper:]' '[:lower:]')"
#
# What this script does:
#   1. Seeds the MP row in the database
#   2. Creates an Azure Container App for the backend + frontend
#   3. Creates a GitHub environment and sets its secrets
#   4. Creates the mp/<name> branch and pushes it

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <mp-name> <mp-uuid>"
  echo "  Example: $0 john 550e8400-e29b-41d4-a716-446655440000"
  exit 1
fi

MP="$1"
MP_ID="$2"

# ─── Must match provision-shared.sh ──────────────────────────────────────────
RESOURCE_GROUP="gunaso-rg"
LOCATION="centralindia"
CONTAINER_ENV="gunaso-env"
ACR_NAME="gunasoregistry"
# Shared across all MP branches — one Graph app registration + sender mailbox
MAIL_SENDER_ADDRESS="noreply@sachivalaya.org"
# ─────────────────────────────────────────────────────────────────────────────

CONTAINER_APP_NAME="gunaso-${MP}"
GITHUB_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

echo "=== Adding MP: ${MP} ==="
echo "Container App : $CONTAINER_APP_NAME"
echo "GitHub env    : $MP"
echo ""

read -rp "MP display name (e.g. 'John Doe'): " MP_DISPLAY_NAME
read -rp "CORS_ORIGIN (e.g. https://${MP}.sachivalaya.org): " CORS_ORIGIN
read -rp "PUBLIC_APP_URL (e.g. https://${MP}.sachivalaya.org/gunaso): " PUBLIC_APP_URL
read -rsp "DATABASE_URL (from provision-shared.sh output): " DATABASE_URL
echo ""
read -rsp "GRAPH_CLIENT_SECRET (from the gunaso-mail app registration): " GRAPH_CLIENT_SECRET
echo ""
echo ""

# Look up shared values from Azure
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)
ENTRA_CLIENT_ID=$(az ad app list --display-name "gunaso" --query "[0].appId" -o tsv)
ENTRA_TENANT_ID=$(az ad sp show --id "$ENTRA_CLIENT_ID" --query "appOwnerOrganizationId" -o tsv)
GRAPH_CLIENT_ID=$(az ad app list --display-name "gunaso-mail" --query "[0].appId" -o tsv)

# 1. Seed MP row in database ──────────────────────────────────────────────────
echo "→ [1/4] Seeding MP in database..."
if command -v psql &>/dev/null; then
  psql "$DATABASE_URL" -c "
    INSERT INTO mps (id, name, subdomain)
    VALUES ('${MP_ID}', '${MP_DISPLAY_NAME}', '${MP}')
    ON CONFLICT (id) DO NOTHING;
  "
else
  echo "   psql not found. Run this SQL manually, then press Enter:"
  echo ""
  echo "   INSERT INTO mps (id, name, subdomain)"
  echo "   VALUES ('${MP_ID}', '${MP_DISPLAY_NAME}', '${MP}')"
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
  --env-vars \
    "DATABASE_URL=secretref:database-url" \
    "MP_ID=${MP_ID}" \
    "CORS_ORIGIN=${CORS_ORIGIN}" \
    "PUBLIC_APP_URL=${PUBLIC_APP_URL}" \
    "ENTRA_TENANT_ID=${ENTRA_TENANT_ID}" \
    "ENTRA_CLIENT_ID=${ENTRA_CLIENT_ID}" \
    "GRAPH_CLIENT_ID=${GRAPH_CLIENT_ID}" \
    "GRAPH_CLIENT_SECRET=secretref:graph-client-secret" \
    "MAIL_SENDER_ADDRESS=${MAIL_SENDER_ADDRESS}" \
    "NODE_ENV=production" \
    "PORT=3001" \
  --output none

CONTAINER_APP_FQDN=$(az containerapp show \
  --name "$CONTAINER_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "   Container App URL: https://$CONTAINER_APP_FQDN"

# 3. Create GitHub environment and set secrets ─────────────────────────────────
echo "→ [3/4] Creating GitHub environment and setting secrets..."
gh api --method PUT "repos/${GITHUB_REPO}/environments/${MP}" --silent

gh secret set AZURE_CONTAINER_APP_NAME \
  --env "$MP" --repo "$GITHUB_REPO" --body "$CONTAINER_APP_NAME"

# 4. Create branch and push ───────────────────────────────────────────────────
echo "→ [4/4] Creating branch mp/${MP}..."
CURRENT_BRANCH=$(git branch --show-current)
git checkout main
git checkout -b "mp/${MP}" 2>/dev/null || git checkout "mp/${MP}"
git push -u origin "mp/${MP}"
git checkout "$CURRENT_BRANCH"

echo ""
echo "✅ ${MP} setup complete."
echo ""
echo "GitHub Actions will run on the next push to mp/${MP}."
echo "App will be available at: https://${CONTAINER_APP_FQDN}/gunaso"
echo ""
echo "To add a custom domain (${MP}.sachivalaya.org), configure it in:"
echo "  Azure Portal → Container Apps → $CONTAINER_APP_NAME → Custom domains"
echo ""
echo "To add staff, insert into the users table:"
echo "  INSERT INTO users (id, entra_oid, mp_id, role)"
echo "  VALUES (gen_random_uuid(), '<entra-object-id>', '${MP_ID}', 'admin');"
