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

    const nodeRole = cluster.defaultNodegroup?.role;
    if (nodeRole) {
      nodeRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'));
    }

    // Create RDS Instance
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_15 }),
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      databaseName: 'hellodb',
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),

      securityGroups: [
        new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
          vpc,
          description: 'Allow database access from EKS',
          allowAllOutbound: true
        })
      ]
    });

    database.connections.allowFrom(
      cluster.clusterSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow access from EKS cluster'
    );

    // Allow access from EKS pods to RDS
    database.connections.allowFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow access from VPC CIDR'
    );

    const apiRepo = new ecr.Repository(this, 'ApiServiceRepo', {
      repositoryName: 'api-svc'
    });
    const backendRepo = new ecr.Repository(this, 'BackendServiceRepo', {
      repositoryName: 'backend-svc'
    });

    // Add Kubernetes manifests
    cluster.addManifest('api-deployment', {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'api-svc' },
      spec: {
        replicas: 2,
        selector: { matchLabels: { app: 'api-svc' } },
        template: {
          metadata: { labels: { app: 'api-svc' } },
          spec: {
            containers: [{
              name: 'api-svc',
              image: '420927334919.dkr.ecr.eu-central-1.amazonaws.com/api-svc:latest',
              ports: [{ containerPort: 3000 }],
              env: [{
                name: 'BACKEND_URL',
                value: 'http://backend-svc:3001'
              }]
            }]
          }
        }
      }
    });

    cluster.addManifest('backend-deployment', {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'backend-svc' },
      spec: {
        replicas: 2,
        selector: { matchLabels: { app: 'backend-svc' } },
        template: {
          metadata: { labels: { app: 'backend-svc' } },
          spec: {
            containers: [{
              name: 'backend-svc',
              image: '420927334919.dkr.ecr.eu-central-1.amazonaws.com/backend-svc:latest',
              ports: [{ containerPort: 3001 }],
              env: [{
                name: 'DATABASE_URL',
                valueFrom: {
                  secretKeyRef: {
                    name: 'db-secret',
                    key: 'connection'
                  }
                }
              }]
            }]
          }
        }
      }
    });

    cluster.addManifest('api-service', {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: 'api-svc' },
      spec: {
        type: 'LoadBalancer',
        ports: [{ port: 80, targetPort: 3000 }],
        selector: { app: 'api-svc' }
      }
    });

    cluster.addManifest('backend-service', {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: 'backend-svc' },
      spec: {
        ports: [{ port: 3001, targetPort: 3001 }],
        selector: { app: 'backend-svc' }
      }
    });

    cluster.addManifest('db-secret', {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: { name: 'db-secret' },
      type: 'Opaque',
      stringData: {
        connection: `postgres://postgres:${database.secret!.secretValueFromJson('password').unsafeUnwrap()}@${database.instanceEndpoint.hostname}:5432/hellodb`
      }
    });
  }
}        