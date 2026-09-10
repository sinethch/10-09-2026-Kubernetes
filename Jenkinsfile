// ============================================================================
// Jenkinsfile — MERN Stack CI/CD Pipeline
// Repo: https://github.com/sinethch/10-09-2026-Kubernetes
// Server: 167.172.77.230
// ============================================================================
//
// HOW THIS WORKS (for beginners):
//
//  1. You push code to GitHub
//  2. GitHub sends a "webhook" (HTTP notification) to Jenkins on your server
//  3. Jenkins picks up the notification and runs this file
//  4. This file defines every step — test, build, scan, deploy
//
// BRANCH STRATEGY:
//  ┌─────────────────────┬───────────────────────────────────┐
//  │ Branch              │ Stages that run                   │
//  ├─────────────────────┼───────────────────────────────────┤
//  │ feature/*, fix/*,   │ CI only (test + build + verify)   │
//  │ hotfix/*            │                                   │
//  ├─────────────────────┼───────────────────────────────────┤
//  │ main, staging, qa   │ CI + Security + CD (full deploy)  │
//  └─────────────────────┴───────────────────────────────────┘
//
// ============================================================================

pipeline {

    // 'agent any' = run on any available Jenkins node/executor
    // Since you have a single server, Jenkins runs everything on itself
    agent any

    // ─── Global Variables ────────────────────────────────────────────────────
    // These are like "constants" you can refer to throughout the pipeline.
    // Jenkins also exports these as shell environment variables automatically.
    environment {
        GITHUB_REPO_OWNER = 'sinethch'                   // Your GitHub username
        GITHUB_REPO_NAME  = '10-09-2026-kubernetes'      // Lowercase repo name (GHCR requires lowercase)
        REGISTRY          = 'ghcr.io'                    // GitHub Container Registry
        KUBE_NAMESPACE    = 'sineth-test-ecommerce'
    }

    stages {

        // ════════════════════════════════════════════════════════════════════
        // STAGE 1: Checkout
        // ────────────────────────────────────────────────────────────────────
        // 'checkout scm' = clone the GitHub repository branch that triggered
        // this pipeline. Jenkins knows which branch/commit to fetch because
        // the GitHub webhook tells it.
        // ════════════════════════════════════════════════════════════════════
        stage('Checkout') {
            steps {
                checkout scm
                sh 'echo "✔ Branch: $BRANCH_NAME  |  Commit: $(git rev-parse --short HEAD)"'
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // STAGE 2: CI — Backend Tests & Syntax Check
        // ────────────────────────────────────────────────────────────────────
        // Equivalent to: ci.yml → job: backend-check
        // Runs on ALL branches (feature/*, fix/*, main, staging, qa)
        //
        // 'npm ci'   = clean install — installs exact versions from lock file
        // 'npm test' = runs test suite defined in backend/package.json
        // ════════════════════════════════════════════════════════════════════
        stage('CI \u2014 Backend Tests') {
            steps {
                dir('backend') {           // cd into backend/ folder
                    sh 'docker run --rm -v "$PWD":/workspace -w /workspace node:20-alpine npm ci'
                    sh 'docker run --rm -v "$PWD":/workspace -w /workspace node:20-alpine npm test'
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // STAGE 3: CI — Frontend Build Verification
        // ────────────────────────────────────────────────────────────────────
        // Equivalent to: ci.yml → job: frontend-check
        // Runs on ALL branches
        //
        // 'npm run build' = Vite compiles React into static files (dist/)
        // If there are any import errors or TypeScript issues, it fails here
        // ════════════════════════════════════════════════════════════════════
        stage('CI \u2014 Frontend Build') {
            steps {
                dir('frontend') {          // cd into frontend/ folder
                    sh 'docker run --rm -v "$PWD":/workspace -w /workspace node:20-alpine npm ci'
                    sh 'docker run --rm -v "$PWD":/workspace -w /workspace node:20-alpine npm run build'
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // STAGE 4: CI — Docker Image Verification
        // ────────────────────────────────────────────────────────────────────
        // Equivalent to: ci.yml → job: docker-check
        // Runs on ALL branches
        //
        // Builds Docker images with a temporary "ci-check" tag.
        // Purpose: verify the Dockerfiles are valid and build successfully.
        // We do NOT push these to GHCR — they're local-only for verification.
        // The 'post' block at the bottom cleans them up after the pipeline.
        // ════════════════════════════════════════════════════════════════════
        stage('CI \u2014 Docker Image Verification') {
            steps {
                sh '''
                    echo "Building backend Docker image (ci-check only, not pushed)..."
                    docker build --load -t backend:ci-check ./backend

                    echo "Building frontend Docker image (ci-check only, not pushed)..."
                    docker build --load -t frontend:ci-check ./frontend

                    echo "Docker image verification passed!"
                '''
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // STAGE 5: Security — Dependency Audit (npm audit)
        // ────────────────────────────────────────────────────────────────────
        // Equivalent to: security.yml → job: npm-audit
        // Only runs on: main, staging, qa
        //
        // 'npm audit' scans your npm packages for known security vulnerabilities.
        // '--audit-level=high' = only report HIGH and CRITICAL issues.
        // '|| true' = don't fail the pipeline even if vulnerabilities are found
        //             (informational only — you can change this to fail later)
        // ════════════════════════════════════════════════════════════════════
        stage('Security \u2014 Dependency Audit') {
            when {
                expression {
                    def branchName = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    branchName = branchName.replaceFirst(/^origin\//, '')
                    return ['main', 'staging', 'qa'].contains(branchName)
                }
            }
            steps {
                sh '''
                    echo "=== Auditing Backend npm Packages ==="
                    docker run --rm -v "$PWD/backend":/workspace -w /workspace node:20-alpine npm audit --audit-level=high || true

                    echo "=== Auditing Frontend npm Packages ==="
                    docker run --rm -v "$PWD/frontend":/workspace -w /workspace node:20-alpine npm audit --audit-level=high || true
                '''
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // STAGE 6: Security — Trivy Container Scan
        // ────────────────────────────────────────────────────────────────────
        // Equivalent to: security.yml → job: container-security-scan
        // Only runs on: main, staging, qa
        //
        // Trivy is a security scanner that checks Docker images for:
        //   - OS-level vulnerabilities (e.g., outdated Alpine packages)
        //   - Library vulnerabilities (e.g., known CVEs in npm packages)
        //
        // We run Trivy itself as a Docker container (no need to install it).
        // '-v /var/run/docker.sock:/var/run/docker.sock' allows the Trivy
        // container to access the HOST'S Docker images (backend:ci-check etc.)
        // '-v /tmp/trivy-cache:/root/.cache' caches vulnerability database
        //   so it doesn't download fresh on every run (faster).
        // '--exit-code 0' = report but don't fail (|| true also ensures this)
        // ════════════════════════════════════════════════════════════════════
        stage('Security \u2014 Trivy Container Scan') {
            when {
                expression {
                    def branchName = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    branchName = branchName.replaceFirst(/^origin\//, '')
                    return ['main', 'staging', 'qa'].contains(branchName)
                }
            }
            steps {
                sh '''
                    echo "=== Scanning backend:ci-check with Trivy ==="
                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v /tmp/trivy-cache:/root/.cache \
                        aquasec/trivy:latest image \
                        --exit-code 0 \
                        --ignore-unfixed \
                        --vuln-type os,library \
                        --severity CRITICAL,HIGH \
                        --format table \
                        backend:ci-check

                    echo "=== Scanning frontend:ci-check with Trivy ==="
                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v /tmp/trivy-cache:/root/.cache \
                        aquasec/trivy:latest image \
                        --exit-code 0 \
                        --ignore-unfixed \
                        --vuln-type os,library \
                        --severity CRITICAL,HIGH \
                        --format table \
                        frontend:ci-check
                '''
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // STAGE 7: CD — Build & Push Production Images to GHCR
        // ────────────────────────────────────────────────────────────────────
        // Equivalent to: cd.yml → job: build-and-publish
        // Only runs on: main, staging, qa
        //
        // IMAGE TAGGING STRATEGY:
        //   Each image gets TWO tags:
        //   1. Versioned:  ghcr.io/sinethch/06-09-2026-jenkins/backend:main-abc1234
        //                  (unique per commit — you can roll back to any commit)
        //   2. Latest:     ghcr.io/sinethch/06-09-2026-jenkins/backend:main-latest
        //                  (always points to the newest commit on that branch)
        //
        // 'withCredentials' = Jenkins securely injects GITHUB_TOKEN secret
        //   from Credentials store (never printed in plain text in logs).
        //   The variable GH_TOKEN is available as a shell env var inside.
        // ════════════════════════════════════════════════════════════════════
        stage('CD \u2014 Build & Push to GHCR') {
            when {
                expression {
                    def branchName = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    branchName = branchName.replaceFirst(/^origin\//, '')
                    return ['main', 'staging', 'qa'].contains(branchName)
                }
            }
            steps {
                withCredentials([string(credentialsId: 'GITHUB_TOKEN', variable: 'GH_TOKEN')]) {
                    sh '''
                        DEPLOY_BRANCH="${BRANCH_NAME:-${GIT_BRANCH#origin/}}"
                        # Compute a short 7-character commit hash (e.g. "abc1234")
                        SHORT_SHA=$(git rev-parse --short HEAD)
                        IMAGE_TAG="${DEPLOY_BRANCH}-${SHORT_SHA}"
                        REPO="${REGISTRY}/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}"

                        echo "=== Build & Push Summary ==="
                        echo "Environment : ${DEPLOY_BRANCH}"
                        echo "Image tag   : ${IMAGE_TAG}"
                        echo "Registry    : ${REPO}"

                        # Authenticate with GitHub Container Registry
                        # 'echo ... | docker login --password-stdin' avoids
                        # the token appearing in process list
                        echo "${GH_TOKEN}" | docker login ghcr.io \
                            -u "${GITHUB_REPO_OWNER}" --password-stdin

                        # ── Backend ─────────────────────────────────────────
                        echo "Building backend image..."
                        docker build \
                            -t "${REPO}/backend:${IMAGE_TAG}" \
                            -t "${REPO}/backend:${DEPLOY_BRANCH}-latest" \
                            ./backend

                        echo "Pushing backend to GHCR..."
                        docker push "${REPO}/backend:${IMAGE_TAG}"
                        docker push "${REPO}/backend:${DEPLOY_BRANCH}-latest"

                        # ── Frontend ────────────────────────────────────────
                        echo "Building frontend image..."
                        docker build \
                            -t "${REPO}/frontend:${IMAGE_TAG}" \
                            -t "${REPO}/frontend:${DEPLOY_BRANCH}-latest" \
                            ./frontend

                        echo "Pushing frontend to GHCR..."
                        docker push "${REPO}/frontend:${IMAGE_TAG}"
                        docker push "${REPO}/frontend:${DEPLOY_BRANCH}-latest"

                        echo "All images pushed to GHCR successfully!"
                    '''
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // STAGE 8: CD — Deploy
        // ────────────────────────────────────────────────────────────────────
        // Equivalent to: cd.yml → job: deploy
        // Only runs on: main, staging, qa
        //
        // WHAT THIS STAGE DOES:
        //   1. Recomputes the immutable image tag used by the build stage
        //   2. Creates/updates the GHCR pull and application secrets in-cluster
        //   3. Applies the Kubernetes manifest through the remote API server
        //   4. Waits for all application deployments to become ready
        // ════════════════════════════════════════════════════════════════════
        stage('CD \u2014 Deploy') {
            when {
                expression {
                    def branchName = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    branchName = branchName.replaceFirst(/^origin\//, '')
                    return ['main', 'staging', 'qa'].contains(branchName)
                }
            }
            steps {
                withCredentials([
                    string(credentialsId: 'GITHUB_TOKEN', variable: 'GH_TOKEN'),
                    string(credentialsId: 'KUBE_TOKEN', variable: 'KUBE_TOKEN'),
                    file(credentialsId: 'KUBE_CA_FILE', variable: 'KUBE_CA_FILE'),
                    string(credentialsId: 'MONGO_URI', variable: 'MONGO_URI')
                ]) {
                    sh '''
                        DEPLOY_BRANCH="${BRANCH_NAME:-${GIT_BRANCH#origin/}}"
                        SHORT_SHA=$(git rev-parse --short HEAD)
                        IMAGE_TAG="${DEPLOY_BRANCH}-${SHORT_SHA}"
                        REPO="${REGISTRY}/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}"
                        BACKEND_IMAGE="${REPO}/backend:${IMAGE_TAG}"
                        FRONTEND_IMAGE="${REPO}/frontend:${IMAGE_TAG}"

                        echo "=== Deployment Starting ==="
                        echo "Environment  : ${DEPLOY_BRANCH}"
                        echo "Backend      : ${BACKEND_IMAGE}"
                        echo "Frontend     : ${FRONTEND_IMAGE}"

                        KUBECTL="kubectl --server=${KUBE_API_SERVER} --token=${KUBE_TOKEN} --certificate-authority=${KUBE_CA_FILE}"

                        # The namespace must exist before namespaced secrets are created.
                        ${KUBECTL} create namespace "${KUBE_NAMESPACE}" --dry-run=client -o yaml | ${KUBECTL} apply -f -

                        ${KUBECTL} -n "${KUBE_NAMESPACE}" create secret docker-registry ghcr-pull-secret \
                            --docker-server=ghcr.io \
                            --docker-username="${GITHUB_REPO_OWNER}" \
                            --docker-password="${GH_TOKEN}" \
                            --dry-run=client -o yaml | ${KUBECTL} apply -f -

                        ${KUBECTL} -n "${KUBE_NAMESPACE}" create secret generic ecommerce-secrets \
                            --from-literal=MONGO_URI="${MONGO_URI}" \
                            --dry-run=client -o yaml | ${KUBECTL} apply -f -

                        BACKEND_IMAGE="${BACKEND_IMAGE}" \
                        FRONTEND_IMAGE="${FRONTEND_IMAGE}" \
                        envsubst < k8s/app.yaml | ${KUBECTL} apply -f -

                        ${KUBECTL} -n "${KUBE_NAMESPACE}" rollout status deployment/mongodb --timeout=180s
                        ${KUBECTL} -n "${KUBE_NAMESPACE}" rollout status deployment/backend --timeout=180s
                        ${KUBECTL} -n "${KUBE_NAMESPACE}" rollout status deployment/frontend --timeout=180s

                        echo "=== Kubernetes deployment complete ==="
                    '''
                }
            }
        }

    } // ─── end stages ────────────────────────────────────────────────────────

    // ════════════════════════════════════════════════════════════════════════
    // POST — Always runs after all stages (success or failure)
    // ────────────────────────────────────────────────────────────────────────
    // 'always' block: clean up temporary CI images and log out of GHCR
    //   to avoid credential leakage on a shared Jenkins instance.
    // '2>/dev/null || true' = suppress errors if image doesn't exist yet
    //   (e.g., if the pipeline failed before Stage 4 built them)
    // ════════════════════════════════════════════════════════════════════════
    post {
        always {
            sh '''
                echo "Cleaning up CI check images..."
                docker rmi backend:ci-check frontend:ci-check 2>/dev/null || true
                docker logout ghcr.io 2>/dev/null || true
                echo "Cleanup done."
            '''
        }
        success {
            echo "Pipeline SUCCESS - Branch: ${env.BRANCH_NAME ?: env.GIT_BRANCH ?: 'unknown'} | Commit: ${env.GIT_COMMIT ?: 'unknown'}"
        }
        failure {
            echo "Pipeline FAILED - Branch: ${env.BRANCH_NAME ?: env.GIT_BRANCH ?: 'unknown'} | Check the stage logs above."
        }
    }

}
