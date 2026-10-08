const service = require("../services/commissionPayoutService");

function handle(res, error) {
  return res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

const wrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (error) {
    handle(res, error);
  }
};

module.exports = {
  listDue: wrap(() => service.listDue()),
  listPayouts: async (req, res) => {
    try {
      res.json({ payouts: await service.listPayouts(req.query) });
    } catch (error) {
      handle(res, error);
    }
  },
  userCommissions: wrap((req) => service.getUserCommissions(req.params.userId)),
  payUser: async (req, res) => {
    try {
      res.status(201).json(await service.payUser(req.auth, req.params.userId, req.body?.earningIds));
    } catch (error) {
      handle(res, error);
    }
  },
  payAll: async (req, res) => {
    try {
      res.status(201).json(await service.payAll(req.auth));
    } catch (error) {
      handle(res, error);
    }
  }
};
