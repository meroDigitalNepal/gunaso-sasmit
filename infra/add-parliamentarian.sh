#!/usr/bin/env bash
# Add a new parliamentarian to the gunaso platform.
# Run from the repo root after provision-shared.sh has been run.
#
# Usage:
#   ./infra/add-parliamentarian.sh <name> <uuid>
#
# Example:
#   ./infra/add-parliamentarian.sh john "$(uuidgen | tr '[:upper:]' '[:lower:]')"
#
# What this script does:
#   1. Creates an Azure Container App for the backend + frontend
#   2. Creates a GitHub environment and sets its secrets
#   3. Creates the parl/<name> branch and pushes it

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <parliamentarian-name> <parliamentarian-uuid>"
  echo "  Example: $0 john 550e8400-e29b-41d4-a716-446655440000"
  exit 1
fi

PARLIAMENTARIAN="$1"
PARLIAMENTARIAN_ID="$2"

# ─── Must match provision-shared.sh ──────────────────────────────────────────
RESOURCE_GROUP="gunaso-rg"
LOCATION="centralindia"
CONTAINER_ENV="gunaso-env"
ACR_NAME="gunasoregistry"
# ─────────────────────────────────────────────────────────────────────────────

CONTAINER_APP_NAME="gunaso-${PARLIAMENTARIAN}"
GITHUB_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

echo "=== Adding parliamentarian: ${PARLIAMENTARIAN} ==="
echo "Container App : $CONTAINER_APP_NAME"
echo "GitHub env    : $PARLIAMENTARIAN"
echo ""

read -rp "Parliamentarian display name (e.g. 'Sasmit Patel'): " PARL_DISPLAY_NAME
read -rp "CORS_ORIGIN (e.g. https://${PARLIAMENTARIAN}.sachivalaya.org): " CORS_ORIGIN
read -rsp "DATABASE_URL (from provision-shared.sh output): " DATABASE_URL
echo ""
echo ""

# Look up shared values from Azure
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)
ENTRA_CLIENT_ID=$(az ad app list --display-name "gunaso" --query "[0].appId" -o tsv)
ENTRA_TENANT_ID=$(az account show --query tenantId -o tsv)

# 1. Seed parliamentarian row in database ─────────────────────────────────────
echo "→ [1/4] Seeding parliamentarian in database..."
if command -v psql &>/dev/null; then
  psql "$DATABASE_URL" -c "
    INSERT INTO parliamentarians (id, name, subdomain)
    VALUES ('${PARLIAMENTARIAN_ID}', '${PARL_DISPLAY_NAME}', '${PARLIAMENTARIAN}')
    ON CONFLICT (id) DO NOTHING;
  "
else
  echo "   psql not found. Run this SQL manually, then press Enter:"
  echo ""
  echo "   INSERT INTO parliamentarians (id, name, subdomain)"
  echo "   VALUES ('${PARLIAMENTARIAN_ID}', '${PARL_DISPLAY_NAME}', '${PARLIAMENTARIAN}')"
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
  --env-vars \
    "DATABASE_URL=secretref:database-url" \
    "PARLIAMENTARIAN_ID=${PARLIAMENTARIAN_ID}" \
    "CORS_ORIGIN=${CORS_ORIGIN}" \
    "ENTRA_TENANT_ID=${ENTRA_TENANT_ID}" \
    "ENTRA_CLIENT_ID=${ENTRA_CLIENT_ID}" \
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
gh api --method PUT "repos/${GITHUB_REPO}/environments/${PARLIAMENTARIAN}" --silent

gh secret set AZURE_CONTAINER_APP_NAME \
  --env "$PARLIAMENTARIAN" --repo "$GITHUB_REPO" --body "$CONTAINER_APP_NAME"

# 4. Create branch and push ───────────────────────────────────────────────────
echo "→ [4/4] Creating branch parl/${PARLIAMENTARIAN}..."
CURRENT_BRANCH=$(git branch --show-current)
git checkout main
git checkout -b "parl/${PARLIAMENTARIAN}" 2>/dev/null || git checkout "parl/${PARLIAMENTARIAN}"
git push -u origin "parl/${PARLIAMENTARIAN}"
git checkout "$CURRENT_BRANCH"

echo ""
echo "✅ ${PARLIAMENTARIAN} setup complete."
echo ""
echo "GitHub Actions will run on the next push to parl/${PARLIAMENTARIAN}."
echo "App will be available at: https://${CONTAINER_APP_FQDN}/gunaso"
echo ""
echo "To add a custom domain (john.sachivalaya.org), configure it in:"
echo "  Azure Portal → Container Apps → $CONTAINER_APP_NAME → Custom domains"
echo ""
echo "To add staff, insert into the users table:"
echo "  INSERT INTO users (id, entra_oid, parliamentarian_id, role)"
echo "  VALUES (gen_random_uuid(), '<entra-object-id>', '${PARLIAMENTARIAN_ID}', 'admin');"
