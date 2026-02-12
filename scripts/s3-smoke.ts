
import {
    S3Client,
    ListBucketsCommand,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    CreateBucketCommand,
    HeadBucketCommand
} from "@aws-sdk/client-s3";

const DISPLAY_HEADERS = {
    TITLE: "S3 Buckets:",
    SEPARATOR: "===========",
    NO_BUCKETS: "  No buckets found",
} as const;

const S3_CLIENT_CONFIG = {};
const TEST_FILE_KEY = "hello.txt";
const TEST_FILE_CONTENT = "Hello from WOTR S3 smoke test!";

/**
 * Displays the list of S3 buckets to the console
 */
function displayBuckets(buckets: any[] | undefined) {
    console.log(DISPLAY_HEADERS.TITLE);
    console.log(DISPLAY_HEADERS.SEPARATOR);

    if (buckets && buckets.length > 0) {
        buckets.forEach((bucket) => {
            console.log(`  - ${bucket.Name} (Created: ${bucket.CreationDate})`);
        });
        console.log(`\nTotal: ${buckets.length} bucket(s)`);
    } else {
        console.log(DISPLAY_HEADERS.NO_BUCKETS);
    }
}

/**
 * Lists all S3 buckets in the AWS account
 */
async function listAllBuckets(client: S3Client) {
    try {
        const command = new ListBucketsCommand({});
        const response = await client.send(command);

        displayBuckets(response.Buckets);

        return response.Buckets;
    } catch (error) {
        console.error("Error listing buckets:", error);
        throw error;
    }
}

/**
 * Ensures a test bucket exists, creating it if necessary
 */
async function ensureTestBucket(client: S3Client, bucketName: string): Promise<void> {
    try {
        await client.send(new HeadBucketCommand({ Bucket: bucketName }));
        console.log(`\n✓ Using existing bucket: ${bucketName}`);
    } catch (error: any) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            console.log(`\n→ Creating test bucket: ${bucketName}`);
            await client.send(new CreateBucketCommand({ Bucket: bucketName }));
            console.log(`✓ Bucket created: ${bucketName}`);
        } else {
            throw error;
        }
    }
}

/**
 * Uploads a test file to S3
 */
async function uploadTestFile(client: S3Client, bucketName: string): Promise<void> {
    console.log(`\n→ Uploading ${TEST_FILE_KEY} to ${bucketName}...`);

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: TEST_FILE_KEY,
        Body: TEST_FILE_CONTENT,
        ContentType: "text/plain",
    });

    await client.send(command);
    console.log(`✓ Successfully uploaded ${TEST_FILE_KEY}`);
}

/**
 * Reads and displays the content of the test file from S3
 */
async function readTestFile(client: S3Client, bucketName: string): Promise<string> {
    console.log(`\n→ Reading ${TEST_FILE_KEY} from ${bucketName}...`);

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: TEST_FILE_KEY,
    });

    const response = await client.send(command);
    const content = await response.Body?.transformToString();

    console.log(`✓ File content retrieved:`);
    console.log(`  "${content}"`);

    return content || "";
}

/**
 * Deletes the test file from S3
 */
async function deleteTestFile(client: S3Client, bucketName: string): Promise<void> {
    console.log(`\n→ Deleting ${TEST_FILE_KEY} from ${bucketName}...`);

    const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: TEST_FILE_KEY,
    });

    await client.send(command);
    console.log(`✓ Successfully deleted ${TEST_FILE_KEY}`);
}

/**
 * Runs the complete S3 smoke test
 */
async function runS3SmokeTest(bucketName?: string): Promise<void> {
    const client = new S3Client(S3_CLIENT_CONFIG);

    // Use provided bucket name or generate one
    const testBucketName = bucketName || `wotr-smoke-test-${Date.now()}`;

    console.log("=".repeat(60));
    console.log("S3 SMOKE TEST");
    console.log("=".repeat(60));

    // Step 1: List all buckets
    await listAllBuckets(client);

    // Step 2: Ensure test bucket exists
    await ensureTestBucket(client, testBucketName);

    // Step 3: Upload test file
    await uploadTestFile(client, testBucketName);

    // Step 4: Read test file
    const content = await readTestFile(client, testBucketName);

    // Step 5: Verify content matches
    if (content === TEST_FILE_CONTENT) {
        console.log(`✓ Content verification passed`);
    } else {
        throw new Error("Content mismatch!");
    }

    // Step 6: Delete test file
    await deleteTestFile(client, testBucketName);

    console.log("\n" + "=".repeat(60));
    console.log("✓ SMOKE TEST COMPLETED SUCCESSFULLY");
    console.log("=".repeat(60));
}

export { runS3SmokeTest, listAllBuckets };