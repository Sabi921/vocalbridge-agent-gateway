const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { requestId } = require('./middleware/requestId');
const { errorHandler } = require('./middleware/error');

const { healthRoutes } = require('./routes/health.routes');
const { tenantsRoutes } = require('./routes/tenants.routes');
const { agentsRoutes } = require('./routes/agents.routes');
const { gatewayRoutes } = require('./routes/gateway.routes');
const { billingRoutes } = require('./routes/billing.routes');

function createApp() {
  const app = express();

  app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));

  app.use(requestId);
  app.use(morgan('dev'));

  app.use('/health', healthRoutes());
  app.use('/tenants', tenantsRoutes());  
  app.use('/agents', agentsRoutes());
  app.use('/gateway', gatewayRoutes());
  app.use('/billing', billingRoutes());

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };