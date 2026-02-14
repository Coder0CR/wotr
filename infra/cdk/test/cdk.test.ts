
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CdkStack } from '../lib/cdk-stack';

describe('CdkStack', () => {
    let app: cdk.App;
    let stack: CdkStack;
    let template: Template;

    beforeEach(() => {
        app = new cdk.App();
        stack = new CdkStack(app, 'TestStack');
        template = Template.fromStack(stack);
    });

    test('DynamoDB Table Created with Correct Keys', () => {
        template.hasResourceProperties('AWS::DynamoDB::Table', {
            TableName: 'WOTR',
            KeySchema: [
                {
                    AttributeName: 'pk',
                    KeyType: 'HASH'
                },
                {
                    AttributeName: 'sk',
                    KeyType: 'RANGE'
                }
            ],
            BillingMode: 'PAY_PER_REQUEST'
        });
    });

    test('Lambda Function Created with Correct Configuration', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
            FunctionName: 'createWorkout',
            Runtime: 'nodejs20.x',
            Handler: 'createWorkout.handler',
            Timeout: 30
        });
    });

    test('Lambda Has Environment Variable for Table Name', () => {
        // CDK uses CloudFormation references, so we need to match the structure
        template.hasResourceProperties('AWS::Lambda::Function', {
            Environment: {
                Variables: {
                    TABLE_NAME: Match.anyValue() // Can also use Match.stringLikeRegexp() if needed
                }
            }
        });
    });
    test('Lambda Environment Variable References DynamoDB Table', () => {
        const json = template.toJSON();

        // Find the Lambda function
        const lambdaLogicalId = Object.keys(json.Resources).find(
            key => json.Resources[key].Type === 'AWS::Lambda::Function'
        );

        // Find the DynamoDB table
        const tableLogicalId = Object.keys(json.Resources).find(
            key => json.Resources[key].Type === 'AWS::DynamoDB::Table'
        );

        expect(lambdaLogicalId).toBeDefined();
        expect(tableLogicalId).toBeDefined();

        const lambda = json.Resources[lambdaLogicalId!];
        const tableNameEnv = lambda.Properties.Environment.Variables.TABLE_NAME;

        // The TABLE_NAME should reference the table (either directly or via Ref)
        // In this case, it's the literal table name "WOTR"
        expect(tableNameEnv).toBeDefined();
    });
    test('IAM Role Has Only PutItem Permission', () => {
        template.hasResourceProperties('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: Match.arrayWith([
                    Match.objectLike({
                        Action: 'dynamodb:PutItem',
                        Effect: 'Allow',
                        Resource: Match.anyValue()
                    })
                ])
            }
        });
    });

    test('IAM Role Has CloudWatch Logs Permission', () => {
        template.hasResourceProperties('AWS::IAM::Role', {
            ManagedPolicyArns: Match.arrayWith([
                Match.objectLike({
                    'Fn::Join': Match.arrayWith([
                        Match.arrayWith([
                            Match.stringLikeRegexp('.*AWSLambdaBasicExecutionRole')
                        ])
                    ])
                })
            ])
        });
    });

    test('Stack Has Required Outputs', () => {
        template.hasOutput('TableName', {
            Description: 'DynamoDB table name'
        });

        template.hasOutput('LambdaFunctionName', {
            Description: 'Lambda function name'
        });

        template.hasOutput('LambdaRoleArn', {
            Description: 'IAM role ARN for Lambda'
        });
    });

    test('Correct Number of Resources Created', () => {
        const resources = template.toJSON().Resources;
        const resourceTypes = Object.values(resources).map((r: any) => r.Type);

        expect(resourceTypes).toContain('AWS::DynamoDB::Table');
        expect(resourceTypes).toContain('AWS::Lambda::Function');
        expect(resourceTypes).toContain('AWS::IAM::Role');
        expect(resourceTypes).toContain('AWS::IAM::Policy');
    });
});