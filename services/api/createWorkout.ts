import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const dynamoDbClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

interface WorkoutEvent {
    userId: string;
    workoutId: string;
    type: string;
    durationMin: number;
    timestamp: string;
}

export const handler = async (event: any) => {
    console.log('Event received:', JSON.stringify(event, null, 2));

    try {
        // Parse the event body
        const workout: WorkoutEvent = typeof event.body === 'string'
            ? JSON.parse(event.body)
            : event;

        // Validate required fields
        if (!workout.userId || !workout.workoutId || !workout.type || !workout.durationMin) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: 'Missing required fields: userId, workoutId, type, durationMin'
                }),
            };
        }

        const timestamp = workout.timestamp || new Date().toISOString();

        // Create item with prefixed keys
        const item = {
            pk: `USER#${workout.userId}`,
            sk: `WORKOUT#${workout.workoutId}`,
            type: workout.type,
            durationMin: workout.durationMin,
            timestamp: timestamp,
            createdAt: new Date().toISOString(),
        };

        // Put item to DynamoDB
        const command = new PutItemCommand({
            TableName: TABLE_NAME,
            Item: marshall(item),
        });

        await dynamoDbClient.send(command);

        console.log('Workout created successfully:', item);

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: 'Workout created successfully',
                item: item,
            }),
        };
    } catch (error) {
        console.error('Error creating workout:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to create workout',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};