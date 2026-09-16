#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ContractusStack } from '../lib/contractus-stack';

const app = new cdk.App();

const environmentName = app.node.tryGetContext('environmentName') ?? 'pilot';
const domainName = app.node.tryGetContext('domainName'); // opcional: ej. "contractus360.midominio.gov.co"

new ContractusStack(app, `Contractus360-${environmentName}`, {
  environmentName,
  domainName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'CONTRACTUS 360 - infraestructura piloto (VPC, RDS, S3, ECS Fargate, ALB)',
});
