# MERN Stack E-Commerce Application (DevOps Edition)

A production-grade full-stack MERN (MongoDB, Express, React, Node.js) application with automated **Zero-Touch "Push-to-Deploy" CI/CD**, **Nginx Web Server & Reverse Proxy**, **Husky Pre-commit Quality Gates**, and **Dependabot / DefenderBot Security Scanning**.

---

## 🚀 Kubernetes Architecture Overview

```text
 ┌──────────────────────┐
 │  Local Developer     │ ──> git commit (Husky Pre-commit: lint & build validation)
 └──────────┬───────────┘
            │ git push origin main
            ▼
 ┌──────────────────────┐       ┌──────────────────────────────┐
 │       GitHub         │       │          Jenkins              │
 │   Push to main       │──────>│ CI, Trivy, build and push     │
 └──────────────────────┘       │ images to GitHub Container    │
                                │ Registry (GHCR)               │
                                └──────────────┬───────────────┘
                                               │ kubectl over API
                                               ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Kubernetes namespace: sineth-test-ecommerce                 │
 │                                                             │
 │  ┌─────────────────┐   ┌─────────────────┐   ┌────────────┐ │
 │  │ Frontend/Nginx  │──>│ Express backend│──>│ MongoDB    │ │
 │  │ NodePort 30081  │   │ Service :5000  │   │ PVC :27017 │ │
 │  └─────────────────┘   └─────────────────┘   └────────────┘ │
 └─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Jenkins Kubernetes CI/CD

When changes are pushed to `main`, the `Sineth-Test-K8s` Jenkins pipeline:
1. Validates tests and builds both frontend and backend.
2. Builds and publishes Docker images to **GitHub Container Registry (`ghcr.io`)**.
3. Creates or updates the GHCR and MongoDB Kubernetes Secrets.
4. Applies [`k8s/app.yaml`](k8s/app.yaml) to the remote Kubernetes cluster.
5. Waits for MongoDB, backend, and frontend rollouts to complete.

### Jenkins Credentials
Configure these credentials in **Manage Jenkins > Credentials > System > Global credentials**:

| Credential ID | Type | Purpose |
| :--- | :--- | :--- |
| `GITHUB_TOKEN` | Secret text | GHCR `read:packages` and `write:packages` token |
| `KUBE_TOKEN` | Secret text | Kubernetes service-account bearer token |
| `KUBE_CA_FILE` | Secret file | Kubernetes CA certificate (`ca.crt`) |
| `MONGO_URI` | Secret text | `mongodb://mongodb:27017/ecommerce` |

The pipeline uses this non-secret API server setting in [`Jenkinsfile`](Jenkinsfile):

```text
KUBE_API_SERVER=https://167.172.77.230:6443
```

The deployment namespace is `sineth-test-ecommerce`. Never commit tokens,
certificates, passwords, or Kubernetes Secret manifests containing real values.

---

## ⚙️ Kubernetes Deployment

The Kubernetes resources are defined in [`k8s/app.yaml`](k8s/app.yaml). Jenkins
substitutes the immutable GHCR image tags before applying it. MongoDB uses the
`mongodb-data` PersistentVolumeClaim; backend and MongoDB are internal Services;
the frontend is exposed through NodePort `30081`.

For the complete setup, credentials, firewall, and troubleshooting procedure,
see [`docs/KUBERNETES_DEPLOYMENT.md`](docs/KUBERNETES_DEPLOYMENT.md).

To verify a successful deployment:

```bash
kubectl -n sineth-test-ecommerce get deployments,pods,services,pvc
kubectl -n sineth-test-ecommerce rollout status deployment/frontend
```

The application is available at `http://167.172.77.230:30081` when the node
firewall allows TCP port `30081`.

---

## 🛡️ DevOps & Security Tooling

