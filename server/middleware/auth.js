const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Lazy-initialised so the module can be imported in tests without DATABASE_URL
// or ENTRA_* env vars being set.
let jwks;
let pool;

function getJwks() {
  if (!jwks) {
    jwks = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
      cache: true,
      rateLimit: true,
    });
  }
  return jwks;
}

function getPool() {
  if (!pool) pool = require('../utils/db');
  return pool;
}

function getSigningKey(header, callback) {
  getJwks().getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// Verifies the Entra JWT, looks up the user in the local DB, and ensures the
// user belongs to the same parliamentarian resolved by the tenant middleware.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header.' });
  }

  const token = authHeader.slice(7);

  jwt.verify(
    token,
    getSigningKey,
    {
      audience: process.env.ENTRA_CLIENT_ID,
      issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`,
    },
    async (err, decoded) => {
      if (err) {
        console.error('[auth] JWT verification failed:', err.name, err.message);
        return res.status(401).json({ error: 'Invalid or expired token.', detail: err.message });
      }

      try {
        const { rows } = await getPool().query(
          'SELECT id, parliamentarian_id, role FROM users WHERE entra_oid = $1',
          [decoded.oid],
        );

        if (rows.length === 0) {
          return res.status(403).json({ error: 'User not registered.' });
        }

        const user = rows[0];

        // The token's tenant must match the subdomain's parliamentarian
        if (user.parliamentarian_id !== req.parliamentarian.id) {
          return res.status(403).json({ error: 'Access denied for this tenant.' });
        }

        req.user = user;
        next();
      } catch (dbErr) {
        next(dbErr);
      }
    },
  );
}

// Role hierarchy — higher rank means more permissions.
const ROLE_RANK = { staff: 1, admin: 2 };

// Returns middleware that rejects requests where the authenticated user's role
// is below the required minimum. Must be placed after requireAuth.
function requireRole(minimumRole) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const userRank = ROLE_RANK[req.user.role] ?? 0;
    const requiredRank = ROLE_RANK[minimumRole] ?? Infinity;
    if (userRank < requiredRank) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
