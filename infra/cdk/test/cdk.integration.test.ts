
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

// Skip these tests if not running in integration mode
const isIntegrationTest = process.env.RUN_INTEGRATION_TESTS === 'true';

const describeIf = isIntegrationTest ? describe : describe.skip;

describeIf('CreateWorkout Lambda Integration Tests', () => {
    const lambdaClient = new LambdaClient({});
    const dynamoDbClient = new DynamoDBClient({});

    const FUNCTION_NAME = 'createWorkout';
    const TABLE_NAME = 'WOTR';

    test('Successfully creates a workout item in DynamoDB', async () => {
        const testWorkout = {
            userId: 'test-user-123',
            workoutId: `workout-${Date.now()}`,
            type: 'Running',
            durationMin: 30
        };

        // Invoke Lambda
        const invokeCommand = new InvokeCommand({
            FunctionName: FUNCTION_NAME,
            Payload: JSON.stringify(testWorkout),
        });

        const response = await lambdaClient.send(invokeCommand);

        // Parse response
        const payload = JSON.parse(Buffer.from(response.Payload!).toString());
        expect(payload.statusCode).toBe(201);

        const body = JSON.parse(payload.body);
        expect(body.message).toBe('Workout created successfully');
        expect(body.item.pk).toBe(`USER#${testWorkout.userId}`);
        expect(body.item.sk).toBe(`WORKOUT#${testWorkout.workoutId}`);

        // Verify item in DynamoDB
        const getItemCommand = new GetItemCommand({
            TableName: TABLE_NAME,
            Key: {
                pk: { S: `USER#${testWorkout.userId}` },
                sk: { S: `WORKOUT#${testWorkout.workoutId}` }
            }
        });

        const dbResponse = await dynamoDbClient.send(getItemCommand);
        expect(dbResponse.Item).toBeDefined();

        const item = unmarshall(dbResponse.Item!);
        expect(item.type).toBe(testWorkout.type);
        expect(item.durationMin).toBe(testWorkout.durationMin);
        expect(item.pk).toBe(`USER#${testWorkout.userId}`);
        expect(item.sk).toBe(`WORKOUT#${testWorkout.workoutId}`);
    }, 30000); // 30 second timeout

    test('Returns 400 for missing required fields', async () => {
        const invalidWorkout = {
            userId: 'test-user-123',
            // Missing workoutId, type, and durationMin
        };

        const invokeCommand = new InvokeCommand({
            FunctionName: FUNCTION_NAME,
            Payload: JSON.stringify(invalidWorkout),
        });

        const response = await lambdaClient.send(invokeCommand);
        const payload = JSON.parse(Buffer.from(response.Payload!).toString());

        expect(payload.statusCode).toBe(400);

        const body = JSON.parse(payload.body);
        expect(body.error).toContain('Missing required fields');
    });

    test('Handles different workout types', async () => {
        const workoutTypes = ['Running', 'Cycling', 'Swimming', 'Weightlifting'];

        for (const type of workoutTypes) {
            const testWorkout = {
                userId: 'test-user-123',
                workoutId: `workout-${type}-${Date.now()}`,
                type: type,
                durationMin: 45
            };

            const invokeCommand = new InvokeCommand({
                FunctionName: FUNCTION_NAME,
                Payload: JSON.stringify(testWorkout),
            });

            const response = await lambdaClient.send(invokeCommand);
            const payload = JSON.parse(Buffer.from(response.Payload!).toString());

            expect(payload.statusCode).toBe(201);
        }
    }, 60000); // 60 second timeout for multiple invocations

    test('Correctly prefixes PK with USER# and SK with WORKOUT#', async () => {
        const testWorkout = {
            userId: 'prefix-test-user',
            workoutId: 'prefix-test-workout',
            type: 'Testing',
            durationMin: 15
        };

        const invokeCommand = new InvokeCommand({
            FunctionName: FUNCTION_NAME,
            Payload: JSON.stringify(testWorkout),
        });

        const response = await lambdaClient.send(invokeCommand);
        const payload = JSON.parse(Buffer.from(response.Payload!).toString());

        expect(payload.statusCode).toBe(201);

        const body = JSON.parse(payload.body);

        // Verify prefixes
        expect(body.item.pk).toMatch(/^USER#/);
        expect(body.item.sk).toMatch(/^WORKOUT#/);
        expect(body.item.pk).toBe(`USER#${testWorkout.userId}`);
        expect(body.item.sk).toBe(`WORKOUT#${testWorkout.workoutId}`);
    });
});