
const { createApp } = require('./app');
const { env } = require('./config/env');

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});