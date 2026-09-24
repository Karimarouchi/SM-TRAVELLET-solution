const users = require("../repositories/userRepository");
const students = require("../repositories/studentRepository");
const sales = require("../repositories/salesRepository");
const { hashPassword } = require("../security/password");

const ACCOUNTS = [
  {
    prenom: "Amira",
    nom: "Ben Ali",
    email: "demo@smtravel.fr",
    dateNaissance: "2000-05-15",
    password: "Demo2024!",
    role: "STUDENT"
  },
  {
    prenom: "Karim",
    nom: "Mansour",
    email: "sales@smtravel.fr",
    dateNaissance: "1994-03-10",
    password: "Sales2024!",
    role: "SALES"
  },
  {
    prenom: "Sara",
    nom: "Haddad",
    email: "admin@smtravel.fr",
    dateNaissance: "1988-11-02",
    password: "Admin2024!",
    role: "ADMIN"
  }
];

async function seed() {
  for (const account of ACCOUNTS) {
    let user = await users.findByEmail(account.email);
    if (!user) {
      const { salt, hash } = hashPassword(account.password);
      user = await users.createUser({ ...account, salt, hash });
      console.log(`Compte créé : ${account.email} / ${account.password} (${account.role})`);
    }
    if (user.role !== account.role) {
      const { query } = require("../../db");
      await query("UPDATE users SET role = $2 WHERE id = $1", [user.id, account.role]);
      user.role = account.role;
    }
    if (user.role === "STUDENT") await students.ensureProfile(user.id);
    if (user.role === "SALES") await sales.ensureProfile(user.id);
  }

  const student = await users.findByEmail("demo@smtravel.fr");
  const counselor = await users.findByEmail("sales@smtravel.fr");
  if (student && counselor) {
    const profile = await students.findByUserId(student.id);
    if (profile && !profile.assigned_sales_id) {
      await students.assignSales(student.id, counselor.id);
    }
  }
}

module.exports = { seed };
