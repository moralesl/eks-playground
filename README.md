# EKS Playground

A simple EKS based application demonstrating microservices architecture using AWS EKS, RDS, and containerized services.

## Project Structure
```
.
├── README.md
├── cdk.json
├── api-svc/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts
├── backend-svc/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts
└── infra/
    ├── package.json
    └── lib/
        └── infra-stack.ts
```

## Architecture

- Frontend API service exposing HTTP endpoint
- Backend service handling database operations
- PostgreSQL database on RDS
- Running on EKS with LoadBalancer service

## Prerequisites

- Node.js v22+
- AWS CLI configured
- Docker
- kubectl
- AWS CDK v2

## Setup Instructions

1. Install dependencies:
```bash
# Install CDK dependencies
cd infra
npm install

# Install service dependencies
cd ../api-svc
npm install

cd ../backend-svc
npm install
```

2. Deploy infrastructure:
```bash
cd infra
cdk deploy
```

3. Build and push Docker images:
```bash
# Login to ECR
aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.REGION.amazonaws.com

# Build and push API service
cd ../api-svc
docker buildx build --platform linux/amd64 -t api-svc .
docker tag api-svc:latest ACCOUNT.dkr.ecr.REGION.amazonaws.com/api-svc:latest
docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/api-svc:latest

# Build and push Backend service
cd ../backend-svc
docker buildx build --platform linux/amd64 -t backend-svc .
docker tag backend-svc:latest ACCOUNT.dkr.ecr.REGION.amazonaws.com/backend-svc:latest
docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/backend-svc:latest
```

4. Configure database:
```bash
# Get the database connection string from Kubernetes secret
kubectl get secret db-secret -o jsonpath='{.data.connection}' | base64 --decode

# Initialize the database
kubectl run -i --rm --tty pg-init --image=postgres:15 --restart=Never -- psql "$CONNECTION" -c "CREATE TABLE IF NOT EXISTS strings (id SERIAL PRIMARY KEY, value TEXT NOT NULL); INSERT INTO strings (value) VALUES ('hello world');"
```

5. Test the application:
```bash
# Get the API endpoint
export API_URL=$(kubectl get svc api-svc -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Test the endpoint
curl http://$API_URL/hello
```

## Manual Steps Required

1. Configure AWS credentials with appropriate permissions
2. Bootstrap CDK in your AWS account/region:
```bash
cdk bootstrap
```
3. Create ECR repositories for both services
4. Update security groups to allow EKS cluster access to RDS
5. Initialize the database schema and data

## Development

For local development, you can use Docker Compose:
```bash
docker-compose up --build
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
