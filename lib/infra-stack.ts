import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32';

import { Construct } from 'constructs';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Use default VPC
    const vpc = new ec2.Vpc(this, 'EksVPC', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }
      ]
    });

    // Create EKS Cluster
    const cluster = new eks.Cluster(this, 'HelloWorldCluster', {
      version: eks.KubernetesVersion.V1_32,
      vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      defaultCapacity: 2,
      defaultCapacityInstance: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      kubectlLayer: new KubectlV32Layer(this, 'KubectlLayer'),
    });

    const adminRole = iam.Role.fromRoleArn(this, 'AdminRole', 
      'arn:aws:iam::420927334919:role/Admin');
    cluster.awsAuth.addMastersRole(adminRole);

    // Create RDS Instance
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_15 }),
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      databaseName: 'hellodb',
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
    });

    const apiRepo = new ecr.Repository(this, 'ApiServiceRepo', {
      repositoryName: 'api-svc'
    });
    const backendRepo = new ecr.Repository(this, 'BackendServiceRepo', {
      repositoryName: 'backend-svc'
    });

    // Add Kubernetes manifests
    cluster.addManifest('hello-world-app', {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'api-service' },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: 'api-service' } },
        template: {
          metadata: { labels: { app: 'api-service' } },
          spec: {
            containers: [{
              name: 'api-service',
              image: 'api-service:latest',
              ports: [{ containerPort: 3000 }],
              env: [{
                name: 'DB_STRING',
                valueFrom: {
                  secretKeyRef: {
                    name: 'db-secret',
                    key: 'connection',
                  },
                }
              }]
            }],
          }
        }
      },
    });
  }
}        