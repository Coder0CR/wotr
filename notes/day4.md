# Day 4 - S3 Static Site and Pre-Signed Uploads

**Date:** 2026-02-12  
**Tag:** v0.14

## ✅ Completed Objectives

- [x] Hosted minimal SPA using Lit web components
- [x] Implemented pre-signed PUT URL generation for image uploads
- [x] Added photoKey attribute to workout items
- [x] Created Lambda getUploadUrl.ts for pre-signed URL generation
- [x] Private S3 bucket for photo storage with CORS
- [x] Public S3 bucket for hosting SPA
- [x] Photo upload form integrated into SPA
- [x] GET /workouts returns photoKey when present
- [x] Content-type enforcement in pre-signed URLs

## 📝 What Worked

- Lit web components from CDN (no build step required)
- S3 pre-signed URLs with 5-minute expiry
- Automatic website deployment using CDK BucketDeployment
- CORS configuration on photo bucket for cross-origin uploads
- POST /workouts/{workoutId}/upload endpoint for pre-signed URL
- DynamoDB UpdateItem to add photoKey after URL generation
- Separate IAM roles for each Lambda function

## 🚧 What Was Blocked / Issues Encountered

### S3 Website Deployment
- **Challenge**: Initial deployment required manual API URL configuration
- **Solution**: Two-step deployment process:
    1. Deploy stack to get API URL
    2. Update app.js with API URL
    3. Redeploy to update website files

### Pre-Signed URL CORS
- **Issue**: Browser blocked PUT requests to S3
- **Root Cause**: Missing CORS configuration on photo bucket
- **Solution**: Added CORS rules for PUT/POST methods with wildcard origins

### Photo Key Storage
- **Challenge**: Deciding when to update DynamoDB with photoKey
- **Solution**: Update immediately when pre-signed URL is generated, not after upload completes
- **Trade-off**: photoKey exists even if upload fails, but simpler implementation

## 💡 Learnings

### S3 Pre-Signed URLs
typescript const command = new PutObjectCommand({ Bucket: PHOTO_BUCKET, Key: photoKey, ContentType: contentType, });
const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 // 5 minutes });

Benefits:
- Client uploads directly to S3 (no Lambda proxy)
- Bucket can remain private
- Time-limited access (5 minutes)
- Content-type enforced

### Photo Key Naming Strategy
workouts/{userId}/{workoutId}/{timestamp}.jpg

Benefits:
- Naturally organized by user
- Easy to find photos for specific workout
- Timestamp prevents collisions
- Clear hierarchy for future cleanup scripts

### Lit Web Components
Using Lit from CDN (no build step):
javascript import { LitElement, html, css } from '[https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js](https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js)';

Benefits:
- No npm dependencies
- No bundler required
- Fast prototyping
- Modern reactive components

### S3 Static Website Hosting
typescript websiteIndexDocument: 'index.html', publicReadAccess: true,

Simple but effective for prototyping. CloudFront will be added later for:
- HTTPS
- Custom domain
- Caching
- Better performance

### IAM Permissions for getUploadUrl
typescript 's3:PutObject' on photo bucket 'dynamodb:UpdateItem' on workout table

Allows generating pre-signed URLs and updating workout records, but nothing else.

## 🧪 Testing Commands
Get API and Website URLs
API_URL=$(aws cloudformation describe-stacks --stack-name CdkStack
--query 'Stacks[0].Outputs[?OutputKey==ApiUrl].OutputValue'
--output text)
WEBSITE_URL=$(aws cloudformation describe-stacks --stack-name CdkStack
--query 'Stacks[0].Outputs[?OutputKey==WebsiteUrl].OutputValue'
--output text)
echo "API: API_URL" echo "Website:WEBSITE_URL"
Create a workout
curl -X POST "${API_URL}workouts"
-H "Content-Type: application/json"
-d '{ "userId": "user123", "workoutId": "workout-test", "type": "Running", "durationMin": 30 }'
Get pre-signed upload URL
curl -X POST "${API_URL}workouts/workout-test/upload"
-H "Content-Type: application/json"
-d '{"userId": "user123", "contentType": "image/jpeg"}'
Upload photo using pre-signed URL (example)
UPLOAD_URL=""
curl -X PUT "$UPLOAD_URL" \
-H "Content-Type: image/jpeg" \
--data-binary @photo.jpg
Verify photoKey was added
curl -X GET "${API_URL}workouts?from=2026-02-01T00:00:00Z&to=2026-12-31T00:00:00Z"

## 📊 New API Endpoint

### POST /workouts/{workoutId}/upload
**Request:**
json { "userId": "string", "contentType": "string (optional, default: image/jpeg)" }
**Response:** 200 OK
json { "uploadUrl": "https://...", "photoKey": "workouts/user123/workout-123/1234567890.jpg", "expiresIn": 300 }
### Using the Pre-Signed URL
javascript // 1. Get pre-signed URL const response = await fetch(`${API_URL}workouts/${workoutId}/upload`, { method: 'POST', body: JSON.stringify({ userId, contentType: file.type }) }); const { uploadUrl } = await response.json();
// 2. Upload file directly to S3 await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
## 📁 Files Created/Modified
app/ ├── index.html # SPA entry point └── app.js # Lit web component
services/api/ ├── createWorkout.ts # Updated to support photoKey (optional) ├── getWorkouts.ts # Returns photoKey in results └── getUploadUrl.ts # New: Pre-signed URL generation
infra/cdk/lib/ └── cdk-stack.ts # Added S3 buckets, deployment, new Lambda

## 🏗️ Architecture
Browser (SPA) ↓ API Gateway ↓ ┌─────────────────┬──────────────────┬─────────────────────┐ │ │ │ │ createWorkout getWorkouts getUploadUrl │ Lambda Lambda Lambda │ ↓ ↓ ↓ │ DynamoDB ───────┴─────────────┘ │ ↓ │ Pre-signed URL │ ↓ │ Browser ─────────────────────────────────────────→ S3 Photo Bucket (Direct PUT)

## 🎯 Next Steps (Day 5)

- Upgrade DynamoDB to support sessions with multiple sets
- Implement SESSION#{date} and SET#{uuid} entities
- Add query patterns for listing sessions and sets
- Support parent-child relationships
- Optimize access patterns with additional GSIs
## 🌟 Stretch Goals (Not Completed)

- [ ] Enforce file size limits in pre-signed policy
- [ ] Validate image file types (JPEG, PNG only)
- [ ] Generate thumbnails after upload
- [ ] CloudFront distribution for website
- [ ] Custom domain with HTTPS

## 📝 Notes

### S3 Bucket Configuration
- **Photo Bucket**: Private with CORS for uploads
- **Website Bucket**: Public read access for static hosting
- Both configured with `autoDeleteObjects: true` for easy cleanup
- Bucket names include AWS account ID for global uniqueness

### Security Considerations
- Photo bucket remains private (no public read access)
- Pre-signed URLs expire after 5 minutes
- Content-type is locked at URL generation time
- Each pre-signed URL only works for specific key
- Future: Add file size limits and validation

### SPA Features
- Create new workouts
- View recent workouts (last 30 days)
- Upload photos for existing workouts
- Shows which workouts have photos
- Responsive design with system fonts

### Deployment Notes
- Website automatically deployed on `cdk deploy`
- Changes to app/ folder require redeployment
- No build step required (Lit from CDN)
- API URL must be updated manually in app.js after first deployment