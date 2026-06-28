#!/usr/bin/env bash
# Provision all shared Azure resources for the gunaso platform.
# Safe to re-run — each step skips creation if the resource already exists.
#
# Prerequisites (install on macOS with brew):
#   brew install azure-cli gh
#   az login
#   gh auth login
#
# After this script finishes, run:
#   ./infra/add-parliamentarian.sh <name> <uuid>
# for each parliamentarian to create their Container App.

set -euo pipefail

# ─── CONFIGURATION — edit before first run ───────────────────────────────────
RESOURCE_GROUP="gunaso-rg"
LOCATION="centralindia"        # Closest Azure region to Nepal; change if needed
ACR_NAME="gunasoregistry"      # Must be globally unique; lowercase alphanumeric only
CONTAINER_ENV="gunaso-env"
DB_SERVER="gunaso-pg"          # Must be globally unique; lowercase alphanumeric + hyphens
DB_NAME="gunaso"
DB_ADMIN_USER="gunasodbadmin"
SP_NAME="gunaso-github-actions"
ENTRA_APP_NAME="gunaso"
# ─────────────────────────────────────────────────────────────────────────────

GITHUB_REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

echo "=== gunaso: provisioning shared Azure resources ==="
echo "Resource group : $RESOURCE_GROUP ($LOCATION)"
echo "ACR            : $ACR_NAME"
echo "PostgreSQL     : $DB_SERVER"
echo "GitHub repo    : $GITHUB_REPO"
echo ""

read -rsp "PostgreSQL admin password (min 8 chars, mix of upper/lower/digit/symbol): " DB_ADMIN_PASSWORD
echo ""
echo ""

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

# 1. Resource group ─────────────────────────────────────────────────────────
echo "→ [1/7] Resource group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# 2. Container Registry ─────────────────────────────────────────────────────
echo "→ [2/7] Container Registry..."
if ! az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az acr create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$ACR_NAME" \
    --sku Basic \
    --admin-enabled true \
    --output none
else
  echo "   (already exists, skipping)"
fi
ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

# 3. Container Apps environment ───────────────────────────────────────────────
echo "→ [3/7] Container Apps environment..."
if ! az containerapp env show --name "$CONTAINER_ENV" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  az containerapp env create \
    --name "$CONTAINER_ENV" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --logs-destination none \
    --output none
else
  echo "   (already exists, skipping)"
fi

# 4. PostgreSQL Flexible Server ───────────────────────────────────────────────
echo "→ [4/7] PostgreSQL Flexible Server..."
if ! az postgres flexible-server show --name "$DB_SERVER" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  echo "   (creating server — takes ~3 minutes)"
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
else
  echo "   (server already exists, skipping)"
fi
if ! az postgres flexible-server db show \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$DB_SERVER" \
  --database-name "$DB_NAME" &>/dev/null; then
  echo "   (creating database)"
  az postgres flexible-server db create \
    --resource-group "$RESOURCE_GROUP" \
    --server-name "$DB_SERVER" \
    --name "$DB_NAME" \
    --output none
else
  echo "   (database already exists, skipping)"
fi
DATABASE_URL="postgresql://${DB_ADMIN_USER}:${DB_ADMIN_PASSWORD}@${DB_SERVER}.postgres.database.azure.com:5432/${DB_NAME}?sslmode=require"

# 5. Service principal for GitHub Actions ─────────────────────────────────────
echo "→ [5/7] GitHub Actions service principal..."
EXISTING_SP=$(az ad sp list --display-name "$SP_NAME" --query "[0].appId" -o tsv 2>/dev/null || true)
if [[ -z "$EXISTING_SP" ]]; then
  SP_JSON=$(az ad sp create-for-rbac \
    --name "$SP_NAME" \
    --role contributor \
    --scopes "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}" \
    --only-show-errors)
  AZURE_CLIENT_ID=$(echo "$SP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['appId'])")
  AZURE_CLIENT_SECRET=$(echo "$SP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")
else
  echo "   (already exists — resetting credentials)"
  AZURE_CLIENT_ID="$EXISTING_SP"
  AZURE_CLIENT_SECRET=$(az ad app credential reset --id "$AZURE_CLIENT_ID" \
    --only-show-errors --query password -o tsv)
fi
az role assignment create \
  --assignee "$AZURE_CLIENT_ID" \
  --role AcrPush \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ContainerRegistry/registries/${ACR_NAME}" \
  --output none 2>/dev/null || true

# 6. Entra app registration for staff auth ─────────────────────────────────────
echo "→ [6/7] Entra app registration..."
EXISTING_APP=$(az ad app list --display-name "$ENTRA_APP_NAME" --query "[0].appId" -o tsv 2>/dev/null || true)
if [[ -z "$EXISTING_APP" ]]; then
  APP_JSON=$(az ad app create \
    --display-name "$ENTRA_APP_NAME" \
    --sign-in-audience AzureADMyOrg \
    --only-show-errors)
  ENTRA_CLIENT_ID=$(echo "$APP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['appId'])")
  APP_OBJECT_ID=$(echo "$APP_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  az ad sp create --id "$ENTRA_CLIENT_ID" --output none 2>/dev/null || true
  az ad app update \
    --id "$ENTRA_CLIENT_ID" \
    --identifier-uris "api://${ENTRA_CLIENT_ID}" \
    --output none
  az rest --method PATCH \
    --uri "https://graph.microsoft.com/v1.0/applications/${APP_OBJECT_ID}" \
    --headers "Content-Type=application/json" \
    --body "{\"spa\":{\"redirectUris\":[\"http://localhost:5173/redirect.html\"]},\"api\":{\"requestedAccessTokenVersion\":2,\"oauth2PermissionScopes\":[{\"id\":\"$(uuidgen | tr '[:upper:]' '[:lower:]')\",\"value\":\"access_as_user\",\"adminConsentDisplayName\":\"Access gunaso as user\",\"adminConsentDescription\":\"Allows the app to access gunaso on behalf of the signed-in user\",\"userConsentDisplayName\":\"Access gunaso\",\"userConsentDescription\":\"Allows the app to access gunaso on your behalf\",\"isEnabled\":true,\"type\":\"User\"}]}}"
else
  echo "   (already exists, skipping)"
  ENTRA_CLIENT_ID="$EXISTING_APP"
fi
ENTRA_AUTHORITY="https://login.microsoftonline.com/${TENANT_ID}"
ENTRA_SCOPE="api://${ENTRA_CLIENT_ID}/access_as_user"

# 7. Set GitHub repo-level secrets ────────────────────────────────────────────
echo "→ [7/7] Setting GitHub repo secrets..."
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
echo "✅ Done. GitHub secrets are set."
echo ""
echo "IMPORTANT — save these in your password manager:"
echo "  DB admin password : (what you entered above)"
echo "  Entra client ID   : $ENTRA_CLIENT_ID"
echo "  Entra authority   : $ENTRA_AUTHORITY"
echo "  Entra scope       : $ENTRA_SCOPE"
echo "  ACR login server  : $ACR_LOGIN_SERVER"
echo ""
echo "Next steps:"
echo "  1. Add a SPA redirect URI per parliamentarian subdomain:"
echo "     Portal → Entra ID → App registrations → $ENTRA_APP_NAME → Authentication"
echo "     Add: https://<subdomain>.sachivalaya.org/gunaso/"
echo ""
echo "  2. Add each parliamentarian:"
echo "     ./infra/add-parliamentarian.sh <name> \"\$(uuidgen | tr '[:upper:]' '[:lower:]')\""
