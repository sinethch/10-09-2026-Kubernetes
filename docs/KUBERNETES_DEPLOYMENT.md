# Kubernetes deployment

The Kubernetes manifest in [`../k8s/app.yaml`](../k8s/app.yaml) defines the e-commerce application in the `sineth-test-ecommerce` namespace. It includes frontend and backend Deployments and Services, MongoDB with a PersistentVolumeClaim, and a frontend NodePort Service on `30081`.

## Prerequisites

- A Kubernetes cluster with a default StorageClass (or an adjusted PVC configuration).
- `kubectl` access to the target cluster and namespace.
- Backend and frontend images published to a container registry.
- Kubernetes Secrets named `ecommerce-secrets` (key `MONGO_URI`) and `ghcr-pull-secret` for private GHCR images.

The namespace and Deployments are declared in the manifest. Create the application Secrets before applying it, and replace `${BACKEND_IMAGE}` and `${FRONTEND_IMAGE}` with registry image references (or substitute them through your deployment pipeline):

```bash
kubectl -n sineth-test-ecommerce create secret generic ecommerce-secrets \
  --from-literal=MONGO_URI='mongodb://mongodb:27017/ecommerce'

kubectl -n sineth-test-ecommerce create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io --docker-username=YOUR_GITHUB_USER \
  --docker-password=YOUR_GITHUB_TOKEN

envsubst < k8s/app.yaml | kubectl apply -f -
```

Do not commit real credentials. Use your CI secret store or another approved secrets manager to provision them.

## Verify

```bash
kubectl -n sineth-test-ecommerce get deployments,pods,services,pvc
kubectl -n sineth-test-ecommerce rollout status deployment/mongodb --timeout=180s
kubectl -n sineth-test-ecommerce rollout status deployment/backend --timeout=180s
kubectl -n sineth-test-ecommerce rollout status deployment/frontend --timeout=180s
```

The frontend is exposed at `http://<node-address>:30081` when the node network and firewall allow the NodePort. The API health endpoint is `/api/health`. If the PVC remains `Pending`, check whether the cluster has a default StorageClass and update the claim to match the cluster's storage provider.

## Automation

The repository contains both GitHub Actions and Jenkins automation. The GitHub Actions release workflow currently publishes container images to GHCR and optionally deploys them to a remote Docker Compose host over SSH when configured. The Jenkins pipeline contains Kubernetes deployment stages; configure its credentials and cluster access in Jenkins before using that path.
