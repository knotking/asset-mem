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

## Inputs

| Input | Description |
|-------|-------------|
| **environment** | `staging` or `prod` — passed to every child workflow |
| **git_ref** | Branch or tag children use (default `main`) |
| **deploy_preset** | `custom`, `all`, `backend`, `workers`, or `frontend` |
| **deploy_*** booleans | Used only when preset is **custom** |
| **agent_action** | `update` or `create` for the Vertex agent workflow |
| **mapp_platform** | `all`, `ios`, or `android` when mapp build is selected |

### Presets

| Preset | Workflows triggered |
|--------|---------------------|
| **all** | Agent, proxy, all four workers, webapp, mapp build, mapp update |
| **backend** | Agent, proxy |
| **workers** | Checkpoint analysis, checkpoint metrics, document analysis, user docs |
| **frontend** | Webapp, mapp build, mapp update |
| **custom** | Only workflows whose boolean is checked |

## Permissions

The orchestrator job needs `actions: write` to call `createWorkflowDispatch`. Child workflows still use their own `environment:` protection rules.

## Monitoring

After the orchestrator finishes, open **Actions** and filter by the workflow names listed in the job summary. The orchestrator does not wait for children to complete.

## CLI equivalent

```bash
gh workflow run deploy-orchestrator.yaml \
  -f environment=staging \
  -f git_ref=main \
  -f deploy_preset=backend \
  -f agent_action=update \
  -f mapp_platform=all
```

For custom selection, set `deploy_preset=custom` and pass `-f deploy_homecare_agent=true`, etc.
