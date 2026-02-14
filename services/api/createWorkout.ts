import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamoDbClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

interface WorkoutEvent {
    userId: string;
    workoutId: string;
    type: string;
    durationMin: number;
    timestamp?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('Event received:', JSON.stringify(event, null, 2));

    try {
        // Parse the event body
        let workout: WorkoutEvent;
        
        if (event.body) {
            workout = JSON.parse(event.body);
        } else {
            // Handle direct invocation (for testing)
            workout = event as any;
        }

        // Validate required fields
        if (!workout.userId || !workout.workoutId || !workout.type || !workout.durationMin) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Missing required fields: userId, workoutId, type, durationMin'
                }),
            };
        }

        const timestamp = workout.timestamp || new Date().toISOString();

        // Create item with prefixed keys and GSI attributes
        const item = {
            pk: `USER#${workout.userId}`,
            sk: `WORKOUT#${workout.workoutId}`,
            GSI1PK: 'WORKOUTS',        // Allows querying all workouts
            GSI1SK: timestamp,         // Sort by timestamp
            type: workout.type,
            durationMin: workout.durationMin,
            timestamp: timestamp,
            userId: workout.userId,
            workoutId: workout.workoutId,
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
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                message: 'Workout created successfully',
                item: item,
            }),
        };
    } catch (error) {
        console.error('Error creating workout:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: 'Failed to create workout',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};