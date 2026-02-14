import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB table with GSI for querying by timestamp
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
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

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

    // Create S3 bucket for workout photos (private)
    const photoBucket = new s3.Bucket(this, 'WorkoutPhotoBucket', {
      bucketName: `wotr-photos-${this.account}`,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create S3 bucket for hosting SPA (public)
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `wotr-website-${this.account}`,
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // IAM Roles
    const createWorkoutRole = new iam.Role(this, 'CreateWorkoutLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for createWorkout Lambda',
    });

    createWorkoutRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );

    createWorkoutRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
          resources: [workoutTable.tableArn],
        })
    );

    const getWorkoutsRole = new iam.Role(this, 'GetWorkoutsLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for getWorkouts Lambda',
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

    const uploadUrlRole = new iam.Role(this, 'UploadUrlLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for getUploadUrl Lambda',
    });

    uploadUrlRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
    );

    uploadUrlRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:PutObject'],
          resources: [`${photoBucket.bucketArn}/*`],
        })
    );

    uploadUrlRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['dynamodb:UpdateItem'],
          resources: [workoutTable.tableArn],
        })
    );

    // Lambda Functions
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
        externalModules: ['@aws-sdk/*'],
      },
    });

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
        externalModules: ['@aws-sdk/*'],
      },
    });

    const getUploadUrlLambda = new lambdaNodejs.NodejsFunction(this, 'GetUploadUrlFunction', {
      functionName: 'getUploadUrl',
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../../services/api/getUploadUrl.ts'),
      handler: 'handler',
      role: uploadUrlRole,
      environment: {
        PHOTO_BUCKET: photoBucket.bucketName,
        TABLE_NAME: workoutTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // API Gateway
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

    const workoutsResource = api.root.addResource('workouts');

    workoutsResource.addMethod('POST', new apigateway.LambdaIntegration(createWorkoutLambda, { proxy: true }));
    workoutsResource.addMethod('GET', new apigateway.LambdaIntegration(getWorkoutsLambda, { proxy: true }));

    // Add /workouts/{workoutId}/upload endpoint
    const workoutIdResource = workoutsResource.addResource('{workoutId}');
    const uploadResource = workoutIdResource.addResource('upload');
    uploadResource.addMethod('POST', new apigateway.LambdaIntegration(getUploadUrlLambda, { proxy: true }));

    // Deploy website to S3
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../../app'))],
      destinationBucket: websiteBucket,
    });

    // Outputs
    new cdk.CfnOutput(this, 'TableName', {
      value: workoutTable.tableName,
      description: 'DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'PhotoBucketName', {
      value: photoBucket.bucketName,
      description: 'Photo bucket name',
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: websiteBucket.bucketWebsiteUrl,
      description: 'Website URL',
      exportName: 'WorkoutWebsiteUrl',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'WorkoutApiUrl',
    });
  }
}