#!/usr/bin/env bash
# Run ONCE to provision all shared Azure resources for the gunaso platform.
#
# Prerequisites (install on macOS with brew):
#   brew install azure-cli gh
#   az login
#   gh auth login
#
# After this script finishes, run:
#   ./infra/add-parliamentarian.sh <name> <uuid>
# for each parliamentarian to create their Container App and Static Web App.

set -euo pipefail

# ─── CONFIGURATION — edit before first run ───────────────────────────────────
RESOURCE_GROUP="gunaso-rg"
LOCATION="centralindia"        # Closest Azure region to Nepal; change if needed
ACR_NAME="gunasoregistry"      # Must be globally unique; lowercase alphanumeric only
LOG_ANALYTICS_WS="gunaso-logs"
CONTAINER_ENV="gunaso-env"
DB_SERVER="gunaso-pg"          # Must be globally unique; lowercase alphanumeric + hyphens
DB_NAME="gunaso"
DB_ADMIN_USER="gunasodbadmin"
# ─────────────────────────────────────────────────────────────────────────────

GITHUB_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

echo "=== gunaso: provisioning shared Azure resources ==="
echo "Resource group : $RESOURCE_GROUP ($LOCATION)"
echo "ACR            : $ACR_NAME"
echo "PostgreSQL     : $DB_SERVER.$LOCATION"
echo "GitHub repo    : $GITHUB_REPO"
echo ""

read -rsp "PostgreSQL admin password (min 8 chars, mix of upper/lower/digit/symbol): " DB_ADMIN_PASSWORD
echo ""
echo ""

# 1. Resource group ─────────────────────────────────────────────────────────
echo "→ [1/8] Creating resource group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# 2. Container Registry ─────────────────────────────────────────────────────
echo "→ [2/8] Creating Azure Container Registry..."
az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku Basic \
  --admin-enabled true \
  --output none

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

# 3. Log Analytics workspace ─────────────────────────────────────────────────
echo "→ [3/8] Creating Log Analytics workspace..."
az monitor log-analytics workspace create \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WS" \
  --location "$LOCATION" \
  --output none

