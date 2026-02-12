# Day 1 - Bootstrap and S3 SDK Smoke Test

**Date:** 2026-02-12  
**Tag:** v0.11

## ✅ Completed Objectives

- [x] Configured AWS CLI profiles
- [x] Confirmed programmatic access
- [x] Created S3 smoke test script (`scripts/s3-smoke.ts`)
- [x] Implemented bucket listing
- [x] Implemented file upload (hello.txt)
- [x] Implemented file read-back and content verification
- [x] Implemented file deletion
- [x] Set up CDK infrastructure foundation

## 📝 What Worked

- AWS SDK v3 (`@aws-sdk/client-s3`) installation and setup
- TypeScript ES modules configuration
- S3 operations (PutObject, GetObject, DeleteObject, ListBuckets)
- Clean separation of concerns with helper functions

## 🚧 What Was Blocked / Issues Encountered

- Initial ES module vs CommonJS confusion with `require.main`
- Missing `@types/node` dependency initially
- CDK setup required creating proper directory structure and config files

## 💡 Learnings

- ES modules in TypeScript require `import.meta.url` for script detection
- AWS SDK v3 uses command pattern for operations
- S3 bucket naming must be globally unique

## 🎯 Next Steps (Day 2)

- Deploy first Lambda function
- Create DynamoDB table with proper partition/sort keys
- Implement least-privilege IAM policies