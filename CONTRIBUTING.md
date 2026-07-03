# Contributing

## Representatives (fork-based workflow)

Every Representative — including internal team members — works from their own
fork of this repo and gets their own auto-deploy pipeline, without needing
write access to the main repo. There is no more branch-push deploy trigger in
the main repo; all deploys go through a Representative's fork.

### One-time setup (Representative)

1. Fork `meroDigitalNepal/gunaso` on GitHub.
2. In your fork's Settings → Actions → General, enable Actions (GitHub
   disables Actions on new forks by default).
3. Ask a maintainer for a scoped Personal Access Token (see "Issuing a token"
   below).
4. In your fork's Settings → Secrets and variables → Actions:
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

Settings → Environments → `<rep-name>` → enable **Required reviewers** → add
the maintainer(s) who should approve deploys. This applies regardless of
whether the run was triggered by a fork's dispatch or a manual
`workflow_dispatch` run.
