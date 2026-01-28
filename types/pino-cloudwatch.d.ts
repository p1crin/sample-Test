declare module 'pino-cloudwatch' {
  import { DestinationStream } from 'pino';

  interface CloudWatchOptions {
    logGroupName: string;
    logStreamName: string;
    awsRegion: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    interval?: number;
  }

  function pinoCloudwatch(options: CloudWatchOptions): DestinationStream;

  export = pinoCloudwatch;
}
