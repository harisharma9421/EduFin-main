# GradPilot (EduFin) Deployment & CI/CD Guide

This guide provides complete, step-by-step instructions to configure Continuous Integration / Continuous Deployment (CI/CD) and deploy the GradPilot Next.js application.

---

## 1. Feasibility & Comparison of Hosting Platforms

We evaluate three deployment options. Choose the one that best fits your infrastructure needs.

| Metric | Path A: Vercel (Recommended) | Path B: VPS (Docker Compose) | Path C: Kubernetes (Existing Setup) |
| :--- | :--- | :--- | :--- |
| **Feasibility** | **Highest (Extremely Easy)** | **Medium (Cost-Effective)** | **Low (Complex/Enterprise)** |
| **Effort** | ~5 minutes | ~20 minutes | ~40+ minutes |
| **Infrastructure Costs** | Free tier available / $20/user/mo | $4 - $10/month (Fixed) | $30 - $100+/month |
| **CI/CD Configuration** | Out of the Box (automatic) | GitHub Actions (provided) | Jenkins (existing `Jenkinsfile`) |
| **Scaling** | Serverless (Auto-scales to zero) | Scale manually on host VPS | HPA (Auto-scales pods) |
| **SSL Setup** | Automatic & Managed | Certbot / Nginx (Manual) | CertManager (Kubernetes Ingress) |

---

## 2. Path A: Vercel (Recommended & Most Feasible)

Vercel is the native platform for Next.js. It requires no Docker setup, compiles files server-side efficiently, handles API routes as serverless functions, and provides instant global edge routing.

