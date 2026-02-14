import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const dynamoDbClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;
const GSI_NAME = process.env.GSI_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('Event received:', JSON.stringify(event, null, 2));

    try {
        // Validate required query parameters
        const from = event.queryStringParameters?.from;
        const to = event.queryStringParameters?.to;

        if (!from || !to) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Missing required query parameters: from and to',
                    message: 'Both "from" and "to" date parameters are required in ISO 8601 format (e.g., 2026-02-01T00:00:00Z)',
                }),
            };
        }

        // Validate date format (basic check)
        const fromDate = new Date(from);
        const toDate = new Date(to);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Invalid date format',
                    message: 'Dates must be in ISO 8601 format (e.g., 2026-02-01T00:00:00Z)',
                }),
            };
        }

        if (fromDate > toDate) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Invalid date range',
                    message: '"from" date must be before or equal to "to" date',
                }),
            };
        }

        // Query DynamoDB using GSI
        const command = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: GSI_NAME,
            KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :from AND :to',
            ExpressionAttributeValues: {
                ':pk': { S: 'WORKOUTS' },
                ':from': { S: from },
                ':to': { S: to },
            },
        });

        const response = await dynamoDbClient.send(command);

        const workouts = response.Items?.map(item => unmarshall(item)) || [];

        console.log(`Found ${workouts.length} workouts between ${from} and ${to}`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                count: workouts.length,
                from: from,
                to: to,
                workouts: workouts,
            }),
        };
    } catch (error) {
        console.error('Error getting workouts:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: 'Failed to get workouts',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};