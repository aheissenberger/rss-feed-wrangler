import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaRuntime from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import { join } from "path";

export class RssFeedWranglerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Lambda function
    const feedProcessorFunction = new lambda.NodejsFunction(
      this,
      "FeedProcessorFunction",
      {
        entry: join(__dirname, "../handlers/feed-handler.ts"),
        handler: "handler",
        runtime: lambdaRuntime.Runtime.NODEJS_24_X,
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        environment: {
          NODE_OPTIONS: "--enable-source-maps",
        },
        bundling: {
          target: "es2022",
          minify: true,
          sourceMap: true,
          esbuildArgs: {
            "--external:@aws-sdk": "",
          },
        },
      }
    );

    // Create API Gateway REST API
    const api = new apigateway.RestApi(this, "AtomFeedApi", {
      description: "API Gateway for Atom Feed Processor",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Create /feed resource
    const feedResource = api.root.addResource("feed");

    // Add GET method that proxies to Lambda
    feedResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(feedProcessorFunction)
    );

    // Output the API endpoint
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.url,
      description: "API Gateway endpoint URL",
      exportName: "AtomFeedApiEndpoint",
    });

    new cdk.CfnOutput(this, "FeedEndpoint", {
      value: `${api.url}feed`,
      description: "Feed processor endpoint URL",
      exportName: "AtomFeedProcessorEndpoint",
    });

    new cdk.CfnOutput(this, "LambdaFunctionArn", {
      value: feedProcessorFunction.functionArn,
      description: "Lambda function ARN",
      exportName: "FeedProcessorFunctionArn",
    });
  }
}
