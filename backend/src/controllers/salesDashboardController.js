const service = require("../services/salesDashboardService");

async function overview(req, res) {
  try {
    res.json(await service.getOverview(req.auth));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
  }
}

module.exports = { overview };
