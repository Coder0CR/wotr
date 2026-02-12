
import { runS3SmokeTest } from './s3-smoke.js';

// You can pass a bucket name as a command line argument
// Example: ts-node run-s3-smoke.ts my-test-bucket
const bucketName = process.argv[2];

runS3SmokeTest(bucketName)
    .then(() => {
        console.log("\n✓ All operations completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n✗ Smoke test failed:", error.message);
        console.error(error);
        process.exit(1);
    });