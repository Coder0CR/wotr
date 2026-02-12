# wotr
Workout tracking prototyping

## Repo Org
wotr/
  app/                # SPA or minimal client (later)
  services/           # lambdas and container svc
    api/              # API handlers
    workers/          # async processors
    analytics/        # event pipeline pieces
  infra/
    sam/              # SAM templates
    cfn/              # raw CFN (select days)
  scripts/            # helper scripts / seeders
  notes/              # missed-Q log, cheatsheets
  .github/workflows/  # CI (later)

  ### Branching
  feature/wk{N}-d{M}-{slug} -> PR -> main

  ### Tag after each day
  v0.{week}{day} (i.e. v0.11 for Week1-Day1)

  ### Environment naming
  WOTR_STAGE = dev|prod

  ### Languages
  Typescript for most serverless

  # Project Plan
  ## Week 1 - Foundations (SDK, Lambda, API, S3, DynamoDB, Observability)
  Outcome: A minimal serverless CRUD for workouts with logs/metrics/traces
  ### Day 1 - Bootstrap and S3 SDK Smoke Test
  #### Objectives:
  * Configure AWS CLI profiles
  * Confirm programmatic access
  * Write a tiny SDK script to list/create buckets and put/get an object.
  #### Build:
  * Create scripts/s3-smoke.ts which lists buckets, uploads hello.txt, reads it back.
  #### Deliverables:
  * Tag v0.11
  * Create notes/day1.md (what worked/blocked)
  #### Stretch:
  * Add aws-sdk v3 retries with backoff
  * Add a --region CLI arg
    
  ### Day 2 - First Lambda and DynamoDB Write
  #### Objectives:
  * Deploy a Lambda that writes a workout item to DynamoDB using least-privilege IAM
  #### Build:
  * SAM defines a table WOTR (PK: pk, SK: sk)
  * Handler services/api/createWorkout.ts validates {type, durationMin, ts}
  * Writes pk=USER#{sub}, sk=WORKOUT#{ts}, GSI1PK=WORKOUTS, GSI1SK={ts} for global queries
  #### Acceptance:
  * sam deploy succeed
  * test event creates an item
  * CloudWatch logs show success
  * IAM policy grants only dynamodb:PutItem on the table
  #### Deliverables:
  * Tag v0.12
  * Create notes/day2.md with the exact IAM policy JSON
  #### Stretch:
  * Add conditional write to prevent duplicate ts

  ### Day 3 - API Gateway and Lambda (GET/POST)
  #### Objectives:
  * Publish REST endpoints: POST /workouts, GET /workouts?from=&to=
  #### Build:
  * SAM defines Api with two routes
  * Handler reuses Day-2 write
  * GET queries by time window (GSI)
  * Input/output JSON schemas (basic)
  #### Acceptance:
  * curl POST and GET both succeed
  * 4XX for invalid payload
  * 5XX never occurs on validation errors
  #### Deliverables:
  * Tag v0.13
  * Create notes/day3.md
  * OpenAPI export saved in infra/sam/openapi.json
  #### Stretch:
  * Return nextToken for pagination over GSI

  ### Day 4 - S3 Static Site and Pre-Signed Uploads (Photos of Workouts)
  #### Objectives:
  * Host a minimal SPA
  * Implement pre-signed PUT for image upload
  * Store metadata with the workout
  #### Build:
  * S3 website bucket (public via CloudFront later)
  * Lambda getUploadUrl.ts
  * Add photoKey to workout item and show in GET
  #### Acceptance:
  * Receive a pre-signed URL
  * Upload via curl -T file.jpg
  * GET /workouts shows the photokey
  #### Deliverables:
  * Tag v0.14
  * Create notes/day4.md
  * app/index.html with an upload form calling API
  #### Stretch:
  * Enforce content-type and object size limits in the pre-sign policy

  ### Day 5 - DynamoDB Design Upgrade (Single-Table Patterns)
  #### Objectives:
  * Support sessions grouping multiple sets/activities
  * Add query patterns
  #### Build:
  * Entities: SESSION#{date}(parent), SET#{uuid}(child)
  * Access Patterns: list sessions by date
  * List sets by session
  * Query last N sessions
  * Migrate handlers: POST /sessions, POST /sessions/{id}/sets
  #### Acceptance:
  * Create a session and two sets
  * Queries return the right shape and order
  #### Deliverables:
  * Tag v0.15
  * Create notes/day5.md
  * ERD note in notes/ddb-model.md
  #### Stretch:
  * Add a projection GSI for USER#{id} -> recent sessions (descending)

  ### Day 6 - Observability (logs, metrics, traces)
  #### Objectives:
  * Structured JSON logging
  * Custom metrics
  * X-Ray tracing across API -> Lambda -> DynamoDB
  #### Build:
  * Add Logger util with correlation IDs
  * Put ColdStart metric
  * Enable X-Ray on resources
  * Annotate traces with userId, sessionId
  #### Acceptance:
  * CloudWatch Insights query shows fields
  * X-Ray service map displays end-to-end path
  * One custom metric visible on a dashboard
  #### Deliverables:
  * Tag v0.16
  * Create notes/day6.md
  * Alarm on 5XX rate > 1% over 5 minutes
  #### Stretch:
  * Return nextToken for pagination over GSI

