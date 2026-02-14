import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const s3Client = new S3Client({});
const dynamoDbClient = new DynamoDBClient({});
const PHOTO_BUCKET = process.env.PHOTO_BUCKET!;
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('Event received:', JSON.stringify(event, null, 2));

    try {
        const workoutId = event.pathParameters?.workoutId;
        const body = event.body ? JSON.parse(event.body) : {};
        const userId = body.userId;
        const contentType = body.contentType || 'image/jpeg';

        if (!workoutId || !userId) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    error: 'Missing required fields: workoutId (in path) and userId (in body)',
                }),
            };
        }

        // Generate unique photo key
        const timestamp = Date.now();
        const photoKey = `workouts/${userId}/${workoutId}/${timestamp}.jpg`;

        // Create pre-signed URL for upload
        const command = new PutObjectCommand({
            Bucket: PHOTO_BUCKET,
            Key: photoKey,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes

        // Update workout item with photoKey
        const updateCommand = new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: {
                pk: { S: `USER#${userId}` },
                sk: { S: `WORKOUT#${workoutId}` },
            },
            UpdateExpression: 'SET photoKey = :photoKey, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':photoKey': { S: photoKey },
                ':updatedAt': { S: new Date().toISOString() },
            },
        });

        await dynamoDbClient.send(updateCommand);

        console.log(`Generated upload URL for workout ${workoutId}, photoKey: ${photoKey}`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                uploadUrl: uploadUrl,
                photoKey: photoKey,
                expiresIn: 300,
            }),
        };
    } catch (error) {
        console.error('Error generating upload URL:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                error: 'Failed to generate upload URL',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};