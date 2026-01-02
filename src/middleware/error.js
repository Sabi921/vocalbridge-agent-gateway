
function errorHandler(err, req, res, next) {
    console.error(err);

    const status = err.status || 500;
    const code = err.code || 'INTERNAL_ERROR';

    res.status(status).json({
        error: {
            code,
            message: status === 500 ? 'Internal server error' : err.message,
            requestId: req.requestId
        }
    });
}

module.exports = { errorHandler };