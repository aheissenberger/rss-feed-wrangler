#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { RssFeedWranglerStack } from "../src/stacks/rss-feed-stack";

const app = new cdk.App();

new RssFeedWranglerStack(app, "RssFeedWranglerStack", {
  description: "Atom feed processor Lambda with API Gateway",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
});

app.synth();
