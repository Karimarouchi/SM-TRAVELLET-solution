const avisService = require('../services/avisService');
const userRepository = require('../repositories/userRepository');

const getPublicAvis = async (req, res) => {
  try {
    const avis = await avisService.getPublicAvis();
    res.json(avis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAdminAvis = async (req, res) => {
  try {
    const { status } = req.query;
    const avis = await avisService.getAllAvis(status);
    res.json(avis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createManualAvis = async (req, res) => {
  try {
    const avis = await avisService.createManualAvis(req.body);
    res.status(201).json(avis);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const createStudentAvis = async (req, res) => {
  try {
    const studentId = req.auth.sub;
    const student = await userRepository.findById(studentId);
    if (!student) return res.status(404).json({ error: 'Étudiant introuvable' });
    const studentName = `${student.prenom} ${student.nom}`;
    const avis = await avisService.createStudentAvis(studentId, studentName, req.body);
    res.status(201).json({ message: 'Avis soumis avec succès', avis });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateAvis = async (req, res) => {
  try {
    const { id } = req.params;
    const avis = await avisService.updateAvis(id, req.body);
    res.json(avis);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateAvisStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const avis = await avisService.updateStatus(id, status);
    res.json(avis);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteAvis = async (req, res) => {
  try {
    const { id } = req.params;
    await avisService.deleteAvis(id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getPublicAvis,
  getAdminAvis,
  createManualAvis,
  createStudentAvis,
  updateAvis,
  updateAvisStatus,
  deleteAvis
};
