import { Express } from 'express';

export const configureTrustProxy = (app: Express, environment = process.env.NODE_ENV): void => {
  if (environment !== 'production') {
    app.set('trust proxy', false);
    return;
  }
  // Production: Internet -> host nginx -> localhost backend. Let Express
  // compile loopback addresses (including IPv6); trust only the immediate hop.
  app.set('trust proxy', 'loopback');
  const isLoopback = app.get('trust proxy fn') as (ip: string) => boolean;
  app.set('trust proxy', (ip: string, hop: number) => hop === 0 && isLoopback(ip));
};
