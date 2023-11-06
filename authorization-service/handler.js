"use strict";

module.exports.basicAuthorizer = async (event) => {
  const token = event.authorizationToken;

  if (!token) {
    return {
      statusCode: 401,
      body: "Authorization header not provided",
    };
  }

  const encodedCreds = token.split(" ")[1];
  const decodedCreds = Buffer.from(encodedCreds, "base64").toString("utf-8");
  const [username, password] = decodedCreds.split(":");
  const expectedPassword = process.env[username];
  const effect = !password || password !== expectedPassword ? "Deny" : "Allow";

  return {
    principalId: encodedCreds,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: event.methodArn,
        },
      ],
    },
  };
};
