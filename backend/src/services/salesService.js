const users = require("../repositories/userRepository");
const sales = require("../repositories/salesRepository");
const students = require("../repositories/studentRepository");
const { userDto } = require("../dto/userDto");

async function getMine(userId) {
  const user = await users.findById(userId);
  const profile = await sales.ensureProfile(userId);
  const assigned = await students.listForSales(userId, { pageSize: 100000 });
  return {
    user: userDto(user),
    profile: {
      phone: profile.phone || "",
      jobTitle: profile.job_title || "Conseiller",
      bio: profile.bio || ""
    },
    stats: {
      assignedStudents: assigned.total,
      onboardedStudents: assigned.rows.filter((row) => row.onboarding_completed).length
    }
  };
}

async function listSales(auth) {
  if (auth.role !== "ADMIN" && auth.role !== "SALES") {
    const error = new Error("Accès refusé.");
    error.status = 403;
    throw error;
  }
  return users.listByRole("SALES");
}

module.exports = { getMine, listSales };
