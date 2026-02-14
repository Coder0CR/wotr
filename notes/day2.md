# Day 2 - First Lambda and DynamoDB Write

**Date:** 2026-02-12  
**Tag:** v0.12

## ✅ Completed Objectives

- [x] Deployed a Lambda function that writes workout items to DynamoDB
- [x] Created DynamoDB table WOTR with partition key (pk) and sort key (sk)
- [x] Implemented least-privilege IAM role with only PutItem permission
- [x] Handler validates required fields: userId, workoutId, type, durationMin
- [x] Implemented key prefixing: pk=USER#{userId}, sk=WORKOUT#{workoutId}
- [x] Created comprehensive unit tests for CDK stack
- [x] Created integration tests for Lambda function
- [x] CloudWatch logs show successful execution

## 📝 What Worked

- CDK with TypeScript for infrastructure as code
- `NodejsFunction` construct automatically bundles TypeScript Lambda code
- AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/util-dynamodb`)
- Jest with ts-jest for unit and integration testing
- Separating unit tests (run locally) from integration tests (require deployed resources)
- Test script (`scripts/test-lambda.ts`) for quick manual testing

## 🚧 What Was Blocked / Issues Encountered

### Lambda Module Not Found Error
- **Issue**: Lambda couldn't find the `createWorkout` module at runtime
- **Root Cause**: CDK was uploading TypeScript files but Lambda needs JavaScript
- **Solution**: Switched from `lambda.Function` to `lambdaNodejs.NodejsFunction` which automatically bundles TypeScript with esbuild

### Jest ESM Module Issues
- **Issue**: `TypeError: A dynamic import callback was invoked without --experimental-vm-modules`
- **Root Cause**: Jest struggles with AWS SDK v3's ES modules
- **Solution**: Added `NODE_OPTIONS=--experimental-vm-modules` to test scripts and simplified Jest config to use CommonJS

### AWS CLI Payload Encoding
- **Issue**: `InvalidRequestContentException` when testing Lambda with single-quoted JSON
- **Root Cause**: macOS shell handling of quotes caused encoding issues
- **Solution**: Use `file://` protocol with JSON file or `--cli-binary-format raw-in-base64-out`

## 💡 Learnings

### IAM Least Privilege
The Lambda execution role has exactly two policies:
1. **AWSLambdaBasicExecutionRole** (managed): CloudWatch Logs permissions
2. **Custom inline policy**: Only `dynamodb:PutItem` on the WOTR table

### Exact IAM Policy JSON
json { "Version": "2012-10-17", "Statement": [ {  }


### Single-Table Design Principles
- **Partition Key Pattern**: `USER#{userId}` enables user-scoped queries
- **Sort Key Pattern**: `WORKOUT#{workoutId}` provides unique workout identification
- **Benefits**: Allows querying all workouts for a user efficiently
- **Future-ready**: Can add more entity types (e.g., `SESSION#`, `SET#`) to same table

### Testing Strategy
- **Unit tests**: Validate CDK synthesizes correct CloudFormation resources
- **Integration tests**: Actually invoke deployed Lambda and verify DynamoDB writes
- **Guard rail**: Integration tests only run when `RUN_INTEGRATION_TESTS=true`

### CDK NodejsFunction Bundling
typescript bundling: { minify: false, // Keep readable for debugging sourceMap: true, // Enable debugging in CloudWatch externalModules: [ '@aws-sdk/*', // Already in Lambda runtime ], }

## 🧪 Testing Commands
Unit tests (no AWS resources needed)
npm run test
Integration tests (requires deployed stack)
npm run test:integration
Quick Lambda smoke test
npm run test:lambda
Deploy stack
npm run cdk:deploy
View CloudWatch logs
aws logs tail /aws/lambda/createWorkout --follow


## 📊 Test Results

### Unit Tests
- ✅ DynamoDB table created with correct keys
- ✅ Lambda function configured properly
- ✅ Environment variable references table
- ✅ IAM role has only PutItem permission
- ✅ CloudWatch Logs permission attached
- ✅ Stack outputs defined

### Integration Tests
- ✅ Successfully creates workout item in DynamoDB
- ✅ Returns 400 for missing required fields
- ✅ Handles different workout types
- ✅ Correctly prefixes PK with USER# and SK with WORKOUT#

## 📁 Files Created
- infra/cdk/lib/cdk-stack.ts
- infra/cdk/test/cdk-stack.test.ts
- infra/cdk/test/integration/create-workout.test.ts
- services/api/createWorkout.ts
- services/api/createWorkout.test.ts
- scripts/test-lambda.ts
- notes/day2.md


## 🎯 Next Steps (Day 3)

- Add API Gateway REST endpoints (POST /workouts, GET /workouts)
- Implement GET handler with time range queries
- Add GSI for global workout queries
- Input/output validation and schemas
- API-level error handling (4XX for bad input, never 5XX on validation)

## 🌟 Stretch Goals (Not Completed)

- [ ] Add conditional write to prevent duplicate workouts
- [ ] Add GSI1PK=WORKOUTS, GSI1SK={timestamp} for global queries
- [ ] Implement pagination support

## 📝 Notes

- Used CDK instead of SAM as specified in objectives - CDK provides better TypeScript support and type safety
- Table uses on-demand billing mode (PAY_PER_REQUEST) to avoid capacity planning during prototyping
- RemovalPolicy set to DESTROY for easy cleanup during development (should be RETAIN in production)
- Lambda timeout set to 30 seconds (generous for a simple write operation)
- Used `NODE_OPTIONS=--experimental-vm-modules` for Jest to handle AWS SDK v3's ES modules