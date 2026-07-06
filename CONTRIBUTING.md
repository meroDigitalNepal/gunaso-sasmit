# Contributing

## Representatives (fork-based workflow)

Every Representative — including internal team members — works from their own
fork of this repo and gets their own auto-deploy pipeline, without needing
write access to the main repo. There is no more branch-push deploy trigger in
the main repo; all deploys go through a Representative's fork.

### One-time setup (Representative)

1. Fork `meroDigitalNepal/gunaso` on GitHub — to your own personal account, or
   as a repo under the `meroDigitalNepal` org if you'd rather it stay under
   the org's governance (e.g. `meroDigitalNepal/gunaso-sasmit`). Either works
   identically for the deploy pipeline; an org-owned fork just means a
   maintainer adds you as a collaborator on that one repo instead of nothing
   being granted at all.
2. In the fork's Settings → Actions → General, enable Actions (GitHub
   disables Actions on new forks by default).
3. Ask a maintainer for a scoped Personal Access Token (see "Issuing a token"
   below).
4. In the fork's Settings → Secrets and variables → Actions — these must be
   **repository** secrets/variables, not environment-scoped (the notify
   workflow doesn't declare an `environment:`, so it can't see anything set
   at that level):
   - Add variable `REP_NAME` set to your name as used in the main repo's
     GitHub Environments (e.g. `sasmit`).
   - Add secret `UPSTREAM_DISPATCH_TOKEN` set to the token from step 3.

### Day to day

Push to your fork's `main` branch. That's it:

1. Your fork's `fork-notify-deploy.yml` workflow fires and notifies the main
   repo.
2. The main repo's `azure-deploy.yml` run appears, resolves your `REP_NAME` as
   the deploy environment, and checks out your fork's commit.
3. The run pauses at "Required reviewers" for a maintainer to approve.
4. Once approved, it builds, runs migrations, and updates your Azure
   Container App.

## Maintainers

### Onboarding a new Representative end-to-end

Three repos are involved, run in this order:

1. **`gunaso/infra/add-rep.sh <name> <uuid>`** (this repo) — seeds the
   Representative's row in the database, creates their Azure Container App,
   and creates their GitHub Environment with the required-reviewer approval
   gate and `AZURE_CONTAINER_APP_NAME` secret already wired up. At the end it
   prints the remaining fork checklist (steps 1-4 above).
2. **Fork setup** (steps above) — fork the repo, enable Actions, issue a PAT,
   set `REP_NAME`/`UPSTREAM_DISPATCH_TOKEN` on the fork.
3. **`sachivalaya/scripts/add-rep.sh <name>`** (the `sachivalaya` repo) —
   creates their `<name>.sachivalaya.org` landing page, registers their Azure
   Container App's FQDN in the Cloudflare Worker's KV store, and adds the
   proxied DNS record. This step only depends on the Container App existing
   (step 1) — it's unaffected by whether the fork/deploy pipeline is finished,
   since it just looks up the Container App's current FQDN.

### Manually triggering a deploy

If you need to deploy without a fork push (e.g. a hotfix, or testing), run
`azure-deploy.yml` via `workflow_dispatch` (Actions tab → "Deploy
Representative App" → "Run workflow") with the `rep` input set to the target
Representative's name. `repo`/`sha` default to this repo's latest commit if
left blank.

### Issuing a token for a Representative's fork

Create a **fine-grained personal access token**
(https://github.com/settings/personal-access-tokens/new) scoped to:
- Repository access: only `meroDigitalNepal/gunaso`
- Permissions: Contents → Read and write (this is the minimum GitHub requires
  for the `repository_dispatch` API; there's no narrower scope for it)

Set an expiry (90 days is a reasonable default) and hand it to the
Representative to store as their fork's `UPSTREAM_DISPATCH_TOKEN` secret.
Rotate or revoke it if they stop contributing.

### Enabling the approval gate for a new Representative

Deploy approval is granted to the org's `maintainers` GitHub team, not
individual users — so anyone in that team gets notified and can approve, and
adding/removing a maintainer later is just a team-membership change, not a
per-environment one. `infra/add-rep.sh` wires this up automatically for new
Representatives (it prompts for the team, defaulting to `maintainers`). To
set it up by hand instead — e.g. for an environment created before this
script existed — either use the UI (Settings → Environments → `<rep-name>` →
enable **Required reviewers** → add the `maintainers` team) or run:

```bash
TEAM_ID="$(gh api orgs/meroDigitalNepal/teams/maintainers --jq .id)"
gh api --method PUT repos/meroDigitalNepal/gunaso/environments/<rep-name> \
  -f 'reviewers[][type]=Team' -F "reviewers[][id]=${TEAM_ID}"
```

To add or remove a maintainer, change their membership on the team instead:

```bash
gh api orgs/meroDigitalNepal/teams/maintainers/memberships/<username> \
  --method PUT -f role=maintainer   # add
gh api orgs/meroDigitalNepal/teams/maintainers/memberships/<username> \
  --method DELETE                    # remove
```

This applies regardless of whether the run was triggered by a fork's dispatch
or a manual `workflow_dispatch` run. Note: required reviewers on environments
only works because this repo is public — GitHub gates this feature behind a
paid plan for private repos.
