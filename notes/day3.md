# Day 3 - API Gateway and Lambda (GET/POST)

**Date:** 2026-02-12  
**Tag:** v0.13

## ✅ Completed Objectives

- [x] Published REST API endpoints: POST /workouts and GET /workouts
- [x] Created GET endpoint with required query parameters (from/to)
- [x] Added Global Secondary Index for timestamp-based queries
- [x] Implemented date range validation and filtering
- [x] Reused Day-2 Lambda for POST /workouts
- [x] GET queries workouts by time window using GSI
- [x] Proper error handling with 400 for invalid/missing parameters
- [x] All endpoints have CORS enabled

## 📝 What Worked

- API Gateway REST API with Lambda proxy integration
- Global Secondary Index (GSI1PK=WORKOUTS, GSI1SK=timestamp) for efficient queries
- Required query parameter validation in Lambda
- Date range validation with proper error messages
- Separate IAM roles for create (PutItem) vs query (Query) operations
- CloudWatch logging and metrics enabled on API Gateway
- `@types/aws-lambda` for proper TypeScript types

## 🚧 What Was Blocked / Issues Encountered

### npx ts-node Not Found
- **Issue**: `cdk synth` failed with "ts-node: command not found"
- **Root Cause**: ts-node wasn't installed in the CDK project
- **Solution**: Used `npx cdk synth` which finds locally installed packages in node_modules/.bin/

### API Gateway Parameter Validation
- **Challenge**: Ensuring from/to parameters are truly required
- **Solution**: Marked parameters as required in CDK and validated in Lambda handler, returning 400 if missing

## 💡 Learnings

### API Gateway Request Parameters
typescript requestParameters: { 'method.request.querystring.from': true, // Required 'method.request.querystring.to': true, // Required }

This provides metadata but doesn't enforce validation - Lambda must still validate!

### DynamoDB GSI for Time-Based Queries
typescript GSI1PK: 'WORKOUTS', // Partition key for all workouts GSI1SK: timestamp, // Sort key for time ordering

Benefits:
- Query all workouts across users
- Filter by date range efficiently
- Supports pagination (for future)
- No table scan required

### Date Range Query Pattern
typescript KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :from AND :to'

- Uses BETWEEN operator for inclusive range
- Requires ISO 8601 format for proper lexicographic sorting
- Validates dates client-side before querying

### Separate IAM Roles by Operation
**Create Workout Role**: Only `dynamodb:PutItem`  
**Get Workouts Role**: Only `dynamodb:Query` on table and indexes

This follows least-privilege principle - each Lambda can only perform its specific operation.

### CORS Configuration
typescript defaultCorsPreflightOptions: { allowOrigins: apigateway.Cors.ALL_ORIGINS, allowMethods: apigateway.Cors.ALL_METHODS, allowHeaders: ['Content-Type', 'Authorization'], }

Essential for SPA to call API from different origin.

## 🧪 Testing Commands
Get API URL
API_URL=$(aws cloudformation describe-stacks --stack-name CdkStack
--query 'Stacks[0].Outputs[?OutputKey==ApiUrl].OutputValue'
--output text)
Create test workouts
curl -X POST "${API_URL}workouts"
-H "Content-Type: application/json"
-d '{ "userId": "user123", "workoutId": "workout-1", "type": "Running", "durationMin": 30, "timestamp": "2026-02-12T10:00:00Z" }'
Query workouts by date range
curl -X GET "${API_URL}workouts?from=2026-02-12T00:00:00Z&to=2026-02-14T00:00:00Z"
Test missing parameters (should return 400)
curl -X GET "${API_URL}workouts"
Test invalid date format (should return 400)
curl -X GET "${API_URL}workouts?from=invalid&to=2026-02-14T00:00:00Z"

## 📊 API Endpoints

### POST /workouts
**Request:**
json { "userId": "string", "workoutId": "string", "type": "string", "durationMin": number, "timestamp": "ISO 8601 string (optional)" }

**Response:** 201 Created
json { "message": "Workout created successfully", "item": { ...workout } }

### GET /workouts?from={ISO 8601}&to={ISO 8601}
**Response:** 200 OK
json { "count": number, "from": "ISO 8601 string", "to": "ISO 8601 string", "workouts": [...] }

**Error Response:** 400 Bad Request
json { "error": "Missing required query parameters: from and to", "message": "Both "from" and "to" date parameters are required..." }

## 📁 Files Created/Modified
services/api/ ├── createWorkout.ts # Updated to include GSI attributes └── getWorkouts.ts # New Lambda for querying workouts
infra/cdk/lib/ └── cdk-stack.ts # Added API Gateway, GSI, and getWorkouts Lambda

## 🎯 Next Steps (Day 4)

- Host minimal SPA in S3 static website
- Implement pre-signed URL generation for photo uploads
- Add photoKey attribute to workout items
- Create Lambda to generate pre-signed PUT URLs
- Build UI with Lit for photo upload
- Ensure photo bucket remains private

## 🌟 Stretch Goals (Not Completed)

- [ ] Pagination with nextToken for large result sets
- [ ] Export OpenAPI specification
- [ ] Request/response validation schemas
- [ ] Rate limiting and throttling configuration

## 📝 Notes

- API Gateway logs are stored in CloudWatch Logs
- All Lambda functions use Node.js 20.x runtime
- Source maps enabled for easier debugging
- Used CDK instead of SAM for infrastructure (better TypeScript integration)
- API Gateway deployed to 'prod' stage by default