LOG_WS_ID=$(az monitor log-analytics workspace show \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WS" \
  --query customerId -o tsv)
LOG_WS_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS_WS" \
  --query primarySharedKey -o tsv)

# 4. Container Apps environment ───────────────────────────────────────────────
echo "→ [4/8] Creating Container Apps environment..."
az containerapp env create \
  --name "$CONTAINER_ENV" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --logs-workspace-id "$LOG_WS_ID" \
  --logs-workspace-key "$LOG_WS_KEY" \
  --output none

# 5. PostgreSQL Flexible Server ───────────────────────────────────────────────
echo "→ [5/8] Creating PostgreSQL Flexible Server (takes ~3 minutes)..."
az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DB_SERVER" \
  --location "$LOCATION" \
  --admin-user "$DB_ADMIN_USER" \
  --admin-password "$DB_ADMIN_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --public-access 0.0.0.0 \
  --output none

az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$DB_SERVER" \
  --database-name "$DB_NAME" \
  --output none

DATABASE_URL="postgresql://${DB_ADMIN_USER}:${DB_ADMIN_PASSWORD}@${DB_SERVER}.postgres.database.azure.com:5432/${DB_NAME}?sslmode=require"

# 6. Service principal for GitHub Actions ─────────────────────────────────────
echo "→ [6/8] Creating GitHub Actions service principal..."
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

SP_JSON=$(az ad sp create-for-rbac \
  --name "gunaso-github-actions" \
  --role contributor \
  --scopes "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}" \
  --only-show-errors)

AZURE_CLIENT_ID=$(echo "$SP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['appId'])")
AZURE_CLIENT_SECRET=$(echo "$SP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")

# AcrPush role so the SP can push Docker images
az role assignment create \
  --assignee "$AZURE_CLIENT_ID" \
  --role AcrPush \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ContainerRegistry/registries/${ACR_NAME}" \
  --output none 2>/dev/null || true

# 7. Entra app registration for staff auth ─────────────────────────────────────
echo "→ [7/8] Creating Entra app registration..."
APP_JSON=$(az ad app create \
  --display-name "gunaso" \
  --sign-in-audience AzureADMyOrg \
  --only-show-errors)
ENTRA_CLIENT_ID=$(echo "$APP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['appId'])")

# Service principal so users can sign in
az ad sp create --id "$ENTRA_CLIENT_ID" --output none 2>/dev/null || true

# Expose an API scope the frontend can request
az ad app update \
  --id "$ENTRA_CLIENT_ID" \
  --identifier-uris "api://${ENTRA_CLIENT_ID}" \
  --output none

# Add a redirect URI for popup login (add more per environment as you deploy)
az ad app update \
  --id "$ENTRA_CLIENT_ID" \
  --web-redirect-uris "http://localhost:5173" \
  --output none

ENTRA_AUTHORITY="https://login.microsoftonline.com/${TENANT_ID}"
ENTRA_SCOPE="api://${ENTRA_CLIENT_ID}/.default"

# 8. Set GitHub repo-level secrets ────────────────────────────────────────────
echo "→ [8/8] Setting GitHub repo secrets..."
gh secret set AZURE_CLIENT_ID       --repo "$GITHUB_REPO" --body "$AZURE_CLIENT_ID"
gh secret set AZURE_CLIENT_SECRET   --repo "$GITHUB_REPO" --body "$AZURE_CLIENT_SECRET"
gh secret set AZURE_SUBSCRIPTION_ID --repo "$GITHUB_REPO" --body "$SUBSCRIPTION_ID"
gh secret set AZURE_TENANT_ID       --repo "$GITHUB_REPO" --body "$TENANT_ID"
gh secret set ACR_LOGIN_SERVER      --repo "$GITHUB_REPO" --body "$ACR_LOGIN_SERVER"
gh secret set ACR_USERNAME          --repo "$GITHUB_REPO" --body "$ACR_USERNAME"
gh secret set ACR_PASSWORD          --repo "$GITHUB_REPO" --body "$ACR_PASSWORD"
gh secret set AZURE_RESOURCE_GROUP  --repo "$GITHUB_REPO" --body "$RESOURCE_GROUP"
gh secret set DATABASE_URL          --repo "$GITHUB_REPO" --body "$DATABASE_URL"
gh secret set ENTRA_CLIENT_ID       --repo "$GITHUB_REPO" --body "$ENTRA_CLIENT_ID"
gh secret set VITE_ENTRA_AUTHORITY  --repo "$GITHUB_REPO" --body "$ENTRA_AUTHORITY"
gh secret set VITE_ENTRA_API_SCOPE  --repo "$GITHUB_REPO" --body "$ENTRA_SCOPE"

echo ""
echo "✅ Shared resources provisioned and GitHub secrets set."
echo ""
echo "IMPORTANT — save these values in your password manager:"
echo "  DB admin password : (what you entered above)"
echo "  Entra client ID   : $ENTRA_CLIENT_ID"
echo "  Entra authority   : $ENTRA_AUTHORITY"
echo "  Entra scope       : $ENTRA_SCOPE"
echo "  ACR login server  : $ACR_LOGIN_SERVER"
echo ""
echo "Next steps:"
echo "  1. Add redirect URIs for each parliamentarian's subdomain to the Entra app:"
echo "     az ad app update --id $ENTRA_CLIENT_ID --web-redirect-uris \\"
echo "       'http://localhost:5173' 'https://sasmit.sachivalaya.com' ..."
echo ""
echo "  2. Add each parliamentarian:"
echo "     ./infra/add-parliamentarian.sh <name> \"\$(uuidgen | tr '[:upper:]' '[:lower:]')\""
