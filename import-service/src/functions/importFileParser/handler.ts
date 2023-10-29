import { S3Event } from "aws-lambda";
import * as AWS from "aws-sdk";
const csv = require("csv-parser");

const importFileParser = async (event: S3Event): Promise<void> => {
  try {
    const s3 = new AWS.S3({ region: "eu-west-1" });
    const sqs = new AWS.SQS();

    for (const record of event.Records) {
      const params = {
        Bucket: record.s3.bucket.name,
        Key: record.s3.object.key,
      };

      const s3Stream = s3.getObject(params).createReadStream();
      const data = s3Stream.pipe(csv());

      for await (const result of data) {
        const results = await sqs
          .sendMessage({
            QueueUrl: process.env.SQS_URL,
            MessageBody: JSON.stringify(result),
          })
          .promise();

        console.log("Message sent:", results);
      }
    }
  } catch (error) {
    console.error("Error sending message:", error);
  }
};

export const main = importFileParser;
