import { getStore } from '@netlify/blobs';
import { createApp } from '../../server/app.mjs';
export default async (request, context) => createApp({
  store:getStore({name:'rst-rovers-v2',consistency:'strong'}),
  setupHash:process.env.ADMIN_SETUP_HASH || '',
  origin:'https://rst-rovers.netlify.app',
})(request,context);
export const config = { path:'/api/*', rateLimit:{windowLimit:120,windowSize:60,aggregateBy:['ip','domain']} };
