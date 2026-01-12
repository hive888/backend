const app = require('./app');
const logger = require('./utils/logger');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`PTGR API running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});