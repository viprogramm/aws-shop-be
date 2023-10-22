import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { formatJSONResponse } from "@libs/api-gateway";
import { middyfy } from "@libs/lambda";
import * as AWS from "aws-sdk";

const importProductsFile = async (
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> => {
  const { queryStringParameters } = event;

  if (!event?.queryStringParameters?.name) {
    formatJSONResponse({
      message: `Please add name parameter in query string`,
      event,
    });
  }

  const s3 = new AWS.S3({ region: "eu-west-1" });
  const params = {
    Bucket: process.env.BUCKET,
    Key: `uploaded/${queryStringParameters.name}`,
    Expires: 60,
    ContentType: "text/csv",
  };
  const url = s3.getSignedUrl("putObject", params);

  return formatJSONResponse(url);
};

export const main = middyfy(importProductsFile);
