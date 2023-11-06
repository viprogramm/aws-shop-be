import { handlerPath } from "@libs/handler-resolver";

export default {
  handler: `${handlerPath(__dirname)}/handler.main`,
  events: [
    {
      http: {
        method: "get",
        cors: true,
        path: "import",
        request: {
          parameters: {
            querystrings: {
              name: true,
            },
          },
        },
        authorizer: {
          name: "basicAuthorizer",
          arn: {
            "Fn::Sub":
              "arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:authorization-service-dev-basicAuthorizer",
          },
          resultTtlInSeconds: 0,
          identitySource: "method.request.header.Authorization",
          type: "token",
        },
      },
    },
  ],
};
