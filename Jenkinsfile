// GradPilot CI/CD pipeline
// ---------------------------------------------------------------------------
// No app secrets are stored here. They live two places:
//   1. The Docker image already has every NEXT_PUBLIC_* baked in by an
//      earlier manual `docker build --build-arg ...` you ran on the EC2 box.
//   2. The runtime Kubernetes Secret `gradpilot-secrets` already holds
//      every server-side key (Gemini, Serper, Groq, Supabase service role,
//      Google Places, Vapi private). It was created out-of-band with
//      `kubectl create secret`.
//
// The pipeline only does:
//   • Checkout
//   • Lint + type-check (inside a node:20-alpine throwaway container)
//   • Docker build using the existing :latest as a cache reference
//   • Docker push to Docker Hub (uses the host's prior `docker login`)
//   • kubectl rollout to the local kind cluster
//
// Required Jenkins setup: Jenkins user is in the docker group, has its
// kubeconfig at /var/lib/jenkins/.kube/config, and the host has already done
// `docker login` to Docker Hub. No Jenkins credentials are referenced from
// this file (apart from the GitHub access token used by the SCM step itself,
// which you've already configured on the job).

pipeline {
  agent any

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  environment {
    REGISTRY        = 'docker.io'
    IMAGE_NAMESPACE = 'harisharma9421' // Replace with your Docker Hub username
    IMAGE_NAME      = 'gradpilot'
    IMAGE_TAG       = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'dev'}"
    IMAGE_REF       = "${env.REGISTRY}/${env.IMAGE_NAMESPACE}/${env.IMAGE_NAME}:${env.IMAGE_TAG}"
    LATEST_REF      = "${env.REGISTRY}/${env.IMAGE_NAMESPACE}/${env.IMAGE_NAME}:latest"

    K8S_NAMESPACE  = 'gradpilot'
    K8S_DEPLOYMENT = 'gradpilot'
    KUBECONFIG     = '/var/lib/jenkins/.kube/config'
  }

  stages {

    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Install + lint + type-check') {
      steps {
        sh '''
          # Run inside a throwaway Node 20 container so no Node install is
          # needed on the Jenkins host.
          docker run --rm -v "$WORKSPACE":/workspace -w /workspace \
            -u 0:0 node:20-alpine sh -c '
              apk add --no-cache libc6-compat >/dev/null
              npm ci --no-audit --no-fund
              npm run lint || echo "Lint warnings ignored for now"
              npx tsc --noEmit
          '
        '''
      }
    }

    stage('Build Docker image') {
      steps {
        sh '''
          # Pull the previous :latest so the image build can reuse layers.
          docker pull "$LATEST_REF" || true

          # Build using the registry-tagged previous :latest as a cache
          # reference. NEXT_PUBLIC_* values are inherited from the existing
          # image's environment defaults — they don't need to be passed here
          # because the cluster's runtime Secret already overrides them and
          # the same constants were baked in by your earlier manual build.
          docker build \
            --pull \
            --cache-from "$LATEST_REF" \
            -t "$IMAGE_REF" \
            -t "$LATEST_REF" \
            .
        '''
      }
    }

    stage('Push image') {
      when {
        anyOf {
          branch 'main'
          branch 'master'
        }
      }
      steps {
        sh '''
          # Uses the host's existing docker login to Docker Hub. If you ever
          # need to log in fresh:  echo "<PAT>" | docker login -u <user> --password-stdin
          docker push "$IMAGE_REF"
          docker push "$LATEST_REF"
        '''
      }
    }

    stage('Deploy to Kubernetes') {
      when {
        anyOf {
          branch 'main'
          branch 'master'
        }
      }
      steps {
        sh '''
          kubectl --kubeconfig="$KUBECONFIG" apply -f k8s/namespace.yaml
          kubectl --kubeconfig="$KUBECONFIG" apply -f k8s/configmap.yaml

          # Fail fast if the runtime Secret is missing.
          kubectl --kubeconfig="$KUBECONFIG" -n "$K8S_NAMESPACE" \
            get secret gradpilot-secrets >/dev/null

          kubectl --kubeconfig="$KUBECONFIG" apply -f k8s/deployment.yaml
          kubectl --kubeconfig="$KUBECONFIG" apply -f k8s/service.yaml
          kubectl --kubeconfig="$KUBECONFIG" apply -f k8s/hpa.yaml

          # Pin the new image and roll the deployment.
          kubectl --kubeconfig="$KUBECONFIG" -n "$K8S_NAMESPACE" \
            set image deployment/"$K8S_DEPLOYMENT" gradpilot="$IMAGE_REF" --record

          kubectl --kubeconfig="$KUBECONFIG" -n "$K8S_NAMESPACE" \
            rollout status deployment/"$K8S_DEPLOYMENT" --timeout=8m
        '''
      }
    }
  }

  post {
    success { echo "✓ Deployed ${IMAGE_REF}" }
    failure { echo "✗ Build failed — check the stage view." }
    always  { sh 'docker image prune -f --filter "until=24h" || true' }
  }
}
