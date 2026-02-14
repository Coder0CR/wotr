import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB table
    const workoutTable = new dynamodb.Table(this, 'WorkoutTable', {
      tableName: 'WOTR',
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
    });

    // Create IAM role for Lambda with least-privilege
    const lambdaRole = new iam.Role(this, 'CreateWorkoutLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for createWorkout Lambda with PutItem permission only',
    });

    // Add CloudWatch Logs permissions (required for Lambda)
    lambdaRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );

    // Add only PutItem permission for the specific table
    lambdaRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['dynamodb:PutItem'],
          resources: [workoutTable.tableArn],
        })
    );

    // Create Lambda function using NodejsFunction for automatic bundling
    const createWorkoutLambda = new lambdaNodejs.NodejsFunction(this, 'CreateWorkoutFunction', {
      functionName: 'createWorkout',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../../services/api/createWorkout.ts'),
      handler: 'handler',
      role: lambdaRole,
      environment: {
        TABLE_NAME: workoutTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: [
          '@aws-sdk/*', // AWS SDK is already available in Lambda runtime
        ],
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'TableName', {
      value: workoutTable.tableName,
      description: 'DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: createWorkoutLambda.functionName,
      description: 'Lambda function name',
    });

    new cdk.CfnOutput(this, 'LambdaRoleArn', {
      value: lambdaRole.roleArn,
      description: 'IAM role ARN for Lambda',
    });
  }
}