## Week 2 - Events, Orchestration, Async
  Outcome: Event-driven backbone: SQS/SNS/EventBridge, Step Functions, DLQs, and cost perf awareness
  ### Day 7 - SQS Buffering for Writes
  #### Objectives:
  * Decouple POST /workouts from DynamoDB write latency with SQS and worker Lambda
  #### Build:
  * API now sends message to workout-queue
  * Worker queueWorker.ts performs PutItem
  * Configure batch size and DLQ
  #### Acceptance:
  * Under 100 parallel POSTs, API stays <300ms p50
  * DLQ receives a poisoned message during your fault-injection test
  #### Deliverables:
  * Tag v0.21
  * Create notes/day7.md (what worked/blocked)
  * Create runbook in notes/runbook-queue.md
  #### Stretch:
  * Idempotency key strategy (dedupe on pk + sk)
    
  ### Day 8 - SNS Fan-Out for Notifications
  #### Objectives:
  * Notify on new PR (personal record) days
  #### Build:
  * Worker publishes to sns:pr-topic when durationMin exceeds last 30-day max
  * Subscriptions: email (for you) + Lambda to write PR_LOG items
  #### Acceptance:
  * Trigger a PR
  * Email received
  * PR_LOG written
  #### Deliverables:
  * Tag v0.22
  * Create notes/day8.md
  #### Stretch:
  * Filter policy to only push for "Run" type

  ### Day 9 - EventBridge: Rules and Scheduled Jobs
  #### Objectives:
  * Nightly summary and scheduled cleanup job
  #### Build:
  * Rule 1 (schedule): daily at 05:00, invokes dailySummary.ts to compute yesterday's totals
  * Rule 2 (pattern): on workout.created custom event, call a small transformer
  #### Acceptance:
  * Manually trigger schedule for testing
  * Artifact stored to S3: reports/YYYY-MM-DD.json
  #### Deliverables:
  * Tag v0.23
  * Create notes/day9.md
  #### Stretch:
  * Archive event bus to S3 for replay

  ### Day 10 - DynamoDB Streams Projector
  #### Objectives:
  * Maintain a "recent sessions" materialized view in another table
  #### Build:
  * Stream -> projector.ts writes RECENT_SESSIONS per user (top 10)
  #### Acceptance:
  * After adding 12 sessions, view remains top 10 sorted by ts
  #### Deliverables:
  * Tag v0.24
  * Create notes/day10.md
  * Include backfill script in scripts/backfill.ts
  #### Stretch:
  * Handle out-of-order updates with version attributes

  ### Day 11 - Step Functions Mini Workflow
  #### Objectives:
  * Orchestrate a 3-step pipeline: validate -> compute load -> notify
  #### Build:
  * ASL definition with retries (exponential), catch -> SQS DLQ
  #### Acceptance:
  * Successful and failed executions visible
  * DLQ has entries for simulated failures
  #### Deliverables:
  * Tag v0.25
  * Create notes/day11.md
  #### Stretch:
  * Map state to parallelize per-set computations

  ### Day 12 - Cost and Performance Review
  #### Objectives:
  * Build a dashboard
  * Configure budget alert
  * Tame hot paths
  #### Build:
  * CloudWatch dashboard: API p50/95, Lambda errors/durations, SQS age, DDB RCUs/WCUs
  * AWS Budgets alert at a low threshold (dev account)
  * Optimize: bump Lambda memory to reduce p95
  * Add APIGW throttling
  #### Acceptance:
  * Dashboard shows all widgets
  * Budget email arrives after a small spend test
  * Latency improves after tuning
  #### Deliverables:
  * Tag v0.26
  * Create notes/day12.md
  * notes/cost.md with before/after numbers
  #### Stretch:
  * Adopt Provisioned Concurrency for one hot Lambda