### Step 1: Connect your Git Repository
1. Log in or sign up at [Vercel](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your Git repository (GitHub/GitLab/Bitbucket).

### Step 2: Configure Project Settings
* **Framework Preset**: Vercel automatically detects `Next.js`. Keep this preset.
* **Build and Output Settings**: Leave as default.
* **Environment Variables**: Expand this section and copy-paste all keys from your local `.env` or the list below.

#### Required Environment Variables:
Add the following keys in the Vercel Dashboard:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Frontend URL
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# API Keys & Integrations
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
GROQ_API_KEY_BACKUP=your_groq_backup_key
SERPER_API_KEY=your_serper_key
GOOGLE_PLACES_API_KEY=your_google_places_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key
NEXT_PUBLIC_VAPI_ASSISTANT_ID=your_vapi_assistant_id
VAPI_PRIVATE_KEY=your_vapi_private_key
```

### Step 3: Deploy
1. Click **Deploy**. Vercel will clone, build (handling the `output: standalone` configuration), and deploy your site in ~2-3 minutes.
2. Once complete, you will receive a production deployment URL (e.g., `https://gradpilot.vercel.app`).

### CI/CD in Path A (Vercel Native)
* **Production Deployments**: Every push to `main` or `master` triggers a new build and updates the live production site automatically.
* **Preview Deployments**: Push to any development branch to automatically create a unique staging URL.

---

## 3. Path B: Self-Hosted VPS (Docker Compose + GitHub Actions)

If you want absolute control over your server environment and a fixed cost (e.g. $5/mo VPS from DigitalOcean, AWS EC2, or Hetzner), you can deploy using Docker.

### Step 1: Set up the VPS Host
Access your VPS via SSH and install Docker:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx

# Start and enable Docker
sudo systemctl enable --now docker
```

### Step 2: Configure Directory & Docker Compose
Create the application directory `/opt/gradpilot` on the server:
```bash
sudo mkdir -p /opt/gradpilot
sudo chown -R $USER:$USER /opt/gradpilot
```

Create a `docker-compose.yml` file in `/opt/gradpilot/docker-compose.yml`:
```yaml
version: '3.8'

services:
  gradpilot:
    # Replace 'your-docker-username' with your actual Docker Hub username
    image: your-docker-username/gradpilot:latest
    container_name: gradpilot
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOSTNAME=0.0.0.0
      # Server-Side Env Vars (Injected at Runtime)
      - SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_REAL_VALUE
      - GROQ_API_KEY=REPLACE_WITH_REAL_VALUE
      - GROQ_API_KEY_BACKUP=REPLACE_WITH_REAL_VALUE
      - GEMINI_API_KEY=REPLACE_WITH_REAL_VALUE
      - SERPER_API_KEY=REPLACE_WITH_REAL_VALUE
      - GOOGLE_PLACES_API_KEY=REPLACE_WITH_REAL_VALUE
      - VAPI_PRIVATE_KEY=REPLACE_WITH_REAL_VALUE
      # Public Env Vars (Overrides browser calls if necessary)
      - NEXT_PUBLIC_SUPABASE_URL=REPLACE_WITH_REAL_VALUE
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_WITH_REAL_VALUE
      - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=REPLACE_WITH_REAL_VALUE
      - NEXT_PUBLIC_VAPI_PUBLIC_KEY=REPLACE_WITH_REAL_VALUE
      - NEXT_PUBLIC_VAPI_ASSISTANT_ID=REPLACE_WITH_REAL_VALUE
      - NEXT_PUBLIC_APP_URL=https://yourdomain.com
```
*Note: Make sure to replace `REPLACE_WITH_REAL_VALUE` with your actual secret values on the server.*

### Step 3: Configure Reverse Proxy (Nginx) & SSL
Create an Nginx configuration file in `/etc/nginx/sites-available/gradpilot`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable the site and obtain a free Let's Encrypt SSL certificate:
```bash
# Link the site config
sudo ln -s /etc/nginx/sites-available/gradpilot /etc/nginx/sites-enabled/

# Test Nginx and reload
sudo nginx -t && sudo systemctl reload nginx

# Run Certbot to generate SSL Certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Step 4: Configure CI/CD via GitHub Actions
Go to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions** and add these secrets:

1. **Build Secrets** (Needed to build client bundles into Docker):
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   * `NEXT_PUBLIC_VAPI_PUBLIC_KEY`
   * `NEXT_PUBLIC_VAPI_ASSISTANT_ID`
   * `NEXT_PUBLIC_APP_URL`
2. **Registry Secrets** (To push build images to Docker Hub):
   * `DOCKER_USERNAME`
   * `DOCKER_PASSWORD` (Your Docker Hub Personal Access Token)
3. **Deployment Secrets** (To SSH into your VPS):
   * `VPS_HOST` (IP address of your server)
   * `VPS_USER` (Typically `ubuntu` or `root`)
   * `VPS_SSH_KEY` (The private SSH key used to access your VPS)

#### Activating the CI/CD Pipeline:
Un-comment the `build-and-push` job in [ci-cd.yml](file:///h:/EduFin-main/.github/workflows/ci-cd.yml) to automate builds:
1. Pulls down latest code.
2. Runs tests & linting.
3. Builds the production standalone Docker image, injecting public env variables at build time.
4. Pushes image to Docker Hub.
5. SSHs into your server, runs `docker compose pull && docker compose up -d` to deploy.

---

## 4. Path C: Kubernetes (Existing Manifests)

The repository has existing configuration manifests in the [k8s/](file:///h:/EduFin-main/k8s/) folder. This setup is ideal for enterprise environments or if you are running a local `kind` cluster on an EC2 instance as specified in the [Jenkinsfile](file:///h:/EduFin-main/Jenkinsfile).

### Step 1: Create Namespace
```bash
kubectl apply -f k8s/namespace.yaml
```

### Step 2: Create Secrets
Create your Kubernetes secret named `gradpilot-secrets` securely from your terminal. Replace values below with your actual credentials:
```bash
kubectl -n gradpilot create secret generic gradpilot-secrets \
  --from-literal=NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co" \
  --from-literal=NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key" \
  --from-literal=NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your_google_maps_key" \
  --from-literal=NEXT_PUBLIC_VAPI_PUBLIC_KEY="your_vapi_public" \
  --from-literal=NEXT_PUBLIC_VAPI_ASSISTANT_ID="your_assistant_id" \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="your_service_role_key" \
  --from-literal=GROQ_API_KEY="your_groq_key" \
  --from-literal=GROQ_API_KEY_BACKUP="your_groq_backup" \
  --from-literal=GEMINI_API_KEY="your_gemini_key" \
  --from-literal=SERPER_API_KEY="your_serper_key" \
  --from-literal=GOOGLE_PLACES_API_KEY="your_google_places" \
  --from-literal=VAPI_PRIVATE_KEY="your_vapi_private"
```

### Step 3: Apply the ConfigMap
Ensure the variables in `k8s/configmap.yaml` are correct (especially `NEXT_PUBLIC_APP_URL`), then run:
```bash
kubectl apply -f k8s/configmap.yaml
```

### Step 4: Deploy Deployment and Service Configs
Apply the main deployment, service, horizontal pod autoscaler (HPA), and ingress manifests:
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
```

### CI/CD in Path C (Jenkins Pipeline)
The project includes a [Jenkinsfile](file:///h:/EduFin-main/Jenkinsfile) configured for deployment to this Kubernetes cluster.

#### Requirements for Jenkins Host:
1. Jenkins user must be in the `docker` Unix group.
2. The Jenkins host must have already executed `docker login` to your Docker Registry.
3. Kubeconfig must be present at `/var/lib/jenkins/.kube/config`.

#### Steps to Configure Jenkins Job:
1. Open Jenkins and click **New Item**.
2. Name the item (e.g., `GradPilot-Deploy`) and choose **Pipeline**.
3. Under **Pipeline Definition**, select **Pipeline script from SCM**.
4. Set **SCM** to **Git** and enter your repository URL.
5. Set the branch specifier to `*/main` or `*/master`.
6. Save and click **Build Now** to run the initial pipeline.

---

## 5. Supabase Setup Checklist (Crucial for All Paths)

Whichever platform you choose, you must ensure that your database is configured properly.

1. **SQL Migrations**: Run the database script [chat_migration.sql](file:///h:/EduFin-main/chat_migration.sql) using the Supabase SQL Editor to set up schemas, tables, and constraints.
2. **PostgreSQL Policies**: Verify Row Level Security (RLS) policies by reviewing the scripts `get_policies.js` and `get_pg_policies.js` to ensure the auth requirements align with frontend expectations.
