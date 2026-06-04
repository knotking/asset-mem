# Deploy Orchestrator

**Workflow file:** [deploy-orchestrator.yaml](deploy-orchestrator.yaml)

Starts one or more existing `deploy-*.yaml` workflows from a single manual run. Each child workflow is a separate Actions run (own job graph, logs, and GitHub Environment approvals).

## When to use

- Staging or prod release touching several surfaces (agent + proxy + workers + webapp).
- Re-deploy a subset after infra changes without opening nine workflow pages.

## Not included

These stay separate (different inputs or high risk):

- [create-environment.yaml](create-environment.yaml)
- [destroy-environment.yaml](destroy-environment.yaml)
- [apply-operations-config.yaml](apply-operations-config.yaml)
- Test workflows (`test-*.yaml`)

## Branch for child workflows

Use GitHub’s **Use workflow from** branch dropdown at the top of the Run workflow dialog. Child workflows are dispatched on that same ref (`github.ref_name`).

## Inputs

| Input | Description |
|-------|-------------|
| **environment** | `staging` or `prod` |
| **deploy_*** checkboxes | Enable each workflow to trigger (group shown in the input description) |

GitHub allows at most **10** `workflow_dispatch` inputs, so the UI uses checkboxes only (no preset selector). Inputs are ordered **Backend → Workers → Frontend**; descriptions are prefixed with the group name.

| Checkbox | Group |
|----------|--------|
| deploy_homecare_agent | Backend |
| deploy_homecare_agent_proxy | Backend |
| deploy_checkpoint_analysis | Workers |
| deploy_checkpoint_metrics | Workers |
| deploy_document_analysis | Workers |
| deploy_pubsub_user_docs | Workers |
| deploy_webapp | Frontend |
| deploy_mapp_build | Frontend |
| deploy_mapp_update | Frontend |

**Defaults when dispatched from the orchestrator:** agent `action=update`, mapp build `platform=all`. For `create` or `ios`/`android`, run [deploy-homecare-agent.yaml](deploy-homecare-agent.yaml) or [deploy-mapp-build.yaml](deploy-mapp-build.yaml) directly.

## Permissions

The orchestrator needs `actions: write`. Child workflows still use their own `environment:` protection rules.

## Monitoring

Check the job summary for workflows grouped by Backend / Workers / Frontend. The orchestrator does not wait for children to finish.

## CLI equivalent

```bash
gh workflow run deploy-orchestrator.yaml --ref my-branch \
  -f environment=staging \
  -f deploy_homecare_agent=true \
  -f deploy_homecare_agent_proxy=true
```

Enable only the workflows you need (`-f deploy_webapp=true`, etc.).
