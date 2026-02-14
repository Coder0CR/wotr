import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
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

    // Add GSI for querying workouts by timestamp
    workoutTable.addGlobalSecondaryIndex({
      indexName: 'TimestampIndex',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create IAM role for createWorkout Lambda
    const createWorkoutRole = new iam.Role(this, 'CreateWorkoutLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for createWorkout Lambda with PutItem permission only',
    });

    createWorkoutRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );

    createWorkoutRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['dynamodb:PutItem'],
          resources: [workoutTable.tableArn],
        })
    );

    // Create IAM role for getWorkouts Lambda
    const getWorkoutsRole = new iam.Role(this, 'GetWorkoutsLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for getWorkouts Lambda with Query permission only',
    });

    getWorkoutsRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );

    getWorkoutsRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['dynamodb:Query'],
          resources: [
            workoutTable.tableArn,
            `${workoutTable.tableArn}/index/*`,
          ],
        })
    );

    // Create Lambda function for creating workouts
    const createWorkoutLambda = new lambdaNodejs.NodejsFunction(this, 'CreateWorkoutFunction', {
      functionName: 'createWorkout',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../../services/api/createWorkout.ts'),
      handler: 'handler',
      role: createWorkoutRole,
      environment: {
        TABLE_NAME: workoutTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: [
          '@aws-sdk/*',
        ],
      },
    });

    // Create Lambda function for getting workouts
    const getWorkoutsLambda = new lambdaNodejs.NodejsFunction(this, 'GetWorkoutsFunction', {
      functionName: 'getWorkouts',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../../services/api/getWorkouts.ts'),
      handler: 'handler',
      role: getWorkoutsRole,
      environment: {
        TABLE_NAME: workoutTable.tableName,
        GSI_NAME: 'TimestampIndex',
      },
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: [
          '@aws-sdk/*',
        ],
      },
    });

    // Create API Gateway REST API
    const api = new apigateway.RestApi(this, 'WorkoutApi', {
      restApiName: 'Workout Tracking API',
      description: 'API for workout tracking application',
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Create /workouts resource
    const workoutsResource = api.root.addResource('workouts');

    // Add POST /workouts endpoint
    const createWorkoutIntegration = new apigateway.LambdaIntegration(createWorkoutLambda, {
      proxy: true,
    });

    workoutsResource.addMethod('POST', createWorkoutIntegration, {
      methodResponses: [
        { statusCode: '201' },
        { statusCode: '400' },
        { statusCode: '500' },
      ],
    });

    // Add GET /workouts endpoint
    const getWorkoutsIntegration = new apigateway.LambdaIntegration(getWorkoutsLambda, {
      proxy: true,
    });

    workoutsResource.addMethod('GET', getWorkoutsIntegration, {
      requestParameters: {
        'method.request.querystring.from': true,  // Required
        'method.request.querystring.to': true,    // Required
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '400' },
        { statusCode: '500' },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'TableName', {
      value: workoutTable.tableName,
      description: 'DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'CreateWorkoutLambdaName', {
      value: createWorkoutLambda.functionName,
      description: 'Create workout Lambda function name',
    });

    new cdk.CfnOutput(this, 'GetWorkoutsLambdaName', {
      value: getWorkoutsLambda.functionName,
      description: 'Get workouts Lambda function name',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'WorkoutApiUrl',
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: api.restApiId,
      description: 'API Gateway REST API ID',
    });
  }
}