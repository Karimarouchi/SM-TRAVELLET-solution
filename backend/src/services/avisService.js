const avisRepository = require('../repositories/avisRepository');

class AvisService {
  async getAllAvis(status) {
    return await avisRepository.findAll(status);
  }

  async getPublicAvis() {
    return await avisRepository.findAll('approved');
  }

  async createManualAvis(data) {
    if (!data.author_name || !data.content) {
      throw new Error('Le nom et le contenu sont obligatoires');
    }
    
    return await avisRepository.create({
      ...data,
      source: 'manual',
      status: 'approved' // Manuel est approuvé par défaut
    });
  }

  async createStudentAvis(studentId, studentName, data) {
    if (!data.content) {
      throw new Error("Le contenu de l'avis est obligatoire");
    }

    return await avisRepository.create({
      author_name: studentName,
      programme: data.programme,
      rating: data.rating,
      content: data.content,
      source: 'student',
      student_id: studentId,
      status: 'pending' // En attente de modération
    });
  }

  async updateAvis(id, data) {
    const existing = await avisRepository.findById(id);
    if (!existing) throw new Error('Avis non trouvé');
    
    return await avisRepository.update(id, data);
  }

  async updateStatus(id, status) {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new Error('Statut invalide');
    }
    const existing = await avisRepository.findById(id);
    if (!existing) throw new Error('Avis non trouvé');
    
    return await avisRepository.updateStatus(id, status);
  }

  async deleteAvis(id) {
    const existing = await avisRepository.findById(id);
    if (!existing) throw new Error('Avis non trouvé');
    
    return await avisRepository.delete(id);
  }
}

module.exports = new AvisService();
