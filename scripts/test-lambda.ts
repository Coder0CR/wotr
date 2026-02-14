import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

interface WorkoutPayload {
    userId: string;
    workoutId: string;
    type: string;
    durationMin: number;
}

async function testCreateWorkout() {
    const lambdaClient = new LambdaClient({});

    const testWorkout: WorkoutPayload = {
        userId: 'user123',
        workoutId: `workout-${Date.now()}`,
        type: 'Running',
        durationMin: 30
    };

    console.log('→ Testing createWorkout Lambda...');
    console.log('  Payload:', JSON.stringify(testWorkout, null, 2));

    try {
        const command = new InvokeCommand({
            FunctionName: 'createWorkout',
            Payload: JSON.stringify(testWorkout),
        });

        const response = await lambdaClient.send(command);
        const payload = JSON.parse(Buffer.from(response.Payload!).toString());

        console.log('\n✓ Lambda Response:');
        console.log(JSON.stringify(payload, null, 2));

        if (payload.statusCode === 201) {
            console.log('\n✓ SUCCESS: Workout created successfully!');
        } else {
            console.error('\n✗ FAILED: Unexpected status code:', payload.statusCode);
            process.exit(1);
        }
    } catch (error) {
        console.error('\n✗ ERROR:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testCreateWorkout()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export { testCreateWorkout };