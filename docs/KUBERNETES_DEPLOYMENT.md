# Kubernetes deployment

This repository deploys the MERN application to an existing Kubernetes cluster.
The frontend is exposed through a `NodePort` on port `30080`; MongoDB and the
backend remain internal cluster services.

## One-time cluster setup

Install `kubectl` on the Jenkins machine and verify that the remote API endpoint
is reachable. Add these Jenkins credentials without committing them to GitHub:

- `GITHUB_TOKEN`: a GitHub token with `write:packages` and `read:packages`.
- `KUBE_TOKEN`: the Kubernetes service-account bearer token.
- `KUBE_CA_FILE`: a **Secret file** containing the cluster CA certificate. Use
  the CA from the cluster's kubeconfig; do not use `--insecure-skip-tls-verify`.
- `MONGO_URI`: a Jenkins **Secret text** value, normally
  `mongodb://mongodb:27017/ecommerce` for this deployment.

The Jenkins job also needs the non-secret parameter/environment variable
`KUBE_API_SERVER`, for example `https://10.0.0.10:6443`. The token must be
authorized to create/update resources in the `ecommerce` namespace, including
Deployments, Services, a PersistentVolumeClaim, and Secrets.

## Manual deployment test

Authenticate locally with the same cluster credentials, then run:

```sh
kubectl --server="$KUBE_API_SERVER" --token="$KUBE_TOKEN" \
  --certificate-authority="$KUBE_CA_FILE" get nodes

kubectl create namespace ecommerce --dry-run=client -o yaml | kubectl apply -f -
kubectl -n ecommerce create secret generic ecommerce-secrets \
  --from-literal=MONGO_URI='mongodb://mongodb:27017/ecommerce' \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n ecommerce create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io --docker-username=YOUR_GITHUB_USER \
  --docker-password=YOUR_GITHUB_TOKEN \
  --dry-run=client -o yaml | kubectl apply -f -

export BACKEND_IMAGE=ghcr.io/sinethch/10-09-2026-kubernetes/backend:main-latest
export FRONTEND_IMAGE=ghcr.io/sinethch/10-09-2026-kubernetes/frontend:main-latest
envsubst < k8s/app.yaml | kubectl apply -f -
kubectl -n ecommerce rollout status deployment/mongodb --timeout=180s
kubectl -n ecommerce rollout status deployment/backend --timeout=180s
kubectl -n ecommerce rollout status deployment/frontend --timeout=180s
```

`envsubst` is provided by GNU gettext. On Windows, replace the two image
placeholders in a temporary copy, or run the commands from Git Bash/WSL.

## Verify the application

```sh
kubectl -n ecommerce get pods,svc,pvc
kubectl -n ecommerce logs deployment/backend
curl http://YOUR_NODE_PUBLIC_IP:30080/api/health
```

Open `http://YOUR_NODE_PUBLIC_IP:30080` in a browser. If the service is not
reachable, allow TCP `30080` in the remote server/cloud firewall. A PVC stuck
in `Pending` means the cluster has no default StorageClass; configure one or
change the PVC to a storage class provided by the cluster.

## Jenkins flow

Push to `main`. Jenkins builds and pushes both images to GHCR, creates/updates
the two Kubernetes Secrets from its credential store, substitutes the immutable
commit image tag into `k8s/app.yaml`, and applies it with `kubectl`. Check the
Jenkins console and then run the verification commands above.

The repository contains no Kubernetes token, database password, or registry
credential. Rotate the GitHub and Kubernetes tokens if either has ever been
committed or pasted into a public file.