### 1. Nginx Production Web Server & Reverse Proxy
- **Multi-stage Docker build** (`node:20-alpine` builder $\rightarrow$ `nginx:alpine` runtime).
- **SPA client-side routing fallback**: `try_files $uri $uri/ /index.html;` ensures page refreshes never 404.
- **Internal API reverse proxy**: Requests to `/api/` are forwarded directly to the backend container, eliminating CORS discrepancies.
- **Production HTTP security headers**: Injects `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, and `Referrer-Policy`.

### 2. Husky Pre-commit Quality Gates
- Configured in root [`package.json`](package.json) and [`.husky/pre-commit`](.husky/pre-commit).
- Automatically triggers before any `git commit`:
  1. Backend syntax validation (`node --check src/server.js`).
  2. Frontend production build verification (`vite build`).
- Rejects commits if errors or breaking changes are detected.

### 3. Dependabot Dependency Management
- File: [`.github/dependabot.yml`](.github/dependabot.yml)
- Weekly automated scans and pull requests for:
  - Root, backend, and frontend `npm` packages
  - Dockerfile base images (Node, Nginx)
  - GitHub Actions dependencies

### 4. DefenderBot / Security Pipeline
- File: [`.github/workflows/security.yml`](.github/workflows/security.yml)
- **Trivy Container Security Scanner**: Detects CVEs and operating system vulnerabilities in production images.
- **npm audit**: Scans dependencies for known security advisories.

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js** (v18+)
- **MongoDB** (Local instance or Atlas connection string)
- **Docker & Docker Compose**

### 2. Install Workspace Dependencies & Husky
```bash
npm install
```

### 3. Run Backend (Dev)
```bash
cd backend
npm install
npm run dev
```

### 4. Run Frontend (Dev)
```bash
cd frontend
npm install
npm run dev
```

### 5. Run Full Stack locally with Docker
```bash
docker compose up -d --build
```

---

## 🔍 Application Health Verification

- **Frontend UI (Nginx)**: `http://167.172.77.230:30081/`
- **API Health Check**: `http://167.172.77.230:30081/api/health`

For additional setup and multi-environment details, see the [CI/CD Guide](docs/CI_CD_GUIDE.md).

## 🧰 Isolated Jenkins Instance

This repository also includes an independent, Dockerized Jenkins controller for use on a shared server. It does not modify the existing Jenkins instance on port `8080`.

- Jenkins UI: `http://<YOUR_SERVER_HOST>:8081/`
- Separate persistent volume and Docker network
- Default limit of 1 CPU and 2 GB memory
- Jenkins agent port `50000` is not exposed
- Docker CLI is included for the pipeline's build, scan, and deployment stages
- The host Docker socket is mounted; administrator approval is required

From the server, run:

```bash
mkdir -p ~/jenkins-isolated
cd ~/jenkins-isolated
curl -fsSL -o docker-compose.jenkins.yml \
  "https://raw.githubusercontent.com/sinethch/06-09-2026-Jenkins/main/docker-compose.jenkins.yml?cb=$(date +%s)"
curl -fsSL -o Dockerfile.jenkins \
  "https://raw.githubusercontent.com/sinethch/06-09-2026-Jenkins/main/Dockerfile.jenkins?cb=$(date +%s)"
export DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
docker compose -p sineth-jenkins -f docker-compose.jenkins.yml build
docker compose -p sineth-jenkins -f docker-compose.jenkins.yml up -d
```

Only `docker-compose.jenkins.yml` is needed for this Jenkins instance. The MERN application remains a separate deployment; a Jenkins pipeline can check out the application repository into its own job workspace when required.

Then open `http://<YOUR_SERVER_HOST>:8081/`. Retrieve the initial administrator password with:

```bash
docker compose -p sineth-jenkins -f docker-compose.jenkins.yml exec jenkins \
  cat /var/jenkins_home/secrets/initialAdminPassword
```

See the [isolated Jenkins setup guide](docs/JENKINS_ISOLATED_SETUP.md) for firewall configuration, backups, safe lifecycle commands, and shared-server restrictions.
