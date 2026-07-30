// Unified API response envelope middleware
// Wraps res.json() to enforce consistent response shape:
//   Success: { success: true, data: <payload>, meta: { pagination, ... } }
//   Error:   { success: false, error: { code, message, details } }

function responseEnvelope(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    if (res.statusCode >= 400) {
      const errorBody = {
        success: false,
        error: {
          code: res.statusCode,
          message: body?.error || body?.message || 'Unknown error',
          details: body?.details || body?.errors || undefined,
        },
      };
      return originalJson(errorBody);
    }

    if (body && typeof body === 'object' && (body.success !== undefined || body.error !== undefined || body.data !== undefined)) {
      return originalJson(body);
    }

    const envelope = { success: true };

    if (body && typeof body === 'object' && body.pagination) {
      envelope.data = body.data;
      envelope.meta = { pagination: body.pagination };
    } else {
      envelope.data = body;
    }

    return originalJson(envelope);
  };

  next();
}

// Utility to send consistent error responses
function sendError(res, statusCode, message, details) {
  return res.status(statusCode).json({
    error: message,
    details: details || undefined,
  });
}

// Utility to send consistent success responses
function sendSuccess(res, data, statusCode = 200, meta) {
  res.status(statusCode);
  const body = { data };
  if (meta) body.meta = meta;
  return res.json(body);
}

module.exports = { responseEnvelope, sendError, sendSuccess };
