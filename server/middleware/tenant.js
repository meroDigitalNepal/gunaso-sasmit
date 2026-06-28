// Each parliamentarian branch deploys to its own App Service.
// The tenant identity is a fixed env var set per deployment, not
// derived from the incoming Host header at runtime.
function resolveTenant(req, res, next) {
  const id = process.env.PARLIAMENTARIAN_ID;

  if (!id) {
    return res.status(500).json({ error: 'Server misconfiguration: PARLIAMENTARIAN_ID not set.' });
  }

  req.parliamentarian = { id };
  next();
}

module.exports = { resolveTenant };