## Week 3 - Security Core (IAM, KMS, Secrets, Cognito, API Auth)
  Outcome: Least-privilege, encryption, secure secrets, and user sign-in
  ### Day 13 - IAM least privilege pass
  #### Objectives:
  * Replace wildcards with resource-scoped policies
  * Policy simulator checks
  #### Build:
  * Split execution roles by function
  * Boundary policies for CI role
  #### Acceptance:
  * Policy simulator: denied action proven, then resolved
  * cfn-nag shows no high-severity findings
  #### Deliverables:
  * Tag v0.31
  * Create notes/day13.md (what worked/blocked)
  * Create notes/iam-review.md
  #### Stretch:
  * Deny-by-default SCP mock via docs/notes (if orgs unavailable)
    
  ### Day 14 - KMS and Encryption Patterns
  #### Objectives:
  * CMK for DynamoDB/S3 encryption
  * Envelope encryption in code for a sensitive field
  #### Build:
  * KMS key with rotation
  * Use data-key to encrypt a small JSON blob
  #### Acceptance:
  * Items store only ciphertext for sensitive field
  * Decrypt path works
  * Key rotation simulated via alias switch
  #### Deliverables:
  * Tag v0.32
  * Create notes/day14.md
  #### Stretch:
  * Encrypt SQS/SNS with KMS keys and show failure without permissions

  ### Day 15 - Secrets Manager and Parameter Store
  #### Objectives:
  * Remove any secrets from env
  * Add rotation for an RDS demo user
  #### Build:
  * GET /secrets-check fetches a dummy API key at runtime
  * Rotation lambda for RDS secret
  #### Acceptance:
  * Endpoint returns masked secret value
  * Rotation test rotates once without breaking retrieval
  #### Deliverables:
  * Tag v0.33
  * Create notes/day15.md
  #### Stretch:
  * Cache secrets and implement jittered refresh logic

  ### Day 16 - API Authentication with IAM SigV4
  #### Objectives:
  * Protect one endpoint using AWS_IAM
  #### Build:
  * APIG method auth = AWS_IAM
  * CLI smaple with --sigv4 proves access only with role creds
  #### Acceptance:
  * Unauth call fails with 403
  * Signed call succeeds
  #### Deliverables:
  * Tag v0.34
  * Create notes/day16.md
  #### Stretch:
  * Resource policy limiting to your VPC or IP

  ### Day 17 - Cognito User Pools and Authorizer
  #### Objectives:
  * Add user sign-up/sign-in and token-based auth
  #### Build:
  * Cognito user pool and app client
  * APIGW Cognito authorizer on /me/*
  * New route GET /me/sessions uses sub claim
  #### Acceptance:
  * Hosted UI login works
  * ID token validates
  * /me/sessions returns onlyu caller's data
  #### Deliverables:
  * Tag v0.35
  * Create notes/day17.md
  #### Stretch:
  * Add a refresh token flow in SPA

  ### Day 18 - Audit and Trail
  #### Objectives:
  * CloudTrail data events for S3/DDB
  * S3 access logs
  * Minimal detective guardrails
  #### Build:
  * Enable trails
  * Bucket access logging
  * Basic CloudWatch alarm for unauthorized API calls
  #### Acceptance:
  * Generate one unauthorized call
  * Alarm fires
  * Trails show the event
  #### Deliverables:
  * Tag v0.36
  * Create notes/day18.md
  #### Stretch:
  * Add a config rule (managed) to flag public S3 buckets

## Week 4 - Deploy Mastery (SAM, CodeBuild, CodePipeline, CodeDeploy)
  Outcome: One-click CI/CD pipeline with safe deployments
  ### Day 19 - SAM packaging and envs
  #### Objectives:
  * Parameterize dev and prod
  * Separate stacks and buckets
  * Outputs exposed
  #### Build:
  * samconfig.toml profiles
  * Param overrides
  * Outputs consumed by scripts
  #### Acceptance:
  * sam deploy --config-env dev|prod works
  * Distinct stacks visible
  #### Deliverables:
  * Tag v0.41
  * Create notes/day41.md (what worked/blocked)
  #### Stretch:
  * Export endpoints and read them in SPA build
    
  ### Day 20 - Lambda versions and aliases with CodeDeploy canary
  #### Objectives:
  * Safer serverless releases
  #### Build:
  * SAM AutoPublishAlias + CodeDeploy Lambda deployment pref 10%/10min
  #### Acceptance:
  * Trigger a failing version -> automatic rollback
  * CloudWatch alarm drives rollback
  #### Deliverables:
  * Tag v0.42
  * Create notes/day20.md
  #### Stretch:
  * Include PreTraffic/PostTraffic hooks for smoke tests

  ### Day 21 - CodeBuild (CI)
  #### Objectives:
  * Build, lint, unit test, package artifacts
  #### Build:
  * buildspec.yml for Node tests + SAM build
  * Cache deps
  * Upload artifacts to S3
  #### Acceptance:
  * CodeBuild project saucceeds
  * JUnit report stored as artifact
  #### Deliverables:
  * Tag v0.43
  * Create notes/day21.md
  #### Stretch:
  *  Add mutation tests or coverage threshold

  ### Day 22 - CodePipeline (CD)
  #### Objectives:
  * Commit -> build -> deploy to dev, manual approval -> prod
  #### Build:
  * Pipeline
  #### Acceptance:
  * Unauth call fails with 403
  * Signed call succeeds
  #### Deliverables:
  * Tag v0.34
  * Create notes/day16.md
  #### Stretch:
  * Resource policy limiting to your VPC or IP

  ### Day 17 - Cognito User Pools and Authorizer
  #### Objectives:
  * Add user sign-up/sign-in and token-based auth
  #### Build:
  * Cognito user pool and app client
  * APIGW Cognito authorizer on /me/*
  * New route GET /me/sessions uses sub claim
  #### Acceptance:
  * Hosted UI login works
  * ID token validates
  * /me/sessions returns onlyu caller's data
  #### Deliverables:
  * Tag v0.35
  * Create notes/day17.md
  #### Stretch:
  * Add a refresh token flow in SPA

  ### Day 18 - Audit and Trail
  #### Objectives:
  * CloudTrail data events for S3/DDB
  * S3 access logs
  * Minimal detective guardrails
  #### Build:
  * Enable trails
  * Bucket access logging
  * Basic CloudWatch alarm for unauthorized API calls
  #### Acceptance:
  * Generate one unauthorized call
  * Alarm fires
  * Trails show the event
  #### Deliverables:
  * Tag v0.36
  * Create notes/day18.md
  #### Stretch:
  * Add a config rule (managed) to flag public S3 buckets
